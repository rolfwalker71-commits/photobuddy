"use client";

import { useState } from "react";
import { api, withKey } from "@/lib/api";
import type { DayNote, ViewerMode } from "@/lib/types";

type DayNoteEditorProps = {
  albumId: string;
  day: string;
  note: DayNote | null;
  mode: ViewerMode;
  shareKey: string | null;
  currentUserId: string | null;
  isAdmin: boolean;
  onChange: (notes: DayNote[]) => void;
};

export function DayNoteBlock({
  albumId,
  day,
  note,
  mode,
  shareKey,
  currentUserId,
  isAdmin,
  onChange,
}: DayNoteEditorProps) {
  const canEdit =
    mode === "teilnehmer" &&
    Boolean(currentUserId) &&
    (!note || note.author_id === currentUserId || isAdmin);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "guest" && !note) return null;

  async function save() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ notes: DayNote[] }>(
        withKey(`/api/albums/${albumId}/day-notes`, shareKey),
        {
          method: "POST",
          body: JSON.stringify({ note_date: day, body: text }),
        },
      );
      onChange(data.notes);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!note) return;
    if (!window.confirm("Tagesnotiz löschen?")) return;
    setBusy(true);
    try {
      await api(withKey(`/api/day-notes/${note.id}`, shareKey), {
        method: "DELETE",
      });
      const data = await api<{ notes: DayNote[] }>(
        withKey(`/api/albums/${albumId}/day-notes`, shareKey),
      );
      onChange(data.notes);
      setBody("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing && note) {
    return (
      <div className="rounded-2xl bg-card px-3 py-2.5 shadow-card ring-1 ring-border">
        <p className="text-sm leading-snug break-words">{note.body}</p>
        {note.author_display_name ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {note.author_display_name}
          </p>
        ) : null}
        {canEdit ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setBody(note.body);
                setEditing(true);
              }}
              className="inline-flex h-9 items-center rounded-xl bg-muted px-3 text-xs font-medium"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className="inline-flex h-9 items-center rounded-xl bg-muted px-3 text-xs font-medium text-destructive"
            >
              Löschen
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!canEdit) return null;

  return (
    <div className="space-y-2 rounded-2xl bg-card px-3 py-2.5 shadow-card ring-1 ring-border">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Tagesnotiz
        </span>
        <textarea
          rows={2}
          maxLength={500}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Ein Satz zu diesem Tag — ohne Foto."
          className="h-auto w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm leading-snug"
        />
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !body.trim()}
          onClick={() => void save()}
          className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Speichern
        </button>
        {note ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setBody(note.body);
            }}
            className="inline-flex h-9 items-center rounded-xl bg-muted px-3 text-xs font-medium"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </div>
  );
}
