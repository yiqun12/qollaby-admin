"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import LocationPicker, { PlaceValue } from "@/components/ui/location-picker";
import { PageHeader } from "@/components/ui/page-header";
import { RadiusSelector } from "@/components/ui/radius-selector";
import { getImageUrl, getVideoUrl, isVideoUrl } from "@/lib/appwrite";
import { calculateDistance, formatDistance, RadiusOption } from "@/lib/geo-utils";
import {
  getPosts,
  getExchangeListings,
  getPostsAdminDashboardMetrics,
  getExchangeAdminDashboardMetrics,
  type ContentAdminDashboardMetrics,
  Post,
  ExchangeListing,
  PostListResult,
  ExchangeListingListResult,
} from "@/lib/user-actions";
import { fetchPostStatsApi } from "@/lib/post-stats-client";
import { ListDistributionPieChart } from "@/components/posts/list-distribution-pie";
import { getCategories, getSubcategories, Category } from "@/lib/category-actions";
import { getStateFullName } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Heart,
  MousePointer,
  Play,
  RefreshCw,
  Repeat,
  Search,
  ShoppingBag,
  TimerOff,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Combined type for Post and ExchangeListing display
type PostOrExchange = Post | ExchangeListing;

// Extended post type with computed stats and distance
type ItemWithStats = PostOrExchange & {
  computedLikeCount: number;
  computedReportCount: number;
  computedStampCount: number;
  computedDistance?: number; // Distance in km from search center
};

export type PostsAdminLockedType = "post" | "event" | "exchange";

export function PostsAdminList({ lockedType }: { lockedType: PostsAdminLockedType }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemWithStats[]>([]);
  const [dashboardMetrics, setDashboardMetrics] =
    useState<ContentAdminDashboardMetrics | null>(null);
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  
  // Location filters
  const [stateFilter, setStateFilter] = useState(() => searchParams.get("state") || "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") || "");
  
  // Location picker
  const [selectedLocation, setSelectedLocation] = useState<PlaceValue | null>(null);
  
  // Radius filter for distance-based search
  const [searchRadius, setSearchRadius] = useState<RadiusOption>(() => (Number(searchParams.get("radius")) || 0) as RadiusOption);
  
  // Category filters
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get("category") || "");
  const [subcategoryFilter, setSubcategoryFilter] = useState(() => searchParams.get("subcategory") || "");
  
  // Dynamic categories
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<Category[]>([]);
  
  // Filters are always shown

  const listBasePath =
    lockedType === "post"
      ? "/posts/feed"
      : lockedType === "event"
        ? "/posts/events"
        : "/posts/exchange";

  const fetchDashboardMetrics = useCallback(() => {
    void (lockedType === "exchange"
      ? getExchangeAdminDashboardMetrics()
      : getPostsAdminDashboardMetrics(lockedType)
    ).then(setDashboardMetrics);
  }, [lockedType]);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  const fetchItems = useCallback(async () => {
    console.log("[PostsPage] fetchItems called with filters:", {
      page,
      lockedType,
      stateFilter,
      cityFilter,
      categoryFilter,
      subcategoryFilter,
      search,
    });
    setLoading(true);
    try {
      let itemsData: PostOrExchange[] = [];
      let totalCount = 0;
      let totalPagesCount = 1;

      if (lockedType === "exchange") {
        // Fetch from exchange_listings table
        console.log("[PostsPage] Fetching exchange listings...");
        const result: ExchangeListingListResult = await getExchangeListings({
          page,
          limit: 20,
          search: search || undefined,
          state: stateFilter || undefined,
          city: cityFilter || undefined,
          category: categoryFilter || undefined,
          subcategory: subcategoryFilter || undefined,
        });
        console.log("[PostsPage] Exchange listings result:", {
          total: result.total,
          listingsCount: result.listings.length,
        });
        itemsData = result.listings;
        totalCount = result.total;
        totalPagesCount = result.totalPages;
      } else {
        // Fetch from posts table (post/event types)
        console.log("[PostsPage] Fetching posts with params:", {
          page,
          type: lockedType,
          state: stateFilter || undefined,
          city: cityFilter || undefined,
          category: categoryFilter || undefined,
          subcategory: subcategoryFilter || undefined,
        });
        const result: PostListResult = await getPosts({
          page,
          limit: 20,
          search: search || undefined,
          type: lockedType,
          state: stateFilter || undefined,
          city: cityFilter || undefined,
          category: categoryFilter || undefined,
          subcategory: subcategoryFilter || undefined,
        });
        console.log("[PostsPage] Posts result:", {
          total: result.total,
          postsCount: result.posts.length,
          firstPost: result.posts[0] ? {
            id: result.posts[0].$id,
            title: result.posts[0].title,
            // Check if these fields exist in the actual data
            locationState: (result.posts[0] as any).locationState,
            locationCity: (result.posts[0] as any).locationCity,
            locationAddress: result.posts[0].locationAddress,
          } : null,
        });
        itemsData = result.posts;
        totalCount = result.total;
        totalPagesCount = result.totalPages;
      }

      // Like/stamp/report: App 端 post_likes / post_stamps 的 postId 既是普通帖 id，也是 exchange_listings 的 $id
      const itemIds = itemsData.map((p) => p.$id);
      let likeCounts: Record<string, number> = {};
      let reportCounts: Record<string, number> = {};
      let stampCounts: Record<string, number> = {};

      if (itemIds.length > 0) {
        const stats = await fetchPostStatsApi({ postIds: itemIds });
        likeCounts = stats.likes;
        stampCounts = stats.stamps;
        reportCounts = stats.reportCounts;
      }

      // Merge stats into items
      const itemsWithStats: ItemWithStats[] = itemsData.map((item) => ({
        ...item,
        computedLikeCount: likeCounts[item.$id] ?? 0,
        computedReportCount: reportCounts[item.$id] ?? 0,
        computedStampCount: stampCounts[item.$id] ?? 0,
      }));

      setItems(itemsWithStats);
      setTotalPages(totalPagesCount);
      setTotal(totalCount);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, lockedType, stateFilter, cityFilter, categoryFilter, subcategoryFilter]);

  useEffect(() => {
    fetchItems();
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, lockedType, stateFilter, cityFilter, categoryFilter, subcategoryFilter]);

  // Sync filter state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("type", lockedType);
    if (stateFilter) params.set("state", stateFilter);
    if (cityFilter) params.set("city", cityFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (subcategoryFilter) params.set("subcategory", subcategoryFilter);
    if (searchRadius > 0) params.set("radius", String(searchRadius));
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${listBasePath}?${qs}` : listBasePath, { scroll: false });
  }, [
    search,
    lockedType,
    stateFilter,
    cityFilter,
    categoryFilter,
    subcategoryFilter,
    searchRadius,
    page,
    router,
    listBasePath,
  ]);

  useEffect(() => {
    getCategories().then(setDynamicCategories);
  }, []);

  // Reset subcategory and fetch subcategories when category changes
  useEffect(() => {
    setSubcategoryFilter("");
    if (categoryFilter) {
      getSubcategories(categoryFilter).then(setSubcategoriesList);
    } else {
      setSubcategoriesList([]);
    }
  }, [categoryFilter]);

  // Count active filters (include radius if set)
  const activeFilterCount = [stateFilter, cityFilter, categoryFilter, subcategoryFilter].filter(Boolean).length + (searchRadius > 0 ? 1 : 0);

  // Filter items by distance if a location and radius are selected
  const filteredItems = useMemo(() => {
    // If no location or radius is 0 (any distance), return all items
    if (!selectedLocation || searchRadius === 0) {
      return items;
    }

    const { latitude: centerLat, longitude: centerLng } = selectedLocation;

    return items
      .map((item) => {
        // Get location from post - stored as [longitude, latitude]
        const postLocation = (item as Post).location;
        
        if (!postLocation || postLocation.length !== 2) {
          // No location data, set distance to Infinity so it gets filtered out
          return { ...item, computedDistance: Infinity };
        }

        const [lng, lat] = postLocation;
        const distance = calculateDistance(centerLat, centerLng, lat, lng);
        
        return { ...item, computedDistance: distance };
      })
      .filter((item) => item.computedDistance <= searchRadius)
      .sort((a, b) => (a.computedDistance ?? Infinity) - (b.computedDistance ?? Infinity));
  }, [items, selectedLocation, searchRadius]);

  // Clear all filters
  const clearFilters = () => {
    setStateFilter("");
    setCityFilter("");
    setCategoryFilter("");
    setSubcategoryFilter("");
    setSelectedLocation(null);
    setSearchRadius(0);
  };

  // Handle location change - auto apply filter
  const handleLocationChange = (location: PlaceValue | null) => {
    console.log("[PostsPage] handleLocationChange called with:", {
      location,
      state: location?.state,
      city: location?.city,
      address: location?.address,
    });
    setSelectedLocation(location);
    if (location?.state) {
      // Convert state abbreviation (e.g., "CA") to full name (e.g., "California")
      // because the database stores full state names
      const stateFullName = getStateFullName(location.state);
      console.log("[PostsPage] Setting filters - state:", location.state, "->", stateFullName, "city:", location.city || "");
      setStateFilter(stateFullName);
      setCityFilter(location.city || "");
    } else {
      console.log("[PostsPage] Clearing location filters");
      setStateFilter("");
      setCityFilter("");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const viewClickPieRows = useMemo(() => {
    const v = dashboardMetrics?.sampleViewsSum ?? 0;
    const c = dashboardMetrics?.sampleClicksSum ?? 0;
    return [
      { label: "Views", count: v },
      { label: "Clicks", count: c },
    ];
  }, [dashboardMetrics]);

  const sampleCtr = useMemo(() => {
    const v = dashboardMetrics?.sampleViewsSum ?? 0;
    if (v <= 0) return 0;
    return ((dashboardMetrics?.sampleClicksSum ?? 0) / v) * 100;
  }, [dashboardMetrics]);

  const totalLabel =
    lockedType === "exchange"
      ? "Total Listings"
      : lockedType === "event"
        ? "Total Events"
        : "Total Posts";
  const activeLabel =
    lockedType === "exchange"
      ? "Active Listings"
      : lockedType === "event"
        ? "Active Events"
        : "Active Posts";
  const TotalIcon = lockedType === "exchange" ? Repeat : lockedType === "event" ? Calendar : FileText;

  const pageTitle =
    lockedType === "event"
      ? "Events"
      : lockedType === "exchange"
        ? "Exchange"
        : "Posts";
  const pageDescription =
    lockedType === "exchange"
      ? "Browse exchange listings, performance, and admin notes"
      : lockedType === "event"
        ? "Browse event posts, performance, and admin notes"
        : "Browse posts, performance, and admin notes";
  const HeaderIcon =
    lockedType === "event" ? Calendar : lockedType === "exchange" ? Repeat : FileText;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        icon={HeaderIcon}
        children={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchItems();
              fetchDashboardMetrics();
            }}
            className="w-fit"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Dashboard metrics — rows 1–2 match Admin Ads; row 3 is exchange status totals */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <TotalIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{totalLabel}</p>
                <p className="text-2xl font-bold">
                  {dashboardMetrics?.totalInDatabase?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{activeLabel}</p>
                <p className="text-2xl font-bold">
                  {dashboardMetrics?.activeInDatabase?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <ListDistributionPieChart
          title="Clicks vs views (recent sample)"
          rows={viewClickPieRows}
          totalInDatabase={dashboardMetrics?.totalInDatabase ?? 0}
          scannedCount={dashboardMetrics?.scannedCount ?? 0}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">
                  {(dashboardMetrics?.sampleViewsSum ?? 0).toLocaleString()}
                </p>
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
                <p className="text-2xl font-bold">
                  {(dashboardMetrics?.sampleClicksSum ?? 0).toLocaleString()}
                </p>
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
                <p className="text-2xl font-bold">{sampleCtr.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lockedType === "exchange" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">
                    {dashboardMetrics?.exchangeStatusCounts != null
                      ? dashboardMetrics.exchangeStatusCounts.active.toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-zinc-500/15">
                  <TimerOff className="h-6 w-6 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Expired{" "}
                    <span className="text-muted-foreground/70 font-normal">(incl. auction)</span>
                  </p>
                  <p className="text-2xl font-bold">
                    {dashboardMetrics?.exchangeStatusCounts != null
                      ? dashboardMetrics.exchangeStatusCounts.expired.toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-sky-500/10">
                  <ShoppingBag className="h-6 w-6 text-sky-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sold</p>
                  <p className="text-2xl font-bold">
                    {dashboardMetrics?.exchangeStatusCounts != null
                      ? dashboardMetrics.exchangeStatusCounts.sold.toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Search and Filters */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-input/50 border-border/50"
                />
              </div>
            </form>
          </div>

          {/* Filters panel - always visible */}
          <div className="pt-4 border-t border-border/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Location filter - inline picker */}
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

                {/* Radius filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Search Radius</label>
                  <RadiusSelector
                    value={searchRadius}
                    onChange={setSearchRadius}
                    disabled={!selectedLocation}
                  />
                  {!selectedLocation && searchRadius === 0 && (
                    <p className="text-xs text-muted-foreground/70">Select a location first</p>
                  )}
                </div>

                {/* Category filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">All Categories</option>
                    {dynamicCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Subcategory</label>
                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    disabled={!categoryFilter}
                    className="w-full h-9 px-3 rounded-md border border-border/50 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Subcategories</option>
                    {subcategoriesList.map((sub) => (
                      <option key={sub.value} value={sub.value}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Clear filters button */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <Button
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
          </div>
        </CardContent>
      </Card>

      {/* Posts grid */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[3/4] rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>
                {searchRadius > 0 && selectedLocation
                  ? `No ${lockedType === "exchange" ? "exchange listings" : "posts"} found within ${searchRadius} miles`
                  : `No ${lockedType === "exchange" ? "exchange listings" : "posts"} found`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredItems.map((item) => (
                <PostCard
                  key={item.$id}
                  post={item}
                  onClick={() =>
                    router.push(
                      lockedType === "exchange"
                        ? `/posts/${item.$id}?type=exchange`
                        : `/posts/${item.$id}?from=${lockedType}`
                    )
                  }
                  showDistance={searchRadius > 0 && selectedLocation !== null}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/30">
              <p className="text-sm text-muted-foreground">
                {searchRadius > 0 && selectedLocation
                  ? `${filteredItems.length} of ${total} posts within ${searchRadius} mi`
                  : `${total} posts total`}
                , page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="bg-secondary/50 border-border/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
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
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

interface PostCardProps {
  post: ItemWithStats;
  onClick: () => void;
  showDistance?: boolean;
}

function PostCard({ post, onClick, showDistance = false }: PostCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const views = Number((post as PostOrExchange).views) || 0;
  const clicks = Number((post as PostOrExchange).clicks) || 0;
  const ctrPct = views > 0 ? (clicks / views) * 100 : 0;

  // Use `media` field (correct field name from database)
  const firstMedia = post.media?.[0] || null;
  const isVideo = firstMedia ? isVideoUrl(firstMedia) : false;

  // Get the appropriate URL
  const mediaUrl = firstMedia
    ? isVideo
      ? getVideoUrl(firstMedia)
      : getImageUrl(firstMedia, 400, 533)
    : null;

  // Handle hover for video preview
  useEffect(() => {
    if (!videoRef.current || !isVideo) return;

    if (isHovering) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, isVideo]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`group cursor-pointer rounded-xl overflow-hidden border bg-card/50 hover:shadow-lg transition-all hover:scale-[1.01] hover:z-10 ${
        post.isBlacklisted
          ? "border-red-500/50 bg-red-950/10 hover:border-red-500/70"
          : "border-border/50 hover:border-primary/30"
      }`}
    >
      <div className="relative aspect-[3/4] bg-secondary/30 overflow-hidden">
        {mediaUrl ? (
          isVideo ? (
            <>
              <video
                ref={videoRef}
                src={mediaUrl}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
              />
              <div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium flex items-center gap-1 z-10">
                <Play className="w-3 h-3" />
                Video
              </div>
              {!isHovering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <ImageThumbnail
              src={mediaUrl}
              alt={post.title || "Post"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}

        {/* Type label — top-left, same family as admin ad slot pill */}
        {post.type === "event" && (
          <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium flex items-center gap-1 shadow">
            <Calendar className="w-3 h-3" />
            Event
          </div>
        )}
        {post.type === "exchange" && (
          <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-md bg-black/70 text-white text-xs font-medium flex items-center gap-1 shadow">
            <Repeat className="w-3 h-3" />
            Exchange
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
          {post.isBlacklisted && (
            <div className="px-2 py-1 rounded bg-red-600/90 text-white text-xs font-medium flex items-center gap-1">
              <Ban className="w-3 h-3" />
              Blocked
            </div>
          )}
        </div>

        {/* Bottom metrics — match admin ad slots strip */}
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

      <div className="p-2 space-y-1.5">
        <p className="text-sm font-medium truncate">{post.title || "Untitled"}</p>

        {/* Fig.3 style row: likes + stamps left, reports right (always show reports) */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {post.computedLikeCount}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {post.computedStampCount}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {showDistance &&
              post.computedDistance !== undefined &&
              post.computedDistance !== Infinity && (
                <span className="flex items-center gap-0.5 text-primary font-medium">
                  📍 {formatDistance(post.computedDistance)}
                </span>
              )}
            <span
              className={`flex items-center gap-1 tabular-nums ${
                post.computedReportCount > 0 ? "text-red-500" : "text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {post.computedReportCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
