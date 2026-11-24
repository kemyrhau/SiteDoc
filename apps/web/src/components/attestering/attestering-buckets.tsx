// Radtypene og kontekstregelen for attesteringen. w10b (plan § 4.10 DK14): de gamle
// bøttene (ProsjektSectionAttest, EcoBucketAttest og radkomponentene) er fjernet — tabellen
// (AttesteringTabell) tegner radene på firmaets side og i detaljen.

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

// T7-2d: per-rad prosjekt-join fra hentForAttestering / hentTilAttesteringFirma.

/**
 * Kort-id-spec § 11.4: kan raden velges i denne konteksten? Firma-admin (ingen kontekst): alltid.
 * Prosjektlederen (w10b, konteksten = hans prosjekter): radens prosjekt er blant dem, eller fravær uten prosjekt når serveren sier
 * `fravaerKanAttesteres` (F1). Ellers synlig og nedtonet som i dag.
 */
export function radIKontekst(
  projectId: string | null,
  prosjektKontekst: ReadonlySet<string> | undefined,
  fravaerKanAttesteres: boolean | undefined,
): boolean {
  if (!prosjektKontekst) return true;
  if (projectId !== null && prosjektKontekst.has(projectId)) return true;
  return projectId === null && fravaerKanAttesteres === true;
}


export type RadProsjekt = {
  id: string;
  name: string;
  internalProjectNumber: string | null;
} | null;

export type TimerRad = {
  id: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  // Kort-id-spec § 11.4: null = fravær uten prosjekt.
  projectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  // T.12: fritekst per rad («hva jeg gjorde»). Følger med i payloaden
  // (hentTilAttesteringFirma bruker include uten select). Kjernen i dagskortet.
  beskrivelse: string | null;
  timer: unknown;
  // V20-W / TILLEGG 2 — radens matpause (bæreren > 0). Allerede i server-payloaden
  // (scalar på SheetTimer; hentForAttestering/hentTilAttesteringFirma bruker
  // include/findMany uten select). Her synliggjort i typen for MatpauseRadMerke.
  pauseMin?: number | null;
  attestertStatus: string | null;
  project?: RadProsjekt;
  // LAG 2 D1 — reise-sporet (K5). Allerede i server-payloaden (default-select på
  // SheetTimer); her synliggjort i typen så `as unknown as TimerRad[]`-casten i
  // AttesteringDetalj ikke lenger stripper dem. Gamle rader: erReise satt, resten null.
  erReise?: boolean | null;
  reiseRetning?: "ut" | "retur" | null;
  reiseOppmotestedId?: string | null;
  reiseKjoretidMin?: number | null;
  reiseAvstandM?: number | null;
  reiseKilde?: "matrise" | "manuell" | "overforing" | null;
  tidKilde?: "stempel" | "utledet" | "manuell" | null;
  reiseAvvik?: boolean | null;
  // O12 pkt 16 — reise ført som arbeidstid (`erReise: false`). Allerede i server-payloaden
  // (scalar; `include` uten select). Satt = raden er ingen jobbrad (RETUR O12 vilkår 2).
  arbeidReiseRetning?: "ut" | "retur" | null;
  // O17 pkt 21 — regel-snapshotet (JSON-scalar, allerede i payloaden). `reiseRegel.overforing` med
  // kontor i begge ender = reise mellom to kontorer (`kontorReiseRute`).
  reiseRegel?: unknown;
};

export type TilleggRad = {
  id: string;
  tilleggId: string;
  projectId: string;
  antall: unknown;
  kommentar: string | null;
  attestertStatus: string | null;
  project?: RadProsjekt;
  // Tillegg på prosjektkortet (2026-11-13). NULL = arv fra sedelen / uten
  // underprosjekt. Valgfrie så eldre API-respons ikke bryter.
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

export type MaskinRad = {
  id: string;
  vehicleId: string;
  // Del B pkt 1: svak FK → sheet_timer.id. Kobler maskinraden til timerraden
  // den ble ført med — dagskortet nøster maskin under sin timerrad via denne.
  // null = ført før koblingen fantes → «Maskin uten timerad».
  sheetTimerId: string | null;
  projectId: string;
  // T7-4d (2026-05-16): ECO på maskin-rad.
  externalCostObjectId: string | null;
  byggeplassId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
  project?: RadProsjekt;
};

