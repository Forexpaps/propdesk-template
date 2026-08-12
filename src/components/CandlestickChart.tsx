import React from "react";
import { Candle } from "../lib/propChallenge";

interface CandlestickChartProps {
  candles: Candle[];
  decimals: number;
  /** Nombre de bougies visibles simultanément dans la fenêtre glissante. */
  visibleCount?: number;
  positionEntryPrice?: number | null;
  positionSl?: number | null;
  positionTp?: number | null;
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 380;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 16;
const PADDING_RIGHT = 70;

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  decimals,
  visibleCount = 60,
  positionEntryPrice = null,
  positionSl = null,
  positionTp = null,
}) => {
  const visible = candles.slice(-visibleCount);
  if (visible.length === 0) return null;

  const highs = visible.map((c) => c.high);
  const lows = visible.map((c) => c.low);
  let maxPrice = Math.max(...highs);
  let minPrice = Math.min(...lows);
  if (positionSl !== null) {
    maxPrice = Math.max(maxPrice, positionSl);
    minPrice = Math.min(minPrice, positionSl);
  }
  if (positionTp !== null) {
    maxPrice = Math.max(maxPrice, positionTp);
    minPrice = Math.min(minPrice, positionTp);
  }
  const span = maxPrice - minPrice || maxPrice * 0.001 || 1;
  const pad = span * 0.08;
  maxPrice += pad;
  minPrice -= pad;

  const plotWidth = VIEW_WIDTH - PADDING_RIGHT;
  const plotHeight = VIEW_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const candleSlot = plotWidth / visibleCount;
  const bodyWidth = Math.max(1.5, candleSlot * 0.55);
  const startOffset = visibleCount - visible.length;

  const priceToY = (price: number) => {
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    return PADDING_TOP + (1 - ratio) * plotHeight;
  };

  const lastClose = visible[visible.length - 1].close;
  const lastCloseY = priceToY(lastClose);

  const gridLines = 5;
  const gridPrices = Array.from({ length: gridLines }, (_, i) => minPrice + (span + 2 * pad) * (i / (gridLines - 1)));

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Graphique en chandelier du marché simulé"
    >
      {gridPrices.map((price, i) => {
        const y = priceToY(price);
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={plotWidth} y2={y} stroke="#1B2320" strokeWidth={1} strokeDasharray="3,4" />
            <text x={plotWidth + 6} y={y + 3} fontSize={10} fill="#64748b" fontFamily="monospace">
              {price.toFixed(decimals)}
            </text>
          </g>
        );
      })}

      {positionEntryPrice !== null && (
        <g>
          <line
            x1={0}
            y1={priceToY(positionEntryPrice)}
            x2={plotWidth}
            y2={priceToY(positionEntryPrice)}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2,3"
          />
        </g>
      )}
      {positionSl !== null && (
        <line x1={0} y1={priceToY(positionSl)} x2={plotWidth} y2={priceToY(positionSl)} stroke="#fb7185" strokeWidth={1} strokeDasharray="2,3" />
      )}
      {positionTp !== null && (
        <line x1={0} y1={priceToY(positionTp)} x2={plotWidth} y2={priceToY(positionTp)} stroke="#00E676" strokeWidth={1} strokeDasharray="2,3" />
      )}

      {visible.map((candle, i) => {
        const slotIndex = startOffset + i;
        const cx = slotIndex * candleSlot + candleSlot / 2;
        const isBull = candle.close >= candle.open;
        const color = isBull ? "#00E676" : "#fb7185";
        const yOpen = priceToY(candle.open);
        const yClose = priceToY(candle.close);
        const yHigh = priceToY(candle.high);
        const yLow = priceToY(candle.low);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));

        return (
          <g key={candle.index}>
            <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
            <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}

      <line x1={0} y1={lastCloseY} x2={plotWidth} y2={lastCloseY} stroke="#00E676" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
      <rect x={plotWidth + 2} y={lastCloseY - 9} width={PADDING_RIGHT - 4} height={18} rx={3} fill="#00E676" />
      <text x={plotWidth + PADDING_RIGHT / 2} y={lastCloseY + 4} fontSize={10} fontWeight="bold" fill="#062012" fontFamily="monospace" textAnchor="middle">
        {lastClose.toFixed(decimals)}
      </text>
    </svg>
  );
};
