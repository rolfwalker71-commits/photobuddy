export const MAX_VIDEO_MS = 15_000;
export const MAX_VOICE_MS = 20_000;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export function pickRecorderMime(kinds: Array<"audio" | "video">) {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates =
    kinds[0] === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]
      : [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus",
          "audio/ogg",
        ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function readVideoMeta(file: File): Promise<{
  durationMs: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      const durationMs = Math.round((video.duration || 0) * 1000);
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        reject(new Error("Videolänge konnte nicht gelesen werden."));
        return;
      }
      resolve({ durationMs, width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video konnte nicht gelesen werden."));
    };
    video.src = url;
  });
}

export async function videoPosterBlob(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Poster fehlgeschlagen."));
    });
    video.currentTime = Math.min(0.2, Math.max(0, (video.duration || 1) / 4));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      window.setTimeout(() => resolve(), 400);
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
