import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import {
  HttpError,
  bearerMatchesAuthSecret,
  jsonError,
  requireAdmin,
} from "@/lib/auth/request";
import { toProfile } from "@/lib/db/mappers";
import {
  createUser,
  findUserByEmail,
  listAlbumIdsForUser,
  listProfiles,
  setUserAlbums,
} from "@/lib/db/queries";

async function assertCanCreateUsers(request: Request) {
  if (bearerMatchesAuthSecret(request)) return;
  await requireAdmin();
}

export async function GET() {
  try {
    await requireAdmin();
    const users = await listProfiles();
    const withAlbums = await Promise.all(
      users.map(async (user) => ({
        ...user,
        album_ids: await listAlbumIdsForUser(user.id),
      })),
    );
    return NextResponse.json({ users: withAlbums });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    await assertCanCreateUsers(request);
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      display_name?: string;
      accent_color?: string;
      album_ids?: string[];
    };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      throw new HttpError(400, "E-Mail und Passwort sind nötig.");
    }
    if (password.length < 4) {
      throw new HttpError(400, "Passwort muss mindestens 4 Zeichen haben.");
    }
    if (await findUserByEmail(email)) {
      throw new HttpError(409, "Diese E-Mail existiert schon.");
    }
    const user = await createUser({
      email,
      passwordHash: await hashPassword(password),
      displayName: body.display_name || email.split("@")[0],
      accentColor: body.accent_color,
      role: "teilnehmer",
    });
    if (!user) throw new HttpError(500, "Nutzer konnte nicht angelegt werden.");
    if (Array.isArray(body.album_ids)) {
      await setUserAlbums(user.id, body.album_ids);
    }
    return NextResponse.json({
      user: {
        ...toProfile(user),
        album_ids: await listAlbumIdsForUser(user.id),
      },
      email: user.email,
    });
  } catch (err) {
    return jsonError(err);
  }
}
