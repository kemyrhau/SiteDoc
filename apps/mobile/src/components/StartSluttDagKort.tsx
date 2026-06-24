import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Play, Square, Clock, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import * as Location from "expo-location";
import { eq, and, desc } from "drizzle-orm";
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
import { avstandMeter, estimerReisetidMin, klassifiserReise, type ReiseKategori } from "@sitedoc/shared";
import { haversineKm } from "../utils/geo";
import { rundTimerTilNarmeste } from "../utils/tidsrunding";
import {
  splittVedMidnatt,
  kappGlemtDagSlutt,
  type Dagsegment,
} from "../utils/dagsegment";
import { hentProsjekterLokalt } from "../services/prosjektKatalog";
import { hentOppmotederLokalt } from "../services/oppmotestedKatalog";
import { identifiserByggeplass } from "../services/byggeplassKatalog";
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

type AktivDag = {
  id: string;
  startAt: string;
  startLat: number | null;
  startLng: number | null;
  oppmotestedId: string | null;
  oppmotestedNavn: string | null;
  byggeplassId: string | null;
  byggeplassNavn: string | null;
};

/**
 * Fase 1: identifiser hvilket oppmøtested arbeider startet på via GPS.
 * Nærmeste oppmøtested innenfor sin geofence-radius. Returnerer null hvis
 * ingen treff (da brukes prosjekt-deteksjon / manuell flyt som før).
 * KUN dokumentasjon + forslag — aldri lønnsgrunnlag.
 */
function identifiserOppmotested(
  lat: number | null,
  lng: number | null,
  orgId: string,
): { id: string; navn: string } | null {
  if (lat == null || lng == null || !orgId) return null;
  let beste: { id: string; navn: string } | null = null;
  let besteM = Infinity;
  for (const s of hentOppmotederLokalt(orgId)) {
    const meter = haversineKm(lat, lng, s.lat, s.lng) * 1000;
    if (meter <= s.radiusM && meter < besteM) {
      besteM = meter;
      beste = { id: s.id, navn: s.navn };
    }
  }
  return beste;
}

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

async function fangGps(): Promise<{ lat: number | null; lng: number | null }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { lat: null, lng: null };
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { lat: null, lng: null };
  }
}

export function StartSluttDagKort() {
  const { t } = useTranslation();
  const router = useRouter();
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();
  // F4: timer-utkast defaulter byggeplass GPS → global kontekst → ingen.
  const { valgtProsjektId } = useProsjekt();
  const { valgtBygningId } = useByggeplass();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const [aktivDag, setAktivDag] = useState<AktivDag | null>(null);
  const [naa, setNaa] = useState<number>(Date.now());
  const [behandler, setBehandler] = useState(false);
  // Lag 2: arbeider har bekreftet «jeg jobber fortsatt» på en gammel åpen dag
  // → skjul glemt-dag-prompten for denne økten og vis normal «Slutt dag».
  const [jobberFortsatt, setJobberFortsatt] = useState(false);

  // Les pågående arbeidsdag ved montering.
  const lesAktivDag = useCallback(() => {
    if (!bruker?.id) return null;
    const db = hentDatabase();
    if (!db) return null;
    const rad = db
      .select()
      .from(arbeidsdagLocal)
      .where(
        and(
          eq(arbeidsdagLocal.userId, bruker.id),
          eq(arbeidsdagLocal.status, "paagaar"),
        ),
      )
      .orderBy(desc(arbeidsdagLocal.startAt))
      .all()[0];
    return rad
      ? {
          id: rad.id,
          startAt: rad.startAt,
          startLat: rad.startLat,
          startLng: rad.startLng,
          oppmotestedId: rad.oppmotestedId ?? null,
          oppmotestedNavn: rad.oppmotestedNavn ?? null,
          byggeplassId: rad.byggeplassId ?? null,
          byggeplassNavn: rad.byggeplassNavn ?? null,
        }
      : null;
  }, [bruker?.id]);

  useEffect(() => {
    setAktivDag(lesAktivDag());
  }, [lesAktivDag]);

  // Tikk forløpt-tid hvert minutt mens dagen pågår.
  useEffect(() => {
    if (!aktivDag) return;
    setNaa(Date.now());
    const id = setInterval(() => setNaa(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [aktivDag]);

  const startDag = useCallback(async () => {
    if (!bruker?.id || behandler) return;
    setBehandler(true);
    try {
      const { lat, lng } = await fangGps();
      const db = hentDatabase();
      if (!db) return;
      // GPS-identifiser oppmøtested + byggeplass (dokumentasjon + forslag, aldri
      // lønn/reise/prosjektvalg). L1: byggeplass speiler oppmøtested-mønsteret.
      const oppm = identifiserOppmotested(lat, lng, valgtFirmaId ?? "");
      const bygg = identifiserByggeplass(lat, lng, valgtFirmaId ?? "");
      const naaIso = new Date().toISOString();
      const id = randomUUID();
      db.insert(arbeidsdagLocal)
        .values({
          id,
          userId: bruker.id,
          dato: formatIsoDato(new Date()),
          startAt: naaIso,
          startLat: lat,
          startLng: lng,
          endAt: null,
          endLat: null,
          endLng: null,
          status: "paagaar",
          generertDagsseddelId: null,
          oppmotestedId: oppm?.id ?? null,
          oppmotestedNavn: oppm?.navn ?? null,
          byggeplassId: bygg?.id ?? null,
          byggeplassNavn: bygg?.navn ?? null,
          sistEndretLokalt: Date.now(),
        })
        .run();
      setAktivDag({
        id,
        startAt: naaIso,
        startLat: lat,
        startLng: lng,
        oppmotestedId: oppm?.id ?? null,
        oppmotestedNavn: oppm?.navn ?? null,
        byggeplassId: bygg?.id ?? null,
        byggeplassNavn: bygg?.navn ?? null,
      });
    } finally {
      setBehandler(false);
    }
  }, [bruker?.id, behandler, valgtFirmaId]);

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
      setAktivDag(null);
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
        }
      } else {
        // Kunne ikke utlede prosjekt/aktivitet offline → manuell opprettelse.
        router.push("/timer/ny");
      }
    } finally {
      setBehandler(false);
    }
  }, [aktivDag, bruker?.id, valgtFirmaId, valgtBygningId, valgtProsjektId, behandler, router, oppdaterTellere, triggerSync, t]);

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
): { id: string | null; blokkertSendt: boolean } {
  const db = hentDatabase();
  if (!db) return { id: null, blokkertSendt: false };

  // 1. Prosjekt via Haversine.
  const prosjekter = hentProsjekterLokalt(orgId);
  if (prosjekter.length === 0) return { id: null, blokkertSendt: false };
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
  if (aktiviteter.length === 0) return { id: null, blokkertSendt: false };
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
  // segment (dagskift); kryssende skift → flere. Reise + firma-pause kun på
  // start-segmentet. Returner start-dagens sedel for navigering.
  const segmenter = splittVedMidnatt(dag.startAt, effektivSluttIso);
  const deltVedMidnatt = segmenter.length > 1;
  // F4: byggeplass-default-kjede → GPS (arbeidsdag) → global kontekst → ingen.
  // D2: kontekst-fallback kun når utkastets prosjekt = aktivt prosjekt (timer er
  // firma-scopet; et utkast på et annet prosjekt skal ikke arve feil byggeplass).
  const byggeplassDefault =
    dag.byggeplassId ??
    (valgtProsjekt.id === aktivtProsjektId ? kontekstByggeplassId : null);
  let startSheetId: string | null = null;
  let blokkertSendt = false;
  segmenter.forEach((seg, i) => {
    const pauseMin = seg.erStartSegment
      ? hentEffektivArbeidstidLokal(orgId, new Date(`${seg.dato}T00:00:00`))
          .pauseMin
      : 0;
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
      pauseMin,
      reisetidTimer: seg.erStartSegment ? reisetidTimer : 0,
      reiseLonnsartId,
      reisetidTellerOvertid: regel?.reisetidTellerOvertid ?? false,
      deltVedMidnatt,
      sluttTidKilde: erSiste ? effektivSisteKilde : "midnatt",
    });
    if (res?.utfall === "blokkertSendt") blokkertSendt = true;
    if (seg.erStartSegment) startSheetId = res?.id ?? null;
  });
  return { id: startSheetId, blokkertSendt };
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
}): { id: string; utfall: SegmentUtfall } | null {
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

  // UF-1: dagen finnes alt.
  if (resultat.eksisterte) {
    if (resultat.status !== "draft" && resultat.status !== "returned") {
      // Sendt/godkjent → kan ikke appende ny økt (ville gi server-konflikt).
      // Recall er UF-4 (egen server-runde).
      return { id: sheetId, utfall: "blokkertSendt" };
    }
    // Redigerbar draft/returned → append: utvid arbeidstid-vinduet til å dekke
    // den nye økten. Rad-genereringen under bruker sheetId → appender rader.
    utvidArbeidstidsvindu(db, sheetId, segment.startIso, segment.sluttIso);
  }

  // Nyopprettet eller append → generer (og append) denne øktens rader.
  // Arbeidstid = segment-brutto − pause (pause kun på start-dagen, 1a).
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

  // Auto-fordeling normaltid/overtid (per dag).
  if (arbeidstimer > 0) {
    const dagsnorm0 = effektiv.dagsnorm > 0 ? effektiv.dagsnorm : arbeidstimer;
    // Fase 3: når reisetid teller mot overtid, spiser reise-andelen av dagsnorm-
    // budsjettet → mer av arbeidstiden havner i overtid. Når false (default) er
    // reise utenfor terskelen og dagsnorm gjelder kun arbeidstimene.
    const dagsnorm =
      reisetidTellerOvertid && reisetidTimer > 0
        ? Math.max(0, dagsnorm0 - reisetidTimer)
        : dagsnorm0;
    const timelonnTimer = Math.min(arbeidstimer, dagsnorm);
    const overtidTimer = Math.round((arbeidstimer - timelonnTimer) * 100) / 100;

    const standard = hentStandardLonnsartLokalt(orgId);
    if (standard && timelonnTimer > 0) {
      db.insert(sheetTimerLocal)
        .values({
          id: randomUUID(),
          dagsseddelId: sheetId,
          projectId: prosjektId,
          lonnsartId: standard.id,
          aktivitetId,
          externalCostObjectId: null,
          timer: timelonnTimer,
          fraTid: null,
          tilTid: null,
          sistEndretLokalt: Date.now(),
        })
        .run();
    }

    if (overtidTimer > 0) {
      // MVP: navne-match «Overtid 50%». Erstattes av Lonnsart.overtidsnivaa.
      const overtid = db
        .select()
        .from(lonnsartLocal)
        .where(
          and(
            eq(lonnsartLocal.organizationId, orgId),
            eq(lonnsartLocal.aktiv, true),
          ),
        )
        .all()
        .find((l) => /overtid/i.test(l.navn) && /50/.test(l.navn));
      if (overtid) {
        db.insert(sheetTimerLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: sheetId,
            projectId: prosjektId,
            lonnsartId: overtid.id,
            aktivitetId,
            externalCostObjectId: null,
            timer: overtidTimer,
            fraTid: null,
            tilTid: null,
            sistEndretLokalt: Date.now(),
          })
          .run();
      }
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
        fraTid: null,
        tilTid: null,
        sistEndretLokalt: Date.now(),
      })
      .run();
  }

  return { id: sheetId, utfall: resultat.eksisterte ? "appendet" : "opprettet" };
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
): void {
  const sedel = db
    .select({ startAt: dagsseddelLocal.startAt, endAt: dagsseddelLocal.endAt })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!sedel) return;

  const tidligste =
    sedel.startAt && sedel.startAt < nyStartIso ? sedel.startAt : nyStartIso;
  const seneste =
    sedel.endAt && sedel.endAt > nySluttIso ? sedel.endAt : nySluttIso;

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
