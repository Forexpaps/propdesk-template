import type { Request, Response, NextFunction } from "express";
// Import explicite : le projet charge la lib DOM *et* @types/node, or la version
// DOM de setInterval renvoie un `number`, sans `.unref()`.
import { setInterval } from "node:timers";

/**
 * Limitation de débit par IP, en mémoire.
 *
 * Fabrique plutôt que module à état partagé : chaque appel produit sa propre
 * fenêtre. L'ancienne version tenait une `Map` au niveau du module, si bien que
 * deux limiteurs issus du même fichier se seraient marché dessus.
 *
 * Limites à connaître :
 * - l'état est en mémoire, donc perdu au redémarrage et non partagé entre
 *   plusieurs instances ;
 * - sans `app.set("trust proxy")`, derrière un reverse proxy toutes les requêtes
 *   partagent l'IP du proxy — le quota devient collectif.
 */

interface RateLimitOptions {
  /** Largeur de la fenêtre glissante, en millisecondes. */
  windowMs: number;
  /** Nombre de requêtes autorisées dans la fenêtre. */
  max: number;
  /** Message renvoyé avec le 429. */
  message: string;
}

export function createRateLimit({ windowMs, max, message }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  /**
   * Balayage périodique.
   *
   * Sans lui, la `Map` grossit indéfiniment avec les IP vues — c'est le défaut de
   * la version précédente. `.unref()` évite que le minuteur empêche le processus
   * de se terminer.
   */
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((t) => t > cutoff);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "inconnu";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      res.status(429).json({ error: message });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
