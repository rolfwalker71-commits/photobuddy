import type { Photo, PhotoFilters } from "@/lib/types";

export const emptyFilters: PhotoFilters = {
  uploaderId: "",
  dateFrom: "",
  dateTo: "",
  location: "",
  tagNames: [],
  onlyNew: false,
  onlyHighlights: false,
};

export function filterPhotos(
  photos: Photo[],
  filters: PhotoFilters,
  opts?: { lastSeenAt?: string | null },
) {
  return photos.filter((photo) => {
    if (filters.uploaderId && photo.uploaded_by !== filters.uploaderId) {
      return false;
    }
    const stamp = photo.taken_at ?? photo.created_at;
    if (filters.dateFrom && stamp.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && stamp.slice(0, 10) > filters.dateTo) return false;
    if (filters.location) {
      const q = filters.location.trim().toLowerCase();
      const hay = (photo.location_name ?? "").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.tagNames.length > 0) {
      const names = new Set(
        (photo.tags ?? []).map((tag) => tag.name.toLowerCase()),
      );
      const need = filters.tagNames.map((t) => t.toLowerCase());
      if (!need.every((tag) => names.has(tag))) return false;
    }
    if (filters.onlyHighlights && !photo.is_highlight) return false;
    if (filters.onlyNew) {
      const lastSeen = opts?.lastSeenAt;
      if (!lastSeen || photo.created_at <= lastSeen) return false;
    }
    return true;
  });
}

export function isFiltered(filters: PhotoFilters) {
  return Boolean(
    filters.uploaderId ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.location ||
      filters.tagNames.length > 0 ||
      filters.onlyNew ||
      filters.onlyHighlights,
  );
}
