import type { Pool } from "pg";
import { hashPassword } from "@/lib/auth/password";

export async function ensureAdminUser(pool: Pool) {
  const existingAdmin = await pool.query(
    `select 1 from public.users where role = 'admin' limit 1`,
  );
  if ((existingAdmin.rowCount ?? 0) > 0) return;

  const email = (process.env.ADMIN_EMAIL || "admin@photobuddy.local")
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    console.warn(
      "Photobuddy: kein Admin, aber ADMIN_PASSWORD fehlt. In .env setzen und neu starten.",
    );
    return;
  }

  const taken = await pool.query(
    `select 1 from public.users where lower(email) = lower($1) limit 1`,
    [email],
  );
  if ((taken.rowCount ?? 0) > 0) {
    console.warn(
      `Photobuddy: ${email} existiert schon, aber ohne Admin-Rolle. Anderen ADMIN_EMAIL setzen.`,
    );
    return;
  }

  const hash = await hashPassword(password);
  await pool.query(
    `insert into public.users (email, password_hash, display_name, role)
     values ($1, $2, $3, 'admin')`,
    [email, hash, "Admin"],
  );
  console.log(`Photobuddy: Admin angelegt (${email}).`);
}
