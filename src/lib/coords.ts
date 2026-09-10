function parseCoordNumber(part: string): number | null {
  const normalized = part.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseCoordPair(input: string): {
  latitude: number;
  longitude: number;
} | null {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const pairMatch = cleaned.match(/^(.+?)\s*,\s*(.+)$/);
  if (pairMatch) {
    const latitude = parseCoordNumber(pairMatch[1]);
    const longitude = parseCoordNumber(pairMatch[2]);
    if (latitude == null || longitude == null) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return null;
    }
    return { latitude, longitude };
  }

  const parts = cleaned.split(/[;\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const latitude = parseCoordNumber(parts[0]);
  const longitude = parseCoordNumber(parts[1]);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

export function formatCoordPair(
  latitude: number | null,
  longitude: number | null,
): string {
  if (latitude == null || longitude == null) return "";
  return `${latitude}, ${longitude}`;
}

export function isValidCoordPair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

export function toValidCoordPair(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number; longitude: number } | null {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return { latitude, longitude };
}
