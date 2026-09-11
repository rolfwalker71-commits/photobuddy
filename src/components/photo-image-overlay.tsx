import { Copy, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { WeatherChip } from "@/components/weather-chip";
import { formatOverlayWhen } from "@/lib/format-date";
import { humanLocationName } from "@/lib/image";
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
  duplicate?: boolean;
  /** Leave room for the interactive favorite star on the same row. */
  favoriteSlot?: boolean;
};

function photoHasGps(photo: Photo) {
  return photo.latitude != null && photo.longitude != null;
}

export function PhotoImageOverlay({
  photo,
  authorName,
  compact = false,
  lastSeenAt = null,
  duplicate = false,
  favoriteSlot = false,
}: PhotoImageOverlayProps) {
  const stamp = photo.taken_at ?? photo.created_at;
  const when = formatOverlayWhen(stamp);
  const hasGeo = photoHasGps(photo);
  const placeName = humanLocationName(photo.location_name);
  const tags = photo.tags ?? [];
  const reactions = photo.reactions ?? [];
  const commentCount = photo.comment_count ?? 0;
  const visibleTags = tags.slice(0, compact ? 1 : 3);
  const visibleReactions = reactions.slice(0, compact ? 1 : 3);
  const isNew = isPhotoNew(photo.created_at, lastSeenAt);
  const hasMeta =
    visibleTags.length > 0 || commentCount > 0 || visibleReactions.length > 0;
  const showHighlight = photo.is_highlight && !favoriteSlot;
  const hasRightChrome = hasGeo || showHighlight;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className={`absolute inset-x-0 top-0 ${compact ? "p-1" : "p-1.5"}`}
      >
        <div className="relative flex items-start justify-between gap-1">
          <div className="z-[1] flex min-w-0 max-w-[46%] flex-col items-start gap-0.5">
            <time
              dateTime={stamp}
              className={`inline-flex w-max max-w-full flex-col items-start rounded-lg bg-neutral-900/65 font-medium leading-snug text-white backdrop-blur-sm ${
                compact
                  ? "gap-px px-1 py-0.5 text-[0.625rem]"
                  : "gap-0.5 px-1.5 py-1 text-xs"
              }`}
            >
              <span className="break-words">{when.day}</span>
              {when.time ? (
                <span className="break-words tabular-nums">{when.time}</span>
              ) : null}
              {when.zurichTime ? (
                <span
                  className={`break-words tabular-nums text-white/75 ${
                    compact ? "text-[0.5rem]" : "text-[0.625rem]"
                  }`}
                >
                  {when.zurichTime} ZH
                </span>
              ) : null}
            </time>
            <WeatherChip
              code={photo.weather_code}
              tempC={photo.weather_temp_c}
              compact={compact}
            />
            {duplicate ? (
              <span
                className={`inline-flex max-w-full items-center gap-0.5 rounded-full bg-neutral-900/45 font-medium leading-snug text-white/80 backdrop-blur-sm ${
                  compact
                    ? "px-1 py-0.5 text-[0.625rem]"
                    : "px-1.5 py-0.5 text-[0.625rem]"
                }`}
                title="Ähnliches Foto im Album"
              >
                <Copy className={compact ? "size-2.5" : "size-3"} aria-hidden />
                <span className="break-words">Doppelt</span>
              </span>
            ) : null}
          </div>

          {isNew ? (
            <span
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent font-semibold leading-none text-accent-foreground ${
                compact
                  ? "px-1.5 py-0.5 text-[0.625rem]"
                  : "px-2 py-0.5 text-[0.7rem]"
              }`}
            >
              Neu
            </span>
          ) : null}

          {hasRightChrome ? (
            <div
              className={`z-[1] flex shrink-0 items-center justify-end gap-0.5 ${
                favoriteSlot ? "pr-8" : ""
              }`}
            >
              {hasGeo ? (
                <span
                  className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-900/65 text-white backdrop-blur-sm ${
                    compact ? "size-5" : "size-7"
                  }`}
                >
                  <MapPin
                    className={compact ? "size-2.5" : "size-3.5"}
                    aria-hidden
                  />
                  <span className="sr-only">
                    {placeName ? `Standort: ${placeName}` : "Mit Standort"}
                  </span>
                </span>
              ) : null}
              {showHighlight ? (
                <span
                  className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-900/65 text-amber-300 backdrop-blur-sm ${
                    compact ? "size-5" : "size-7"
                  }`}
                >
                  <Sparkles
                    className={compact ? "size-2.5" : "size-3.5"}
                    aria-hidden
                  />
                  <span className="sr-only">Highlight</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
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
                className={`max-w-full break-words rounded-full bg-neutral-900/65 font-medium leading-snug text-white backdrop-blur-sm ${
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
                className={`inline-flex items-center gap-0.5 rounded-full bg-neutral-900/65 font-medium leading-snug text-white backdrop-blur-sm ${
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
                className={`inline-flex max-w-full items-center gap-0.5 break-words rounded-full bg-neutral-900/65 font-medium leading-snug text-white backdrop-blur-sm ${
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
        {placeName ? (
          <div
            className={`flex justify-end ${
              compact ? "px-1 pb-0.5" : "px-1.5 pb-1"
            }`}
          >
            <span
              title={placeName}
              className={`inline-block max-w-[min(14rem,85%)] rounded-md bg-neutral-900/65 text-right font-medium leading-snug text-white backdrop-blur-sm ${
                compact
                  ? "px-1 py-0.5 text-[0.5625rem]"
                  : "px-1.5 py-0.5 text-[0.625rem]"
              }`}
            >
              <span className="line-clamp-2 break-words">{placeName}</span>
            </span>
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
