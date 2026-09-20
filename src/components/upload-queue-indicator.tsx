"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle } from "lucide-react";
import { useUploadQueue } from "@/hooks/use-upload-queue";
import { startUploadQueue } from "@/lib/upload-queue";

const FINISHED_VISIBLE_MS = 4_000;

/** Global pill above the dock: progress, offline wait, or problems to look at. */
export function UploadQueueIndicator() {
  const pathname = usePathname();
  const queue = useUploadQueue();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    startUploadQueue();
  }, []);

  useEffect(() => {
    if (!queue.finished) return;
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), FINISHED_VISIBLE_MS + 50);
    return () => clearTimeout(timer);
  }, [queue.finished]);

  // The camera page shows the full queue panel and its own save button here.
  if (pathname.startsWith("/camera") || pathname.startsWith("/gallery/share")) {
    return null;
  }

  const waiting = queue.items.filter(
    (item) => item.status === "pending" || item.status === "uploading",
  ).length;
  const problems = queue.items.filter(
    (item) => item.status === "failed" || item.status === "duplicate",
  ).length;
  const showFinished =
    queue.items.length === 0 &&
    queue.finished != null &&
    now - queue.finished.at < FINISHED_VISIBLE_MS;

  if (queue.items.length === 0 && !showFinished) return null;

  let icon = <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />;
  let label: string;
  if (showFinished && queue.finished) {
    icon = <CheckCircle2 className="size-4 shrink-0" aria-hidden />;
    label = `${queue.finished.count} hochgeladen`;
  } else if (queue.pausedForAuth) {
    icon = <AlertTriangle className="size-4 shrink-0" aria-hidden />;
    label = `Anmelden, um ${waiting} Upload${waiting === 1 ? "" : "s"} fortzusetzen`;
  } else if (waiting > 0 && (!queue.online || queue.networkError) && !queue.activeId) {
    icon = <CloudOff className="size-4 shrink-0" aria-hidden />;
    label = `${waiting} warten auf Netz`;
  } else if (waiting > 0) {
    const total = queue.doneCount + waiting;
    const current = Math.min(queue.doneCount + 1, total);
    const percent =
      queue.progress != null ? ` · ${Math.round(queue.progress * 100)} %` : "";
    label = queue.activeId
      ? `Upload ${current} von ${total}${percent}`
      : `${waiting} Upload${waiting === 1 ? "" : "s"} in der Warteschlange`;
  } else {
    icon = <AlertTriangle className="size-4 shrink-0" aria-hidden />;
    label = `${problems} Upload${problems === 1 ? "" : "s"} brauchen dich`;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[35] flex justify-center px-4 lg:pl-[7.5rem]"
      style={{ bottom: "calc(4.75rem + max(0.75rem, env(safe-area-inset-bottom)))" }}
    >
      <Link
        href={queue.pausedForAuth ? "/login?next=/camera" : "/camera#warteschlange"}
        /* Chrome, not media glass: this floats over the app itself, where a
           dark pane would leave white text sitting on a cream background. */
        className="glass-chrome glass-interactive pointer-events-auto inline-flex min-h-10 max-w-full items-center gap-2 rounded-full px-4 text-sm font-medium"
        aria-live="polite"
      >
        {icon}
        <span className="truncate">{label}</span>
        {problems > 0 && waiting > 0 ? (
          <span className="rounded-full bg-destructive px-1.5 text-xs text-white">{problems}</span>
        ) : null}
      </Link>
    </div>
  );
}
