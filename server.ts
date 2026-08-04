import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { api, apiErrorHandler } from "./server/routes";

dotenv.config();

// Le build de production sort du CJS, où import.meta.url est vide : les chemins
// sont donc résolus depuis la racine du projet, d'où le serveur est lancé.
const ROOT = process.cwd();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Les collections complètes peuvent dépasser la limite par défaut de 100 ko.
app.use(express.json({ limit: "8mb" }));

app.use("/api", api);
app.use("/api", apiErrorHandler);

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
