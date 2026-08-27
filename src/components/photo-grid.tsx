"use client";

import Link from "next/link";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { appHref } from "@/lib/paths";
import { publicPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoGridProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
};

export function PhotoGrid({ photos, profiles, mode, shareKey }: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Noch keine Fotos</p>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          {mode === "teilnehmer"
            ? "Nimm das erste Foto auf oder lade eines aus der Galerie hoch."
            : "Sobald die Reisegruppe Fotos teilt, erscheinen sie hier."}
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
      {photos.map((photo) => {
        const src = publicPhotoUrl(photo.thumbnail_path ?? photo.storage_path);
        const author = profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
        return (
          <li key={photo.id}>
            <Link
              href={appHref(mode, shareKey, "photo", photo.id)}
              className="group relative block overflow-hidden rounded-2xl bg-muted shadow-card ring-1 ring-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={photo.title || photo.description || `Foto von ${author}`}
                className="aspect-[4/5] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <PhotoImageOverlay photo={photo} authorName={author} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
