import { z } from "zod";
import { DOCUMENT_STATUSES, REPORT_OBJECT_TYPES } from "../types";

// Dokumentstatus-validering
export const documentStatusSchema = z.enum(DOCUMENT_STATUSES);

// Rapportobjekttype-validering
export const reportObjectTypeSchema = z.enum(REPORT_OBJECT_TYPES);

// Entrepriserolle-validering
export const enterpriseRoleSchema = z.enum(["creator", "responder"]);

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
