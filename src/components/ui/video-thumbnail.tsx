"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, RefreshCw, AlertCircle } from "lucide-react";

const LOAD_TIMEOUT_MS = 8000;

interface VideoThumbnailProps {
  src: string;
  className?: string;
  showPlayIcon?: boolean;
  maxRetries?: number;
}

function getPreviewUrl(videoUrl: string): string | undefined {
  if (!videoUrl) return undefined;

  try {
    const url = new URL(videoUrl);
    if (!url.pathname.endsWith("/view")) return undefined;

    url.pathname = url.pathname.replace(/\/view$/, "/preview");
    url.searchParams.delete("type");
    return url.toString();
  } catch {
    if (!videoUrl.includes("/view")) return undefined;

    const [base, query = ""] = videoUrl.split("?");
    const previewBase = base.replace(/\/view$/, "/preview");
    const filteredQuery = query
      .split("&")
      .filter((part) => part && !part.startsWith("type="))
      .join("&");

    return filteredQuery ? `${previewBase}?${filteredQuery}` : previewBase;
  }
}

/**
 * Video element with 8s load timeout, auto-retry, and manual retry fallback.
 * Handles mobile Safari where unsupported formats silently hang without error.
 */
function VideoThumbnailInner({
  src,
  className = "w-full h-full object-cover",
  showPlayIcon = true,
  maxRetries = 2,
}: VideoThumbnailProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posterUrl = useMemo(() => getPreviewUrl(src), [src]);

  const getUrl = useCallback(
    (attempt: number) => {
      if (attempt === 0) return src;
      const sep = src.includes("?") ? "&" : "?";
      return `${src}${sep}_r=${attempt}`;
    },
    [src]
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (status === "loading") {
        setStatus("error");
      }
    }, LOAD_TIMEOUT_MS);
  }, [clearTimer, status]);

  // Start timeout on mount and on each retry
  useEffect(() => {
    if (status === "loading") {
      startTimer();
    }
    return clearTimer;
  }, [status, retryCount, startTimer, clearTimer]);

  const handleError = useCallback(() => {
    clearTimer();
    if (retryCount < maxRetries) {
      const next = retryCount + 1;
      setRetryCount(next);
      setStatus("loading");
      if (videoRef.current) {
        videoRef.current.src = getUrl(next);
        videoRef.current.load();
      }
    } else {
      setStatus("error");
    }
  }, [retryCount, maxRetries, getUrl, clearTimer]);

  const handleManualRetry = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearTimer();
      setRetryCount(0);
      setStatus("loading");
      if (videoRef.current) {
        videoRef.current.src = getUrl(0);
        videoRef.current.load();
      }
    },
    [getUrl, clearTimer]
  );

  const handleReady = useCallback(() => {
    clearTimer();
    setStatus("ready");
  }, [clearTimer]);

  if (status === "error") {
    return (
      <div className="w-full h-full relative bg-secondary/40">
        {posterUrl && (
          <div
            className="absolute inset-0 bg-center bg-cover"
            style={{ backgroundImage: `url(${posterUrl})` }}
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 gap-2">
          <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
          <button
            onClick={handleManualRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={getUrl(retryCount)}
        className={className}
        muted
        playsInline
        preload="metadata"
        poster={posterUrl}
        onLoadedMetadata={handleReady}
        onLoadedData={handleReady}
        onCanPlay={handleReady}
        onError={handleError}
      />
      {showPlayIcon && status === "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <Play className="h-8 w-8 text-white/80" />
        </div>
      )}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/40">
          <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

export function VideoThumbnail(props: VideoThumbnailProps) {
  return <VideoThumbnailInner key={props.src} {...props} />;
}
