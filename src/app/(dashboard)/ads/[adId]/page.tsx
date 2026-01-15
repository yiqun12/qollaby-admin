"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getSponsorAdById,
  getAdLikeCount,
  blacklistSponsorAd,
  unblacklistSponsorAd,
  updateSponsorAdStatus,
  SponsorAd,
  SponsorAdStatus,
} from "@/lib/user-actions";
import { getImageUrl, getVideoUrl, isVideoUrl } from "@/lib/appwrite";
import { getCategoryLabel, getSubCategoryLabel } from "@/lib/categories";
import { MediaCarousel } from "@/components/ui/media-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Heart,
  AlertTriangle,
  Calendar,
  Hash,
  FileText,
  Tag,
  Play,
  Image as ImageIcon,
  MapPin,
  User,
  Clock,
  Eye,
  MousePointer,
  Ban,
  CheckCircle,
  RefreshCw,
  XCircle,
  Megaphone,
} from "lucide-react";

export default function AdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const adId = params.adId as string;

  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<SponsorAd | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [blacklistDialog, setBlacklistDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean;
    newStatus: SponsorAdStatus | null;
  }>({ open: false, newStatus: null });

  const fetchAd = useCallback(async () => {
    setLoading(true);
    try {
      const [adData, likes] = await Promise.all([
        getSponsorAdById(adId),
        getAdLikeCount(adId),
      ]);
      setAd(adData);
      setLikeCount(likes);
    } catch (error) {
      console.error("Failed to fetch ad:", error);
    } finally {
      setLoading(false);
    }
  }, [adId]);

  useEffect(() => {
    if (adId) {
      fetchAd();
    }
  }, [adId, fetchAd]);

  const handleBlacklist = async () => {
    if (!ad) return;
    setActionLoading(true);
    try {
      if (ad.isBlacklisted) {
        await unblacklistSponsorAd(adId);
      } else {
        await blacklistSponsorAd(adId);
      }
      await fetchAd();
    } catch (error) {
      console.error("Failed to update blacklist status:", error);
    } finally {
      setActionLoading(false);
      setBlacklistDialog(false);
    }
  };

  const handleStatusChange = async () => {
    if (!ad || !statusDialog.newStatus) return;
    setActionLoading(true);
    try {
      await updateSponsorAdStatus(adId, statusDialog.newStatus);
      await fetchAd();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setActionLoading(false);
      setStatusDialog({ open: false, newStatus: null });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ad Not Found</h2>
        <p className="text-muted-foreground mb-6">Could not find the advertisement</p>
        <Button onClick={() => router.push("/ads")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ads
        </Button>
      </div>
    );
  }

  // Process media array
  const rawMedia = ad.media || (ad.image ? [ad.image] : []);
  const processedMedia = rawMedia.map((item) => {
    const isVideo = isVideoUrl(item);
    return {
      url: isVideo ? getVideoUrl(item) : getImageUrl(item, 800, 800),
      isVideo,
    };
  });

  const videoCount = processedMedia.filter((m) => m.isVideo).length;
  const imageCount = processedMedia.filter((m) => !m.isVideo).length;

  const categoryLabel = getCategoryLabel(ad.category);
  const subCategoryLabel = ad.subcategory
    ? getSubCategoryLabel(ad.category, ad.subcategory)
    : null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US");
    } catch {
      return dateStr;
    }
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/ads")}
            className="bg-secondary/50 border-border/50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ad Details</h1>
            <p className="text-muted-foreground">View and manage advertisement</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAd}
            className="bg-secondary/50 border-border/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant={ad.isBlacklisted ? "outline" : "destructive"}
            size="sm"
            onClick={() => setBlacklistDialog(true)}
            disabled={actionLoading}
            className={ad.isBlacklisted ? "border-green-500/50 text-green-500 hover:bg-green-500/10" : ""}
          >
            {ad.isBlacklisted ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Unblock Ad
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Block Ad
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Blacklist warning banner */}
      {ad.isBlacklisted && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <Ban className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-500">This ad is blocked</p>
            <p className="text-sm text-muted-foreground">
              This advertisement is hidden from the public feed.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Media gallery */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            {processedMedia.length > 0 ? (
              <>
                <MediaCarousel media={processedMedia} />
                <div className="flex items-center justify-center gap-4 mt-3 text-sm text-muted-foreground">
                  {imageCount > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      {imageCount} {imageCount === 1 ? "image" : "images"}
                    </span>
                  )}
                  {videoCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Play className="h-4 w-4" />
                      {videoCount} {videoCount === 1 ? "video" : "videos"}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="aspect-square rounded-lg bg-secondary/30 flex items-center justify-center">
                <Megaphone className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <div className="space-y-6">
          {/* Title and description */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Title</p>
                <p className="font-medium">{ad.title || "Untitled"}</p>
              </div>
              {ad.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{ad.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground">Current Status</span>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(ad.status)}`}>
                  {ad.status}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["active", "pending", "expired", "rejected"] as SponsorAdStatus[]).map(
                  (status) =>
                    status !== ad.status && (
                      <Button
                        key={status}
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusDialog({ open: true, newStatus: status })}
                        className="bg-secondary/30 border-border/50"
                      >
                        Set as {status}
                      </Button>
                    )
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatRow icon={Eye} label="Views" value={ad.views || 0} color="text-blue-500" />
              <StatRow icon={MousePointer} label="Clicks" value={ad.clicks || 0} color="text-green-500" />
              <StatRow icon={Heart} label="Likes" value={likeCount} color="text-pink-500" />
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Target Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={MapPin} label="State" value={ad.state || "N/A"} />
              <InfoRow icon={MapPin} label="City" value={ad.city || "N/A"} />
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Hash} label="Ad ID" value={ad.$id} mono />
              <InfoRow icon={Hash} label="User ID" value={ad.userId} mono />
              <InfoRow icon={Tag} label="Category" value={categoryLabel} />
              {subCategoryLabel && (
                <InfoRow icon={Tag} label="Sub Category" value={subCategoryLabel} />
              )}
              <InfoRow icon={Calendar} label="Created At" value={formatDate(ad.$createdAt)} />
              <InfoRow icon={Clock} label="Expires At" value={formatDate(ad.expiresAt)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Blacklist Confirmation Dialog */}
      <AlertDialog open={blacklistDialog} onOpenChange={setBlacklistDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ad.isBlacklisted ? "Unblock this ad?" : "Block this ad?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ad.isBlacklisted
                ? "This will make the ad visible in the public feed again."
                : "This will hide the ad from the public feed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary/50 border-border/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlacklist}
              className={
                ad.isBlacklisted
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              {ad.isBlacklisted ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Change Dialog */}
      <AlertDialog open={statusDialog.open} onOpenChange={(open) => setStatusDialog({ ...statusDialog, open })}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change ad status to {statusDialog.newStatus}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will update the advertisement status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary/50 border-border/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface StatRowProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
}

function StatRow({ icon: Icon, label, value, color = "text-muted-foreground" }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Icon className={`h-4 w-4 ${color}`} />
        <span>{label}</span>
      </div>
      <span className={`text-lg font-semibold ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}

function InfoRow({ icon: Icon, label, value, mono }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className={mono ? "font-mono text-sm" : ""}>{value}</span>
    </div>
  );
}
