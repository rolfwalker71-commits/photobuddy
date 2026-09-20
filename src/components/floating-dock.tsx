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

/**
 * The dock floats over the content as glass: a bar at the bottom on phones, a
 * rail on the left from tablet width up. Both render from the same items and
 * both mark the current view with a lens that slides between the slots, so the
 * selection reads as one piece of glass moving rather than a box switching on.
 */
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

  const activeIndex = items.findIndex((item) => item.match(pathname));
  /* The lens is absolutely positioned, so its percentage width resolves
     against the bar's padding box — subtract the padding (2 × 0.375rem) to get
     one slot, and the slots then tile exactly. */
  const lensWidth = `calc((100% - 0.75rem) / ${items.length})`;
  const RAIL_SLOT = "4.375rem"; // size-16 item + 0.375rem gap

  return (
    <>
      {/* Phones and portrait tablets: a bar at the bottom edge. */}
      <nav
        aria-label="Hauptnavigation"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden"
        style={{
          padding:
            "0 max(0.75rem, env(safe-area-inset-right)) max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left))",
        }}
      >
        <div className="glass-chrome glass-sheen glass-squircle pointer-events-auto relative mx-auto flex max-w-lg items-stretch p-1.5">
          {activeIndex >= 0 ? (
            <span
              aria-hidden
              className="glass-fill glass-squircle-sm absolute inset-y-1.5 left-1.5 transition-transform duration-300 ease-glass"
              style={{
                width: lensWidth,
                transform: `translateX(${activeIndex * 100}%)`,
              }}
            />
          ) : null}
          {items.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative z-[1] flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem] leading-none transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span className="break-words text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Tablet and desktop: the same glass, stood on its side. */}
      <nav
        aria-label="Hauptnavigation"
        className="pointer-events-none fixed bottom-0 left-0 top-0 z-40 hidden items-center lg:flex"
        style={{ padding: "1rem 0 1rem max(1rem, env(safe-area-inset-left))" }}
      >
        <div className="glass-chrome glass-sheen glass-squircle pointer-events-auto relative flex flex-col p-1.5">
          {activeIndex >= 0 ? (
            <span
              aria-hidden
              className="glass-fill glass-squircle-sm absolute inset-x-1.5 top-1.5 h-16 transition-transform duration-300 ease-glass"
              style={{ transform: `translateY(calc(${activeIndex} * ${RAIL_SLOT}))` }}
            />
          ) : null}
          {items.map((item, index) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative z-[1] flex size-16 flex-col items-center justify-center gap-1 text-[0.65rem] leading-none transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                } ${index > 0 ? "mt-1.5" : ""}`}
              >
                <Icon className="size-5" aria-hidden />
                <span className="text-center">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
