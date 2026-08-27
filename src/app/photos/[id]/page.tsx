import { FloatingDock } from "@/components/floating-dock";
import { PhotoDetail } from "@/components/photo-detail";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-dvh px-4 py-4 pb-28">
      <PhotoDetail photoId={id} mode="teilnehmer" shareKey={null} />
      <FloatingDock mode="teilnehmer" shareKey={null} />
    </div>
  );
}
