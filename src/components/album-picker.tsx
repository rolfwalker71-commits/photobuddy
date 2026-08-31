"use client";

import { ChevronDown } from "lucide-react";
import type { Album } from "@/lib/types";

type AlbumPickerProps = {
  albums: Album[];
  currentId: string | null;
  onChange: (id: string) => void;
};

export function AlbumPicker({ albums, currentId, onChange }: AlbumPickerProps) {
  if (albums.length === 0) return null;
  if (albums.length === 1) {
    return (
      <p className="text-lg font-semibold leading-snug break-words">
        {albums[0].name}
      </p>
    );
  }

  return (
    <label className="relative block min-w-0 max-w-[16rem]">
      <span className="sr-only">Album wechseln</span>
      <select
        className="h-10 w-full appearance-none rounded-full bg-muted py-0 pl-3 pr-9 text-sm font-semibold leading-none"
        value={currentId ?? albums[0].id}
        onChange={(event) => onChange(event.target.value)}
      >
        {albums.map((album) => (
          <option key={album.id} value={album.id}>
            {album.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </label>
  );
}
