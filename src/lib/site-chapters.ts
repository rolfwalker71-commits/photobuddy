/** Trip chapter of the website, from its public `/route.json`. Times are local wall clock. */
export type SiteChapter = {
  schluessel: string;
  nummer: number;
  titel: string;
  farbe: string;
  /** "YYYY-MM-DDTHH:MM", local time as on the ticket */
  von: string | null;
  bis: string | null;
};

export function isSiteChapter(value: unknown): value is SiteChapter {
  const chapter = value as Partial<SiteChapter> | null;
  return Boolean(
    chapter &&
      typeof chapter.schluessel === "string" &&
      chapter.schluessel &&
      typeof chapter.titel === "string",
  );
}

/**
 * Chapter for a local time ("YYYY-MM-DDTHH:MM"), like the site's
 * abschnittNaechst(): inside a chapter (the later one on overlap), otherwise
 * the last one that has started, before the trip the first one.
 */
export function chapterAt(chapters: SiteChapter[], local: string): SiteChapter | null {
  const timed = chapters.filter((chapter) => chapter.von && chapter.bis);
  if (!local || timed.length === 0) return null;
  let hit: SiteChapter | null = null;
  for (const chapter of timed) {
    if (local >= chapter.von! && local <= chapter.bis!) hit = chapter;
  }
  if (hit) return hit;
  let nearest = timed[0];
  for (const chapter of timed) {
    if (chapter.von! <= local) nearest = chapter;
  }
  return nearest;
}
