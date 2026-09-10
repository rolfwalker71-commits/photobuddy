export type UserRole = "teilnehmer" | "admin";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  accent_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type PhotoTag = {
  photo_id: string;
  tag_id: string;
  name: string;
};

export type PhotoReactionSummary = {
  emoji: string;
  count: number;
  names: string[];
};

export type Photo = {
  id: string;
  album_id: string;
  uploaded_by: string;
  storage_path: string;
  thumbnail_path: string | null;
  title: string | null;
  description: string | null;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  file_size: number | null;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  reactions?: PhotoReactionSummary[];
  tags?: PhotoTag[];
};

export type Comment = {
  id: string;
  photo_id: string;
  author_id: string | null;
  guest_name: string | null;
  guest_session_id?: string | null;
  body: string;
  created_at: string;
  author_display_name?: string | null;
};

export type Reaction = {
  id: string;
  photo_id: string;
  emoji: string;
  guest_name: string | null;
  author_id: string | null;
  author_display_name?: string | null;
};

export type DayNote = {
  id: string;
  album_id: string;
  note_date: string;
  body: string;
  author_id: string;
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
};

export type ShareLink = {
  id: string;
  album_id: string;
  key: string;
  label: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export type Album = {
  id: string;
  name: string;
  cover_photo_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  derived_starts_on: string | null;
  derived_ends_on: string | null;
  cover_path: string | null;
  created_at: string;
  updated_at: string;
  member_ids: string[];
  photo_count: number;
  share_link: ShareLink | null;
};

export type ViewerMode = "teilnehmer" | "guest";

export type PhotoFilters = {
  uploaderId: string;
  dateFrom: string;
  dateTo: string;
  location: string;
  tagNames: string[];
  onlyNew: boolean;
  onlyHighlights: boolean;
};
