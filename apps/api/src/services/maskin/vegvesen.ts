/**
 * Service-lag for Vegvesen-integrasjon.
 *
 * - forhandsvisningSynkron: direkte API-kall (prio 0 = nyregistrering),
 *   skriver audit-rad i VegvesenKo.
 * - koerOppdatering: setter rad i VegvesenKo, worker plukker innen ~60s
 *   (prio 50 manuell admin, prio 100 auto Fase 2).
 */
import type { PrismaClient as MaskinPrismaClient } from "@sitedoc/db-maskin";
import { normaliserRegnummer } from "@sitedoc/shared";
import {
  hentKjoretoyData,
  parseForhandsvisning,
  type ForhandsvisningFelter,
} from "./vegvesen-api";

export type ForhandsvisningResultat = {
  felter: ForhandsvisningFelter;
  vegvesenData: unknown; // rå JSON for senere persistering
  vegvesenKoId: string; // audit-rad
};

export async function forhandsvisningSynkron(
  prismaMaskin: MaskinPrismaClient,
  regnummerInput: string,
  equipmentIdForAudit?: string | null,
): Promise<ForhandsvisningResultat> {
  const regnummer = normaliserRegnummer(regnummerInput);

  let raw: unknown;
  let feilmelding: string | null = null;

  try {
    raw = await hentKjoretoyData(regnummer);
  } catch (err) {
    feilmelding = err instanceof Error ? err.message : "Ukjent feil";
    // Lagre audit-rad selv ved feil for diagnostikk
    if (equipmentIdForAudit) {
      await prismaMaskin.vegvesenKo.create({
        data: {
          equipmentId: equipmentIdForAudit,
          registreringsnummer: regnummer,
          prioritet: 0,
          status: "feilet",
          forsokAntall: 1,
          sistForsok: new Date(),
          feilmelding,
          fullfort: new Date(),
        },
      });
    }
    throw err;
  }

  const felter = parseForhandsvisning(raw, regnummer);

  // Audit-rad: kun hvis vi har equipmentId — for nyregistrering finnes
  // det ennå ikke en Equipment-rad, og VegvesenKo.equipmentId er NOT NULL.
  // Audit ved opprett skjer i opprettMedVegvesen-flyten.
  let vegvesenKoId = "";
  if (equipmentIdForAudit) {
    const audit = await prismaMaskin.vegvesenKo.create({
      data: {
        equipmentId: equipmentIdForAudit,
        registreringsnummer: regnummer,
        prioritet: 0,
        status: "fullfort",
        forsokAntall: 1,
        sistForsok: new Date(),
        fullfort: new Date(),
      },
    });
    vegvesenKoId = audit.id;
  }

  return { felter, vegvesenData: raw, vegvesenKoId };
}

/**
 * Sett rad i VegvesenKo for asynkron oppdatering. Worker plukker.
 * Idempotent: hvis det allerede finnes en ventende rad for samme
 * equipmentId, oppdateres prioriteten ikke.
 */
export async function koerOppdatering(
  prismaMaskin: MaskinPrismaClient,
  equipmentId: string,
  registreringsnummer: string,
  prioritet: number,
): Promise<{ id: string; ventendeForan: number }> {
  const regnr = normaliserRegnummer(registreringsnummer);

  // Sjekk om det allerede finnes en ventende eller pågående rad
  const eksisterende = await prismaMaskin.vegvesenKo.findFirst({
    where: {
      equipmentId,
      status: { in: ["ventende", "prosesserer"] },
    },
    orderBy: { opprettet: "desc" },
  });

  let id: string;
  if (eksisterende) {
    id = eksisterende.id;
  } else {
    const ny = await prismaMaskin.vegvesenKo.create({
      data: {
        equipmentId,
        registreringsnummer: regnr,
        prioritet,
        status: "ventende",
      },
    });
    id = ny.id;
  }

  const ventendeForan = await prismaMaskin.vegvesenKo.count({
    where: {
      status: "ventende",
      OR: [
        { prioritet: { lt: prioritet } },
        { prioritet, opprettet: { lt: new Date() } },
      ],
    },
  });

  return { id, ventendeForan };
}
