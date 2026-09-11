"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { formatAppDateTime } from "@/lib/format-date";
import { publicPhotoUrl } from "@/lib/storage";
import type { Photo } from "@/lib/types";

const INTERVAL_MS = 4000;

type SlideshowProps = {
  photos: Photo[];
  open: boolean;
  onClose: () => void;
};

export function Slideshow({ photos, open, onClose }: SlideshowProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const count = photos.length;
  const photo = photos[index] ?? null;

  const go = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setPaused(false);
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || paused || count < 2) return;
    const timer = window.setInterval(() => go(1), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [open, paused, count, go, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, go]);

  if (!open || !photo) return null;

  const src =
    photo.kind === "video"
      ? photo.thumbnail_path
        ? publicPhotoUrl(photo.thumbnail_path)
        : ""
      : publicPhotoUrl(photo.storage_path);
  const videoSrc =
    photo.kind === "video" ? publicPhotoUrl(photo.storage_path) : "";
  const label = photo.title?.trim() || "Diashow";
  const when = formatAppDateTime(photo.taken_at ?? photo.created_at);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Heute Abend — Diashow"
      className="fixed inset-0 z-[80] bg-neutral-950 text-white"
    >
      {videoSrc ? (
        <video
          src={videoSrc}
          poster={src || undefined}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 size-full object-contain"
          onClick={() => setPaused((value) => !value)}
        />
      ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className="absolute inset-0 size-full object-contain"
        draggable={false}
        onClick={() => setPaused((value) => !value)}
        onTouchStart={(event) => {
          const touch = event.changedTouches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) {
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
              setPaused((value) => !value);
            }
            return;
          }
          go(dx < 0 ? 1 : -1);
        }}
      />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto mx-auto flex max-w-5xl items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug">Heute Abend</p>
            <p className="text-sm text-white/75 leading-snug break-words">
              {index + 1} / {count}
              {when ? ` · ${when}` : ""}
              {photo.title ? ` · ${photo.title}` : ""}
              {paused ? " · Pause" : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"
            aria-label="Diashow beenden"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:inline-flex"
            aria-label="Vorheriges Foto"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:inline-flex"
            aria-label="Nächstes Foto"
          >
            <ChevronRight className="size-6" />
          </button>
        </>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10">
        <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-medium ring-1 ring-white/20"
          >
            {paused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
            {paused ? "Weiter" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function slideshowPhotos(photos: Photo[]) {
  const highlights = photos.filter((photo) => photo.is_highlight);
  const source = highlights.length > 0 ? highlights : photos;
  return [...source].sort((a, b) => {
    const aStamp = a.taken_at ?? a.created_at;
    const bStamp = b.taken_at ?? b.created_at;
    return aStamp.localeCompare(bStamp);
  });
}
