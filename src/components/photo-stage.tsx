"use client";

import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { publicPhotoUrl } from "@/lib/storage";
import type { Photo } from "@/lib/types";

export type PhotoNeighbor = { id: string; storage_path: string };

type PhotoStageProps = {
  photo: Photo;
  prev: PhotoNeighbor | null;
  next: PhotoNeighbor | null;
  onPrev: () => void;
  onNext: () => void;
  imageRef: RefObject<HTMLImageElement | null>;
};

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

export function PhotoStage({
  photo,
  prev,
  next,
  onPrev,
  onNext,
  imageRef,
}: PhotoStageProps) {
  const start = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );

  useEffect(() => {
    const urls = [prev, next]
      .filter((item): item is PhotoNeighbor => item != null)
      .map((item) => publicPhotoUrl(item.storage_path));
    const images = urls.map((src) => {
      const image = new window.Image();
      image.src = src;
      return image;
    });
    return () => {
      for (const image of images) image.src = "";
    };
  }, [prev, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTextEntryTarget(event.target)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") onPrev();
      else onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPrev, onNext]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    start.current = null;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 56) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.15) return;
    if (dx < 0) onNext();
    else onPrev();
  }

  return (
    <div
      className="relative touch-pan-y overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border"
      onPointerDown={onPointerDown}
      onPointerUp={finishSwipe}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={publicPhotoUrl(photo.storage_path)}
        alt={photo.title || photo.description || "Reise-Foto"}
        className="max-h-[80vh] w-full select-none object-contain"
        draggable={false}
      />
      <button
        type="button"
        aria-label="Vorheriges Foto"
        disabled={!prev}
        onClick={onPrev}
        className="absolute left-2 top-1/2 z-10 inline-flex size-11 min-h-11 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/65 text-white shadow-card backdrop-blur-sm disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Nächstes Foto"
        disabled={!next}
        onClick={onNext}
        className="absolute right-2 top-1/2 z-10 inline-flex size-11 min-h-11 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/65 text-white shadow-card backdrop-blur-sm disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-6" aria-hidden />
      </button>
    </div>
  );
}
