"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSponsorAds,
  getSponsorAdStats,
  getAdsLikeCounts,
  SponsorAd,
  SponsorAdListResult,
  SponsorAdStatus,
} from "@/lib/user-actions";
import { getImageUrl, getVideoUrl, isVideoUrl } from "@/lib/appwrite";
import { getCategoryLabel, getSubCategoryLabel } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Heart,
  Eye,
  MousePointer,
  Ban,
  Play,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";

interface AdWithStats extends SponsorAd {
  computedLikeCount: number;
}

export default function AdsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<AdWithStats[]>([]);
  const [stats, setStats] = useState({ totalAds: 0, activeAds: 0, pendingAds: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SponsorAdStatus>("all");

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const [result, statsData] = await Promise.all([
        getSponsorAds({
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter,
        }),
        getSponsorAdStats(),
      ]);

      // Fetch like counts for all ads
      const adIds = result.ads.map((ad) => ad.$id);
      const likeCounts = await getAdsLikeCounts(adIds);

      // Merge stats into ads
      const adsWithStats: AdWithStats[] = result.ads.map((ad) => ({
        ...ad,
        computedLikeCount: likeCounts.get(ad.$id) || 0,
      }));

      setAds(adsWithStats);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setStats(statsData);
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchAds();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [fetchAds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAds();
  };

  const getStatusColor = (status: SponsorAdStatus) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-500";
      case "pending":
        return "bg-yellow-500/20 text-yellow-600";
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sponsor Ads</h1>
          <p className="text-muted-foreground mt-1">Manage all sponsor advertisements</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAds}
          className="bg-secondary/50 border-border/50"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Ads</p>
                <p className="text-2xl font-bold">{stats.activeAds}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Clock className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{stats.pendingAds}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ads by title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-input/50 border-border/50"
                />
              </div>
            </form>
            {/* Status Filter */}
            <div className="flex gap-2">
              {(["all", "active", "pending", "expired", "rejected"] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                  className={
                    statusFilter === status
                      ? ""
                      : "bg-secondary/30 border-border/50"
                  }
                >
                  {status === "all" ? (
                    <Megaphone className="h-4 w-4 mr-1" />
                  ) : (
                    getStatusIcon(status)
                  )}
                  <span className="ml-1">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ads Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : ads.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-16 text-center">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No ads found</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {ads.map((ad) => (
              <AdCard
                key={ad.$id}
                ad={ad}
                onClick={() => router.push(`/ads/${ad.$id}`)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {total} ads total, page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="bg-secondary/50 border-border/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="bg-secondary/50 border-border/50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AdCard({ ad, onClick }: { ad: AdWithStats; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Get the first media item
  const firstMedia = ad.media?.[0] || ad.image || "";
  const isVideo = isVideoUrl(firstMedia);
  const mediaUrl = isVideo ? getVideoUrl(firstMedia) : getImageUrl(firstMedia, 400, 400);

  // Auto-play video on hover
  useEffect(() => {
    if (videoRef.current && isVideo) {
      if (isHovering) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isHovering, isVideo]);

  const getStatusColor = (status: SponsorAdStatus) => {
    switch (status) {
      case "active":
        return "bg-green-500/90";
      case "pending":
        return "bg-yellow-500/90";
      case "expired":
        return "bg-gray-500/90";
      case "rejected":
        return "bg-red-500/90";
      default:
        return "bg-secondary";
    }
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`group cursor-pointer rounded-lg overflow-hidden border bg-card/50 hover:shadow-lg transition-all ${
        ad.isBlacklisted
          ? "border-red-500/50 bg-red-950/10 hover:border-red-500/70"
          : "border-border/50 hover:border-primary/30"
      }`}
    >
      <div className="relative aspect-square">
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={mediaUrl}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            {!isHovering && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img
            src={mediaUrl}
            alt={ad.title}
            className="w-full h-full object-cover"
          />
        )}

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
          {/* Blacklisted badge */}
          {ad.isBlacklisted && (
            <div className="px-2 py-1 rounded bg-red-600/90 text-white text-xs font-medium flex items-center gap-1">
              <Ban className="w-3 h-3" />
              Blocked
            </div>
          )}
          {/* Status badge */}
          <div className={`px-2 py-1 rounded ${getStatusColor(ad.status)} text-white text-xs font-medium`}>
            {ad.status}
          </div>
        </div>

        {/* Video badge */}
        {isVideo && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium flex items-center gap-1 z-10">
            <Play className="w-3 h-3" />
            Video
          </div>
        )}

        {/* Overlay with stats on hover */}
        {!isVideo && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex gap-4 text-white text-sm">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{ad.views || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <MousePointer className="h-4 w-4" />
                <span>{ad.clicks || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{ad.computedLikeCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Title and stats bar */}
      <div className="p-2">
        <p className="text-sm font-medium truncate mb-1">{ad.title || "Untitled"}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {ad.views || 0}
            </span>
            <span className="flex items-center gap-1">
              <MousePointer className="h-3 w-3" />
              {ad.clicks || 0}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {ad.computedLikeCount}
          </span>
        </div>
      </div>
    </div>
  );
}
