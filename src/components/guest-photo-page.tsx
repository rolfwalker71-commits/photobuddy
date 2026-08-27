"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FloatingDock } from "@/components/floating-dock";
import { PhotoDetail } from "@/components/photo-detail";

function GuestPhotoInner({ photoId }: { photoId: string }) {
  const params = useSearchParams();
  const key = params.get("key");
  return (
    <div className="min-h-dvh px-4 py-4 pb-28">
      <PhotoDetail photoId={photoId} mode="guest" shareKey={key} />
      <FloatingDock mode="guest" shareKey={key} />
    </div>
  );
}

export function GuestPhotoPage({ photoId }: { photoId: string }) {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          Foto wird geladen…
        </p>
      }
    >
      <GuestPhotoInner photoId={photoId} />
    </Suspense>
  );
}
