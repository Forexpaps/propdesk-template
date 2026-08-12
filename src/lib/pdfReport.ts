import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Trade, TradingAccount, StudentProfile, EmotionState } from "../types";
import { formatCurrency } from "./format";
import { computePerformanceStats, computeJournalSummary } from "./performanceStats";
import { positionsDuCompte, dailyLossPercent, totalDrawdownPercent } from "./walletStats";

/**
 * Génère et télécharge un rapport PDF personnel (Journal + Rentabilité +
 * Portefeuille) pour l'utilisateur connecté, entièrement côté client.
 *
 * Remplace l'ancien catalogue marketing statique
 * (`public/Fonctionnalites_Horizon_SMC.pdf`, généré par
 * `scripts/generate_pdf.js`, supprimés tous les deux) qui vantait des
 * fonctionnalités d'IA retirées de l'app et affichait des montants en `€`.
 *
 * Aucun graphique recharts capturé : le bouton qui appelle cette fonction
 * est accessible depuis n'importe quel onglet (pas seulement Rentabilité),
 * donc le DOM des graphiques n'existe pas forcément au moment du clic —
 * uniquement du texte et des tableaux (`jspdf-autotable`), robustes en
 * toutes circonstances.
 */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const GREEN: [number, number, number] = [0, 230, 118];
const DARK_BG: [number, number, number] = [17, 22, 21];
const SECTION_BG: [number, number, number] = [27, 35, 32];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_LABEL: [number, number, number] = [140, 140, 140];
const GRAY_ITALIC: [number, number, number] = [120, 120, 120];

/** `jspdf-autotable` ajoute cette propriété à l'instance au runtime (voir
 * `drawTable()` dans son bundle) — absente des types fournis par `jspdf`. */
type DocWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

const EMOTION_LABELS: Record<EmotionState, string> = {
  Disciplined: "Discipliné",
  FOMO: "FOMO",
  Impulsive: "Impulsif",
  Anxious: "Anxieux",
  Calm: "Calme",
  Greedy: "Avarice",
};

const RESULT_LABELS: Record<Trade["result"], string> = {
  WIN: "Gagnant",
  LOSS: "Perdant",
  BREAKEVEN: "Breakeven",
  OPEN: "Ouvert",
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Même convention que le reste de l'app : `+` devant un montant positif,
 * `formatCurrency` porte déjà le signe négatif. */
function formatMoneySigned(amount: number): string {
  return `${amount >= 0 ? "+" : ""}${formatCurrency(amount)}`;
}

/** PnL d'un trade individuel. Un trade saisi en `%` n'est pas une somme
 * d'argent — affiché en pourcentage, jamais converti. */
function formatTradePnl(t: Trade): string {
  if ((t.pnlUnit ?? "USD") === "PERCENT") {
    return `${t.pnl >= 0 ? "+" : ""}${t.pnl}%`;
  }
  return formatMoneySigned(t.pnl);
}

export function generateTradingReportPdf(
  student: StudentProfile,
  trades: Trade[],
  accounts: TradingAccount[]
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as DocWithAutoTable;
  let y = 20;

  function checkNewPage(neededHeight = 20) {
    if (y + neededHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = 20;
    }
  }

  function newSectionPage(title: string) {
    doc.addPage();
    y = 20;
    doc.setFillColor(...SECTION_BG);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 10, "F");
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), MARGIN + 4, y + 6.8);
    y += 16;
  }

  function emptyMessage(text: string) {
    doc.setTextColor(...GRAY_ITALIC);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(text, MARGIN, y);
    y += 10;
  }

  function subLabel(text: string) {
    checkNewPage(10);
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(text, MARGIN, y);
    y += 5;
  }

  /** Grille de chiffres clés façon "cartes", 3 colonnes par défaut. */
  function kpiGrid(items: { label: string; value: string }[], columns = 3) {
    const colWidth = CONTENT_WIDTH / columns;
    const rows = Math.ceil(items.length / columns);
    checkNewPage(rows * 16 + 4);
    const rowStartY = y;
    items.forEach((item, idx) => {
      const col = idx % columns;
      const row = Math.floor(idx / columns);
      const x = MARGIN + col * colWidth;
      const rowY = rowStartY + row * 16;
      doc.setTextColor(...GRAY_LABEL);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(item.label, x, rowY);
      doc.setTextColor(...WHITE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(item.value, x, rowY + 6);
    });
    y = rowStartY + rows * 16 + 4;
  }

  function drawTable(head: string[], body: string[][]) {
    checkNewPage(20);
    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 7, textColor: [220, 220, 220], fillColor: DARK_BG },
      headStyles: { fillColor: GREEN, textColor: [10, 14, 13], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [22, 28, 26] },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // ===== Page de garde =====
  doc.setFillColor(...DARK_BG);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 32, "F");
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 32, "S");

  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("PropDesk — Rapport de Trading Personnel", MARGIN + 6, y + 11);

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(student.name, MARGIN + 6, y + 20);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  const generatedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.text(`Export personnel généré le ${generatedAt}`, MARGIN + 6, y + 27);

  // ===== Section 1 : Journal de trading =====
  newSectionPage("Journal de trading");

  const journalSummary = computeJournalSummary(trades);
  kpiGrid([
    { label: "TOTAL TRADES", value: String(journalSummary.totalTrades) },
    { label: "TAUX DE RÉUSSITE", value: `${journalSummary.winRate}%` },
    { label: "PNL CUMULÉ", value: formatMoneySigned(journalSummary.totalPnL) },
    { label: "PROFIT FACTOR", value: journalSummary.profitFactor },
    { label: "RATIO R:R MOYEN", value: `1:${journalSummary.avgRR}` },
    { label: "DISCIPLINE ÉMOTIONNELLE", value: `${journalSummary.disciplineEmoPercent}%` },
  ]);
  y += 4;

  if (trades.length === 0) {
    emptyMessage("Aucun trade enregistré pour le moment.");
  } else {
    const sortedTrades = [...trades].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const rows = sortedTrades.map((t) => [
      t.date,
      t.pair,
      t.marketCategory,
      t.direction === "LONG" ? "Long" : "Short",
      String(t.entryPrice),
      t.exitPrice !== undefined ? String(t.exitPrice) : "—",
      formatTradePnl(t),
      `1:${t.riskRewardRatio}`,
      RESULT_LABELS[t.result],
      t.strategy,
      EMOTION_LABELS[t.emotion],
    ]);
    drawTable(
      ["Date", "Paire", "Marché", "Direction", "Entrée", "Sortie", "PnL", "R:R", "Résultat", "Stratégie", "Émotion"],
      rows
    );
  }

  // ===== Section 2 : Rentabilité =====
  newSectionPage("Rentabilité");

  if (trades.length === 0) {
    emptyMessage("Pas encore assez de données pour calculer des statistiques de rentabilité.");
  } else {
    const stats = computePerformanceStats(student, trades);

    kpiGrid(
      [
        { label: "TAUX DE RÉUSSITE GLOBAL", value: `${stats.winRate}%` },
        { label: "PNL TOTAL", value: formatMoneySigned(stats.totalPnL) },
        { label: "INDICE DE DISCIPLINE", value: `${stats.disciplineScore}%` },
        {
          label: "ÉCART DE CAPITAL",
          value: `${stats.isCapitalUp ? "+" : ""}${stats.capitalDiffPercent.toFixed(1)}%`,
        },
      ],
      2
    );
    y += 4;

    subLabel("Par stratégie");
    if (stats.strategyChartData.length === 0) {
      emptyMessage("Aucune donnée disponible.");
    } else {
      drawTable(
        ["Stratégie", "Trades", "Win Rate", "PnL"],
        stats.strategyChartData.map((s) => [s.strategy, String(s.tradesCount), `${s.winRate}%`, formatCurrency(s.pnl)])
      );
    }

    subLabel("Par émotion");
    drawTable(
      ["Émotion", "Trades", "Win Rate", "PnL"],
      stats.emotionChartData.map((e) => [e.emotion, String(e.tradesCount), `${e.winRate}%`, formatCurrency(e.pnl)])
    );

    subLabel("Par actif (top 8)");
    if (stats.pairChartData.length === 0) {
      emptyMessage("Aucune donnée disponible.");
    } else {
      drawTable(
        ["Actif", "Trades", "PnL"],
        stats.pairChartData.map((p) => [p.pair, String(p.tradesCount), formatCurrency(p.pnl)])
      );
    }

    subLabel("Par direction");
    if (stats.directionChartData.length === 0) {
      emptyMessage("Aucune donnée disponible.");
    } else {
      drawTable(
        ["Direction", "Trades", "PnL"],
        stats.directionChartData.map((d) => [d.direction, String(d.tradesCount), formatCurrency(d.pnl)])
      );
    }

    subLabel("Par jour de la semaine");
    if (stats.dayChartData.length === 0) {
      emptyMessage("Aucune donnée disponible.");
    } else {
      drawTable(
        ["Jour", "Trades", "PnL"],
        stats.dayChartData.map((d) => [d.day, String(d.tradesCount), formatCurrency(d.pnl)])
      );
    }

    subLabel(
      `Par session de marché${stats.tradesSansHeure > 0 ? ` (${stats.tradesSansHeure} trade(s) sans heure exclus)` : ""}`
    );
    if (stats.sessionChartData.length === 0) {
      emptyMessage("Aucun trade avec une heure d'entrée renseignée pour l'instant.");
    } else {
      drawTable(
        ["Session", "Trades", "PnL"],
        stats.sessionChartData.map((s) => [s.session, String(s.tradesCount), formatCurrency(s.pnl)])
      );
    }

    subLabel("Erreurs les plus fréquentes");
    if (stats.mistakeChartData.length === 0) {
      emptyMessage("Aucune erreur taguée pour l'instant.");
    } else {
      drawTable(
        ["Erreur", "Occurrences", "Coût"],
        stats.mistakeChartData.map((m) => [m.mistake, String(m.count), formatCurrency(m.cost)])
      );
      checkNewPage(10);
      doc.setTextColor(...GRAY_ITALIC);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `Sans ces erreurs, résultat cumulé estimé : ${formatCurrency(stats.netResultWithoutErrors)} (au lieu de ${formatCurrency(stats.totalPnL)}).`,
        MARGIN,
        y
      );
      y += 8;
    }
  }

  // ===== Section 3 : Portefeuille =====
  newSectionPage("Portefeuille");

  if (accounts.length === 0) {
    emptyMessage("Aucun compte de trading enregistré.");
  } else {
    const totalCombinedEquity = accounts.reduce((acc, a) => acc + a.equity, 0);
    const totalCombinedInitial = accounts.reduce((acc, a) => acc + a.initialBalance, 0);
    const totalCombinedPnl = totalCombinedEquity - totalCombinedInitial;

    kpiGrid(
      [
        { label: "NOMBRE DE COMPTES", value: String(accounts.length) },
        { label: "CAPITAL INITIAL COMBINÉ", value: formatCurrency(totalCombinedInitial) },
        { label: "ÉQUITÉ COMBINÉE", value: formatCurrency(totalCombinedEquity) },
        { label: "PNL COMBINÉ", value: formatMoneySigned(totalCombinedPnl) },
      ],
      2
    );
    y += 4;

    const rows = accounts.map((a) => {
      const pnl = a.equity - a.initialBalance;
      return [
        a.name,
        a.firmOrBroker,
        a.type,
        a.status,
        formatCurrency(a.initialBalance),
        formatCurrency(a.equity),
        formatMoneySigned(pnl),
        `${totalDrawdownPercent(a).toFixed(1)}%`,
        `${dailyLossPercent(trades, a).toFixed(1)}%`,
        String(positionsDuCompte(trades, a.id)),
      ];
    });
    drawTable(
      ["Nom", "Firme/Broker", "Type", "Statut", "Solde initial", "Équité", "PnL", "Drawdown total", "Perte du jour", "Trades"],
      rows
    );
  }

  const filename = `PropDesk_Rapport_${slugify(student.name)}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
