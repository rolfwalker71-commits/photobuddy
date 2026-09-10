export function parseCoordPair(input: string): {
  latitude: number;
  longitude: number;
} | null {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  const parts = cleaned.split(/[,;\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const latitude = Number(parts[0].replace(",", "."));
  const longitude = Number(parts[1].replace(",", "."));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
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
