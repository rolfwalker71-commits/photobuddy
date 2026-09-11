import { NextResponse } from "next/server";
import {
  assertCanAccessAlbum,
  jsonError,
  requireEditor,
} from "@/lib/auth/request";
import { listPhotosNeedingWeather, updatePhotoWeather } from "@/lib/db/queries";
import { fetchArchiveWeather } from "@/lib/weather";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const user = await requireEditor(request);
    await assertCanAccessAlbum(
      { mode: "teilnehmer", user, shareKey: null, albumId: null },
      id,
    );
    const photos = await listPhotosNeedingWeather(id, 40);
    let updated = 0;
    for (const photo of photos) {
      if (
        photo.latitude == null ||
        photo.longitude == null ||
        !photo.taken_at
      ) {
        continue;
      }
      const weather = await fetchArchiveWeather({
        latitude: photo.latitude,
        longitude: photo.longitude,
        takenAt: photo.taken_at,
      });
      if (!weather) continue;
      await updatePhotoWeather(photo.id, {
        tempC: weather.tempC,
        code: weather.code,
      });
      updated += 1;
    }
    return NextResponse.json({
      scanned: photos.length,
      updated,
      remaining: photos.length > 0 && updated < photos.length,
    });
  } catch (err) {
    return jsonError(err);
  }
}
