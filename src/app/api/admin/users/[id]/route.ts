import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { HttpError, jsonError, requireAdmin } from "@/lib/auth/request";
import { toProfile } from "@/lib/db/mappers";
import {
  countOtherActiveAdmins,
  countOtherAdmins,
  countPhotosByUser,
  deleteUser,
  findUserById,
  listAlbumIdsForUser,
  setUserAlbums,
  updateUserAdmin,
} from "@/lib/db/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const user = await findUserById(id);
    if (!user) throw new HttpError(404, "Nutzer nicht gefunden.");

    const body = (await request.json()) as {
      display_name?: string;
      password?: string;
      is_active?: boolean;
      album_ids?: string[];
    };

    if (user.role === "admin" && body.is_active === false) {
      if ((await countOtherActiveAdmins(id)) < 1) {
        throw new HttpError(409, "Der letzte Admin kann nicht deaktiviert werden.");
      }
    }

    let passwordHash: string | undefined;
    if (body.password != null && body.password !== "") {
      if (body.password.length < 4) {
        throw new HttpError(400, "Passwort muss mindestens 4 Zeichen haben.");
      }
      passwordHash = await hashPassword(body.password);
    }

    const row = await updateUserAdmin(id, {
      displayName: body.display_name,
      passwordHash,
      isActive: body.is_active,
    });
    if (!row) throw new HttpError(404, "Nutzer nicht gefunden.");
    if (Array.isArray(body.album_ids)) {
      await setUserAlbums(id, body.album_ids);
    }
    return NextResponse.json({
      user: {
        ...toProfile(row),
        album_ids: await listAlbumIdsForUser(id),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const user = await findUserById(id);
    if (!user) throw new HttpError(404, "Nutzer nicht gefunden.");

    if (user.role === "admin" && (await countOtherAdmins(id)) < 1) {
      throw new HttpError(409, "Der letzte Admin kann nicht gelöscht werden.");
    }

    if ((await countPhotosByUser(id)) > 0) {
      throw new HttpError(
        409,
        "Hat noch Fotos. Bitte deaktivieren statt löschen.",
      );
    }

    await deleteUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
