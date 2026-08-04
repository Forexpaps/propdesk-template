import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK on server-side
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non disponible sur le serveur.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// API Health
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve public static assets
app.use("/public", express.static(path.join(__dirname, "public")));

// Route for PDF download
app.get("/api/download-features-pdf", (_req, res) => {
  const pdfPath = path.join(__dirname, "public", "Fonctionnalites_Horizon_SMC.pdf");
  if (fs.existsSync(pdfPath)) {
    res.download(pdfPath, "Fonctionnalites_Horizon_SMC.pdf");
  } else {
    res.status(404).json({ error: "Fichier PDF non trouvé." });
  }
});

// AI Trading Coach Audit Route
app.post("/api/coach/ai-review", async (req, res) => {
  try {
    const { trade, question } = req.body;

    const ai = getAiClient();

    let prompt = "";
    if (trade) {
      prompt = `
Vous êtes le Master Coach Senior de l'Académie de Trading "Horizon".
Effectuez un audit clinique, pédagogique et motivant du trade suivant soumis par un élève:

- Actif / Paire: ${trade.pair || "Non spécifié"}
- Direction: ${trade.direction || "Long/Short"}
- Prix Entrée: ${trade.entryPrice}
- Stop Loss: ${trade.stopLoss}
- Take Profit: ${trade.takeProfit}
- Prix Sortie: ${trade.exitPrice || "En cours"}
- Résultat PnL (€): ${trade.pnl} (€)
- Stratégie / Setup: ${trade.strategy || "Analyse technique"}
- État émotionnel / Émotion lors de la prise de position: ${trade.emotion || "Neutre"}
- Notes de l'élève: ${trade.notes || "Aucune note"}

Fournissez une analyse complète au format JSON strict avec les clés suivantes:
- technicalScore (nombre de 1 à 10)
- riskScore (nombre de 1 à 10)
- disciplineScore (nombre de 1 à 10)
- diagnosis (résumé en 1 phrase percutante)
- strengths (tableau de 2-3 points forts du trade)
- improvements (tableau de 2-3 points à corriger ou axes d'amélioration)
- coachFeedback (conseil détaillé et bienveillant de 3-4 paragraphes en français, faisant référence au Money Management, au R:R ratio, et au contrôle émotionnel).
`;
    } else if (question) {
      prompt = `
Vous êtes le Head Trading Coach de l'Académie Horizon.
Un élève vous pose la question suivante dans la messagerie de l'académie:

"${question}"

Répondez de manière structurée, professionnelle et pédagogique en français avec des conseils pratiques applicables directement sur le marché (gestion des risques, psychologie, analyse technique SMC & Price Action).
Fournissez le résultat au format JSON strict:
{
  "coachFeedback": "Votre réponse détaillée ici avec des puces et des exemples concréts",
  "recommendedModule": "Nom ou sujet du module de cours recommandé dans l'académie (ex: Gestion du Risque & Money Management, Smart Money Concepts, Masterclass Psychologie)"
}
`;
    } else {
      res.status(400).json({ error: "Données insuffisantes" });
      return;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);
    res.json({ success: true, data });
  } catch (err: any) {
    console.error("Erreur AI Review:", err);
    res.status(500).json({
      error: "Erreur lors de l'analyse IA du Coach.",
      details: err.message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
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
