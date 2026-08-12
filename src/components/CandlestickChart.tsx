import React, { useRef, useState } from "react";
import { Candle } from "../lib/propChallenge";

interface CandlestickChartProps {
  candles: Candle[];
  decimals: number;
  /** Nombre de bougies visibles simultanément dans la fenêtre glissante. */
  visibleCount?: number;
  positionEntryPrice?: number | null;
  positionSl?: number | null;
  positionTp?: number | null;
  /** Fournis => la ligne SL devient glissable à la souris/au doigt. */
  onSlDrag?: (price: number) => void;
  /** Fournis => la ligne TP devient glissable à la souris/au doigt. */
  onTpDrag?: (price: number) => void;
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
  onSlDrag,
  onTpDrag,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"sl" | "tp" | null>(null);

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

  const yToPrice = (clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const svgY = ((clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    const ratio = 1 - (svgY - PADDING_TOP) / plotHeight;
    return minPrice + ratio * (maxPrice - minPrice);
  };

  const lastClose = visible[visible.length - 1].close;
  const lastCloseY = priceToY(lastClose);

  const gridLines = 5;
  const gridPrices = Array.from({ length: gridLines }, (_, i) => minPrice + (span + 2 * pad) * (i / (gridLines - 1)));

  const handlePointerDown = (side: "sl" | "tp") => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(side);
  };

  const handlePointerMove = (side: "sl" | "tp", callback?: (price: number) => void) => (e: React.PointerEvent) => {
    if (dragging !== side || !callback) return;
    callback(yToPrice(e.clientY));
  };

  const handlePointerUp = () => setDragging(null);

  const renderStopLine = (
    price: number | null,
    color: string,
    side: "sl" | "tp",
    label: string,
    onDrag?: (price: number) => void
  ) => {
    if (price === null) return null;
    const y = priceToY(price);
    const draggable = Boolean(onDrag);
    return (
      <g>
        <line x1={0} y1={y} x2={plotWidth} y2={y} stroke={color} strokeWidth={1} strokeDasharray="2,3" />
        {draggable && (
          <rect
            x={0}
            y={y - 8}
            width={plotWidth}
            height={16}
            fill="transparent"
            style={{ cursor: "ns-resize" }}
            onPointerDown={handlePointerDown(side)}
            onPointerMove={handlePointerMove(side, onDrag)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
        <rect
          x={plotWidth + 2}
          y={y - 9}
          width={PADDING_RIGHT - 4}
          height={18}
          rx={3}
          fill={color}
          style={draggable ? { cursor: "ns-resize" } : undefined}
          onPointerDown={draggable ? handlePointerDown(side) : undefined}
          onPointerMove={draggable ? handlePointerMove(side, onDrag) : undefined}
          onPointerUp={draggable ? handlePointerUp : undefined}
          onPointerCancel={draggable ? handlePointerUp : undefined}
        />
        <text
          x={plotWidth + PADDING_RIGHT / 2}
          y={y + 4}
          fontSize={10}
          fontWeight="bold"
          fill="#0D1110"
          fontFamily="monospace"
          textAnchor="middle"
          style={{ pointerEvents: "none" }}
        >
          {price.toFixed(decimals)}
        </text>
        <text
          x={4}
          y={y - 3}
          fontSize={9}
          fontWeight="bold"
          fill={color}
          fontFamily="monospace"
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
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
        <line
          x1={0}
          y1={priceToY(positionEntryPrice)}
          x2={plotWidth}
          y2={priceToY(positionEntryPrice)}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="2,3"
        />
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

      {renderStopLine(positionSl, "#fb7185", "sl", "SL", onSlDrag)}
      {renderStopLine(positionTp, "#00E676", "tp", "TP", onTpDrag)}
    </svg>
  );
};
