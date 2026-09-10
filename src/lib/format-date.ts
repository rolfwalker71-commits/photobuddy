/** App-wide date/time: `10.09.2026` and `10.09.2026 22:01` (24h, zero-padded). */

export function parseAppDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = value.trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function two(n: number) {
  return String(n).padStart(2, "0");
}

/** `dd.mm.yyyy` — e.g. `10.09.2026`. */
export function formatAppDate(value: string | Date | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** `hh:mm` 24h — e.g. `22:01`. */
export function formatAppTime(value: string | Date | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return "";
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** `dd.mm.yyyy hh:mm` — e.g. `10.09.2026 22:01`. */
export function formatAppDateTime(value: string | Date | null | undefined): string {
  const date = parseAppDate(value);
  if (!date) return typeof value === "string" ? value : "";
  return `${formatAppDate(date)} ${formatAppTime(date)}`;
}
