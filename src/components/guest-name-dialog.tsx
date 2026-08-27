"use client";

import { useState } from "react";

type GuestNameDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function GuestNameDialog({ open, onClose, onSave }: GuestNameDialogProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Abbrechen"
        onClick={onClose}
      />
      <form
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-card p-5 shadow-dock ring-1 ring-border sm:rounded-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length < 2) return;
          onSave(trimmed);
        }}
      >
        <h2 className="font-display text-lg font-semibold leading-snug">
          Wie heißt du?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          Dein Name erscheint bei Kommentaren und Reaktionen, z. B. „Tante
          Maria“. Wir merken ihn uns auf diesem Gerät.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={80}
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tante Maria"
          />
        </label>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-muted text-sm font-medium"
          >
            Später
          </button>
          <button
            type="submit"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground"
          >
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}
