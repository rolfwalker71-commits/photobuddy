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
};

export type Photo = {
  id: string;
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
};

export type ShareLink = {
  id: string;
  key: string;
  label: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export type ViewerMode = "teilnehmer" | "guest";

export type PhotoFilters = {
  uploaderId: string;
  dateFrom: string;
  dateTo: string;
  location: string;
};
