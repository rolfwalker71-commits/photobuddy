"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { DayNoteBlock } from "@/components/day-note-editor";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { groupPhotosByDay, noteForDay } from "@/lib/chapters";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { previewPhotoUrl } from "@/lib/storage";
import type { DayNote, Photo, Profile, ViewerMode } from "@/lib/types";

type PhotoTimelineProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
  albumId?: string | null;
  dayNotes?: DayNote[];
  lastSeenAt?: string | null;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onNotesChange?: (notes: DayNote[]) => void;
  onToggleHighlight?: (photo: Photo) => void;
};

export function PhotoTimeline({
  photos,
  profiles,
  mode,
  shareKey,
  albumId,
  dayNotes = [],
  lastSeenAt = null,
  currentUserId = null,
  isAdmin = false,
  onNotesChange,
  onToggleHighlight,
}: PhotoTimelineProps) {
  const [extraDay, setExtraDay] = useState("");
  const extraDays = [
    ...dayNotes.map((note) => note.note_date.slice(0, 10)),
    extraDay,
  ].filter(Boolean);
  const chapters = groupPhotosByDay(photos, extraDays);

  if (chapters.length === 0 && mode === "guest") {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
        <p className="font-medium">Die Timeline ist noch leer</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mode === "teilnehmer" && albumId ? (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-card p-3 shadow-card ring-1 ring-border">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Tag ohne Foto
            </span>
            <input
              type="date"
              data-empty={extraDay ? "false" : "true"}
              className="date-field h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              value={extraDay}
              onChange={(event) => setExtraDay(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      {chapters.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center shadow-card ring-1 ring-border">
          <p className="font-medium">Die Timeline ist noch leer</p>
        </div>
      ) : null}
      {chapters.map((chapter) => {
        const note = noteForDay(dayNotes, chapter.day);
        return (
          <section key={chapter.day} className="space-y-3">
            <h2 className="px-1 font-sans text-base font-semibold leading-snug break-words">
              {chapter.heading}
            </h2>
            {albumId && onNotesChange ? (
              <DayNoteBlock
                albumId={albumId}
                day={chapter.day}
                note={note}
                mode={mode}
                shareKey={shareKey}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onChange={onNotesChange}
              />
            ) : note ? (
              <p className="rounded-2xl bg-card px-3 py-2.5 text-sm leading-snug shadow-card ring-1 ring-border">
                {note.body}
              </p>
            ) : null}
            <ul className="space-y-3">
              {chapter.photos.map((photo) => {
                const author =
                  profiles[photo.uploaded_by]?.display_name ?? "Unbekannt";
                const src = previewPhotoUrl(photo);
                const title = photo.title?.trim() || "";
                const description = photo.description?.trim() || "";
                const location = humanLocationName(photo.location_name);
                const hasText = Boolean(title || description || location);
                return (
                  <li key={photo.id} className="relative">
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
                          lastSeenAt={lastSeenAt}
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
                    {mode === "teilnehmer" && onToggleHighlight ? (
                      <button
                        type="button"
                        onClick={() => onToggleHighlight(photo)}
                        className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-2xl bg-neutral-900/65 text-white backdrop-blur-sm"
                        aria-label={
                          photo.is_highlight
                            ? "Highlight entfernen"
                            : "Als Highlight markieren"
                        }
                        aria-pressed={photo.is_highlight}
                      >
                        <Star
                          className={`size-5 ${photo.is_highlight ? "fill-amber-300 text-amber-300" : ""}`}
                        />
                      </button>
                    ) : null}
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
