"use client";

import { useEffect, useState } from "react";
import { api, withKey } from "@/lib/api";
import { getGuestSessionId, getStoredGuestName } from "@/lib/guest";
import type { Reaction, ViewerMode } from "@/lib/types";

const EMOJIS = ["❤️", "😂", "😮", "🎉", "👍", "🔥"];

type ReactionBarProps = {
  photoId: string;
  mode: ViewerMode;
  shareKey: string | null;
  currentUserId: string | null;
  onNeedGuestName: () => boolean;
};

export function ReactionBar({
  photoId,
  mode,
  shareKey,
  currentUserId,
  onNeedGuestName,
}: ReactionBarProps) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await api<{ reactions: Reaction[] }>(
        withKey(`/api/photos/${photoId}/reactions`, shareKey),
      );
      setReactions(data.reactions);
    };
    void load();
  }, [mode, photoId, shareKey]);

  const counts = EMOJIS.map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => {
      if (r.emoji !== emoji) return false;
      if (mode === "teilnehmer") return r.author_id === currentUserId;
      return r.guest_name != null && typeof window !== "undefined"
        ? reactions.some(
            (x) =>
              x.emoji === emoji &&
              x.guest_name === getStoredGuestName(),
          )
        : false;
    }),
  }));

  async function toggle(emoji: string) {
    setBusy(emoji);
    try {
      if (mode === "guest") {
        if (!shareKey) return;
        if (!getStoredGuestName() && !onNeedGuestName()) return;
      }
      const data = await api<{ reactions: Reaction[] }>(
        withKey(`/api/photos/${photoId}/reactions`, shareKey),
        {
          method: "POST",
          body: JSON.stringify({
            emoji,
            guest_name: mode === "guest" ? getStoredGuestName() || "Gast" : undefined,
            guest_session_id: mode === "guest" ? getGuestSessionId() : undefined,
          }),
        },
      );
      setReactions(data.reactions);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Reaktionen">
      {counts.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          disabled={busy === emoji}
          onClick={() => void toggle(emoji)}
          className={`inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm ring-1 transition ${
            mine
              ? "bg-muted ring-primary"
              : "bg-card ring-border"
          }`}
          aria-pressed={mine}
        >
          <span aria-hidden>{emoji}</span>
          <span className="text-muted-foreground">{count}</span>
        </button>
      ))}
    </div>
  );
}
