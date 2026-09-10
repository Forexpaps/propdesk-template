import fs from "fs";
import path from "path";
import { DATA_DIR } from "./db";

/**
 * Sauvegardes automatiques de la base locale.
 *
 * L'application ne tourne que sur cet ordinateur et `data/` est exclu de git
 * (c'est voulu : la base contient des données personnelles, elle n'a rien à
 * faire dans un dépôt). Conséquence : le dépôt GitHub sauvegarde le CODE, pas
 * le journal. La seule protection existante était le bouton « Exporter mes
 * données », qu'il fallait penser à cliquer — un disque qui lâche, et des mois
 * de trades disparaissaient.
 *
 * Le déclencheur retenu est le DÉMARRAGE du serveur, et non une tâche
 * planifiée : l'app est lancée à la main (`npm run dev`), il n'y a donc pas de
 * processus qui tourne en permanence pour porter un cron, et rien à configurer
 * dans le système d'exploitation. Chaque lancement laisse une copie datée.
 */

/** Dossier des copies, à côté de la base — jamais dans le dépôt (`data/` est gitignoré). */
const BACKUP_DIR_NAME = "backups";

/**
 * Nombre de copies conservées. Au-delà, les plus anciennes sont supprimées :
 * sans cette purge, un lancement quotidien finirait par remplir le disque de
 * copies d'une base qui grossit.
 */
const MAX_BACKUPS = 20;

/**
 * Deux sauvegardes à moins de 6 h d'intervalle n'apprennent rien de plus l'une
 * que l'autre : relancer le serveur trois fois dans la matinée (ce qui arrive
 * en développement) ne doit pas évincer les copies des jours précédents, qui
 * sont justement celles qui ont de la valeur.
 */
const INTERVALLE_MIN_MS = 6 * 60 * 60 * 1000;

const NOM_BASE = "horizon.db";

/** `horizon-2026-09-05T11-42-13.db` — triable lexicographiquement, donc chronologiquement. */
function nomSauvegarde(date: Date): string {
  return `horizon-${date.toISOString().replace(/:/g, "-").replace(/\..+$/, "")}.db`;
}

function listerSauvegardes(dossier: string): string[] {
  try {
    return fs
      .readdirSync(dossier)
      .filter((f) => f.startsWith("horizon-") && f.endsWith(".db"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Copie la base et purge les plus anciennes copies. Ne lève JAMAIS : une
 * sauvegarde qui échoue (disque plein, permissions) ne doit pas empêcher
 * l'application de démarrer — elle le signale et laisse passer.
 */
export function sauvegarderBase(): void {
  try {
    const source = path.join(DATA_DIR, NOM_BASE);
    if (!fs.existsSync(source)) return; // Première installation : rien à copier.

    const dossier = path.join(DATA_DIR, BACKUP_DIR_NAME);
    fs.mkdirSync(dossier, { recursive: true });

    const existantes = listerSauvegardes(dossier);
    const derniere = existantes[existantes.length - 1];
    if (derniere) {
      const age = Date.now() - fs.statSync(path.join(dossier, derniere)).mtimeMs;
      if (age < INTERVALLE_MIN_MS) return;
    }

    // `copyFileSync` sur une base SQLite en mode WAL peut manquer les toutes
    // dernières écritures encore dans le journal. C'est acceptable ici : la
    // copie est faite AU DÉMARRAGE, avant que l'app n'écrive quoi que ce soit,
    // donc le WAL de la session précédente est déjà rapatrié dans le fichier
    // principal par la fermeture propre. On copie tout de même `-wal` et
    // `-shm` s'ils traînent (arrêt brutal), pour que la copie reste ouvrable.
    const cible = path.join(dossier, nomSauvegarde(new Date()));
    fs.copyFileSync(source, cible);
    for (const suffixe of ["-wal", "-shm"]) {
      const annexe = `${source}${suffixe}`;
      if (fs.existsSync(annexe)) fs.copyFileSync(annexe, `${cible}${suffixe}`);
    }

    // Purge : on garde les MAX_BACKUPS plus récentes (tri lexicographique =
    // chronologique, voir `nomSauvegarde`).
    const aPurger = listerSauvegardes(dossier).slice(0, -MAX_BACKUPS);
    for (const fichier of aPurger) {
      for (const suffixe of ["", "-wal", "-shm"]) {
        const chemin = path.join(dossier, `${fichier}${suffixe}`);
        if (fs.existsSync(chemin)) fs.unlinkSync(chemin);
      }
    }

    const taille = (fs.statSync(cible).size / 1024 / 1024).toFixed(1);
    console.log(`[propdesk] Sauvegarde locale créée : ${path.basename(cible)} (${taille} Mo)`);
  } catch (err) {
    console.warn("[propdesk] Sauvegarde automatique impossible — l'application démarre quand même.", err);
  }
}
