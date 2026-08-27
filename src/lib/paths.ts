import type { ViewerMode } from "@/lib/types";

export function withShareKey(path: string, key: string | null) {
  if (!key) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}key=${encodeURIComponent(key)}`;
}

export function appHref(
  mode: ViewerMode,
  key: string | null,
  route: "gallery" | "map" | "timeline" | "camera" | "settings" | "photo",
  photoId?: string,
) {
  if (mode === "guest") {
    if (route === "photo" && photoId) {
      return withShareKey(`/gallery/share/photos/${photoId}`, key);
    }
    if (route === "map") return withShareKey("/gallery/share/map", key);
    if (route === "timeline") return withShareKey("/gallery/share/timeline", key);
    return withShareKey("/gallery/share", key);
  }
  if (route === "photo" && photoId) return `/photos/${photoId}`;
  if (route === "gallery") return "/gallery";
  return `/${route}`;
}
