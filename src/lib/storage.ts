export function publicPhotoUrl(path: string | null | undefined) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/api/photos/files/${parts}`;
}

/** Grid / map / timeline: prefer thumbnail; detail views use storage_path. */
export function previewPhotoUrl(photo: {
  storage_path: string;
  thumbnail_path: string | null;
  kind?: string | null;
}) {
  if (photo.kind === "video" && !photo.thumbnail_path) return "";
  return publicPhotoUrl(photo.thumbnail_path || photo.storage_path);
}
