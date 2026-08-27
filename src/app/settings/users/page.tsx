import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { AdminUsersPanel } from "@/components/admin-users-panel";
import { FloatingDock } from "@/components/floating-dock";

export default function AdminUsersPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader
        title="Teilnehmer"
        subtitle="Konten anlegen, Passwort zurücksetzen, deaktivieren"
      />
      <main className="mx-auto max-w-lg px-4 py-4">
        <p className="mb-4">
          <Link
            href="/settings"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Zurück zu Einstellungen
          </Link>
        </p>
        <AdminUsersPanel />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
