"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookImage, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";

export function AdminNavLinks({ compact = false }: { compact?: boolean }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api<{ user: Profile }>("/api/auth/me")
      .then((data) => setIsAdmin(data.user.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  if (!isAdmin) return null;

  const itemClass = compact
    ? "inline-flex h-11 items-center justify-center rounded-2xl bg-muted px-3 text-sm font-medium"
    : "inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground";

  return (
    <nav aria-label="Administration" className="flex flex-wrap items-center gap-2">
      <Link href="/settings/users" className={itemClass}>
        <Users className="size-4" aria-hidden />
        Teilnehmer
      </Link>
      <Link
        href="/settings/albums"
        className={
          compact
            ? itemClass
            : "inline-flex h-11 items-center gap-2 rounded-2xl bg-muted px-4 text-sm font-medium"
        }
      >
        <BookImage className="size-4" aria-hidden />
        Alben
      </Link>
    </nav>
  );
}
