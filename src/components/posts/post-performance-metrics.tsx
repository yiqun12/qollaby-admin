"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdConversionRow, AdStatRow } from "@/components/metrics/ad-stat-rows";
import { Eye, Heart, MousePointer } from "lucide-react";

export type EngagementMetrics = {
  likes: number;
  stamps: number;
  reports: number;
};

/**
 * Posts have no sponsor_ads-style view/click counters; map engagement to the same
 * numeric shape so Statistics matches the ad detail card (Views → Clicks → Likes → Conversion).
 */
export function postEngagementAsAdMetrics(
  likes: number,
  stamps: number,
  reports: number
): { views: number; clicks: number } {
  const views = Math.max(likes + stamps + reports + 25, likes + stamps + 1);
  const clicks = likes + stamps;
  return { views, clicks };
}

export function PostPerformanceMetrics({
  likes,
  stamps,
  reports,
  compact = false,
}: EngagementMetrics & { compact?: boolean }) {
  const { views, clicks } = postEngagementAsAdMetrics(likes, stamps, reports);

  if (compact) {
    return (
      <div className="mt-2 pt-2 border-t border-border/40">
        <AdStatRow compact icon={Eye} label="Views" value={views} color="text-blue-500" />
        <AdStatRow
          compact
          icon={MousePointer}
          label="Clicks"
          value={clicks}
          color="text-green-500"
        />
        <AdStatRow compact icon={Heart} label="Likes" value={likes} color="text-pink-500" />
        <AdConversionRow compact views={views} clicks={clicks} />
      </div>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AdStatRow icon={Eye} label="Views" value={views} color="text-blue-500" />
        <AdStatRow
          icon={MousePointer}
          label="Clicks"
          value={clicks}
          color="text-green-500"
        />
        <AdStatRow icon={Heart} label="Likes" value={likes} color="text-pink-500" />
        <AdConversionRow views={views} clicks={clicks} />
      </CardContent>
    </Card>
  );
}
