import { DatabaseBackup } from "lucide-react";

const link =
  "inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-medium";

/** Admin: download a full backup. Plain links so the browser streams to disk. */
export function BackupPanel() {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border">
      <h2 className="inline-flex items-center gap-2 text-base font-semibold">
        <DatabaseBackup className="size-4" aria-hidden />
        Backup
      </h2>
      <p className="text-sm leading-snug text-muted-foreground">
        ZIP mit Datenbank, allen Fotos, Videos und Sprachnotizen. Einspielen mit{" "}
        <code className="rounded bg-muted px-1 text-xs">scripts/restore-backup.sh</code>
        . Automatisch jede Nacht: <code className="rounded bg-muted px-1 text-xs">scripts/backup.sh</code>{" "}
        per cron auf dem Server.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a href="/api/admin/backup" download className={`${link} bg-primary text-primary-foreground`}>
          Komplett herunterladen
        </a>
        <a href="/api/admin/backup?photos=0" download className={`${link} bg-muted`}>
          Nur Datenbank
        </a>
      </div>
    </section>
  );
}
