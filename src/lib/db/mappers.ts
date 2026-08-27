import type { Comment, Photo, PhotoTag, Profile, Reaction, ShareLink } from "@/lib/types";

function iso(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function isoOrNull(value: Date | string | null | undefined) {
  if (value == null) return null;
  return iso(value);
}

export type UserRow = {
  id: string;
  email: string;
  password_hash?: string;
  display_name: string;
  avatar_url: string | null;
  role: "teilnehmer";
  accent_color: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PhotoRow = {
  id: string;
  uploaded_by: string;
  storage_path: string;
  thumbnail_path: string | null;
  title: string | null;
  description: string | null;
  taken_at: Date | string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: "teilnehmer",
    accent_color: row.accent_color,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    uploaded_by: row.uploaded_by,
    storage_path: row.storage_path,
    thumbnail_path: row.thumbnail_path,
    title: row.title,
    description: row.description,
    taken_at: isoOrNull(row.taken_at),
    latitude: row.latitude,
    longitude: row.longitude,
    location_name: row.location_name,
    width: row.width,
    height: row.height,
    mime_type: row.mime_type,
    file_size: row.file_size,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

export function toTag(row: { photo_id: string; tag_id: string; name: string }): PhotoTag {
  return {
    photo_id: row.photo_id,
    tag_id: row.tag_id,
    name: row.name,
  };
}

export function toComment(row: {
  id: string;
  photo_id: string;
  author_id: string | null;
  guest_name: string | null;
  body: string;
  created_at: Date | string;
  author_display_name?: string | null;
}): Comment {
  return {
    id: row.id,
    photo_id: row.photo_id,
    author_id: row.author_id,
    guest_name: row.guest_name,
    body: row.body,
    created_at: iso(row.created_at),
    author_display_name: row.author_display_name ?? null,
  };
}

export function toReaction(row: {
  id: string;
  photo_id: string;
  emoji: string;
  guest_name: string | null;
  author_id: string | null;
}): Reaction {
  return {
    id: row.id,
    photo_id: row.photo_id,
    emoji: row.emoji,
    guest_name: row.guest_name,
    author_id: row.author_id,
  };
}

export function toShareLink(row: {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  created_at: Date | string;
  expires_at: Date | string | null;
}): ShareLink {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    is_active: row.is_active,
    created_at: iso(row.created_at),
    expires_at: isoOrNull(row.expires_at),
  };
}
