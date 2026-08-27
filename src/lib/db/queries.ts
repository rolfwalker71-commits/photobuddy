import { query, queryOne } from "@/lib/db/pool";
import {
  toComment,
  toPhoto,
  toProfile,
  toReaction,
  toShareLink,
  toTag,
  type PhotoRow,
  type UserRow,
} from "@/lib/db/mappers";
import type { Comment, Photo, PhotoTag, Profile, Reaction, ShareLink } from "@/lib/types";

const PROFILE_COLS =
  "id, email, display_name, avatar_url, role, accent_color, created_at, updated_at";

export async function findUserByEmail(email: string) {
  return queryOne<UserRow>(
    `select * from public.users where lower(email) = lower($1) limit 1`,
    [email.trim()],
  );
}

export async function findUserById(id: string) {
  return queryOne<UserRow>(
    `select * from public.users where id = $1 limit 1`,
    [id],
  );
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  accentColor?: string;
}) {
  return queryOne<UserRow>(
    `insert into public.users (email, password_hash, display_name, accent_color)
     values (lower($1), $2, $3, $4)
     returning *`,
    [
      input.email.trim(),
      input.passwordHash,
      input.displayName.trim() || input.email.split("@")[0],
      input.accentColor || "#0f766e",
    ],
  );
}

export async function updateUserProfile(
  id: string,
  input: { displayName: string; accentColor: string },
) {
  return queryOne<UserRow>(
    `update public.users
     set display_name = $2, accent_color = $3
     where id = $1
     returning ${PROFILE_COLS}`,
    [id, input.displayName.trim(), input.accentColor],
  );
}

export async function listProfiles(): Promise<Profile[]> {
  const rows = await query<UserRow>(
    `select ${PROFILE_COLS} from public.users order by display_name`,
  );
  return rows.map(toProfile);
}

export async function listPhotos(): Promise<Photo[]> {
  const rows = await query<PhotoRow>(
    `select * from public.photos
     order by coalesce(taken_at, created_at) desc`,
  );
  return rows.map(toPhoto);
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const row = await queryOne<PhotoRow>(
    `select * from public.photos where id = $1`,
    [id],
  );
  return row ? toPhoto(row) : null;
}

export async function insertPhoto(input: {
  uploadedBy: string;
  storagePath: string;
  thumbnailPath: string;
  title: string | null;
  description: string | null;
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  fileSize: number;
}): Promise<Photo> {
  const row = await queryOne<PhotoRow>(
    `insert into public.photos (
       uploaded_by, storage_path, thumbnail_path, title, description,
       taken_at, latitude, longitude, location_name, width, height,
       mime_type, file_size
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     returning *`,
    [
      input.uploadedBy,
      input.storagePath,
      input.thumbnailPath,
      input.title,
      input.description,
      input.takenAt,
      input.latitude,
      input.longitude,
      input.locationName,
      input.width,
      input.height,
      input.mimeType,
      input.fileSize,
    ],
  );
  if (!row) throw new Error("Foto konnte nicht gespeichert werden.");
  return toPhoto(row);
}

export async function updatePhoto(
  id: string,
  input: { title: string | null; description: string | null; locationName: string | null },
): Promise<Photo | null> {
  const row = await queryOne<PhotoRow>(
    `update public.photos
     set title = $2, description = $3, location_name = $4
     where id = $1
     returning *`,
    [id, input.title, input.description, input.locationName],
  );
  return row ? toPhoto(row) : null;
}

export async function deletePhoto(id: string) {
  await query(`delete from public.photos where id = $1`, [id]);
}

export async function listTags(): Promise<PhotoTag[]> {
  const rows = await query<{ photo_id: string; tag_id: string; name: string }>(
    `select pt.photo_id, t.id as tag_id, t.name
     from public.photo_tags pt
     join public.tags t on t.id = pt.tag_id`,
  );
  return rows.map(toTag);
}

export async function listTagsForPhoto(photoId: string): Promise<PhotoTag[]> {
  const rows = await query<{ photo_id: string; tag_id: string; name: string }>(
    `select pt.photo_id, t.id as tag_id, t.name
     from public.photo_tags pt
     join public.tags t on t.id = pt.tag_id
     where pt.photo_id = $1`,
    [photoId],
  );
  return rows.map(toTag);
}

export async function addTagToPhoto(photoId: string, name: string): Promise<PhotoTag> {
  const trimmed = name.trim();
  let tag = await queryOne<{ id: string; name: string }>(
    `select id, name from public.tags where lower(name) = lower($1) limit 1`,
    [trimmed],
  );
  if (!tag) {
    tag = await queryOne<{ id: string; name: string }>(
      `insert into public.tags (name) values ($1) returning id, name`,
      [trimmed],
    );
  }
  if (!tag) throw new Error("Tag konnte nicht angelegt werden.");
  await query(
    `insert into public.photo_tags (photo_id, tag_id) values ($1, $2)
     on conflict do nothing`,
    [photoId, tag.id],
  );
  return { photo_id: photoId, tag_id: tag.id, name: tag.name };
}

export async function listComments(photoId: string): Promise<Comment[]> {
  const rows = await query<{
    id: string;
    photo_id: string;
    author_id: string | null;
    guest_name: string | null;
    body: string;
    created_at: Date | string;
    author_display_name: string | null;
  }>(
    `select c.id, c.photo_id, c.author_id, c.guest_name, c.body, c.created_at,
            u.display_name as author_display_name
     from public.comments c
     left join public.users u on u.id = c.author_id
     where c.photo_id = $1
     order by c.created_at asc`,
    [photoId],
  );
  return rows.map(toComment);
}

export async function addTeilnehmerComment(input: {
  photoId: string;
  authorId: string;
  body: string;
}) {
  await query(
    `insert into public.comments (photo_id, author_id, body)
     values ($1, $2, $3)`,
    [input.photoId, input.authorId, input.body],
  );
}

export async function addGuestComment(input: {
  photoId: string;
  guestName: string;
  guestSessionId: string;
  body: string;
}) {
  await query(
    `insert into public.comments (photo_id, guest_name, guest_session_id, body)
     values ($1, $2, $3, $4)`,
    [input.photoId, input.guestName.slice(0, 80), input.guestSessionId, input.body.slice(0, 2000)],
  );
}

export async function deleteComment(id: string) {
  await query(`delete from public.comments where id = $1`, [id]);
}

export async function listReactions(photoId: string): Promise<Reaction[]> {
  const rows = await query<{
    id: string;
    photo_id: string;
    emoji: string;
    guest_name: string | null;
    author_id: string | null;
  }>(
    `select id, photo_id, emoji, guest_name, author_id
     from public.reactions
     where photo_id = $1`,
    [photoId],
  );
  return rows.map(toReaction);
}

export async function toggleTeilnehmerReaction(input: {
  photoId: string;
  authorId: string;
  emoji: string;
}) {
  const existing = await queryOne<{ id: string }>(
    `select id from public.reactions
     where photo_id = $1 and author_id = $2 and emoji = $3`,
    [input.photoId, input.authorId, input.emoji],
  );
  if (existing) {
    await query(`delete from public.reactions where id = $1`, [existing.id]);
    return;
  }
  await query(
    `insert into public.reactions (photo_id, author_id, emoji) values ($1, $2, $3)`,
    [input.photoId, input.authorId, input.emoji],
  );
}

export async function toggleGuestReaction(input: {
  photoId: string;
  guestName: string;
  guestSessionId: string;
  emoji: string;
}) {
  const existing = await queryOne<{ id: string }>(
    `select id from public.reactions
     where photo_id = $1 and guest_session_id = $2 and emoji = $3`,
    [input.photoId, input.guestSessionId, input.emoji],
  );
  if (existing) {
    await query(`delete from public.reactions where id = $1`, [existing.id]);
    return;
  }
  await query(
    `insert into public.reactions (photo_id, guest_name, guest_session_id, emoji)
     values ($1, $2, $3, $4)`,
    [
      input.photoId,
      input.guestName.slice(0, 80) || "Gast",
      input.guestSessionId,
      input.emoji.slice(0, 16),
    ],
  );
}

export async function isValidShareKey(key: string) {
  const row = await queryOne<{ key: string }>(
    `select key from public.share_links
     where key = $1 and is_active = true
       and (expires_at is null or expires_at > now())
     limit 1`,
    [key],
  );
  return Boolean(row);
}

export async function getShareLabel(key: string) {
  const row = await queryOne<{ label: string }>(
    `select label from public.share_links where key = $1 limit 1`,
    [key],
  );
  return row?.label ?? null;
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const rows = await query<{
    id: string;
    key: string;
    label: string;
    is_active: boolean;
    created_at: Date | string;
    expires_at: Date | string | null;
  }>(
    `select id, key, label, is_active, created_at, expires_at
     from public.share_links
     order by created_at desc`,
  );
  return rows.map(toShareLink);
}

export async function createShareLink(input: { key: string; createdBy: string }) {
  const row = await queryOne<{
    id: string;
    key: string;
    label: string;
    is_active: boolean;
    created_at: Date | string;
    expires_at: Date | string | null;
  }>(
    `insert into public.share_links (key, label, created_by)
     values ($1, 'Familien-Link', $2)
     returning id, key, label, is_active, created_at, expires_at`,
    [input.key, input.createdBy],
  );
  if (!row) throw new Error("Link konnte nicht angelegt werden.");
  return toShareLink(row);
}

export async function setShareLinkActive(id: string, isActive: boolean) {
  await query(`update public.share_links set is_active = $2 where id = $1`, [
    id,
    isActive,
  ]);
}
