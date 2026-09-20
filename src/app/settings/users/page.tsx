import Link from "next/link";
import { AdminNavLinks } from "@/components/admin-nav-links";
import { AppHeader } from "@/components/app-header";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import { FloatingDock } from "@/components/floating-dock";

export default function AdminUsersPage() {
  return (
    <div className="app-shell">
      <AppHeader
        title="Teilnehmer"
        subtitle="Hier legst du Login-Benutzer an und setzt Passwörter"
        trailing={<AdminNavLinks compact />}
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <p className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
          <Link
            href="/settings/albums"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zu den Alben
          </Link>
        </p>
        <AdminUsersPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
