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
import type { Comment, UserRole, ViewerMode } from "@/lib/types";

type CommentSectionProps = {
  photoId: string;
  mode: ViewerMode;
  shareKey: string | null;
  currentUserId: string | null;
  userRole?: UserRole | null;
  onNeedGuestName: () => boolean;
  compact?: boolean;
};

export function CommentSection({
  photoId,
  mode,
  shareKey,
  currentUserId,
  userRole,
  onNeedGuestName,
  compact = false,
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
  const guestSessionId = getGuestSessionId();

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

  function canDelete(comment: Comment) {
    if (mode === "teilnehmer") {
      if (userRole === "admin") return true;
      return Boolean(currentUserId && comment.author_id === currentUserId);
    }
    if (mode === "guest") {
      return (
        Boolean(comment.guest_session_id) &&
        comment.guest_session_id === guestSessionId
      );
    }
    return false;
  }

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
    await api(`/api/comments/${id}`, {
      method: "DELETE",
      body: JSON.stringify(
        mode === "guest" ? { guest_session_id: getGuestSessionId() } : {},
      ),
    });
    await load();
  }

  const fieldClass = compact
    ? "w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs sm:text-sm"
    : "w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm";
  const btnClass = compact
    ? "inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
    : "inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60";

  return (
    <section className={compact ? "space-y-2" : "space-y-3"}>
      <h2 className={compact ? "text-sm font-semibold" : "text-base font-semibold"}>
        Kommentare
      </h2>
      <ul className={compact ? "space-y-1.5" : "space-y-2"}>
        {comments.length === 0 ? (
          <li className="rounded-2xl bg-card px-3 py-2 text-xs text-muted-foreground shadow-card ring-1 ring-border sm:text-sm">
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
                className="rounded-2xl bg-card px-3 py-2 shadow-card ring-1 ring-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-snug break-words sm:text-sm">
                    {name}
                  </p>
                  <time className="shrink-0 text-[0.65rem] text-muted-foreground sm:text-xs">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: de,
                    })}
                  </time>
                </div>
                <p className="mt-0.5 text-xs leading-snug break-words sm:text-sm">
                  {comment.body}
                </p>
                {canDelete(comment) ? (
                  <button
                    type="button"
                    className="mt-1.5 text-[0.65rem] text-destructive sm:text-xs"
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
        <form onSubmit={(e) => void submit(e)} className="space-y-1.5">
          <label className="block">
            <span className="sr-only">Kommentar schreiben</span>
            <textarea
              required
              rows={compact ? 2 : 3}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Schreib einen Kommentar…"
              className={fieldClass}
            />
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <button type="submit" disabled={busy} className={btnClass}>
            {busy ? "Senden…" : "Kommentieren"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl bg-card px-3 py-2 shadow-card ring-1 ring-border">
          <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
            Bitte zuerst deinen Namen angeben, dann kannst du kommentieren.
          </p>
          <button
            type="button"
            onClick={() => onNeedGuestName()}
            className={btnClass + " mt-2"}
          >
            Namen festlegen
          </button>
        </div>
      )}
    </section>
  );
}
