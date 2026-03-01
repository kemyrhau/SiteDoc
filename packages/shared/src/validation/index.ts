import { z } from "zod";
import { DOCUMENT_STATUSES, REPORT_OBJECT_TYPES, TEMPLATE_ZONES } from "../types";

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
});

// Entreprisevalidering
export const createEnterpriseSchema = z.object({
  name: z.string().min(1).max(255),
  projectId: z.string().uuid(),
  organizationNumber: z.string().optional(),
});

// Bygningsvalidering
export const createBuildingSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd").max(255),
  projectId: z.string().uuid(),
  description: z.string().optional(),
  address: z.string().optional(),
});

// Malkategori-validering
export const templateCategorySchema = z.enum(["oppgave", "sjekkliste"]);

// Arbeidsforløpvalidering
export const createWorkflowSchema = z.object({
  enterpriseId: z.string().uuid(),
  name: z.string().min(1).max(255),
  templateIds: z.array(z.string().uuid()).default([]),
});

export const updateWorkflowSchema = z.object({
  id: z.string().uuid(),
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
  enterpriseId: z.string().uuid().optional(),
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
