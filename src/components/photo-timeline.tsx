"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Play, Star, Video } from "lucide-react";
import { DayNoteBlock } from "@/components/day-note-editor";
import { DayVoiceBlock } from "@/components/day-voice-note";
import { PhotoImageOverlay } from "@/components/photo-image-overlay";
import { groupPhotosByDay, noteForDay } from "@/lib/chapters";
import { humanLocationName } from "@/lib/image";
import { appHref } from "@/lib/paths";
import { previewPhotoUrl } from "@/lib/storage";
import type { DayNote, DayVoiceNote, Photo, Profile, ViewerMode } from "@/lib/types";

function voiceForDay(notes: DayVoiceNote[], day: string) {
  return notes.find((note) => note.note_date.slice(0, 10) === day) ?? null;
}

type PhotoTimelineProps = {
  photos: Photo[];
  profiles: Record<string, Profile>;
  mode: ViewerMode;
  shareKey: string | null;
  albumId?: string | null;
  dayNotes?: DayNote[];
  voiceNotes?: DayVoiceNote[];
  lastSeenAt?: string | null;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onNotesChange?: (notes: DayNote[]) => void;
  onVoiceNotesChange?: (notes: DayVoiceNote[]) => void;
  onToggleHighlight?: (photo: Photo) => void;
  onShiftDay?: (day: string, hours: number) => Promise<void>;
  duplicateIds?: Set<string>;
};

export function PhotoTimeline({
  photos,
  profiles,
  mode,
  shareKey,
  albumId,
  dayNotes = [],
  voiceNotes = [],
  lastSeenAt = null,
  currentUserId = null,
  isAdmin = false,
  onNotesChange,
  onVoiceNotesChange,
  onToggleHighlight,
  onShiftDay,
  duplicateIds,
}: PhotoTimelineProps) {
  const [extraDay, setExtraDay] = useState("");
  const [shiftHours, setShiftHours] = useState<Record<string, string>>({});
  const extraDays = [
    ...dayNotes.map((note) => note.note_date.slice(0, 10)),
    ...voiceNotes.map((note) => note.note_date.slice(0, 10)),
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
        const voice = voiceForDay(voiceNotes, chapter.day);
        const hours = shiftHours[chapter.day] ?? "1";
        return (
          <section key={chapter.day} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 px-1">
              <h2 className="min-w-0 font-sans text-base font-semibold leading-snug break-words">
                {chapter.heading}
              </h2>
              {mode === "teilnehmer" && onShiftDay && chapter.photos.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="sr-only" htmlFor={`shift-${chapter.day}`}>
                    Stunden verschieben
                  </label>
                  <input
                    id={`shift-${chapter.day}`}
                    type="number"
                    min={-24}
                    max={24}
                    step={1}
                    className="h-11 w-16 rounded-2xl border border-border bg-card px-2 text-sm tabular-nums"
                    value={hours}
                    onChange={(event) =>
                      setShiftHours((prev) => ({
                        ...prev,
                        [chapter.day]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = Number(hours);
                      if (!Number.isInteger(value) || value === 0) return;
                      void onShiftDay(chapter.day, value);
                    }}
                    className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-xs font-medium leading-snug"
                  >
                    Fotos dieses Tages um Stunden verschieben
                  </button>
                </div>
              ) : null}
            </div>
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
            {albumId && onVoiceNotesChange ? (
              <DayVoiceBlock
                albumId={albumId}
                day={chapter.day}
                note={voice}
                mode={mode}
                shareKey={shareKey}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onChange={onVoiceNotesChange}
              />
            ) : voice && albumId ? (
              <DayVoiceBlock
                albumId={albumId}
                day={chapter.day}
                note={voice}
                mode={mode}
                shareKey={shareKey}
                currentUserId={null}
                isAdmin={false}
                onChange={() => undefined}
              />
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
                const isVideo = photo.kind === "video";
                return (
                  <li key={photo.id} className="relative">
                    <Link
                      href={appHref(mode, shareKey, "photo", photo.id)}
                      className="block overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border transition hover:ring-primary"
                    >
                      <div className="relative">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={title || `Foto von ${author}`}
                            className="aspect-[16/10] w-full object-cover sm:aspect-[2/1]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted sm:aspect-[2/1]">
                            <Video className="size-10 text-muted-foreground" />
                          </div>
                        )}
                        {isVideo ? (
                          <span className="absolute left-3 bottom-12 z-[1] inline-flex items-center gap-1 rounded-full bg-neutral-900/70 px-2 py-1 text-xs font-semibold text-white">
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
                        className="absolute right-1 top-6 z-10 inline-flex min-h-10 min-w-10 items-center justify-center"
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
