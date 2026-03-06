/**
 * Upload size limits for admin portal (reusable across media upload components).
 */

/** Max allowed video file size: 1 GB */
export const MAX_VIDEO_UPLOAD_BYTES = 1 * 1024 * 1024 * 1024;

/** Target max size after compression: 200 MB (videos larger than this will be compressed) */
export const TARGET_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

/** Human-readable labels */
export const MAX_VIDEO_UPLOAD_LABEL = "1 GB";
export const TARGET_VIDEO_MAX_LABEL = "200 MB";

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
