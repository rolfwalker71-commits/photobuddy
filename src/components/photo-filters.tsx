"use client";

import { X } from "lucide-react";
import { emptyFilters } from "@/lib/filters";
import type { PhotoFilters, Profile } from "@/lib/types";

type PhotoFiltersSheetProps = {
  open: boolean;
  onClose: () => void;
  filters: PhotoFilters;
  onChange: (next: PhotoFilters) => void;
  profiles: Profile[];
};

export function PhotoFiltersSheet({
  open,
  onClose,
  filters,
  onChange,
  profiles,
}: PhotoFiltersSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Filter schließen"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="filter-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-dock ring-1 ring-border sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="filter-title" className="font-display text-lg font-semibold">
            Filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted"
            aria-label="Schließen"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Teilnehmer</span>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
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
                className="date-field h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
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
                className="date-field h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
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
              className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
              value={filters.location}
              onChange={(e) =>
                onChange({ ...filters, location: e.target.value })
              }
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-muted text-sm font-medium"
            onClick={() => onChange(emptyFilters)}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground"
            onClick={onClose}
          >
            Anwenden
          </button>
        </div>
      </div>
    </div>
  );
}
