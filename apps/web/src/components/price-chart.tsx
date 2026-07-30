import { useMemo, useState } from "react";
import type { PricePoint } from "@trader/shared";
import { Button } from "@/components/ui/button";

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 8, left: 52 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export function PriceChart({ data }: { data: PricePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const points = useMemo(() => data.map((p) => ({ date: p.date, close: Number(p.close) })), [data]);

  if (points.length < 2) {
    return <p className="text-sm text-neutral-500">Not enough price history to chart.</p>;
  }

  const closes = points.map((p) => p.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const priceRange = maxClose - minClose || 1;

  const xFor = (i: number) => PADDING.left + (i / (points.length - 1)) * INNER_WIDTH;
  const yFor = (close: number) => PADDING.top + INNER_HEIGHT - ((close - minClose) / priceRange) * INNER_HEIGHT;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(p.close).toFixed(2)}`).join(" ");
  const baselineY = (PADDING.top + INNER_HEIGHT).toFixed(2);
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(2)} ${baselineY} L ${xFor(0).toFixed(2)} ${baselineY} Z`;

  const last = points[points.length - 1]!;
  const first = points[0]!;
  const hovered = hoverIndex !== null ? points[hoverIndex]! : null;
  const gridPrices = [minClose, (minClose + maxClose) / 2, maxClose];

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const svgX = (e.clientX - rect.left) * scaleX;
    const clamped = Math.min(PADDING.left + INNER_WIDTH, Math.max(PADDING.left, svgX));
    const ratio = (clamped - PADDING.left) / INNER_WIDTH;
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          {first.date} – {last.date}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Show chart" : "View as table"}
        </Button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 font-medium">Close</th>
              </tr>
            </thead>
            <tbody className="[font-variant-numeric:tabular-nums]">
              {[...points].reverse().map((p) => (
                <tr key={p.date} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1">{p.date}</td>
                  <td className="py-1">{p.close.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Closing price chart, ${points.length} trading days, from ${first.date} (${first.close.toFixed(2)}) to ${last.date} (${last.close.toFixed(2)})`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {gridPrices.map((price) => (
            <g key={price}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={yFor(price)}
                y2={yFor(price)}
                strokeWidth={1}
                className="stroke-neutral-200 dark:stroke-neutral-800"
              />
              <text
                x={PADDING.left - 8}
                y={yFor(price)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-neutral-400 text-[9px]"
              >
                {price.toFixed(2)}
              </text>
            </g>
          ))}

          <path d={areaPath} stroke="none" className="fill-[#2a78d6]/10 dark:fill-[#3987e5]/10" />
          <path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
          />

          <circle
            cx={xFor(points.length - 1)}
            cy={yFor(last.close)}
            r={4}
            strokeWidth={2}
            className="fill-[#2a78d6] stroke-white dark:fill-[#3987e5] dark:stroke-neutral-950"
          />
          <text
            x={xFor(points.length - 1) - 6}
            y={yFor(last.close) - 8}
            textAnchor="end"
            className="fill-neutral-700 text-[10px] font-medium dark:fill-neutral-300"
          >
            {last.close.toFixed(2)}
          </text>

          {hovered && hoverIndex !== null && (
            <>
              <line
                x1={xFor(hoverIndex)}
                x2={xFor(hoverIndex)}
                y1={PADDING.top}
                y2={PADDING.top + INNER_HEIGHT}
                strokeWidth={1}
                className="stroke-neutral-400 dark:stroke-neutral-600"
              />
              <circle
                cx={xFor(hoverIndex)}
                cy={yFor(hovered.close)}
                r={4}
                strokeWidth={2}
                className="fill-[#2a78d6] stroke-white dark:fill-[#3987e5] dark:stroke-neutral-950"
              />
            </>
          )}
        </svg>
      )}

      <div className="text-center text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {hovered ? `${hovered.date}: ${hovered.close.toFixed(2)}` : "Hover the chart for a specific day"}
      </div>
    </div>
  );
}
