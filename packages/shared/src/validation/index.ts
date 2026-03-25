import { z } from "zod";
import { DOCUMENT_STATUSES, REPORT_OBJECT_TYPES, TEMPLATE_ZONES, GROUP_CATEGORIES, FOLDER_ACCESS_MODES, FOLDER_ACCESS_TYPES, BUILDING_TYPES } from "../types";

// Dokumentstatus-validering
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

// Rapportobjekttype-validering
export const reportObjectTypeSchema = z.enum(REPORT_OBJECT_TYPES);

// Entrepriserolle-validering
export const enterpriseRoleSchema = z.enum(["creator", "responder"]);

// Malsone-validering
export const templateZoneSchema = z.enum(TEMPLATE_ZONES);

// GPS-data-validering
export const gpsDataSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  enabled: z.boolean(),
});

// Prosjektvalidering
export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  externalProjectNumber: z.string().max(100).optional(),
});

// Entreprisevalidering
export const createEnterpriseSchema = z.object({
  name: z.string().min(1).max(255),
  projectId: z.string().uuid(),
  enterpriseNumber: z.string().max(20).optional(),
  organizationNumber: z.string().optional(),
  color: z.string().max(50).optional(),
  industry: z.string().max(100).optional(),
  companyName: z.string().max(255).optional(),
  memberIds: z.array(z.string().uuid()).default([]),
});

// Kopier entreprise
export const copyEnterpriseSchema = z.object({
  sourceEnterpriseId: z.string().uuid(),
  targetProjectId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  color: z.string().max(50).optional(),
  memberIds: z.array(z.string().uuid()).default([]),
});

// Bygningstype-validering
export const buildingTypeSchema = z.enum(BUILDING_TYPES);

// Georeferanse-validering
const geoReferansePunktSchema = z.object({
  pixel: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export const geoReferanseSchema = z.object({
  point1: geoReferansePunktSchema,
  point2: geoReferansePunktSchema,
  ekstraPunkter: z.array(geoReferansePunktSchema).optional(),
});

// Bygningsvalidering
export const createBuildingSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd").max(255),
  projectId: z.string().uuid(),
  description: z.string().optional(),
  address: z.string().optional(),
  type: buildingTypeSchema.default("bygg"),
});

// Malkategori-validering
export const templateCategorySchema = z.enum(["oppgave", "sjekkliste"]);

// Fagområde-validering
export const templateDomainSchema = z.enum(["bygg", "hms", "kvalitet"]);

// Prefiks-validering (kan ikke avsluttes med tall)
export const templatePrefixSchema = z
  .string()
  .max(20)
  .refine((val) => !val || !/\d$/.test(val), "Prefiks kan ikke avsluttes med et nummer")
  .optional();

// Opprett mal-validering
export const createTemplateSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, "Navn er påkrevd").max(255),
  prefix: templatePrefixSchema,
  description: z.string().optional(),
  category: templateCategorySchema.default("sjekkliste"),
  domain: templateDomainSchema.default("bygg"),
  subjects: z.array(z.string().max(255)).default([]),
  workflowIds: z.array(z.string().uuid()).default([]),
});

// Arbeidsforløpvalidering
export const createWorkflowSchema = z.object({
  enterpriseId: z.string().uuid(),
  responderEnterpriseId: z.string().uuid().nullable().optional(),
  responderEnterprise2Id: z.string().uuid().nullable().optional(),
  responderEnterprise3Id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  templateIds: z.array(z.string().uuid()).default([]),
});

export const updateWorkflowSchema = z.object({
  id: z.string().uuid(),
  responderEnterpriseId: z.string().uuid().nullable().optional(),
  responderEnterprise2Id: z.string().uuid().nullable().optional(),
  responderEnterprise3Id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  templateIds: z.array(z.string().uuid()).optional(),
});

// Medlemsvalidering
export const addMemberSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email("Ugyldig e-postadresse"),
  firstName: z.string().min(1, "Fornavn er påkrevd"),
  lastName: z.string().min(1, "Etternavn er påkrevd"),
  phone: z.string().optional(),
  role: z.enum(["member", "admin"]).default("member"),
  enterpriseIds: z.array(z.string().uuid()).default([]),
  melding: z.string().max(500).optional(),
});

// Tegningsvalidering
export const DRAWING_DISCIPLINES = [
  "ARK", "LARK", "RIB", "RIV", "RIE", "RIG", "RIBr", "RIAku",
] as const;

export const DRAWING_TYPES = [
  "plan", "snitt", "fasade", "detalj", "oversikt", "skjema", "montering",
] as const;

export const DRAWING_STATUSES = [
  "utkast", "delt", "under_behandling", "godkjent", "for_bygging", "som_bygget",
] as const;

export type DrawingDiscipline = (typeof DRAWING_DISCIPLINES)[number];
export type DrawingType = (typeof DRAWING_TYPES)[number];
export type DrawingStatus = (typeof DRAWING_STATUSES)[number];

export const drawingDisciplineSchema = z.enum(DRAWING_DISCIPLINES);
export const drawingTypeSchema = z.enum(DRAWING_TYPES);
export const drawingStatusSchema = z.enum(DRAWING_STATUSES);

export const createDrawingSchema = z.object({
  projectId: z.string().uuid(),
  buildingId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  drawingNumber: z.string().max(50).optional(),
  discipline: drawingDisciplineSchema.optional(),
  drawingType: drawingTypeSchema.optional(),
  revision: z.string().max(10).default("A"),
  status: drawingStatusSchema.default("utkast"),
  floor: z.string().max(20).optional(),
  scale: z.string().max(20).optional(),
  description: z.string().optional(),
  originator: z.string().max(255).optional(),
  fileUrl: z.string(),
  fileType: z.string(),
  fileSize: z.number().int().optional(),
});

// Gruppekategori-validering
export const groupCategorySchema = z.enum(GROUP_CATEGORIES);

// Prosjektgruppe-validering
export const createProjectGroupSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().max(100).optional(),
  category: groupCategorySchema.default("brukergrupper"),
});

export const updateProjectGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
});

// Mappeadgangskontroll
export const folderAccessModeSchema = z.enum(FOLDER_ACCESS_MODES);
export const folderAccessTypeSchema = z.enum(FOLDER_ACCESS_TYPES);

export const settMappeTilgangSchema = z.object({
  folderId: z.string().uuid(),
  accessMode: folderAccessModeSchema,
  entries: z.array(z.object({
    accessType: folderAccessTypeSchema,
    enterpriseId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
  })).default([]),
});

// Arbeidsforløp steg-medlemmer
export const addWorkflowStepMemberSchema = z.object({
  workflowId: z.string().uuid(),
  projectMemberId: z.string().uuid(),
  step: z.number().int().min(2).max(3),
});

export const removeWorkflowStepMemberSchema = z.object({
  workflowId: z.string().uuid(),
  projectMemberId: z.string().uuid(),
  step: z.number().int().min(2).max(3),
});

// Dokumentflyt-validering (ny modell)
export const createDokumentflytSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255),
  templateIds: z.array(z.string().uuid()).default([]),
  medlemmer: z.array(z.object({
    enterpriseId: z.string().uuid().optional(),
    projectMemberId: z.string().uuid().optional(),
    rolle: z.enum(["oppretter", "svarer"]),
    steg: z.number().int().min(1).default(1),
  })).default([]),
});

export const updateDokumentflytSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  templateIds: z.array(z.string().uuid()).optional(),
});

export const addDokumentflytMedlemSchema = z.object({
  dokumentflytId: z.string().uuid(),
  projectId: z.string().uuid(),
  enterpriseId: z.string().uuid().optional(),
  projectMemberId: z.string().uuid().optional(),
  rolle: z.enum(["oppretter", "svarer"]),
  steg: z.number().int().min(1).default(1),
});

export const removeDokumentflytMedlemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
});

// Legg til gruppemedlem via e-post
export const addGroupMemberByEmailSchema = z.object({
  groupId: z.string().uuid(),
  projectId: z.string().uuid(),
  email: z.string().email("Ugyldig e-postadresse"),
  firstName: z.string().min(1, "Fornavn er påkrevd"),
  lastName: z.string().min(1, "Etternavn er påkrevd"),
  phone: z.string().optional(),
  melding: z.string().max(500).optional(),
});
