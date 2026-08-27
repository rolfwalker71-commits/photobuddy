import type { Photo, PhotoFilters } from "@/lib/types";

export const emptyFilters: PhotoFilters = {
  uploaderId: "",
  dateFrom: "",
  dateTo: "",
  location: "",
};

export function filterPhotos(photos: Photo[], filters: PhotoFilters) {
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
    return true;
  });
}

export function isFiltered(filters: PhotoFilters) {
  return Boolean(
    filters.uploaderId || filters.dateFrom || filters.dateTo || filters.location,
  );
}
