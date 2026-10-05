"use client";

import { useMemo } from "react";
import { albumEffectiveRange } from "@/lib/album-label";
import { albumStats, pluralize } from "@/lib/album-stats";
import { formatPrettyRange } from "@/lib/pretty-date";
import type { Album, Photo, Profile } from "@/lib/types";

type AlbumHeaderCardProps = {
  album: Album;
  photos: Photo[];
  profileById: Record<string, Profile>;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** The hero at the top of the gallery: indigo-to-coral card with the album's numbers. */
export function AlbumHeaderCard({ album, photos, profileById }: AlbumHeaderCardProps) {
  const stats = useMemo(() => albumStats(photos), [photos]);
  const members = useMemo(() => {
    const ids = album.member_ids?.length
      ? album.member_ids
      : [...new Set(photos.map((photo) => photo.uploaded_by))];
    return ids.map((id) => profileById[id]).filter((p): p is Profile => Boolean(p));
  }, [album.member_ids, photos, profileById]);

  const { start, end } = albumEffectiveRange(album);
  const range = formatPrettyRange(start ?? stats.firstDay, end ?? stats.lastDay);
  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  return (
    <section className="brand-hero glass-squircle p-5" aria-label={`Album ${album.name}`}>
      <div className="relative space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-xl font-semibold leading-snug break-words">{album.name}</h2>
          {range ? <p className="text-sm leading-snug text-white/85">{range}</p> : null}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          <span>{pluralize(stats.photos, "Foto", "Fotos")}</span>
          <span>{pluralize(stats.videos, "Video", "Videos")}</span>
          <span>{pluralize(stats.days, "Tag", "Tage")}</span>
        </p>
        {shown.length > 0 ? (
          <div className="flex items-center" aria-label="Mitglieder">
            {shown.map((member, index) => (
              <span
                key={member.id}
                title={member.display_name}
                className={`inline-flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white/80 ${
                  index > 0 ? "-ml-2" : ""
                }`}
                style={{ backgroundColor: member.accent_color }}
              >
                {initials(member.display_name)}
              </span>
            ))}
            {extra > 0 ? (
              <span className="-ml-2 inline-flex size-8 items-center justify-center rounded-full bg-white/25 text-xs font-semibold ring-2 ring-white/80">
                +{extra}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
