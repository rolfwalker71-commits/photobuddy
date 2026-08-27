"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const next = params.get("next") || "/gallery";
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-3xl font-semibold leading-tight">
        Willkommen zurück
      </h1>
      <p className="mt-2 text-sm text-muted-foreground leading-snug">
        Zuerst als Admin anmelden. Weitere Teilnehmer legst du unter
        Einstellungen an. Gäste brauchen kein Konto.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">E-Mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Passwort</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Bitte warten…" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="px-5 py-16 text-center text-sm text-muted-foreground">
          Laden…
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
