import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin, MessageCircle } from "lucide-react";
import type { Photo } from "@/lib/types";

type PhotoImageOverlayProps = {
  photo: Photo;
  authorName: string;
  compact?: boolean;
};

function formatOverlayWhen(photo: Photo, compact: boolean) {
  const stamp = photo.taken_at ?? photo.created_at;
  try {
    return format(parseISO(stamp), compact ? "HH:mm" : "d.M., HH:mm", {
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
  const tags = photo.tags ?? [];
  const reactions = photo.reactions ?? [];
  const commentCount = photo.comment_count ?? 0;
  const visibleTags = tags.slice(0, compact ? 1 : 3);
  const visibleReactions = reactions.slice(0, compact ? 2 : 4);
  const hasMeta =
    visibleTags.length > 0 || commentCount > 0 || visibleReactions.length > 0;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-1 ${
          compact ? "p-1" : "p-1.5"
        }`}
      >
        <time
          dateTime={stamp}
          className={`max-w-[70%] truncate rounded-full bg-neutral-900/65 font-medium leading-none text-white backdrop-blur-sm ${
            compact
              ? "px-1.5 py-0.5 text-[0.625rem]"
              : "px-1.5 py-0.5 text-[0.7rem]"
          }`}
        >
          {when}
        </time>
        {hasGeo ? (
          <span
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-900/65 text-white backdrop-blur-sm ${
              compact ? "size-5" : "size-6"
            }`}
          >
            <MapPin className={compact ? "size-2.5" : "size-3"} aria-hidden />
            <span className="sr-only">Mit Standort</span>
          </span>
        ) : null}
      </div>
      <div className="absolute inset-x-0 bottom-0">
        {hasMeta ? (
          <div
            className={`flex flex-wrap items-end gap-0.5 ${
              compact ? "px-1 pb-0.5" : "px-1.5 pb-1"
            }`}
          >
            {visibleTags.map((tag) => (
              <span
                key={tag.tag_id}
                className={`max-w-full truncate rounded-full bg-neutral-900/65 font-medium text-white backdrop-blur-sm ${
                  compact
                    ? "px-1.5 py-0.5 text-[0.625rem]"
                    : "px-2 py-0.5 text-[0.7rem]"
                }`}
              >
                #{tag.name}
              </span>
            ))}
            {commentCount > 0 ? (
              <span
                className={`inline-flex items-center gap-0.5 rounded-full bg-neutral-900/65 font-medium text-white backdrop-blur-sm ${
                  compact
                    ? "px-1.5 py-0.5 text-[0.625rem]"
                    : "px-2 py-0.5 text-[0.7rem]"
                }`}
              >
                <MessageCircle
                  className={compact ? "size-2.5" : "size-3"}
                  aria-hidden
                />
                <span>{commentCount}</span>
                <span className="sr-only">Kommentare</span>
              </span>
            ) : null}
            {visibleReactions.map((reaction) => (
              <span
                key={reaction.emoji}
                className={`inline-flex items-center gap-0.5 rounded-full bg-neutral-900/65 font-medium text-white backdrop-blur-sm ${
                  compact
                    ? "px-1.5 py-0.5 text-[0.625rem]"
                    : "px-2 py-0.5 text-[0.7rem]"
                }`}
              >
                <span aria-hidden>{reaction.emoji}</span>
                {reaction.count > 1 ? <span>{reaction.count}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        <span
          className={`block bg-white/70 text-center font-medium leading-snug text-neutral-900 backdrop-blur-sm ${
            compact ? "px-1.5 py-1 text-[0.7rem]" : "px-2 py-1.5 text-xs"
          }`}
        >
          <span className="line-clamp-2 break-words">{authorName}</span>
        </span>
      </div>
    </div>
  );
}
