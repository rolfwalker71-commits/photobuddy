"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = useMemo(() => createClient(), []);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (mode === "guest" && shareKey) {
        const { data } = await supabase.rpc("guest_list_reactions", {
          p_key: shareKey,
          p_photo_id: photoId,
        });
        setReactions((data ?? []) as Reaction[]);
        return;
      }
      const { data } = await supabase
        .from("reactions")
        .select("id, photo_id, emoji, guest_name, author_id")
        .eq("photo_id", photoId);
      setReactions((data ?? []) as Reaction[]);
    };
    void load();
  }, [mode, photoId, shareKey, supabase]);

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
        await supabase.rpc("guest_toggle_reaction", {
          p_key: shareKey,
          p_photo_id: photoId,
          p_guest_name: getStoredGuestName() || "Gast",
          p_guest_session_id: getGuestSessionId(),
          p_emoji: emoji,
        });
        const { data } = await supabase.rpc("guest_list_reactions", {
          p_key: shareKey,
          p_photo_id: photoId,
        });
        setReactions((data ?? []) as Reaction[]);
        return;
      }
      const existing = reactions.find(
        (r) => r.emoji === emoji && r.author_id === currentUserId,
      );
      if (existing) {
        await supabase.from("reactions").delete().eq("id", existing.id);
      } else if (currentUserId) {
        await supabase.from("reactions").insert({
          photo_id: photoId,
          author_id: currentUserId,
          emoji,
        });
      }
      const { data } = await supabase
        .from("reactions")
        .select("id, photo_id, emoji, guest_name, author_id")
        .eq("photo_id", photoId);
      setReactions((data ?? []) as Reaction[]);
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
