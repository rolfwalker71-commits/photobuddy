"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { Sparkle } from "@/components/illustrations";
import { AiError, recapShareText, writeRecapText } from "@/lib/ai-client";

/** "Reisebericht schreiben": an AI-written travelogue with copy and share. */
export function RecapWriter({ albumId, albumName }: { albumId: string; albumName: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function write() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      setText(await writeRecapText(albumId));
    } catch (err) {
      if (err instanceof AiError && err.unavailable) setUnavailable(true);
      setError(err instanceof Error ? err.message : "Reisebericht fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(recapShareText(albumName, text));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopieren nicht möglich — Text markieren und manuell kopieren.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: albumName, text: recapShareText(albumName, text) });
    } catch {
      /* dismissed by the user */
    }
  }

  return (
    <section
      className="space-y-3 rounded-2xl p-5 shadow-card ring-1 ring-section-more/30"
      style={{ backgroundColor: "hsl(var(--section-more) / 0.1)" }}
    >
      <div className="flex items-center gap-3">
        <Sparkle className="size-12 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">Reisebericht schreiben</h2>
          <p className="text-sm leading-snug text-muted-foreground">
            Die KI fasst Fotos, Orte und Tagesnotizen zu einem kurzen Bericht zusammen.
          </p>
        </div>
      </div>
      {text ? (
        <p data-selectable className="whitespace-pre-line text-sm leading-relaxed">
          {text}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void write()}
          disabled={busy || unavailable}
          className="inline-flex h-11 items-center gap-2 rounded-2xl glass-accent glass-interactive px-4 text-sm font-medium disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? "Schreibt…" : text ? "Neu schreiben" : "Bericht schreiben"}
        </button>
        {text ? (
          <>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm font-medium"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Kopiert" : "Kopieren"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-3 text-sm font-medium"
              >
                <Share2 className="size-4" aria-hidden />
                Teilen
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      {error ? <p className="text-sm leading-snug text-destructive">{error}</p> : null}
    </section>
  );
}
