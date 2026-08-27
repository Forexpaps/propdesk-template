import express from "express";
import helmet from "helmet";
import http from "node:http";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { api, apiErrorHandler } from "./server/routes";
import { initDb } from "./server/db";
import { startSessionCleanup } from "./server/auth/sessions";
import { startSecurityEventCleanup } from "./server/auth/securityEvents";
import { startLockoutCleanup } from "./server/auth/loginLockout";

dotenv.config();

// Le build de production sort du CJS, où import.meta.url est vide : les chemins
// sont donc résolus depuis la racine du projet, d'où le serveur est lancé.
const ROOT = process.cwd();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production";

/**
 * `isProd` gouverne silencieusement `trust proxy`, la CSP, HSTS, et le flag
 * `secure` des cookies de session (voir sessions.ts/studentSessions.ts) — tout
 * en dépend, mais rien ne vérifiait jusqu'ici que `NODE_ENV` était réellement
 * positionné comme attendu. `NODE_ENV` vit dans la configuration Railway
 * (dashboard), pas dans ce dépôt : une suppression ou une faute de frappe
 * accidentelle y repasserait silencieusement toute l'app en posture "dev" en
 * production (cookies envoyables en clair, pas de CSP/HSTS, rate limiting par
 * IP cassé si le proxy Railway n'est plus fait confiance) — sans qu'aucune
 * erreur ne le signale nulle part. Trouvé en audit de sécurité, corrigé par
 * un avertissement impossible à manquer dans les logs de démarrage plutôt que
 * par un blocage strict (un `throw` casserait le tout premier déploiement,
 * avant même que `NODE_ENV` n'y soit configuré).
 *
 * `DATA_DIR` sert de signal indépendant d'un déploiement voulu en production
 * (positionné à `/data` dans le dashboard Railway, jamais en développement
 * local) : s'il est défini alors que `NODE_ENV` ne vaut pas "production",
 * c'est presque certainement une configuration incohérente plutôt qu'un choix
 * délibéré.
 */
if (process.env.DATA_DIR && !isProd) {
  console.warn(
    "\n⚠️  ATTENTION SÉCURITÉ : DATA_DIR est positionné (déploiement visiblement voulu en production) " +
      `mais NODE_ENV="${process.env.NODE_ENV ?? "(absent)"}" n'est PAS "production". ` +
      "L'app démarre donc en posture dev : cookies non sécurisés, pas de CSP/HSTS, rate limiting par IP " +
      "potentiellement contournable. Vérifie la variable NODE_ENV dans la configuration de déploiement.\n"
  );
} else if (!isProd) {
  console.log(`[propdesk] Démarrage en mode développement (NODE_ENV="${process.env.NODE_ENV ?? "(absent)"}").`);
}

// Déployé derrière un reverse proxy en production (1 saut) : sans ce
// réglage, `req.ip` (utilisé par le rate limiter, voir
// server/middleware/rateLimit.ts) retombe sur l'IP du proxy pour TOUT le
// monde — le quota de tentatives de connexion devient collectif au lieu
// d'être par visiteur. Laissé désactivé en dev, où il n'y a pas de proxy et
// où le faire confiance à un X-Forwarded-For non maîtrisé serait risqué.
if (isProd) {
  app.set("trust proxy", 1);
}

// Content-Security-Policy activée seulement en production : le serveur de
// dev Vite a besoin d'`eval`/scripts inline pour le rechargement à chaud
// (HMR), et n'est jamais exposé publiquement. `style-src 'unsafe-inline'`
// reste nécessaire : l'app utilise `style={{...}}` pour des valeurs
// dynamiques (barres de progression, dégradés) sans nonce CSP en place.
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
          },
        }
      : false,
    hsts: isProd,
  })
);

// Les routes d'authentification n'échangent que quelques centaines
// d'octets. Ce parseur borné est déclaré AVANT le parseur global : body-parser
// marque la requête comme déjà lue, donc celui de 8 Mo passe la main. Sans
// cela, un corps de 8 Mo atteindrait le hachage du mot de passe.
app.use("/api/auth", express.json({ limit: "16kb" }));

// Les collections complètes peuvent dépasser la limite par défaut de 100 ko.
app.use(express.json({ limit: "8mb" }));

app.use("/api", api);
app.use("/api", apiErrorHandler);

// Serve public static assets
app.use("/public", express.static(path.join(ROOT,"public")));

async function startServer() {
  // Schéma + migrations d'abord, avant que quoi que ce soit ne touche `db` —
  // le client libSQL n'a pas de setup synchrone au chargement du module comme
  // le faisait better-sqlite3, il faut donc l'attendre explicitement ici.
  await initDb();

  // Hygiène : retire les sessions expirées au démarrage puis toutes les heures.
  startSessionCleanup();
  // Journal de sécurité : purge RGPD à 90 jours (IP = donnée personnelle).
  startSecurityEventCleanup();
  // Verrouillages de compte : purge d'hygiène des lignes hors de toute fenêtre active.
  startLockoutCleanup();

  // Le serveur HTTP est créé explicitement, au lieu de laisser `app.listen()`
  // le faire : en développement, Vite a besoin d'une référence dessus pour y
  // brancher le rechargement à chaud (voir plus bas).
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Sans cette ligne, le rechargement à chaud ne fonctionne pas.
        //
        // En mode middleware, Vite ne connaît pas le serveur HTTP qui
        // l'héberge : il ne peut donc pas y brancher son WebSocket, et ouvre
        // le sien sur un port séparé (24678 par défaut). Ce port n'est servi
        // par personne — Express écoute sur `PORT` et ignore tout le reste —
        // si bien que le navigateur tentait `ws://localhost:24678` en boucle,
        // échouait, et il fallait recharger la page à la main après chaque
        // modification.
        //
        // Lui passer le serveur revient à lui dire « greffe-toi sur celui-ci » :
        // Vite s'abonne à l'événement `upgrade` et le WebSocket voyage sur le
        // même port que le reste. Plus de second port à ouvrir, et cela
        // fonctionne tel quel derrière un tunnel ou un reverse proxy, qui n'ont
        // qu'un port à relayer.
        hmr: { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT,"dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur Académie Horizon démarré sur http://localhost:${PORT}`);
  });
}

startServer();
