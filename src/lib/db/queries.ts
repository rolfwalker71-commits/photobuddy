import { query, queryOne } from "@/lib/db/pool";
import {
  toAlbum,
  toComment,
  toPhoto,
  toProfile,
  toReaction,
  toShareLink,
  toTag,
  type AlbumRow,
  type PhotoRow,
  type ShareLinkRow,
  type UserRow,
} from "@/lib/db/mappers";
import type {
  Album,
  Comment,
  Photo,
  PhotoReactionSummary,
  PhotoTag,
  Profile,
  Reaction,
  ShareLink,
  UserRole,
} from "@/lib/types";

const PROFILE_COLS =
  "id, email, display_name, avatar_url, role, accent_color, is_active, created_at, updated_at";

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
  role?: UserRole;
}) {
  return queryOne<UserRow>(
    `insert into public.users (email, password_hash, display_name, accent_color, role)
     values (lower($1), $2, $3, $4, $5)
     returning *`,
    [
      input.email.trim(),
      input.passwordHash,
      input.displayName.trim() || input.email.split("@")[0],
      input.accentColor || "#0f766e",
      input.role || "teilnehmer",
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

export async function updateUserAdmin(
  id: string,
  input: {
    displayName?: string;
    passwordHash?: string;
    isActive?: boolean;
  },
) {
  const current = await findUserById(id);
  if (!current) return null;

  const displayName = input.displayName?.trim() || current.display_name;
  const isActive = input.isActive ?? current.is_active !== false;
  const passwordHash = input.passwordHash ?? current.password_hash;

  return queryOne<UserRow>(
    `update public.users
     set display_name = $2, is_active = $3, password_hash = $4
     where id = $1
     returning *`,
    [id, displayName, isActive, passwordHash],
  );
}

export async function deleteUser(id: string) {
  await query(`delete from public.users where id = $1`, [id]);
}

export async function countOtherAdmins(id: string) {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.users
     where role = 'admin' and id <> $1`,
    [id],
  );
  return Number(row?.n ?? 0);
}

export async function countOtherActiveAdmins(id: string) {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.users
     where role = 'admin' and is_active = true and id <> $1`,
    [id],
  );
  return Number(row?.n ?? 0);
}

export async function countPhotosByUser(id: string) {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.photos where uploaded_by = $1`,
    [id],
  );
  return Number(row?.n ?? 0);
}

export async function listPhotos(albumId: string): Promise<Photo[]> {
  const rows = await query<PhotoRow>(
    `select * from public.photos
     where album_id = $1
     order by coalesce(taken_at, created_at) desc`,
    [albumId],
  );
  return rows.map(toPhoto);
}

export async function listPhotosForGrid(albumId: string): Promise<Photo[]> {
  const [photos, tags, commentRows, reactionRows] = await Promise.all([
    listPhotos(albumId),
    listTags(),
    query<{ photo_id: string; n: string }>(
      `select photo_id, count(*)::text as n from public.comments group by photo_id`,
    ),
    query<{ photo_id: string; emoji: string; n: string }>(
      `select photo_id, emoji, count(*)::text as n
       from public.reactions
       group by photo_id, emoji
       order by count(*) desc`,
    ),
  ]);

  const commentsByPhoto = new Map<string, number>();
  for (const row of commentRows) {
    commentsByPhoto.set(row.photo_id, Number(row.n));
  }

  const reactionsByPhoto = new Map<string, PhotoReactionSummary[]>();
  for (const row of reactionRows) {
    const list = reactionsByPhoto.get(row.photo_id) ?? [];
    list.push({ emoji: row.emoji, count: Number(row.n) });
    reactionsByPhoto.set(row.photo_id, list);
  }

  const tagsByPhoto = new Map<string, PhotoTag[]>();
  for (const tag of tags) {
    const list = tagsByPhoto.get(tag.photo_id) ?? [];
    list.push(tag);
    tagsByPhoto.set(tag.photo_id, list);
  }

  return photos.map((photo) => ({
    ...photo,
    comment_count: commentsByPhoto.get(photo.id) ?? 0,
    reactions: reactionsByPhoto.get(photo.id) ?? [],
    tags: tagsByPhoto.get(photo.id) ?? [],
  }));
}

export async function getPhotosUpdatedStamp(albumId: string): Promise<string> {
  const row = await queryOne<{
    photos: string;
    comments: string;
    reactions: string;
    latest: Date | string | null;
  }>(
    `select
       (select count(*)::text from public.photos where album_id = $1) as photos,
       (select count(*)::text from public.comments c
         join public.photos p on p.id = c.photo_id where p.album_id = $1) as comments,
       (select count(*)::text from public.reactions r
         join public.photos p on p.id = r.photo_id where p.album_id = $1) as reactions,
       greatest(
         (select max(greatest(created_at, updated_at, coalesce(taken_at, created_at)))
           from public.photos where album_id = $1),
         (select max(c.created_at) from public.comments c
           join public.photos p on p.id = c.photo_id where p.album_id = $1),
         (select max(r.created_at) from public.reactions r
           join public.photos p on p.id = r.photo_id where p.album_id = $1)
       ) as latest`,
    [albumId],
  );
  const latest = row?.latest ? new Date(row.latest).toISOString() : "none";
  return `${row?.photos ?? "0"}:${row?.comments ?? "0"}:${row?.reactions ?? "0"}:${latest}`;
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const row = await queryOne<PhotoRow>(
    `select * from public.photos where id = $1`,
    [id],
  );
  return row ? toPhoto(row) : null;
}

export async function insertPhoto(input: {
  albumId: string;
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
       album_id, uploaded_by, storage_path, thumbnail_path, title, description,
       taken_at, latitude, longitude, location_name, width, height,
       mime_type, file_size
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *`,
    [
      input.albumId,
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
      input.guestName.slice(0, 80),
      input.guestSessionId,
      input.emoji.slice(0, 16),
    ],
  );
}

export async function resolveShareKey(key: string) {
  return queryOne<ShareLinkRow>(
    `select id, album_id, key, label, is_active, created_at, expires_at
     from public.share_links
     where key = $1 and is_active = true
       and (expires_at is null or expires_at > now())
     limit 1`,
    [key],
  );
}

export async function isValidShareKey(key: string) {
  return Boolean(await resolveShareKey(key));
}

export async function getAlbumIdForShareKey(key: string) {
  const row = await resolveShareKey(key);
  return row?.album_id ?? null;
}

export async function getShareLabel(key: string) {
  const row = await queryOne<{ label: string; album_name: string | null }>(
    `select sl.label, a.name as album_name
     from public.share_links sl
     left join public.albums a on a.id = sl.album_id
     where sl.key = $1
     limit 1`,
    [key],
  );
  return row?.album_name || row?.label || null;
}

export async function getShareLinkForAlbum(albumId: string): Promise<ShareLink | null> {
  const row = await queryOne<ShareLinkRow>(
    `select id, album_id, key, label, is_active, created_at, expires_at
     from public.share_links
     where album_id = $1
     limit 1`,
    [albumId],
  );
  return row ? toShareLink(row) : null;
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const rows = await query<ShareLinkRow>(
    `select id, album_id, key, label, is_active, created_at, expires_at
     from public.share_links
     order by created_at desc`,
  );
  return rows.map(toShareLink);
}

function newShareKey() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 20);
}

export async function createShareLink(input: {
  key?: string;
  createdBy: string;
  albumId: string;
  label?: string;
}) {
  const row = await queryOne<ShareLinkRow>(
    `insert into public.share_links (key, label, created_by, album_id)
     values ($1, $2, $3, $4)
     returning id, album_id, key, label, is_active, created_at, expires_at`,
    [
      input.key ?? newShareKey(),
      input.label ?? "Gäste-Link",
      input.createdBy,
      input.albumId,
    ],
  );
  if (!row) throw new Error("Link konnte nicht angelegt werden.");
  return toShareLink(row);
}

export async function ensureShareLink(albumId: string, createdBy: string) {
  return (
    (await getShareLinkForAlbum(albumId)) ??
    (await createShareLink({ albumId, createdBy }))
  );
}

export async function rotateShareLink(albumId: string, createdBy: string) {
  const existing = await getShareLinkForAlbum(albumId);
  const key = newShareKey();
  if (existing) {
    const row = await queryOne<ShareLinkRow>(
      `update public.share_links
       set key = $2, is_active = true, created_by = $3, label = 'Gäste-Link'
       where id = $1
       returning id, album_id, key, label, is_active, created_at, expires_at`,
      [existing.id, key, createdBy],
    );
    if (!row) throw new Error("Link konnte nicht erneuert werden.");
    return toShareLink(row);
  }
  return createShareLink({ key, createdBy, albumId });
}

export async function setShareLinkActive(id: string, isActive: boolean) {
  await query(`update public.share_links set is_active = $2 where id = $1`, [
    id,
    isActive,
  ]);
}

export async function setAlbumShareLinkActive(albumId: string, isActive: boolean) {
  await query(`update public.share_links set is_active = $2 where album_id = $1`, [
    albumId,
    isActive,
  ]);
  return getShareLinkForAlbum(albumId);
}

async function albumMemberMap() {
  const rows = await query<{ album_id: string; user_id: string }>(
    `select album_id, user_id from public.album_members`,
  );
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.album_id) ?? [];
    list.push(row.user_id);
    map.set(row.album_id, list);
  }
  return map;
}

async function albumPhotoCounts() {
  const rows = await query<{ album_id: string; n: string }>(
    `select album_id, count(*)::text as n from public.photos group by album_id`,
  );
  return new Map(rows.map((row) => [row.album_id, Number(row.n)]));
}

async function hydrateAlbums(rows: AlbumRow[]): Promise<Album[]> {
  const [members, counts, links] = await Promise.all([
    albumMemberMap(),
    albumPhotoCounts(),
    listShareLinks(),
  ]);
  const linkByAlbum = new Map(links.map((link) => [link.album_id, link]));
  return rows.map((row) =>
    toAlbum(
      row,
      members.get(row.id) ?? [],
      counts.get(row.id) ?? 0,
      linkByAlbum.get(row.id) ?? null,
    ),
  );
}

export async function listAlbums(): Promise<Album[]> {
  const rows = await query<AlbumRow>(
    `select id, name, created_at, updated_at from public.albums order by created_at asc`,
  );
  return hydrateAlbums(rows);
}

export async function listAlbumsForUser(userId: string): Promise<Album[]> {
  const rows = await query<AlbumRow>(
    `select a.id, a.name, a.created_at, a.updated_at
     from public.albums a
     join public.album_members m on m.album_id = a.id
     where m.user_id = $1
     order by a.created_at asc`,
    [userId],
  );
  return hydrateAlbums(rows);
}

export async function getAlbum(id: string): Promise<Album | null> {
  const row = await queryOne<AlbumRow>(
    `select id, name, created_at, updated_at from public.albums where id = $1`,
    [id],
  );
  if (!row) return null;
  const [hydrated] = await hydrateAlbums([row]);
  return hydrated ?? null;
}

export async function createAlbum(input: {
  name: string;
  createdBy: string;
  memberIds: string[];
}) {
  const row = await queryOne<AlbumRow>(
    `insert into public.albums (name) values ($1)
     returning id, name, created_at, updated_at`,
    [input.name.trim()],
  );
  if (!row) throw new Error("Album konnte nicht angelegt werden.");
  const members = new Set(input.memberIds);
  members.add(input.createdBy);
  await setAlbumMembers(row.id, [...members]);
  await ensureShareLink(row.id, input.createdBy);
  return getAlbum(row.id);
}

export async function renameAlbum(id: string, name: string) {
  const row = await queryOne<AlbumRow>(
    `update public.albums set name = $2 where id = $1
     returning id, name, created_at, updated_at`,
    [id, name.trim()],
  );
  if (!row) return null;
  const [hydrated] = await hydrateAlbums([row]);
  return hydrated ?? null;
}

export async function countAlbums() {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.albums`,
  );
  return Number(row?.n ?? 0);
}

export async function countPhotosInAlbum(albumId: string) {
  const row = await queryOne<{ n: string }>(
    `select count(*)::text as n from public.photos where album_id = $1`,
    [albumId],
  );
  return Number(row?.n ?? 0);
}

export async function deleteAlbum(id: string) {
  await query(`delete from public.albums where id = $1`, [id]);
}

export async function isAlbumMember(albumId: string, userId: string) {
  const row = await queryOne<{ user_id: string }>(
    `select user_id from public.album_members
     where album_id = $1 and user_id = $2
     limit 1`,
    [albumId, userId],
  );
  return Boolean(row);
}

export async function setAlbumMembers(albumId: string, userIds: string[]) {
  await query(`delete from public.album_members where album_id = $1`, [albumId]);
  const unique = [...new Set(userIds.filter(Boolean))];
  for (const userId of unique) {
    await query(
      `insert into public.album_members (album_id, user_id) values ($1, $2)
       on conflict do nothing`,
      [albumId, userId],
    );
  }
}

export async function setUserAlbums(userId: string, albumIds: string[]) {
  await query(`delete from public.album_members where user_id = $1`, [userId]);
  const unique = [...new Set(albumIds.filter(Boolean))];
  for (const albumId of unique) {
    await query(
      `insert into public.album_members (album_id, user_id) values ($1, $2)
       on conflict do nothing`,
      [albumId, userId],
    );
  }
}

export async function listAlbumIdsForUser(userId: string) {
  const rows = await query<{ album_id: string }>(
    `select album_id from public.album_members where user_id = $1`,
    [userId],
  );
  return rows.map((row) => row.album_id);
}
