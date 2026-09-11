const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  weba: "audio/webm",
};

export function extFromMime(mime: string | null | undefined, fallback = "bin") {
  const type = (mime ?? "").split(";")[0].trim().toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  if (type === "video/quicktime") return "mov";
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/mpeg") return "mp3";
  if (type === "audio/mp4") return "m4a";
  if (type === "audio/webm") return "webm";
  return fallback;
}

export function mimeFromPath(
  relative: string,
  fallback = "application/octet-stream",
) {
  const ext = relative.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? fallback;
}

export function isVideoMime(mime: string | null | undefined) {
  return (mime ?? "").startsWith("video/");
}

export function isAudioMime(mime: string | null | undefined) {
  return (mime ?? "").startsWith("audio/");
}
