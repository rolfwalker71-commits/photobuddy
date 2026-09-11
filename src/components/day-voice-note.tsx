"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Mic, Square, Trash2 } from "lucide-react";
import { api, withKey } from "@/lib/api";
import { MAX_VOICE_MS, pickRecorderMime } from "@/lib/media";
import { publicPhotoUrl } from "@/lib/storage";
import type { DayVoiceNote, ViewerMode } from "@/lib/types";

type DayVoiceBlockProps = {
  albumId: string;
  day: string;
  note: DayVoiceNote | null;
  mode: ViewerMode;
  shareKey: string | null;
  currentUserId: string | null;
  isAdmin: boolean;
  onChange: (notes: DayVoiceNote[]) => void;
};

function formatSeconds(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `0:${String(total).padStart(2, "0")}`;
}

export function DayVoiceBlock({
  albumId,
  day,
  note,
  mode,
  shareKey,
  currentUserId,
  isAdmin,
  onChange,
}: DayVoiceBlockProps) {
  const canRecord = mode === "teilnehmer" && Boolean(currentUserId);
  const canDelete =
    canRecord &&
    Boolean(note) &&
    (note?.author_id === currentUserId || isAdmin);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => stopTracks();
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Dieser Browser kann keine Sprachnotiz aufnehmen.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mime = pickRecorderMime(["audio"]);
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    recorderRef.current = recorder;
    startedRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(Date.now() - startedRef.current, MAX_VOICE_MS);
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      stopTracks();
      setRecording(false);
      void upload(blob, durationMs);
    };
    recorder.start(200);
    setRecording(true);
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      const ms = Date.now() - startedRef.current;
      setElapsed(ms);
      if (ms >= MAX_VOICE_MS) {
        recorder.stop();
      }
    }, 200);
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function upload(blob: Blob, durationMs: number) {
    if (blob.size > 3 * 1024 * 1024) {
      setError("Sprachnotiz ist zu gross.");
      return;
    }
    if (durationMs < 400) {
      setError("Die Aufnahme war zu kurz.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      form.append("note_date", day);
      form.append("duration_ms", String(Math.min(durationMs, MAX_VOICE_MS)));
      form.append("file", blob, `voice.${ext}`);
      const data = await api<{ notes: DayVoiceNote[] }>(
        withKey(`/api/albums/${albumId}/day-voice-notes`, shareKey),
        { method: "POST", body: form },
      );
      onChange(data.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aufnahme fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!note) return;
    if (!window.confirm("Sprachnotiz löschen?")) return;
    setBusy(true);
    try {
      await api(withKey(`/api/day-voice-notes/${note.id}`, shareKey), {
        method: "DELETE",
      });
      const data = await api<{ notes: DayVoiceNote[] }>(
        withKey(`/api/albums/${albumId}/day-voice-notes`, shareKey),
      );
      onChange(data.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "guest" && !note) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-card ring-1 ring-border">
      {note ? (
        <audio
          controls
          preload="metadata"
          src={publicPhotoUrl(note.storage_path)}
          className="min-h-11 min-w-0 flex-1"
        >
          Sprachnotiz
        </audio>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-muted-foreground leading-snug">
          Sprachnotiz — höchstens 20 Sekunden.
        </p>
      )}
      {note?.author_display_name ? (
        <span className="text-[0.7rem] text-muted-foreground">
          {note.author_display_name} · {formatSeconds(note.duration_ms)}
        </span>
      ) : null}
      {canRecord ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (recording) stopRecording();
            else void startRecording();
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : recording ? (
            <Square className="size-4" aria-hidden />
          ) : (
            <Mic className="size-4" aria-hidden />
          )}
          {recording
            ? `Stopp ${formatSeconds(elapsed)}`
            : note
              ? "Ersetzen"
              : "Aufnehmen"}
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted text-destructive disabled:opacity-50"
          aria-label="Sprachnotiz löschen"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
      {error ? (
        <p className="w-full text-sm text-destructive leading-snug">{error}</p>
      ) : null}
    </div>
  );
}
