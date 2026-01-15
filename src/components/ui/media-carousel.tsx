"use client";

import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX, Pause } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MediaCarouselProps {
  media: Array<{
    url: string;
    isVideo: boolean;
  }>;
  className?: string;
}

export function MediaCarousel({ media, className }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentMedia = media[currentIndex];
  const hasMultiple = media.length > 1;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  }, [media.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [media.length]);

  // Reset video state when changing slides
  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [currentIndex]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
      if (e.key === " " && currentMedia?.isVideo) {
        e.preventDefault();
        togglePlay();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrev, goToNext, currentMedia, togglePlay]);

  if (!media || media.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative w-full aspect-square rounded-lg overflow-hidden bg-secondary/30", className)}>
      {/* Media content */}
      <div className="w-full h-full">
        {currentMedia.isVideo ? (
          <div className="relative w-full h-full group">
            <video
              ref={videoRef}
              src={currentMedia.url}
              className="w-full h-full object-cover"
              muted={isMuted}
              playsInline
              onEnded={handleVideoEnded}
              onClick={togglePlay}
            />
            
            {/* Video controls overlay */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity",
              isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"
            )}>
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </button>
            </div>

            {/* Mute button */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors z-10"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* Video indicator badge */}
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium flex items-center gap-1">
              <Play className="w-3 h-3" />
              Video
            </div>
          </div>
        ) : (
          <img
            src={currentMedia.url}
            alt={`Media ${currentIndex + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Pagination dots */}
      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {media.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                idx === currentIndex 
                  ? "bg-white" 
                  : "bg-white/50 hover:bg-white/70"
              )}
            />
          ))}
        </div>
      )}

      {/* Media counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-4 px-2 py-1 rounded bg-black/60 text-white text-xs font-medium">
          {currentIndex + 1} / {media.length}
        </div>
      )}
    </div>
  );
}
