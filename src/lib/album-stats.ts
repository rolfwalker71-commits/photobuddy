import { photoDayKey } from "@/lib/chapters";
import type { Photo } from "@/lib/types";

export type AlbumStats = {
  photos: number;
  videos: number;
  days: number;
  /** Earliest / latest day as `yyyy-mm-dd`, from the photos' own dates. */
  firstDay: string | null;
  lastDay: string | null;
};

/** Counts for the album header card. */
export function albumStats(photos: Photo[]): AlbumStats {
  let videos = 0;
  const days = new Set<string>();
  for (const photo of photos) {
    if (photo.kind === "video") videos += 1;
    days.add(photoDayKey(photo));
  }
  const sorted = [...days].sort();
  return {
    photos: photos.length - videos,
    videos,
    days: days.size,
    firstDay: sorted[0] ?? null,
    lastDay: sorted[sorted.length - 1] ?? null,
  };
}

export function pluralize(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
