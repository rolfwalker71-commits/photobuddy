"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin } from "lucide-react";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { previewPhotoUrl } from "@/lib/storage";
import type { Photo, Profile, ViewerMode } from "@/lib/types";

function dayKey(photo: Photo) {
  return (photo.taken_at ?? photo.created_at).slice(0, 10);
}

type PhotoTimelineProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
};

export function PhotoTimeline({
  photos,
  profiles,
  mode,
  shareKey,
}: PhotoTimelineProps) {
  const groups = photos.reduce<Record<string, Photo[]>>((acc, photo) => {
    const key = dayKey(photo);
    acc[key] = acc[key] ? [...acc[key], photo] : [photo];
    return acc;
  }, {});

  const days = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  if (days.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Die Timeline ist noch leer</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {days.map((day) => {
        let heading = day;
        try {
          heading = format(parseISO(day), "EEEE, d. MMMM yyyy", { locale: de });
        } catch {
          heading = day;
        }
        return (
          <section key={day} className="space-y-3">
            <h2 className="px-1 font-sans text-base font-semibold capitalize leading-snug">
              {heading}
            </h2>
            <ul className="space-y-3">
              {groups[day].map((photo) => {
                const author =
                  profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
                const src = previewPhotoUrl(photo);
                const title = photo.title?.trim() || "";
                const description = photo.description?.trim() || "";
                const location = humanLocationName(photo.location_name);
                const hasText = Boolean(title || description || location);
                return (
                  <li key={photo.id}>
                    <Link
                      href={appHref(mode, shareKey, "photo", photo.id)}
                      className="block overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border transition hover:ring-primary"
                    >
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={title || `Foto von ${author}`}
                          className="aspect-[16/10] w-full object-cover sm:aspect-[2/1]"
                          loading="lazy"
                        />
                        <PhotoImageOverlay
                          photo={photo}
                          authorName={author}
                        />
                      </div>
                      {hasText ? (
                        <div className="space-y-1 px-3 py-2.5">
                          {title ? (
                            <p className="font-medium leading-snug break-words">
                              {title}
                            </p>
                          ) : null}
                          {description ? (
                            <p className="text-sm text-muted-foreground leading-snug break-words">
                              {description}
                            </p>
                          ) : null}
                          {location ? (
                            <p className="flex items-start gap-1 text-sm text-muted-foreground">
                              <MapPin className="mt-0.5 size-3.5 shrink-0" />
                              <span className="break-words">{location}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
