"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { getGuestSessionId, getStoredGuestName } from "@/lib/guest";
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
  currentUserId,
  onNeedGuestName,
}: CommentSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (mode === "guest" && shareKey) {
      const { data, error: loadError } = await supabase.rpc(
        "guest_list_comments",
        { p_key: shareKey, p_photo_id: photoId },
      );
      if (loadError) {
        setError(loadError.message);
        return;
      }
      setComments((data ?? []) as Comment[]);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("comments")
      .select("id, photo_id, author_id, guest_name, body, created_at, profiles(display_name)")
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true });
    if (loadError) {
      setError(loadError.message);
      return;
    }
    setComments(
      ((data ?? []) as (Comment & { profiles?: { display_name: string } | { display_name: string }[] | null })[]).map(
        (row) => ({
          ...row,
          author_display_name: Array.isArray(row.profiles)
            ? row.profiles[0]?.display_name
            : row.profiles?.display_name,
        }),
      ),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoId, mode, shareKey]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (mode === "guest" && !getStoredGuestName() && !onNeedGuestName()) return;

    setBusy(true);
    setError(null);
    try {
      if (mode === "guest") {
        if (!shareKey) return;
        const { error: insertError } = await supabase.rpc("guest_add_comment", {
          p_key: shareKey,
          p_photo_id: photoId,
          p_guest_name: getStoredGuestName() || "Gast",
          p_guest_session_id: getGuestSessionId(),
          p_body: text,
        });
        if (insertError) throw insertError;
      } else if (currentUserId) {
        const { error: insertError } = await supabase.from("comments").insert({
          photo_id: photoId,
          author_id: currentUserId,
          body: text,
        });
        if (insertError) throw insertError;
      }
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kommentar fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (mode !== "teilnehmer") return;
    await supabase.from("comments").delete().eq("id", id);
    await load();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-base font-semibold">Kommentare</h2>
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
    </section>
  );
}
