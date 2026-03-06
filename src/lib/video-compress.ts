/**
 * Client-side video compression to a target max file size.
 * Uses @ffmpeg/ffmpeg (loaded dynamically, browser only).
 */

import { TARGET_VIDEO_MAX_BYTES } from "./upload-limits";

/** Get video duration in seconds using a video element (no FFmpeg needed). */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video metadata"));
    };
    video.src = url;
  });
}

export type CompressProgress = (progress: number, message?: string) => void;

/**
 * Compress a video file to at most targetMaxBytes (default 200 MB).
 * Runs in browser; may use significant memory for large inputs.
 */
export async function compressVideo(
  file: File,
  targetMaxBytes: number = TARGET_VIDEO_MAX_BYTES,
  onProgress?: CompressProgress
): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("compressVideo can only run in the browser");
  }

  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const inputPath = `input.${ext}`;
  const outputPath = "output.mp4";
  const durationPath = "duration.txt";

  onProgress?.(0, "Loading FFmpeg...");
  const ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => {
      onProgress(Math.round(progress * 100), "Compressing...");
    });
  }

  await ffmpeg.load();
  onProgress?.(5, "Reading file...");
  await ffmpeg.writeFile(inputPath, await fetchFile(file));

  onProgress?.(10, "Getting duration...");
  const probeExit = await ffmpeg.ffprobe([
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
    "-o",
    durationPath,
  ]);
  if (probeExit !== 0) {
    throw new Error("Could not read video duration");
  }
  const durationData = await ffmpeg.readFile(durationPath, "utf8");
  const durationSec = Math.max(1, parseFloat(String(durationData).trim() || "1"));

  const targetVideoBytes = targetMaxBytes * 0.9;
  const targetBitrateK = Math.floor((targetVideoBytes * 8) / durationSec / 1000);

  onProgress?.(15, "Compressing video...");
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const exitCode = await ffmpeg.exec(
    [
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-b:v",
      `${targetBitrateK}k`,
      "-maxrate",
      `${targetBitrateK}k`,
      "-bufsize",
      `${targetBitrateK * 2}k`,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-y",
      outputPath,
    ],
    TEN_MINUTES_MS,
    {}
  );

  if (exitCode !== 0) {
    throw new Error("Video compression failed");
  }

  onProgress?.(95, "Reading result...");
  const data = await ffmpeg.readFile(outputPath);
  const outName = file.name.replace(/\.[^.]+$/i, ".mp4") || "video.mp4";
  onProgress?.(100, "Done");

  try {
    await ffmpeg.deleteFile(inputPath);
    await ffmpeg.deleteFile(outputPath);
    await ffmpeg.deleteFile(durationPath);
  } catch {
    // ignore cleanup errors
  }
  const blobPart = data instanceof Uint8Array ? new Uint8Array(data) : data;
  return new File([blobPart], outName, { type: "video/mp4" });
}
