"use client";

import { ChevronDown } from "lucide-react";
import { albumRangeLabel, albumSubtitle } from "@/lib/album-label";
import { publicPhotoUrl } from "@/lib/storage";
import type { Album } from "@/lib/types";

type AlbumPickerProps = {
  albums: Album[];
  currentId: string | null;
  onChange: (id: string) => void;
};

export function AlbumPicker({ albums, currentId, onChange }: AlbumPickerProps) {
  if (albums.length === 0) return null;
  const current =
    albums.find((album) => album.id === currentId) ?? albums[0] ?? null;
  const range = current ? albumRangeLabel(current) : null;
  const coverSrc = current?.cover_path
    ? publicPhotoUrl(current.cover_path)
    : "";

  if (albums.length === 1 && current) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverSrc}
            alt=""
            className="size-8 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug break-words">
            {current.name}
          </p>
          {range ? (
            <p className="text-sm text-muted-foreground leading-snug">{range}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt=""
          className="size-8 shrink-0 rounded-lg object-cover"
        />
      ) : null}
      <label className="relative block min-w-0 max-w-[16rem] flex-1">
        <span className="sr-only">Album wechseln</span>
        <select
          className="h-10 w-full appearance-none rounded-full bg-muted py-0 pl-3 pr-9 text-sm font-semibold leading-none"
          value={current?.id ?? albums[0].id}
          onChange={(event) => onChange(event.target.value)}
        >
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {albumSubtitle(album)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </label>
    </div>
  );
}
