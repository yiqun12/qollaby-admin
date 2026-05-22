"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LocationPicker, { PlaceValue } from "@/components/ui/location-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { getImageUrl, getVideoUrl, isVideoUrl, uploadFiles } from "@/lib/appwrite";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { MediaUpload } from "@/components/ui/media-upload";
import { Category, getCategories, getSubcategories } from "@/lib/category-actions";
import {
    AD_SLOTS,
    MULTI_USE_SLOTS,
    AdSlot,
    AdTagType,
    createSponsorAd,
    getAdminAdsBySlot,
    getSponsorAdsFieldDistribution,
    getSlotUsageCounts,
    getSlotMaxUsage,
    getSponsorAdStats,
    getAdsLikeCounts,
    getAdsReportCounts,
    getPostStampsByPostIds,
    type FieldDistributionResult,
    SlotUsageInfo,
    SponsorAd,
} from "@/lib/user-actions";
import { ListDistributionPieChart } from "@/components/posts/list-distribution-pie";
import { getStateFullName } from "@/lib/utils";
import {
    AlertTriangle,
    Ban,
    Eye,
    Heart,
    Loader2,
    Megaphone,
    MousePointer,
    Play,
    Plus,
    RefreshCw,
    Search,
    Shield,
    TrendingUp,
    Users,
    X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface AdminAdsPanelProps {
  tag: AdTagType;
  title: string;
  description: string;
  headerIcon?: LucideIcon;
}

/** URL `slots` query: show every cell, only cells with an ad, or only empty cells */
type SlotFillFilter = "all" | "fill" | "unfill";

function parseSlotFillFilter(raw: string | null): SlotFillFilter {
  if (raw === "fill" || raw === "unfill") return raw;
  return "all";
}

interface CreateAdForm {
  title: string;
  description: string;
  location: PlaceValue | null;
  state: string;
  city: string;
  category: string;
  subcategory: string;
  slot: AdSlot | null;
  mediaFiles: File[];
  mediaPreviews: string[];
  posterFiles: Array<File | null>;
  phoneNumber: string;
  website: string;
}

const initialFormState: CreateAdForm = {
  title: "",
  description: "",
  location: null,
  state: "",
  city: "",
  category: "",
  subcategory: "",
  slot: null,
  mediaFiles: [],
  mediaPreviews: [],
  posterFiles: [],
  phoneNumber: "",
  website: "",
};

export function AdminAdsPanel({ tag, title, description, headerIcon: HeaderIcon = Shield }: AdminAdsPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { admin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [adminAdsBySlot, setAdminAdsBySlot] = useState<Map<number, SponsorAd[]>>(new Map());
  const [adEngagementById, setAdEngagementById] = useState<
    Record<string, { likes: number; stamps: number; reports: number }>
  >({});
  const [stats, setStats] = useState({ totalAds: 0, activeAds: 0, pendingAds: 0 });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdForm>(initialFormState);
  const [creating, setCreating] = useState(false);
  const [slotUsageCounts, setSlotUsageCounts] = useState<SlotUsageInfo>({});

  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [createSubcategories, setCreateSubcategories] = useState<Category[]>([]);
  const [distribution, setDistribution] = useState<FieldDistributionResult | null>(null);

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [slotFillFilter, setSlotFillFilter] = useState<SlotFillFilter>(() =>
    parseSlotFillFilter(searchParams.get("slots"))
  );

  // Sync filters to URL (same pattern as posts-admin-list / users page)
  useEffect(() => {
    const params = new URLSearchParams();
    if (tag === "event" || tag === "exchange") params.set("tag", tag);
    const trimmed = search.trim();
    if (trimmed) params.set("search", trimmed);
    if (slotFillFilter !== "all") params.set("slots", slotFillFilter);
    const qs = params.toString();
    const base = pathname || "/ads/admin";
    router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
  }, [tag, search, slotFillFilter, router, pathname]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (search.trim()) n++;
    if (slotFillFilter !== "all") n++;
    return n;
  }, [search, slotFillFilter]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setSlotFillFilter("all");
  }, []);

  const adMatchesFilters = useCallback(
    (ad: SponsorAd | null, slotLabel: string) => {
      if (!ad) return true;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        ad.title,
        ad.description,
        ad.city,
        ad.state,
        ad.category,
        ad.subcategory,
        ad.phoneNumber,
        ad.website,
        slotLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    },
    [search]
  );

  const fetchDistribution = useCallback(() => {
    void getSponsorAdsFieldDistribution({
      isAdminCreated: true,
      tag,
      field: "category",
    }).then(setDistribution);
  }, [tag]);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, adminAdsMap] = await Promise.all([
        getSponsorAdStats(true, tag),
        getAdminAdsBySlot(tag),
      ]);
      setAdminAdsBySlot(adminAdsMap);
      setStats(statsData);

      const idSet = new Set<string>();
      adminAdsMap.forEach((list) => {
        list.forEach((ad) => idSet.add(ad.$id));
      });
      const allIds = [...idSet];
      if (allIds.length > 0) {
        const [likesMap, stampsMap, reportsMap] = await Promise.all([
          getAdsLikeCounts(allIds),
          getPostStampsByPostIds(allIds),
          getAdsReportCounts(allIds),
        ]);
        const next: Record<string, { likes: number; stamps: number; reports: number }> = {};
        for (const id of allIds) {
          next[id] = {
            likes: likesMap.get(id) ?? 0,
            stamps: stampsMap.get(id) ?? 0,
            reports: reportsMap.get(id) ?? 0,
          };
        }
        setAdEngagementById(next);
      } else {
        setAdEngagementById({});
      }
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  useEffect(() => {
    getCategories().then(setDynamicCategories);
  }, []);

  useEffect(() => {
    if (showCreateDialog) {
      getSlotUsageCounts(tag).then(setSlotUsageCounts);
      getCategories().then(setDynamicCategories);
    }
  }, [showCreateDialog, tag]);

  const handleCreateLocationChange = (location: PlaceValue | null) => {
    if (location?.state) {
      const stateFullName = getStateFullName(location.state);
      setCreateForm((prev) => ({
        ...prev,
        location,
        state: stateFullName,
        city: location.city || "",
      }));
    } else {
      setCreateForm((prev) => ({
        ...prev,
        location,
        state: "",
        city: "",
      }));
    }
  };

  useEffect(() => {
    if (createForm.category) {
      getSubcategories(createForm.category).then(setCreateSubcategories);
    } else {
      setCreateSubcategories([]);
    }
  }, [createForm.category]);

  const handleCreateAd = async () => {
    if (!admin?.profile?.userId) {
      alert("Authentication error. Please log in again.");
      return;
    }
    if (!createForm.title || !createForm.state || !createForm.city || !createForm.category || !createForm.slot) {
      alert("Please fill in all required fields");
      return;
    }
    if (createForm.mediaFiles.length === 0) {
      alert("Please upload at least one photo or video");
      return;
    }

    setCreating(true);
    try {
      let mediaUrls = await uploadFiles(createForm.mediaFiles);
      const firstMediaUrl = mediaUrls[0] || "";

      let coverImageUrl = "";
      if (firstMediaUrl) {
        if (!isVideoUrl(firstMediaUrl)) {
          coverImageUrl = firstMediaUrl;
        } else {
          const firstPoster = createForm.posterFiles[0];
          if (firstPoster) {
            const [posterUrl] = await uploadFiles([firstPoster]);
            coverImageUrl = posterUrl || "";

            const thumbId = posterUrl?.match(/\/files\/([^/]+)\//)?.[1];
            if (thumbId) {
              mediaUrls = mediaUrls.map((url) =>
                isVideoUrl(url) ? `${url}&thumb=${thumbId}` : url
              );
            }
          }
        }
      }

      await createSponsorAd({
        userId: admin.profile.userId,
        title: createForm.title,
        description: createForm.description || undefined,
        media: mediaUrls,
        image: coverImageUrl || undefined,
        state: createForm.state,
        city: createForm.city,
        category: createForm.category,
        subcategory: createForm.subcategory || undefined,
        slot: createForm.slot,
        phoneNumber: createForm.phoneNumber || undefined,
        website: createForm.website || undefined,
        tag,
      });

      createForm.mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      setShowCreateDialog(false);
      setCreateForm(initialFormState);
      fetchAds();
      fetchDistribution();
    } catch (error: unknown) {
      console.error("Failed to create ad:", error);
      const message = error instanceof Error ? error.message : "Failed to create ad. Please try again.";
      alert(message);
    } finally {
      setCreating(false);
    }
  };

  const handleClickEmptySlot = async (displaySlot: AdSlot) => {
    const usage = await getSlotUsageCounts(tag);
    setSlotUsageCounts(usage);

    setCreateForm({
      ...initialFormState,
      slot: displaySlot,
    });
    setShowCreateDialog(true);
  };

  const goToAdDetail = useCallback(
    (ad: SponsorAd) => {
      if (!ad.isAdminCreated) return;
      const qs = tag !== "home" ? `?tag=${tag}` : "";
      router.push(`/ads/${ad.$id}${qs}`);
    },
    [router, tag]
  );

  const adMetrics = (() => {
    let totalViews = 0;
    let totalClicks = 0;
    adminAdsBySlot.forEach((ads) => {
      for (const ad of ads) {
        totalViews += ad.views || 0;
        totalClicks += ad.clicks || 0;
      }
    });
    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    return { totalViews, totalClicks, ctr };
  })();

  const viewClickPieRows = useMemo(() => {
    const v = distribution?.sampleViewsSum ?? 0;
    const c = distribution?.sampleClicksSum ?? 0;
    return [
      { label: "Views", count: v },
      { label: "Clicks", count: c },
    ];
  }, [distribution]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        icon={HeaderIcon}
        children={
          <Button
            variant="outline"
            onClick={() => {
              fetchAds();
              fetchDistribution();
            }}
            className="bg-secondary/50 border-border/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Megaphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Ads</p>
                  <p className="text-2xl font-bold">{stats.totalAds}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CTR</p>
                  <p className="text-2xl font-bold">{adMetrics.ctr.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Eye className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Views</p>
                  <p className="text-2xl font-bold">{adMetrics.totalViews.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <MousePointer className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clicks</p>
                  <p className="text-2xl font-bold">{adMetrics.totalClicks.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="min-h-0 flex flex-col h-full md:min-h-[280px]">
          <ListDistributionPieChart
            className="h-full min-h-[260px] flex flex-col"
            contentClassName="flex-1 justify-center"
            title="Clicks vs views (recent sample)"
            rows={viewClickPieRows}
            totalInDatabase={distribution?.totalInDatabase ?? 0}
            scannedCount={distribution?.scannedCount ?? 0}
          />
        </div>
      </div>

      {/* Search and filters — same card pattern as posts / user ads */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="admin-ads-search" className="text-xs font-medium text-muted-foreground">
                Search
              </label>
              <form onSubmit={(e) => e.preventDefault()} className="block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="admin-ads-search"
                    placeholder="Search by title, location, slot..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-10 bg-input/50 border-border/50"
                  />
                </div>
              </form>
            </div>
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="admin-ads-slots" className="text-xs font-medium text-muted-foreground">
                Slots
              </label>
              <select
                id="admin-ads-slots"
                value={slotFillFilter}
                onChange={(e) => setSlotFillFilter(parseSlotFillFilter(e.target.value))}
                className="w-full h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All</option>
                <option value="fill">Filled</option>
                <option value="unfill">Unfilled</option>
              </select>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="pt-4 border-t border-border/30 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-950/50 to-emerald-900/30 border-emerald-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-100">
            <HeaderIcon className="h-5 w-5 text-emerald-400" />
            Ad Slots
          </CardTitle>
          <p className="text-sm text-emerald-300/70">
            Click a filled slot to open the detail page. Click an empty slot to add a new ad.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(36)].map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-xl overflow-hidden border border-border/40 bg-card/30"
                >
                  <Skeleton className="aspect-[3/4] w-full shrink-0 rounded-none" />
                  <div className="p-2 space-y-2 border-t border-border/30">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(() => {
                const cells: { key: string; displaySlot: AdSlot; subIndex: number; ad: SponsorAd | null; canAdd: boolean }[] = [];
                for (const displaySlot of AD_SLOTS) {
                  const storedSlot = displaySlot - 1;
                  const ads = (adminAdsBySlot.get(storedSlot) || [])
                    .slice()
                    .sort((a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime());
                  const maxUsage = getSlotMaxUsage(displaySlot);
                  const isMultiUse = (MULTI_USE_SLOTS as readonly number[]).includes(displaySlot);

                  if (isMultiUse) {
                    for (let i = 0; i < 3; i++) {
                      cells.push({
                        key: `${displaySlot}-${i}`,
                        displaySlot,
                        subIndex: i,
                        ad: ads[i] || null,
                        canAdd: ads.length < maxUsage,
                      });
                    }
                  } else {
                    cells.push({
                      key: `${displaySlot}`,
                      displaySlot,
                      subIndex: 0,
                      ad: ads[0] || null,
                      canAdd: ads.length < maxUsage,
                    });
                  }
                }
                const visibleCells = cells.filter(({ ad }) => {
                  if (slotFillFilter === "fill") return ad != null;
                  if (slotFillFilter === "unfill") return ad == null;
                  return true;
                });
                if (visibleCells.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground px-4">
                      <Megaphone className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm font-medium text-foreground/80">No slots match this view</p>
                      <p className="text-xs mt-1 max-w-sm">
                        {slotFillFilter === "fill"
                          ? "Every slot currently has no ad, or try another tab (Home / Event / Exchange)."
                          : "There are no empty slots left, or try switching to Filled / All."}
                      </p>
                    </div>
                  );
                }
                return visibleCells.map(({ key, displaySlot, subIndex, ad, canAdd }) => {
                  const label = (MULTI_USE_SLOTS as readonly number[]).includes(displaySlot)
                    ? `${displaySlot}-${subIndex + 1}`
                    : `${displaySlot}`;
                  const eng = ad
                    ? adEngagementById[ad.$id] ?? { likes: 0, stamps: 0, reports: 0 }
                    : null;
                  const cellMatches = adMatchesFilters(ad, label);
                  const filteredOut = Boolean(ad && !cellMatches);
                  const interactive = (!!ad && cellMatches) || (!ad && canAdd);
                  return (
                    <div
                      key={key}
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : -1}
                      aria-disabled={!interactive}
                      onClick={() => {
                        if (filteredOut) return;
                        if (ad) goToAdDetail(ad);
                        else if (canAdd) handleClickEmptySlot(displaySlot);
                      }}
                      onKeyDown={(e) => {
                        if (!interactive) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (filteredOut) return;
                          if (ad) goToAdDetail(ad);
                          else if (canAdd) handleClickEmptySlot(displaySlot);
                        }
                      }}
                      className={
                        ad
                          ? `flex flex-col rounded-xl overflow-hidden border bg-card/50 transition-all group ${
                              filteredOut
                                ? "opacity-[0.28] grayscale border-border/30 cursor-default pointer-events-none"
                                : ad.isBlacklisted
                                  ? "border-red-500/50 bg-red-950/10 hover:border-red-500/70 hover:shadow-lg hover:scale-[1.01] hover:z-10 cursor-pointer"
                                  : "border-border/50 hover:border-primary/30 hover:shadow-lg hover:scale-[1.01] hover:z-10 cursor-pointer"
                            }`
                          : `flex flex-col rounded-xl overflow-hidden border transition-all ${
                              canAdd
                                ? "border-dashed border-amber-500/40 bg-amber-500/[0.07] cursor-pointer hover:border-amber-400/60 hover:bg-amber-500/15 hover:shadow-md hover:scale-[1.01] hover:z-10"
                                : "border-border/30 bg-muted/15 opacity-60 cursor-not-allowed"
                            }`
                      }
                    >
                      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-secondary/30">
                      {ad ? (
                        <>
                          {(() => {
                            const mediaItems = ad.media || [];
                            const firstVideoMedia = mediaItems.find((item) => isVideoUrl(item)) || "";
                            const firstImageMedia = mediaItems.find((item) => !isVideoUrl(item)) || "";
                            const coverImage = ad.image || firstImageMedia;
                            return (
                              <>
                                {coverImage ? (
                                  <ImageThumbnail
                                    src={getImageUrl(coverImage, 300, 400)}
                                    alt={ad.title || "Ad"}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : firstVideoMedia ? (
                                  <VideoThumbnail src={getVideoUrl(firstVideoMedia)} />
                                ) : (
                                  <div className="w-full h-full bg-secondary/40" />
                                )}
                                {!coverImage && firstVideoMedia && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                    <Play className="h-8 w-8 text-white/80" />
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                            {ad.media?.some((m) => isVideoUrl(m)) && (
                              <div className="px-2 py-1 rounded bg-black/60 text-white text-xs font-medium flex items-center gap-1">
                                <Play className="h-3 w-3 shrink-0" />
                                Video
                              </div>
                            )}
                            {ad.isBlacklisted && (
                              <div className="px-2 py-1 rounded bg-red-600/90 text-white text-xs font-medium flex items-center gap-1">
                                <Ban className="w-3 h-3 shrink-0" />
                                Blocked
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-2 pt-6 pointer-events-none">
                            <div className="flex items-center justify-between text-[11px] text-white/90 tabular-nums">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3 shrink-0" />
                                {(ad.views || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <MousePointer className="h-3 w-3 shrink-0" />
                                {(ad.clicks || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 shrink-0" />
                                {(ad.views || 0) > 0 ? (((ad.clicks || 0) / (ad.views || 1)) * 100).toFixed(1) : "0.0"}%
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                            canAdd ? "text-amber-400/95" : "text-slate-500"
                          }`}
                        >
                          <span className="text-2xl sm:text-3xl font-bold tabular-nums">{label}</span>
                          <span className="text-[10px] opacity-80">{canAdd ? "Empty slot" : "Full"}</span>
                        </div>
                      )}
                      </div>
                      {ad && eng ? (
                        <div className="p-2 space-y-1.5 min-h-0">
                          <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                            {ad.title?.trim() || "Untitled"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            <span className="font-medium text-foreground/70">Slot {label}</span>
                            {ad.city || ad.state
                              ? ` · ${[ad.city, ad.state].filter(Boolean).join(", ")}`
                              : ""}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-0.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex items-center gap-1 shrink-0">
                                <Heart className="h-3.5 w-3.5 shrink-0" />
                                {eng.likes}
                              </span>
                              <span className="flex items-center gap-1 shrink-0">
                                <Users className="h-3.5 w-3.5 shrink-0" />
                                {eng.stamps}
                              </span>
                            </div>
                            <span
                              className={`flex items-center gap-1 shrink-0 ${
                                eng.reports > 0 ? "text-red-500" : "text-muted-foreground"
                              }`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              {eng.reports}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ad Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent
          className="sm:max-w-[600px] max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden top-[5vh] translate-y-0 left-[50%] -translate-x-1/2 bg-card border-border"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.pac-container')) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.pac-container')) e.preventDefault();
          }}
        >
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-2 border-b border-border/50">
            <DialogTitle className="text-xl">Create Ad</DialogTitle>
            <DialogDescription>
              Create a new sponsor advertisement with a specific ad slot.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-contain px-6 py-4 pb-8 touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
          <div className="space-y-5 pb-4">
            <MediaUpload
              value={{ files: createForm.mediaFiles, previews: createForm.mediaPreviews, posters: createForm.posterFiles }}
              onChange={({ files, previews, posters }) =>
                setCreateForm((prev) => ({ ...prev, mediaFiles: files, mediaPreviews: previews, posterFiles: posters }))
              }
              label="Photo/Video"
              placeholder="Tap to upload photos or videos"
              addMoreLabel="Add more photos or videos"
            />

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Ad Title <span className="text-red-500">*</span>
              </Label>
              <Input id="title" placeholder="Enter a catchy title for your ad" value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} className="bg-input/50 border-border/50" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <textarea id="description" placeholder="Describe your product or service (optional)" value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full min-h-[100px] px-3 py-2 rounded-md bg-input/50 border border-border/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="text-sm font-medium">Phone Number</Label>
                <Input id="phoneNumber" type="tel" placeholder="(optional)" value={createForm.phoneNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} className="bg-input/50 border-border/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">Website</Label>
                <Input id="website" type="url" placeholder="https://... (optional)" value={createForm.website} onChange={(e) => setCreateForm((prev) => ({ ...prev, website: e.target.value }))} className="bg-input/50 border-border/50" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Location <span className="text-red-500">*</span></Label>
              <LocationPicker value={createForm.location} onChange={handleCreateLocationChange} placeholder="Search city or address..." showCurrentLocation={true} countryRestriction="us" />
              {createForm.state && createForm.city && (
                <p className="text-xs text-muted-foreground">{createForm.city}, {createForm.state}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category <span className="text-red-500">*</span></Label>
                <select id="category" value={createForm.category} onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))} className="w-full h-9 px-3 rounded-md bg-input/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="">Select category</option>
                  {dynamicCategories.map((cat) => (<option key={cat.value} value={cat.value}>{cat.name}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategory" className="text-sm font-medium">Subcategory</Label>
                <select id="subcategory" value={createForm.subcategory} onChange={(e) => setCreateForm((prev) => ({ ...prev, subcategory: e.target.value }))} disabled={!createForm.category} className="w-full h-9 px-3 rounded-md bg-input/50 border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50">
                  <option value="">Select subcategory</option>
                  {createSubcategories.map((sub) => (<option key={sub.value} value={sub.value}>{sub.name}</option>))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Ad Slot <span className="text-red-500">*</span></Label>
              {createForm.slot ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">{createForm.slot}</div>
                  <div>
                    <p className="font-medium">Slot #{createForm.slot}</p>
                    <p className="text-sm text-muted-foreground">
                      {(MULTI_USE_SLOTS as readonly number[]).includes(createForm.slot) ? `Multi-use slot (up to 3 ads)` : `Single-use slot`}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Please select a slot from the slot table first.</p>
              )}
            </div>
          </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t border-border/50 px-6 py-4 bg-card">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating} className="bg-secondary/50 border-border/50">Cancel</Button>
            <Button onClick={handleCreateAd} disabled={creating || !createForm.title || !createForm.state || !createForm.city || !createForm.category || !createForm.slot || createForm.mediaFiles.length === 0}>
              {creating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>) : (<><Plus className="h-4 w-4 mr-2" />Create Ad</>)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
