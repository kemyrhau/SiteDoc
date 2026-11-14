/**
 * LES-fasen for dagsseddel-forslaget (LAG 0b → L3-A). Kun select mot lokal DB;
 * skrivingen ligger i `anvendDagsforslag` og kjører først ved «Bekreft og
 * lagre» i `/timer/bekreft-dag`.
 */
import { eq, and } from "drizzle-orm";
import type { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  aktivitetLocal,
  lonnsartLocal,
} from "../db/schema";
import { splittVedMidnatt, kappGlemtDagSlutt } from "../utils/dagsegment";
import {
  MAKS_ENKELTSKIFT_TIMER,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
  type DagsforslagEksisterendeSedel,
} from "../utils/dagsforslag";
import {
  tolkStart,
  tolkSlutt,
  velgDestinasjon,
  tilGeofencer,
  type Destinasjon,
} from "@sitedoc/shared";
import { hentProsjekterLokalt } from "./prosjektKatalog";
import { hentArbeidsdagTiderLokalt } from "./kalenderKatalog";
import { hentDagsnormLokalt } from "./arbeidstidSvarKatalog";
import { hentStandardLonnsartLokalt, hentReiseLonnsartId } from "./timerKatalog";
import { hentOrganizationSettingLokalt } from "./organizationSettingKatalog";
import { hentMatriseRadLokalt } from "./reisetidMatriseKatalog";
import {
  hentByggeplasserForFirmaLokalt,
  hentByggeplasserForProsjektLokalt,
} from "./byggeplassKatalog";
import { hentOppmotederLokalt } from "./oppmotestedKatalog";
import { hentReiseGrensepunkterLokalt } from "./reiseGrensepunktKatalog";

export type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/** Delmengden av arbeidsdagen lese-fasen trenger (speiler `AktivDag`). */
export type DagsforslagInputDag = {
  startAt: string;
  startLat: number | null;
  startLng: number | null;
  oppmotestedId: string | null;
  byggeplassId: string | null;
};

// Lokal kopi — `useArbeidsdag` drar inn React Native og kan ikke importeres
// her (samme mønster som `dagsforslag.ts` og `dagsegment.ts`).
function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}

/**
 * LES-fasen: samle ALT `beregnDagsforslag` trenger fra lokal DB — kataloger,
 * org-setting, reise-oppslag (matrise + grensepunkter) og eksisterende-sedel-
 * status per dato. Dette er stedet DB-kunnskapen gjøres SYNLIG; den rene
 * utregningen (`beregnDagsforslag`) rører aldri databasen.
 *
 * L3-A (2026-11-06): flyttet ut av `StartSluttDagKort` til denne delte kilden.
 * Eneste kaller er `forberedBekreftDag` (`utils/bekreftDag.ts`), som skjermen
 * `/timer/bekreft-dag` bruker. Funksjonen gjør KUN select — ALDRI dupliser
 * lesningen inn i skjermen.
 *
 * `valgtByggeplassId` (A2): arbeiderens byggeplassvalg i skjermen overstyrer
 * A5-destinasjonen. Skjermen kjører da lese-fasen på nytt, så destinasjonens
 * prosjekt og matrisecellene følger valget.
 */
export function samleDagsforslagInput(
  db: LokalDb,
  p: {
    userId: string;
    orgId: string;
    dag: DagsforslagInputDag;
    sluttIso: string;
    endLat: number | null;
    endLng: number | null;
    kontekstByggeplassId: string | null;
    aktivtProsjektId: string | null;
    sisteSegmentKilde: "bruker" | "system";
    /** A2: arbeiderens byggeplassvalg i skjermen. undefined = A5 velger. */
    valgtByggeplassId?: string | null;
  },
): BeregnDagsforslagInput {
  const { orgId, dag } = p;

  // Kataloger (plain data, ikke Drizzle-rader, inn til den rene funksjonen).
  const prosjekter = hentProsjekterLokalt(orgId).map((pr) => ({
    id: pr.id,
    lat: pr.lat,
    lng: pr.lng,
  }));
  const aktiviteter = db
    .select({ id: aktivitetLocal.id, navn: aktivitetLocal.navn })
    .from(aktivitetLocal)
    .where(eq(aktivitetLocal.aktiv, true))
    .all();
  const alleLonnsarter = db
    .select({
      id: lonnsartLocal.id,
      navn: lonnsartLocal.navn,
      overtidsnivaa: lonnsartLocal.overtidsnivaa,
      aktiv: lonnsartLocal.aktiv,
      type: lonnsartLocal.type,
      rekkefolge: lonnsartLocal.rekkefolge,
    })
    .from(lonnsartLocal)
    .where(eq(lonnsartLocal.organizationId, orgId))
    .all();
  const standardLonnsartId = hentStandardLonnsartLokalt(orgId)?.id ?? null;

  const regelRad = hentOrganizationSettingLokalt(orgId);
  const regel = regelRad
    ? {
        reiseTerskelEnhet: regelRad.reiseTerskelEnhet,
        reiseTerskelMin: regelRad.reiseTerskelMin,
        reiseTerskelM: regelRad.reiseTerskelM ?? null,
        reiseUnderTerskelType: regelRad.reiseUnderTerskelType,
        reiseOverTerskelType: regelRad.reiseOverTerskelType,
        tidsrundingMinutter: regelRad.tidsrundingMinutter ?? null,
        // C5 (V1): reisetidTellerOvertid leses ikke lenger — reisetid er ALDRI
        // overtid. Feltet er ute av DagsforslagRegel og org-setting-cachen.
        standardPauseEtterTimer: regelRad.standardPauseEtterTimer ?? null,
      }
    : null;

  // Reise-oppslag (A3/A4/A5): tolk start-/slutt-posisjon mot firmaets geofencer,
  // velg destinasjon, og slå opp ut-/retur-matrisecellene. §2: prosjektvalget
  // følger destinasjonen (byggeplassens prosjekt) → arbeiderens aktive prosjekt
  // → prosjektUkjent. 🔴 `velgNaermesteProsjekt`/`resolverPrimaerByggeplass`
  // (nærmeste-uten-grense + primærbyggeplass) er erstattet av A5.
  let reiseOppslag: BeregnDagsforslagInput["reiseOppslag"] = null;
  let destinasjonProsjektId: string | null = null;
  if (regel) {
    // V17-A: geofence-kandidater via tilGeofencer (A4) — de to radius-null-
    // filtrene er borte. I V17-A gir byggeplass én sirkel hver (ingen sone-data);
    // oppmøtested kalles alltid med `soner: []` → forblir sirkel (spec C-2).
    // tolkStart/tolkSlutt leser kun `sted.id`, så ingen navn-mapping trengs her.
    const alleByggeplasser = hentByggeplasserForFirmaLokalt(orgId);
    const byggGeofencer = alleByggeplasser.flatMap((b) =>
      tilGeofencer({ id: b.id, lat: b.lat, lng: b.lng, radiusM: b.radiusM, soner: [] }),
    );
    const oppmGeofencer = hentOppmotederLokalt(orgId).flatMap((o) =>
      tilGeofencer({ id: o.id, lat: o.lat, lng: o.lng, radiusM: o.radiusM, soner: [] }),
    );
    const startPos =
      dag.startLat != null && dag.startLng != null
        ? { lat: dag.startLat, lng: dag.startLng }
        : null;
    const sluttPos =
      p.endLat != null && p.endLng != null
        ? { lat: p.endLat, lng: p.endLng }
        : null;
    const start = tolkStart(startPos, oppmGeofencer, byggGeofencer);
    const slutt = tolkSlutt(sluttPos, oppmGeofencer, byggGeofencer);
    // A5-regel (3): prosjektets byggeplasser = arbeiderens AKTIVE prosjekt (§2).
    const prosjektByggeplasser = p.aktivtProsjektId
      ? hentByggeplasserForProsjektLokalt(p.aktivtProsjektId).map((b) => ({
          id: b.id,
          harPunkt: b.lat != null && b.lng != null,
        }))
      : [];
    const destinasjon: Destinasjon = p.valgtByggeplassId
      ? { type: "byggeplass", byggeplassId: p.valgtByggeplassId }
      : velgDestinasjon({
          sluttsted: slutt,
          kontekstByggeplassId: p.kontekstByggeplassId,
          prosjektByggeplasser,
        });
    if (destinasjon.type === "byggeplass") {
      destinasjonProsjektId =
        alleByggeplasser.find((b) => b.id === destinasjon.byggeplassId)
          ?.projectId ?? null;
    }
    // Matriseceller: ut fra start-oppmøtested, retur fra slutt-oppmøtested —
    // begge mot destinasjonen (A5). hentMatriseRadLokalt beholdt.
    const utRad =
      start.type === "kontor" && destinasjon.type === "byggeplass"
        ? hentMatriseRadLokalt(start.oppmotestedId, destinasjon.byggeplassId)
        : null;
    const returRad =
      slutt.type === "kontor" && destinasjon.type === "byggeplass"
        ? hentMatriseRadLokalt(slutt.oppmotestedId, destinasjon.byggeplassId)
        : null;
    reiseOppslag = {
      start,
      slutt,
      destinasjon,
      utCelle: utRad
        ? { kjoretidMin: utRad.kjoretidMin, avstandM: utRad.avstandM ?? null }
        : null,
      returCelle: returRad
        ? {
            kjoretidMin: returRad.kjoretidMin,
            avstandM: returRad.avstandM ?? null,
          }
        : null,
      grensepunkter: hentReiseGrensepunkterLokalt(orgId),
      // Uten avstand → fallback-arten (regel.reiseLonnsartId ?? navne-match),
      // samme kilde `løsReiseLonnsartId` faller tilbake på i den rene funksjonen.
      fallbackReiseLonnsartId: hentReiseLonnsartId(orgId),
    };
  }

  // Midnatt-splitt for å vite HVILKE datoer vi må lese effektiv-arbeidstid og
  // eksisterende-sedel for. Samme rene helpere (`kappGlemtDagSlutt` +
  // `splittVedMidnatt`) som `beregnDagsforslag` → identiske datoer.
  const startDato = formatIsoDato(new Date(dag.startAt));
  // Lese-fasens kapp bestemmer kun HVILKE datoer vi leser for (den rene
  // funksjonen gjør det reelle kappet). Grov norm fra svar-cachen, 7,5t-fallback.
  const startNorm = hentDagsnormLokalt(orgId, startDato);
  const kappLengdeTimer =
    startNorm?.dagsnorm && startNorm.dagsnorm > 0 ? startNorm.dagsnorm : 7.5;
  const { sluttIso: effektivSluttIso } = kappGlemtDagSlutt(
    dag.startAt,
    p.sluttIso,
    { deteksjonsTimer: MAKS_ENKELTSKIFT_TIMER, kappLengdeTimer },
  );
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);

  // effektivPerDato = tider (lokal utledning, forhåndsutfylling) + lønnsnorm
  // (server-svar via svar-cachen). Mangler svar → dagsnorm 0 + normStatus
  // "ukjent" (trinn 3: ingen overtid-splitt, markør vises).
  const effektivPerDato: Record<string, DagsforslagEffektiv> = {};
  const alleDatoer = new Set<string>([
    startDato,
    ...segmenter.map((s) => s.dato),
  ]);
  for (const dato of alleDatoer) {
    const tider = hentArbeidsdagTiderLokalt(orgId, new Date(`${dato}T00:00:00`));
    const norm = hentDagsnormLokalt(orgId, dato);
    effektivPerDato[dato] = {
      startTid: tider.startTid,
      sluttTid: tider.sluttTid,
      pauseMin: tider.pauseMin,
      dagsnorm: norm?.dagsnorm ?? 0,
      pauseReferanse: norm?.pauseReferanse ?? "ankomst",
      // RETUR 2026-11-13: firmaets pausegrense fra svar-cachen (server-verdien).
      ...(norm?.pauseEtterTimer != null ? { pauseEtterTimer: norm.pauseEtterTimer } : {}),
      normStatus: norm?.normStatus ?? "ukjent",
      // B5: snapshot av normen svar-cachen hadde (null når ukjent — ingen svar).
      // hentetAt (Unix ms) → ISO i snapshotet.
      normSnapshot: norm
        ? {
            dagsnorm: norm.dagsnorm,
            normKilde: norm.normKilde,
            dato: norm.dato,
            hentetAt: new Date(norm.hentetAt).toISOString(),
          }
        : null,
    };
  }

  const eksisterendeSedelPerDato: Record<
    string,
    DagsforslagEksisterendeSedel
  > = {};
  for (const seg of segmenter) {
    eksisterendeSedelPerDato[seg.dato] = lesEksisterendeSedel(
      db,
      p.userId,
      seg.dato,
    );
  }

  return {
    dag: {
      startAt: dag.startAt,
      startLat: dag.startLat,
      startLng: dag.startLng,
      oppmotestedId: dag.oppmotestedId,
      byggeplassId: dag.byggeplassId,
    },
    sluttIso: p.sluttIso,
    endLat: p.endLat,
    endLng: p.endLng,
    kontekstByggeplassId: p.kontekstByggeplassId,
    aktivtProsjektId: p.aktivtProsjektId,
    destinasjonProsjektId,
    sisteSegmentKilde: p.sisteSegmentKilde,
    prosjekter,
    aktiviteter,
    alleLonnsarter,
    standardLonnsartId,
    regel,
    reiseOppslag,
    effektivPerDato,
    eksisterendeSedelPerDato,
  };
}

/**
 * Snapshot av eksisterende dagsseddel for (userId, dato) FØR skrivingen: finnes
 * den, hvilken status, og hvilke tidsrom bærer radene (for overlapp-vakten).
 * Speiler lesningene det gamle `opprettDagsseddelForSegment` gjorde (idempotens-
 * treff via `finnEllerOpprettDagsseddel` + eksisterende-rad-spørringen).
 */
function lesEksisterendeSedel(
  db: LokalDb,
  userId: string,
  dato: string,
): DagsforslagEksisterendeSedel {
  const sedel = db
    .select({ id: dagsseddelLocal.id, status: dagsseddelLocal.status })
    .from(dagsseddelLocal)
    .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.dato, dato)))
    .all()[0];
  if (!sedel) {
    return { finnes: false, status: null, eksisterendeRader: [] };
  }
  const rader = db
    .select({
      fraTid: sheetTimerLocal.fraTid,
      tilTid: sheetTimerLocal.tilTid,
      pauseMin: sheetTimerLocal.pauseMin,
      erReise: sheetTimerLocal.erReise,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
    .all();
  return { finnes: true, status: sedel.status, eksisterendeRader: rader };
}
