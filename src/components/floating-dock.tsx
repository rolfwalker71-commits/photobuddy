"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarRange, Camera, Images, MapPinned, Settings } from "lucide-react";
import { appHref } from "@/lib/paths";
import type { ViewerMode } from "@/lib/types";

type FloatingDockProps = {
  mode: ViewerMode;
  shareKey: string | null;
};

export function FloatingDock({ mode, shareKey }: FloatingDockProps) {
  const pathname = usePathname();

  const items = [
    {
      href: appHref(mode, shareKey, "gallery"),
      label: "Galerie",
      icon: Images,
      match: (path: string) =>
        path === "/gallery" || path === "/gallery/share",
    },
    {
      href: appHref(mode, shareKey, "map"),
      label: "Karte",
      icon: MapPinned,
      match: (path: string) => path.includes("/map"),
    },
    {
      href: appHref(mode, shareKey, "timeline"),
      label: "Timeline",
      icon: CalendarRange,
      match: (path: string) => path.includes("/timeline"),
    },
    ...(mode === "teilnehmer"
      ? [
          {
            href: appHref(mode, shareKey, "camera"),
            label: "Kamera",
            icon: Camera,
            match: (path: string) => path.startsWith("/camera"),
          },
          {
            href: appHref(mode, shareKey, "settings"),
            label: "Mehr",
            icon: Settings,
            match: (path: string) => path.startsWith("/settings"),
          },
        ]
      : []),
  ];

  return (
    <nav
      aria-label="Hauptnavigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40"
      style={{
        padding: "max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-right)) 0.75rem max(0.75rem, env(safe-area-inset-left))",
      }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch gap-1 rounded-2xl bg-card p-1.5 shadow-dock ring-1 ring-border">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.7rem] leading-none transition ${
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" aria-hidden />
              <span className="break-words text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
