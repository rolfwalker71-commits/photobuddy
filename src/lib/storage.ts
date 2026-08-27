export function publicPhotoUrl(path: string | null | undefined) {
  if (!path) return "";
  const parts = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/api/photos/files/${parts}`;
}
