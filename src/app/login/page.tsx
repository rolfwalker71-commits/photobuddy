"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, KeyRound } from "lucide-react";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const next = params.get("next") || "/gallery";
    try {
      if (mode === "magic") {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (otpError) throw otpError;
        setMessage("Schau in dein Postfach — der Magic Link ist unterwegs.");
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signError) throw signError;
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl font-semibold leading-tight">
        Willkommen zurück
      </h1>
      <p className="mt-2 text-sm text-muted-foreground leading-snug">
        Nur Teilnehmerinnen und Teilnehmer der Reise können sich anmelden.
      </p>

      <div className="mt-6 h-10 min-h-10 rounded-full bg-muted p-0.5">
        <div className="grid h-full grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`inline-flex h-full min-h-0 items-center justify-center gap-2 rounded-full py-0 text-sm leading-none ${
              mode === "password" ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            <KeyRound className="size-4" />
            Passwort
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={`inline-flex h-full min-h-0 items-center justify-center gap-2 rounded-full py-0 text-sm leading-none ${
              mode === "magic" ? "bg-card shadow-card" : "text-muted-foreground"
            }`}
          >
            <Mail className="size-4" />
            Magic Link
          </button>
        </div>
      </div>

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
        {mode === "password" ? (
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
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-primary">{message}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy
            ? "Bitte warten…"
            : mode === "magic"
              ? "Link senden"
              : "Anmelden"}
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
