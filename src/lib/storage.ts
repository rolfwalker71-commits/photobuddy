import { getPublicEnv } from "@/lib/env";

export function publicPhotoUrl(path: string | null | undefined) {
  if (!path) return "";
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}
