"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { MediaUpload } from "@/components/ui/media-upload";
import { ImageThumbnail } from "@/components/ui/image-thumbnail";
import { VideoThumbnail } from "@/components/ui/video-thumbnail";
import { getImageUrl, getVideoUrl, isVideoUrl, uploadFiles } from "@/lib/appwrite";
import { Category, getCategories, getSubcategories } from "@/lib/category-actions";
import { getStateFullName } from "@/lib/utils";
import {
  AD_SLOTS,
  AdSlot,
  AdTagType,
  getSlotMaxUsage,
  getSlotUsageCounts,
  MULTI_USE_SLOTS,
  SponsorAd,
  SlotUsageInfo,
  updateSponsorAd,
} from "@/lib/user-actions";
import { Loader2, Pencil, Play, Trash2 } from "lucide-react";

interface EditAdFormState {
  title: string;
  description: string;
  location: PlaceValue | null;
  state: string;
  city: string;
  category: string;
  subcategory: string;
  slot: AdSlot | null;
  phoneNumber: string;
  website: string;
  existingMedia: string[];
  newMediaFiles: File[];
  newMediaPreviews: string[];
  newPosterFiles: Array<File | null>;
}

function adToFormState(ad: SponsorAd): EditAdFormState {
  return {
    title: ad.title,
    description: ad.description || "",
    location:
      ad.state && ad.city
        ? {
            placeId: "",
            address: `${ad.city}, ${ad.state}`,
            latitude: 0,
            longitude: 0,
            city: ad.city,
            state: ad.state,
          }
        : null,
    state: ad.state,
    city: ad.city,
    category: ad.category,
    subcategory: ad.subcategory || "",
    slot: ad.slot !== undefined && ad.slot !== null ? ((ad.slot + 1) as AdSlot) : null,
    phoneNumber: ad.phoneNumber || "",
    website: ad.website || "",
    existingMedia: ad.media || [],
    newMediaFiles: [],
    newMediaPreviews: [],
    newPosterFiles: [],
  };
}

export interface AdminAdDetailEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad: SponsorAd;
  onSaved: () => Promise<void> | void;
}

/**
 * Same interaction model as post detail: header "Edit" opens a scrollable dialog
 * with Cancel / Reset / Save changes in the footer.
 */
export function AdminAdDetailEditDialog({ open, onOpenChange, ad, onSaved }: AdminAdDetailEditDialogProps) {
  const [editForm, setEditForm] = useState<EditAdFormState>(() => adToFormState(ad));
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [editSubcategoriesList, setEditSubcategoriesList] = useState<Category[]>([]);
  const [editSlotUsageCounts, setEditSlotUsageCounts] = useState<SlotUsageInfo>({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (open) {
      setEditForm(adToFormState(ad));
    }
  }, [open, ad.$id, ad.$updatedAt]);

  useEffect(() => {
    getCategories().then(setDynamicCategories);
  }, []);

  useEffect(() => {
    if (editForm.category) {
      getSubcategories(editForm.category).then(setEditSubcategoriesList);
    } else {
      setEditSubcategoriesList([]);
    }
  }, [editForm.category]);

  // Slot capacity is per tag — count usage within this ad's tag only.
  const adTag: AdTagType = ad.tag === "event" || ad.tag === "exchange" ? ad.tag : "home";
  const refreshSlotUsage = useCallback(async () => {
    const usage = await getSlotUsageCounts(adTag);
    setEditSlotUsageCounts(usage);
  }, [adTag]);

  useEffect(() => {
    if (open) {
      void refreshSlotUsage();
    }
  }, [open, refreshSlotUsage]);

  const resetFromAd = useCallback(() => {
    setEditForm(adToFormState(ad));
  }, [ad]);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      setEditForm((prev) => {
        prev.newMediaPreviews.forEach((url) => URL.revokeObjectURL(url));
        return adToFormState(ad);
      });
    }
    onOpenChange(next);
  };

  const handleEditLocationChange = (location: PlaceValue | null) => {
    if (location?.state) {
      const stateFullName = getStateFullName(location.state);
      setEditForm((prev) => ({
        ...prev,
        location,
        state: stateFullName,
        city: location.city || "",
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        location,
        state: "",
        city: "",
      }));
    }
  };

  const handleUpdateAd = async () => {
    if (!editForm.title || !editForm.state || !editForm.city || !editForm.category || !editForm.slot) {
      alert("Please fill in all required fields");
      return;
    }

    if (editForm.existingMedia.length === 0 && editForm.newMediaFiles.length === 0) {
      alert("Please include at least one photo or video");
      return;
    }

    setUpdating(true);
    try {
      let finalMedia = [...editForm.existingMedia];
      let newMediaUrls: string[] = [];

      if (editForm.newMediaFiles.length > 0) {
        newMediaUrls = await uploadFiles(editForm.newMediaFiles);
        finalMedia = [...finalMedia, ...newMediaUrls];
      }

      const firstMediaUrl = finalMedia[0] || "";
      const originalFirstMediaUrl = ad.media?.[0] || "";
      let nextCoverImage = "";

      if (firstMediaUrl) {
        if (!isVideoUrl(firstMediaUrl)) {
          nextCoverImage = firstMediaUrl;
        } else {
          const firstMediaFromNewUpload = editForm.existingMedia.length === 0;

          if (firstMediaFromNewUpload) {
            const firstPoster = editForm.newPosterFiles[0];
            if (firstPoster) {
              const [posterUrl] = await uploadFiles([firstPoster]);
              nextCoverImage = posterUrl || "";

              const thumbId = posterUrl?.match(/\/files\/([^/]+)\//)?.[1];
              if (thumbId) {
                finalMedia = finalMedia.map((url) =>
                  isVideoUrl(url) && !url.includes("thumb=") ? `${url}&thumb=${thumbId}` : url
                );
              }
            } else {
              nextCoverImage = ad.image || "";
            }
          } else if (firstMediaUrl === originalFirstMediaUrl) {
            nextCoverImage = ad.image || "";
          }
        }
      }

      await updateSponsorAd(ad.$id, {
        title: editForm.title,
        description: editForm.description || undefined,
        media: finalMedia,
        image: nextCoverImage,
        state: editForm.state,
        city: editForm.city,
        category: editForm.category,
        subcategory: editForm.subcategory || undefined,
        slot: editForm.slot,
        phoneNumber: editForm.phoneNumber || undefined,
        website: editForm.website || undefined,
        tag: adTag,
      });
      editForm.newMediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      await onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      console.error("Failed to update ad:", error);
      const message = error instanceof Error ? error.message : "Failed to update ad. Please try again.";
      alert(message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={!updating}
        className="bg-card border-border sm:max-w-2xl max-h-[85vh] overflow-y-auto gap-0 p-0"
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest(".pac-container")) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest(".pac-container")) e.preventDefault();
        }}
      >
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Pencil className="h-5 w-5 text-primary shrink-0" />
              Edit advertisement
            </DialogTitle>
            <DialogDescription>
              Updates are saved to Appwrite and apply to this sponsor ad after users refresh the app.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-4">
          {editForm.existingMedia.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current media</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {editForm.existingMedia.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border/50 group"
                  >
                    {isVideoUrl(url) ? (
                      <>
                        {idx === 0 && ad.image ? (
                          <ImageThumbnail
                            src={getImageUrl(ad.image, 200, 200)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <VideoThumbnail src={getVideoUrl(url)} />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                          <Play className="h-6 w-6 text-white/80" />
                        </div>
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs pointer-events-none z-10">
                          Video
                        </div>
                      </>
                    ) : (
                      <ImageThumbnail src={getImageUrl(url, 200, 200)} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          existingMedia: prev.existingMedia.filter((_, i) => i !== idx),
                        }))
                      }
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MediaUpload
            value={{
              files: editForm.newMediaFiles,
              previews: editForm.newMediaPreviews,
              posters: editForm.newPosterFiles,
            }}
            onChange={({ files, previews, posters }) =>
              setEditForm((prev) => ({
                ...prev,
                newMediaFiles: files,
                newMediaPreviews: previews,
                newPosterFiles: posters,
              }))
            }
            label="Add new media"
            placeholder="Tap to upload new photos or videos"
            addMoreLabel="Add more"
          />

          <div className="space-y-2">
            <label htmlFor="admin-ad-edit-title" className="text-sm text-muted-foreground">
              Title
            </label>
            <Input
              id="admin-ad-edit-title"
              value={editForm.title}
              onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              className="bg-input/50 border-border/50"
              disabled={updating}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="admin-ad-edit-desc" className="text-sm text-muted-foreground">
              Description
            </label>
            <textarea
              id="admin-ad-edit-desc"
              value={editForm.description}
              onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={6}
              disabled={updating}
              className="flex w-full rounded-md border border-border/50 bg-input/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y min-h-[120px] disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="admin-ad-edit-phone" className="text-sm text-muted-foreground">
                Phone number
              </label>
              <Input
                id="admin-ad-edit-phone"
                type="tel"
                placeholder="(optional)"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                className="bg-input/50 border-border/50"
                disabled={updating}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="admin-ad-edit-website" className="text-sm text-muted-foreground">
                Website
              </label>
              <Input
                id="admin-ad-edit-website"
                type="url"
                placeholder="https://..."
                value={editForm.website}
                onChange={(e) => setEditForm((prev) => ({ ...prev, website: e.target.value }))}
                className="bg-input/50 border-border/50"
                disabled={updating}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <LocationPicker
              value={editForm.location}
              onChange={handleEditLocationChange}
              placeholder="Search city or address..."
              showCurrentLocation={false}
              countryRestriction="us"
            />
            {editForm.state && editForm.city && (
              <p className="text-xs text-muted-foreground">
                {editForm.city}, {editForm.state}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-ad-edit-category">Category</Label>
              <select
                id="admin-ad-edit-category"
                value={editForm.category}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))
                }
                disabled={updating}
                className="w-full h-9 px-3 rounded-md bg-input/50 border border-border/50 text-sm disabled:opacity-50"
              >
                <option value="">Select category</option>
                {dynamicCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-ad-edit-subcategory">Subcategory</Label>
              <select
                id="admin-ad-edit-subcategory"
                value={editForm.subcategory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, subcategory: e.target.value }))}
                disabled={!editForm.category || updating}
                className="w-full h-9 px-3 rounded-md bg-input/50 border border-border/50 text-sm disabled:opacity-50"
              >
                <option value="">Select subcategory</option>
                {editSubcategoriesList.map((sub) => (
                  <option key={sub.value} value={sub.value}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ad slot</Label>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {AD_SLOTS.map((slot) => {
                const currentUsage = editSlotUsageCounts[slot] || 0;
                const maxUsage = getSlotMaxUsage(slot);
                const isCurrentSlot = editForm.slot === slot;
                const canSelect = currentUsage < maxUsage || isCurrentSlot;
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={updating || !canSelect}
                    onClick={() => canSelect && setEditForm((prev) => ({ ...prev, slot }))}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isCurrentSlot
                        ? "border-primary bg-primary/10 text-primary"
                        : canSelect
                          ? "border-border/50 hover:border-primary/50 hover:bg-secondary/50"
                          : "border-border/30 bg-secondary/20 text-muted-foreground opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <span className="font-bold">{slot}</span>
                    <span className="block text-[10px] opacity-70">
                      {currentUsage}/{maxUsage}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Multi-use slots (up to 3 ads): {(MULTI_USE_SLOTS as readonly number[]).join(", ")}.
            </p>
          </div>
        </div>

        <DialogFooter className="p-6 pt-2 border-t border-border/50 bg-card">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogOpenChange(false)}
            disabled={updating}
            className="bg-secondary/50 border-border/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetFromAd}
            disabled={updating}
            className="bg-secondary/50 border-border/50"
          >
            Reset
          </Button>
          <Button type="button" onClick={() => void handleUpdateAd()} disabled={updating}>
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
