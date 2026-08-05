import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { api, apiErrorHandler } from "./server/routes";
import { startSessionCleanup } from "./server/auth/sessions";

dotenv.config();

// Le build de production sort du CJS, où import.meta.url est vide : les chemins
// sont donc résolus depuis la racine du projet, d'où le serveur est lancé.
const ROOT = process.cwd();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Les routes d'authentification n'échangent que quelques centaines d'octets. Ce
// parseur borné est déclaré AVANT le parseur global : body-parser marque la
// requête comme déjà lue, donc celui de 8 Mo passe la main. Sans cela, un corps
// de 8 Mo atteindrait le hachage du mot de passe.
app.use("/api/auth", express.json({ limit: "16kb" }));

// Les collections complètes peuvent dépasser la limite par défaut de 100 ko.
app.use(express.json({ limit: "8mb" }));

app.use("/api", api);
app.use("/api", apiErrorHandler);

// Hygiène : retire les sessions expirées au démarrage puis toutes les heures.
startSessionCleanup();

// Serve public static assets
app.use("/public", express.static(path.join(ROOT,"public")));

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur Académie Horizon démarré sur http://localhost:${PORT}`);
  });
}

startServer();
