export function publicPhotoUrl(path: string | null | undefined) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/api/photos/files/${parts}`;
}

/** Grid / map / timeline: use the full file so old 480px thumbs are not stretched. */
export function previewPhotoUrl(photo: {
  storage_path: string;
  thumbnail_path: string | null;
}) {
  return publicPhotoUrl(photo.storage_path || photo.thumbnail_path);
}
