/**
 * LAG 0b (2026-10-02) — REN utregning av dagsseddel-forslag.
 *
 * Skilt ut fra `StartSluttDagKort.genererForslag`, som tidligere FLETTET
 * regnestykket sammen med DB-skrivingen (inne i `opprettDagsseddelForSegment`).
 * Konsekvensen var at «Slutt dag» markerte arbeidsdagen `avsluttet` FØR utfallet
 * av skrivingen var kjent — feilet radopprettelsen var GPS-økta oppbrukt og
 * dagens timer borte (H7 i timer-gps-helhetsplan.md).
 *
 * `beregnDagsforslag` er 🟢 **REN**: all utregning, **null DB-skriving og null
 * DB-lesing**. Alle kataloger, org-setting, matrise-oppslag og eksisterende-
 * sedel-status leses ut av kalleren (`samleDagsforslagInput` i komponenten) og
 * sendes inn som argumenter. Da er funksjonen fullt testbar uten React Native og
 * uten database — vakten mot at skrive-/lese-splitten endrer utregningen stille.
 *
 * 🔴 **NULL atferdsendring:** denne funksjonen reproduserer dagens utregning
 * 1:1, INKLUDERT de bevisste feilene som skal bort SENERE (men da ett sted, ikke
 * femten): reise-unntaket (fra/til = null), `reisetidTellerOvertid`-fradraget,
 * luftlinje/50-reservemålingen, `prosjekter[0]`-fallbacken uten koordinater, og
 * nærmeste-prosjekt-uten-avstandsgrense. Endres noe av det her, kan ingen se om
 * splitten var riktig. V-reglene fra helhetsplanen (V1–V14) hører IKKE her.
 *
 * Selve persisteringen ligger i `anvendDagsforslag` (`dagsforslagAnvend.ts`) og
 * kjører kun når noe skal skrives.
 */
import {
  avstandMeter,
  estimerReisetidMin,
  klassifiserReise,
  klassifiserArbeidstid,
  velgOvertidLonnsart,
  carveArbeidstider,
  pauseVinduFra,
  pauseMinForDag,
  hhmmTilMin,
  finnOverlappendeTidsrom,
  løsReiseLonnsartId,
  DEFAULT_PAUSE_ETTER_TIMER,
  type ReiseKategori,
  type ReiseEnhet,
  type ReiseGrensepunkt,
} from "@sitedoc/shared";
import { rundTimerTilNarmeste } from "./tidsrunding";
import { splittVedMidnatt, kappGlemtDagSlutt } from "./dagsegment";

/**
 * UF-2 trinn 8 — hard enkelt-skift-cap (timer). Spenn over dette tolkes som
 * glemt avslutning og kappes (se `kappGlemtDagSlutt`). Konstant inntil videre;
 * å gjøre den til en firma-setting (AML/tariff per firma) krever server +
 * migrering → egen runde.
 */
export const MAKS_ENKELTSKIFT_TIMER = 16;

// Lokale kopier av de to triviale tid-helperne fra `useArbeidsdag` — importeres
// IKKE derfra, fordi den fila drar inn React Native (hooks + expo-location) og
// ville gjort denne rene modulen uleselig for vitest-node. Samme mønster som
// `dagsegment.ts`, som også holder sin egen `formatIsoDato`.
function formatIsoDato(d: Date): string {
  const aar = d.getFullYear();
  const maaned = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${aar}-${maaned}-${dag}`;
}
function tilHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Ett prosjekt-kandidat for Haversine-valget (plain data, ingen Drizzle). */
export type DagsforslagProsjekt = {
  id: string;
  lat: number | null;
  lng: number | null;
};

/** Aktiv aktivitet-kandidat (kalleren har alt filtrert `aktiv = true`). */
export type DagsforslagAktivitet = { id: string; navn: string };

/** Lønnsart-kandidat — feltene `velgOvertidLonnsart` + id trenger. */
export type DagsforslagLonnsart = {
  id: string;
  overtidsnivaa: number | null;
  aktiv: boolean;
  type: string;
  rekkefolge: number;
};

/** Delmengden av org-setting utregningen bruker (plain data). */
export type DagsforslagRegel = {
  reiseTerskelEnhet: string;
  reiseTerskelMin: number;
  reiseTerskelM: number | null;
  reiseUnderTerskelType: string;
  reiseOverTerskelType: string;
  tidsrundingMinutter: number | null;
  reisetidTellerOvertid: boolean;
  standardPauseEtterTimer: number | null;
};

/** Effektiv arbeidstid for én dag (speiler `kalenderKatalog.EffektivArbeidstid`). */
export type DagsforslagEffektiv = {
  startTid: string;
  sluttTid: string;
  pauseMin: number;
  dagsnorm: number;
};

/**
 * Ferdig-leste reise-oppslag (fra matrise + grensepunkt-katalog). `null` når
 * reise ikke er aktuelt (ikke noe oppmøtested, eller ingen org-setting).
 */
export type DagsforslagReiseOppslag = {
  /** Matrise-rad (oppmøtested → prosjektets primær-byggeplass). null = ingen rad/byggeplass. */
  matriseRad: { kjoretidMin: number; avstandM: number | null } | null;
  /** Firmaets reise-avstandsbånd (for lønnsart-valg). */
  grensepunkter: ReiseGrensepunkt[];
  /** `regel.reiseLonnsartId ?? navne-match` — resolvert av kalleren (DB). */
  fallbackReiseLonnsartId: string | null;
};

/** Eksisterende dagsseddel for én dato, lest FØR beregningen (snapshot). */
export type DagsforslagEksisterendeSedel = {
  /** true = sedel finnes alt for (userId, dato) (idempotens-treff). */
  finnes: boolean;
  /** Sedelens status (draft/returned/sent/accepted/…). null når !finnes. */
  status: string | null;
  /** Sedelens rader (fra/til) — for overlapp-vakten mot manuelt førte timer. */
  eksisterendeRader: Array<{ fraTid: string | null; tilTid: string | null }>;
};

/** Én foreslått timer-rad (uten id/sedel — fylles av `anvendDagsforslag`). */
export type DagsforslagRad = {
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  pauseMin: number;
  /** true = reise-rad (matrise-/GPS-mengde, bevisst uten fra/til). */
  erReise: boolean;
};

/** Forslaget for én kalenderdag (ett midnatt-segment). */
export type DagsforslagDag = {
  dato: string;
  erStartSegment: boolean;
  /** Segmentets reelle start/slutt (ISO) — brukes av anvend til sedel-vindu. */
  segmentStartIso: string;
  segmentSluttIso: string;
  /** true = sedelen er sendt/godkjent → kan ikke appendes (ingen rader). */
  blokkert: boolean;
  eksisterendeStatus: string | null;
  /** true = ingen sedel finnes for datoen ennå (ny opprettes av anvend). */
  erNy: boolean;
  /** true = sedelen HADDE rader før denne økta (pre-fylt — skiller «for kort»-copy). */
  harEksisterendeRader: boolean;
  byggeplassId: string | null;
  /** Fordelt segment-pause (sedel-nivå prefill). */
  pauseMin: number;
  deltVedMidnatt: boolean;
  sluttTidKilde: "bruker" | "midnatt" | "system";
  /** Tidsrom der en play-rad vek for en overlappende manuell rad. */
  vekForOverlapp: Array<{ fraTid: string; tilTid: string }>;
  rader: DagsforslagRad[];
};

/** Hele forslaget — én dag normalt, flere ved midnatt-splitt. */
export type Dagsforslag = {
  /** null = kunne ikke utlede prosjekt/aktivitet offline (manuell opprettelse). */
  prosjektId: string | null;
  aktivitetId: string | null;
  /** true = spennet ble kappet (glemt avslutning) → siste kilde "system". */
  kappet: boolean;
  datoer: DagsforslagDag[];
};

/** Alt `beregnDagsforslag` trenger — ferdig lest ut av kalleren (ingen DB her). */
export type BeregnDagsforslagInput = {
  dag: {
    startAt: string;
    startLat: number | null;
    startLng: number | null;
    oppmotestedId: string | null;
    byggeplassId: string | null;
  };
  sluttIso: string;
  endLat: number | null;
  endLng: number | null;
  /** F4: global aktiv byggeplass + aktivt prosjekt (for D2-match-sjekk). */
  kontekstByggeplassId: string | null;
  aktivtProsjektId: string | null;
  /** Kilde for SISTE segments slutt-tid ("bruker" normal, "system" glemt-dag). */
  sisteSegmentKilde: "bruker" | "system";
  prosjekter: DagsforslagProsjekt[];
  aktiviteter: DagsforslagAktivitet[];
  alleLonnsarter: DagsforslagLonnsart[];
  /** Firmaets standard-lønnsart (normaltid). null → normaltid-rader hoppes over. */
  standardLonnsartId: string | null;
  regel: DagsforslagRegel | null;
  reiseOppslag: DagsforslagReiseOppslag | null;
  /** Effektiv arbeidstid per dato — MÅ dekke startdato + alle segment-datoer. */
  effektivPerDato: Record<string, DagsforslagEffektiv>;
  eksisterendeSedelPerDato: Record<string, DagsforslagEksisterendeSedel>;
};

/**
 * 🔴 Nærmeste prosjekt via Haversine — INKLUDERT dagens feil (bevart 1:1):
 * uten koordinater faller den tilbake på `prosjekter[0]`, og med koordinater
 * velges nærmeste UTEN avstandsgrense (ingen «for langt unna»-kutt). Delt ren
 * helper så lese-fasen og `beregnDagsforslag` velger likt uten divergens.
 */
export function velgNaermesteProsjekt(
  prosjekter: DagsforslagProsjekt[],
  lat: number | null,
  lng: number | null,
): DagsforslagProsjekt {
  let valgt = prosjekter[0]!;
  if (lat != null && lng != null) {
    const medKoord = prosjekter.filter((p) => p.lat != null && p.lng != null);
    let besteAvstand = Infinity;
    for (const p of medKoord) {
      const km = haversineKm(lat, lng, p.lat as number, p.lng as number);
      if (km < besteAvstand) {
        besteAvstand = km;
        valgt = p;
      }
    }
  }
  return valgt;
}

/** Haversine (km) — lokal kopi av `utils/geo` (den fila er ren, men vi holder
 *  denne modulen fri for sideimporter; identisk formel). */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Glemt-dag 0-fiks (c): fordel hele-dags-fradrag (pause + reise) over
 * midnatt-segmentene slik at intet segment får negativ arbeidstid
 * (`brutto − fradrag ≥ 0`). Tidligere lå alt på start-segmentet — et kort
 * start-segment (sen start nær midnatt) kunne ikke bære pause+reise →
 * `Math.max(0, …)` kappet arbeidstimene til 0 og timene forsvant.
 *
 * Regler: **reise** prioriteres på start-segmentet (start-dags reise), med
 * overflyt til lengste-først. **Pause** prioriteres på lengste segment.
 * Begge kappes til hvert segments gjenværende kapasitet og rest omfordeles —
 * **aldri kapp-og-mist** (cond. 2). Σ fradrag bevares så lenge
 * Σbrutto ≥ Σfradrag → dag-total (`Σbrutto − pause`) er invariant (cond. 1).
 * Ett segment (normalt dagskift) → alt på det ene = uendret atferd (cond. 4).
 */
export function fordelArbeidstidFradrag(
  bruttoTimer: number[],
  startIndeks: number,
  pauseTotalMin: number,
  reiseTotalTimer: number,
): { pauseMin: number[]; reisetidTimer: number[] } {
  const n = bruttoTimer.length;
  const kapasitet = bruttoTimer.slice();
  const reisePer = new Array<number>(n).fill(0);
  const pauseTimerPer = new Array<number>(n).fill(0);

  // F-e (dag-nivå gate, re-fiks 2026-07-13): pausefradrag gjelder KUN når dagens
  // totale brutto arbeidstid overstiger terskelen (AML §10-9, 5,5 t). Gaten ligger
  // her — i dag-nivå pause-kilden der dagstotalen finnes — så pausen nulles FØR den
  // fordeles per segment (alle segmenters pauseMin blir 0 under terskel). Erstatter
  // carve-intern gating. dagsTotalBrutto = sum av segmentenes brutto-spenn.
  const dagsTotalBrutto = bruttoTimer.reduce((s, b) => s + Math.max(0, b), 0);
  const effektivPauseTotalMin = pauseMinForDag(dagsTotalBrutto, pauseTotalMin);

  const lengsteForst = bruttoTimer
    .map((b, i) => ({ b, i }))
    .sort((a, z) => z.b - a.b)
    .map((x) => x.i);

  // 1) Reise: start-segment først, så lengste-først for evt. overflyt.
  const reiseRekke = [
    startIndeks,
    ...lengsteForst.filter((i) => i !== startIndeks),
  ];
  let restReise = Math.max(0, reiseTotalTimer);
  for (const i of reiseRekke) {
    if (restReise <= 0) break;
    const ta = Math.min(restReise, kapasitet[i]!);
    reisePer[i]! += ta;
    kapasitet[i]! -= ta;
    restReise -= ta;
  }

  // 2) Pause: lengste-først, i kapasiteten som er igjen etter reise. Bruker den
  // terskel-gatede pausen (0 når dagen < 5,5t).
  let restPauseTimer = Math.max(0, effektivPauseTotalMin) / 60;
  for (const i of lengsteForst) {
    if (restPauseTimer <= 0) break;
    const ta = Math.min(restPauseTimer, kapasitet[i]!);
    pauseTimerPer[i]! += ta;
    kapasitet[i]! -= ta;
    restPauseTimer -= ta;
  }

  return {
    pauseMin: pauseTimerPer.map((t) => Math.round(t * 60)),
    reisetidTimer: reisePer.map((t) => Math.round(t * 100) / 100),
  };
}

/**
 * REN utregning av et dagsseddel-forslag fra en avsluttet arbeidsdag-økt.
 *
 * Slice 4a: en økt som krysser midnatt deles i én dagsseddel per kalenderdag
 * (`splittVedMidnatt`); timene summerer til reell total. Reise + firma-pause
 * fordeles over segmentene (pause→lengste, reise→start m/ overflyt). Per dag
 * gjelder dagens auto-fordeling: Timelønn opp til dagsnorm + «Overtid 50%» for
 * overskytende. Prosjekt = nærmeste via Haversine (start-GPS, ellers slutt-GPS).
 *
 * `prosjektId: null` = prosjekt/aktivitet kunne ikke utledes → kalleren går til
 * manuell opprettelse (samme som dagens `genererForslag` returnerte `id: null`).
 */
export function beregnDagsforslag(input: BeregnDagsforslagInput): Dagsforslag {
  const tomt: Dagsforslag = {
    prosjektId: null,
    aktivitetId: null,
    kappet: false,
    datoer: [],
  };
  const { dag, sluttIso, endLat, endLng, regel } = input;

  // 1. Prosjekt via Haversine (start-GPS, ellers slutt-GPS).
  if (input.prosjekter.length === 0) return tomt;
  const lat = dag.startLat ?? endLat;
  const lng = dag.startLng ?? endLng;
  const valgtProsjekt = velgNaermesteProsjekt(input.prosjekter, lat, lng);

  // 2. Aktivitet — default «Anleggsarbeid» eller første.
  if (input.aktiviteter.length === 0) return tomt;
  const aktivitet =
    input.aktiviteter.find((a) => a.navn === "Anleggsarbeid") ??
    input.aktiviteter[0]!;

  // 3. Reise-forslag (føres på START-dagen). KUN når oppmøtested ble
  // identifisert ved start. Reisetid = matrise-kjøretid; kjoretidMin < 0 =
  // uoppnåelig → ingen forslag. Ingen matrise-rad → graceful estimat-fallback
  // (luftlinje start→slutt / 50 km/t). Klassifiseres mot terskel; 'reisetid' →
  // egen lønnsart-rad.
  let reisetidTimer = 0;
  let reiseLonnsartId: string | null = null;
  if (dag.oppmotestedId && regel && input.reiseOppslag) {
    let reisetidMin: number | null = null;
    let avstandM: number | null = null;
    const rad = input.reiseOppslag.matriseRad;
    if (rad) {
      // -1 (uoppnåelig) → 0: ingen forslag, OG hopp over estimat-fallback.
      reisetidMin = rad.kjoretidMin < 0 ? 0 : rad.kjoretidMin;
      avstandM = rad.avstandM ?? null;
    }
    // Fallback kun når matrisen ikke ga svar (ingen rad/byggeplass).
    if (
      reisetidMin == null &&
      dag.startLat != null &&
      dag.startLng != null &&
      endLat != null &&
      endLng != null
    ) {
      const fallbackM = avstandMeter(
        { lat: dag.startLat, lng: dag.startLng },
        { lat: endLat, lng: endLng },
      );
      reisetidMin = estimerReisetidMin(fallbackM);
      avstandM = fallbackM;
    }
    if (reisetidMin != null && reisetidMin > 0) {
      const kategori: ReiseKategori = klassifiserReise(
        { reisetidMin, avstandM },
        {
          reiseTerskelEnhet: regel.reiseTerskelEnhet as ReiseEnhet,
          reiseTerskelMin: regel.reiseTerskelMin,
          reiseTerskelM: regel.reiseTerskelM ?? null,
          reiseUnderTerskelType: regel.reiseUnderTerskelType as ReiseKategori,
          reiseOverTerskelType: regel.reiseOverTerskelType as ReiseKategori,
        },
      );
      if (kategori === "reisetid") {
        // `avstandM` lar resolveren velge firmaets avstandsbånd; uten treff/
        // uten avstand faller den tilbake på fallbackReiseLonnsartId (samme
        // kilde som render-laget: regel.reiseLonnsartId ?? navne-match).
        reiseLonnsartId = løsReiseLonnsartId(
          avstandM,
          input.reiseOppslag.grensepunkter,
          input.reiseOppslag.fallbackReiseLonnsartId,
        );
        if (reiseLonnsartId) {
          reisetidTimer = Math.round((reisetidMin / 60) * 100) / 100;
        }
      }
    }
  }

  // 4. UF-2: universell enkelt-skift-cap FØR midnatt-splitt. Er spennet større
  // enn hard-cap, tolkes det som glemt avslutning og slutt kappes til start +
  // sesongjustert dagsnorm → unngår N×24t-sedler. Kilde tvinges "system".
  const startDato = formatIsoDato(new Date(dag.startAt));
  const effektivStartDag = input.effektivPerDato[startDato];
  if (!effektivStartDag) return tomt;
  const kappLengdeTimer =
    effektivStartDag.dagsnorm > 0 ? effektivStartDag.dagsnorm : 7.5;
  const { sluttIso: effektivSluttIso, kappet } = kappGlemtDagSlutt(
    dag.startAt,
    sluttIso,
    { deteksjonsTimer: MAKS_ENKELTSKIFT_TIMER, kappLengdeTimer },
  );
  const effektivSisteKilde: "bruker" | "system" = kappet
    ? "system"
    : input.sisteSegmentKilde;

  // Midnatt-splitt (Slice 4a): én dagsseddel per kalenderdag. Pause + reise
  // fordeles over segmentene (pause→lengste, reise→start m/ overflyt).
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);
  const deltVedMidnatt = segmenter.length > 1;
  const bruttoPerSeg = segmenter.map(
    (s) =>
      (new Date(s.sluttIso).getTime() - new Date(s.startIso).getTime()) /
      3_600_000,
  );
  const startIdx = segmenter.findIndex((s) => s.erStartSegment);
  const fradrag = fordelArbeidstidFradrag(
    bruttoPerSeg,
    startIdx >= 0 ? startIdx : 0,
    effektivStartDag.pauseMin,
    reisetidTimer,
  );

  // F4: byggeplass-default-kjede → GPS (arbeidsdag) → global kontekst → ingen.
  // D2: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt.
  const byggeplassDefault =
    dag.byggeplassId ??
    (valgtProsjekt.id === input.aktivtProsjektId
      ? input.kontekstByggeplassId
      : null);

  const datoer = segmenter.map((seg, i) => {
    const erSiste = i === segmenter.length - 1;
    const sluttTidKilde: "bruker" | "midnatt" | "system" = erSiste
      ? effektivSisteKilde
      : "midnatt";
    const eksisterende = input.eksisterendeSedelPerDato[seg.dato] ?? {
      finnes: false,
      status: null,
      eksisterendeRader: [],
    };
    return beregnSegment({
      segment: seg,
      prosjektId: valgtProsjekt.id,
      aktivitetId: aktivitet.id,
      byggeplassId: byggeplassDefault,
      pauseMin: fradrag.pauseMin[i]!,
      reisetidTimer: fradrag.reisetidTimer[i]!,
      reiseLonnsartId,
      reisetidTellerOvertid: regel?.reisetidTellerOvertid ?? false,
      tidsrundingMinutter: regel?.tidsrundingMinutter ?? null,
      standardPauseEtterTimer: regel?.standardPauseEtterTimer ?? null,
      deltVedMidnatt,
      sluttTidKilde,
      effektiv: input.effektivPerDato[seg.dato],
      alleLonnsarter: input.alleLonnsarter,
      standardLonnsartId: input.standardLonnsartId,
      eksisterende,
    });
  });

  return {
    prosjektId: valgtProsjekt.id,
    aktivitetId: aktivitet.id,
    kappet,
    datoer,
  };
}

/** Utregning av ett dag-segments rader — ren speiling av rad-genereringen i
 *  det gamle `opprettDagsseddelForSegment` (uten find-or-create og DB-insert). */
function beregnSegment(a: {
  segment: {
    dato: string;
    startIso: string;
    sluttIso: string;
    erStartSegment: boolean;
  };
  prosjektId: string;
  aktivitetId: string;
  byggeplassId: string | null;
  pauseMin: number;
  reisetidTimer: number;
  reiseLonnsartId: string | null;
  reisetidTellerOvertid: boolean;
  tidsrundingMinutter: number | null;
  standardPauseEtterTimer: number | null;
  deltVedMidnatt: boolean;
  sluttTidKilde: "bruker" | "midnatt" | "system";
  effektiv: DagsforslagEffektiv | undefined;
  alleLonnsarter: DagsforslagLonnsart[];
  standardLonnsartId: string | null;
  eksisterende: DagsforslagEksisterendeSedel;
}): DagsforslagDag {
  const { segment, eksisterende } = a;
  const erNy = !eksisterende.finnes;
  // UF-1: sendt/godkjent → kan ikke appende ny økt (ville gi server-konflikt).
  const blokkert =
    eksisterende.finnes &&
    eksisterende.status !== "draft" &&
    eksisterende.status !== "returned";
  // F-g: sedelen HADDE rader før denne økta (kun i append-grenen, som i dag).
  const harEksisterendeRader =
    eksisterende.finnes && !blokkert && eksisterende.eksisterendeRader.length > 0;

  const base: DagsforslagDag = {
    dato: segment.dato,
    erStartSegment: segment.erStartSegment,
    segmentStartIso: segment.startIso,
    segmentSluttIso: segment.sluttIso,
    blokkert,
    eksisterendeStatus: eksisterende.status,
    erNy,
    harEksisterendeRader,
    byggeplassId: a.byggeplassId,
    pauseMin: a.pauseMin,
    deltVedMidnatt: a.deltVedMidnatt,
    sluttTidKilde: a.sluttTidKilde,
    vekForOverlapp: [],
    rader: [],
  };
  // Blokkert → ingen append (speiler den tidlige `blokkertSendt`-returen: 0
  // rader, ingen overlapp-sjekk).
  if (blokkert) return base;

  // Arbeidstid = segment-brutto − pause/reise (fordelt per segment).
  const bruttoTimer =
    (new Date(segment.sluttIso).getTime() -
      new Date(segment.startIso).getTime()) /
    3_600_000;
  const totalTimer =
    Math.round(Math.max(0, bruttoTimer - a.pauseMin / 60) * 100) / 100;
  // F-B: rund arbeidstimer til firmaets tidsrunding-grid FØR normaltid/overtid-
  // splitten. Reise rundes ikke.
  const raaArbeid =
    Math.round(Math.max(0, totalTimer - a.reisetidTimer) * 100) / 100;
  const arbeidstimer = rundTimerTilNarmeste(raaArbeid, a.tidsrundingMinutter);

  const rader: DagsforslagRad[] = [];
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];
  const eksisterendeTidsrom = eksisterende.eksisterendeRader;

  // Auto-fordeling normaltid/overtid (per dag). Overtid velges strukturert på
  // overtidsnivaa — ALDRI fritekst-navn (③a).
  if (arbeidstimer > 0) {
    const effektivDagsnorm = a.effektiv?.dagsnorm ?? 0;
    const dagsnorm0 = effektivDagsnorm > 0 ? effektivDagsnorm : arbeidstimer;
    // Fase 3: når reisetid teller mot overtid, spiser reise-andelen av dagsnorm-
    // budsjettet → mer av arbeidstiden havner i overtid.
    const dagsnorm =
      a.reisetidTellerOvertid && a.reisetidTimer > 0
        ? Math.max(0, dagsnorm0 - a.reisetidTimer)
        : dagsnorm0;

    const pauseEtterTimer =
      a.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
    const startTidHHMM = tilHHMM(segment.startIso);
    // GPS-carve: tildel FAKTISKE fra/til fra segmentets reelle vindu. Reise
    // forskyver arbeids-start; reise-raden selv får ingen tid (under).
    const carvet = carveArbeidstider({
      startTid: startTidHHMM,
      reisetidTimer: a.reisetidTimer,
      pauseFra: pauseVinduFra(startTidHHMM, pauseEtterTimer),
      pauseMin: a.pauseMin,
      segmenter: klassifiserArbeidstid({ arbeidstimer, dagsnorm }),
    });
    for (const vindu of carvet) {
      // Normaltid (overtidsnivaa=null) → firmaets standard-lønnsart.
      // Overtid → velg strukturert på overtidsnivaa (type=ordinaer, aktiv).
      const lonnsartId =
        vindu.overtidsnivaa === null
          ? a.standardLonnsartId
          : (velgOvertidLonnsart(a.alleLonnsarter, vindu.overtidsnivaa)?.id ??
            null);
      // ③a/③b: aldri feil-match, aldri stille drop — uten treff hoppes raden over.
      if (!lonnsartId) continue;
      // 1b: play viker for overlappende manuell rad. Berøring i endepunkt teller
      // ikke. Ved treff settes IKKE play-raden inn; tidsrommet samles for varsel.
      if (
        finnOverlappendeTidsrom(vindu.fraTid, vindu.tilTid, eksisterendeTidsrom)
      ) {
        vekForOverlapp.push({ fraTid: vindu.fraTid, tilTid: vindu.tilTid });
        continue;
      }
      // F5: bæreren = carve-vinduet som absorberer lunsjen (klokke-gap ≈ pauseMin).
      // Den raden bærer sedelens pauseMin; øvrige rader får 0.
      const gapMin =
        hhmmTilMin(vindu.tilTid) -
        hhmmTilMin(vindu.fraTid) -
        Math.round(vindu.timer * 60);
      const radPauseMin = a.pauseMin > 0 && gapMin >= 1 ? a.pauseMin : 0;
      rader.push({
        projectId: a.prosjektId,
        lonnsartId,
        aktivitetId: a.aktivitetId,
        timer: vindu.timer,
        fraTid: vindu.fraTid,
        tilTid: vindu.tilTid,
        pauseMin: radPauseMin,
        erReise: false,
      });
    }
  }

  // Reise-rad — separat lønnsart-rad, kun på start-segmentet (reisetidTimer = 0
  // ellers). REISE-UNNTAK: beholder null-tider bevisst (matrise-/GPS-MENGDE,
  // ikke et målt klokke-vindu).
  if (a.reisetidTimer > 0 && a.reiseLonnsartId) {
    rader.push({
      projectId: a.prosjektId,
      lonnsartId: a.reiseLonnsartId,
      aktivitetId: a.aktivitetId,
      timer: a.reisetidTimer,
      fraTid: null,
      tilTid: null,
      pauseMin: 0,
      erReise: true,
    });
  }

  return { ...base, vekForOverlapp, rader };
}

/** Utfallet av å anvende forslaget (returneres av `anvendDagsforslag`). */
export type AnvendDagsforslagResultat = {
  /** Start-dagens sedel-id (for navigering). null = kunne ikke utlede/skrive. */
  startSheetId: string | null;
  /** UF-1: minst én dato var alt sendt/godkjent → økta kunne ikke appendes. */
  blokkertSendt: boolean;
  /** Økta førte 0 rader totalt (for kort etter pause/runding). */
  ingenRader: boolean;
  /** Minst én sedel HADDE rader før denne økta (pre-fylt — «for kort»-copy). */
  harEksisterendeRader: boolean;
  /** Tidsrom der en play-rad vek for en overlappende manuell rad. */
  vekForOverlapp: Array<{ fraTid: string; tilTid: string }>;
};

/**
 * H7 — handlingen «Slutt dag» skal utføre, utledet fra anvend-utfallet. REN og
 * injiserbar så rekkefølge-logikken kan testes uten React Native.
 *
 * 🔴 KJERNEN I H7: dagen markeres `avsluttet` KUN når skrivingen lyktes
 * (`suksess`/`playVek`/`forKort` — sedel finnes, ingenting tapt). To utfall
 * holder dagen ÅPEN så GPS-økta ikke går tapt:
 *  - `blokkertSendt`: sedelen er alt sendt → økta kunne ikke appendes. Timene
 *    reddes ved at lederen returnerer sedelen (→ draft → appendbar).
 *  - `kildeManglet` (`startSheetId == null`): db/prosjekt/aktivitet manglet →
 *    ingen sedel, ingen rader. I dag forsvinner dagen STILT; nå står den åpen
 *    OG brukeren varsles (ellers er en forsvunnet dag verre enn en blokkert).
 */
export type SluttDagHandling =
  | { type: "suksess"; sheetId: string }
  | { type: "blokkertSendt"; sheetId: string }
  | { type: "playVek"; sheetId: string; intervaller: string }
  | { type: "forKort"; sheetId: string; preFylt: boolean }
  | { type: "kildeManglet" };

/** true = dagen skal markeres `avsluttet` (skrivingen lyktes, ingenting tapt). */
export function skalMarkereAvsluttet(handling: SluttDagHandling): boolean {
  return (
    handling.type === "suksess" ||
    handling.type === "playVek" ||
    handling.type === "forKort"
  );
}

/**
 * Avgjør «Slutt dag»-handlingen fra anvend-utfallet. Prioritet speiler dagens
 * varsel-rekkefølge (blokkertSendt → vekForOverlapp → ingenRader), med
 * `kildeManglet` (null sedel) løftet øverst — det er det stumme utfallet H7
 * gir en stemme.
 */
export function avgjorSluttDagHandling(
  resultat: AnvendDagsforslagResultat,
): SluttDagHandling {
  const sheetId = resultat.startSheetId;
  // Ingen sedel ble opprettet (db/prosjekt/aktivitet manglet) → kilde manglet.
  if (sheetId == null) return { type: "kildeManglet" };
  // UF-1: dagens sedel var alt sendt → den nye økten ble ikke lagt til.
  if (resultat.blokkertSendt) return { type: "blokkertSendt", sheetId };
  // 1b: play vek for manuelt førte timer — si HVA som vek.
  if (resultat.vekForOverlapp.length > 0) {
    const intervaller = resultat.vekForOverlapp
      .map((v) => `${v.fraTid}–${v.tilTid}`)
      .join(", ");
    return { type: "playVek", sheetId, intervaller };
  }
  // F-c: økta førte 0 rader (for kort etter pause/runding).
  if (resultat.ingenRader) {
    return { type: "forKort", sheetId, preFylt: resultat.harEksisterendeRader };
  }
  return { type: "suksess", sheetId };
}
