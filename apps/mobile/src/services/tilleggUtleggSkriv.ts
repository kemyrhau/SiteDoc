import type { UtleggOrdning } from "@sitedoc/shared";
import { sheetTilleggLocal, sheetUtleggLocal, sheetUtleggVedleggLocal } from "../db/schema";
import type { LokalDb } from "./dagsforslagInput";
import type { NyKoOppforing } from "../providers/OpplastingsKoProvider";

/** Kvitteringsbilde tatt i modalen, lagret lokalt — ikke registrert ennå. */
export type PendingKvittering = {
  lokalSti: string;
  filnavn: string;
  filstorrelse?: number;
  gpsLat?: number;
  gpsLng?: number;
};

/**
 * Ett nytt utlegg slik `UtleggRadModal` bygger det (ORDRE Tillegg/Utlegg i
 * Bekreft dag). Ordning og `foertVed` stemples i modalen ved føring — samme
 * øyeblikk som før — selv om Bekreft dag skriver raden senere.
 */
export type NyttUtlegg = {
  id: string;
  projectId: string;
  expenseCategoryId: string;
  belop: number | null;
  kommentar: string | null;
  ordningVedFoering: UtleggOrdning;
  foertVed: number;
  kvittering: PendingKvittering | null;
  /** Prosjektkortets byggeplass/underprosjekt (2026-11-13). Utelatt/null = arv. */
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

/**
 * Skriver utleggsraden + evt. kvitterings-vedlegg på `sheetId`. Raden skrives
 * FØR vedlegget (server-row-orden). Returnerer køoppføringen som kalleren
 * legger i opplastingskøen (`leggIKo`) — null uten kvittering.
 * Delt av prosjektkortet (modalen skriver straks) og Bekreft dag (skriver ved
 * [Bekreft og lagre]).
 */
export function skrivUtlegg(
  db: LokalDb,
  sheetId: string,
  u: NyttUtlegg,
  nyId: () => string,
): NyKoOppforing | null {
  db.insert(sheetUtleggLocal)
    .values({
      id: u.id,
      dagsseddelId: sheetId,
      projectId: u.projectId,
      expenseCategoryId: u.expenseCategoryId,
      belop: u.belop,
      kommentar: u.kommentar,
      ordningVedFoering: u.ordningVedFoering,
      foertVed: u.foertVed,
      byggeplassId: u.byggeplassId ?? null,
      externalCostObjectId: u.externalCostObjectId ?? null,
      sistEndretLokalt: u.foertVed,
    })
    .run();
  const k = u.kvittering;
  if (!k) return null;
  const vedleggId = nyId();
  db.insert(sheetUtleggVedleggLocal)
    .values({
      id: vedleggId,
      sheetUtleggId: u.id,
      lokalSti: k.lokalSti,
      serverUrl: null,
      filnavn: k.filnavn,
      mimeType: "image/jpeg",
      filstorrelse: k.filstorrelse,
      sistEndretLokalt: u.foertVed,
    })
    .run();
  return {
    sheetUtleggId: u.id,
    objektId: u.id,
    vedleggId,
    lokalSti: k.lokalSti,
    filnavn: k.filnavn,
    mimeType: "image/jpeg",
    filstorrelse: k.filstorrelse,
    gpsLat: k.gpsLat,
    gpsLng: k.gpsLng,
    gpsAktivert: true,
  };
}

/**
 * Ett lønnstillegg fra Bekreft dag (samme felt som `TilleggRadModal.onLagre`).
 * Knyttet til sedel + prosjekt, ikke til en arbeidsrad.
 */
export type NyttLonnstillegg = {
  lokalId: string;
  projectId: string;
  tilleggId: string;
  antall: number;
  kommentar: string | null;
  /** Prosjektkortets byggeplass/underprosjekt (2026-11-13). Utelatt/null = arv. */
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

/** Skriver lønnstillegget på `sheetId` — samme verdier som prosjektkortets `leggTil`. */
export function skrivLonnstillegg(db: LokalDb, sheetId: string, l: NyttLonnstillegg, naa: number): void {
  db.insert(sheetTilleggLocal)
    .values({
      id: l.lokalId,
      dagsseddelId: sheetId,
      projectId: l.projectId,
      tilleggId: l.tilleggId,
      antall: l.antall,
      kommentar: l.kommentar,
      byggeplassId: l.byggeplassId ?? null,
      externalCostObjectId: l.externalCostObjectId ?? null,
      sistEndretLokalt: naa,
    })
    .run();
}
