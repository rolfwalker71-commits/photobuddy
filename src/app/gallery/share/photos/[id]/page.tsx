import { GuestPhotoPage } from "@/components/guest-photo-page";

export default async function GuestPhotoRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GuestPhotoPage photoId={id} />;
}
