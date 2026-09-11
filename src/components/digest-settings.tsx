"use client";

import { useEffect, useState } from "react";
import { MoonStar, Send } from "lucide-react";
import { api } from "@/lib/api";

const COMMON_ZONES = [
  "Europe/Zurich",
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/London",
  "Europe/Lisbon",
  "Atlantic/Canary",
  "America/New_York",
  "Asia/Bangkok",
];

function zoneOptions(current: string) {
  const all =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : COMMON_ZONES;
  return all.includes(current) ? all : [current, ...all];
}

/** Admin: when the evening summary goes out, and a test button. */
export function DigestSettings() {
  const [hour, setHour] = useState(20);
  const [timeZone, setTimeZone] = useState("Europe/Zurich");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void api<{ digest_hour: number; digest_time_zone: string }>("/api/settings")
      .then((data) => {
        setHour(data.digest_hour);
        setTimeZone(data.digest_time_zone);
      })
      .catch(() => undefined);
  }, []);

  async function save(patch: { digest_hour?: number; digest_time_zone?: string }) {
    setBusy(true);
    setStatus(null);
    try {
      const data = await api<{ digest_hour: number; digest_time_zone: string }>(
        "/api/settings",
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setHour(data.digest_hour);
      setTimeZone(data.digest_time_zone);
      setStatus("Gespeichert.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    setBusy(true);
    setStatus(null);
    try {
      const data = await api<{ sent: number; albums: number }>("/api/push/digest", {
        method: "POST",
      });
      setStatus(
        data.albums === 0
          ? "Seit der letzten Zusammenfassung gibt es keine neuen Aufnahmen."
          : `Test an ${data.sent} Gerät${data.sent === 1 ? "" : "e"} gesendet — die reguläre Zusammenfassung kommt trotzdem.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Senden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm";

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold">
        <MoonStar className="size-4" aria-hidden />
        Tägliche Zusammenfassung
      </h2>
      <p className="text-sm leading-snug text-muted-foreground">
        Wer „Abends“ gewählt hat — Gäste standardmässig — bekommt pro Album
        eine Nachricht wie „Heute 23 neue Aufnahmen von Anna und Ben“ statt
        einer pro Foto.
      </p>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Uhrzeit</span>
          <select
            className={field}
            value={hour}
            disabled={busy}
            onChange={(e) => void save({ digest_hour: Number(e.target.value) })}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-sm font-medium">Zeitzone</span>
          <select
            className={field}
            value={timeZone}
            disabled={busy}
            onChange={(e) => void save({ digest_time_zone: e.target.value })}
          >
            {zoneOptions(timeZone).map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void sendNow()}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-medium disabled:opacity-60"
      >
        <Send className="size-4" aria-hidden />
        Test senden
      </button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </section>
  );
}
