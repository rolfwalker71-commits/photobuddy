/** The five main sections; each has its own colour (CSS tokens `--section-*`). */
export type Section = "gallery" | "map" | "timeline" | "camera" | "more";

/** Which section a path belongs to; everything unknown (photo, recap) is Galerie. */
export function sectionForPath(pathname: string): Section {
  if (pathname.includes("/map")) return "map";
  if (pathname.includes("/timeline")) return "timeline";
  if (pathname.startsWith("/camera")) return "camera";
  if (pathname.startsWith("/settings") || pathname.startsWith("/admin")) return "more";
  return "gallery";
}

export function sectionColorVar(section: Section) {
  return `--section-${section}`;
}
