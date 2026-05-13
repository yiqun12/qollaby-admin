"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updatePostAdminNotesApi } from "@/lib/post-notes-client";
import { Loader2, StickyNote } from "lucide-react";

type Props = {
  contentId: string;
  kind: "post" | "exchange";
  initialNotes?: string;
  triggerClassName?: string;
  /** Wider control for detail pages */
  variant?: "icon" | "button";
  onSaved?: (notes: string) => void;
};

export function AdminNotesEditor({
  contentId,
  kind,
  initialNotes = "",
  triggerClassName,
  variant = "icon",
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = () => {
    setText(initialNotes);
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePostAdminNotesApi({ id: contentId, notes: text, kind });
      onSaved?.(text);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openDialog();
        }}
        className={
          triggerClassName ??
          (variant === "button"
            ? "inline-flex w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
            : "inline-flex items-center justify-center rounded-md border border-border/60 bg-secondary/40 p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors")
        }
        title="Admin notes"
      >
        <StickyNote className="h-3.5 w-3.5" />
        {variant === "button" && <span>Admin notes</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="bg-card border-border sm:max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Admin notes</DialogTitle>
          </DialogHeader>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Internal notes (not visible in the app)…"
            className="flex w-full rounded-md border border-border/50 bg-input/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y min-h-[120px]"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Requires string attribute <code className="text-primary">adminNotes</code> on{" "}
            {kind === "exchange" ? "exchange_listings" : "posts"} in Appwrite.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)} type="button">
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving} type="button">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
