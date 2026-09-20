import { FloatingDock } from "@/components/floating-dock";
import { PhotoDetail } from "@/components/photo-detail";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="app-shell pt-4">
      <div className="px-4">
        <PhotoDetail photoId={id} mode="teilnehmer" shareKey={null} />
      </div>
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
