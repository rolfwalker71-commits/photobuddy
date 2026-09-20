"use client";

import { useEffect, useState } from "react";
import { CloudOff, LoaderCircle, RotateCcw, Trash2, Video } from "lucide-react";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import {
  discardUpload,
  keepDuplicateUpload,
  retryAllUploads,
  retryUpload,
  type QueuedUpload,
} from "@/lib/upload-queue";

function QueueThumb({ item }: { item: QueuedUpload }) {
  const [src, setSrc] = useState<string | null>(null);
  const blob = item.thumb ?? (item.fields.kind === "photo" ? item.file : null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (!src) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Video className="size-5 text-muted-foreground" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-border" />
  );
}

function statusText(item: QueuedUpload, active: boolean, progress: number | null) {
  if (active) {
    return progress != null ? `Wird hochgeladen · ${Math.round(progress * 100)} %` : "Wird hochgeladen…";
  }
  if (item.status === "duplicate") return item.error ?? "Ähnliches Foto schon vorhanden.";
  if (item.status === "failed") return item.error ?? "Upload fehlgeschlagen.";
  if (item.error) {
    const wait = item.nextAttemptAt - Date.now();
    return wait > 1_000
      ? `${item.error} Neuer Versuch in ${Math.ceil(wait / 1_000)} s.`
      : item.error;
  }
  return "Wartet";
}

/** Everything still on this device: waiting, sending, or needing a decision. */
export function UploadQueuePanel() {
  const queue = useUploadQueue();
  const [, tick] = useState(0);

  useEffect(() => {
    if (queue.items.length === 0) return;
    const timer = setInterval(() => tick((n) => n + 1), 1_000);
    return () => clearInterval(timer);
  }, [queue.items.length]);

  if (queue.items.length === 0) return null;

  const waiting = queue.items.filter((item) => item.status === "pending").length;
  const button =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium disabled:opacity-60";

  return (
    <section
      id="warteschlange"
      className="scroll-mt-24 space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Warteschlange</h2>
          <p className="text-sm leading-snug text-muted-foreground">
            {queue.pausedForAuth
              ? "Sitzung abgelaufen — nach dem Anmelden geht es automatisch weiter."
              : queue.online && !queue.networkError
                ? "Bleibt auf diesem Gerät gespeichert, bis alles oben ist — auch wenn du die App schliesst."
                : "Kein Netz. Die Fotos sind gespeichert und gehen automatisch hoch, sobald wieder Verbindung da ist."}
          </p>
        </div>
        {!queue.online || queue.networkError ? (
          <CloudOff className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
      {waiting > 0 && !queue.activeId ? (
        <button
          type="button"
          onClick={() => void retryAllUploads()}
          className={`${button} w-full glass-accent glass-interactive text-primary-foreground`}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Jetzt versuchen
        </button>
      ) : null}
      <ul className="space-y-2">
        {queue.items.map((item) => {
          const active = queue.activeId === item.id;
          const needsDecision = item.status === "duplicate" || item.status === "failed";
          return (
            <li key={item.id} className="flex items-center gap-3">
              <QueueThumb item={item} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="truncate text-sm font-medium leading-snug">
                  {item.fields.title || (item.fields.kind === "video" ? "Video" : "Foto")}
                </p>
                <p
                  className={`flex items-center gap-1.5 text-xs leading-snug ${
                    needsDecision ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {active ? <LoaderCircle className="size-3 shrink-0 animate-spin" aria-hidden /> : null}
                  <span className="min-w-0">{statusText(item, active, queue.progress)}</span>
                </p>
                {active && queue.progress != null ? (
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${Math.round(queue.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
                {needsDecision ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void (item.status === "duplicate"
                          ? keepDuplicateUpload(item.id)
                          : retryUpload(item.id))
                      }
                      className={`${button} glass-accent glass-interactive text-primary-foreground`}
                    >
                      {item.status === "duplicate" ? "Trotzdem hochladen" : "Erneut versuchen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void discardUpload(item.id)}
                      className={`${button} bg-muted`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Verwerfen
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
