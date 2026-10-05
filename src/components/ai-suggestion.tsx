"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Sparkle } from "@/components/illustrations";
import {
  AiError,
  describePatchBody,
  describePhoto,
  type AiDescription,
} from "@/lib/ai-client";
import { api } from "@/lib/api";
import { notifyPhotosChanged } from "@/lib/photos-sync";
import type { Photo, PhotoTag } from "@/lib/types";

type AiSuggestionProps = {
  photo: Photo;
  tags: PhotoTag[];
  onApplied: (result: { photo: Photo; tags: PhotoTag[] }) => void;
};

/** "KI-Vorschlag": title, description and tags for a photo, taken over on request. */
export function AiSuggestion({ photo, tags, onApplied }: AiSuggestionProps) {
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestion, setSuggestion] = useState<AiDescription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      setSuggestion(await describePhoto(photo.id));
    } catch (err) {
      if (err instanceof AiError && err.unavailable) setUnavailable(true);
      setError(err instanceof Error ? err.message : "KI-Vorschlag fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!suggestion) return;
    setApplying(true);
    setError(null);
    try {
      const data = await api<{ photo: Photo }>(`/api/photos/${photo.id}`, {
        method: "PATCH",
        body: JSON.stringify(describePatchBody(photo, suggestion)),
      });
      let nextTags = tags;
      for (const name of suggestion.tags) {
        const added = await api<{ tag: PhotoTag }>(`/api/photos/${photo.id}/tags`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        if (!nextTags.some((tag) => tag.tag_id === added.tag.tag_id)) {
          nextTags = [...nextTags, added.tag];
        }
      }
      onApplied({ photo: data.photo, tags: nextTags });
      notifyPhotosChanged();
      setSuggestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Übernehmen fehlgeschlagen.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section
      className="space-y-2 rounded-2xl p-3 ring-1 ring-section-more/30"
      style={{ backgroundColor: "hsl(var(--section-more) / 0.1)" }}
      aria-label="KI-Vorschlag"
    >
      <div className="flex items-center gap-2">
        <Sparkle className="size-8 shrink-0" />
        <h2 className="min-w-0 flex-1 text-sm font-semibold">KI-Vorschlag</h2>
        <button
          type="button"
          onClick={() => void suggest()}
          disabled={busy || applying || unavailable}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-medium disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          {suggestion ? "Neu vorschlagen" : "Vorschlag holen"}
        </button>
      </div>
      {suggestion ? (
        <div className="space-y-2 text-sm leading-snug">
          {suggestion.title ? <p className="font-semibold">{suggestion.title}</p> : null}
          {suggestion.description ? (
            <p className="text-muted-foreground">{suggestion.description}</p>
          ) : null}
          {suggestion.tags.length > 0 ? (
            <p className="flex flex-wrap gap-1.5">
              {suggestion.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  #{tag}
                </span>
              ))}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void apply()}
            disabled={applying}
            className="inline-flex h-9 items-center rounded-xl glass-accent glass-interactive px-3 text-xs font-medium disabled:opacity-60"
          >
            {applying ? "Übernehmen…" : "Übernehmen"}
          </button>
        </div>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">
          Die KI schlägt Titel, Beschreibung und Tags vor — du entscheidest, ob du sie übernimmst.
        </p>
      )}
      {error ? <p className="text-xs leading-snug text-destructive">{error}</p> : null}
    </section>
  );
}
