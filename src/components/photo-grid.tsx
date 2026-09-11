"use client";

import Link from "next/link";
import { Check, Play, Star, Video } from "lucide-react";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { appHref } from "@/lib/paths";
import { previewPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoGridProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
  lastSeenAt?: string | null;
  onToggleHighlight?: (photo: Photo) => void;
  selecting?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (photo: Photo) => void;
  duplicateIds?: Set<string>;
};

export function PhotoGrid({
  photos,
  profiles,
  mode,
  shareKey,
  lastSeenAt = null,
  onToggleHighlight,
  selecting = false,
  selectedIds,
  onToggleSelect,
  duplicateIds,
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Noch keine Fotos</p>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          {mode === "teilnehmer"
            ? "Nimm das erste Foto auf oder lade ein kurzes Video aus der Galerie hoch."
            : "Sobald die Reisegruppe Fotos teilt, erscheinen sie hier."}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {photos.map((photo) => {
        const src = previewPhotoUrl(photo);
        const author = profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
        const selected = selectedIds?.has(photo.id) ?? false;
        const isVideo = photo.kind === "video";
        const tile = (
          <>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={photo.title || photo.description || `Foto von ${author}`}
                className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full items-center justify-center bg-muted">
                <Video className="size-8 text-muted-foreground" aria-hidden />
              </div>
            )}
            {isVideo ? (
              <span className="absolute left-2 bottom-10 z-[1] inline-flex items-center gap-1 rounded-full bg-neutral-900/70 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
                <Play className="size-3 fill-white" aria-hidden />
                Video
              </span>
            ) : null}
            <PhotoImageOverlay
              photo={photo}
              authorName={author}
              lastSeenAt={lastSeenAt}
              duplicate={duplicateIds?.has(photo.id) ?? false}
            />
          </>
        );
        return (
          <li key={photo.id}>
            <div className="relative">
              {selecting && onToggleSelect ? (
                <button
                  type="button"
                  onClick={() => onToggleSelect(photo)}
                  aria-pressed={selected}
                  className={`group relative block w-full overflow-hidden rounded-2xl bg-muted shadow-card ring-1 ${
                    selected ? "ring-2 ring-primary" : "ring-border"
                  }`}
                >
                  {tile}
                  <span
                    className={`absolute left-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-full ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-neutral-900/55 text-white"
                    }`}
                  >
                    <Check className="size-4" aria-hidden />
                    <span className="sr-only">
                      {selected ? "Auswahl entfernen" : "Auswählen"}
                    </span>
                  </span>
                </button>
              ) : (
                <Link
                  href={appHref(mode, shareKey, "photo", photo.id)}
                  className="group relative block overflow-hidden rounded-2xl bg-muted shadow-card ring-1 ring-border"
                >
                  {tile}
                </Link>
              )}
              {mode === "teilnehmer" && onToggleHighlight && !selecting ? (
                <button
                  type="button"
                  onClick={() => onToggleHighlight(photo)}
                  className="absolute right-0.5 top-6 z-10 inline-flex min-h-10 min-w-10 items-center justify-center"
                  aria-label={
                    photo.is_highlight
                      ? "Highlight entfernen"
                      : "Als Highlight markieren"
                  }
                  aria-pressed={photo.is_highlight}
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-neutral-900/65 text-white backdrop-blur-sm">
                    <Star
                      className={`size-3.5 ${photo.is_highlight ? "fill-amber-300 text-amber-300" : ""}`}
                    />
                  </span>
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
