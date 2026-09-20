"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { api, withKey } from "@/lib/api";
import { getPublicEnv } from "@/lib/env";
import { getGuestSessionId } from "@/lib/guest";
import type { NotifyMode, ViewerMode } from "@/lib/types";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function currentEndpoint() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

type PushEnableProps = {
  mode: ViewerMode;
  shareKey: string | null;
  albumId?: string | null;
  compact?: boolean;
};

export function PushEnable({
  mode,
  shareKey,
  albumId,
  compact = false,
}: PushEnableProps) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>(
    mode === "guest" ? "daily" : "instant",
  );
  const [digestHour, setDigestHour] = useState(20);
  const iosHint = isIos() && !isStandalone();

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    const load = async () => {
      try {
        const search = new URLSearchParams();
        if (mode === "guest") search.set("guestSessionId", getGuestSessionId());
        const endpoint = await currentEndpoint();
        if (endpoint) search.set("endpoint", endpoint);
        const query = search.toString();
        const path = withKey(
          `/api/push/subscribe${query ? `?${query}` : ""}`,
          shareKey,
          mode === "guest" ? null : albumId,
        );
        const data = await api<{
          subscribed: boolean;
          notify_mode: NotifyMode | null;
          digest_hour: number;
        }>(path);
        setSubscribed(data.subscribed);
        if (data.notify_mode) setNotifyMode(data.notify_mode);
        if (typeof data.digest_hour === "number") setDigestHour(data.digest_hour);
      } catch {
        /* keep default */
      }
    };
    void load();
  }, [albumId, mode, shareKey]);

  async function publicKey() {
    const fromEnv = getPublicEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (fromEnv) return fromEnv;
    const data = await api<{ publicKey: string }>("/api/push/vapid");
    return data.publicKey;
  }

  async function enable() {
    if (!supported) return;
    setBusy(true);
    setStatus(null);
    try {
      if (iosHint) {
        setStatus(
          "Auf dem iPhone zuerst „Zum Home-Bildschirm“ — Push geht nur in der installierten App.",
        );
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Benachrichtigungen wurden nicht erlaubt.");
        return;
      }
      const key = await publicKey();
      if (!key) {
        setStatus("Push-Schlüssel fehlen. Bitte später erneut versuchen.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      await api(withKey("/api/push/subscribe", shareKey, albumId), {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          guest_session_id: mode === "guest" ? getGuestSessionId() : undefined,
          album_id: mode === "guest" ? undefined : albumId,
          notify_mode: notifyMode,
        }),
      });
      setSubscribed(true);
      setStatus("Benachrichtigungen sind an.");
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Aktivieren fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeMode(next: NotifyMode) {
    if (next === notifyMode || busy) return;
    const previous = notifyMode;
    setNotifyMode(next);
    setBusy(true);
    setStatus(null);
    try {
      const endpoint = await currentEndpoint();
      if (!endpoint) throw new Error("Auf diesem Gerät ist kein Push-Abo aktiv.");
      await api(withKey("/api/push/subscribe", shareKey), {
        method: "PATCH",
        body: JSON.stringify({ endpoint, notify_mode: next }),
      });
    } catch (err) {
      setNotifyMode(previous);
      setStatus(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api(withKey("/api/push/subscribe", shareKey), {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatus("Benachrichtigungen sind aus.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Abmelden fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return compact ? null : (
      <p className="text-sm text-muted-foreground leading-snug">
        Dieser Browser unterstützt keine Push-Nachrichten.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void (subscribed ? disable() : enable())}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium disabled:opacity-60 ${
          subscribed
            ? "bg-muted text-foreground"
            : "glass-accent glass-interactive text-primary-foreground"
        }`}
      >
        {subscribed ? (
          <BellOff className="size-4" aria-hidden />
        ) : (
          <Bell className="size-4" aria-hidden />
        )}
        {subscribed
          ? "Benachrichtigungen aus"
          : "Benachrichtigungen aktivieren"}
      </button>
      {subscribed ? (
        <div
          className="flex h-10 min-h-10 rounded-full bg-muted p-0.5"
          role="radiogroup"
          aria-label="Wie oft benachrichtigen"
        >
          {(
            [
              ["instant", "Bei jedem Foto"],
              ["daily", `Abends um ${digestHour} Uhr`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={notifyMode === value}
              disabled={busy}
              onClick={() => void changeMode(value)}
              className={`h-full min-h-0 flex-1 self-stretch rounded-full px-3 text-xs font-medium leading-none ${
                notifyMode === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {iosHint ? (
        <p className="text-sm text-muted-foreground leading-snug">
          iPhone: zuerst über Safari „Zum Home-Bildschirm“, dann in der App
          aktivieren.
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground leading-snug">{status}</p>
      ) : null}
    </div>
  );
}
