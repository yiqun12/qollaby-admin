"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminAdsPanel } from "@/components/ads/admin-ads-panel";
import type { AdTagType } from "@/lib/user-actions";
import { cn } from "@/lib/utils";
import { Calendar, Home, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TAG_OPTIONS: {
  tag: AdTagType;
  label: string;
  title: string;
  description: string;
  headerIcon: LucideIcon;
}[] = [
  {
    tag: "home",
    label: "Home",
    title: "Admin Home Ads",
    description: "Manage admin-created ads for the Home feed",
    headerIcon: Home,
  },
  {
    tag: "event",
    label: "Event",
    title: "Admin Event Ads",
    description: "Manage admin-created ads for Events",
    headerIcon: Calendar,
  },
  {
    tag: "exchange",
    label: "Exchange",
    title: "Admin Exchange Ads",
    description: "Manage admin-created ads for Exchange",
    headerIcon: Repeat,
  },
];

function parseTag(raw: string | null): AdTagType {
  if (raw === "event" || raw === "exchange") return raw;
  return "home";
}

function AdminAdsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tag = parseTag(searchParams.get("tag"));
  const meta = useMemo(() => TAG_OPTIONS.find((o) => o.tag === tag)!, [tag]);

  const setTag = (next: AdTagType) => {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "home") {
      q.delete("tag");
    } else {
      q.set("tag", next);
    }
    const qs = q.toString();
    router.replace(qs ? `/ads/admin?${qs}` : "/ads/admin", { scroll: false });
  };

  return (
    <div className="space-y-4">
      <div
        className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1"
        role="tablist"
        aria-label="Admin ad placement"
      >
        {TAG_OPTIONS.map((opt) => {
          const Icon = opt.headerIcon;
          const selected = opt.tag === tag;
          return (
            <button
              key={opt.tag}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTag(opt.tag)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {opt.label}
            </button>
          );
        })}
      </div>

      <AdminAdsPanel
        key={tag}
        tag={meta.tag}
        title={meta.title}
        description={meta.description}
        headerIcon={meta.headerIcon}
      />
    </div>
  );
}

export default function AdminAdsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-sm text-muted-foreground">
          Loading admin ads…
        </div>
      }
    >
      <AdminAdsPageInner />
    </Suspense>
  );
}
