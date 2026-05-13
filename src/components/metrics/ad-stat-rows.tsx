"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

export function AdStatRow({
  icon: Icon,
  label,
  value,
  color = "text-muted-foreground",
  compact,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color?: string;
  compact?: boolean;
}) {
  const py = compact ? "py-2" : "py-3";
  const gap = compact ? "gap-2" : "gap-3";
  const iconSz = compact ? "h-3 w-3" : "h-4 w-4";
  const valueCls = compact
    ? `text-sm font-semibold ${color} tabular-nums`
    : `text-lg font-semibold ${color} tabular-nums`;
  const labelCls = compact ? "text-xs" : "";

  return (
    <div
      className={`flex items-center justify-between ${py} border-b border-border/30 last:border-0`}
    >
      <div className={`flex items-center ${gap} text-muted-foreground`}>
        <Icon className={`${iconSz} ${color}`} />
        <span className={labelCls}>{label}</span>
      </div>
      <span className={valueCls}>{value.toLocaleString()}</span>
    </div>
  );
}

export function AdConversionRow({
  views,
  clicks,
  compact,
}: {
  views: number;
  clicks: number;
  compact?: boolean;
}) {
  const rate = views > 0 ? (clicks / views) * 100 : 0;
  const py = compact ? "py-2" : "py-3";
  const valueCls = compact
    ? "text-sm font-semibold text-orange-500 tabular-nums"
    : "text-lg font-semibold text-orange-500 tabular-nums";

  return (
    <div
      className={`flex items-center justify-between ${py} border-b border-border/30 last:border-0`}
    >
      <div
        className={`flex items-center ${compact ? "gap-2" : "gap-3"} text-muted-foreground`}
      >
        <TrendingUp
          className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-orange-500`}
        />
        <span className={compact ? "text-xs" : ""}>Conversion Rate</span>
      </div>
      <span className={valueCls}>{rate.toFixed(2)}%</span>
    </div>
  );
}
