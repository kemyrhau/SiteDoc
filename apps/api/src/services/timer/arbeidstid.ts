/**
 * T.4 — Effektiv arbeidstid per dato.
 *
 * Brukes som:
 *   - Forhåndsutfylling i mobil TimerRadModal/MaskinRadModal (T4-e)
 *   - Default-utgangspunkt for auto-fordeling normaltid/overtid (senere PR)
 *   - Beregningsgrunnlag for SummeringsBanner i web/mobil
 *
 * Logikk (fase-0-beslutninger.md § T.4):
 *   1) Hent firma-default fra OrganizationSetting (standardStartTid/SluttTid/PauseMin)
 *   2) Hvis `dato` faller innenfor en aktiv sommertid-periode — dvs. det finnes
 *      en aktiv `sommertid_start`-rad ≤ dato OG en aktiv `sommertid_slutt`-rad
 *      ≥ dato i samme år — overstyr feltene fra sommertid_start-raden der de
 *      er satt.
 *   3) Beregn dagsnorm = (sluttTid - startTid) - pauseMin, i timer.
 *
 * Halvdag håndteres ikke her. Halvdag er per-rad-overstyring av lengden på
 * arbeidsdagen via `ArbeidstidsKalender.timerOverstyr` og påvirker dagsnorm
 * direkte ved registrering — ikke via firma-default-stien.
 */

import { prisma } from "@sitedoc/db";

export type EffektivArbeidstid = {
  startTid: string; // HH:MM
  sluttTid: string; // HH:MM
  pauseMin: number;
  dagsnorm: number; // timer (sluttTid - startTid - pauseMin)
};

// Sikkerhetsnett ved manglende OrganizationSetting (skal ikke skje i prod —
// settings opprettes ved firma-onboarding — men vi defaulter for å unngå krasj).
const DEFAULT_START_TID = "07:00";
const DEFAULT_SLUTT_TID = "15:00";
const DEFAULT_PAUSE_MIN = 30;

export async function hentEffektivArbeidstid(
  organizationId: string,
  dato: Date,
): Promise<EffektivArbeidstid> {
  const setting = await prisma.organizationSetting.findUnique({
    where: { organizationId },
    select: {
      standardStartTid: true,
      standardSluttTid: true,
      standardPauseMin: true,
    },
  });

  let startTid = setting?.standardStartTid ?? DEFAULT_START_TID;
  let sluttTid = setting?.standardSluttTid ?? DEFAULT_SLUTT_TID;
  let pauseMin = setting?.standardPauseMin ?? DEFAULT_PAUSE_MIN;

  const aar = dato.getUTCFullYear();

  // Siste aktive sommertid_start ≤ dato i samme år.
  const sommertidStart = await prisma.arbeidstidsKalender.findFirst({
    where: {
      organizationId,
      aar,
      type: "sommertid_start",
      dato: { lte: dato },
      aktiv: true,
    },
    orderBy: { dato: "desc" },
    select: {
      standardStartTid: true,
      standardSluttTid: true,
      pauseMin: true,
    },
  });

  if (sommertidStart) {
    // Vi er innenfor potensiell sommertid — sjekk at perioden ikke alt er
    // avsluttet ved å lete etter en aktiv sommertid_slutt ≥ dato samme år.
    const sommertidSlutt = await prisma.arbeidstidsKalender.findFirst({
      where: {
        organizationId,
        aar,
        type: "sommertid_slutt",
        dato: { gte: dato },
        aktiv: true,
      },
      select: { id: true },
    });

    if (sommertidSlutt) {
      if (sommertidStart.standardStartTid !== null) {
        startTid = sommertidStart.standardStartTid;
      }
      if (sommertidStart.standardSluttTid !== null) {
        sluttTid = sommertidStart.standardSluttTid;
      }
      if (sommertidStart.pauseMin !== null) {
        pauseMin = sommertidStart.pauseMin;
      }
    }
  }

  const dagsnorm = beregnDagsnorm(startTid, sluttTid, pauseMin);
  return { startTid, sluttTid, pauseMin, dagsnorm };
}

function beregnDagsnorm(
  startTid: string,
  sluttTid: string,
  pauseMin: number,
): number {
  const startMinutter = hhmmTilMinutter(startTid);
  const sluttMinutter = hhmmTilMinutter(sluttTid);
  const arbeidsMinutter = sluttMinutter - startMinutter - pauseMin;
  return Math.max(0, arbeidsMinutter / 60);
}

function hhmmTilMinutter(hhmm: string): number {
  const deler = hhmm.split(":");
  const timer = Number(deler[0] ?? 0);
  const minutter = Number(deler[1] ?? 0);
  return timer * 60 + minutter;
}
