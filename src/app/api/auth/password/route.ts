import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { HttpError, jsonError, requireTeilnehmer } from "@/lib/auth/request";
import { findUserById, updateUserAdmin } from "@/lib/db/queries";

export async function POST(request: Request) {
  try {
    const user = await requireTeilnehmer();
    const body = (await request.json()) as {
      current_password?: string;
      new_password?: string;
    };
    const current = body.current_password ?? "";
    const next = body.new_password ?? "";
    if (next.length < 8) {
      throw new HttpError(400, "Das neue Passwort muss mindestens 8 Zeichen haben.");
    }
    const row = await findUserById(user.id);
    if (!row || !(await verifyPassword(current, row.password_hash ?? ""))) {
      throw new HttpError(403, "Das aktuelle Passwort ist falsch.");
    }
    await updateUserAdmin(user.id, { passwordHash: await hashPassword(next) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
