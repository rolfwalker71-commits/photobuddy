import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin } from "lucide-react";
import type { Photo } from "@/lib/types";

type PhotoImageOverlayProps = {
  photo: Photo;
  authorName: string;
  compact?: boolean;
};

function formatOverlayWhen(photo: Photo, compact: boolean) {
  const stamp = photo.taken_at ?? photo.created_at;
  try {
    return format(parseISO(stamp), compact ? "d.M., HH:mm" : "d. MMM, HH:mm", {
      locale: de,
    });
  } catch {
    return stamp;
  }
}

function photoHasGps(photo: Photo) {
  return photo.latitude != null && photo.longitude != null;
}

export function PhotoImageOverlay({
  photo,
  authorName,
  compact = false,
}: PhotoImageOverlayProps) {
  const stamp = photo.taken_at ?? photo.created_at;
  const when = formatOverlayWhen(photo, compact);
  const hasGeo = photoHasGps(photo);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-1 ${
          compact ? "p-1" : "p-1.5"
        }`}
      >
        <time
          dateTime={stamp}
          className={`max-w-[75%] truncate rounded-full bg-neutral-900/65 font-medium leading-snug text-white backdrop-blur-sm ${
            compact
              ? "px-1.5 py-0.5 text-[0.7rem]"
              : "px-2 py-0.5 text-xs"
          }`}
        >
          {when}
        </time>
        {hasGeo ? (
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-900/65 text-white backdrop-blur-sm ${
              compact ? "size-6" : "size-7"
            }`}
          >
            <MapPin className={compact ? "size-3" : "size-3.5"} aria-hidden />
            <span className="sr-only">Mit Standort</span>
          </span>
        ) : null}
      </div>
      <span
        className={`absolute inset-x-0 bottom-0 bg-white/70 text-center font-medium leading-snug text-neutral-900 backdrop-blur-sm ${
          compact
            ? "px-1.5 py-1 text-[0.7rem]"
            : "px-2 py-1.5 text-xs"
        }`}
      >
        <span className="line-clamp-2 break-words">{authorName}</span>
      </span>
    </div>
  );
}
