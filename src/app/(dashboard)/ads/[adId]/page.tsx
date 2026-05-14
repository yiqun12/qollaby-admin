"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  getSponsorAdById,
  getAdLikeCount,
  getUserByUserId,
  deleteSponsorAd,
  getAdsReportCounts,
  getPostStampsByPostIds,
  SponsorAd,
} from "@/lib/user-actions";
import { Profile } from "@/types/profile.types";
import { getImageUrl, getVideoUrl, isVideoUrl } from "@/lib/appwrite";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAllCategories, getCategoryLabel, getSubCategoryLabel, Category } from "@/lib/category-actions";
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
import { AdConversionRow, AdStatRow } from "@/components/metrics/ad-stat-rows";
import { AdminAdDetailEditDialog } from "@/components/ads/admin-ad-detail-edit-form";
import {
  ArrowLeft,
  Heart,
  AlertTriangle,
  Calendar,
  Hash,
  Tag,
  Play,
  Image as ImageIcon,
  MapPin,
  User,
  Clock,
  Eye,
  MousePointer,
  Ban,
  RefreshCw,
  Megaphone,
  Shield,
  Phone,
  Globe,
  Trash2,
  Loader2,
  Users,
  LayoutGrid,
  Pencil,
} from "lucide-react";

function adminListQueryFrom(ad: SponsorAd, urlTag: string | null): string {
  const fromUrl = urlTag === "event" || urlTag === "exchange" ? urlTag : null;
  const fromDoc = ad.tag === "event" || ad.tag === "exchange" ? ad.tag : null;
  const tag = fromUrl ?? fromDoc;
  return tag ? `?tag=${tag}` : "";
}

function AdDetailPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const adId = params.adId as string;
  const urlTag = searchParams.get("tag");

  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<SponsorAd | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [stampCount, setStampCount] = useState(0);
  const [reportCount, setReportCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const fetchAd = useCallback(async () => {
    setLoading(true);
    try {
      const adData = await getSponsorAdById(adId);
      setAd(adData);

      if (adData) {
        const [likes, stampMap, reportMap] = await Promise.all([
          getAdLikeCount(adId),
          getPostStampsByPostIds([adId]),
          getAdsReportCounts([adId]),
        ]);
        setLikeCount(likes);
        setStampCount(stampMap.get(adId) ?? 0);
        setReportCount(reportMap.get(adId) ?? 0);

        if (adData.userId) {
          const profile = await getUserByUserId(adData.userId);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      }
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
    getAllCategories().then(setAllCategories);
  }, [adId, fetchAd]);

  const adminReturnPath = useMemo(() => {
    if (!ad?.isAdminCreated) return "/ads/user";
    return `/ads/admin${adminListQueryFrom(ad, urlTag)}`;
  }, [ad, urlTag]);

  const handleDelete = async () => {
    if (!ad || !ad.isAdminCreated) return;
    setActionLoading(true);
    try {
      await deleteSponsorAd(ad.$id);
      router.push(adminReturnPath);
    } catch (error) {
      console.error("Failed to delete ad:", error);
      alert("Failed to delete ad. Please try again.");
    } finally {
      setActionLoading(false);
      setDeleteDialog(false);
    }
  };

  const getDisplaySlot = (storedSlot: number | undefined): number | undefined => {
    if (storedSlot === undefined || storedSlot === null) return undefined;
    return storedSlot + 1;
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
        <Button onClick={() => router.push("/ads/user")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Ads
        </Button>
      </div>
    );
  }

  const displaySlot = getDisplaySlot(ad.slot);

  const rawMedia = ad.media || (ad.image ? [ad.image] : []);
  const processedMedia = rawMedia.map((item, index) => {
    const isVideo = isVideoUrl(item);
    return {
      url: isVideo ? getVideoUrl(item) : getImageUrl(item, 800, 800),
      isVideo,
      posterUrl: isVideo && index === 0 && ad.image ? getImageUrl(ad.image, 800, 800) : undefined,
    };
  });

  const videoCount = processedMedia.filter((m) => m.isVideo).length;
  const imageCount = processedMedia.filter((m) => !m.isVideo).length;

  const categoryLabel = getCategoryLabel(allCategories, ad.category);
  const subCategoryLabel = ad.subcategory ? getSubCategoryLabel(allCategories, ad.subcategory) : null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US");
    } catch {
      return dateStr;
    }
  };

  const tagLabel =
    ad.tag === "event" ? "Event" : ad.tag === "exchange" ? "Exchange" : ad.tag === "home" ? "Home" : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(adminReturnPath)}
            className="bg-secondary/50 border-border/50 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 flex-wrap">
              <Megaphone className="h-6 w-6 text-primary shrink-0" />
              Ad details
            </h1>
            <p className="text-muted-foreground">
              {ad.isAdminCreated
                ? "Review performance; use Edit to change placement and creative."
                : "View advertisement information"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAd}
            className="bg-secondary/50 border-border/50 hover:bg-secondary/80"
            disabled={actionLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {ad.isAdminCreated && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="bg-secondary/50 border-border/50"
              disabled={actionLoading}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {ad.isAdminCreated && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialog(true)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>

      {ad.isBlacklisted && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <Ban className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-500">This ad is blocked</p>
            <p className="text-sm text-muted-foreground">This advertisement is hidden from the public feed.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
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

        <div className="space-y-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <AdStatRow icon={Eye} label="Views" value={ad.views || 0} color="text-blue-500" />
              <AdStatRow icon={MousePointer} label="Clicks" value={ad.clicks || 0} color="text-green-500" />
              <AdStatRow icon={Heart} label="Likes" value={likeCount} color="text-pink-500" />
              <AdStatRow icon={Users} label="Stamps" value={stampCount} color="text-cyan-500" />
              <AdStatRow
                icon={AlertTriangle}
                label="Reports"
                value={reportCount}
                color={reportCount > 0 ? "text-red-500" : "text-muted-foreground"}
              />
              <AdConversionRow views={ad.views || 0} clicks={ad.clicks || 0} />
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 pb-3 border-b border-border/30">
                <Avatar className="h-12 w-12 border-2 border-primary/30">
                  {userProfile?.avatar ? (
                    <AvatarImage src={userProfile.avatar} alt={userProfile.firstName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {userProfile ? (
                      `${userProfile.firstName?.[0] || ""}${userProfile.lastName?.[0] || ""}`
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {userProfile
                      ? `${userProfile.firstName} ${userProfile.lastName}`.trim() || "Unknown"
                      : "Loading…"}
                  </p>
                  <p className="text-sm text-primary truncate">{userProfile?.email || "N/A"}</p>
                </div>
              </div>
              {ad.isAdminCreated && (
                <div className="flex items-center gap-2 pb-3 border-b border-border/30">
                  <div className="px-2.5 py-1 rounded-md bg-green-600/20 text-green-500 text-xs font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Admin created ad
                  </div>
                </div>
              )}
              {displaySlot !== undefined && (
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground">Slot position</p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                      displaySlot === 1 || displaySlot === 10 || displaySlot === 20
                        ? "bg-red-500/10 text-red-500 border border-red-500/30"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/30"
                    }`}
                  >
                    Slot #{displaySlot}
                  </span>
                </div>
              )}
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
              {ad.phoneNumber && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone number</p>
                  <a
                    href={`tel:${ad.phoneNumber}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {ad.phoneNumber}
                  </a>
                </div>
              )}
              {ad.website && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Website</p>
                  <a
                    href={ad.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                  >
                    <Globe className="h-3 w-3 shrink-0" />
                    {ad.website}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Target location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={MapPin} label="State" value={ad.state || "N/A"} />
              <InfoRow icon={MapPin} label="City" value={ad.city || "N/A"} />
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Hash} label="Ad ID" value={ad.$id} mono />
              <InfoRow icon={Hash} label="User ID" value={ad.userId} mono />
              {tagLabel && <InfoRow icon={LayoutGrid} label="Placement" value={tagLabel} />}
              <InfoRow icon={Tag} label="Category" value={categoryLabel} />
              {subCategoryLabel && <InfoRow icon={Tag} label="Sub category" value={subCategoryLabel} />}
              <InfoRow icon={Calendar} label="Created at" value={formatDate(ad.$createdAt)} />
              <InfoRow icon={Clock} label="Expires at" value={formatDate(ad.expiresAt)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {ad.isAdminCreated && (
        <AdminAdDetailEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          ad={ad}
          onSaved={fetchAd}
        />
      )}

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ad?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes &quot;{ad.title}&quot; and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdDetailPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <AdDetailPageInner />
    </Suspense>
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
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 gap-4">
      <div className="flex items-center gap-3 text-muted-foreground shrink-0">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className={`text-right ${mono ? "font-mono text-sm break-all" : ""}`}>{value}</span>
    </div>
  );
}
