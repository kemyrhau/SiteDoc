import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { arbeidsdagBesokLocal, arbeidsdagLocal } from "../db/schema";
import type { LokalDb } from "./dagsforslagInput";

/* ============================================================================
 *  L4-A — byggeplass-besøk gjennom dagen (spec `timer-gps-lag3-4-spec.md` § 2)
 *
 *  Dagen er en ordnet liste av BEKREFTEDE stopp: Start dag (besøk 1), [Ankommet]
 *  i S1-banneret, et valg i S2 «Bytt byggeplass», eller Slutt dag på en annen
 *  byggeplass. Ingen sporing, ingen posisjon lagres. KUN lokal, synkes aldri.
 *  🔴 PSI-innsjekk er aldri kilde for besøk (§ 2.5) — PSI-koden importerer ikke
 *  denne fila (vakt-test).
 * ============================================================================ */

export type BesokKilde = "start_dag" | "gps_forslag" | "manuell" | "slutt_dag";

export type Besok = typeof arbeidsdagBesokLocal.$inferSelect;

/** Byggeplassen et besøk gjelder. `id: null` = utenfor kjent byggeplass. */
export type BesokSted = {
  id: string | null;
  navn: string | null;
  projectId: string | null;
};

/** S1: maks én måling pr. 10 min mens dagen pågår (§ 2.3). */
export const S1_MAALEINTERVALL_MS = 10 * 60_000;
/** S1: [Nei] demper samme byggeplass i 30 min (§ 2.3). */
export const S1_DEMPING_MS = 30 * 60_000;
/** Rydding: avsluttet/forkastet dag eldre enn glemt-dag-vinduet (§ 2.2). */
export const RYDD_ETTER_MS = 14 * 24 * 3_600_000;

/** Dagens besøk i rekkefølge. */
export function hentBesok(db: LokalDb, arbeidsdagId: string): Besok[] {
  return db
    .select()
    .from(arbeidsdagBesokLocal)
    .where(eq(arbeidsdagBesokLocal.arbeidsdagId, arbeidsdagId))
    .orderBy(asc(arbeidsdagBesokLocal.rekkefolge))
    .all();
}

/** Siste besøk (høyest rekkefølge), eller null. */
export function sisteBesok(db: LokalDb, arbeidsdagId: string): Besok | null {
  return (
    db
      .select()
      .from(arbeidsdagBesokLocal)
      .where(eq(arbeidsdagBesokLocal.arbeidsdagId, arbeidsdagId))
      .orderBy(desc(arbeidsdagBesokLocal.rekkefolge))
      .limit(1)
      .all()[0] ?? null
  );
}

/**
 * Skriv et nytt bekreftet besøk. Forrige besøk (uten avreise) får avreise =
 * ankomsten her (§ 3.4: avreise er null til neste besøk/Slutt dag).
 */
export function registrerBesok(
  db: LokalDb,
  p: {
    id: string;
    arbeidsdagId: string;
    sted: BesokSted;
    ankomstAt: string;
    kilde: BesokKilde;
    naaIso: string;
  },
): void {
  const forrige = sisteBesok(db, p.arbeidsdagId);
  if (forrige && forrige.avreiseAt == null) {
    db.update(arbeidsdagBesokLocal)
      .set({ avreiseAt: p.ankomstAt, sistEndretLokalt: p.naaIso })
      .where(eq(arbeidsdagBesokLocal.id, forrige.id))
      .run();
  }
  db.insert(arbeidsdagBesokLocal)
    .values({
      id: p.id,
      arbeidsdagId: p.arbeidsdagId,
      rekkefolge: (forrige?.rekkefolge ?? 0) + 1,
      byggeplassId: p.sted.id,
      byggeplassNavn: p.sted.navn,
      prosjektId: p.sted.projectId,
      ankomstAt: p.ankomstAt,
      avreiseAt: null,
      kilde: p.kilde,
      bekreftet: 1,
      sistEndretLokalt: p.naaIso,
    })
    .run();
}

/**
 * Slutt dag (§ 2.2): siste besøk får avreise = slutt. Treffer slutt-GPS en
 * ANNEN byggeplass enn siste besøk, skrives ett `slutt_dag`-besøk med
 * ankomst = avreise = slutt. Ingen treff → kun avreise.
 */
export function avsluttBesok(
  db: LokalDb,
  p: {
    nyId: () => string;
    arbeidsdagId: string;
    sluttIso: string;
    sluttSted: BesokSted | null;
    naaIso: string;
  },
): void {
  const siste = sisteBesok(db, p.arbeidsdagId);
  if (siste && siste.avreiseAt == null) {
    db.update(arbeidsdagBesokLocal)
      .set({ avreiseAt: p.sluttIso, sistEndretLokalt: p.naaIso })
      .where(eq(arbeidsdagBesokLocal.id, siste.id))
      .run();
  }
  const sted = p.sluttSted;
  if (!sted?.id || sted.id === siste?.byggeplassId) return;
  db.insert(arbeidsdagBesokLocal)
    .values({
      id: p.nyId(),
      arbeidsdagId: p.arbeidsdagId,
      rekkefolge: (siste?.rekkefolge ?? 0) + 1,
      byggeplassId: sted.id,
      byggeplassNavn: sted.navn,
      prosjektId: sted.projectId,
      ankomstAt: p.sluttIso,
      avreiseAt: p.sluttIso,
      kilde: "slutt_dag",
      bekreftet: 1,
      sistEndretLokalt: p.naaIso,
    })
    .run();
}

/**
 * Rydding (§ 2.2): arbeidsdager som er `avsluttet`/`forkastet` OG startet for
 * mer enn 14 dager siden slettes sammen med besøkene sine. Pågående dager og
 * nyere dager står. Returnerer antall slettede arbeidsdager.
 */
export function ryddGamleArbeidsdager(db: LokalDb, naaMs: number): number {
  const grense = new Date(naaMs - RYDD_ETTER_MS).toISOString();
  const gamle = db
    .select({ id: arbeidsdagLocal.id })
    .from(arbeidsdagLocal)
    .where(
      and(
        inArray(arbeidsdagLocal.status, ["avsluttet", "forkastet"]),
        lt(arbeidsdagLocal.startAt, grense),
      ),
    )
    .all()
    .map((r) => r.id);
  if (gamle.length === 0) return 0;
  db.delete(arbeidsdagBesokLocal)
    .where(inArray(arbeidsdagBesokLocal.arbeidsdagId, gamle))
    .run();
  db.delete(arbeidsdagLocal).where(inArray(arbeidsdagLocal.id, gamle)).run();
  return gamle.length;
}

/**
 * S1-vakt: holder siste måletidspunkt og dempede byggeplasser. Ren tilstand —
 * hooken eier én instans pr. app-prosess (ikke pr. komponent-mount).
 */
export type S1Vakt = {
  /** true = mål nå (og registrer målingen). false = < 10 min siden sist. */
  skalMaale: (naaMs: number) => boolean;
  /** [Nei]: demp byggeplassen i 30 min. */
  demp: (byggeplassId: string, naaMs: number) => void;
  erDempet: (byggeplassId: string, naaMs: number) => boolean;
};

export function lagS1Vakt(): S1Vakt {
  let sistMaalt: number | null = null;
  const dempetTil = new Map<string, number>();
  return {
    skalMaale(naaMs) {
      if (sistMaalt != null && naaMs - sistMaalt < S1_MAALEINTERVALL_MS) return false;
      sistMaalt = naaMs;
      return true;
    },
    demp(byggeplassId, naaMs) {
      dempetTil.set(byggeplassId, naaMs + S1_DEMPING_MS);
    },
    erDempet(byggeplassId, naaMs) {
      const til = dempetTil.get(byggeplassId);
      return til != null && naaMs < til;
    },
  };
}

/**
 * K14: ÉN vakt pr. app-prosess (modulnivå). Kortet bruker denne — aldri en
 * vakt pr. montering, ellers nullstilles 10-min-grensen og [Nei]-dempingen
 * hver gang Timer-fanen monteres på nytt (vakt-test).
 */
export const s1Prosessvakt: S1Vakt = lagS1Vakt();

/** Det S1 trenger av expo-location — injiseres så stien kan testes. */
export type S1Posisjon = {
  getForegroundPermissionsAsync(): Promise<{ status: string }>;
  getCurrentPositionAsync(o: {
    accuracy: number;
  }): Promise<{ coords: { latitude: number; longitude: number } }>;
  Accuracy: { Balanced: number };
};

/**
 * S1: stille posisjonsmåling. Spør ALDRI om tillatelse (den ble gitt ved
 * Start dag) — kun `getForegroundPermissionsAsync`. Mangler tillatelsen, eller
 * GPS feiler → null (banneret uteblir).
 */
export async function maalStille(
  loc: S1Posisjon,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const perm = await loc.getForegroundPermissionsAsync();
    if (perm.status !== "granted") return null;
    const pos = await loc.getCurrentPositionAsync({ accuracy: loc.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * S1-måling (§ 2.1/2.3), felles for montering og AppState→active: vakten
 * (10 min) slipper gjennom → mål stille → gjenkjenn byggeplass → forslag.
 * Uten firma måles ikke (og vakten forbrukes ikke). `undefined` = ikke målt
 * (banneret røres ikke); `null` = målt uten forslag (banneret skjules).
 */
export async function kjorS1(p: {
  vakt: S1Vakt;
  orgId: string;
  naaMs: () => number;
  maal: () => Promise<{ lat: number; lng: number } | null>;
  identifiser: (lat: number, lng: number, orgId: string) => BesokSted | null;
  siste: () => Pick<Besok, "byggeplassId"> | null;
}): Promise<BesokSted | null | undefined> {
  if (!p.orgId || !p.vakt.skalMaale(p.naaMs())) return undefined;
  const pos = await p.maal();
  if (!pos) return undefined;
  const treff = p.identifiser(pos.lat, pos.lng, p.orgId);
  return s1Forslag(treff, p.siste(), p.vakt, p.naaMs());
}

/**
 * S2 (§ 2.4): valget i «Ankommet hvor?». Samme byggeplass som siste besøk →
 * ingen ny rad (false). Ellers et `manuell`-besøk (true).
 */
export function velgS2Besok(
  db: LokalDb,
  p: { id: string; arbeidsdagId: string; sted: BesokSted; naaIso: string },
): boolean {
  const siste = sisteBesok(db, p.arbeidsdagId);
  if (siste && p.sted.id === siste.byggeplassId) return false;
  registrerBesok(db, {
    id: p.id,
    arbeidsdagId: p.arbeidsdagId,
    sted: p.sted,
    ankomstAt: p.naaIso,
    kilde: "manuell",
    naaIso: p.naaIso,
  });
  return true;
}

/**
 * Start dag (§ 2.2): arbeidsdag-raden og besøk 1 (`start_dag`) skrives
 * sammen. Besøket = dagens startsted (`id: null` = utenfor kjent byggeplass).
 */
export function opprettArbeidsdagMedBesok(
  db: LokalDb,
  p: {
    id: string;
    besokId: string;
    userId: string;
    dato: string;
    naaIso: string;
    naaMs: number;
    lat: number | null;
    lng: number | null;
    oppmotested: { id: string; navn: string } | null;
    bygg: BesokSted | null;
  },
): void {
  db.insert(arbeidsdagLocal)
    .values({
      id: p.id,
      userId: p.userId,
      dato: p.dato,
      startAt: p.naaIso,
      startLat: p.lat,
      startLng: p.lng,
      endAt: null,
      endLat: null,
      endLng: null,
      status: "paagaar",
      generertDagsseddelId: null,
      oppmotestedId: p.oppmotested?.id ?? null,
      oppmotestedNavn: p.oppmotested?.navn ?? null,
      byggeplassId: p.bygg?.id ?? null,
      byggeplassNavn: p.bygg?.navn ?? null,
      sistEndretLokalt: p.naaMs,
    })
    .run();
  registrerBesok(db, {
    id: p.besokId,
    arbeidsdagId: p.id,
    sted: {
      id: p.bygg?.id ?? null,
      navn: p.bygg?.navn ?? null,
      projectId: p.bygg?.projectId ?? null,
    },
    ankomstAt: p.naaIso,
    kilde: "start_dag",
    naaIso: p.naaIso,
  });
}

/**
 * S1: skal banneret vises for dette GPS-treffet? Kun når treffet er en annen
 * byggeplass enn siste besøk og ikke er dempet. Ingen treff → stille.
 */
export function s1Forslag(
  treff: BesokSted | null,
  siste: Pick<Besok, "byggeplassId"> | null,
  vakt: S1Vakt,
  naaMs: number,
): BesokSted | null {
  if (!treff?.id) return null;
  if (treff.id === siste?.byggeplassId) return null;
  if (vakt.erDempet(treff.id, naaMs)) return null;
  return treff;
}
