// src/types/dashboard.ts

export type AnnouncementType = 'info' | 'success' | 'warning' | 'update' | 'announcement';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  announcement_type: AnnouncementType;
  type_display: string;
  icon?: string;
  order: number;
  is_active: boolean;
  is_global: boolean;
  tenant_id?: string;
  start_date?: string;
  end_date?: string;
  is_visible?: boolean;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface AnnouncementsResponse {
  count: number;
  results: Announcement[];
}

export interface AnnouncementStats {
  total: number;
  by_type: Record<AnnouncementType, number>;
  global: number;
  tenant_specific: number;
}
