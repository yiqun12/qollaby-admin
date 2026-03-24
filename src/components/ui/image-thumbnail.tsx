"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ImageThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  maxRetries?: number;
}

const LOAD_TIMEOUT_MS = 15_000;

function ImageThumbnailInner({
  src,
  alt,
  className = "w-full h-full object-cover",
  maxRetries = 2,
}: ImageThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getUrl = useCallback(
    (attempt: number) => {
      if (attempt === 0) return src;
      const sep = src.includes("?") ? "&" : "?";
      return `${src}${sep}_r=${attempt}`;
    },
    [src]
  );

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setRetryCount(0);
  }, [src]);

  // Fallback: poll img.complete for browsers/situations where onLoad doesn't fire.
  // Also acts as a safety net after timeout — if the image finishes loading later,
  // it overrides the failed state and shows the image.
  useEffect(() => {
    if (loaded) return;

    const check = () => {
      const img = imgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        setLoaded(true);
        setFailed(false);
      }
    };

    check();

    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, [loaded, failed, retryCount]);

  // Timeout: if neither loaded nor errored after LOAD_TIMEOUT_MS, mark as failed
  // so the Retry button appears. The <img> stays in DOM so polling can still recover.
  useEffect(() => {
    if (loaded || failed) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setFailed((prev) => {
        if (prev) return prev;
        return true;
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loaded, failed, retryCount]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
    setFailed(false);
  }, []);

  const handleError = useCallback(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
      setFailed(false);
      return;
    }

    if (retryCount < maxRetries) {
      const next = retryCount + 1;
      setRetryCount(next);
      if (imgRef.current) {
        imgRef.current.src = getUrl(next);
      }
    } else {
      setFailed(true);
    }
  }, [getUrl, maxRetries, retryCount]);

  const handleManualRetry = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLoaded(false);
      setFailed(false);
      setRetryCount(0);
      if (imgRef.current) {
        imgRef.current.src = getUrl(0);
      }
    },
    [getUrl]
  );

  return (
    <div className="relative w-full h-full bg-secondary/40">
      <img
        ref={imgRef}
        src={getUrl(retryCount)}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={handleLoad}
        onError={handleError}
      />

      {!loaded && !failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-secondary/20 pointer-events-none">
          <div className="h-5 w-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {failed && !loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary/75 backdrop-blur-sm">
          <AlertCircle className="h-6 w-6 text-muted-foreground/70" />
          <button
            type="button"
            onClick={handleManualRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

export function ImageThumbnail(props: ImageThumbnailProps) {
  return <ImageThumbnailInner key={props.src} {...props} />;
}
