/**
 * V19.9 (versjonssjekk pr. rad) — REN klassifisering av syncBatch-radene.
 *
 * `klassifiserSyncRader` er den ENESTE leseren av `serverVersjon`/`endretLokalt`
 * (grep-vakt, § 9.6 test 13). Den er ren (ingen Prisma, ingen i/o) og enhetstestes
 * rad for rad mot matrisen R1–R12 / S1–S4 (spec § 9.3). `syncBatch` kaller den inni
 * `$transaction` etter å ha lest serverradene, og handler på resultatet.
 *
 * Innholdsavgjørelsen («ukjent versjon» → likt=skriv / ulikt=avvik) delegeres til
 * den delte `radInnholdLikt` (@sitedoc/shared) — ÉN definisjon av «samme rad».
 */

import { radInnholdLikt, type RadInnhold } from "@sitedoc/shared";

/** Grunnen et avvik får i forslagstabellens grunn-kolonne (aldri `"overlapp"` her). */
export type AvvikGrunn = "endret_begge" | "slettet_pc" | "slettet_telefon";

/** Serverrad slik klassifiseringen trenger den: id + versjon (updatedAt) + innhold. */
export type ServerRad = RadInnhold & {
  id: string;
  updatedAt: Date | string;
};

/** Payload-rad: id + versjonssporet (V19.9.1/2) + resolved innhold (V19.9.4). */
export type PayloadRad = RadInnhold & {
  id: string;
  /** `SheetTimer.updatedAt` telefonen fikk ved pull/push-`ok`. null/undefined = ukjent. */
  serverVersjon?: string | null;
  /** Har telefonen selv rørt raden siden sist synk? undefined = ukjent (eldre app). */
  endretLokalt?: boolean;
};

/** Tombstone: slettet rad-id + versjonen kopiert fra raden da den ble slettet lokalt. */
export type Tombstone = {
  id: string;
  serverVersjon?: string | null;
};

/** Ett avvik → forslag. `kilde` sier hvor forslagets innhold hentes fra. */
export interface Avvik {
  id: string;
  grunn: AvvikGrunn;
  /** "payload" = telefonens rad (endret_begge/slettet_pc); "server" = kopi av serverraden (slettet_telefon). */
  kilde: "payload" | "server";
}

export interface KlassifiseringResultat {
  /** Payload-rad-id-er som skal skrives til `sheet_timer` (deleteMany id + createMany). */
  skriv: string[];
  /** Payload-rad-id-er som ignoreres (serverraden står). */
  hoppOver: string[];
  /** Rader som går til forslag (med grunn + kilde). */
  avvik: Avvik[];
  /** Server-rad-id-er som skal SLETTES (tombstone enige, S1). */
  slett: string[];
}

function iso(u: Date | string): string {
  return typeof u === "string" ? u : u.toISOString();
}

/**
 * Klassifiser alle payload-rader og tombstones mot serverradene (spec § 9.3).
 * Matrise-referansene (R1–R12 / S1–S4) står ved hver gren.
 */
export function klassifiserSyncRader(
  serverRader: readonly ServerRad[],
  payloadRader: readonly PayloadRad[],
  tombstones: readonly Tombstone[],
): KlassifiseringResultat {
  const serverById = new Map(serverRader.map((s) => [s.id, s]));
  const skriv: string[] = [];
  const hoppOver: string[] = [];
  const avvik: Avvik[] = [];
  const slett: string[] = [];

  for (const p of payloadRader) {
    const s = serverById.get(p.id);
    const v = p.serverVersjon;
    const versjonKjent = v != null;

    if (!s) {
      // Serverraden finnes ikke.
      if (!versjonKjent) {
        // R6 (ny rad) / R11 (eldre app, kan ikke skilles) → opprett.
        skriv.push(p.id);
      } else if (p.endretLokalt === true) {
        // R7: slettet PC, endret telefon → avvik slettet_pc (telefonens rad, INGEN gjenoppstandelse).
        avvik.push({ id: p.id, grunn: "slettet_pc", kilde: "payload" });
      } else {
        // R8: slettet PC, uendret telefon → hopp over (PC-slettingen står).
        hoppOver.push(p.id);
      }
      continue;
    }

    // Serverraden finnes.
    const likt = radInnholdLikt(s, p);
    if (!versjonKjent) {
      // R9/R10 (eldre app / felt mangler / null): avgjøres på INNHOLD.
      if (likt) {
        skriv.push(p.id); // R9 — idempotent.
      } else {
        avvik.push({ id: p.id, grunn: "endret_begge", kilde: "payload" }); // R10 — trygg retning.
      }
      continue;
    }

    if (iso(s.updatedAt) === v) {
      // Versjon matcher → serverraden urørt siden telefonen hentet den.
      // R1 (uendret) / R2 (endret telefon) → skriv (idempotent når likt).
      skriv.push(p.id);
      continue;
    }

    // Versjon ULIK → serverraden endret siden telefonen hentet den (PC skrev).
    if (likt) {
      // R5: begge endret til det samme → hopp over (serverraden er alt riktig).
      hoppOver.push(p.id);
    } else if (p.endretLokalt === true) {
      // R4: endret begge → avvik endret_begge (telefonens rad, serverraden står).
      avvik.push({ id: p.id, grunn: "endret_begge", kilde: "payload" });
    } else {
      // R3: uendret telefon, endret PC → hopp over (PC vinner uten støy).
      hoppOver.push(p.id);
    }
  }

  for (const d of tombstones) {
    const s = serverById.get(d.id);
    if (!s) {
      // S3: slettet begge → no-op (enige).
      continue;
    }
    const dv = d.serverVersjon;
    if (dv != null && iso(s.updatedAt) === dv) {
      // S1: slettet telefon, uendret PC → slett.
      slett.push(d.id);
    } else {
      // S2' (versjon ulik) / S4 (eldre app, ingen versjon) → avvik slettet_telefon
      // (kopi av serverraden), serverraden står. Trygg retning (PC kan ha endret den).
      avvik.push({ id: d.id, grunn: "slettet_telefon", kilde: "server" });
    }
  }

  return { skriv, hoppOver, avvik, slett };
}
