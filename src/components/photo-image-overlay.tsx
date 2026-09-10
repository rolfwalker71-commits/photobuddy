import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin, MessageCircle, Sparkles } from "lucide-react";
import { isPhotoNew } from "@/lib/last-seen";
import type { Photo } from "@/lib/types";

function reactionLabel(emoji: string, names: string[], count: number) {
  if (names.length === 0) {
    return count > 1 ? `${emoji} ${count}` : emoji;
  }
  const shown = names.slice(0, 2);
  const extra = names.length - shown.length;
  return `${emoji} ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
}

type PhotoImageOverlayProps = {
  photo: Photo;
  authorName: string;
  compact?: boolean;
  lastSeenAt?: string | null;
};

/** Compact overlay stamp: `10.9.` + `14:32` (day.month. + 24h time). */
function formatOverlayWhenParts(photo: Photo) {
  const stamp = photo.taken_at ?? photo.created_at;
  try {
    const date = parseISO(stamp);
    if (Number.isNaN(date.getTime())) {
      return { day: stamp, time: null as string | null };
    }
    return {
      day: format(date, "d.M.", { locale: de }),
      time: format(date, "HH:mm", { locale: de }),
    };
  } catch {
    return { day: stamp, time: null as string | null };
  }
}

function photoHasGps(photo: Photo) {
  return photo.latitude != null && photo.longitude != null;
}

export function PhotoImageOverlay({
  photo,
  authorName,
  compact = false,
  lastSeenAt = null,
}: PhotoImageOverlayProps) {
  const stamp = photo.taken_at ?? photo.created_at;
  const when = formatOverlayWhenParts(photo);
  const hasGeo = photoHasGps(photo);
  const tags = photo.tags ?? [];
  const reactions = photo.reactions ?? [];
  const commentCount = photo.comment_count ?? 0;
  const visibleTags = tags.slice(0, compact ? 1 : 3);
  const visibleReactions = reactions.slice(0, compact ? 1 : 3);
  const isNew = isPhotoNew(photo.created_at, lastSeenAt);
  const hasMeta =
    visibleTags.length > 0 || commentCount > 0 || visibleReactions.length > 0;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-1 ${
          compact ? "p-1" : "p-1.5"
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-0.5">
          {isNew ? (
            <span
              className={`rounded-full bg-accent font-semibold leading-none text-accent-foreground ${
                compact
                  ? "px-1.5 py-0.5 text-[0.625rem]"
                  : "px-1.5 py-0.5 text-[0.7rem]"
              }`}
            >
              Neu
            </span>
          ) : null}
          {photo.is_highlight ? (
            <span
              className={`inline-flex items-center rounded-full bg-neutral-900/65 text-amber-300 backdrop-blur-sm ${
                compact ? "p-0.5" : "p-1"
              }`}
            >
              <Sparkles className={compact ? "size-2.5" : "size-3"} aria-hidden />
              <span className="sr-only">Highlight</span>
            </span>
          ) : null}
          <time
            dateTime={stamp}
            className={`inline-flex w-max min-w-0 max-w-full flex-wrap items-center justify-center rounded-lg bg-neutral-900/65 font-medium leading-none text-white backdrop-blur-sm ${
              compact
                ? "gap-x-0.5 gap-y-px px-1 py-0.5 text-[0.5625rem]"
                : "gap-x-0.5 gap-y-px px-1.5 py-0.5 text-[0.625rem]"
            }`}
          >
            <span className="whitespace-nowrap">{when.day}</span>
            {when.time ? (
              <span className="whitespace-nowrap tabular-nums">{when.time}</span>
            ) : null}
          </time>
        </div>
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
                className={`inline-flex max-w-full items-center gap-0.5 truncate rounded-full bg-neutral-900/65 font-medium text-white backdrop-blur-sm ${
                  compact
                    ? "px-1.5 py-0.5 text-[0.625rem]"
                    : "px-2 py-0.5 text-[0.7rem]"
                }`}
              >
                {reactionLabel(
                  reaction.emoji,
                  reaction.names ?? [],
                  reaction.count,
                )}
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
