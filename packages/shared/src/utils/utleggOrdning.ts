/**
 * Utleggs-ordningsmodell — ÉN delt utledning for web, mobil og eksport.
 *
 * Bakgrunn (spec 2026-08-08, modelljustering 2026-08-11): en registrert kostnad
 * kan følge tre ulike ordninger, og feltarbeideren skal ALDRI velge ordning —
 * den utledes av firma-katalogen (default) + eventuell prosjekt-overstyring:
 *
 *   lonnstillegg → antall/avhuking → lønnsart-eksport  (bæres av SheetTillegg)
 *   utlegg       → beløp + påkrevd kvittering → refusjon, aldri lønnsart (SheetUtlegg)
 *   fakturert    → ren avhuking, INGEN beløp → eksporteres ALDRI (SheetUtlegg, belop=null)
 *
 * `lonnstillegg` het tidligere `sats` — omdøpt (2026-08-11) fordi «sats» var et
 * homonym: lønnstillegg med fast sats (skifttillegg 30 %) vs. utlegg beregnet
 * ETTER en sats (statens satser: kjøregodtgjørelse/diett). Det siste er IKKE en
 * egen ordning — det er en `utlegg`-kategori merket `satsbasert`. `fakturert`
 * beholdes i enum + CHECK for historikk-sikkerhet, men er ikke lenger valgbar
 * (app-lag avviser den på skriv; gjeninnføres senere som `fakturavarsel`).
 *
 * Denne fila er sannhetskilden for utledningen og de avledede reglene
 * (beløps-krav, kvitteringskrav, eksport-rute). Web, mobil og eksport-koden
 * SKAL importere herfra — aldri reimplementere. Insert-koden stempler den
 * utledede ordningen på `SheetUtlegg.ordningVedFoering` i samme transaksjon;
 * CHECK-constrainten i db-timer håndhever beløps-regelen mot DET stempelet
 * (aldri mot et kategori-oppslag som kan drifte).
 */

/** Lukket enum. Speiler CHECK-constrainten i db-timer-migreringen. */
export type UtleggOrdning = "lonnstillegg" | "utlegg" | "fakturert";

export const UTLEGG_ORDNINGER: readonly UtleggOrdning[] = [
  "lonnstillegg",
  "utlegg",
  "fakturert",
] as const;

/** Type-guard for server-validering (Zod-enum / rå input fra DB-drift). */
export function erGyldigOrdning(verdi: unknown): verdi is UtleggOrdning {
  return (
    typeof verdi === "string" &&
    (UTLEGG_ORDNINGER as readonly string[]).includes(verdi)
  );
}

export interface UtledOrdningInput {
  /** Kategoriens ordning (firmaets normaltilfelle) — `ExpenseCategory.ordning`. */
  firmaDefault: UtleggOrdning;
  /**
   * Prosjekt-overstyring for denne kategorien, hvis satt av firma-admin —
   * `ProsjektOrdningOverstyring.ordning`. `null`/`undefined` = ingen overstyring.
   */
  prosjektOverstyring?: UtleggOrdning | null;
}

/**
 * Kjerne-utledningen: **overstyring ?? firma-default**. Gir ALLTID nøyaktig én
 * ordning for et gitt prosjekt+kategori — aldri tvetydig. Dette er den ene
 * funksjonen alle lag kaller.
 */
export function utledOrdning({
  firmaDefault,
  prosjektOverstyring,
}: UtledOrdningInput): UtleggOrdning {
  return prosjektOverstyring ?? firmaDefault;
}

/**
 * Hvilken bærer en registrering med denne ordningen havner i.
 * `lonnstillegg` bæres av `SheetTillegg` (lønnsart-løpet, som i dag); `utlegg` og
 * `fakturert` bæres av `SheetUtlegg`.
 */
export function baeresAvSheetUtlegg(ordning: UtleggOrdning): boolean {
  return ordning === "utlegg" || ordning === "fakturert";
}

/**
 * CHECK-speil (app-siden): beløp MÅ finnes for alt annet enn `fakturert`.
 * Insert-koden bruker denne til å validere før den treffer DB-constrainten,
 * så feilen fanges tidlig med en forståelig melding i stedet for en rå
 * constraint-violation.
 */
export function krevesBelop(ordning: UtleggOrdning): boolean {
  return ordning !== "fakturert";
}

/** `utlegg` krever kvittering (refusjonsgrunnlag). */
export function kreverKvittering(ordning: UtleggOrdning): boolean {
  return ordning === "utlegg";
}

/**
 * `utlegg` (påkrevd) og `fakturert` (valgfri dokumentasjon) tillater kvittering;
 * `sats` har ingen kvitteringsplass (avhuking/antall).
 */
export function tillaterKvittering(ordning: UtleggOrdning): boolean {
  return ordning === "utlegg" || ordning === "fakturert";
}

/** Hvor en rad med denne ordningen skal rutes i eksport. */
export type EksportRute = "lonnsart" | "refusjon" | "ingen";

/**
 * Eksport-rute per ordning — grunnlaget for U2-guarden («feil skal smelle»):
 *   lonnstillegg → lønnsart (som i dag)
 *   utlegg       → refusjonspost, ALDRI lønnsart
 *   fakturert    → ingen (skal aldri nå penger)
 */
export function eksportRute(ordning: UtleggOrdning): EksportRute {
  switch (ordning) {
    case "lonnstillegg":
      return "lonnsart";
    case "utlegg":
      return "refusjon";
    case "fakturert":
      return "ingen";
  }
}
