import { and, eq, inArray } from "drizzle-orm";
import { arbeidsdagLocal, prosjektkortUtkastLocal } from "../db/schema";
import type { LokalDb } from "../services/dagsforslagInput";
import type { DagsforslagRetting } from "./dagsforslag";
import type { TilleggPerRad } from "./bekreftDagTillegg";
import type { NyttLonnstillegg, NyttUtlegg } from "../services/tilleggUtleggSkriv";

/**
 * Utkast for prosjektkort (Redesign, 2026-11-13) — ikke bekreftet prosjektkort
 * lagret på telefonen mens arbeideren fører. KUN lokal: tabellen synkes aldri
 * (vakt i `prosjektkortUtkast.test.ts`).
 *
 * Utkastet lagrer brukerens RETTINGER (delta), ikke hele skjermtilstanden.
 * Forslaget beregnes på nytt ved gjenåpning og rettingene legges oppå, så et
 * gammelt utkast overstyrer aldri et nytt forslag der brukeren ikke har rettet.
 *
 * Nøkkel: `dato:YYYY-MM-DD` (manuelt kort) eller `dag:<arbeidsdagId>` (GPS).
 * Unik pr. (bruker, firma, nøkkel) — all lesing krever begge (isolasjon).
 * `data` er opak JSON med `skjema_versjon`; andre lesere (lista, senere
 * dagskortet) bruker kun `utkastDatoer`/`listUtkast`, aldri formatet.
 */

export const UTKAST_SKJEMA_VERSJON = 1;

export type UtkastData = {
  retting: DagsforslagRetting;
  tilleggPerRad: TilleggPerRad;
  lonnUtlegg: { tillegg: NyttLonnstillegg[]; utlegg: NyttUtlegg[] };
  /** Kun når brukeren valgte byggeplass selv. undefined = forslagets default. */
  valgtByggeplassId?: string | null;
  rettetSluttIso?: string | null;
  sluttGodkjent?: boolean;
  /** Valgt underprosjekt. */
  ecoId?: string | null;
};

export type UtkastEier = { userId: string; orgId: string };

export type LagretUtkast = {
  nokkel: string;
  dato: string;
  arbeidsdagId: string | null;
  data: UtkastData;
  kvitteringer: string[];
  opprettet: string;
  sistEndret: string;
};

export type UtkastOversikt = { nokkel: string; dato: string; arbeidsdagId: string | null };

export function manuellUtkastNokkel(dato: string): string {
  return `dato:${dato}`;
}

export function gpsUtkastNokkel(arbeidsdagId: string): string {
  return `dag:${arbeidsdagId}`;
}

function eierFilter(eier: UtkastEier) {
  return and(
    eq(prosjektkortUtkastLocal.userId, eier.userId),
    eq(prosjektkortUtkastLocal.organizationId, eier.orgId),
  );
}

function harTekst(r: Record<string, string> | undefined): boolean {
  return !!r && Object.values(r).some((v) => v.trim() !== "");
}

/**
 * Tom delta = ingen rad. Sann når brukeren ikke har rettet noe som gjelder
 * (eller har angret alt): ingen valg, tider, beskrivelser, maskin/varer,
 * tillegg/utlegg eller sluttretting.
 */
export function erTomtUtkast(data: UtkastData): boolean {
  const r = data.retting ?? {};
  if (r.prosjektId !== undefined || r.aktivitetId !== undefined || r.byggeplassId !== undefined) return false;
  if (harTekst(r.beskrivelse) || harTekst(r.beskrivelsePerRad)) return false;
  if ((r.manuellReise?.length ?? 0) > 0) return false;
  for (const d of Object.values(r.perDato ?? {})) {
    if (Object.values(d).some((v) => v !== undefined)) return false;
  }
  for (const t of Object.values(data.tilleggPerRad ?? {})) {
    if (t.maskiner.length > 0 || t.varer.length > 0) return false;
  }
  if ((data.lonnUtlegg?.tillegg.length ?? 0) > 0 || (data.lonnUtlegg?.utlegg.length ?? 0) > 0) return false;
  if (data.valgtByggeplassId !== undefined) return false;
  if (data.rettetSluttIso != null || data.sluttGodkjent) return false;
  if (data.ecoId != null) return false;
  return true;
}

/**
 * RETUR avvik 10: kvitteringer fjernet i skjermen venter til en utkastversjon
 * UTEN dem er skrevet. Returnerer de ventende stiene som nå kan slettes (ikke
 * lenger i det skrevne utkastet). Kalles kun etter «lagret»/«slettet».
 */
export function slettbareEtterSkriving(venter: Iterable<string>, skrevet: UtkastData): string[] {
  const eide = new Set(kvitteringerI(skrevet));
  return Array.from(venter).filter((s) => !eide.has(s));
}

/** Kvitteringsstiene utkastet eier (lagres i egen kolonne så opprydding ikke parser `data`). */
export function kvitteringerI(data: UtkastData): string[] {
  const ut: string[] = [];
  for (const u of data.lonnUtlegg?.utlegg ?? []) {
    if (u.kvittering?.lokalSti) ut.push(u.kvittering.lokalSti);
  }
  return ut;
}

function parseListe(json: string): string[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function finnUtkast(db: LokalDb, args: UtkastEier & { nokkel: string }): LagretUtkast | null {
  const rad = db
    .select()
    .from(prosjektkortUtkastLocal)
    .where(and(eierFilter(args), eq(prosjektkortUtkastLocal.nokkel, args.nokkel)))
    .all()[0];
  if (!rad) return null;
  let data: UtkastData;
  try {
    data = JSON.parse(rad.data) as UtkastData;
  } catch {
    return null;
  }
  return {
    nokkel: rad.nokkel,
    dato: rad.dato,
    arbeidsdagId: rad.arbeidsdagId,
    data,
    kvitteringer: parseListe(rad.kvitteringer),
    opprettet: rad.opprettet,
    sistEndret: rad.sistEndret,
  };
}

/** Alle utkast for bruker + firma (lista trenger nøkkelen for å åpne riktig sti). */
export function listUtkast(db: LokalDb, eier: UtkastEier): UtkastOversikt[] {
  return db
    .select({
      nokkel: prosjektkortUtkastLocal.nokkel,
      dato: prosjektkortUtkastLocal.dato,
      arbeidsdagId: prosjektkortUtkastLocal.arbeidsdagId,
    })
    .from(prosjektkortUtkastLocal)
    .where(eierFilter(eier))
    .all();
}

/** Datoer med et ikke bekreftet prosjektkort. `fra`/`til` (inkl.) er valgfrie. */
export function utkastDatoer(
  db: LokalDb,
  args: UtkastEier & { fra?: string; til?: string },
): Set<string> {
  const ut = new Set<string>();
  for (const u of listUtkast(db, args)) {
    if (args.fra && u.dato < args.fra) continue;
    if (args.til && u.dato > args.til) continue;
    ut.add(u.dato);
  }
  return ut;
}

export type LagreUtkastResultat = "lagret" | "slettet" | "opptatt";

/**
 * Skriver utkastet (upsert på (bruker, firma, nøkkel)). Tomt utkast sletter
 * raden i stedet. `fraNokkel` ≠ `nokkel` = datobytte: gammel rad slettes og ny
 * skrives i én transaksjon — men et eksisterende utkast på måldatoen
 * overskrives aldri («opptatt», ingenting skrevet).
 */
export function lagreUtkast(
  db: LokalDb,
  args: UtkastEier & {
    nokkel: string;
    dato: string;
    arbeidsdagId: string | null;
    data: UtkastData;
    naa: string;
    nyId: () => string;
    fraNokkel?: string;
  },
): LagreUtkastResultat {
  const flytt = args.fraNokkel !== undefined && args.fraNokkel !== args.nokkel;
  if (flytt && finnRad(db, args, args.nokkel)) return "opptatt";

  if (erTomtUtkast(args.data)) {
    db.delete(prosjektkortUtkastLocal)
      .where(
        and(
          eierFilter(args),
          inArray(prosjektkortUtkastLocal.nokkel, flytt ? [args.nokkel, args.fraNokkel!] : [args.nokkel]),
        ),
      )
      .run();
    return "slettet";
  }

  const json = JSON.stringify(args.data);
  const kvitteringer = JSON.stringify(kvitteringerI(args.data));
  db.transaction((tx) => {
    if (flytt) {
      tx.delete(prosjektkortUtkastLocal)
        .where(and(eierFilter(args), eq(prosjektkortUtkastLocal.nokkel, args.fraNokkel!)))
        .run();
    }
    tx.insert(prosjektkortUtkastLocal)
      .values({
        id: args.nyId(),
        userId: args.userId,
        organizationId: args.orgId,
        nokkel: args.nokkel,
        dato: args.dato,
        arbeidsdagId: args.arbeidsdagId,
        skjemaVersjon: UTKAST_SKJEMA_VERSJON,
        data: json,
        kvitteringer,
        opprettet: args.naa,
        sistEndret: args.naa,
      })
      .onConflictDoUpdate({
        target: [
          prosjektkortUtkastLocal.userId,
          prosjektkortUtkastLocal.organizationId,
          prosjektkortUtkastLocal.nokkel,
        ],
        set: {
          dato: args.dato,
          arbeidsdagId: args.arbeidsdagId,
          skjemaVersjon: UTKAST_SKJEMA_VERSJON,
          data: json,
          kvitteringer,
          sistEndret: args.naa,
        },
      })
      .run();
  });
  return "lagret";
}

function finnRad(db: LokalDb, eier: UtkastEier, nokkel: string): boolean {
  return (
    db
      .select({ id: prosjektkortUtkastLocal.id })
      .from(prosjektkortUtkastLocal)
      .where(and(eierFilter(eier), eq(prosjektkortUtkastLocal.nokkel, nokkel)))
      .all().length > 0
  );
}

/**
 * Sletter raden UTEN å røre filene — brukes når en sedel er skrevet (køen eier
 * da kvitteringene) og fra `avsluttDagUtenSedel` (kalleren rydder filene).
 * Returnerer kvitteringsstiene raden eide.
 */
export function slettUtkastRad(db: LokalDb, args: UtkastEier & { nokkel: string }): string[] {
  const eksisterende = finnUtkast(db, args);
  db.delete(prosjektkortUtkastLocal)
    .where(and(eierFilter(args), eq(prosjektkortUtkastLocal.nokkel, args.nokkel)))
    .run();
  return eksisterende?.kvitteringer ?? [];
}

/** Forkast: rad + kvitteringsbilder slettes. Kan ikke angres. */
export async function forkastUtkast(db: LokalDb, args: UtkastEier & { nokkel: string }): Promise<void> {
  const stier = slettUtkastRad(db, args);
  // Dynamisk: modulen holdes fri for expo-filsystemet, så rene tester (bekreftDag)
  // kan importere den.
  const { slettLokaltBilde } = await import("../services/lokalBilde");
  for (const sti of stier) await slettLokaltBilde(sti);
}

/**
 * GPS-utkast er bare gyldig mens arbeidsdagen er `paagaar`. For dager som er
 * avsluttet/forkastet (eller borte):
 * - uten tillegg/utlegg/maskin/varer → raden slettes (stiene returneres for filsletting);
 * - med → raden flyttes til `dato:<dato>` (manuelt kort på datoen), uten
 *   GPS-tider (perDato, sluttretting). Finnes allerede et manuelt utkast på
 *   datoen, blir GPS-raden stående (lista viser den fortsatt).
 */
export function ryddAvsluttedeGpsUtkast(
  db: LokalDb,
  args: UtkastEier & { naa: string; nyId: () => string },
): string[] {
  const filer: string[] = [];
  const gps = listUtkast(db, args).filter((u) => u.arbeidsdagId);
  if (gps.length === 0) return filer;
  const aktive = new Set(
    db
      .select({ id: arbeidsdagLocal.id })
      .from(arbeidsdagLocal)
      .where(
        and(
          eq(arbeidsdagLocal.userId, args.userId),
          eq(arbeidsdagLocal.status, "paagaar"),
          inArray(
            arbeidsdagLocal.id,
            gps.map((u) => u.arbeidsdagId!),
          ),
        ),
      )
      .all()
      .map((r) => r.id),
  );
  for (const u of gps) {
    if (aktive.has(u.arbeidsdagId!)) continue;
    const utkast = finnUtkast(db, { ...args, nokkel: u.nokkel });
    if (!utkast) continue;
    const d = utkast.data;
    const harLinjer =
      (d.lonnUtlegg?.tillegg.length ?? 0) > 0 ||
      (d.lonnUtlegg?.utlegg.length ?? 0) > 0 ||
      Object.values(d.tilleggPerRad ?? {}).some((t) => t.maskiner.length > 0 || t.varer.length > 0);
    if (!harLinjer) {
      filer.push(...slettUtkastRad(db, { ...args, nokkel: u.nokkel }));
      continue;
    }
    const { perDato: _perDato, ...rettingUtenTider } = d.retting ?? {};
    const konvertert: UtkastData = {
      ...d,
      retting: rettingUtenTider,
      rettetSluttIso: undefined,
      sluttGodkjent: undefined,
    };
    lagreUtkast(db, {
      ...args,
      nokkel: manuellUtkastNokkel(utkast.dato),
      dato: utkast.dato,
      arbeidsdagId: null,
      data: konvertert,
      fraNokkel: u.nokkel,
    });
  }
  return filer;
}
