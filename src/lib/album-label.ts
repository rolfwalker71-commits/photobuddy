import { formatAppDate, parseAppDate } from "@/lib/format-date";
import type { Album } from "@/lib/types";

export function albumEffectiveRange(album: Album) {
  const start = album.starts_on || album.derived_starts_on;
  const end = album.ends_on || album.derived_ends_on || start;
  return { start, end };
}

export function formatDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
) {
  const start = parseAppDate(startIso);
  const end = parseAppDate(endIso ?? startIso);
  if (!start) return null;
  const last = end ?? start;
  const sameDay =
    start.getFullYear() === last.getFullYear() &&
    start.getMonth() === last.getMonth() &&
    start.getDate() === last.getDate();

  if (sameDay) return formatAppDate(start);
  return `${formatAppDate(start)} – ${formatAppDate(last)}`;
}

export function albumSubtitle(album: Album) {
  const { start, end } = albumEffectiveRange(album);
  const range = formatDateRange(start, end);
  return range ? `${album.name} · ${range}` : album.name;
}

export function albumRangeLabel(album: Album) {
  const { start, end } = albumEffectiveRange(album);
  return formatDateRange(start, end);
}
