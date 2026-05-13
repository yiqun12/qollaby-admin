"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ListPieRow = { label: string; count: number };

type Props = {
  title: string;
  rows: ListPieRow[];
  totalInDatabase: number;
  scannedCount: number;
  /** Merged onto the root Card (e.g. `h-full flex flex-col` for a tall sidebar). */
  className?: string;
  /** Merged onto CardContent (e.g. `flex-1 justify-center`). */
  contentClassName?: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${end.x} ${end.y} A ${r} ${r} 0 ${large} 1 ${start.x} ${start.y} Z`;
}

function sliceColor(i: number, n: number) {
  const hue = (i * (360 / Math.max(n, 1))) % 360;
  return `hsl(${hue} 62% 48%)`;
}

/** Consistent colors for the standard Views vs Clicks two-slice pie. */
function sliceFillForRow(row: ListPieRow, i: number, n: number) {
  if (n === 2 && row.label === "Views") return "hsl(217 85% 52%)";
  if (n === 2 && row.label === "Clicks") return "hsl(152 65% 42%)";
  return sliceColor(i, n);
}

export function ListDistributionPieChart({
  title,
  rows,
  totalInDatabase,
  scannedCount,
  className,
  contentClassName,
}: Props) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const safeTotal = total > 0 ? total : 1;

  const cx = 80;
  const cy = 80;
  const r = 70;

  let angle = 0;
  const slices =
    total === 0
      ? [{ path: arcPath(cx, cy, r, 0, 360), color: "hsl(220 14% 35%)" }]
      : rows.map((row, i) => {
          const span = (row.count / safeTotal) * 360;
          const start = angle;
          const end = angle + span;
          angle = end;
          return {
            path: arcPath(cx, cy, r, start, end),
            color: sliceFillForRow(row, i, rows.length),
          };
        });

  const foot =
    totalInDatabase > 0
      ? scannedCount >= totalInDatabase
        ? `All ${totalInDatabase.toLocaleString()} in sample`
        : `Newest ${scannedCount.toLocaleString()} of ${totalInDatabase.toLocaleString()} total`
      : "No data";

  return (
    <Card className={cn("bg-card/50 border-border/50", className)}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground/90">{foot}</p>
      </CardHeader>
      <CardContent
        className={cn("flex flex-col sm:flex-row items-center gap-6", contentClassName)}
      >
        <svg width={160} height={160} viewBox="0 0 160 160" className="shrink-0">
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              stroke="hsl(0 0% 8%)"
              strokeWidth={1}
            />
          ))}
          <circle cx={cx} cy={cy} r={32} fill="hsl(0 0% 6%)" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            {total.toLocaleString()}
          </text>
        </svg>
        <div className="flex flex-col gap-2 text-sm w-full min-w-0 max-h-48 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No rows in sample</p>
          ) : (
            rows.map((row, i) => {
              const pct = total ? (row.count / total) * 100 : 0;
              return (
                <div
                  key={`${row.label}-${i}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-sm shrink-0"
                      style={{ backgroundColor: sliceFillForRow(row, i, rows.length) }}
                    />
                    <span className="truncate text-foreground" title={row.label}>
                      {row.label}
                    </span>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="font-medium">{row.count.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
