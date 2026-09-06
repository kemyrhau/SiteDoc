/**
 * Endringslogg — delt generering + koalescering for sjekkliste og oppgave.
 *
 * HVORFOR DENNE FILA FINNES (les før du fristes til å kopiere logg-logikk igjen):
 * Logg-genereringen lå tidligere i to HÅNDSPEILEDE kopier — `sjekkliste.ts`
 * (`oppdaterData`) og `oppgave.ts:782-830`, sistnevnte med kommentaren
 * «speil av sjekkliste». Speilingen er selve grunnen til at bug-klassen overlevde
 * runde etter runde: en fiks i den ene traff aldri den andre. Da autolagringen
 * (hvert 2. sekund, `useSjekklisteSkjema.ts`) begynte å skrive én loggrad per
 * skrivepause — ~18 rader for ett avsnitt (Kenneth-funn 2026-09-05) — bar begge
 * kopiene nøyaktig samme feil. Modul-avhengighets-regelen (CLAUDE.md) sier det
 * rett ut: deler flere flater samme logikk, skal logikken være ÉN kilde.
 *
 * Denne fila er nå den ene kilden. Rør du logg-genereringen, rør du den her —
 * ikke i en ny kopi.
 *
 * TO ANSVAR:
 *   1) `byggEndringsloggInnslag` — hva som er en endring (normalisert diff), og
 *      resolving av person/persons-UUID → navn (loggen skal aldri vise rå nøkler
 *      i et byggherre-dokument; samme klasse som `felt.ts:101`-funnet).
 *   2) `skrivEndringslogg` — KOALESCERING: skriver samme bruker samme felt
 *      innenfor et tidsvindu, oppdateres den eksisterende radens «til»-verdi i
 *      stedet for å lage en ny rad. «Fra»-verdien beholdes fra første rad (den
 *      opprinnelige), slik at én rad sier «fra det som sto før økten → til det
 *      som står nå».
 *
 * 🔴 KJENT BEGRENSNING — status-brudd: Kravet var at vinduet også skulle brytes
 * av at dokumentet skifter status. Det er IKKE implementert, fordi `endreStatus`
 * ikke skriver noen loggrad → det finnes ikke noe lagret signal å måle mot uten
 * en ny kolonne (migrering på Checklist + Task, de to mest sentrale tabellene,
 * rett før pilot — bevisst utsatt, ikke smuglet inn i en bugfiks). Eksponering
 * vurdert lav: krever at SAMME bruker endrer SAMME felt både før og etter et
 * statusskifte innenfor vinduet; konsekvensen er én sammenslått rad, aldri tapt
 * data. Bruker-brudd (en annen bruker endrer feltet) er derimot dekket gratis.
 */

import type { Prisma, PrismaClient } from "@sitedoc/db";
import { kanonisk, likForDiff } from "@sitedoc/pdf";

/** Vindu for koalescering: sammenhengende redigering av samme forfatter slås sammen. */
export const KOALESCER_VINDU_MS = 10 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERSON_TYPER = new Set(["person", "persons"]);
const DISPLAY_TYPER = new Set(["heading", "subtitle"]);

/** Uoppløst UUID (slettet bruker) → dette, ALDRI den rå nøkkelen. Speiler persons-resolver. */
const UKJENT_BRUKER = "Ukjent bruker";

export type EndringsloggInnslag = {
  fieldId: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
};

type MalObjekt = { id: string; type: string; label: string };
type FeltData = Record<string, { verdi?: unknown } | undefined>;

/**
 * Bygg changelog-innslag for et dokument-lagre. Sammenligner gammel og ny data
 * felt for felt; en endring er NORMALISERT (lik verdi med ulik nøkkelrekkefølge
 * eller kun ulik signert-URL-query er IKKE en endring — `likForDiff`). Lagrer
 * kanonisk verdi. For person/persons byttes UUID → navn (ett samlet oppslag).
 */
export async function byggEndringsloggInnslag(
  prisma: PrismaClient,
  args: { gammelData: FeltData; nyData: FeltData; objekter: MalObjekt[] },
): Promise<EndringsloggInnslag[]> {
  const { gammelData, nyData, objekter } = args;
  const objektMap = new Map(
    objekter.filter((o) => !DISPLAY_TYPER.has(o.type)).map((o) => [o.id, o]),
  );

  // Samle person-UUID-er fra ENDREDE person/persons-felt (gammel + ny) → ett oppslag.
  const personIder = new Set<string>();
  const samleUuider = (v: unknown): void => {
    if (typeof v === "string" && UUID_RE.test(v)) personIder.add(v);
    else if (Array.isArray(v))
      for (const x of v) if (typeof x === "string" && UUID_RE.test(x)) personIder.add(x);
  };
  for (const [feltId, nyVerdi] of Object.entries(nyData)) {
    const o = objektMap.get(feltId);
    if (!o || !PERSON_TYPER.has(o.type)) continue;
    samleUuider(nyVerdi?.verdi);
    samleUuider(gammelData[feltId]?.verdi);
  }

  const navnMap = new Map<string, string>();
  if (personIder.size > 0) {
    const brukere = await prisma.user.findMany({
      where: { id: { in: [...personIder] } },
      select: { id: true, name: true },
    });
    for (const u of brukere) navnMap.set(u.id, u.name ?? UKJENT_BRUKER);
  }
  const byttNavn = (v: unknown): unknown => {
    if (typeof v === "string" && UUID_RE.test(v)) return navnMap.get(v) ?? UKJENT_BRUKER;
    if (Array.isArray(v))
      return v.map((x) =>
        typeof x === "string" && UUID_RE.test(x) ? navnMap.get(x) ?? UKJENT_BRUKER : x,
      );
    return v;
  };

  const innslag: EndringsloggInnslag[] = [];
  for (const [feltId, nyVerdi] of Object.entries(nyData)) {
    const o = objektMap.get(feltId);
    if (!o) continue;

    const gammelV = gammelData[feltId]?.verdi ?? null;
    const nyV = nyVerdi?.verdi ?? null;
    if (likForDiff(gammelV, nyV)) continue;

    const erPerson = PERSON_TYPER.has(o.type);
    const gammelStr = gammelV != null ? kanonisk(erPerson ? byttNavn(gammelV) : gammelV) : null;
    const nyStr = nyV != null ? kanonisk(erPerson ? byttNavn(nyV) : nyV) : null;

    innslag.push({ fieldId: feltId, fieldLabel: o.label, oldValue: gammelStr, newValue: nyStr });
  }
  return innslag;
}

/** Kandidat-rad for koalescering — nyeste loggrad for feltet (uansett bruker). */
export type Loggkandidat = { id: string; userId: string; createdAt: Date; oldValue: string | null } | null;

export type Koalesceringsaksjon =
  | { type: "opprett" }
  | { type: "oppdater"; id: string }
  | { type: "slett"; id: string };

/**
 * Ren beslutning (testbar uten DB): koalescér eller ny rad.
 * - Koalescér kun hvis nyeste rad for feltet er SAMME bruker og innenfor vinduet.
 *   (Er nyeste rad en annen bruker → bruker-brudd → ny rad. Gratis.)
 * - Ender koalesceringen på radens opprinnelige «fra» → netto-null (skrev og
 *   angret) → slett raden.
 */
export function avgjørKoalescering(
  nyeste: Loggkandidat,
  innslag: EndringsloggInnslag,
  userId: string,
  naa: Date,
): Koalesceringsaksjon {
  const vinduStart = naa.getTime() - KOALESCER_VINDU_MS;
  const kanKoalescere = !!nyeste && nyeste.userId === userId && nyeste.createdAt.getTime() > vinduStart;
  if (!kanKoalescere) return { type: "opprett" };
  if (innslag.newValue === nyeste!.oldValue) return { type: "slett", id: nyeste!.id };
  return { type: "oppdater", id: nyeste!.id };
}

const KANDIDAT_SELECT = { id: true, userId: true, createdAt: true, oldValue: true } as const;

export type Endringsloggmål = { checklistId: string } | { taskId: string };

/**
 * Skriv innslag til riktig changelog-tabell med koalescering. Kun de typede
 * Prisma-kallene er delt per tabell (checklist/task) — selve beslutningen
 * (`avgjørKoalescering`) og løkka er ÉN kilde.
 */
export async function skrivEndringslogg(
  tx: Prisma.TransactionClient,
  mål: Endringsloggmål,
  userId: string,
  innslag: EndringsloggInnslag[],
): Promise<void> {
  if (innslag.length === 0) return;
  const naa = new Date();

  const kjør = async (
    finnNyeste: (fieldId: string) => Promise<Loggkandidat>,
    slett: (id: string) => Promise<unknown>,
    oppdater: (id: string, rad: EndringsloggInnslag) => Promise<unknown>,
    opprett: (rad: EndringsloggInnslag) => Promise<unknown>,
  ): Promise<void> => {
    for (const rad of innslag) {
      const aksjon = avgjørKoalescering(await finnNyeste(rad.fieldId), rad, userId, naa);
      if (aksjon.type === "slett") await slett(aksjon.id);
      else if (aksjon.type === "oppdater") await oppdater(aksjon.id, rad);
      else await opprett(rad);
    }
  };

  if ("checklistId" in mål) {
    const checklistId = mål.checklistId;
    await kjør(
      (fieldId) =>
        tx.checklistChangeLog.findFirst({
          where: { checklistId, fieldId },
          orderBy: { createdAt: "desc" },
          select: KANDIDAT_SELECT,
        }),
      (id) => tx.checklistChangeLog.delete({ where: { id } }),
      (id, rad) => tx.checklistChangeLog.update({ where: { id }, data: { newValue: rad.newValue, createdAt: naa } }),
      (rad) =>
        tx.checklistChangeLog.create({
          data: { checklistId, userId, fieldId: rad.fieldId, fieldLabel: rad.fieldLabel, oldValue: rad.oldValue, newValue: rad.newValue },
        }),
    );
  } else {
    const taskId = mål.taskId;
    await kjør(
      (fieldId) =>
        tx.taskChangeLog.findFirst({
          where: { taskId, fieldId },
          orderBy: { createdAt: "desc" },
          select: KANDIDAT_SELECT,
        }),
      (id) => tx.taskChangeLog.delete({ where: { id } }),
      (id, rad) => tx.taskChangeLog.update({ where: { id }, data: { newValue: rad.newValue, createdAt: naa } }),
      (rad) =>
        tx.taskChangeLog.create({
          data: { taskId, userId, fieldId: rad.fieldId, fieldLabel: rad.fieldLabel, oldValue: rad.oldValue, newValue: rad.newValue },
        }),
    );
  }
}
