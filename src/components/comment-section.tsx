"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { api, withKey } from "@/lib/api";
import {
  getGuestSessionId,
  getStoredGuestName,
  hasGuestName,
  subscribeGuestName,
} from "@/lib/guest";
import type { Comment, ViewerMode } from "@/lib/types";

type CommentSectionProps = {
  photoId: string;
  mode: ViewerMode;
  shareKey: string | null;
  currentUserId: string | null;
  onNeedGuestName: () => boolean;
};

export function CommentSection({
  photoId,
  mode,
  shareKey,
  onNeedGuestName,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    setGuestName(getStoredGuestName());
    return subscribeGuestName(setGuestName);
  }, []);

  const guestReady = mode !== "guest" || guestName.length >= 2;

  async function load() {
    try {
      const data = await api<{ comments: Comment[] }>(
        withKey(`/api/photos/${photoId}/comments`, shareKey),
      );
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId, mode, shareKey]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (mode === "guest") {
      if (!hasGuestName() && !onNeedGuestName()) return;
      if (!hasGuestName()) return;
    }

    setBusy(true);
    setError(null);
    try {
      const data = await api<{ comments: Comment[] }>(
        withKey(`/api/photos/${photoId}/comments`, shareKey),
        {
          method: "POST",
          body: JSON.stringify({
            body: text,
            guest_name: mode === "guest" ? getStoredGuestName() : undefined,
            guest_session_id: mode === "guest" ? getGuestSessionId() : undefined,
          }),
        },
      );
      setBody("");
      setComments(data.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kommentar fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (mode !== "teilnehmer") return;
    await api(`/api/comments/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Kommentare</h2>
      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground shadow-card ring-1 ring-border">
            Noch keine Kommentare.
          </li>
        ) : (
          comments.map((comment) => {
            const name =
              comment.author_display_name ||
              comment.guest_name ||
              "Unbekannt";
            return (
              <li
                key={comment.id}
                className="rounded-2xl bg-card px-4 py-3 shadow-card ring-1 ring-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug break-words">
                    {name}
                  </p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-snug break-words">
                  {comment.body}
                </p>
                {mode === "teilnehmer" ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-destructive"
                    onClick={() => void remove(comment.id)}
                  >
                    Löschen
                  </button>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
      {guestReady ? (
        <form onSubmit={(e) => void submit(e)} className="space-y-2">
          <label className="block">
            <span className="sr-only">Kommentar schreiben</span>
            <textarea
              required
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Schreib einen Kommentar…"
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Senden…" : "Kommentieren"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl bg-card px-4 py-3 shadow-card ring-1 ring-border">
          <p className="text-sm leading-snug text-muted-foreground">
            Bitte zuerst deinen Namen angeben, dann kannst du kommentieren.
          </p>
          <button
            type="button"
            onClick={() => onNeedGuestName()}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Namen festlegen
          </button>
        </div>
      )}
    </section>
  );
}
