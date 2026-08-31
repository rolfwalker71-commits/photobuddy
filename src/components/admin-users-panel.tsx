"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import type { Album, Profile } from "@/lib/types";

type AdminUser = Profile & { album_ids?: string[] };

type FormState = {
  display_name: string;
  email: string;
  password: string;
};

const emptyForm: FormState = { display_name: "", email: "", password: "" };

export function AdminUsersPanel() {
  const router = useRouter();
  const [me, setMe] = useState<Profile | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formAlbums, setFormAlbums] = useState<string[]>([]);
  const [editAlbums, setEditAlbums] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const session = await api<{ user: Profile }>("/api/auth/me");
        if (session.user.role !== "admin") {
          router.replace("/settings");
          return;
        }
        setMe(session.user);
        const [data, albumData] = await Promise.all([
          api<{ users: AdminUser[] }>("/api/admin/users"),
          api<{ albums: Album[] }>("/api/albums"),
        ]);
        setUsers(data.users);
        setAlbums(albumData.albums);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      }
    };
    void load();
  }, [router]);

  function flash(message: string) {
    setStatus(message);
    setError(null);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ user: AdminUser }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          email: form.email.trim(),
          password: form.password,
          album_ids: formAlbums,
        }),
      });
      setUsers((prev) =>
        [...prev, data.user].sort((a, b) =>
          a.display_name.localeCompare(b.display_name, "de"),
        ),
      );
      setForm(emptyForm);
      setFormAlbums([]);
      flash("Teilnehmer angelegt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ user: AdminUser }>(`/api/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: editName.trim(),
          ...(editPassword ? { password: editPassword } : {}),
          album_ids: editAlbums,
        }),
      });
      setUsers((prev) => prev.map((item) => (item.id === id ? data.user : item)));
      setEditingId(null);
      setEditPassword("");
      flash("Gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(user: Profile, isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ user: AdminUser }>(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? data.user : item)),
      );
      flash(isActive ? "Konto aktiviert." : "Konto deaktiviert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Änderung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user: Profile) {
    if (
      !window.confirm(
        `${user.display_name} wirklich löschen? Das geht nur ohne vorhandene Fotos.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      flash("Gelöscht.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  const adminCount = users.filter((user) => user.role === "admin").length;
  const activeAdminCount = users.filter(
    (user) => user.role === "admin" && user.is_active,
  ).length;

  return (
    <div className="space-y-6">
      <form
        onSubmit={(event) => void createUser(event)}
        className="space-y-3 rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="size-4" aria-hidden />
          <h2 className="text-base font-semibold">
            Teilnehmer anlegen
          </h2>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">
          Login-Konto mit E-Mail und Passwort. Danach Alben zuordnen — oder
          gleich hier anhaken. Gäste brauchen kein Konto.
        </p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Anzeigename</span>
          <input
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={form.display_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, display_name: event.target.value }))
            }
            autoComplete="name"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">E-Mail</span>
          <input
            type="email"
            required
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={form.email}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Passwort</span>
          <input
            type="password"
            required
            minLength={4}
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            autoComplete="new-password"
          />
        </label>
        {albums.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Alben</legend>
            <ul className="space-y-1">
              {albums.map((album) => (
                <li key={album.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-background px-3 ring-1 ring-border">
                    <input
                      type="checkbox"
                      checked={formAlbums.includes(album.id)}
                      onChange={() =>
                        setFormAlbums((prev) =>
                          prev.includes(album.id)
                            ? prev.filter((id) => id !== album.id)
                            : [...prev, album.id],
                        )
                      }
                    />
                    <span className="text-sm leading-snug break-words">
                      {album.name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Anlegen
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold px-1">Konten</h2>
        <ul className="space-y-3">
          {users.map((user) => {
            const isLastAdmin = user.role === "admin" && adminCount < 2;
            const isLastActiveAdmin =
              user.role === "admin" && user.is_active && activeAdminCount < 2;
            const editing = editingId === user.id;
            return (
              <li
                key={user.id}
                className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-snug break-words">
                      {user.display_name}
                      {me?.id === user.id ? (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          du
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 break-all text-sm text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[0.7rem] font-medium leading-none">
                    {user.role === "admin" ? "Admin" : "Teilnehmer"}
                    {!user.is_active ? " · inaktiv" : ""}
                  </span>
                </div>

                {editing ? (
                  <div className="mt-3 space-y-2">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">Anzeigename</span>
                      <input
                        className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                    </label>
                    {albums.length > 0 ? (
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Alben</legend>
                        <ul className="space-y-1">
                          {albums.map((album) => (
                            <li key={album.id}>
                              <label className="flex min-h-11 items-center gap-3 rounded-2xl bg-background px-3 ring-1 ring-border">
                                <input
                                  type="checkbox"
                                  checked={editAlbums.includes(album.id)}
                                  onChange={() =>
                                    setEditAlbums((prev) =>
                                      prev.includes(album.id)
                                        ? prev.filter((id) => id !== album.id)
                                        : [...prev, album.id],
                                    )
                                  }
                                />
                                <span className="text-sm leading-snug break-words">
                                  {album.name}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    ) : null}
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">
                        Neues Passwort (optional)
                      </span>
                      <input
                        type="password"
                        minLength={4}
                        className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
                        value={editPassword}
                        onChange={(event) => setEditPassword(event.target.value)}
                        autoComplete="new-password"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(user.id)}
                        className="inline-flex h-11 items-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                      >
                        Speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditPassword("");
                        }}
                        className="inline-flex h-11 items-center rounded-2xl bg-muted px-4 text-sm font-medium"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(user.id);
                        setEditName(user.display_name);
                        setEditPassword("");
                        setEditAlbums(user.album_ids ?? []);
                      }}
                      className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm font-medium"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      disabled={busy || (user.is_active && isLastActiveAdmin)}
                      onClick={() => void setActive(user, !user.is_active)}
                      className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm font-medium disabled:opacity-50"
                    >
                      {user.is_active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || isLastAdmin}
                      onClick={() => void removeUser(user)}
                      className="inline-flex h-11 items-center rounded-2xl bg-muted px-3 text-sm font-medium text-destructive disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
