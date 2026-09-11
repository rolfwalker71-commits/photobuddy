/** App-wide date/time: `10.09.2026` and `10.09.2026 22:01` (24h, zero-padded). */

function two(n: number) {
  return String(n).padStart(2, "0");
}

export function parseAppDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  if (de) {
    const day = Number(de[1]);
    const month = Number(de[2]);
    const year = Number(de[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `yyyy-mm-dd` from an ISO or `dd.mm.yyyy` value. */
export function toIsoDate(value: string | Date | null | undefined): string | null {
  const date = parseAppDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
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
