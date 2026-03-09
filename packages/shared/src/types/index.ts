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
  "cancelled",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// Rapportobjekttyper (23 typer)
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
  "location",
  "drawing_position",
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
    icon: "SquareCheck",
    category: "valg",
    defaultConfig: { options: [] },
  },
  list_multi: {
    label: "Flervalg",
    icon: "List",
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
        { value: "gray", label: "Ikke relevant" },
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
    defaultConfig: {},
  },
  location: {
    label: "Lokasjon",
    icon: "MapPin",
    category: "spesial",
    defaultConfig: {},
  },
  drawing_position: {
    label: "Posisjon i tegning",
    icon: "Target",
    category: "spesial",
    defaultConfig: { buildingFilter: null, disciplineFilter: null },
  },
};

// Malsonene
export const TEMPLATE_ZONES = ["topptekst", "datafelter"] as const;
export type TemplateZone = (typeof TEMPLATE_ZONES)[number];

// Entreprisevelger-roller
export type EnterpriseRole = "creator" | "responder";

// Tillatelser — granulære tillatelser for prosjektgrupper
export const PERMISSIONS = [
  // Bakoverkompatible (gamle)
  "manage_field",
  "create_tasks",
  "create_checklists",
  "view_field",
  // Granulære tillatelser
  "checklist_edit",
  "checklist_view",
  "task_edit",
  "task_view",
  "template_manage",
  "drawing_manage",
  "drawing_view",
  "folder_manage",
  "folder_view",
  "enterprise_manage",
  "member_manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Norske labels for tillatelser
export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_field: "Administrer feltarbeid",
  create_tasks: "Opprett oppgaver",
  create_checklists: "Opprett sjekklister",
  view_field: "Se feltarbeid",
  checklist_edit: "Rediger sjekklister",
  checklist_view: "Se sjekklister",
  task_edit: "Rediger oppgaver",
  task_view: "Se oppgaver",
  template_manage: "Administrer maler",
  drawing_manage: "Administrer tegninger",
  drawing_view: "Se tegninger",
  folder_manage: "Administrer mapper",
  folder_view: "Se mapper",
  enterprise_manage: "Administrer entrepriser",
  member_manage: "Administrer medlemmer",
};

// Gruppering av tillatelser for matrise-UI
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Sjekklister", permissions: ["checklist_edit", "checklist_view"] },
  { label: "Oppgaver", permissions: ["task_edit", "task_view"] },
  { label: "Maler", permissions: ["template_manage"] },
  { label: "Tegninger", permissions: ["drawing_manage", "drawing_view"] },
  { label: "Mapper", permissions: ["folder_manage", "folder_view"] },
  { label: "Entrepriser", permissions: ["enterprise_manage"] },
  { label: "Medlemmer", permissions: ["member_manage"] },
];

// Mapping fra gamle til nye tillatelser (bakoverkompatibilitet)
export const LEGACY_PERMISSION_MAP: Record<string, Permission[]> = {
  manage_field: ["checklist_edit", "checklist_view", "task_edit", "task_view", "template_manage", "drawing_manage", "drawing_view", "folder_manage", "folder_view", "enterprise_manage", "member_manage"],
  create_tasks: ["task_edit", "task_view"],
  create_checklists: ["checklist_edit", "checklist_view"],
  view_field: ["checklist_view", "task_view", "drawing_view", "folder_view"],
};

// Utvid gamle tillatelser til nye granulære
export function utvidTillatelser(tillatelser: string[]): Set<Permission> {
  const utvidet = new Set<Permission>();
  for (const p of tillatelser) {
    utvidet.add(p as Permission);
    const mapped = LEGACY_PERMISSION_MAP[p];
    if (mapped) {
      for (const m of mapped) utvidet.add(m);
    }
  }
  return utvidet;
}

// Fagområder
export const DOMAINS = ["bygg", "hms", "kvalitet"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABELS: Record<Domain, string> = {
  bygg: "Bygg",
  hms: "HMS",
  kvalitet: "Kvalitet",
};

// Gruppekategorier
export const GROUP_CATEGORIES = ["generelt", "field", "brukergrupper"] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

// Standardgrupper for prosjekter
export interface StandardProjectGroup {
  slug: string;
  name: string;
  category: GroupCategory;
  permissions: Permission[];
  domains: Domain[];
}

export const STANDARD_PROJECT_GROUPS: StandardProjectGroup[] = [
  // Generelt
  {
    slug: "prosjekt-admin",
    name: "Prosjektadministratorer",
    category: "generelt",
    permissions: ["manage_field", "create_tasks", "create_checklists", "checklist_edit", "checklist_view", "task_edit", "task_view", "template_manage", "drawing_manage", "drawing_view", "folder_manage", "folder_view", "enterprise_manage", "member_manage"],
    domains: ["bygg", "hms", "kvalitet"],
  },
  // Feltarbeid
  {
    slug: "field-admin",
    name: "Feltarbeid-administratorer",
    category: "field",
    permissions: ["manage_field", "create_tasks", "create_checklists", "checklist_edit", "checklist_view", "task_edit", "task_view", "template_manage", "drawing_manage", "drawing_view", "folder_manage", "folder_view", "enterprise_manage", "member_manage"],
    domains: ["bygg"],
  },
  {
    slug: "oppgave-sjekkliste-koord",
    name: "Oppgave- og sjekklisteregistratorer",
    category: "field",
    permissions: ["create_tasks", "create_checklists", "checklist_edit", "checklist_view", "task_edit", "task_view"],
    domains: ["bygg"],
  },
  {
    slug: "field-observatorer",
    name: "Feltarbeid-registrator",
    category: "field",
    permissions: ["view_field", "checklist_view", "task_view", "drawing_view", "folder_view"],
    domains: ["bygg"],
  },
  {
    slug: "hms-ledere",
    name: "HMS",
    category: "field",
    permissions: ["create_tasks", "create_checklists", "checklist_edit", "checklist_view", "task_edit", "task_view"],
    domains: ["hms"],
  },
  // Brukergrupper
  {
    slug: "brukergruppe",
    name: "Brukergruppe",
    category: "brukergrupper",
    permissions: ["create_tasks", "create_checklists", "checklist_edit", "checklist_view", "task_edit", "task_view", "drawing_view", "folder_view"],
    domains: ["bygg"],
  },
];

// Prosjektmoduler — forhåndsdefinerte mal-pakker som kan aktiveres per prosjekt
export interface ModulDefinisjon {
  slug: string;
  navn: string;
  beskrivelse: string;
  kategori: "oppgave" | "sjekkliste";
  ikon: string; // lucide-react ikonnavn
  maler: ModulMal[];
}

export interface ModulMal {
  navn: string;
  prefix: string;
  beskrivelse: string;
  kategori: "oppgave" | "sjekkliste";
  domain: string;
  emner?: string[];
  objekter: ModulObjekt[];
}

export interface ModulObjekt {
  type: string;
  label: string;
  sortOrder: number;
  required?: boolean;
  config: Record<string, unknown>;
}

export const PROSJEKT_MODULER: ModulDefinisjon[] = [
  {
    slug: "godkjenning",
    navn: "Godkjenning",
    beskrivelse: "Endringsmelding, varsel om krav og økonomiske godkjenninger mellom entrepriser",
    kategori: "oppgave",
    ikon: "FileCheck",
    maler: [
      {
        navn: "Godkjenning",
        prefix: "GM",
        beskrivelse: "Endringsmelding, varsel om krav og økonomiske godkjenninger",
        kategori: "oppgave",
        domain: "bygg",
        emner: ["Endringsmelding", "Varsel om krav", "Tilleggsarbeid", "Fradrag", "Regulering"],
        objekter: [
          { type: "location", label: "Lokasjon", sortOrder: 0, config: { zone: "topptekst" } },
          { type: "date", label: "Dato", sortOrder: 1, required: true, config: { zone: "topptekst" } },
          { type: "person", label: "Ansvarlig", sortOrder: 2, required: true, config: { zone: "topptekst" } },
          { type: "company", label: "Oppretter-entreprise", sortOrder: 3, required: true, config: { role: "creator", zone: "topptekst" } },
          { type: "heading", label: "Beskrivelse", sortOrder: 10, config: { zone: "datafelter" } },
          { type: "text_field", label: "Beskrivelse av endring/krav", sortOrder: 11, required: true, config: { multiline: true, zone: "datafelter" } },
          { type: "text_field", label: "Begrunnelse", sortOrder: 12, config: { multiline: true, zone: "datafelter" } },
          { type: "text_field", label: "Referanse (kontrakt/avtale)", sortOrder: 13, config: { zone: "datafelter" } },
          { type: "heading", label: "Økonomi", sortOrder: 20, config: { zone: "datafelter" } },
          { type: "decimal", label: "Beløp eks. mva (NOK)", sortOrder: 21, config: { unit: "NOK", zone: "datafelter" } },
          { type: "list_single", label: "Type", sortOrder: 22, required: true, config: { options: ["Tillegg", "Fradrag", "Regulering", "Annet"], zone: "datafelter" } },
          { type: "date", label: "Frist for svar", sortOrder: 23, config: { zone: "datafelter" } },
          { type: "heading", label: "Dokumentasjon og vurdering", sortOrder: 30, config: { zone: "datafelter" } },
          { type: "attachments", label: "Vedlegg", sortOrder: 31, config: { zone: "datafelter" } },
          { type: "traffic_light", label: "Beslutning", sortOrder: 32, required: true, config: { options: [{ value: "green", label: "Godkjent" }, { value: "yellow", label: "Delvis godkjent" }, { value: "red", label: "Avvist" }, { value: "gray", label: "Ikke behandlet" }], zone: "datafelter" } },
          { type: "text_field", label: "Kommentar til beslutning", sortOrder: 33, config: { multiline: true, zone: "datafelter" } },
          { type: "signature", label: "Signatur", sortOrder: 34, config: { zone: "datafelter" } },
        ],
      },
    ],
  },
  {
    slug: "hms-avvik",
    navn: "HMS-avvik",
    beskrivelse: "Registrering og oppfølging av HMS-avvik, uønskede hendelser og risikoobservasjoner",
    kategori: "oppgave",
    ikon: "ShieldAlert",
    maler: [
      {
        navn: "HMS-avvik",
        prefix: "HMS",
        beskrivelse: "Registrering av HMS-avvik og uønskede hendelser",
        kategori: "oppgave",
        domain: "hms",
        emner: ["Personskade", "Nestenulykke", "Farlig forhold", "Risikoobservasjon", "Miljøavvik"],
        objekter: [
          { type: "location", label: "Lokasjon", sortOrder: 0, config: { zone: "topptekst" } },
          { type: "date_time", label: "Tidspunkt for hendelse", sortOrder: 1, required: true, config: { zone: "topptekst" } },
          { type: "person", label: "Registrert av", sortOrder: 2, required: true, config: { zone: "topptekst" } },
          { type: "heading", label: "Hendelse", sortOrder: 10, config: { zone: "datafelter" } },
          { type: "list_single", label: "Alvorlighetsgrad", sortOrder: 11, required: true, config: { options: ["Lav", "Middels", "Høy", "Kritisk"], zone: "datafelter" } },
          { type: "text_field", label: "Beskrivelse av hendelse", sortOrder: 12, required: true, config: { multiline: true, zone: "datafelter" } },
          { type: "text_field", label: "Umiddelbare tiltak", sortOrder: 13, config: { multiline: true, zone: "datafelter" } },
          { type: "attachments", label: "Bilder/dokumentasjon", sortOrder: 14, config: { zone: "datafelter" } },
          { type: "heading", label: "Oppfølging", sortOrder: 20, config: { zone: "datafelter" } },
          { type: "text_field", label: "Korrigerende tiltak", sortOrder: 21, config: { multiline: true, zone: "datafelter" } },
          { type: "date", label: "Frist for lukking", sortOrder: 22, config: { zone: "datafelter" } },
          { type: "traffic_light", label: "Status", sortOrder: 23, required: true, config: { options: [{ value: "red", label: "Åpent" }, { value: "yellow", label: "Under behandling" }, { value: "green", label: "Lukket" }], zone: "datafelter" } },
          { type: "signature", label: "Signatur ansvarlig", sortOrder: 24, config: { zone: "datafelter" } },
        ],
      },
    ],
  },
  {
    slug: "befaringsrapport",
    navn: "Befaringsrapport",
    beskrivelse: "Strukturert befaringsrapport med vær, deltakere og observasjoner",
    kategori: "sjekkliste",
    ikon: "ClipboardList",
    maler: [
      {
        navn: "Befaringsrapport",
        prefix: "BEF",
        beskrivelse: "Befaringsrapport med vær, deltakere og kontrollpunkter",
        kategori: "sjekkliste",
        domain: "bygg",
        objekter: [
          { type: "location", label: "Lokasjon", sortOrder: 0, config: { zone: "topptekst" } },
          { type: "date", label: "Befaringsdato", sortOrder: 1, required: true, config: { zone: "topptekst" } },
          { type: "weather", label: "Vær", sortOrder: 2, config: { zone: "topptekst" } },
          { type: "persons", label: "Deltakere", sortOrder: 3, required: true, config: { zone: "topptekst" } },
          { type: "heading", label: "Observasjoner", sortOrder: 10, config: { zone: "datafelter" } },
          { type: "text_field", label: "Generelle observasjoner", sortOrder: 11, config: { multiline: true, zone: "datafelter" } },
          { type: "attachments", label: "Bilder", sortOrder: 12, config: { zone: "datafelter" } },
          { type: "heading", label: "Avvik og anmerkninger", sortOrder: 20, config: { zone: "datafelter" } },
          { type: "text_field", label: "Avvik/anmerkninger", sortOrder: 21, config: { multiline: true, zone: "datafelter" } },
          { type: "text_field", label: "Avtalt oppfølging", sortOrder: 22, config: { multiline: true, zone: "datafelter" } },
          { type: "signature", label: "Signatur", sortOrder: 23, config: { zone: "datafelter" } },
        ],
      },
    ],
  },
];

// Entreprisebransjer
export const ENTERPRISE_INDUSTRIES = [
  "Bygg", "Elektro", "VVS", "Rør", "Ventilasjon", "Tele/data",
  "Heis", "Maler", "Gulv", "Tømrer", "Murer", "Grunnarbeid",
  "Prosjektledelse", "Byggherre", "Annet",
] as const;
export type EnterpriseIndustry = (typeof ENTERPRISE_INDUSTRIES)[number];

// Entreprisefarger — 32 distinkte farger for visuell differensiering
export const ENTERPRISE_COLORS = [
  "blue", "emerald", "purple", "amber", "rose", "teal", "indigo", "orange",
  "cyan", "lime", "fuchsia", "sky", "violet", "red", "green", "yellow",
  "pink", "slate", "zinc", "stone",
  "blue-800", "emerald-800", "purple-800", "amber-700", "rose-800", "teal-800", "indigo-800", "orange-700",
  "cyan-800", "lime-700", "fuchsia-800", "sky-800",
] as const;
export type EnterpriseColor = (typeof ENTERPRISE_COLORS)[number];

// Standard entrepriser for malprosjekt
export interface StandardEntreprise {
  navn: string;
  bransje: string;
  farge: string;
  entreprisenummer?: string;
}

export const STANDARD_ENTREPRISER: StandardEntreprise[] = [
  { navn: "Byggherre", bransje: "Byggherre", farge: "blue", entreprisenummer: "K00" },
  { navn: "Bygg", bransje: "Bygg", farge: "emerald", entreprisenummer: "K01" },
  { navn: "Elektro", bransje: "Elektro", farge: "amber", entreprisenummer: "K02" },
  { navn: "VVS", bransje: "VVS", farge: "purple", entreprisenummer: "K03" },
  { navn: "Ventilasjon", bransje: "Ventilasjon", farge: "teal", entreprisenummer: "K04" },
];

// Standard dokumentflyter for malprosjekt
// Refererer til entrepriser og maler via indeks (løst opp under opprettelse)
export interface StandardDokumentflyt {
  navn: string;
  /** Indekser inn i STANDARD_ENTREPRISER for oppretter-rolle */
  oppretter: number[];
  /** Indekser inn i STANDARD_ENTREPRISER for svarer-rolle */
  svarer: number[];
  /** Mal-slugger fra PROSJEKT_MODULER som skal tilknyttes */
  malPrefixer: string[];
}

export const STANDARD_DOKUMENTFLYTER: StandardDokumentflyt[] = [
  {
    navn: "Godkjenning — Bygg",
    oppretter: [0], // Byggherre
    svarer: [1],     // Bygg
    malPrefixer: ["GM"],
  },
  {
    navn: "Godkjenning — Elektro",
    oppretter: [0], // Byggherre
    svarer: [2],     // Elektro
    malPrefixer: ["GM"],
  },
  {
    navn: "Godkjenning — VVS",
    oppretter: [0], // Byggherre
    svarer: [3],     // VVS
    malPrefixer: ["GM"],
  },
  {
    navn: "HMS-avvik",
    oppretter: [0, 1, 2, 3, 4], // Alle entrepriser
    svarer: [0],                  // Byggherre
    malPrefixer: ["HMS"],
  },
  {
    navn: "Befaringsrapport",
    oppretter: [0], // Byggherre
    svarer: [],
    malPrefixer: ["BEF"],
  },
];

// Betingelser i malbygger
export const CONDITION_ELIGIBLE_TYPES = ["list_single", "list_multi"] as const;

/** @deprecated Bruk `obj.parentId != null` istedenfor — conditionParentId er migrert til DB-kolonne */
export function harBetingelse(config: Record<string, unknown>): boolean {
  return typeof config.conditionParentId === "string" && config.conditionParentId.length > 0;
}

/** @deprecated Bruk `erKontainerType(type)` */
export function erBetingelseKvalifisert(type: string): boolean {
  return (CONDITION_ELIGIBLE_TYPES as readonly string[]).includes(type);
}

// Kontainertyper som kan ha barn (rekursiv nesting)
export const CONTAINER_TYPES = ["list_single", "list_multi", "repeater"] as const;

export function erKontainerType(type: string): boolean {
  return (CONTAINER_TYPES as readonly string[]).includes(type);
}

export function harForelderObjekt(obj: { parentId?: string | null }): boolean {
  return obj.parentId != null;
}

// Trestruktur for rekursiv nesting
export interface TreObjekt {
  id: string;
  type: string;
  label: string;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
  parentId: string | null;
  children: TreObjekt[];
}

export function byggObjektTre<T extends { id: string; parentId?: string | null; sortOrder: number }>(
  objekter: T[],
): (T & { children: (T & { children: unknown[] })[] })[] {
  type Node = T & { children: Node[] };
  const map = new Map<string, Node>();
  const rotObjekter: Node[] = [];

  // Opprett noder
  for (const obj of objekter) {
    map.set(obj.id, { ...obj, children: [] });
  }

  // Knyt barn til foreldre
  for (const obj of objekter) {
    const node = map.get(obj.id)!;
    if (obj.parentId && map.has(obj.parentId)) {
      map.get(obj.parentId)!.children.push(node);
    } else {
      rotObjekter.push(node);
    }
  }

  // Sorter etter sone (topptekst først) deretter sortOrder innenfor sone
  function hentZonePrioritet(node: Node): number {
    const config = (node as unknown as { config?: Record<string, unknown> }).config;
    return config?.zone === "topptekst" ? 0 : 1;
  }

  function sorterRekursivt(noder: Node[]) {
    noder.sort((a, b) => {
      const zoneA = hentZonePrioritet(a);
      const zoneB = hentZonePrioritet(b);
      if (zoneA !== zoneB) return zoneA - zoneB;
      return a.sortOrder - b.sortOrder;
    });
    for (const node of noder) {
      sorterRekursivt(node.children);
    }
  }

  sorterRekursivt(rotObjekter);

  return rotObjekter as (T & { children: (T & { children: unknown[] })[] })[];
}

// Tegningsposisjon-verdi (for drawing_position-felter)
export interface TegningPosisjonVerdi {
  drawingId: string;
  positionX: number;
  positionY: number;
  drawingName: string;
}

// Vær-verdi (for weather-felter)
export interface VaerVerdi {
  temperatur?: number;
  forhold?: string;
  vindstyrke?: number;
  vaerkode?: number;
  nedbor?: string;
  kilde?: "manuell" | "automatisk";
}

// Bygningstyper
export const BUILDING_TYPES = ["bygg", "anlegg"] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

// Georeferanse for tegninger (2 referansepunkter for similaritetstransformasjon)
export interface GeoReferansePunkt {
  pixel: { x: number; y: number };  // prosent 0-100
  gps: { lat: number; lng: number };
}

export interface GeoReferanse {
  point1: GeoReferansePunkt;
  point2: GeoReferansePunkt;
}

// Mappeadgangskontroll
export const FOLDER_ACCESS_MODES = ["inherit", "custom"] as const;
export type FolderAccessMode = (typeof FOLDER_ACCESS_MODES)[number];
export const FOLDER_ACCESS_TYPES = ["enterprise", "group", "user"] as const;
export type FolderAccessType = (typeof FOLDER_ACCESS_TYPES)[number];

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
