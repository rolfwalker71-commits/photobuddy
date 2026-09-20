"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { emptyFilters } from "@/lib/filters";
import type { PhotoFilters, PhotoTag, Profile } from "@/lib/types";

type PhotoFiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  filters: PhotoFilters;
  onChange: (next: PhotoFilters) => void;
  profiles: Profile[];
  albumTags?: PhotoTag[];
};

export function PhotoFiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  profiles,
  albumTags = [],
}: PhotoFiltersSheetProps) {
  const tagNames = useMemo(() => {
    const names = new Set<string>();
    for (const tag of albumTags) {
      names.add(tag.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "de"));
  }, [albumTags]);

  function toggleTag(name: string) {
    const lower = name.toLowerCase();
    const has = filters.tagNames.some((t) => t.toLowerCase() === lower);
    onChange({
      ...filters,
      tagNames: has
        ? filters.tagNames.filter((t) => t.toLowerCase() !== lower)
        : [...filters.tagNames, name],
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="glass-scrim animate-glass-fade absolute inset-0"
        aria-label="Filter schliessen"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="filter-title"
        className="relative z-10 w-full max-w-lg glass-sheet glass-sheen animate-glass-rise rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="filter-title" className="text-lg font-semibold">
            Filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted glass-interactive"
            aria-label="Schliessen"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Teilnehmer</span>
            <select
              className="h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
              value={filters.uploaderId}
              onChange={(e) =>
                onChange({ ...filters, uploaderId: e.target.value })
              }
            >
              <option value="">Alle</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Von</span>
              <input
                type="date"
                data-empty={filters.dateFrom ? "false" : "true"}
                className="date-field h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
                value={filters.dateFrom}
                onChange={(e) =>
                  onChange({ ...filters, dateFrom: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Bis</span>
              <input
                type="date"
                data-empty={filters.dateTo ? "false" : "true"}
                className="date-field h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
                value={filters.dateTo}
                onChange={(e) =>
                  onChange({ ...filters, dateTo: e.target.value })
                }
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Ort</span>
            <input
              type="search"
              placeholder="z. B. Lissabon"
              className="h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
              value={filters.location}
              onChange={(e) =>
                onChange({ ...filters, location: e.target.value })
              }
            />
          </label>

          {tagNames.length > 0 ? (
            <div className="space-y-2">
              <span className="text-sm font-medium">Tags</span>
              <p className="text-xs text-muted-foreground leading-snug">
                Mehrere Tags = Foto muss alle gewählten Tags haben.
              </p>
              <div className="flex flex-wrap gap-2">
                {tagNames.map((name) => {
                  const active = filters.tagNames.some(
                    (t) => t.toLowerCase() === name.toLowerCase(),
                  );
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleTag(name)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "glass-accent glass-interactive text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      #{name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-muted glass-interactive text-sm font-medium"
            onClick={() => onChange(emptyFilters)}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl glass-accent glass-interactive text-sm font-medium text-primary-foreground"
            onClick={onClose}
          >
            Anwenden
          </button>
        </div>
      </div>
    </div>
  );
}
