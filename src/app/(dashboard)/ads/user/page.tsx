"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getSponsorAds,
  getSponsorAdsFieldDistribution,
  getAdMetrics,
  getAdsLikeCounts,
  getAdsReportCounts,
  getPostStampsByPostIds,
  type FieldDistributionResult,
  SponsorAd,
  SponsorAdStatus,
} from "@/lib/user-actions";
import { ListDistributionPieChart } from "@/components/posts/list-distribution-pie";
import { SPONSOR_ADS_BUCKET_ID, isVideoUrl } from "@/lib/appwrite";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { getCategories, getSubcategories, Category } from "@/lib/category-actions";
import { getStateFullName } from "@/lib/utils";
import LocationPicker, { PlaceValue } from "@/components/ui/location-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  Megaphone,
  MousePointer,
  Play,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";

interface AdWithStats extends SponsorAd {
  computedLikeCount: number;
  computedStampCount: number;
  computedReportCount: number;
}

function getSponsorAdStorageUrl(
  fileIdOrUrl: string,
  mode: "preview" | "view",
  width?: number,
  height?: number
): string {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;

  const buildUrl = (fileId: string) => {
    const url = new URL(
      `${endpoint}/storage/buckets/${SPONSOR_ADS_BUCKET_ID}/files/${fileId}/${mode}?project=${projectId}`
    );

    if (mode === "preview" && width) {
      url.searchParams.set("width", String(width));
    }
    if (mode === "preview" && height) {
      url.searchParams.set("height", String(height));
    }

    return url.toString();
  };

  if (!fileIdOrUrl) {
    return "";
  }

  if (!fileIdOrUrl.startsWith("http://") && !fileIdOrUrl.startsWith("https://")) {
    return buildUrl(fileIdOrUrl);
  }

  try {
    const url = new URL(fileIdOrUrl);
    const matched = url.pathname.match(/\/storage\/buckets\/[^/]+\/files\/([^/]+)\/(view|preview)$/);

    if (!matched) {
      return fileIdOrUrl;
    }

    return buildUrl(matched[1]);
  } catch {
    return fileIdOrUrl;
  }
}

function getSponsorAdPreviewUrl(fileIdOrUrl: string, width?: number, height?: number): string {
  return getSponsorAdStorageUrl(fileIdOrUrl, "preview", width, height);
}

function getSponsorAdVideoUrl(fileIdOrUrl: string): string {
  return getSponsorAdStorageUrl(fileIdOrUrl, "view");
}

export default function UserAdsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<AdWithStats[]>([]);
  const [metrics, setMetrics] = useState({ totalViews: 0, totalClicks: 0, ctr: 0 });
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<"all" | SponsorAdStatus>(() => (searchParams.get("status") as "all" | SponsorAdStatus) || "all");

  // Filter state
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") || "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") || "");
  const [selectedLocation, setSelectedLocation] = useState<PlaceValue | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category") || "");
  const [subcategoryFilter, setSubcategoryFilter] = useState(() => searchParams.get("subcategory") || "");

  // Dynamic categories
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [filterSubcategoriesList, setFilterSubcategoriesList] = useState<Category[]>([]);
  const [distribution, setDistribution] = useState<FieldDistributionResult | null>(null);

  const fetchDistribution = useCallback(() => {
    void getSponsorAdsFieldDistribution({
      isAdminCreated: false,
      field: "category",
    }).then(setDistribution);
  }, []);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const tParallel = performance.now();
      const [result, metricsData] = await Promise.all([
        getSponsorAds({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter,
          state: stateFilter || undefined,
          city: cityFilter || undefined,
          category: categoryFilter || undefined,
          subcategory: subcategoryFilter || undefined,
          isAdminCreated: false,
        }),
        getAdMetrics(false),
      ]);
      console.log(`[ads/user] parallel fetch (ads + metrics): ${(performance.now() - tParallel).toFixed(0)}ms`);

      const tLikes = performance.now();
      const adIds = result.ads.map((ad) => ad.$id);
      const [likeCounts, stampsMap, reportsMap] = await Promise.all([
        getAdsLikeCounts(adIds),
        getPostStampsByPostIds(adIds),
        getAdsReportCounts(adIds),
      ]);
      console.log(
        `[ads/user] engagement batch (${adIds.length} ads): ${(performance.now() - tLikes).toFixed(0)}ms`
      );

      const adsWithStats: AdWithStats[] = result.ads.map((ad) => ({
        ...ad,
        computedLikeCount: likeCounts.get(ad.$id) || 0,
        computedStampCount: stampsMap.get(ad.$id) || 0,
        computedReportCount: reportsMap.get(ad.$id) || 0,
      }));

      setAds(adsWithStats);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
      console.log(`[ads/user] total fetchAds: ${(performance.now() - t0).toFixed(0)}ms`);
    }
  }, [page, search, statusFilter, stateFilter, cityFilter, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  useEffect(() => {
    fetchAds();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchAds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, stateFilter, cityFilter, categoryFilter, subcategoryFilter]);

  // Sync filter state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (stateFilter) params.set("state", stateFilter);
    if (cityFilter) params.set("city", cityFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (subcategoryFilter) params.set("subcategory", subcategoryFilter);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "/ads/user", { scroll: false });
  }, [search, statusFilter, stateFilter, cityFilter, categoryFilter, subcategoryFilter, page, router]);

  // Load categories on mount
  useEffect(() => {
    getCategories().then(setDynamicCategories);
  }, []);

  // Handle location change
  const handleLocationChange = (location: PlaceValue | null) => {
    setSelectedLocation(location);
    if (location?.state) {
      const stateFullName = getStateFullName(location.state);
      setStateFilter(stateFullName);
      setCityFilter(location.city || "");
    } else {
      setStateFilter("");
      setCityFilter("");
    }
  };

  // Reset subcategory filter and fetch subcategories when category filter changes
  useEffect(() => {
    setSubcategoryFilter("");
    if (categoryFilter) {
      getSubcategories(categoryFilter).then(setFilterSubcategoriesList);
    } else {
      setFilterSubcategoriesList([]);
    }
  }, [categoryFilter]);

  // Count active filters
  const activeFilterCount = [stateFilter, cityFilter, categoryFilter, subcategoryFilter].filter(Boolean).length;

  // Clear all filters
  const clearFilters = () => {
    setSelectedLocation(null);
    setStateFilter("");
    setCityFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
  };

  const getStatusColor = (status: SponsorAdStatus) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-500";
      case "expired":
        return "bg-gray-500/20 text-gray-400";
      case "rejected":
        return "bg-red-500/20 text-red-500";
      default:
        return "bg-secondary text-muted-foreground";
    }
  };

  const getStatusIcon = (status: SponsorAdStatus) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-3 h-3" />;
      case "pending":
        return <Clock className="w-3 h-3" />;
      case "expired":
        return <XCircle className="w-3 h-3" />;
      case "rejected":
        return <Ban className="w-3 h-3" />;
      default:
        return null;
    }
  };

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
      {/* Header */}
      <PageHeader
        title="User Ads"
        description="Ads created by premium users (members)"
        icon={Megaphone}
        children={
          <Button
            variant="outline"
            onClick={() => {
              void fetchAds();
              fetchDistribution();
            }}
            className="bg-secondary/50 border-border/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Stats: left 2×2, right tall pie (same pattern as admin ads) */}
      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Megaphone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total User Ads</p>
                  <p className="text-2xl font-bold">{total.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold">{metrics.ctr.toFixed(1)}%</p>
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
                  <p className="text-2xl font-bold">{metrics.totalViews.toLocaleString()}</p>
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
                  <p className="text-2xl font-bold">{metrics.totalClicks.toLocaleString()}</p>
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

      {/* Ads List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            User Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <form onSubmit={(e) => { e.preventDefault(); fetchAds(); }} className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ads by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-input/50 border-border/50"
              />
            </form>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | SponsorAdStatus)}
                className="h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Filters - always visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 rounded-lg bg-secondary/20 border border-border/30">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <LocationPicker
                  value={selectedLocation}
                  onChange={handleLocationChange}
                  placeholder="Search city or address..."
                  countryRestriction="us"
                  showCurrentLocation={false}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm"
                >
                  <option value="">All Categories</option>
                  {dynamicCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
                <select
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  disabled={!categoryFilter}
                  className="w-full h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm disabled:opacity-50"
                >
                  <option value="">All Subcategories</option>
                  {filterSubcategoriesList.map((sub) => (
                    <option key={sub.value} value={sub.value}>{sub.name}</option>
                  ))}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
          </div>

          {/* Ads Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
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
          ) : ads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mb-4 opacity-50" />
              <p>No user ads found</p>
              {(search || activeFilterCount > 0) && (
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {ads.map((ad) => {
                  const mediaItems = ad.media || [];
                  const firstVideoMedia = mediaItems.find((item) => isVideoUrl(item)) || "";
                  const firstImageMedia = mediaItems.find((item) => !isVideoUrl(item)) || "";
                  const coverImage = ad.image || firstImageMedia;
                  const views = ad.views || 0;
                  const clicks = ad.clicks || 0;
                  const ctrPct = views > 0 ? (clicks / views) * 100 : 0;
                  const slotLabel =
                    ad.slot !== undefined && ad.slot !== null ? String(ad.slot + 1) : null;

                  return (
                    <div
                      key={ad.$id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/ads/${ad.$id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/ads/${ad.$id}`);
                        }
                      }}
                      className={`flex flex-col rounded-xl overflow-hidden border bg-card/50 transition-all group outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        ad.isBlacklisted
                          ? "border-red-500/50 bg-red-950/10 hover:border-red-500/70 cursor-pointer hover:shadow-lg hover:scale-[1.01] hover:z-10"
                          : "border-border/50 hover:border-primary/30 cursor-pointer hover:shadow-lg hover:scale-[1.01] hover:z-10"
                      }`}
                    >
                      <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden bg-secondary/30">
                        {coverImage ? (
                          <ImageThumbnail
                            src={getSponsorAdPreviewUrl(coverImage, 400, 533)}
                            alt={ad.title || "Ad"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : firstVideoMedia ? (
                          <VideoThumbnail
                            src={getSponsorAdVideoUrl(firstVideoMedia)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-secondary/40 flex items-center justify-center">
                            <Megaphone className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        {!coverImage && firstVideoMedia && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                            <Play className="h-10 w-10 text-white/80" />
                          </div>
                        )}

                        <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium flex items-center gap-1 shadow">
                          <Megaphone className="w-3 h-3 shrink-0 opacity-90" />
                          Ad
                        </div>

                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10 max-w-[min(100%,11rem)]">
                          <div
                            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 shadow-sm ${getStatusColor(ad.status)}`}
                          >
                            {getStatusIcon(ad.status)}
                            <span className="truncate capitalize">{ad.status}</span>
                          </div>
                          {ad.media?.some((m) => isVideoUrl(m)) && (
                            <div className="px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium flex items-center gap-1">
                              <Play className="h-3 w-3 shrink-0" />
                              Video
                            </div>
                          )}
                          {ad.isBlacklisted && (
                            <div className="px-2 py-1 rounded-md bg-red-600/90 text-white text-xs font-medium flex items-center gap-1">
                              <Ban className="w-3 h-3 shrink-0" />
                              Blocked
                            </div>
                          )}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-2 pt-6 pointer-events-none">
                          <div className="flex items-center justify-between text-[11px] text-white/90 tabular-nums">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3 shrink-0" />
                              {views.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MousePointer className="h-3 w-3 shrink-0" />
                              {clicks.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 shrink-0" />
                              {ctrPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 space-y-1.5 min-h-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                          {ad.title?.trim() || "Untitled"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {slotLabel ? (
                            <span className="font-medium text-foreground/70">Slot {slotLabel}</span>
                          ) : (
                            <span className="font-medium text-foreground/70">Member ad</span>
                          )}
                          {ad.city || ad.state
                            ? ` · ${[ad.city, ad.state].filter(Boolean).join(", ")}`
                            : ""}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums pt-0.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex items-center gap-1 shrink-0">
                              <Heart className="h-3.5 w-3.5 shrink-0" />
                              {ad.computedLikeCount}
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              {ad.computedStampCount}
                            </span>
                          </div>
                          <span
                            className={`flex items-center gap-1 shrink-0 ${
                              ad.computedReportCount > 0 ? "text-red-500" : "text-muted-foreground"
                            }`}
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {ad.computedReportCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="bg-secondary/50 border-border/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} ads)
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="bg-secondary/50 border-border/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
