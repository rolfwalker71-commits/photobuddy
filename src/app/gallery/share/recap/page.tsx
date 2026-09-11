"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { GuestNamePrompt } from "@/components/guest-name-prompt";
import { RecapView } from "@/components/recap-view";

function GuestRecapInner() {
  const params = useSearchParams();
  return (
    <>
      <GuestNamePrompt />
      <RecapView mode="guest" shareKey={params.get("key")} />
    </>
  );
}

export default function GuestRecapPage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          Rückblick wird geladen…
        </p>
      }
    >
      <GuestRecapInner />
    </Suspense>
  );
}
