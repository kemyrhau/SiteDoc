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

// Rapportobjekttyper (21 typer)
export const REPORT_OBJECT_TYPES = [
  "heading",
  "subtitle",
  "text_field",
  "list_single",
  "list_multi",
  "integer",
  "decimal",
  "calculation",
  "traffic_light",
  "date",
  "date_time",
  "person",
  "persons",
  "company",
  "attachments",
  "bim_property",
  "zone_property",
  "room_property",
  "weather",
  "signature",
  "repeater",
] as const;

export type ReportObjectType = (typeof REPORT_OBJECT_TYPES)[number];

// Kategorier for rapportobjekttyper
export type ReportObjectCategory =
  | "tekst"
  | "valg"
  | "tall"
  | "dato"
  | "person"
  | "fil"
  | "spesial";

// Metadata for rapportobjekttyper
export interface ReportObjectTypeMeta {
  label: string;
  icon: string;
  category: ReportObjectCategory;
  defaultConfig: Record<string, unknown>;
}

// Metadata-map for alle rapportobjekttyper
export const REPORT_OBJECT_TYPE_META: Record<ReportObjectType, ReportObjectTypeMeta> = {
  heading: {
    label: "Overskrift",
    icon: "Heading",
    category: "tekst",
    defaultConfig: {},
  },
  subtitle: {
    label: "Undertittel",
    icon: "Type",
    category: "tekst",
    defaultConfig: {},
  },
  text_field: {
    label: "Tekstfelt",
    icon: "AlignLeft",
    category: "tekst",
    defaultConfig: { multiline: false },
  },
  list_single: {
    label: "Enkeltvalg",
    icon: "CircleDot",
    category: "valg",
    defaultConfig: { options: [] },
  },
  list_multi: {
    label: "Flervalg",
    icon: "ListChecks",
    category: "valg",
    defaultConfig: { options: [] },
  },
  integer: {
    label: "Heltall",
    icon: "Hash",
    category: "tall",
    defaultConfig: { min: null, max: null, unit: "" },
  },
  decimal: {
    label: "Desimaltall",
    icon: "Percent",
    category: "tall",
    defaultConfig: { min: null, max: null, decimals: 2, unit: "" },
  },
  calculation: {
    label: "Beregning",
    icon: "Calculator",
    category: "tall",
    defaultConfig: { formula: "" },
  },
  traffic_light: {
    label: "Trafikklys",
    icon: "CircleDot",
    category: "valg",
    defaultConfig: {
      options: [
        { value: "green", label: "Godkjent" },
        { value: "yellow", label: "Anmerkning" },
        { value: "red", label: "Avvik" },
      ],
    },
  },
  date: {
    label: "Dato",
    icon: "Calendar",
    category: "dato",
    defaultConfig: {},
  },
  date_time: {
    label: "Dato og tid",
    icon: "Clock",
    category: "dato",
    defaultConfig: {},
  },
  person: {
    label: "Person",
    icon: "User",
    category: "person",
    defaultConfig: { role: "" },
  },
  persons: {
    label: "Flere personer",
    icon: "Users",
    category: "person",
    defaultConfig: { role: "", max: null },
  },
  company: {
    label: "Firma",
    icon: "Building2",
    category: "person",
    defaultConfig: { role: "" },
  },
  attachments: {
    label: "Vedlegg",
    icon: "Paperclip",
    category: "fil",
    defaultConfig: { maxFiles: 10, acceptedTypes: [] },
  },
  bim_property: {
    label: "BIM-egenskap",
    icon: "Box",
    category: "spesial",
    defaultConfig: { propertyName: "" },
  },
  zone_property: {
    label: "Soneegenskap",
    icon: "Map",
    category: "spesial",
    defaultConfig: { propertyName: "" },
  },
  room_property: {
    label: "Romegenskap",
    icon: "DoorOpen",
    category: "spesial",
    defaultConfig: { propertyName: "" },
  },
  weather: {
    label: "Vær",
    icon: "CloudSun",
    category: "spesial",
    defaultConfig: {},
  },
  signature: {
    label: "Signatur",
    icon: "PenLine",
    category: "spesial",
    defaultConfig: {},
  },
  repeater: {
    label: "Repeater",
    icon: "Repeat",
    category: "spesial",
    defaultConfig: { children: [] },
  },
};

// Malsonene
export const TEMPLATE_ZONES = ["topptekst", "datafelter"] as const;
export type TemplateZone = (typeof TEMPLATE_ZONES)[number];

// Entreprisevelger-roller
export type EnterpriseRole = "creator" | "responder";

// Gruppekategorier
export const GROUP_CATEGORIES = ["generelt", "field", "brukergrupper"] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

// Standardgrupper for prosjekter
export interface StandardProjectGroup {
  slug: string;
  name: string;
  category: GroupCategory;
  permissions: string[];
}

export const STANDARD_PROJECT_GROUPS: StandardProjectGroup[] = [
  {
    slug: "field-admin",
    name: "Field-administratorer",
    category: "field",
    permissions: ["manage_field", "create_tasks", "create_checklists"],
  },
  {
    slug: "oppgave-sjekkliste-koord",
    name: "Oppgave- og sjekklistekoordinatorer",
    category: "field",
    permissions: ["create_tasks", "create_checklists"],
  },
  {
    slug: "field-observatorer",
    name: "Field-observatorer",
    category: "field",
    permissions: ["view_field"],
  },
  {
    slug: "hms-ledere",
    name: "HMS-ledere",
    category: "field",
    permissions: ["create_tasks", "create_checklists"],
  },
];

// Entreprisebransjer
export const ENTERPRISE_INDUSTRIES = [
  "Bygg", "Elektro", "VVS", "Rør", "Ventilasjon", "Tele/data",
  "Heis", "Maler", "Gulv", "Tømrer", "Murer", "Grunnarbeid",
  "Prosjektledelse", "Byggherre", "Annet",
] as const;
export type EnterpriseIndustry = (typeof ENTERPRISE_INDUSTRIES)[number];

// Entreprisefarger
export const ENTERPRISE_COLORS = [
  "blue", "emerald", "purple", "amber", "rose", "teal", "indigo", "orange",
] as const;
export type EnterpriseColor = (typeof ENTERPRISE_COLORS)[number];

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
