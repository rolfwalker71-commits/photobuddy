"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const dark = ready && resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="inline-flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground transition hover:bg-muted/80"
      aria-label={dark ? "Hellmodus" : "Dunkelmodus"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
