// Statusflyt for entreprisedokumenter
export const DOCUMENT_STATUSES = [
  "draft",
  "sent",
  "received",
  "in_progress",
  "responded",
  "approved",
  "rejected",
  "closed",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// Rapportobjekttyper (15 typer)
export const REPORT_OBJECT_TYPES = [
  "text_field",
  "camera_field",
  "image_picker",
  "checkbox",
  "multi_select",
  "number_value",
  "date_time",
  "signature",
  "location_picker",
  "comment_field",
  "status_picker",
  "enterprise_picker",
  "file_attachment",
  "drawing_reference",
  "section_divider",
] as const;

export type ReportObjectType = (typeof REPORT_OBJECT_TYPES)[number];

// Entreprisevelger-roller
export type EnterpriseRole = "creator" | "responder";

// Grunnleggende entitetsgrensesnitt
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// GPS-data
export interface GpsData {
  lat: number;
  lng: number;
  enabled: boolean;
}

// Synkroniseringsstatus for offline-først
export interface SyncableEntity extends BaseEntity {
  isSynced: boolean;
  lastSyncedAt: Date | null;
}
