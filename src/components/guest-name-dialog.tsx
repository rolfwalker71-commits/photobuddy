"use client";

import { useState } from "react";

type GuestNameDialogProps = {
  open: boolean;
  required?: boolean;
  onClose?: () => void;
  onSave: (name: string) => void;
};

export function GuestNameDialog({
  open,
  required = false,
  onClose,
  onSave,
}: GuestNameDialogProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {required ? (
        <div className="glass-scrim animate-glass-fade absolute inset-0" />
      ) : (
        <button
          type="button"
          className="glass-scrim animate-glass-fade absolute inset-0"
          aria-label="Abbrechen"
          onClick={onClose}
        />
      )}
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-name-title"
        className="relative z-10 w-full max-w-md glass-sheet glass-sheen animate-glass-rise rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed.length < 2) return;
          onSave(trimmed);
        }}
      >
        <h2
          id="guest-name-title"
          className="text-lg font-semibold leading-snug"
        >
          Wie heisst du?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground leading-snug">
          Bevor du kommentierst oder reagierst, brauchen wir deinen Namen, z. B.
          „Tante Maria“. Wir merken ihn uns auf diesem Gerät.
        </p>
        <label className="mt-4 block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input
            autoFocus
            required
            minLength={2}
            maxLength={80}
            className="h-11 w-full rounded-2xl glass-fill outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 px-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tante Maria"
          />
        </label>
        <div className="mt-4 flex gap-2">
          {required ? null : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-muted glass-interactive text-sm font-medium"
            >
              Später
            </button>
          )}
          <button
            type="submit"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl glass-accent glass-interactive text-sm font-medium text-primary-foreground"
          >
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}
