import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Play, Square, Clock, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  arbeidsdagLocal,
  dagsseddelLocal,
  sheetTimerLocal,
  aktivitetLocal,
  lonnsartLocal,
} from "../db/schema";
import { useAuth } from "../providers/AuthProvider";
import { useFirma } from "../kontekst/FirmaKontekst";
import { useProsjekt } from "../kontekst/ProsjektKontekst";
import { useByggeplass } from "../kontekst/ByggeplassKontekst";
import { useTimerSync } from "../providers/TimerSyncProvider";
import {
  avstandMeter,
  estimerReisetidMin,
  klassifiserReise,
  klassifiserArbeidstid,
  velgOvertidLonnsart,
  carveArbeidstider,
  pauseVinduFra,
  pauseMinForDag,
  DEFAULT_PAUSE_ETTER_TIMER,
  type ReiseKategori,
} from "@sitedoc/shared";
import { haversineKm } from "../utils/geo";
import { rundTimerTilNarmeste } from "../utils/tidsrunding";
import {
  splittVedMidnatt,
  kappGlemtDagSlutt,
  type Dagsegment,
} from "../utils/dagsegment";
import {
  useArbeidsdag,
  formatIsoDato,
  tilHHMM,
  fangGps,
  type AktivDag,
} from "../hooks/useArbeidsdag";
import { hentProsjekterLokalt } from "../services/prosjektKatalog";
import { hentEffektivArbeidstidLokal } from "../services/kalenderKatalog";
import { finnEllerOpprettDagsseddel } from "../services/dagsseddelOpprett";
import {
  hentStandardLonnsartLokalt,
  hentReiseLonnsartId,
} from "../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../services/organizationSettingKatalog";
import {
  hentMatriseRadLokalt,
  resolverPrimaerByggeplass,
} from "../services/reisetidMatriseKatalog";

export function StartSluttDagKort() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();
  // F4: timer-utkast defaulter byggeplass GPS → global kontekst → ingen.
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  // Start-dag + aktivDag-lesing deles med hjem-chippen via useArbeidsdag —
  // ingen duplisert GPS/Drizzle-logikk. Kortet eier fortsatt «Slutt dag»/
  // genererForslag/glemt-dag (under).
  const { aktivDag, startDag, behandler, setBehandler, refresh } =
    useArbeidsdag();
  const [naa, setNaa] = useState<number>(Date.now());
  // Lag 2: arbeider har bekreftet «jeg jobber fortsatt» på en gammel åpen dag
  // → skjul glemt-dag-prompten for denne økten og vis normal «Slutt dag».
  const [jobberFortsatt, setJobberFortsatt] = useState(false);

  // Tikk forløpt-tid hvert minutt mens dagen pågår.
  useEffect(() => {
    if (!aktivDag) return;
    setNaa(Date.now());
    const id = setInterval(() => setNaa(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [aktivDag]);

  const utforSluttDag = useCallback(
    async (
      overstyrtSluttIso?: string,
      sisteSegmentKilde: "bruker" | "system" = "bruker",
    ) => {
    if (!aktivDag || !bruker?.id || behandler) return;
    setBehandler(true);
    try {
      // Lag 2 (gjenoppretting av glemt dag): bruk estimert slutt-tid og IKKE
      // GPS-ved-slutt — arbeider er ikke nødvendigvis på stedet nå.
      const { lat, lng } = overstyrtSluttIso
        ? { lat: null as number | null, lng: null as number | null }
        : await fangGps();
      const db = hentDatabase();
      if (!db) return;
      const sluttIso = overstyrtSluttIso ?? new Date().toISOString();
      const forslag = genererForslag(
        bruker.id,
        valgtFirmaId ?? "",
        aktivDag,
        sluttIso,
        lat,
        lng,
        valgtBygningId,
        valgtProsjektId,
        sisteSegmentKilde,
      );
      const dagsseddelId = forslag.id;
      db.update(arbeidsdagLocal)
        .set({
          endAt: sluttIso,
          endLat: lat,
          endLng: lng,
          status: "avsluttet",
          generertDagsseddelId: dagsseddelId,
          sistEndretLokalt: Date.now(),
        })
        .where(eq(arbeidsdagLocal.id, aktivDag.id))
        .run();
      // Re-les fra DB (status nå "avsluttet" → aktivDag blir null i hooken).
      refresh();
      oppdaterTellere();
      void triggerSync();
      if (dagsseddelId) {
        router.push(`/timer/${dagsseddelId}`);
        // UF-1: dagens sedel var alt sendt → den nye økten ble ikke lagt til.
        if (forslag.blokkertSendt) {
          Alert.alert(
            t("timer.appendSendt.tittel"),
            t("timer.appendSendt.melding"),
          );
        } else if (forslag.ingenRader) {
          // F-c: økta førte 0 rader (for kort etter pause/runding) — gi
          // tilbakemelding i stedet for et stille tomt dagskort.
          // F-g: differensier copy — når sedelen alt HAR rader er «dagen ble
          // for kort» misvisende (dagen er ikke tom); vis pre-fylt-varianten.
          const preFylt = forslag.harEksisterendeRader;
          Alert.alert(
            t(preFylt ? "timer.forKort.preFyltTittel" : "timer.forKort.tittel"),
            t(preFylt ? "timer.forKort.preFyltMelding" : "timer.forKort.melding"),
          );
        }
      } else {
        // Kunne ikke utlede prosjekt/aktivitet offline → manuell opprettelse.
        router.push("/timer/ny");
      }
    } finally {
      setBehandler(false);
    }
  }, [aktivDag, bruker?.id, valgtFirmaId, valgtBygningId, valgtProsjektId, behandler, router, oppdaterTellere, triggerSync, t, refresh, setBehandler]);

  // Bekreft før avslutning — «Slutt dag» er irreversibel og genererer et
  // dagsseddel-forslag umiddelbart. Vis forløpt tid så brukeren ser hva som
  // registreres før de bekrefter.
  const bekreftSlutt = useCallback(() => {
    if (!aktivDag || behandler) return;
    const diffMin = Math.max(0, Math.floor((Date.now() - new Date(aktivDag.startAt).getTime()) / 60_000));
    const forlopt = `${String(Math.floor(diffMin / 60)).padStart(2, "0")}t ${String(diffMin % 60).padStart(2, "0")}m`;
    Alert.alert(
      t("timer.startDag.bekreftTittel"),
      t("timer.startDag.bekreftMelding", { start: tilHHMM(aktivDag.startAt), forlopt }),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        { text: t("timer.startDag.bekreftAvslutt"), style: "destructive", onPress: () => { void utforSluttDag(); } },
      ],
    );
  }, [aktivDag, behandler, t, utforSluttDag]);

  // Lag 2 (glemt dag): gjenoppretting — estimer slutt-tid og generer draft
  // arbeider kan korrigere. Slutt merkes sluttTidKilde="system" → kontroll-badge
  // i attestering (tiden er gjettet, ikke bekreftet).
  const gjenopprettGlemtDag = useCallback(() => {
    if (!aktivDag || behandler) return;
    const startDato = formatIsoDato(new Date(aktivDag.startAt));
    const effektiv = hentEffektivArbeidstidLokal(
      valgtFirmaId ?? "",
      new Date(`${startDato}T00:00:00`),
    );
    const start = new Date(aktivDag.startAt);
    const [tt, mm] = effektiv.sluttTid.split(":").map(Number);
    let slutt = new Date(start);
    slutt.setHours(tt, mm, 0, 0);
    // Nattskift-edge (4b-2): standardSluttTid ligger før start-klokkeslettet →
    // 0/negativ varighet. Estimer i stedet start + dagsnorm (krysser evt.
    // midnatt → 4a-splitt håndterer det). Arbeider korrigerer uansett.
    if (slutt.getTime() <= start.getTime()) {
      const dagsnormTimer = effektiv.dagsnorm > 0 ? effektiv.dagsnorm : 7.5;
      slutt = new Date(start.getTime() + dagsnormTimer * 3_600_000);
    }
    void utforSluttDag(slutt.toISOString(), "system");
  }, [aktivDag, behandler, valgtFirmaId, utforSluttDag]);

  if (!bruker?.id) return null;

  // Inaktiv — «Start dag»
  if (!aktivDag) {
    return (
      <Pressable
        onPress={startDag}
        disabled={behandler}
        className="mx-4 mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-4 active:bg-blue-700 disabled:opacity-50"
      >
        {behandler ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Play size={18} color="#ffffff" fill="#ffffff" />
        )}
        <Text className="text-base font-semibold text-white">
          {t("timer.startDag.start")}
        </Text>
      </Pressable>
    );
  }

  // Lag 2: gammel åpen dag (startet før i dag) + ikke bekreftet «jobber fortsatt»
  // → glemt-dag-prompt i stedet for normal «Slutt dag». Adresserer glemt «Slutt
  // dag» (BUG-1) + 4a over-splitt av fler-døgns økt.
  const startDato = formatIsoDato(new Date(aktivDag.startAt));
  if (startDato < formatIsoDato(new Date()) && !jobberFortsatt) {
    return (
      <View className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <View className="flex-row items-center gap-2">
          <AlertTriangle size={16} color="#b45309" />
          <Text className="flex-1 text-sm font-semibold text-amber-900">
            {t("timer.glemtDag.tittel")}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-amber-800">
          {t("timer.glemtDag.melding", { dato: startDato })}
        </Text>
        <View className="mt-3 gap-2">
          <Pressable
            onPress={() => gjenopprettGlemtDag()}
            disabled={behandler}
            className="flex-row items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 active:bg-amber-700 disabled:opacity-50"
          >
            {behandler ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Square size={16} color="#ffffff" fill="#ffffff" />
            )}
            <Text className="text-base font-semibold text-white">
              {t("timer.glemtDag.glemte")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setJobberFortsatt(true)}
            disabled={behandler}
            className="flex-row items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white py-3 active:bg-amber-100 disabled:opacity-50"
          >
            <Clock size={16} color="#b45309" />
            <Text className="text-base font-medium text-amber-800">
              {t("timer.glemtDag.jobberFortsatt")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Aktiv — «Pågår siden 07:02 · 03t 14m» + «Slutt dag»
  const startMs = new Date(aktivDag.startAt).getTime();
  const diffMin = Math.max(0, Math.floor((naa - startMs) / 60_000));
  const forlopt = `${String(Math.floor(diffMin / 60)).padStart(2, "0")}t ${String(diffMin % 60).padStart(2, "0")}m`;

  return (
    <View className="mx-4 mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
      <View className="flex-row items-center gap-2">
        <Clock size={16} color="#10b981" />
        <Text className="flex-1 text-sm font-medium text-green-800">
          {t("timer.startDag.status", {
            start: tilHHMM(aktivDag.startAt),
            forlopt,
          })}
        </Text>
      </View>
      {aktivDag.oppmotestedNavn ? (
        <Text className="mt-1 pl-6 text-xs text-green-700">
          {t("timer.startDag.startetPaa", { sted: aktivDag.oppmotestedNavn })}
        </Text>
      ) : null}
      <Pressable
        onPress={bekreftSlutt}
        disabled={behandler}
        className="mt-3 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 active:bg-red-700 disabled:opacity-50"
      >
        {behandler ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Square size={16} color="#ffffff" fill="#ffffff" />
        )}
        <Text className="text-base font-semibold text-white">
          {t("timer.startDag.slutt")}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * UF-2 trinn 8 — hard enkelt-skift-cap (timer). Spenn over dette tolkes som
 * glemt avslutning og kappes (se `kappGlemtDagSlutt`). Konstant inntil videre;
 * å gjøre den til en firma-setting (AML/tariff per firma) krever server +
 * migrering → egen runde.
 */
const MAKS_ENKELTSKIFT_TIMER = 16;

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
function fordelArbeidstidFradrag(
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
    const ta = Math.min(restReise, kapasitet[i]);
    reisePer[i] += ta;
    kapasitet[i] -= ta;
    restReise -= ta;
  }

  // 2) Pause: lengste-først, i kapasiteten som er igjen etter reise. Bruker den
  // terskel-gatede pausen (0 når dagen < 5,5t).
  let restPauseTimer = Math.max(0, effektivPauseTotalMin) / 60;
  for (const i of lengsteForst) {
    if (restPauseTimer <= 0) break;
    const ta = Math.min(restPauseTimer, kapasitet[i]);
    pauseTimerPer[i] += ta;
    kapasitet[i] -= ta;
    restPauseTimer -= ta;
  }

  return {
    pauseMin: pauseTimerPer.map((t) => Math.round(t * 60)),
    reisetidTimer: reisePer.map((t) => Math.round(t * 100) / 100),
  };
}

/**
 * Generer dagsseddel-forslag fra en avsluttet arbeidsdag-økt.
 * Returnerer **start-dagens** dagsseddel-id (for navigering), eller null hvis
 * prosjekt/aktivitet ikke kan utledes offline (kaller da manuell opprettelse).
 *
 * Slice 4a: en økt som krysser midnatt deles i én dagsseddel per kalenderdag
 * (`splittVedMidnatt`); timene summerer til reell total. Reise + firma-pause
 * føres KUN på start-dagen (vedtatt 2026-06-20). Per dag gjelder dagens
 * auto-fordeling: Timelønn (firma-default, Variant B `erStandardvalg`) opp til
 * dagsnorm + «Overtid 50%» (navne-match) for overskytende. Prosjekt = nærmeste
 * via Haversine (start-GPS, ellers slutt-GPS).
 */
function genererForslag(
  userId: string,
  orgId: string,
  dag: AktivDag,
  sluttIso: string,
  endLat: number | null,
  endLng: number | null,
  // F4: global aktiv byggeplass + aktivt prosjekt (for D2-match-sjekk).
  kontekstByggeplassId: string | null,
  aktivtProsjektId: string | null,
  // Slice 4b-2: kilde for SISTE segments slutt-tid. Normal «Slutt dag» = "bruker"
  // (arbeider-handling); glemt-dag-gjenoppretting = "system" (estimert/gjettet).
  // Ikke-siste segmenter får alltid "midnatt" (automatisk dag-grense).
  sisteSegmentKilde: "bruker" | "system" = "bruker",
): {
  id: string | null;
  blokkertSendt: boolean;
  ingenRader: boolean;
  harEksisterendeRader: boolean;
} {
  const db = hentDatabase();
  if (!db) return { id: null, blokkertSendt: false, ingenRader: false, harEksisterendeRader: false };

  // 1. Prosjekt via Haversine.
  const prosjekter = hentProsjekterLokalt(orgId);
  if (prosjekter.length === 0) return { id: null, blokkertSendt: false, ingenRader: false, harEksisterendeRader: false };
  const lat = dag.startLat ?? endLat;
  const lng = dag.startLng ?? endLng;
  let valgtProsjekt = prosjekter[0];
  if (lat != null && lng != null) {
    const medKoord = prosjekter.filter((p) => p.lat != null && p.lng != null);
    let besteAvstand = Infinity;
    for (const p of medKoord) {
      const km = haversineKm(lat, lng, p.lat as number, p.lng as number);
      if (km < besteAvstand) {
        besteAvstand = km;
        valgtProsjekt = p;
      }
    }
  }

  // 2. Aktivitet — default «Anleggsarbeid» eller første.
  const aktiviteter = db
    .select()
    .from(aktivitetLocal)
    .where(eq(aktivitetLocal.aktiv, true))
    .all();
  if (aktiviteter.length === 0) return { id: null, blokkertSendt: false, ingenRader: false, harEksisterendeRader: false };
  const aktivitet =
    aktiviteter.find((a) => a.navn === "Anleggsarbeid") ?? aktiviteter[0];

  // 3. Reise-forslag (føres på START-dagen). Fase 3 (§ B) + R4: KUN når
  // oppmøtested ble identifisert ved start (kontor→byggeplass — hjem→arbeidssted
  // kompenseres ikke). Reisetid = matrise-kjøretid (kontor→prosjektets primær-
  // byggeplass; autoritativ, end-uavhengig). kjoretidMin < 0 = uoppnåelig →
  // ingen forslag. Ingen matrise-rad/byggeplass → graceful estimat-fallback
  // (GPS-distanse start→slutt). Klassifiseres mot terskel; 'reisetid' → egen
  // lønnsart-rad. Aldri auto-rad uten innsyn — havner i draft som forslag.
  const regel = hentOrganizationSettingLokalt(orgId);
  let reisetidTimer = 0;
  let reiseLonnsartId: string | null = null;
  if (dag.oppmotestedId && regel) {
    let reisetidMin: number | null = null;
    const byggeplassId = resolverPrimaerByggeplass(
      valgtProsjekt.id,
      dag.oppmotestedId,
    );
    if (byggeplassId) {
      const rad = hentMatriseRadLokalt(dag.oppmotestedId, byggeplassId);
      // -1 (uoppnåelig) → 0: ingen forslag, OG hopp over estimat-fallback.
      if (rad) reisetidMin = rad.kjoretidMin < 0 ? 0 : rad.kjoretidMin;
    }
    // Fallback kun når matrisen ikke ga svar (ingen rad/byggeplass).
    if (
      reisetidMin == null &&
      dag.startLat != null &&
      dag.startLng != null &&
      endLat != null &&
      endLng != null
    ) {
      reisetidMin = estimerReisetidMin(
        avstandMeter(
          { lat: dag.startLat, lng: dag.startLng },
          { lat: endLat, lng: endLng },
        ),
      );
    }
    if (reisetidMin != null && reisetidMin > 0) {
      const kategori: ReiseKategori = klassifiserReise(reisetidMin, {
        reiseTerskelMin: regel.reiseTerskelMin,
        reiseUnderTerskelType: regel.reiseUnderTerskelType as ReiseKategori,
        reiseOverTerskelType: regel.reiseOverTerskelType as ReiseKategori,
      });
      if (kategori === "reisetid") {
        // Resolver reise-lønnsart via delt helper — samme kilde som render-
        // laget bruker for reise-merking, så generering og visning aldri
        // drifter fra hverandre (reiseLonnsartId ellers navne-match).
        reiseLonnsartId = hentReiseLonnsartId(orgId);
        // Bare foreslå reisetid hvis vi faktisk har en art å føre den på.
        if (reiseLonnsartId) {
          reisetidTimer = Math.round((reisetidMin / 60) * 100) / 100;
        }
      }
    }
  }

  // 4. UF-2: universell enkelt-skift-cap FØR midnatt-splitt. Er spennet (start→
  // slutt) større enn hard-cap (trinn 8), tolkes det som glemt avslutning og
  // slutt kappes til start + sesongjustert dagsnorm (trinn 7) → unngår N×24t-
  // sedler. Kilde tvinges til "system" (gjettet → kontroll-badge). Et legitimt
  // nattskift (< cap) slipper urørt gjennom. Recovery-banen estimerer alt en
  // kort slutt → passerer uberørt (ingen dobbel-kapp).
  const effektivStartDag = hentEffektivArbeidstidLokal(
    orgId,
    new Date(`${formatIsoDato(new Date(dag.startAt))}T00:00:00`),
  );
  const kappLengdeTimer =
    effektivStartDag.dagsnorm > 0 ? effektivStartDag.dagsnorm : 7.5;
  const { sluttIso: effektivSluttIso, kappet } = kappGlemtDagSlutt(
    dag.startAt,
    sluttIso,
    { deteksjonsTimer: MAKS_ENKELTSKIFT_TIMER, kappLengdeTimer },
  );
  const effektivSisteKilde: "bruker" | "system" = kappet
    ? "system"
    : sisteSegmentKilde;

  // Midnatt-splitt (Slice 4a): én dagsseddel per kalenderdag. Normalt ett
  // segment (dagskift); kryssende skift → flere. Pause + reise fordeles over
  // segmentene (pause→lengste, reise→start m/ overflyt — se
  // fordelArbeidstidFradrag), ikke lenger blindt på start-segmentet. Returner
  // start-dagens sedel for navigering.
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);
  const deltVedMidnatt = segmenter.length > 1;
  // Glemt-dag 0-fiks (c): fordel pause + reise over segmentene (pause→lengste,
  // reise→start m/ overflyt) så et kort start-segment aldri klampes til 0.
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
  // D2: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt (timer er
  // firma-scopet; et utkast på et annet prosjekt skal ikke arve feil byggeplass).
  const byggeplassDefault =
    dag.byggeplassId ??
    (valgtProsjekt.id === aktivtProsjektId ? kontekstByggeplassId : null);
  let startSheetId: string | null = null;
  let blokkertSendt = false;
  let totalRader = 0;
  let harEksisterendeRader = false;
  segmenter.forEach((seg, i) => {
    // Ikke-siste segment ender på en automatisk midnatt-grense → "midnatt".
    // Siste segment ender på den faktiske/estimerte slutt-tiden → sisteSegmentKilde.
    const erSiste = i === segmenter.length - 1;
    const res = opprettDagsseddelForSegment({
      userId,
      orgId,
      segment: seg,
      prosjektId: valgtProsjekt.id,
      aktivitetId: aktivitet.id,
      // L1/F4: samme byggeplass-default (GPS → kontekst → ingen) på alle midnatt-
      // segmenter (én arbeidsdag = én byggeplass). Idempotens i helperen sikrer
      // at kun NY draft får verdien; per-sedel-velger kan overstyre etterpå.
      byggeplassId: byggeplassDefault,
      // F-B: firmaets tidsrunding-grid for auto-rad-runding (regel fra org-setting).
      tidsrundingMinutter: regel?.tidsrundingMinutter ?? null,
      // (c): fordelt pause + reise per segment (pause→lengste, reise→start
      // m/ overflyt) — aldri hele-dags-fradrag på et kort start-segment.
      pauseMin: fradrag.pauseMin[i],
      reisetidTimer: fradrag.reisetidTimer[i],
      reiseLonnsartId,
      reisetidTellerOvertid: regel?.reisetidTellerOvertid ?? false,
      deltVedMidnatt,
      sluttTidKilde: erSiste ? effektivSisteKilde : "midnatt",
    });
    if (res?.utfall === "blokkertSendt") blokkertSendt = true;
    if (seg.erStartSegment) startSheetId = res?.id ?? null;
    totalRader += res?.raderOpprettet ?? 0;
    if (res?.haddeEksisterendeRader) harEksisterendeRader = true;
  });
  return {
    id: startSheetId,
    blokkertSendt,
    ingenRader: totalRader === 0,
    // F-g: skiller pre-fylt sedel (økta bidro 0) fra reelt tom sedel.
    harEksisterendeRader,
  };
}

/**
 * Opprett én dagsseddel (draft) for ett dag-segment + dens timer-rader.
 *
 * Sedel-opprettelsen (find-or-create + idempotens per `(userId, dato)` +
 * org-backfill) deles med `ny.tsx` via `finnEllerOpprettDagsseddel` (UF-0).
 * Server håndhever `@@unique([userId, dato])` på `DailySheet`.
 *
 * UF-1 (multi-økt-append): finnes dagen alt som **redigerbar draft/returned**
 * → denne øktens rader **appendes** på samme sedel + arbeidstid-vinduet utvides
 * til å dekke økten. Er sedelen alt **sendt/godkjent** → ingen append (ville gi
 * server-konflikt); returneres som `blokkertSendt` så UI kan varsle (recall er
 * UF-4, egen server-runde).
 */
type SegmentUtfall = "opprettet" | "appendet" | "blokkertSendt";

function opprettDagsseddelForSegment(args: {
  userId: string;
  orgId: string;
  segment: Dagsegment;
  prosjektId: string;
  aktivitetId: string;
  /** L1: GPS-fanget byggeplass på arbeidsdagen — kopieres inn på NY draft. */
  byggeplassId: string | null;
  pauseMin: number;
  reisetidTimer: number;
  reiseLonnsartId: string | null;
  reisetidTellerOvertid: boolean;
  deltVedMidnatt: boolean;
  sluttTidKilde: "bruker" | "midnatt" | "system";
  /** F-B: firmaets tidsrunding-grid (15/30/60 min) — null = ingen runding. */
  tidsrundingMinutter: number | null;
}): {
  id: string;
  utfall: SegmentUtfall;
  raderOpprettet: number;
  haddeEksisterendeRader: boolean;
} | null {
  const {
    userId,
    orgId,
    segment,
    prosjektId,
    aktivitetId,
    byggeplassId,
    pauseMin,
    reisetidTimer,
    reiseLonnsartId,
    reisetidTellerOvertid,
    deltVedMidnatt,
    sluttTidKilde,
    tidsrundingMinutter,
  } = args;
  const db = hentDatabase();
  if (!db) return null;

  // UF-0/UF-1: sedel-opprettelse + idempotens via delt helper (org-backfill
  // følger med).
  const resultat = finnEllerOpprettDagsseddel(db, {
    userId,
    orgId,
    dato: segment.dato,
    prosjektId,
    aktivitetId,
    byggeplassId,
    startAt: segment.startIso,
    endAt: segment.sluttIso,
    pauseMin,
    autoGenerert: true,
    deltVedMidnatt,
    sluttTidKilde,
  });
  const sheetId = resultat.id;

  // F-g: hadde sedelen alt registreringer FØR denne økta? Brukes til å skille
  // «reelt tom sedel» fra «pre-fylt sedel der økta bidro 0 rader» i «for kort»-
  // meldingen (som ellers fyrer misvisende på en sedel full av rader).
  let haddeEksisterendeRader = false;

  // UF-1: dagen finnes alt.
  if (resultat.eksisterte) {
    if (resultat.status !== "draft" && resultat.status !== "returned") {
      // Sendt/godkjent → kan ikke appende ny økt (ville gi server-konflikt).
      // Recall er UF-4 (egen server-runde).
      return {
        id: sheetId,
        utfall: "blokkertSendt",
        raderOpprettet: 0,
        haddeEksisterendeRader: false,
      };
    }
    haddeEksisterendeRader =
      db
        .select({ id: sheetTimerLocal.id })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
        .all().length > 0;
    // Redigerbar draft/returned → append: utvid arbeidstid-vinduet til å dekke
    // den nye økten. Rad-genereringen under bruker sheetId → appender rader.
    utvidArbeidstidsvindu(
      db,
      sheetId,
      segment.startIso,
      segment.sluttIso,
      sluttTidKilde,
    );
  }

  // Nyopprettet eller append → generer (og append) denne øktens rader.
  // Arbeidstid = segment-brutto − pause/reise (fordelt per segment, jf.
  // fordelArbeidstidFradrag — pause→lengste, reise→start m/ overflyt).
  const bruttoTimer =
    (new Date(segment.sluttIso).getTime() -
      new Date(segment.startIso).getTime()) /
    3_600_000;
  const totalTimer =
    Math.round(Math.max(0, bruttoTimer - pauseMin / 60) * 100) / 100;
  // Arbeidstimer til normaltid/overtid = total minus reise-andelen (reise føres
  // på egen rad). Unngår dobbelttelling av brutto-tiden.
  // F-B: rund arbeidstimer til firmaets tidsrunding-grid (15 min = 0.25 t) FØR
  // normaltid/overtid-splitten — auto-rader hadde rå varighet (6.10/8.24 t).
  // null = ingen runding konfigurert → behold 2-desimal. Reise rundes ikke.
  const raaArbeid = Math.round(Math.max(0, totalTimer - reisetidTimer) * 100) / 100;
  const arbeidstimer = rundTimerTilNarmeste(raaArbeid, tidsrundingMinutter);

  const effektiv = hentEffektivArbeidstidLokal(
    orgId,
    new Date(`${segment.dato}T00:00:00`),
  );

  // F-c (fabel-vedtak 2026-07-13): tell rader denne økta faktisk fører (arbeid +
  // reise). 0 rader = økta var for kort til å telle etter pause/runding →
  // kalleren gir arbeideren en melding i stedet for et stille tomt dagskort.
  let raderOpprettet = 0;

  // Auto-fordeling normaltid/overtid (per dag). Klassifiserings-regelen er
  // isolert i @sitedoc/shared lonnsregel.ts (forward-compat Nivå 1-2). Overtid
  // velges strukturert på overtidsnivaa — ALDRI fritekst-navn (③a).
  if (arbeidstimer > 0) {
    const dagsnorm0 = effektiv.dagsnorm > 0 ? effektiv.dagsnorm : arbeidstimer;
    // Fase 3: når reisetid teller mot overtid, spiser reise-andelen av dagsnorm-
    // budsjettet → mer av arbeidstiden havner i overtid. Når false (default) er
    // reise utenfor terskelen og dagsnorm gjelder kun arbeidstimene.
    const dagsnorm =
      reisetidTellerOvertid && reisetidTimer > 0
        ? Math.max(0, dagsnorm0 - reisetidTimer)
        : dagsnorm0;

    const alleLonnsarter = db
      .select()
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.organizationId, orgId))
      .all();
    const standard = hentStandardLonnsartLokalt(orgId);

    // GPS-carve (fabel-vedtak 2026-07-13): tildel FAKTISKE fra/til fra segmentets
    // reelle vindu (delt carveArbeidstider) i stedet for null-tider. Fra/til er nå
    // obligatorisk på timer-rader — auto-utkastet må følge samme regel. Tidene
    // carves fra ekte GPS-start (segment.startIso) + hour-grensene klassifiseringen
    // beregner, aldri fabrikkert. Reise-raden (under) unntas bevisst.
    const orgSetting = hentOrganizationSettingLokalt(orgId);
    const pauseEtterTimer =
      orgSetting?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
    const startTidHHMM = tilHHMM(segment.startIso);
    const carvet = carveArbeidstider({
      startTid: startTidHHMM,
      // Reise forskyver arbeids-start (fordelArbeidstidFradrag legger reise først);
      // reise-raden selv får ingen tid (matrise-mengde, se under).
      reisetidTimer,
      pauseFra: pauseVinduFra(startTidHHMM, pauseEtterTimer),
      pauseMin,
      segmenter: klassifiserArbeidstid({ arbeidstimer, dagsnorm }),
    });
    for (const vindu of carvet) {
      // Normaltid (overtidsnivaa=null) → firmaets standard-lønnsart.
      // Overtid → velg strukturert på overtidsnivaa (type=ordinaer, aktiv).
      const lonnsart =
        vindu.overtidsnivaa === null
          ? standard
          : velgOvertidLonnsart(alleLonnsarter, vindu.overtidsnivaa);
      // ③a/③b: aldri feil-match, aldri stille drop — uten treff hoppes raden
      // over, og [id].tsx viser banner (manglerStandard/manglerOvertidLonnsart).
      if (!lonnsart) continue;
      db.insert(sheetTimerLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: prosjektId,
          lonnsartId: lonnsart.id,
          aktivitetId,
          externalCostObjectId: null,
          timer: vindu.timer,
          fraTid: vindu.fraTid,
          tilTid: vindu.tilTid,
          sistEndretLokalt: Date.now(),
        })
        .run();
      raderOpprettet++;
    }
  }

  // Reise-rad (Fase 3 § B) — separat lønnsart-rad, kun på start-segmentet
  // (reisetidTimer = 0 ellers). Føres på samme prosjekt. Forslag i draft.
  if (reisetidTimer > 0 && reiseLonnsartId) {
    db.insert(sheetTimerLocal)
      .values({
        id: randomUUID(),
        dagsseddelId: sheetId,
        projectId: prosjektId,
        lonnsartId: reiseLonnsartId,
        aktivitetId,
        externalCostObjectId: null,
        timer: reisetidTimer,
        // REISE-UNNTAK (fabel-vedtak 2026-07-13): reise beholder null-tider —
        // BEVISST unntatt fra fra/til-obligatorisk-regelen. Reisetiden er en
        // matrise-/GPS-estimat-MENGDE (hentMatriseRadLokalt / estimerReisetidMin),
        // ikke et målt klokke-vindu; et fabrikkert [start, start+reise] ville vært
        // falske lønnsdata. Reise-rader round-tripper via syncBatch-legacy-veien
        // (unntatt fra server-håndhevingen) — automatisk konsistent. Overlapp-
        // vakten hopper uansett over tid-løse rader (finnOverlappendeTidsrom).
        fraTid: null,
        tilTid: null,
        sistEndretLokalt: Date.now(),
      })
      .run();
    raderOpprettet++;
  }

  return {
    id: sheetId,
    utfall: resultat.eksisterte ? "appendet" : "opprettet",
    raderOpprettet,
    haddeEksisterendeRader,
  };
}

/**
 * UF-1: utvid sedelens arbeidstid-vindu så det dekker en appendet økt.
 * startAt = tidligste, endAt = seneste. Markerer pending for re-sync.
 */
function utvidArbeidstidsvindu(
  db: NonNullable<ReturnType<typeof hentDatabase>>,
  sheetId: string,
  nyStartIso: string,
  nySluttIso: string,
  sluttTidKilde: "bruker" | "midnatt" | "system",
): void {
  const sedel = db
    .select({ startAt: dagsseddelLocal.startAt, endAt: dagsseddelLocal.endAt })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!sedel) return;

  const tidligste =
    sedel.startAt && sedel.startAt < nyStartIso ? sedel.startAt : nyStartIso;
  // F-b (2026-07-13): utvid endAt KUN når slutt-tiden er bruker-BEKREFTET
  // ("bruker"). "system"/"midnatt" er gjettede slutt-tider (glemt-dag / hard-cap
  // / ikke-siste segment) — de skal IKKE skyve «Arbeidstid i dag»-vinduet ut med
  // fabrikkerte tider. Behold da eksisterende endAt (fall til nySluttIso kun når
  // sedelen ennå ikke har en endAt å bevare).
  const seneste =
    sluttTidKilde === "bruker"
      ? sedel.endAt && sedel.endAt > nySluttIso
        ? sedel.endAt
        : nySluttIso
      : (sedel.endAt ?? nySluttIso);

  db.update(dagsseddelLocal)
    .set({
      startAt: tidligste,
      endAt: seneste,
      syncStatus: "pending",
      sistEndretLokalt: Date.now(),
    })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
}
