"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatAppDate } from "@/lib/format-date";
import { formatDateRange } from "@/lib/album-label";
import type { Album, Photo, Profile } from "@/lib/types";
import {
  filterPhotosForZip,
  zipDownloadFilename,
  zipPeople,
} from "@/lib/zip-download";

type DownloadZipDialogProps = {
  open: boolean;
  busy: boolean;
  error: string | null;
  album: Album;
  photos: Photo[];
  profiles: Profile[];
  onClose: () => void;
  onConfirm: (input: {
    uploaderIds: string[];
    from: string;
    to: string;
    filename: string;
  }) => void;
};

export function DownloadZipDialog({
  open,
  busy,
  error,
  album,
  photos,
  profiles,
  onClose,
  onConfirm,
}: DownloadZipDialogProps) {
  const people = useMemo(
    () => zipPeople(photos, profiles, album.member_ids),
    [photos, profiles, album.member_ids],
  );

  const [allPeople, setAllPeople] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fullRange, setFullRange] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const defaultRange = useMemo(() => {
    const days = photos.map((photo) =>
      (photo.taken_at ?? photo.created_at).slice(0, 10),
    );
    days.sort();
    return {
      from: album.starts_on || album.derived_starts_on || days[0] || "",
      to:
        album.ends_on ||
        album.derived_ends_on ||
        days[days.length - 1] ||
        days[0] ||
        "",
    };
  }, [album, photos]);

  const peopleKey = people.map((person) => person.id).join(",");

  useEffect(() => {
    if (!open) return;
    setAllPeople(true);
    setSelectedIds(people.map((person) => person.id));
    setFullRange(true);
    setDateFrom("");
    setDateTo("");
    // Reset only when the album or its people set changes, not on every photos poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, album.id, peopleKey]);

  const filters = useMemo(
    () => ({
      uploaderIds: allPeople ? [] : selectedIds,
      from: fullRange ? "" : dateFrom,
      to: fullRange ? "" : dateTo,
    }),
    [allPeople, selectedIds, fullRange, dateFrom, dateTo],
  );

  const count = useMemo(
    () => filterPhotosForZip(photos, filters).length,
    [photos, filters],
  );

  const rangeLabel =
    !fullRange && (dateFrom || dateTo)
      ? formatDateRange(dateFrom || dateTo, dateTo || dateFrom)
      : "Ganzer Zeitraum";

  const invalidRange = Boolean(
    !fullRange && dateFrom && dateTo && dateFrom > dateTo,
  );
  const canSubmit = !busy && count > 0 && !invalidRange;

  function toggleAllPeople(next: boolean) {
    setAllPeople(next);
    setSelectedIds(next ? people.map((person) => person.id) : []);
  }

  function togglePerson(id: string, checked: boolean) {
    const next = checked
      ? [...new Set([...selectedIds, id])]
      : selectedIds.filter((item) => item !== id);
    setSelectedIds(next);
    setAllPeople(people.length > 0 && next.length === people.length);
  }

  function toggleFullRange(next: boolean) {
    setFullRange(next);
    if (next) {
      setDateFrom("");
      setDateTo("");
      return;
    }
    setDateFrom(defaultRange.from);
    setDateTo(defaultRange.to);
  }

  function submit() {
    if (!canSubmit) return;
    onConfirm({
      uploaderIds: filters.uploaderIds,
      from: filters.from,
      to: filters.to,
      filename: zipDownloadFilename(album.name),
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="glass-scrim animate-glass-fade absolute inset-0"
        aria-label="Download schliessen"
        disabled={busy}
        onClick={onClose}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-title"
        aria-busy={busy}
        className="relative z-10 flex max-h-[min(36rem,92dvh)] w-full max-w-lg flex-col glass-sheet glass-sheen animate-glass-rise rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="download-title" className="text-lg font-semibold leading-snug">
            Download
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted glass-interactive disabled:opacity-50"
            aria-label="Schliessen"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Von wem</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted px-3">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={allPeople}
                disabled={busy}
                onChange={(event) => toggleAllPeople(event.target.checked)}
              />
              <span className="text-sm font-medium">Alle</span>
            </label>
            {people.map((person) => (
              <label
                key={person.id}
                className="flex min-h-11 items-center gap-3 rounded-2xl px-3 ring-1 ring-border"
              >
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={allPeople || selectedIds.includes(person.id)}
                  disabled={busy}
                  onChange={(event) =>
                    togglePerson(person.id, event.target.checked)
                  }
                />
                <span className="text-sm leading-snug break-words">
                  {person.name}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Zeitraum</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-muted px-3">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={fullRange}
                disabled={busy}
                onChange={(event) => toggleFullRange(event.target.checked)}
              />
              <span className="text-sm font-medium">Ganzer Zeitraum</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Von</span>
                <input
                  type="date"
                  data-empty={dateFrom ? "false" : "true"}
                  disabled={busy || fullRange}
                  className="date-field h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm disabled:opacity-50"
                  value={dateFrom}
                  onChange={(event) => {
                    setFullRange(false);
                    setDateFrom(event.target.value);
                  }}
                />
                {dateFrom ? (
                  <span className="block text-xs text-muted-foreground">
                    {formatAppDate(dateFrom)}
                  </span>
                ) : null}
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Bis</span>
                <input
                  type="date"
                  data-empty={dateTo ? "false" : "true"}
                  disabled={busy || fullRange}
                  className="date-field h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm disabled:opacity-50"
                  value={dateTo}
                  onChange={(event) => {
                    setFullRange(false);
                    setDateTo(event.target.value);
                  }}
                />
                {dateTo ? (
                  <span className="block text-xs text-muted-foreground">
                    {formatAppDate(dateTo)}
                  </span>
                ) : null}
              </label>
            </div>
          </fieldset>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm leading-snug text-muted-foreground">
            {invalidRange
              ? "Das Von-Datum liegt nach dem Bis-Datum."
              : `${count} Foto${count === 1 ? "" : "s"} · ${rangeLabel}`}
          </p>
          {error ? (
            <p className="text-sm leading-snug text-destructive">{error}</p>
          ) : null}
          {busy ? (
            <p className="inline-flex items-center gap-2 text-sm leading-snug text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Fotos werden vorbereitet…
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-muted glass-interactive text-sm font-medium disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl glass-accent glass-interactive text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              Download
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
