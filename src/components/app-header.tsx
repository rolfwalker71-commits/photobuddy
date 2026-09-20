"use client";

import { useEffect, useState } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallButton } from "@/components/pwa/install-button";
import { isFiltered } from "@/lib/filters";
import type { PhotoFilters } from "@/lib/types";

type AppHeaderProps = {
  title: string;
  titleSlot?: React.ReactNode;
  subtitle?: string;
  onOpenFilters?: () => void;
  filters?: PhotoFilters;
  trailing?: React.ReactNode;
};

export function AppHeader({
  title,
  titleSlot,
  subtitle,
  onOpenFilters,
  filters,
  trailing,
}: AppHeaderProps) {
  const active = filters ? isFiltered(filters) : false;
  /* At the top of a page the header has nothing to float over, so it stays
     clear and only thickens into glass once content has scrolled under it. */
  const scrolled = useScrolled();

  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? "glass-chrome rounded-b-2xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          {titleSlot ?? (
            <p className="text-lg font-semibold leading-snug break-words">
              {title}
            </p>
          )}
          {subtitle ? (
            <p className="text-sm text-muted-foreground leading-snug break-words">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpenFilters ? (
            <button
              type="button"
              onClick={onOpenFilters}
              className="glass-fill glass-interactive glass-squircle-sm relative inline-flex size-11 items-center justify-center text-foreground"
              aria-label="Filter öffnen"
            >
              {active ? (
                <Filter className="size-5" />
              ) : (
                <SlidersHorizontal className="size-5" />
              )}
              {active ? (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--glass-tint-chrome)]" />
              ) : null}
            </button>
          ) : null}
          {trailing}
          <ThemeToggle />
          <span className="hidden sm:inline-flex">
            <InstallButton compact />
          </span>
        </div>
      </div>
    </header>
  );
}

/** True once the page has scrolled far enough for the header to sit on content. */
function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
