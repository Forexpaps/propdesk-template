import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { randomBytes } from "node:crypto";
import multer from "multer";
import { DATA_DIR } from "./db";
import { requireStaffKind } from "./auth/middleware";
import { createRateLimit } from "./middleware/rateLimit";

/**
 * Vidéos de leçon téléversées par le staff (module Cours) — alternative à
 * `Lesson.videoUrl` pointant vers un lien externe (YouTube, Vimeo…) : le
 * fichier est stocké directement sur ce serveur, sous `DATA_DIR` pour
 * survivre aux redéploiements (même volume persistant que la base SQLite,
 * voir `server/db.ts` — jamais dans le dossier de build, écrasé à chaque
 * déploiement).
 *
 * Séparé de `server/routes.ts` : cette route ne parle jamais JSON (upload
 * multipart en entrée, flux binaire en sortie), contrairement à tout le
 * reste de l'API.
 */
export const uploadsRouter = Router();

const VIDEOS_DIR = path.join(DATA_DIR, "uploads", "videos");
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

/**
 * Formats acceptés en téléversement direct : ceux qu'un `<video>` HTML sait
 * lire nativement dans la quasi-totalité des navigateurs (mp4/webm), plus
 * mov/mkv pour ne pas rejeter un export brut de téléphone ou de logiciel de
 * capture — au prix d'une lecture qui peut échouer sur certains navigateurs
 * pour ces deux derniers (aucune conversion n'est faite ici).
 */
const ALLOWED_VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/ogg": ".ogv",
};

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 Go — leçon filmée longue incluse.

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_VIDEO_EXTENSIONS[file.mimetype] ?? path.extname(file.originalname) ?? "";
    // Nom généré, jamais celui envoyé par le client : un nom de fichier
    // arbitraire (`../../etc/passwd`, espaces, caractères spéciaux) ne doit
    // jamais atteindre le système de fichiers tel quel.
    cb(null, `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_VIDEO_EXTENSIONS[file.mimetype]) {
      cb(new Error("UNSUPPORTED_VIDEO_FORMAT"));
      return;
    }
    cb(null, true);
  },
});

const uploadRateLimit = createRateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: "Trop de vidéos téléversées. Réessaie dans quelques minutes.",
});

/**
 * Téléverse une vidéo de leçon — réservée au staff (même droit que l'édition
 * du programme, `server/routes.ts`/`writeCollectionForAuth` sur la
 * collection "modules" : aucune autorisation dédiée n'existe pour ça
 * aujourd'hui, cohérent avec le reste de l'éditeur de cours).
 *
 * Répond l'URL relative à stocker tel quel dans `Lesson.videoUrl` — jamais
 * l'URL absolue (dépendrait du domaine, casserait en cas de changement).
 */
uploadsRouter.post(
  "/videos",
  requireStaffKind,
  uploadRateLimit,
  (req, res) => {
    upload.single("video")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: `Vidéo trop volumineuse (max ${MAX_VIDEO_BYTES / (1024 * 1024 * 1024)} Go).` });
          return;
        }
        if (err instanceof Error && err.message === "UNSUPPORTED_VIDEO_FORMAT") {
          res.status(400).json({ error: "Format vidéo non supporté (mp4, webm, mov, mkv, ogv uniquement)." });
          return;
        }
        res.status(400).json({ error: "Téléversement échoué." });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Aucun fichier vidéo reçu." });
        return;
      }
      res.status(201).json({ url: `/api/uploads/videos/${req.file.filename}` });
    });
  }
);

/**
 * Sert une vidéo téléversée, avec support des requêtes `Range` — sans lui,
 * le lecteur `<video>` ne peut ni avancer dans la vidéo avant qu'elle soit
 * entièrement chargée, ni reprendre une lecture interrompue, et certains
 * navigateurs refusent carrément de lire un flux qui ne l'annonce pas
 * (`Accept-Ranges: bytes`).
 *
 * Accessible à toute session authentifiée (staff ET élève, voir `requireAuth`
 * déjà posé sur `api` avant ce routeur) — regarder une leçon n'est pas une
 * action réservée au staff, contrairement à en téléverser une.
 */
uploadsRouter.get("/videos/:filename", (req: Request, res: Response) => {
  // `path.basename` retire tout séparateur de chemin avant même de
  // constuire le chemin final — un `filename` du type `../../horizon.db` ne
  // peut donc jamais sortir de VIDEOS_DIR, quoi que contienne le paramètre.
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(VIDEOS_DIR, safeName);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.status(404).json({ error: "Vidéo introuvable." });
      return;
    }

    const range = req.headers.range;
    const contentType = guessVideoContentType(safeName);

    if (!range) {
      res.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).set("Content-Range", `bytes */${stats.size}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : stats.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
      res.status(416).set("Content-Range", `bytes */${stats.size}`).end();
      return;
    }

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": contentType,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  });
});

function guessVideoContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const byExt: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".ogv": "video/ogg",
  };
  return byExt[ext] ?? "application/octet-stream";
}
