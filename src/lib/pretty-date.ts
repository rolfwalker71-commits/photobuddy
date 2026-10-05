import { parseAppDate } from "@/lib/format-date";

const MONTHS = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
];

/** `12. Sept. 2026` — short month, no zero padding. */
export function formatPrettyDate(value: string | Date | null | undefined) {
  const date = parseAppDate(value);
  if (!date) return null;
  return `${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * `12. Sept. 2026` for one day, `12.–15. Sept. 2026` within a month,
 * `28. Aug. – 3. Sept. 2026` within a year, full dates across years.
 */
export function formatPrettyRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
) {
  const a = parseAppDate(start);
  if (!a) return null;
  const b = parseAppDate(end ?? start) ?? a;
  const [first, last] = a.getTime() <= b.getTime() ? [a, b] : [b, a];
  if (first.toDateString() === last.toDateString()) return formatPrettyDate(first);
  if (first.getFullYear() !== last.getFullYear()) {
    return `${formatPrettyDate(first)} – ${formatPrettyDate(last)}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}.–${last.getDate()}. ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
  }
  return `${first.getDate()}. ${MONTHS[first.getMonth()]} – ${last.getDate()}. ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}
