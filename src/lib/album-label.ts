import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import type { Album } from "@/lib/types";

function parseDay(value: string | null | undefined) {
  if (!value) return null;
  const iso = value.length === 10 ? `${value}T00:00:00` : value;
  try {
    const date = parseISO(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function albumEffectiveRange(album: Album) {
  const start = album.starts_on || album.derived_starts_on;
  const end = album.ends_on || album.derived_ends_on || start;
  return { start, end };
}

export function formatDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
) {
  const start = parseDay(startIso);
  const end = parseDay(endIso ?? startIso);
  if (!start) return null;
  const last = end ?? start;
  const sameDay =
    start.getFullYear() === last.getFullYear() &&
    start.getMonth() === last.getMonth() &&
    start.getDate() === last.getDate();
  const sameMonth =
    start.getFullYear() === last.getFullYear() &&
    start.getMonth() === last.getMonth();
  const sameYear = start.getFullYear() === last.getFullYear();

  if (sameDay) return format(start, "d. MMMM", { locale: de });
  if (sameMonth) {
    return `${format(start, "d.", { locale: de })}–${format(last, "d. MMMM", { locale: de })}`;
  }
  if (sameYear) {
    return `${format(start, "d. MMMM", { locale: de })} – ${format(last, "d. MMMM", { locale: de })}`;
  }
  return `${format(start, "d. MMMM yyyy", { locale: de })} – ${format(last, "d. MMMM yyyy", { locale: de })}`;
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
