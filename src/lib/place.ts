const COORD_LABEL = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/;

/** Hide auto-filled "46.8837, 8.6356" labels; only show a real place name. */
export function humanLocationName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || COORD_LABEL.test(trimmed)) return null;
  return trimmed;
}
