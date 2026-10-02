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
  type Startsted,
  type Sluttsted,
  type Destinasjon,
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

/**
 * Effektiv arbeidstid for én dag — det cachede server-svaret (B6 v3). `dagsnorm`
 * ≤ 0 (eller `normStatus === "ukjent"`) → ingen normaltid/overtid-splitt (trinn
 * 3): alt på standard-lønnsarten, feilretning er UNDERbetaling → markør kreves.
 */
export type DagsforslagEffektiv = {
  startTid: string;
  sluttTid: string;
  pauseMin: number;
  dagsnorm: number;
  /** B3 (V6): pausevinduets referanse. Default "ankomst" (fra arbeidsstart). */
  pauseReferanse?: "fastStart" | "ankomst";
  /** B6.3: svarets opphav — "server" (dagens dato), "cachet" (≤30d), "ukjent" (ingen). */
  normStatus?: "server" | "cachet" | "ukjent";
};

/**
 * Hvorfor en reise-etappe IKKE ble foreslått (B5, V12/V13). Vises på flaten
 * arbeideren ser (varsel etter «Slutt dag»), lag 3 flytter den til bekreftelses-
 * skjermen. `null` = etappe(r) ble foreslått, eller reise er ikke aktuelt.
 */
export type ReiseAarsak =
  | "posisjon_utilgjengelig"
  | "mangler_matrise"
  | "uoppnaaelig"
  | "mangler_avstand";

/**
 * Én reise-etappe (B1, V7/V10). `ut` = oppmøtested → destinasjon,
 * `retur` = destinasjon → oppmøtested. `kategori` fra `klassifiserReise` pr.
 * etappe; kun `reisetid`-etapper gir reise-rad og trekker arbeidsvinduet.
 */
export type Etappe = {
  retning: "ut" | "retur";
  oppmotestedId: string;
  byggeplassId: string;
  kjoretidMin: number;
  avstandM: number | null;
  kategori: ReiseKategori;
  kilde: "matrise";
};

/**
 * Ferdig-leste reise-oppslag (stedstolkning + matriseceller + grensepunkt-
 * katalog). `null` når reise ikke er aktuelt (ingen org-setting). Stedene (A3/A4)
 * og destinasjonen (A5) er tolket av lese-fasen; cellene er slått opp i matrisen.
 */
export type DagsforslagReiseOppslag = {
  /** A3: startposisjonen tolket mot oppmøtesteder/byggeplasser. */
  start: Startsted;
  /** A4: sluttposisjonen tolket. Grunnlag for retur (V7). */
  slutt: Sluttsted;
  /** A5: valgt destinasjon (byggeplass) eller ukjent med årsak. */
  destinasjon: Destinasjon;
  /** Matrisecelle for ut-etappen (start-oppmøtested → destinasjon). null = mangler. */
  utCelle: { kjoretidMin: number; avstandM: number | null } | null;
  /** Matrisecelle for retur-etappen (slutt-oppmøtested → destinasjon). null = mangler. */
  returCelle: { kjoretidMin: number; avstandM: number | null } | null;
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
  /**
   * §2: true når prosjektet ikke kunne utledes (A5 ga ingen destinasjon OG
   * ingen `aktivtProsjektId`). Skiller «velg prosjekt og prøv igjen» fra
   * `kildeManglet` (db/aktivitet mangler). Holder dagen åpen med egen melding.
   */
  prosjektUkjent: boolean;
  /** B5: hvorfor ingen reise-etappe ble foreslått (V12/V13). null = etappe(r) foreslått. */
  reiseAarsak: ReiseAarsak | null;
  /** B5: A5-årsak når destinasjonen ikke kunne velges. null = destinasjon valgt. */
  destinasjonAarsak: "flere_byggeplasser" | "ingen_byggeplass_med_punkt" | null;
  /**
   * B6.3: normens opphav for START-dagen — "server"/"cachet"/"ukjent". `null`
   * når forslaget ikke ble laget. Markøren (varsel + banner) vises når ≠ "server";
   * "ukjent" betyr at forslaget er uten overtid-splitt (UNDERbetaling-risiko).
   */
  normStatus: "server" | "cachet" | "ukjent" | null;
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
  /**
   * §2 (A5): prosjektet destinasjonens byggeplass hører til, resolvert av
   * lese-fasen. `null` når A5 ikke ga en destinasjon. Prosjektvalget er
   * `destinasjonProsjektId ?? aktivtProsjektId ?? prosjektUkjent` — ingen
   * `prosjekter[0]`-fallback lenger (H1 stille feil).
   */
  destinasjonProsjektId: string | null;
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

/** Delmengden av `DagsforslagRegel` som `klassifiserReise` trenger. */
function reiseRegelsett(regel: DagsforslagRegel) {
  return {
    reiseTerskelEnhet: regel.reiseTerskelEnhet as ReiseEnhet,
    reiseTerskelMin: regel.reiseTerskelMin,
    reiseTerskelM: regel.reiseTerskelM ?? null,
    reiseUnderTerskelType: regel.reiseUnderTerskelType as ReiseKategori,
    reiseOverTerskelType: regel.reiseOverTerskelType as ReiseKategori,
  };
}

/**
 * Bygg én etappe fra en matrisecelle, eller gi årsaken til at den ikke kunne
 * bygges (V13). Celle null → `mangler_matrise`; `kjoretidMin < 0` →
 * `uoppnaaelig`; km-enhet uten avstand → `mangler_avstand`. Ellers klassifiseres
 * cellen én gang (V10).
 */
function byggEtappe(
  retning: "ut" | "retur",
  oppmotestedId: string,
  byggeplassId: string,
  celle: { kjoretidMin: number; avstandM: number | null } | null,
  regel: DagsforslagRegel,
): { etappe: Etappe | null; aarsak: ReiseAarsak | null } {
  if (celle == null) return { etappe: null, aarsak: "mangler_matrise" };
  if (celle.kjoretidMin < 0) return { etappe: null, aarsak: "uoppnaaelig" };
  if (regel.reiseTerskelEnhet === "km" && celle.avstandM == null) {
    return { etappe: null, aarsak: "mangler_avstand" };
  }
  const kategori = klassifiserReise(
    { reisetidMin: celle.kjoretidMin, avstandM: celle.avstandM },
    reiseRegelsett(regel),
  );
  return {
    etappe: {
      retning,
      oppmotestedId,
      byggeplassId,
      kjoretidMin: celle.kjoretidMin,
      avstandM: celle.avstandM,
      kategori,
      kilde: "matrise",
    },
    aarsak: null,
  };
}

/**
 * B1 — bygg reise-etappene for en dag (V7/V10/V11/V12/V15).
 *
 * `ut`: start er kontor OG destinasjonen er en ANNEN byggeplass enn den kontoret
 * ligger i (V15: samme → ingen etappe, avstand 0). `retur`: slutt er kontor →
 * celle (slutt-oppmøtested → destinasjon). `start.type ∈ {byggeplass, utenfor}`
 * → ingen ut-etappe (V11); `start.type === "ukjent"` → `posisjon_utilgjengelig`
 * (V12). `aarsak` settes KUN for ut-etappen (B5 gjelder `start === kontor`).
 */
export function beregnReiseEtapper(
  start: Startsted,
  slutt: Sluttsted,
  destinasjon: Destinasjon,
  utCelle: { kjoretidMin: number; avstandM: number | null } | null,
  returCelle: { kjoretidMin: number; avstandM: number | null } | null,
  regel: DagsforslagRegel,
): { etapper: Etappe[]; aarsak: ReiseAarsak | null } {
  const etapper: Etappe[] = [];
  let aarsak: ReiseAarsak | null = null;

  // UT-etappe.
  if (start.type === "ukjent") {
    aarsak = "posisjon_utilgjengelig"; // V12
  } else if (start.type === "kontor" && destinasjon.type === "byggeplass") {
    if (start.byggeplassId !== destinasjon.byggeplassId) {
      // V15: kontoret ligger IKKE i destinasjonen → ut-etappe.
      const r = byggEtappe(
        "ut",
        start.oppmotestedId,
        destinasjon.byggeplassId,
        utCelle,
        regel,
      );
      if (r.etappe) etapper.push(r.etappe);
      else aarsak = r.aarsak;
    }
  }
  // start.type ∈ { "byggeplass", "utenfor" } → ingen ut-etappe (V11), ingen årsak.

  // RETUR-etappe (V7): slutt er kontor → destinasjon → slutt-oppmøtested.
  if (
    slutt.type === "kontor" &&
    destinasjon.type === "byggeplass" &&
    slutt.byggeplassId !== destinasjon.byggeplassId
  ) {
    const r = byggEtappe(
      "retur",
      slutt.oppmotestedId,
      destinasjon.byggeplassId,
      returCelle,
      regel,
    );
    if (r.etappe) etapper.push(r.etappe);
    // Retur-mangel setter ikke overordnet årsak (B5-gaten gjelder ut/start=kontor).
  }

  return { etapper, aarsak };
}

/**
 * Fordel dagens pause over midnatt-segmentene (lengste-først) slik at intet
 * segment får negativ arbeidstid. Et kort start-segment (sen start nær midnatt)
 * kunne ikke bære pausen → `Math.max(0, …)` kappet arbeidstimene til 0 og timene
 * forsvant; derfor omfordeling til lengste-først med rest-overflyt.
 *
 * 🔴 L1-B (B2): reisen er IKKE lenger et fradrag her — ut-etappen trekkes fra
 * start-segmentets vindu og retur-etappen fra slutt-segmentets (i
 * `beregnDagsforslag`), reise-raden legges på det segmentet etappen hører til.
 * Denne funksjonen fordeler KUN pausen. «Én trekkmekanisme: vinduet.»
 *
 * Pause kappes til hvert segments gjenværende kapasitet og rest omfordeles —
 * aldri kapp-og-mist. Ett segment (normalt dagskift) → alt på det ene.
 */
export function fordelPause(
  bruttoTimer: number[],
  pauseTotalMin: number,
): { pauseMin: number[] } {
  const n = bruttoTimer.length;
  const kapasitet = bruttoTimer.slice();
  const pauseTimerPer = new Array<number>(n).fill(0);

  // F-e (dag-nivå gate, re-fiks 2026-07-13): pausefradrag gjelder KUN når dagens
  // totale brutto arbeidstid overstiger terskelen (AML §10-9, 5,5 t). Gaten ligger
  // her — i dag-nivå pause-kilden der dagstotalen finnes — så pausen nulles FØR den
  // fordeles per segment (alle segmenters pauseMin blir 0 under terskel).
  const dagsTotalBrutto = bruttoTimer.reduce((s, b) => s + Math.max(0, b), 0);
  const effektivPauseTotalMin = pauseMinForDag(dagsTotalBrutto, pauseTotalMin);

  const lengsteForst = bruttoTimer
    .map((b, i) => ({ b, i }))
    .sort((a, z) => z.b - a.b)
    .map((x) => x.i);

  // Pause: lengste-først. Bruker den terskel-gatede pausen (0 når dagen < 5,5t).
  let restPauseTimer = Math.max(0, effektivPauseTotalMin) / 60;
  for (const i of lengsteForst) {
    if (restPauseTimer <= 0) break;
    const ta = Math.min(restPauseTimer, kapasitet[i]!);
    pauseTimerPer[i]! += ta;
    kapasitet[i]! -= ta;
    restPauseTimer -= ta;
  }

  return { pauseMin: pauseTimerPer.map((t) => Math.round(t * 60)) };
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
    prosjektUkjent: false,
    reiseAarsak: null,
    destinasjonAarsak: null,
    normStatus: null,
    datoer: [],
  };
  const { dag, sluttIso, regel } = input;

  // Ingen prosjekt/aktivitet-katalog → kildeManglet (som før; anvend → startSheetId null).
  if (input.prosjekter.length === 0) return tomt;
  if (input.aktiviteter.length === 0) return tomt;

  // 1. Prosjektvalg (§2): destinasjonens prosjekt (A5) → arbeiderens aktive
  //    prosjekt → prosjektUkjent. 🔴 `prosjekter[0]`-fallbacken (H1 stille feil)
  //    og `velgNaermesteProsjekt` (nærmeste-uten-grense) er fjernet.
  const destinasjonAarsak =
    input.reiseOppslag?.destinasjon.type === "ukjent"
      ? input.reiseOppslag.destinasjon.aarsak
      : null;
  const prosjektId = input.destinasjonProsjektId ?? input.aktivtProsjektId;
  if (prosjektId == null) {
    // Dagen holdes åpen; meldingen navngir veien ut (velg prosjekt, prøv igjen).
    return { ...tomt, prosjektUkjent: true, destinasjonAarsak };
  }

  // 2. Aktivitet — default «Anleggsarbeid» eller første.
  const aktivitet =
    input.aktiviteter.find((a) => a.navn === "Anleggsarbeid") ??
    input.aktiviteter[0]!;

  // 3. Reise-etapper (B1): ut + retur, klassifisert pr. etappe (V10). Kun
  //    reisetid-etapper trekker vinduet og gir reise-rad; arbeidstid-etapper
  //    (V3) teller som arbeid og ligger i prosjektraden.
  let etapper: Etappe[] = [];
  let reiseAarsak: ReiseAarsak | null = null;
  const reiseOppslag = input.reiseOppslag;
  if (regel && reiseOppslag) {
    const r = beregnReiseEtapper(
      reiseOppslag.start,
      reiseOppslag.slutt,
      reiseOppslag.destinasjon,
      reiseOppslag.utCelle,
      reiseOppslag.returCelle,
      regel,
    );
    etapper = r.etapper;
    reiseAarsak = r.aarsak;
  }
  // Løs lønnsart pr. reisetid-etappe (samme kilde som før: avstandsbånd →
  // fallbackReiseLonnsartId). Uten lønnsart → ingen reise-rad, ingen vindu-trekk.
  const reiseForRetning = (
    retning: "ut" | "retur",
  ): { kjoretidMin: number; lonnsartId: string } | null => {
    if (!reiseOppslag) return null;
    const e = etapper.find(
      (x) => x.retning === retning && x.kategori === "reisetid",
    );
    if (!e) return null;
    const lonnsartId = løsReiseLonnsartId(
      e.avstandM,
      reiseOppslag.grensepunkter,
      reiseOppslag.fallbackReiseLonnsartId,
    );
    return lonnsartId ? { kjoretidMin: e.kjoretidMin, lonnsartId } : null;
  };
  const utReise = reiseForRetning("ut");
  const returReise = reiseForRetning("retur");

  // 4. UF-2: enkelt-skift-cap FØR midnatt-splitt. Glemt-dag-kapplengde =
  //    ut-reise + dagsnorm + pause (M13 → B2): kappet skal romme reisen og
  //    pausen, ikke bare normen.
  const startDato = formatIsoDato(new Date(dag.startAt));
  const effektivStartDag = input.effektivPerDato[startDato];
  if (!effektivStartDag) return tomt;
  const normForKapp =
    effektivStartDag.dagsnorm > 0 ? effektivStartDag.dagsnorm : 7.5;
  const kappLengdeTimer =
    (utReise ? utReise.kjoretidMin / 60 : 0) +
    normForKapp +
    effektivStartDag.pauseMin / 60;
  const { sluttIso: effektivSluttIso, kappet } = kappGlemtDagSlutt(
    dag.startAt,
    sluttIso,
    { deteksjonsTimer: MAKS_ENKELTSKIFT_TIMER, kappLengdeTimer },
  );
  const effektivSisteKilde: "bruker" | "system" = kappet
    ? "system"
    : input.sisteSegmentKilde;

  // Midnatt-splitt (Slice 4a): én dagsseddel per kalenderdag. KUN pausen fordeles
  // over segmentene (reisen er ikke lenger et fradrag — B2).
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);
  const deltVedMidnatt = segmenter.length > 1;
  const bruttoPerSeg = segmenter.map(
    (s) =>
      (new Date(s.sluttIso).getTime() - new Date(s.startIso).getTime()) /
      3_600_000,
  );
  const pauseFordelt = fordelPause(
    bruttoPerSeg,
    effektivStartDag.pauseMin,
  ).pauseMin;

  // F4: byggeplass-default-kjede → GPS (arbeidsdag) → global kontekst → ingen.
  // D2: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt.
  const byggeplassDefault =
    dag.byggeplassId ??
    (prosjektId === input.aktivtProsjektId ? input.kontekstByggeplassId : null);

  const sisteIdx = segmenter.length - 1;
  const datoer = segmenter.map((seg, i) => {
    const erSiste = i === sisteIdx;
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
      prosjektId,
      aktivitetId: aktivitet.id,
      byggeplassId: byggeplassDefault,
      pauseMin: pauseFordelt[i]!,
      // Ut-etappen hører til start-segmentet, retur-etappen til slutt-segmentet.
      utReise: seg.erStartSegment ? utReise : null,
      returReise: erSiste ? returReise : null,
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
    prosjektId,
    aktivitetId: aktivitet.id,
    kappet,
    prosjektUkjent: false,
    reiseAarsak,
    destinasjonAarsak,
    normStatus: effektivStartDag.normStatus ?? null,
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
  /** Ut-reise (reisetid) på start-segmentet — forskyver arbeidsstart + egen rad. null ellers. */
  utReise: { kjoretidMin: number; lonnsartId: string } | null;
  /** Retur-reise (reisetid) på slutt-segmentet — forskyver arbeidsslutt + egen rad. null ellers. */
  returReise: { kjoretidMin: number; lonnsartId: string } | null;
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

  // B2 — arbeidsvinduet er ENESTE trekkmekanisme. Ut-etappen (reisetid) skyver
  // arbeidsstart fram fra start-GPS; retur-etappen skyver arbeidsslutt tilbake
  // fra slutt-GPS. Reisen trekkes dermed via vinduet, ikke via timene — det gamle
  // `totalTimer − reisetidTimer` er FJERNET (ville trukket reisen to ganger med
  // etapper i begge ender).
  const utMs = (a.utReise ? a.utReise.kjoretidMin : 0) * 60_000;
  const returMs = (a.returReise ? a.returReise.kjoretidMin : 0) * 60_000;
  const arbeidsstartMs = new Date(segment.startIso).getTime() + utMs;
  const arbeidssluttMs = new Date(segment.sluttIso).getTime() - returMs;
  const arbeidsstartIso = new Date(arbeidsstartMs).toISOString();
  const bruttoVinduTimer = Math.max(0, (arbeidssluttMs - arbeidsstartMs) / 3_600_000);
  // F-B: rund arbeidstimer til firmaets tidsrunding-grid FØR normaltid/overtid-
  // splitten. Reise rundes ikke.
  const raaArbeid =
    Math.round(Math.max(0, bruttoVinduTimer - a.pauseMin / 60) * 100) / 100;
  const arbeidstimer = rundTimerTilNarmeste(raaArbeid, a.tidsrundingMinutter);

  const rader: DagsforslagRad[] = [];
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];
  const eksisterendeTidsrom = eksisterende.eksisterendeRader;

  // Auto-fordeling normaltid/overtid (per dag). Overtid velges strukturert på
  // overtidsnivaa — ALDRI fritekst-navn (③a).
  if (arbeidstimer > 0) {
    const effektivDagsnorm = a.effektiv?.dagsnorm ?? 0;
    // V1: reisetid er ALDRI overtid. Normen er alltid `dagsnorm0` — det gamle
    // `reisetidTellerOvertid`-fradraget i terskelen er fjernet (flagget leses ikke).
    const dagsnorm = effektivDagsnorm > 0 ? effektivDagsnorm : arbeidstimer;

    const pauseEtterTimer =
      a.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
    // Carve fra ARBEIDSSTART (etter ut-etappen), ikke segment-GPS-start.
    // reisetidTimer=0: vinduet har alt ekskludert reisen (B2).
    const arbeidsstartHHMM = tilHHMM(arbeidsstartIso);
    // B3 (V6): pausevinduet. "fastStart" → fra firmaets sesongjusterte starttid;
    // "ankomst" (default) → fra arbeidsstart (etter reisen) — legger aldri pausen
    // i en reise.
    const pauseFraTid =
      a.effektiv?.pauseReferanse === "fastStart"
        ? (a.effektiv?.startTid ?? arbeidsstartHHMM)
        : arbeidsstartHHMM;
    const carvet = carveArbeidstider({
      startTid: arbeidsstartHHMM,
      reisetidTimer: 0,
      pauseFra: pauseVinduFra(pauseFraTid, pauseEtterTimer),
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

  // Reise-rader (B4) — én rad pr. reisetid-etappe på dette segmentet (ut på
  // start, retur på slutt). 🔴 `fraTid/tilTid` forblir `null` (V8 er lag 2 —
  // ikke fabrikker et klokke-vindu her). `timer` = etappens kjøretid.
  for (const r of [a.utReise, a.returReise]) {
    if (!r) continue;
    rader.push({
      projectId: a.prosjektId,
      lonnsartId: r.lonnsartId,
      aktivitetId: a.aktivitetId,
      timer: Math.round((r.kjoretidMin / 60) * 100) / 100,
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
  /**
   * §2: forslaget kunne ikke velge prosjekt (A5 ga ingen destinasjon + ingen
   * aktivtProsjektId). Skiller `prosjektUkjent`-handlingen fra `kildeManglet`
   * (begge har `startSheetId == null`).
   */
  prosjektUkjent: boolean;
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
  | { type: "kildeManglet" }
  | { type: "prosjektUkjent" };

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
  if (sheetId == null) {
    // §2: prosjektet kunne ikke velges → egen melding («velg prosjekt, prøv
    // igjen»). Ellers manglet db/aktivitet-katalogen → kildeManglet. Begge
    // holder dagen åpen.
    return resultat.prosjektUkjent
      ? { type: "prosjektUkjent" }
      : { type: "kildeManglet" };
  }
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
