(() => {
  "use strict";

  const DATA = window.FOREX_MARKET_DATA;
  if (!DATA?.pairs) {
    document.body.innerHTML = '<p style="padding:2rem">Les données de marché n’ont pas pu être chargées.</p>';
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = "replayfx-journal-v1";
  const SETTINGS_KEY = "replayfx-settings-v1";
  const TIMEFRAME_NAMES = { "1m": "1 minute", "5m": "5 minutes", "15m": "15 minutes", "30m": "30 minutes", "1h": "1 heure", "4h": "4 heures", "1d": "Journalier" };
  const TIMEFRAME_SHORT = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1J" };
  const TIMEFRAME_SECONDS = { "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400 };
  const PAIR_ICONS = { EURUSD: "€", GBPUSD: "£", USDJPY: "¥", USDCHF: "₣", USDCAD: "C$", AUDUSD: "A$", NZDUSD: "N$" };
  const EXIT_LABELS = { stop_loss: "Stop loss", take_profit: "Take profit", break_even: "Break-even", manual: "Fermeture manuelle" };
  const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const savedSettings = loadJSON(SETTINGS_KEY, {});
  const timeframeCache = new Map();
  const state = {
    pair: savedSettings.pair && DATA.pairs[savedSettings.pair] ? savedSettings.pair : "EURUSD",
    timeframe: savedSettings.timeframe || "15m",
    sessionData: [],
    sessionStart: 0,
    revealed: 0,
    marketTime: null,
    marketPrice: null,
    initialReveal: 0,
    visibleCount: 95,
    panOffset: 0,
    playing: false,
    timer: null,
    direction: "long",
    riskMode: "percent",
    activeTrade: null,
    trades: loadJSON(STORAGE_KEY, []),
    draft: { entry: 0, stop: 0, target: 0 },
    crosshair: null,
    dragging: null,
    hoveredLevel: null,
    drawMode: "cursor",
    drawings: [],
    drawingDraft: null,
    rsiEnabled: Boolean(savedSettings.rsiEnabled),
    dataSource: "HistData",
    importedBars: null,
    chartMetrics: null,
    lastTouchDistance: null
  };

  const chart = $("#price-chart");
  const ctx = chart.getContext("2d");
  const stage = $("#chart-stage");
  const equityCanvas = $("#equity-chart");
  const drawdownCanvas = $("#drawdown-chart");

  function loadJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function persistSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pair: state.pair, timeframe: state.timeframe, theme: document.documentElement.dataset.theme || "dark", rsiEnabled: state.rsiEnabled }));
  }

  function persistTrades() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
    } catch (_) {
      // Images are the first thing removed if the browser's local quota is reached.
      state.trades.forEach(trade => {
        trade.snapshots = (trade.snapshots || []).map(shot => ({ ...shot, data: null }));
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trades));
      toast("Stockage optimisé", "Les anciennes images ont été retirées, les statistiques sont conservées.", "!");
    }
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pipSize(pair = state.pair) {
    return pair.endsWith("JPY") ? 0.01 : 0.0001;
  }

  function precision(pair = state.pair) {
    return pair.endsWith("JPY") ? 3 : 5;
  }

  function price(value, pair = state.pair) {
    return Number(value).toFixed(precision(pair));
  }

  function number(value, digits = 2) {
    return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
  }

  function money(value) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function signed(value, suffix = "") {
    const numeric = Number(value) || 0;
    return `${numeric > 0 ? "+" : ""}${number(numeric)}${suffix}`;
  }

  function dateLabel(timestamp, long = false) {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat("fr-FR", long ? { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function durationLabel(seconds) {
    if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
    if (seconds < 86400) return `${number(seconds / 3600, seconds < 7200 ? 1 : 0)} h`;
    return `${number(seconds / 86400, 1)} j`;
  }

  function currentBar() {
    return state.sessionData[Math.max(0, state.revealed - 1)];
  }

  function currentMarketPrice() {
    const bar = currentBar();
    return Number.isFinite(state.marketPrice) ? state.marketPrice : bar?.[4];
  }

  function accountBalance() {
    const base = Number($("#account-balance").value) || 10000;
    return base + state.trades.reduce((sum, trade) => sum + (Number(trade.pnlCash) || 0), 0);
  }

  function toast(title, message, icon = "✓") {
    const element = document.createElement("div");
    element.className = "toast";
    element.innerHTML = `<i>${icon}</i><span><b>${escapeHTML(title)}</b><small>${escapeHTML(message)}</small></span>`;
    $("#toast-stack").appendChild(element);
    setTimeout(() => element.remove(), 4300);
  }

  function escapeHTML(value = "") {
    const node = document.createElement("div");
    node.textContent = String(value);
    return node.innerHTML;
  }

  function stopPlayback() {
    state.playing = false;
    clearInterval(state.timer);
    state.timer = null;
    $("#play-toggle").classList.remove("is-playing");
    $("#play-toggle").setAttribute("aria-label", "Lancer la lecture");
  }

  function startPlayback() {
    if (state.revealed >= state.sessionData.length) {
      toast("Fin de session", "Toutes les bougies de cette session sont révélées.", "■");
      return;
    }
    stopPlayback();
    state.playing = true;
    $("#play-toggle").classList.add("is-playing");
    $("#play-toggle").setAttribute("aria-label", "Mettre en pause");
    const run = () => {
      if (!state.playing || !revealNext()) stopPlayback();
    };
    state.timer = setInterval(run, Number($("#speed-select").value));
  }

  function barsForTimeframe(timeframe) {
    if (state.importedBars) return timeframe === state.timeframe ? state.importedBars : [];
    const pairData = DATA.pairs[state.pair];
    if (!pairData) return [];
    if (timeframe === "1m" || timeframe === "5m") return pairData[timeframe] || [];
    const cacheKey = `${state.pair}:${timeframe}`;
    if (!timeframeCache.has(cacheKey)) timeframeCache.set(cacheKey, aggregateTimeframeBars(pairData["5m"] || [], timeframeSeconds(timeframe)));
    return timeframeCache.get(cacheKey);
  }

  function aggregateTimeframeBars(bars, seconds) {
    const result = [];
    let current = null;
    let bucket = null;
    bars.forEach(([timestamp, open, high, low, close]) => {
      const nextBucket = Math.floor(timestamp / seconds) * seconds;
      if (nextBucket !== bucket) {
        if (current) result.push(current);
        bucket = nextBucket;
        current = [nextBucket, open, high, low, close];
      } else {
        current[2] = Math.max(current[2], high);
        current[3] = Math.min(current[3], low);
        current[4] = close;
      }
    });
    if (current) result.push(current);
    return result;
  }

  function rawBars() {
    return barsForTimeframe(state.timeframe);
  }

  function timeframeSeconds(timeframe = state.timeframe) {
    return TIMEFRAME_SECONDS[timeframe] || 60;
  }

  function findLastBarAtOrBefore(bars, timestamp) {
    let low = 0;
    let high = bars.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (bars[middle][0] <= timestamp) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found;
  }

  function findLastCompletedBarIndex(bars, marketTime, timeframe) {
    return findLastBarAtOrBefore(bars, marketTime - timeframeSeconds(timeframe));
  }

  function timeAtSessionIndex(index, bars, timeframe) {
    if (!bars.length) return 0;
    const seconds = timeframeSeconds(timeframe);
    if (index <= 0) return bars[0][0] + index * seconds;
    if (index >= bars.length - 1) return bars.at(-1)[0] + (index - (bars.length - 1)) * seconds;
    const base = Math.floor(index);
    return bars[base][0] + (index - base) * seconds;
  }

  function sessionIndexAtTime(timestamp, bars, timeframe) {
    if (!bars.length) return -1;
    const seconds = timeframeSeconds(timeframe);
    if (timestamp <= bars[0][0]) return (timestamp - bars[0][0]) / seconds;
    if (timestamp >= bars.at(-1)[0]) return bars.length - 1 + (timestamp - bars.at(-1)[0]) / seconds;
    const base = findLastBarAtOrBefore(bars, timestamp);
    return base + clamp((timestamp - bars[base][0]) / seconds, 0, .999);
  }

  function marketCursorTime() {
    const bar = currentBar();
    return state.marketTime || (bar ? bar[0] + timeframeSeconds() : 0);
  }

  function switchTimeframe(nextTimeframe) {
    if (nextTimeframe === state.timeframe) return true;
    if (state.importedBars) {
      toast("Unité indisponible", "Les données CSV importées ne contiennent qu’une seule unité de temps.", "!");
      return false;
    }

    const oldTimeframe = state.timeframe;
    const oldSession = state.sessionData;
    const marketTime = marketCursorTime();
    const all = barsForTimeframe(nextTimeframe);
    const targetIndex = findLastCompletedBarIndex(all, marketTime, nextTimeframe);
    if (!all.length || targetIndex < 0) {
      toast("Historique indisponible", `${TIMEFRAME_NAMES[nextTimeframe]} n’est pas disponible à cette date.`, "!");
      return false;
    }

    stopPlayback();
    const oldWindow = visibleWindow();
    const oldViewEndTime = oldWindow.end > 0
      ? timeAtSessionIndex(oldWindow.end - 1, oldSession, oldTimeframe) + timeframeSeconds(oldTimeframe)
      : marketTime;
    const oldVisibleCount = state.visibleCount;
    const timedDrawings = [...state.drawings, ...(state.drawingDraft ? [state.drawingDraft] : [])].map(drawing => ({
      drawing,
      p1Time: timeAtSessionIndex(drawing.p1.index, oldSession, oldTimeframe),
      p2Time: timeAtSessionIndex(drawing.p2.index, oldSession, oldTimeframe)
    }));

    const maxLength = Math.min(all.length, nextTimeframe === "1d" ? 310 : 900);
    const historyTarget = nextTimeframe === "1d" ? 55 : 115;
    const viewEndIndex = findLastCompletedBarIndex(all, oldViewEndTime, nextTimeframe);
    const entryIndex = state.activeTrade ? findLastCompletedBarIndex(all, state.activeTrade.entryTime, nextTimeframe) : -1;
    let sessionStart = Math.max(0, targetIndex - historyTarget + 1);
    for (const neededIndex of [viewEndIndex, entryIndex]) {
      if (neededIndex >= 0 && targetIndex - neededIndex < maxLength) sessionStart = Math.min(sessionStart, neededIndex);
    }
    if (targetIndex - sessionStart >= maxLength) sessionStart = targetIndex - maxLength + 1;
    const sessionEnd = Math.min(all.length, sessionStart + maxLength);
    const nextSession = all.slice(sessionStart, sessionEnd);

    state.timeframe = nextTimeframe;
    state.sessionStart = sessionStart;
    state.sessionData = nextSession;
    state.revealed = targetIndex - sessionStart + 1;
    state.initialReveal = state.revealed;
    state.visibleCount = clamp(oldVisibleCount, 28, Math.min(220, state.revealed));
    const localViewEnd = viewEndIndex - sessionStart;
    state.panOffset = localViewEnd >= 0
      ? clamp(state.revealed - (localViewEnd + 1), 0, Math.max(0, state.revealed - state.visibleCount))
      : 0;
    state.crosshair = null;
    state.drawings = timedDrawings.slice(0, state.drawings.length).map(({ drawing, p1Time, p2Time }) => ({
      ...drawing,
      p1: { ...drawing.p1, index: sessionIndexAtTime(p1Time, nextSession, nextTimeframe) },
      p2: { ...drawing.p2, index: sessionIndexAtTime(p2Time, nextSession, nextTimeframe) }
    }));
    if (state.drawingDraft) {
      const draft = timedDrawings.at(-1);
      state.drawingDraft = {
        ...draft.drawing,
        p1: { ...draft.drawing.p1, index: sessionIndexAtTime(draft.p1Time, nextSession, nextTimeframe) },
        p2: { ...draft.drawing.p2, index: sessionIndexAtTime(draft.p2Time, nextSession, nextTimeframe) }
      };
    }
    if (state.activeTrade) state.activeTrade.entryIndex = entryIndex - sessionStart;

    syncSelectors();
    syncDrawingToolbar();
    persistSettings();
    updateAll();
    toast("Unité de temps changée", `${TIMEFRAME_NAMES[nextTimeframe]} · même instant de marché conservé.`, "↔");
    return true;
  }

  function startSession(randomize = false) {
    stopPlayback();
    if (state.activeTrade) {
      toast("Position conservée", "Fermez la position avant de changer de session.", "!");
      syncSelectors();
      return false;
    }
    const all = rawBars();
    if (!all.length) return false;
    const maxLength = Math.min(all.length, state.timeframe === "1d" ? 310 : 900);
    const minStart = Math.max(0, all.length - 1750);
    const maxStart = Math.max(minStart, all.length - maxLength);
    state.sessionStart = randomize ? randomInt(minStart, maxStart) : maxStart;
    state.sessionData = all.slice(state.sessionStart, state.sessionStart + maxLength);
    state.initialReveal = Math.min(state.sessionData.length - 1, state.timeframe === "1d" ? 55 : 115);
    state.revealed = Math.max(2, state.initialReveal);
    state.marketTime = currentBar()[0] + timeframeSeconds();
    state.marketPrice = currentBar()[4];
    state.visibleCount = state.timeframe === "1d" ? 70 : 95;
    state.panOffset = 0;
    state.crosshair = null;
    state.drawings = [];
    state.drawingDraft = null;
    syncDrawingToolbar();
    syncDraftToMarket();
    updateAll();
    return true;
  }

  function syncSelectors() {
    $("#pair-select").value = state.pair;
    $("#timeframe-select").value = state.timeframe;
  }

  function syncDraftToMarket() {
    const bar = currentBar();
    if (!bar) return;
    const entry = currentMarketPrice();
    const risk = pipSize() * 20;
    state.draft.entry = entry;
    state.draft.stop = entry + (state.direction === "long" ? -risk : risk);
    state.draft.target = entry + (state.direction === "long" ? risk * 2 : -risk * 2);
    syncDraftInputs();
  }

  function syncDraftInputs() {
    $("#entry-price").value = price(state.draft.entry);
    $("#stop-price").value = price(state.draft.stop);
    $("#target-price").value = price(state.draft.target);
    updateRiskPreview();
  }

  function revealNext() {
    if (state.revealed >= state.sessionData.length) return false;
    state.revealed += 1;
    if (state.panOffset > 0) state.panOffset += 1;
    const bar = currentBar();
    state.marketTime = bar[0] + timeframeSeconds();
    state.marketPrice = bar[4];
    if (state.activeTrade) processTradeCandle(bar, state.revealed - 1);
    updateAll();
    return state.revealed < state.sessionData.length;
  }

  function revealPrevious() {
    if (state.activeTrade) {
      toast("Retour verrouillé", "Une position est ouverte : impossible de remonter le temps.", "↶");
      return;
    }
    if (state.revealed <= 2) return;
    stopPlayback();
    state.revealed -= 1;
    state.marketTime = currentBar()[0] + timeframeSeconds();
    state.marketPrice = currentBar()[4];
    state.panOffset = 0;
    pruneDrawingsToRevealed();
    syncDraftToMarket();
    updateAll();
  }

  function updateAll() {
    updateSessionUI();
    updateQuoteUI();
    updateRiskPreview();
    updateLivePosition();
    renderChart();
  }

  function updateSessionUI() {
    const bar = currentBar();
    if (!bar) return;
    const progress = state.sessionData.length > 1 ? ((state.revealed - 1) / (state.sessionData.length - 1)) * 100 : 100;
    $("#pair-label").textContent = `${state.pair.slice(0, 3)} / ${state.pair.slice(3)}`;
    $("#timeframe-label").textContent = TIMEFRAME_NAMES[state.timeframe];
    $("#pair-icon").textContent = PAIR_ICONS[state.pair] || "FX";
    $("#chart-pair-icon").textContent = PAIR_ICONS[state.pair] || "FX";
    $("#chart-symbol").textContent = state.pair;
    $("#chart-tf").textContent = `· ${TIMEFRAME_SHORT[state.timeframe]}`;
    $("#watermark-symbol").textContent = state.pair;
    $("#watermark-tf").textContent = TIMEFRAME_SHORT[state.timeframe];
    $("#session-date").textContent = dateLabel(marketCursorTime(), true);
    $("#session-meter-fill").style.width = `${progress}%`;
    $("#revealed-count").textContent = state.revealed;
    $("#total-count").textContent = state.sessionData.length;
    $("#remaining-bars").textContent = `${state.sessionData.length - state.revealed} bougies restantes`;
    $("#timeline").max = state.sessionData.length - 1;
    $("#timeline").value = state.revealed - 1;
    $("#timeline").style.setProperty("--range-progress", `${progress}%`);
    $("#timeline-start").textContent = dateLabel(state.sessionData[0][0]);
    $("#timeline-now").textContent = dateLabel(marketCursorTime());
    const sourceChip = $(".source-chip");
    sourceChip.textContent = state.dataSource;
  }

  function updateQuoteUI() {
    const bar = currentBar();
    if (!bar) return;
    const [_, open, high, low, close] = bar;
    const change = ((close - open) / open) * 100;
    $("#ohlc-o").textContent = price(open);
    $("#ohlc-h").textContent = price(high);
    $("#ohlc-l").textContent = price(low);
    $("#ohlc-c").textContent = price(close);
    const changeNode = $("#ohlc-change");
    changeNode.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(3)}%`;
    changeNode.className = change >= 0 ? "positive" : "negative";
  }

  function sizeCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width * ratio));
    const height = Math.max(1, Math.floor(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height, ratio };
  }

  function visibleWindow() {
    const count = Math.min(state.revealed, Math.round(state.visibleCount));
    const end = clamp(state.revealed - state.panOffset, count, state.revealed);
    const start = Math.max(0, end - count);
    return { start, end, count: end - start };
  }

  function chartLevels() {
    const source = state.activeTrade || state.draft;
    return { entry: Number(source.entry), stop: Number(source.stop), target: Number(source.target) };
  }

  function renderChart() {
    const { width, height } = sizeCanvas(chart, ctx);
    if (width < 10 || height < 10 || !state.sessionData.length) return;
    ctx.clearRect(0, 0, width, height);
    const chartBottom = height - 28;
    const rsiHeight = state.rsiEnabled ? clamp(height * .23, 105, 145) : 0;
    const plot = { left: 10, top: 54, right: width - 70, bottom: chartBottom - (state.rsiEnabled ? rsiHeight + 18 : 0) };
    const rsiPlot = state.rsiEnabled ? { left: plot.left, top: plot.bottom + 18, right: plot.right, bottom: chartBottom } : null;
    const windowRange = visibleWindow();
    const bars = state.sessionData.slice(windowRange.start, windowRange.end);
    if (!bars.length) return;

    let low = Math.min(...bars.map(bar => bar[3]));
    let high = Math.max(...bars.map(bar => bar[2]));
    const livePrice = currentMarketPrice();
    if (Number.isFinite(livePrice)) {
      low = Math.min(low, livePrice);
      high = Math.max(high, livePrice);
    }
    const levels = chartLevels();
    if (state.activeTrade || document.activeElement?.matches?.("#entry-price,#stop-price,#target-price")) {
      low = Math.min(low, levels.entry, levels.stop, levels.target);
      high = Math.max(high, levels.entry, levels.stop, levels.target);
    }
    const pad = Math.max((high - low) * 0.1, pipSize() * 5);
    low -= pad;
    high += pad;

    const futureGapBars = clamp(Math.round(bars.length * .17), 2, 22);
    const xStep = (plot.right - plot.left) / Math.max(bars.length + futureGapBars, 1);
    const candleWidth = clamp(xStep * 0.62, 2, 13);
    const y = value => plot.top + ((high - value) / (high - low || 1)) * (plot.bottom - plot.top);
    const x = localIndex => plot.left + (localIndex + 0.5) * xStep;
    const xFromIndex = index => plot.left + (index - windowRange.start + .5) * xStep;
    const lastCandleRight = x(bars.length - 1) + candleWidth / 2;
    const futureGapPx = Math.max(42, plot.right - lastCandleRight);
    stage.style.setProperty("--future-gap-px", `${futureGapPx}px`);
    state.chartMetrics = { plot, rsiPlot, windowRange, low, high, xStep, candleWidth, futureGapBars, futureGapPx, y, x, xFromIndex, width, height };

    drawGrid(ctx, plot, low, high, y, bars, x, rsiPlot?.bottom || plot.bottom);
    if (state.activeTrade) drawTradeZones(ctx, state.chartMetrics, levels);
    bars.forEach((bar, index) => drawCandle(ctx, bar, x(index), y, candleWidth));
    drawAnalysisObjects(ctx, state.chartMetrics);
    drawLevels(ctx, state.chartMetrics, levels);
    drawCurrentPrice(ctx, state.chartMetrics, currentMarketPrice());
    if (rsiPlot) drawRSI(ctx, state.chartMetrics);
    if (state.crosshair) drawCrosshair(ctx, state.chartMetrics);
  }

  function drawGrid(context, plot, low, high, y, bars, x, axisBottom) {
    context.save();
    context.strokeStyle = css("--line");
    context.fillStyle = css("--text-faint");
    context.lineWidth = 1;
    context.font = "9px DM Sans, sans-serif";
    context.textBaseline = "middle";
    const gridRows = 6;
    for (let i = 0; i <= gridRows; i += 1) {
      const value = high - ((high - low) * i) / gridRows;
      const py = y(value);
      context.globalAlpha = 0.55;
      context.beginPath();
      context.moveTo(plot.left, py + 0.5);
      context.lineTo(plot.right, py + 0.5);
      context.stroke();
      context.globalAlpha = 1;
      context.fillText(price(value), plot.right + 8, py);
    }
    const verticals = 6;
    context.textAlign = "center";
    context.textBaseline = "top";
    for (let i = 0; i <= verticals; i += 1) {
      const index = Math.min(bars.length - 1, Math.round((i / verticals) * (bars.length - 1)));
      const px = x(index);
      context.globalAlpha = 0.38;
      context.beginPath();
      context.moveTo(px + 0.5, plot.top);
      context.lineTo(px + 0.5, axisBottom);
      context.stroke();
      context.globalAlpha = 1;
      const date = new Date(bars[index][0] * 1000);
      const label = state.timeframe === "1d" ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date) : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
      context.fillText(label.replace(" ", " · "), px, axisBottom + 8);
    }
    context.restore();
  }

  function drawCandle(context, bar, px, y, width) {
    const [, open, high, low, close] = bar;
    const up = close >= open;
    const color = up ? css("--green") : css("--red");
    context.save();
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(px + 0.5, y(high));
    context.lineTo(px + 0.5, y(low));
    context.stroke();
    const top = y(Math.max(open, close));
    const bottom = y(Math.min(open, close));
    const bodyHeight = Math.max(1, bottom - top);
    if (up) {
      context.globalAlpha = .82;
      context.fillRect(px - width / 2, top, width, bodyHeight);
    } else {
      context.fillRect(px - width / 2, top, width, bodyHeight);
    }
    context.restore();
  }

  function drawAnalysisObjects(context, metrics) {
    const objects = [...state.drawings, ...(state.drawingDraft ? [state.drawingDraft] : [])];
    if (!objects.length) return;
    const { plot, y, xFromIndex } = metrics;
    context.save();
    context.beginPath();
    context.rect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
    context.clip();
    objects.forEach(object => {
      const x1 = xFromIndex(object.p1.index);
      const x2 = xFromIndex(object.p2.index);
      const y1 = y(object.p1.price);
      const y2 = y(object.p2.price);
      const isDraft = object === state.drawingDraft;
      if (object.type === "trend") drawTrendObject(context, x1, y1, x2, y2, isDraft);
      if (object.type === "rectangle") drawRectangleObject(context, x1, y1, x2, y2, isDraft);
      if (object.type === "fibonacci") drawFibonacciObject(context, object, x1, y1, x2, y2, metrics, isDraft);
    });
    context.restore();
  }

  function drawTrendObject(context, x1, y1, x2, y2, isDraft) {
    const color = css("--drawing-neutral");
    context.save();
    context.strokeStyle = color;
    context.lineWidth = isDraft ? 2 : 1.5;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
    drawAnchor(context, x1, y1, color);
    drawAnchor(context, x2, y2, color);
    context.restore();
  }

  function drawRectangleObject(context, x1, y1, x2, y2, isDraft) {
    const color = css("--drawing-neutral");
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    context.save();
    context.fillStyle = colorWithAlpha(color, .09);
    context.strokeStyle = color;
    context.lineWidth = isDraft ? 2 : 1.25;
    context.fillRect(left, top, width, height);
    context.strokeRect(left, top, width, height);
    drawAnchor(context, x1, y1, color);
    drawAnchor(context, x2, y2, color);
    context.restore();
  }

  function drawFibonacciObject(context, object, x1, y1, x2, y2, metrics, isDraft) {
    const color = css("--drawing-fib");
    const levels = [0, .236, .382, .5, .618, .786, 1];
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    context.save();
    context.font = "700 8px DM Sans, sans-serif";
    context.textBaseline = "bottom";
    context.textAlign = "right";
    levels.forEach((level, index) => {
      const value = object.p1.price + (object.p2.price - object.p1.price) * level;
      const py = metrics.y(value);
      context.strokeStyle = index === 4 ? color : colorWithAlpha(color, .66);
      context.lineWidth = index === 4 || isDraft ? 1.4 : 1;
      context.beginPath();
      context.moveTo(left, py + .5);
      context.lineTo(right, py + .5);
      context.stroke();
      context.fillStyle = color;
      context.fillText(`${number(level * 100, level === 0 || level === 1 ? 0 : 1)}%  ${price(value)}`, right - 4, py - 2);
    });
    drawAnchor(context, x1, y1, color);
    drawAnchor(context, x2, y2, color);
    context.restore();
  }

  function drawAnchor(context, x, y, color) {
    context.save();
    context.fillStyle = css("--panel");
    context.strokeStyle = color;
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x, y, 3, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  function calculateRSI(bars, period = 14) {
    const values = Array(bars.length).fill(null);
    if (bars.length <= period) return values;
    let gains = 0;
    let losses = 0;
    for (let index = 1; index <= period; index += 1) {
      const change = bars[index][4] - bars[index - 1][4];
      gains += Math.max(0, change);
      losses += Math.max(0, -change);
    }
    let averageGain = gains / period;
    let averageLoss = losses / period;
    values[period] = averageLoss === 0 ? (averageGain === 0 ? 50 : 100) : 100 - 100 / (1 + averageGain / averageLoss);
    for (let index = period + 1; index < bars.length; index += 1) {
      const change = bars[index][4] - bars[index - 1][4];
      averageGain = (averageGain * (period - 1) + Math.max(0, change)) / period;
      averageLoss = (averageLoss * (period - 1) + Math.max(0, -change)) / period;
      values[index] = averageLoss === 0 ? (averageGain === 0 ? 50 : 100) : 100 - 100 / (1 + averageGain / averageLoss);
    }
    return values;
  }

  function drawRSI(context, metrics) {
    const { rsiPlot, windowRange, xFromIndex } = metrics;
    if (!rsiPlot) return;
    const values = calculateRSI(state.sessionData.slice(0, state.revealed));
    const y = value => rsiPlot.top + ((100 - value) / 100) * (rsiPlot.bottom - rsiPlot.top);
    const color = css("--blue");
    context.save();
    context.fillStyle = colorWithAlpha(css("--panel-soft"), .34);
    context.fillRect(rsiPlot.left, rsiPlot.top, rsiPlot.right - rsiPlot.left, rsiPlot.bottom - rsiPlot.top);
    context.strokeStyle = css("--line");
    context.lineWidth = 1;
    [70, 50, 30].forEach(level => {
      const py = y(level);
      context.globalAlpha = level === 50 ? .45 : .75;
      context.setLineDash(level === 50 ? [2, 4] : [5, 4]);
      context.beginPath();
      context.moveTo(rsiPlot.left, py + .5);
      context.lineTo(rsiPlot.right, py + .5);
      context.stroke();
      context.globalAlpha = 1;
      context.setLineDash([]);
      context.fillStyle = css("--text-faint");
      context.font = "8px DM Sans, sans-serif";
      context.textBaseline = "middle";
      context.fillText(String(level), rsiPlot.right + 8, py);
    });
    context.beginPath();
    context.rect(rsiPlot.left, rsiPlot.top, rsiPlot.right - rsiPlot.left, rsiPlot.bottom - rsiPlot.top);
    context.clip();
    let started = false;
    context.beginPath();
    for (let index = windowRange.start; index < windowRange.end; index += 1) {
      if (values[index] == null) continue;
      const px = xFromIndex(index);
      const py = y(values[index]);
      if (!started) { context.moveTo(px, py); started = true; } else context.lineTo(px, py);
    }
    context.strokeStyle = color;
    context.lineWidth = 1.7;
    if (started) context.stroke();
    context.restore();

    const currentValue = values[state.revealed - 1];
    context.save();
    context.fillStyle = css("--text-soft");
    context.font = "700 9px DM Sans, sans-serif";
    context.fillText(`RSI 14${currentValue == null ? "" : `  ${number(currentValue, 1)}`}`, rsiPlot.left + 7, rsiPlot.top + 13);
    if (currentValue != null) {
      const currentY = y(currentValue);
      context.fillStyle = color;
      context.fillRect(rsiPlot.right, currentY - 8, 38, 16);
      context.fillStyle = "#fff";
      context.font = "700 8px DM Sans, sans-serif";
      context.textBaseline = "middle";
      context.fillText(number(currentValue, 1), rsiPlot.right + 6, currentY);
    }
    context.restore();
  }

  function drawTradeZones(context, metrics, levels) {
    const { plot, y } = metrics;
    const entryY = y(levels.entry);
    const stopY = y(levels.stop);
    const targetY = y(levels.target);
    const startX = clamp(metrics.xFromIndex(state.activeTrade.entryIndex), plot.left, plot.right);
    context.save();
    context.fillStyle = css("--green-soft");
    context.fillRect(startX, Math.min(entryY, targetY), plot.right - startX, Math.abs(entryY - targetY));
    context.fillStyle = css("--red-soft");
    context.fillRect(startX, Math.min(entryY, stopY), plot.right - startX, Math.abs(entryY - stopY));
    context.restore();
  }

  function drawLevels(context, metrics, levels) {
    const showDraft = !state.activeTrade && $("#view-backtest").classList.contains("is-active");
    if (!state.activeTrade && !showDraft) return;
    const entries = [
      { key: "target", label: "TP", value: levels.target, color: css("--green") },
      { key: "entry", label: "ENTRÉE", value: levels.entry, color: css("--blue") },
      { key: "stop", label: "SL", value: levels.stop, color: css("--red") }
    ];
    context.save();
    context.font = "700 9px DM Sans, sans-serif";
    context.textBaseline = "middle";
    entries.forEach(level => {
      const py = metrics.y(level.value);
      if (py < metrics.plot.top - 5 || py > metrics.plot.bottom + 5) return;
      const isActive = state.hoveredLevel === level.key || (state.dragging?.type === "level" && state.dragging.level === level.key);
      context.strokeStyle = level.color;
      context.lineWidth = isActive ? 2 : 1;
      context.globalAlpha = isActive ? 1 : (state.activeTrade ? .78 : .48);
      context.setLineDash(level.key === "entry" ? [6, 4] : [3, 4]);
      context.beginPath();
      context.moveTo(metrics.plot.left, py + .5);
      context.lineTo(metrics.plot.right, py + .5);
      context.stroke();
      context.globalAlpha = 1;
      context.setLineDash([]);
      const label = `↕  ${level.label}  ${price(level.value)}`;
      const labelWidth = context.measureText(label).width + 18;
      const labelHeight = isActive ? 24 : 22;
      const labelX = metrics.plot.right - labelWidth - 7;
      context.fillStyle = level.color;
      context.fillRect(labelX, py - labelHeight / 2, labelWidth, labelHeight);
      context.fillStyle = css(level.key === "stop" ? "--level-label-light" : "--level-label-dark");
      context.fillText(label, labelX + 9, py);
    });
    context.restore();
  }

  function drawCurrentPrice(context, metrics, value) {
    const py = metrics.y(value);
    if (py < metrics.plot.top || py > metrics.plot.bottom) return;
    const bar = currentBar();
    const color = value >= bar[1] ? css("--green") : css("--red");
    context.save();
    context.strokeStyle = color;
    context.globalAlpha = .78;
    context.setLineDash([2, 3]);
    context.beginPath();
    context.moveTo(metrics.plot.left, py + .5);
    context.lineTo(metrics.plot.right, py + .5);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.fillRect(metrics.plot.right, py - 9, 63, 18);
    context.fillStyle = "#06110e";
    context.font = "700 9px ui-monospace, monospace";
    context.textBaseline = "middle";
    context.fillText(price(value), metrics.plot.right + 5, py);
    context.restore();
  }

  function drawCrosshair(context, metrics) {
    const { x, y, bar } = state.crosshair;
    const { plot } = metrics;
    if (x < plot.left || x > plot.right || y < plot.top || y > plot.bottom) return;
    context.save();
    context.strokeStyle = css("--text-faint");
    context.globalAlpha = .55;
    context.setLineDash([3, 4]);
    context.beginPath(); context.moveTo(x, plot.top); context.lineTo(x, plot.bottom); context.stroke();
    context.beginPath(); context.moveTo(plot.left, y); context.lineTo(plot.right, y); context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
    if (bar) {
      context.fillStyle = css("--panel-hover");
      context.fillRect(clamp(x - 57, plot.left, plot.right - 114), plot.top + 6, 114, 35);
      context.fillStyle = css("--text-soft");
      context.font = "8px DM Sans, sans-serif";
      context.textAlign = "center";
      context.fillText(dateLabel(bar[0]), clamp(x, plot.left + 57, plot.right - 57), plot.top + 18);
      context.fillText(`C ${price(bar[4])}`, clamp(x, plot.left + 57, plot.right - 57), plot.top + 31);
    }
    context.restore();
  }

  function readDraftInputs() {
    state.draft.entry = Number($("#entry-price").value);
    state.draft.stop = Number($("#stop-price").value);
    state.draft.target = Number($("#target-price").value);
  }

  function validateLevels(source = state.draft) {
    const entry = Number(source.entry);
    const stop = Number(source.stop);
    const target = Number(source.target);
    if (![entry, stop, target].every(Number.isFinite) || Math.min(entry, stop, target) <= 0) return "Renseignez trois niveaux de prix valides.";
    if (state.direction === "long" && !(stop < entry && target > entry)) return "Pour un achat, le stop doit être sous l’entrée et l’objectif au-dessus.";
    if (state.direction === "short" && !(stop > entry && target < entry)) return "Pour une vente, le stop doit être au-dessus de l’entrée et l’objectif en dessous.";
    if (Math.abs(entry - stop) + 1e-10 < pipSize()) return "Le stop doit être distant d’au moins un pip.";
    return "";
  }

  function riskCashValue() {
    const riskInput = Math.max(0, Number($("#risk-value").value) || 0);
    const base = Math.max(100, Number($("#account-balance").value) || 10000);
    const liveBalance = base + state.trades.reduce((sum, trade) => sum + (Number(trade.pnlCash) || 0), 0);
    return state.riskMode === "percent" ? liveBalance * riskInput / 100 : riskInput;
  }

  function updateRiskPreview() {
    readDraftInputs();
    const source = state.activeTrade || state.draft;
    const riskDistance = Math.abs(Number(source.entry) - Number(source.stop));
    const rewardDistance = Math.abs(Number(source.target) - Number(source.entry));
    const riskPips = riskDistance / pipSize();
    const rewardPips = rewardDistance / pipSize();
    const ratio = riskDistance > 0 ? rewardDistance / riskDistance : 0;
    const riskCash = state.activeTrade ? state.activeTrade.riskCash : riskCashValue();
    const lots = riskPips > 0 ? riskCash / (riskPips * 10) : 0;
    $("#stop-pips").textContent = `${number(riskPips, 1)} pips`;
    $("#target-pips").textContent = `${number(rewardPips, 1)} pips`;
    $("#risk-pips-label").textContent = `${number(riskPips, 1)} pips`;
    $("#reward-pips-label").textContent = `${number(rewardPips, 1)} pips`;
    $("#planned-ratio").textContent = `1 : ${number(ratio, 2)}`;
    $("#risk-cash").textContent = money(riskCash);
    $("#position-size").textContent = `${number(lots, 2)} lot${lots >= 2 ? "s" : ""}`;
    const lossShare = ratio > 0 ? 100 / (1 + ratio) : 50;
    $("#ratio-loss").style.width = `${lossShare}%`;
    $("#ratio-profit").style.width = `${100 - lossShare}%`;
    renderChart();
  }

  function setDirection(direction) {
    if (state.activeTrade) {
      toast("Position déjà ouverte", "La direction ne peut plus être modifiée.", "!");
      return;
    }
    state.direction = direction;
    $$(".side-tab").forEach(button => button.classList.toggle("is-active", button.dataset.direction === direction));
    $("#place-trade").classList.toggle("is-short", direction === "short");
    $("#place-trade-label").textContent = direction === "long" ? "Placer la position acheteuse" : "Placer la position vendeuse";
    syncDraftToMarket();
  }

  function setRiskMode(mode) {
    state.riskMode = mode;
    $$('[data-risk-mode]').forEach(button => button.classList.toggle("is-active", button.dataset.riskMode === mode));
    $("#risk-unit").textContent = mode === "percent" ? "%" : "€";
    $("#risk-value").value = mode === "percent" ? "1" : "100";
    updateRiskPreview();
  }

  function placeTrade() {
    if (state.activeTrade) return;
    readDraftInputs();
    const error = validateLevels();
    $("#order-error").textContent = error;
    if (error) return;
    const riskCash = riskCashValue();
    if (!(riskCash > 0)) {
      $("#order-error").textContent = "Le montant risqué doit être supérieur à zéro.";
      return;
    }
    const bar = currentBar();
    const initialRisk = Math.abs(state.draft.entry - state.draft.stop);
    state.activeTrade = {
      id: `T${Date.now().toString(36).toUpperCase()}`,
      pair: state.pair,
      timeframe: state.timeframe,
      direction: state.direction,
      entry: state.draft.entry,
      stop: state.draft.stop,
      initialStop: state.draft.stop,
      target: state.draft.target,
      initialRisk,
      plannedRR: Math.abs(state.draft.target - state.draft.entry) / initialRisk,
      riskCash,
      riskMode: state.riskMode,
      riskValue: Number($("#risk-value").value),
      balanceBefore: accountBalance(),
      entryTime: marketCursorTime(),
      entryIndex: state.revealed - 1,
      setup: $("#setup-select").value,
      confidence: Number($("#confidence-select").value),
      note: $("#trade-note").value.trim(),
      mfePrice: 0,
      maePrice: 0,
      snapshots: []
    };
    state.activeTrade.snapshots.push(captureChart("Entrée", "entry"));
    stopPlayback();
    updatePositionMode();
    updateAll();
    toast("Position ouverte", `${state.pair} · ${state.direction === "long" ? "Achat" : "Vente"} · risque ${money(riskCash)}`, "↗");
  }

  function updatePositionMode() {
    const active = Boolean(state.activeTrade);
    $("#order-form").hidden = active;
    $("#live-position").hidden = !active;
    $$(".side-tab").forEach(button => button.disabled = active);
    const status = $("#position-status");
    status.classList.toggle("is-live", active);
    status.innerHTML = active ? "<i></i> En position" : "<i></i> En attente";
  }

  function processTradeCandle(bar, index) {
    const trade = state.activeTrade;
    if (!trade || index <= trade.entryIndex) return;
    const [, , high, low] = bar;
    const direction = trade.direction === "long" ? 1 : -1;
    const favorable = trade.direction === "long" ? high - trade.entry : trade.entry - low;
    const adverse = trade.direction === "long" ? trade.entry - low : high - trade.entry;
    trade.mfePrice = Math.max(trade.mfePrice, favorable);
    trade.maePrice = Math.max(trade.maePrice, adverse);

    const stopHit = trade.direction === "long" ? low <= trade.stop : high >= trade.stop;
    const targetHit = trade.direction === "long" ? high >= trade.target : low <= trade.target;
    if (stopHit && targetHit) {
      closeActiveTrade(trade.stop, Math.abs(trade.stop - trade.entry) < pipSize() / 2 ? "break_even" : "stop_loss", bar[0] + timeframeSeconds(), "Les deux niveaux ont été parcourus : le scénario conservateur applique le stop.");
    } else if (stopHit) {
      closeActiveTrade(trade.stop, Math.abs(trade.stop - trade.entry) < pipSize() / 2 ? "break_even" : "stop_loss", bar[0] + timeframeSeconds());
    } else if (targetHit) {
      closeActiveTrade(trade.target, "take_profit", bar[0] + timeframeSeconds());
    }
  }

  function closeActiveTrade(exitPrice, exitType, exitTime, extraMessage = "") {
    const trade = state.activeTrade;
    if (!trade) return;
    const direction = trade.direction === "long" ? 1 : -1;
    const move = (exitPrice - trade.entry) * direction;
    const resultR = move / trade.initialRisk;
    const pips = move / pipSize(trade.pair);
    const pnlCash = trade.riskCash * resultR;
    const pnlPercent = trade.balanceBefore ? pnlCash / trade.balanceBefore * 100 : 0;
    const exitSnapshot = captureChart("Sortie", "exit");
    const completed = {
      ...trade,
      stopAtExit: trade.stop,
      exitPrice,
      exitTime,
      exitType,
      resultR,
      realizedRR: resultR,
      pips,
      pnlCash,
      pnlPercent,
      durationSeconds: Math.max(0, exitTime - trade.entryTime),
      durationBars: Math.max(0, state.revealed - 1 - trade.entryIndex),
      mfeR: trade.mfePrice / trade.initialRisk,
      maeR: trade.maePrice / trade.initialRisk,
      balanceAfter: trade.balanceBefore + pnlCash,
      closedAt: Date.now(),
      snapshots: [...trade.snapshots, exitSnapshot]
    };
    state.trades.unshift(completed);
    state.activeTrade = null;
    persistTrades();
    updatePositionMode();
    syncDraftToMarket();
    updateJournal();
    const outcome = resultR > 0 ? "Trade gagnant" : resultR < 0 ? "Trade perdant" : "Break-even";
    toast(outcome, `${EXIT_LABELS[exitType]} · ${signed(resultR, " R")} · ${signed(pips, " pips")}${extraMessage ? ` · ${extraMessage}` : ""}`, resultR > 0 ? "✓" : resultR < 0 ? "×" : "=");
    checkMilestone();
  }

  function manualClose() {
    const trade = state.activeTrade;
    const bar = currentBar();
    if (!trade || !bar) return;
    const marketPrice = currentMarketPrice();
    closeActiveTrade(marketPrice, Math.abs(marketPrice - trade.entry) < pipSize() / 2 ? "break_even" : "manual", marketCursorTime());
    updateAll();
  }

  function moveStopToBreakeven() {
    if (!state.activeTrade) return;
    state.activeTrade.stop = state.activeTrade.entry;
    updateAll();
    toast("Stop sécurisé", "Le stop loss a été déplacé au prix d’entrée.", "=");
  }

  function updateLivePosition() {
    const trade = state.activeTrade;
    if (!trade) return;
    const marketPrice = currentMarketPrice();
    const direction = trade.direction === "long" ? 1 : -1;
    const floatingR = ((marketPrice - trade.entry) * direction) / trade.initialRisk;
    const floatingCash = trade.riskCash * floatingR;
    $("#live-direction").textContent = trade.direction === "long" ? "LONG" : "SHORT";
    $("#live-direction").classList.toggle("short", trade.direction === "short");
    $("#live-symbol").textContent = trade.pair;
    $("#live-pnl").textContent = signed(floatingCash, " €");
    $("#live-pnl").className = floatingCash >= 0 ? "positive" : "negative";
    $("#live-r-value").textContent = signed(floatingR, " R");
    $("#live-r-value").className = floatingR >= 0 ? "positive" : "negative";
    $("#live-entry").textContent = price(trade.entry, trade.pair);
    $("#live-current").textContent = price(marketPrice, trade.pair);
    $("#live-mfe").textContent = `${number(trade.mfePrice / trade.initialRisk)} R`;
    $("#live-mae").textContent = `${number(trade.maePrice / trade.initialRisk)} R`;
    const durationBars = state.revealed - 1 - trade.entryIndex;
    $("#live-duration").textContent = `${durationBars} bougie${durationBars > 1 ? "s" : ""}`;
    $("#live-risk").textContent = money(trade.riskCash);
  }

  function captureChart(label, kind = "manual") {
    renderChart();
    const sourceWidth = chart.width;
    const sourceHeight = chart.height;
    const output = document.createElement("canvas");
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / sourceWidth);
    output.width = Math.round(sourceWidth * scale);
    output.height = Math.round(sourceHeight * scale) + 38;
    const outputContext = output.getContext("2d");
    outputContext.fillStyle = css("--bg");
    outputContext.fillRect(0, 0, output.width, output.height);
    outputContext.drawImage(chart, 0, 38, output.width, output.height - 38);
    outputContext.fillStyle = css("--panel");
    outputContext.fillRect(0, 0, output.width, 38);
    outputContext.fillStyle = css("--text");
    outputContext.font = "600 12px Arial, sans-serif";
    outputContext.fillText(`REPLAY FX  ·  ${state.pair}  ·  ${TIMEFRAME_SHORT[state.timeframe]}`, 13, 17);
    outputContext.fillStyle = css("--text-soft");
    outputContext.font = "10px Arial, sans-serif";
    outputContext.fillText(`${label}  ·  ${dateLabel(marketCursorTime(), true)}  ·  futur masqué`, 13, 31);
    return { id: `S${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, kind, label, time: marketCursorTime(), data: output.toDataURL("image/jpeg", .72) };
  }

  function addManualSnapshot() {
    if (!state.activeTrade) {
      toast("Aucune position ouverte", "Ouvrez une position pour rattacher une capture à sa fiche.", "⌁");
      return;
    }
    state.activeTrade.snapshots.push(captureChart("Capture manuelle", "manual"));
    toast("Capture enregistrée", "Elle apparaîtra dans la fiche de ce trade.", "▣");
  }

  function calculateStats() {
    const trades = [...state.trades].reverse();
    const total = trades.length;
    const winners = trades.filter(trade => trade.resultR > 0);
    const losers = trades.filter(trade => trade.resultR < 0);
    const flat = trades.filter(trade => trade.resultR === 0);
    const grossWins = winners.reduce((sum, trade) => sum + trade.resultR, 0);
    const grossLosses = Math.abs(losers.reduce((sum, trade) => sum + trade.resultR, 0));
    const totalR = trades.reduce((sum, trade) => sum + trade.resultR, 0);
    const winRate = total ? winners.length / total * 100 : 0;
    const avgWin = winners.length ? grossWins / winners.length : 0;
    const avgLoss = losers.length ? grossLosses / losers.length : 0;
    const avgPlannedRR = total ? trades.reduce((sum, trade) => sum + trade.plannedRR, 0) / total : 0;
    const expectancy = total ? totalR / total : 0;
    const profitFactor = grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0;
    const baseBalance = Number($("#account-balance")?.value) || 10000;
    let balance = baseBalance;
    let peak = balance;
    let maxDrawdown = 0;
    let maxDrawdownPct = 0;
    const drawdowns = [];
    const equity = [{ index: 0, balance, r: 0 }];
    trades.forEach((trade, index) => {
      balance += trade.pnlCash;
      peak = Math.max(peak, balance);
      const dd = peak - balance;
      const ddPct = peak ? dd / peak * 100 : 0;
      maxDrawdown = Math.max(maxDrawdown, dd);
      maxDrawdownPct = Math.max(maxDrawdownPct, ddPct);
      drawdowns.push(ddPct);
      equity.push({ index: index + 1, balance, r: trade.resultR });
    });
    const avgDrawdownPct = drawdowns.length ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : 0;
    let maxWinStreak = 0, maxLossStreak = 0, winStreak = 0, lossStreak = 0;
    trades.forEach(trade => {
      if (trade.resultR > 0) {
        winStreak += 1; lossStreak = 0; maxWinStreak = Math.max(maxWinStreak, winStreak);
      } else if (trade.resultR < 0) {
        lossStreak += 1; winStreak = 0; maxLossStreak = Math.max(maxLossStreak, lossStreak);
      } else {
        winStreak = 0; lossStreak = 0;
      }
    });
    return { total, winners: winners.length, losers: losers.length, flat: flat.length, winRate, avgWin, avgLoss, avgPlannedRR, expectancy, profitFactor, totalR, grossWins, grossLosses, maxDrawdown, maxDrawdownPct, avgDrawdownPct, maxWinStreak, maxLossStreak, equity, drawdowns, totalCash: balance - baseBalance, currentBalance: balance };
  }

  function updateJournal() {
    const stats = calculateStats();
    $("#journal-count").textContent = stats.total;
    $("#journal-summary").innerHTML = [
      ["Trades", stats.total, `${stats.winners} gagnants · ${stats.losers} perdants`],
      ["Taux de réussite", `${number(stats.winRate, 1)} %`, `${stats.flat} break-even`],
      ["Résultat total", signed(stats.totalR, " R"), money(stats.totalCash)],
      ["Profit factor", Number.isFinite(stats.profitFactor) ? number(stats.profitFactor) : "∞", `Espérance ${signed(stats.expectancy, " R")}`]
    ].map(([label, value, context]) => `<article class="summary-card"><span>${label}</span><b class="${String(value).startsWith("-") ? "negative" : ""}">${value}</b><small>${context}</small></article>`).join("");

    const body = $("#trades-body");
    body.innerHTML = state.trades.map((trade, index) => `
      <tr>
        <td><strong>${state.trades.length - index}</strong></td>
        <td>${dateLabel(trade.entryTime)}</td>
        <td><strong>${trade.pair}</strong><br><small>${TIMEFRAME_SHORT[trade.timeframe]}</small></td>
        <td>${escapeHTML(trade.setup || "—")}</td>
        <td><span class="direction-cell ${trade.direction}">${trade.direction === "long" ? "ACHAT" : "VENTE"}</span></td>
        <td>${EXIT_LABELS[trade.exitType] || trade.exitType}</td>
        <td class="result-cell ${trade.resultR >= 0 ? "positive" : "negative"}">${signed(trade.resultR, " R")}<br><small>${signed(trade.pnlCash, " €")}</small></td>
        <td class="${trade.pips >= 0 ? "positive" : "negative"}">${signed(trade.pips)}</td>
        <td>${durationLabel(trade.durationSeconds)}</td>
        <td><button class="view-trade" data-trade-id="${trade.id}">Voir</button></td>
      </tr>`).join("");
    $("#journal-empty").hidden = stats.total > 0;
    $(".table-scroll").hidden = stats.total === 0;
    updateAnalytics();
  }

  function showTradeDetail(id) {
    const trade = state.trades.find(item => item.id === id);
    if (!trade) return;
    $("#dialog-title").textContent = `${trade.pair} · ${trade.direction === "long" ? "Achat" : "Vente"}`;
    const details = [
      ["Résultat", `${signed(trade.resultR, " R")} · ${signed(trade.pnlCash, " €")}`],
      ["Pips", signed(trade.pips, " pips")],
      ["Sortie", EXIT_LABELS[trade.exitType]],
      ["Durée", `${durationLabel(trade.durationSeconds)} · ${trade.durationBars} bougies`],
      ["R/R prévu", `1 : ${number(trade.plannedRR)}`],
      ["R/R réalisé", signed(trade.realizedRR, " R")],
      ["MFE", `${number(trade.mfeR)} R`],
      ["MAE", `${number(trade.maeR)} R`],
      ["Entrée", price(trade.entry, trade.pair)],
      ["Stop initial", price(trade.initialStop, trade.pair)],
      ["Objectif", price(trade.target, trade.pair)],
      ["Risque", money(trade.riskCash)]
    ];
    const snapshots = (trade.snapshots || []).filter(shot => shot.data).map(shot => `
      <figure class="snapshot">
        <img src="${shot.data}" alt="${escapeHTML(shot.label)} — ${trade.pair}">
        <figcaption><span>${escapeHTML(shot.label)} · ${dateLabel(shot.time)}</span><button data-download-shot="${shot.id}" data-trade="${trade.id}">Enregistrer</button></figcaption>
      </figure>`).join("");
    $("#dialog-content").innerHTML = `
      <div class="trade-detail-grid">${details.map(([label, value]) => `<div class="trade-detail-stat"><span>${label}</span><b>${value}</b></div>`).join("")}</div>
      <div class="note-box"><span>Setup · ${escapeHTML(trade.setup || "Non renseigné")}</span><p>${escapeHTML(trade.note || "Aucune note ajoutée pour ce trade.")}</p></div>
      <div class="snapshots">${snapshots || '<p class="bar-empty">Les captures ne sont plus présentes dans le stockage local.</p>'}</div>`;
    $("#trade-dialog").showModal();
  }

  function downloadSnapshot(tradeId, shotId) {
    const trade = state.trades.find(item => item.id === tradeId);
    const shot = trade?.snapshots?.find(item => item.id === shotId);
    if (!shot?.data) return;
    const link = document.createElement("a");
    link.href = shot.data;
    link.download = `${trade.pair}-${trade.timeframe}-${shot.kind}-${shot.time}.jpg`;
    link.click();
  }

  function levelInfo(count) {
    if (count >= 100) {
      const prestige = Math.floor((count - 100) / 50) + 1;
      return { name: `Expert · Prestige ${prestige}`, icon: "✧", next: 100 + prestige * 50, floor: 100 + (prestige - 1) * 50 };
    }
    if (count >= 75) return { name: "Expérimenté", icon: "✦", next: 100, floor: 75 };
    if (count >= 50) return { name: "Avancé", icon: "◆", next: 75, floor: 50 };
    if (count >= 25) return { name: "Débutant", icon: "◈", next: 50, floor: 25 };
    return { name: "Découverte", icon: "◇", next: 25, floor: 0 };
  }

  function checkMilestone() {
    const count = state.trades.length;
    if ([25, 50, 75, 100].includes(count) || (count > 100 && (count - 100) % 50 === 0)) {
      const level = levelInfo(count);
      toast("Nouveau badge débloqué", `${level.icon} ${level.name} — ${count} trades enregistrés.`, "✦");
    }
  }

  function updateAnalytics() {
    const stats = calculateStats();
    const level = levelInfo(stats.total);
    $("#current-level-icon").textContent = level.icon;
    $("#current-level").textContent = level.name;
    $("#progress-count").textContent = stats.total;
    const remaining = Math.max(0, level.next - stats.total);
    $("#progress-title").textContent = `${remaining} trade${remaining > 1 ? "s" : ""} avant ${level.next > 100 ? `Prestige ${Math.floor((level.next - 100) / 50) + 1}` : levelInfo(level.next).name}`;
    const overallProgress = stats.total <= 100 ? clamp(stats.total, 0, 100) : 100;
    $("#milestone-fill").style.width = `calc(${overallProgress}% - ${overallProgress ? overallProgress * .38 : 0}px)`;
    $$(".milestone").forEach(node => {
      const at = Number(node.dataset.at);
      node.classList.toggle("is-reached", stats.total >= at);
      node.classList.toggle("is-active", level.floor === at || (at === 100 && stats.total >= 100));
    });
    const cards = [
      ["Taux de réussite", `${number(stats.winRate, 1)} %`, `${stats.winners} / ${stats.total}`],
      ["Gain moyen", `${number(stats.avgWin)} R`, "trades gagnants"],
      ["Perte moyenne", `${number(stats.avgLoss)} R`, "valeur absolue"],
      ["R/R moyen", `1 : ${number(stats.avgPlannedRR)}`, "à l’entrée"],
      ["Espérance", signed(stats.expectancy, " R"), "par trade"],
      ["Profit factor", Number.isFinite(stats.profitFactor) ? number(stats.profitFactor) : "∞", "gains / pertes"]
    ];
    $("#stats-grid").innerHTML = cards.map(([label, value, detail]) => `<article class="stat-card"><span>${label}</span><b class="${String(value).startsWith("-") ? "negative" : ""}">${value}</b><small>${detail}</small></article>`).join("");
    $("#equity-result").textContent = signed(stats.totalCash, " €");
    $("#equity-result").className = stats.totalCash >= 0 ? "positive" : "negative";
    $("#streak-stats").innerHTML = `
      <span>Série max. gains<b>${stats.maxWinStreak}</b></span>
      <span>Série max. pertes<b>${stats.maxLossStreak}</b></span>
      <span>Drawdown max.<b>${number(stats.maxDrawdownPct)} %</b></span>
      <span>Drawdown moyen<b>${number(stats.avgDrawdownPct)} %</b></span>
      <span>Résultat total<b>${signed(stats.totalR, " R")}</b></span>
      <span>Capital actuel<b>${money(stats.currentBalance)}</b></span>`;
    renderPerformance("#pair-performance", groupPerformance(state.trades, trade => trade.pair));
    renderPerformance("#tf-performance", groupPerformance(state.trades, trade => TIMEFRAME_SHORT[trade.timeframe]));
    renderPerformance("#setup-performance", groupPerformance(state.trades, trade => trade.setup || "Sans setup"));
    renderPerformance("#day-performance", groupPerformance(state.trades, trade => DAY_NAMES[new Date(trade.entryTime * 1000).getDay()]));
    drawLineChart(equityCanvas, stats.equity.map(point => point.balance), css("--green"), true);
    drawLineChart(drawdownCanvas, stats.drawdowns.map(value => -value), css("--red"), false);
  }

  function groupPerformance(trades, keyFn) {
    const groups = new Map();
    trades.forEach(trade => {
      const key = keyFn(trade);
      const current = groups.get(key) || { key, r: 0, count: 0, wins: 0 };
      current.r += trade.resultR;
      current.count += 1;
      if (trade.resultR > 0) current.wins += 1;
      groups.set(key, current);
    });
    return [...groups.values()].sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }

  function renderPerformance(selector, groups) {
    const root = $(selector);
    if (!groups.length) {
      root.innerHTML = '<p class="bar-empty">Les résultats apparaîtront après vos premiers trades.</p>';
      return;
    }
    const max = Math.max(...groups.map(group => Math.abs(group.r)), .01);
    root.innerHTML = groups.slice(0, 7).map(group => `<div class="bar-item ${group.r >= 0 ? "positive" : "negative"}"><span title="${escapeHTML(group.key)}">${escapeHTML(group.key)}</span><div class="bar-track"><i style="width:${Math.max(2, Math.abs(group.r) / max * 100)}%"></i></div><b>${signed(group.r, " R")}</b></div>`).join("");
  }

  function drawLineChart(canvas, values, color, fill) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const { width, height } = sizeCanvas(canvas, context);
    context.clearRect(0, 0, width, height);
    const plot = { left: 7, top: 12, right: width - 8, bottom: height - 22 };
    const series = values.length ? values : [0, 0];
    let min = Math.min(...series), max = Math.max(...series);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * .12;
    min -= pad; max += pad;
    const x = index => plot.left + (index / Math.max(1, series.length - 1)) * (plot.right - plot.left);
    const y = value => plot.top + ((max - value) / (max - min)) * (plot.bottom - plot.top);
    context.save();
    context.strokeStyle = css("--line");
    context.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const py = plot.top + i / 3 * (plot.bottom - plot.top);
      context.globalAlpha = .6;
      context.beginPath(); context.moveTo(plot.left, py); context.lineTo(plot.right, py); context.stroke();
    }
    context.globalAlpha = 1;
    context.beginPath();
    series.forEach((value, index) => index ? context.lineTo(x(index), y(value)) : context.moveTo(x(index), y(value)));
    if (fill && series.length > 1) {
      context.lineTo(x(series.length - 1), plot.bottom);
      context.lineTo(x(0), plot.bottom);
      context.closePath();
      const gradient = context.createLinearGradient(0, plot.top, 0, plot.bottom);
      gradient.addColorStop(0, colorWithAlpha(color, .18));
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fill();
    }
    context.beginPath();
    series.forEach((value, index) => index ? context.lineTo(x(index), y(value)) : context.moveTo(x(index), y(value)));
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    const last = series[series.length - 1];
    context.fillStyle = color;
    context.beginPath(); context.arc(x(series.length - 1), y(last), 3, 0, Math.PI * 2); context.fill();
    context.fillStyle = css("--text-faint");
    context.font = "8px DM Sans, sans-serif";
    context.textAlign = "left";
    context.fillText("Départ", plot.left, height - 7);
    context.textAlign = "right";
    context.fillText(`${series.length - 1} trades`, plot.right, height - 7);
    context.restore();
  }

  function colorWithAlpha(color, alpha) {
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const normalized = hex.length === 3 ? hex.split("").map(char => char + char).join("") : hex;
      const value = Number.parseInt(normalized, 16);
      return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
    }
    const match = color.match(/[\d.]+/g);
    return match ? `rgba(${match[0]},${match[1]},${match[2]},${alpha})` : color;
  }

  function exportRows() {
    return state.trades.map((trade, index) => ({
      ID: trade.id,
      Numéro: state.trades.length - index,
      Date_entrée: new Date(trade.entryTime * 1000).toISOString(),
      Date_sortie: new Date(trade.exitTime * 1000).toISOString(),
      Paire: trade.pair,
      Timeframe: trade.timeframe,
      Direction: trade.direction === "long" ? "Achat" : "Vente",
      Setup: trade.setup,
      Entrée: trade.entry,
      Stop_initial: trade.initialStop,
      Stop_sortie: trade.stopAtExit,
      Take_profit: trade.target,
      Prix_sortie: trade.exitPrice,
      Type_sortie: EXIT_LABELS[trade.exitType],
      Risque_EUR: trade.riskCash,
      Résultat_EUR: trade.pnlCash,
      Résultat_pct: trade.pnlPercent,
      Résultat_R: trade.resultR,
      Pips: trade.pips,
      RR_prévu: trade.plannedRR,
      RR_réalisé: trade.realizedRR,
      Durée_secondes: trade.durationSeconds,
      MFE_R: trade.mfeR,
      MAE_R: trade.maeR,
      Note: trade.note,
      Capture_entrée: `capture://${trade.id}/entry`,
      Capture_sortie: `capture://${trade.id}/exit`,
      Captures_manuelles: (trade.snapshots || []).filter(shot => shot.kind === "manual").map(shot => `capture://${trade.id}/${shot.id}`).join(" | ")
    }));
  }

  function downloadBlob(content, type, filename) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCSV() {
    const rows = exportRows();
    if (!rows.length) return toast("Journal vide", "Enregistrez au moins un trade avant l’export.", "⌁");
    const headers = Object.keys(rows[0]);
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.map(cell).join(";"), ...rows.map(row => headers.map(header => cell(row[header])).join(";"))].join("\r\n");
    downloadBlob(`\ufeff${csv}`, "text/csv;charset=utf-8", `replayfx-journal-${new Date().toISOString().slice(0, 10)}.csv`);
    toast("Export CSV prêt", `${rows.length} trades exportés.`, "↓");
  }

  function statsRows() {
    const stats = calculateStats();
    return [
      ["Nombre de trades", stats.total], ["Taux de réussite (%)", stats.winRate], ["Gain moyen (R)", stats.avgWin], ["Perte moyenne (R)", stats.avgLoss],
      ["R/R moyen prévu", stats.avgPlannedRR], ["Espérance (R)", stats.expectancy], ["Profit factor", Number.isFinite(stats.profitFactor) ? stats.profitFactor : "Infini"],
      ["Résultat total (R)", stats.totalR], ["Résultat total (EUR)", stats.totalCash], ["Drawdown maximal (%)", stats.maxDrawdownPct], ["Drawdown moyen (%)", stats.avgDrawdownPct],
      ["Série maximale de gains", stats.maxWinStreak], ["Série maximale de pertes", stats.maxLossStreak]
    ];
  }

  function exportXLSX() {
    const rows = exportRows();
    if (!rows.length) return toast("Journal vide", "Enregistrez au moins un trade avant l’export.", "⌁");
    if (!window.XLSX) return toast("Export indisponible", "Le module Excel n’a pas été chargé.", "!");
    const workbook = XLSX.utils.book_new();
    const tradeSheet = XLSX.utils.json_to_sheet(rows);
    const statsSheet = XLSX.utils.aoa_to_sheet([["Replay FX — Statistiques principales"], [], ...statsRows()]);
    tradeSheet["!cols"] = Object.keys(rows[0]).map(key => ({ wch: clamp(key.length + 3, 11, key.includes("Note") ? 42 : 22) }));
    statsSheet["!cols"] = [{ wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, tradeSheet, "Trades");
    XLSX.utils.book_append_sheet(workbook, statsSheet, "Statistiques");
    XLSX.writeFile(workbook, `replayfx-journal-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
    toast("Export Excel prêt", "Le journal et les statistiques ont été ajoutés au classeur.", "↓");
  }

  function exportPDF() {
    const rows = exportRows();
    if (!rows.length) return toast("Journal vide", "Enregistrez au moins un trade avant l’export.", "⌁");
    if (!window.jspdf?.jsPDF) return toast("Export indisponible", "Le module PDF n’a pas été chargé.", "!");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const stats = calculateStats();
    doc.setFillColor(8, 11, 18);
    doc.rect(0, 0, 297, 30, "F");
    doc.setTextColor(32, 214, 161);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("REPLAY FX", 13, 14);
    doc.setTextColor(235, 242, 247);
    doc.setFontSize(9);
    doc.text(`Journal de backtesting · ${rows.length} trades · export du ${new Intl.DateTimeFormat("fr-FR").format(new Date())}`, 13, 22);
    doc.setTextColor(30, 38, 48);
    doc.setFontSize(9);
    doc.text(`Win rate : ${number(stats.winRate, 1)} %`, 13, 39);
    doc.text(`Total : ${signed(stats.totalR, " R")} / ${signed(stats.totalCash, " EUR")}`, 62, 39);
    doc.text(`Profit factor : ${Number.isFinite(stats.profitFactor) ? number(stats.profitFactor) : "Infini"}`, 125, 39);
    doc.text(`Drawdown max. : ${number(stats.maxDrawdownPct)} %`, 185, 39);
    doc.text(`Espérance : ${signed(stats.expectancy, " R")}`, 245, 39);
    doc.autoTable({
      startY: 46,
      head: [["#", "Date", "Marché", "TF", "Direction", "Setup", "Sortie", "Résultat", "Pips", "MFE", "MAE", "Durée"]],
      body: [...state.trades].reverse().map((trade, index) => [index + 1, dateLabel(trade.entryTime), trade.pair, trade.timeframe, trade.direction === "long" ? "Achat" : "Vente", trade.setup, EXIT_LABELS[trade.exitType], signed(trade.resultR, " R"), signed(trade.pips), `${number(trade.mfeR)} R`, `${number(trade.maeR)} R`, durationLabel(trade.durationSeconds)]),
      styles: { fontSize: 7, cellPadding: 2.2, textColor: [42, 51, 61] },
      headStyles: { fillColor: [16, 22, 32], textColor: [237, 242, 247] },
      alternateRowStyles: { fillColor: [244, 247, 249] },
      margin: { left: 13, right: 13 }
    });
    doc.save(`replayfx-rapport-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast("Rapport PDF prêt", `${rows.length} trades et les statistiques principales ont été exportés.`, "↓");
  }

  function parseImportedCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 3) throw new Error("Le fichier contient trop peu de lignes.");
    const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
    const split = line => line.split(delimiter).map(value => value.trim().replace(/^"|"$/g, ""));
    const first = split(lines[0]);
    const hasHeader = first.some(value => /date|time|open|high|low|close/i.test(value));
    let indexes = { date: 0, open: 1, high: 2, low: 3, close: 4 };
    if (hasHeader) {
      const headers = first.map(value => value.toLowerCase());
      const find = words => headers.findIndex(header => words.some(word => header.includes(word)));
      indexes = { date: find(["date", "time"]), open: find(["open", "ouverture"]), high: find(["high", "haut"]), low: find(["low", "bas"]), close: find(["close", "clôture", "cloture"]) };
      if (Object.values(indexes).some(index => index < 0)) throw new Error("En-têtes attendus : date, open, high, low, close.");
    }
    const rows = [];
    lines.slice(hasHeader ? 1 : 0).forEach(line => {
      const cells = split(line);
      let timestampText = cells[indexes.date];
      let shift = 0;
      if (/^\d{8}$/.test(timestampText) && /^\d{6}$/.test(cells[1] || "")) {
        timestampText += ` ${cells[1]}`;
        shift = 1;
      }
      let timestamp;
      if (/^\d{8} \d{6}$/.test(timestampText)) {
        const match = timestampText.match(/^(\d{4})(\d{2})(\d{2}) (\d{2})(\d{2})(\d{2})$/);
        timestamp = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) / 1000;
      } else {
        const parsed = Date.parse(timestampText);
        timestamp = Number.isFinite(parsed) ? parsed / 1000 : NaN;
      }
      const offset = hasHeader ? 0 : shift;
      const open = Number(String(cells[indexes.open + offset]).replace(",", "."));
      const high = Number(String(cells[indexes.high + offset]).replace(",", "."));
      const low = Number(String(cells[indexes.low + offset]).replace(",", "."));
      const close = Number(String(cells[indexes.close + offset]).replace(",", "."));
      if ([timestamp, open, high, low, close].every(Number.isFinite)) rows.push([Math.round(timestamp), open, high, low, close]);
    });
    rows.sort((a, b) => a[0] - b[0]);
    if (rows.length < 10) throw new Error("Moins de dix bougies valides ont été reconnues.");
    return rows;
  }

  async function importCSV(file) {
    if (!file) return;
    if (state.activeTrade) return toast("Import verrouillé", "Fermez la position avant de changer de données.", "!");
    try {
      const rows = parseImportedCSV(await file.text());
      state.importedBars = rows;
      state.dataSource = "CSV importé";
      startSession(false);
      toast("Données importées", `${rows.length} bougies reconnues pour ${state.pair} · ${state.timeframe}.`, "↑");
    } catch (error) {
      toast("Import impossible", error.message, "!");
    }
    $("#csv-input").value = "";
  }

  function pointerPosition(event) {
    const rect = chart.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function priceFromY(py) {
    const metrics = state.chartMetrics;
    const ratio = clamp((py - metrics.plot.top) / (metrics.plot.bottom - metrics.plot.top), 0, 1);
    return metrics.high - ratio * (metrics.high - metrics.low);
  }

  function analysisPointFromPosition(position) {
    const metrics = state.chartMetrics;
    if (!metrics || position.y < metrics.plot.top || position.y > metrics.plot.bottom || position.x < metrics.plot.left || position.x > metrics.plot.right) return null;
    const index = metrics.windowRange.start + (position.x - metrics.plot.left) / metrics.xStep - .5;
    return {
      index: clamp(index, metrics.windowRange.start, metrics.windowRange.end - 1 + metrics.futureGapBars),
      price: priceFromY(position.y)
    };
  }

  function setDrawMode(mode) {
    state.drawMode = mode;
    state.drawingDraft = null;
    state.dragging = null;
    state.hoveredLevel = null;
    stage.classList.remove("is-dragging");
    stage.classList.remove("is-level-hover", "is-level-dragging");
    stage.dataset.drawMode = mode;
    const hints = {
      cursor: "Molette : zoom · Glisser : déplacer",
      trend: "Ligne de tendance : cliquer-glisser entre deux points",
      rectangle: "Rectangle : cliquer-glisser pour délimiter une zone",
      fibonacci: "Fibonacci : cliquer-glisser du premier au second niveau"
    };
    $("#chart-hint").textContent = hints[mode] || hints.cursor;
    $("#chart-hint").classList.remove("is-hidden");
    syncDrawingToolbar();
    renderChart();
  }

  function syncDrawingToolbar() {
    stage.dataset.drawMode = state.drawMode;
    $$('[data-draw-mode]').forEach(button => {
      const active = button.dataset.drawMode === state.drawMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const rsiButton = $("#rsi-toggle");
    if (rsiButton) {
      rsiButton.classList.toggle("is-active", state.rsiEnabled);
      rsiButton.setAttribute("aria-pressed", String(state.rsiEnabled));
    }
    if ($("#undo-drawing")) $("#undo-drawing").disabled = state.drawings.length === 0;
    if ($("#clear-drawings")) $("#clear-drawings").disabled = state.drawings.length === 0;
  }

  function undoDrawing() {
    if (!state.drawings.length) return;
    state.drawings.pop();
    syncDrawingToolbar();
    renderChart();
  }

  function clearDrawings() {
    if (!state.drawings.length) return;
    state.drawings = [];
    state.drawingDraft = null;
    syncDrawingToolbar();
    renderChart();
    toast("Tracés effacés", "Le graphique est à nouveau vierge.", "×");
  }

  function pruneDrawingsToRevealed() {
    state.drawings = state.drawings.filter(drawing => Math.max(drawing.p1.index, drawing.p2.index) <= state.revealed - 1);
    syncDrawingToolbar();
  }

  function levelAtY(py) {
    const metrics = state.chartMetrics;
    if (!metrics) return null;
    const levels = chartLevels();
    const candidates = ["stop", "target", ...(state.activeTrade ? [] : ["entry"])];
    const nearest = candidates
      .map(key => ({ key, distance: Math.abs(metrics.y(levels[key]) - py) }))
      .sort((a, b) => a.distance - b.distance)[0];
    return nearest?.distance <= 16 ? nearest.key : null;
  }

  function updateCrosshair(position) {
    const metrics = state.chartMetrics;
    if (!metrics) return;
    const rawIndex = Math.floor((position.x - metrics.plot.left) / metrics.xStep);
    const localIndex = clamp(rawIndex, 0, metrics.windowRange.count - 1);
    state.crosshair = { ...position, bar: rawIndex >= metrics.windowRange.count ? null : state.sessionData[metrics.windowRange.start + localIndex] };
  }

  function onPointerDown(event) {
    if (!state.chartMetrics) return;
    const position = pointerPosition(event);
    if (state.drawMode !== "cursor") {
      const point = analysisPointFromPosition(position);
      if (!point) return;
      stopPlayback();
      state.drawingDraft = { id: `D${Date.now().toString(36)}`, type: state.drawMode, p1: point, p2: { ...point } };
      state.dragging = { type: "drawing", startX: position.x, startY: position.y };
      chart.setPointerCapture?.(event.pointerId);
      renderChart();
      return;
    }
    const level = levelAtY(position.y);
    if (level) {
      stopPlayback();
      state.dragging = { type: "level", level, startPrice: chartLevels()[level] };
      state.hoveredLevel = level;
      stage.classList.add("is-level-dragging");
      chart.setPointerCapture?.(event.pointerId);
      renderChart();
      return;
    }
    state.dragging = { type: "pan", startX: position.x, initialPan: state.panOffset };
    stage.classList.add("is-dragging");
    chart.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const position = pointerPosition(event);
    if (!state.dragging) {
      state.hoveredLevel = state.drawMode === "cursor" ? levelAtY(position.y) : null;
      stage.classList.toggle("is-level-hover", Boolean(state.hoveredLevel));
      updateCrosshair(position);
      renderChart();
      return;
    }
    if (state.dragging.type === "pan") {
      const deltaBars = Math.round((position.x - state.dragging.startX) / Math.max(1, state.chartMetrics.xStep));
      const maxPan = Math.max(0, state.revealed - Math.min(state.visibleCount, state.revealed));
      state.panOffset = clamp(state.dragging.initialPan + deltaBars, 0, maxPan);
      renderChart();
      return;
    }
    if (state.dragging.type === "drawing") {
      const point = analysisPointFromPosition(position);
      if (point && state.drawingDraft) state.drawingDraft.p2 = point;
      renderChart();
      return;
    }
    const key = state.dragging.level;
    const newPrice = priceFromY(position.y);
    const source = state.activeTrade || state.draft;
    if (key === "entry" && !state.activeTrade) {
      const delta = newPrice - source.entry;
      source.entry = newPrice;
      source.stop += delta;
      source.target += delta;
    } else if (key === "stop") {
      source.stop = newPrice;
    } else if (key === "target") {
      source.target = newPrice;
    }
    if (state.activeTrade) {
      state.draft.entry = state.activeTrade.entry;
      state.draft.stop = state.activeTrade.stop;
      state.draft.target = state.activeTrade.target;
    }
    syncDraftInputs();
    updateLivePosition();
    renderChart();
  }

  function onPointerUp(event) {
    if (state.dragging?.type === "drawing") {
      const draft = state.drawingDraft;
      const moved = draft && (Math.abs(draft.p2.index - draft.p1.index) > .35 || Math.abs(draft.p2.price - draft.p1.price) > pipSize());
      if (draft && moved) state.drawings.push(draft);
      state.drawingDraft = null;
      syncDrawingToolbar();
      renderChart();
    }
    if (state.dragging?.type === "level" && state.activeTrade) {
      toast("Niveau ajusté", `${state.dragging.level === "stop" ? "Stop loss" : "Take profit"} déplacé à ${price(state.activeTrade[state.dragging.level])}.`, "↕");
    }
    state.dragging = null;
    state.hoveredLevel = null;
    stage.classList.remove("is-dragging");
    stage.classList.remove("is-level-hover", "is-level-dragging");
    chart.releasePointerCapture?.(event.pointerId);
  }

  function zoomChart(multiplier, anchorX = null) {
    const oldCount = state.visibleCount;
    state.visibleCount = clamp(state.visibleCount * multiplier, 28, Math.min(220, state.revealed));
    if (anchorX != null && state.chartMetrics) {
      const plot = state.chartMetrics.plot;
      const fraction = clamp((anchorX - plot.left) / (plot.right - plot.left), 0, 1);
      const shift = Math.round((oldCount - state.visibleCount) * (1 - fraction));
      state.panOffset = clamp(state.panOffset + shift, 0, Math.max(0, state.revealed - state.visibleCount));
    }
    renderChart();
  }

  function switchView(view) {
    $$(".nav-item").forEach(button => button.classList.toggle("is-active", button.dataset.view === view));
    $$(".view").forEach(section => section.classList.toggle("is-active", section.id === `view-${view}`));
    if (view === "backtest") requestAnimationFrame(renderChart);
    if (view === "journal") updateJournal();
    if (view === "analytics") requestAnimationFrame(updateAnalytics);
  }

  function bindEvents() {
    $$(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
    $$('[data-go-backtest]').forEach(button => button.addEventListener("click", () => switchView("backtest")));

    $("#pair-select").addEventListener("change", event => {
      if (state.activeTrade) return syncSelectors();
      state.pair = event.target.value;
      state.importedBars = null;
      state.dataSource = "HistData";
      persistSettings();
      startSession(false);
    });
    $("#timeframe-select").addEventListener("change", event => {
      if (!switchTimeframe(event.target.value)) syncSelectors();
    });
    $("#random-session").addEventListener("click", () => {
      if (startSession(true)) toast("Nouvelle session", "Un point de départ historique aléatoire a été sélectionné.", "↻");
    });

    $("#play-toggle").addEventListener("click", () => state.playing ? stopPlayback() : startPlayback());
    $("#step-forward").addEventListener("click", () => { stopPlayback(); revealNext(); });
    $("#step-back").addEventListener("click", revealPrevious);
    $("#speed-select").addEventListener("change", () => { if (state.playing) startPlayback(); });
    $("#timeline").addEventListener("input", event => {
      const requested = Number(event.target.value) + 1;
      if (requested > state.revealed || state.activeTrade) {
        event.target.value = state.revealed - 1;
        toast("Futur verrouillé", "Débloquez les bougies avec le bouton Suivant ou la lecture automatique.", "◉");
        return;
      }
      state.revealed = Math.max(2, requested);
      state.marketTime = currentBar()[0] + timeframeSeconds();
      state.marketPrice = currentBar()[4];
      state.panOffset = 0;
      pruneDrawingsToRevealed();
      syncDraftToMarket();
      updateAll();
    });

    $("#zoom-in").addEventListener("click", () => zoomChart(.78));
    $("#zoom-out").addEventListener("click", () => zoomChart(1.28));
    $("#fit-chart").addEventListener("click", () => { state.visibleCount = Math.min(95, state.revealed); state.panOffset = 0; renderChart(); });
    $$('[data-draw-mode]').forEach(button => button.addEventListener("click", () => setDrawMode(button.dataset.drawMode)));
    $("#rsi-toggle").addEventListener("click", () => {
      state.rsiEnabled = !state.rsiEnabled;
      persistSettings();
      syncDrawingToolbar();
      renderChart();
    });
    $("#undo-drawing").addEventListener("click", undoDrawing);
    $("#clear-drawings").addEventListener("click", clearDrawings);
    $("#snapshot-button").addEventListener("click", addManualSnapshot);
    $("#fullscreen-chart").addEventListener("click", () => {
      const card = $(".chart-card");
      if (document.fullscreenElement) document.exitFullscreen(); else card.requestFullscreen?.();
    });
    document.addEventListener("fullscreenchange", () => setTimeout(renderChart, 60));

    $$(".side-tab").forEach(button => button.addEventListener("click", () => setDirection(button.dataset.direction)));
    $$('[data-risk-mode]').forEach(button => button.addEventListener("click", () => setRiskMode(button.dataset.riskMode)));
    ["#entry-price", "#stop-price", "#target-price", "#account-balance", "#risk-value"].forEach(selector => $(selector).addEventListener("input", updateRiskPreview));
    $("#entry-market").addEventListener("click", () => {
      const current = currentMarketPrice();
      const delta = current - state.draft.entry;
      state.draft.entry = current;
      state.draft.stop += delta;
      state.draft.target += delta;
      syncDraftInputs();
    });
    $$(".mini-adjust").forEach(button => button.addEventListener("click", () => {
      const field = button.dataset.field;
      const direction = state.direction === "long" ? 1 : -1;
      state.draft[field === "stop-price" ? "stop" : "target"] += Number(button.dataset.pips) * pipSize() * direction;
      syncDraftInputs();
    }));
    $("#place-trade").addEventListener("click", placeTrade);
    $("#close-trade").addEventListener("click", manualClose);
    $("#move-breakeven").addEventListener("click", moveStopToBreakeven);

    chart.addEventListener("pointerdown", onPointerDown);
    chart.addEventListener("pointermove", onPointerMove);
    chart.addEventListener("pointerup", onPointerUp);
    chart.addEventListener("pointercancel", onPointerUp);
    chart.addEventListener("pointerleave", () => {
      if (!state.dragging) {
        state.crosshair = null;
        state.hoveredLevel = null;
        stage.classList.remove("is-level-hover");
        renderChart();
      }
    });
    chart.addEventListener("wheel", event => { event.preventDefault(); zoomChart(event.deltaY > 0 ? 1.12 : .89, pointerPosition(event).x); }, { passive: false });
    stage.addEventListener("pointerenter", () => $("#chart-hint").classList.add("is-hidden"), { once: true });
    document.addEventListener("keydown", event => {
      const editing = event.target.matches?.("input, textarea, select");
      if (event.key === "Escape" && state.drawMode !== "cursor") setDrawMode("cursor");
      if (!editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoDrawing();
      }
    });

    $("#theme-toggle").addEventListener("click", () => {
      document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      persistSettings();
      renderChart();
      updateAnalytics();
    });

    $("#import-open").addEventListener("click", () => $("#csv-input").click());
    $("#csv-input").addEventListener("change", event => importCSV(event.target.files?.[0]));

    $("#trades-body").addEventListener("click", event => {
      const button = event.target.closest("[data-trade-id]");
      if (button) showTradeDetail(button.dataset.tradeId);
    });
    $("#dialog-content").addEventListener("click", event => {
      const button = event.target.closest("[data-download-shot]");
      if (button) downloadSnapshot(button.dataset.trade, button.dataset.downloadShot);
    });
    $("#dialog-close").addEventListener("click", () => $("#trade-dialog").close());
    $("#trade-dialog").addEventListener("click", event => { if (event.target === $("#trade-dialog")) $("#trade-dialog").close(); });
    $("#clear-journal").addEventListener("click", () => state.trades.length ? $("#confirm-dialog").showModal() : toast("Journal vide", "Aucun trade à supprimer.", "⌁"));
    $("#confirm-cancel").addEventListener("click", () => $("#confirm-dialog").close());
    $("#confirm-clear").addEventListener("click", () => {
      state.trades = [];
      persistTrades();
      $("#confirm-dialog").close();
      updateJournal();
      toast("Journal effacé", "Toutes les données locales ont été supprimées.", "×");
    });
    $("#export-csv").addEventListener("click", exportCSV);
    $("#export-xlsx").addEventListener("click", exportXLSX);
    $("#export-pdf").addEventListener("click", exportPDF);

    const resizeObserver = new ResizeObserver(() => {
      if ($("#view-backtest").classList.contains("is-active")) renderChart();
      if ($("#view-analytics").classList.contains("is-active")) updateAnalytics();
    });
    resizeObserver.observe(stage);
    resizeObserver.observe(equityCanvas);
  }

  function init() {
    document.documentElement.dataset.theme = savedSettings.theme || "dark";
    syncSelectors();
    bindEvents();
    startSession(false);
    updatePositionMode();
    updateJournal();
    setTimeout(() => toast("Session prête", `${state.pair} · ${TIMEFRAME_NAMES[state.timeframe]} · données réelles 2024`, "●"), 450);
  }

  init();
})();
