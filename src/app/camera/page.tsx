import { AppHeader } from "@/components/app-header";
import { FloatingDock } from "@/components/floating-dock";
import { UploadForm } from "@/components/upload-form";

export default function CameraPage() {
  return (
    <div className="min-h-dvh pb-28">
      <AppHeader title="Foto teilen" subtitle="Kamera oder mehrere aus der Galerie" />
      <main className="mx-auto max-w-lg px-4 py-4">
        <UploadForm />
      </main>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
