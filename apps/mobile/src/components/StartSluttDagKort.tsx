import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, AppState } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { randomUUID } from "expo-crypto";
import { Play, Square, Clock, AlertTriangle, MapPin, ArrowRightLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../providers/AuthProvider";
import { useFirma } from "../kontekst/FirmaKontekst";
import {
  useArbeidsdag,
  formatIsoDato,
  tilHHMM,
  fangGps,
} from "../hooks/useArbeidsdag";
import { hentArbeidsdagTiderLokalt } from "../services/kalenderKatalog";
import { estimerGlemtSlutt } from "../utils/dagsegment";
import {
  hentDagsnormLokalt,
  hentOgCacheArbeidstidSvar,
} from "../services/arbeidstidSvarKatalog";
import { trpc } from "../lib/trpc";
import { hentDatabase } from "../db/database";
import { identifiserByggeplass } from "../services/byggeplassKatalog";
import {
  kjorS1,
  maalStille,
  registrerBesok,
  s1Prosessvakt,
  sisteBesok,
  velgS2Besok,
  type Besok,
  type BesokKilde,
  type BesokSted,
} from "../services/arbeidsdagBesok";
import { AnkommetHvorModal } from "./AnkommetHvorModal";

/**
 * `onNyRad`: beholdt i signaturen (A5, ORDRE 30). Var fallback ved
 * `kildeManglet`; «Velg prosjekt» i `/timer/bekreft-dag` har tatt over.
 */
export function StartSluttDagKort({ onNyRad: _onNyRad }: { onNyRad?: () => void } = {}) {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { bruker } = useAuth();
  const { valgtFirmaId } = useFirma();

  // Start-dag + aktivDag-lesing deles med hjem-chippen via useArbeidsdag —
  // ingen duplisert GPS/Drizzle-logikk. Kortet eier «Slutt dag» (åpner
  // bekreft-skjermen) og glemt-dag (under).
  const { aktivDag, startDag, behandler, setBehandler } = useArbeidsdag();
  const [naa, setNaa] = useState<number>(Date.now());
  // Lag 2: arbeider har bekreftet «jeg jobber fortsatt» på en gammel åpen dag
  // → skjul glemt-dag-prompten for denne økten og vis normal «Slutt dag».
  const [jobberFortsatt, setJobberFortsatt] = useState(false);
  // L4-A: dagens siste besøk (lest lokalt), S1-forslaget og S2-arket.
  const [siste, setSiste] = useState<Besok | null>(null);
  const [besokNonce, setBesokNonce] = useState(0);
  const [s1, setS1] = useState<BesokSted | null>(null);
  const [visS2, setVisS2] = useState(false);
  const [s2Treff, setS2Treff] = useState<BesokSted | null>(null);
  const orgIdKort = valgtFirmaId ?? "";

  useEffect(() => {
    const db = hentDatabase();
    setSiste(aktivDag && db ? sisteBesok(db, aktivDag.id) : null);
    if (!aktivDag) setS1(null);
  }, [aktivDag, besokNonce]);

  // L4-A S1 (§ 2.3): ved montering mens dagen pågår, og når appen kommer i
  // forgrunnen → maks én måling pr. 10 min (vakten er pr. app-prosess, K14).
  // Treff på en annen byggeplass enn siste besøk (og ikke dempet) → banner.
  // Ingen treff / GPS av → stille. Ingen bakgrunnsposisjon.
  useEffect(() => {
    if (!aktivDag) return;
    const dagId = aktivDag.id;
    let aktiv = true;
    const maal = () =>
      void kjorS1({
        vakt: s1Prosessvakt,
        orgId: orgIdKort,
        naaMs: Date.now,
        maal: () => maalStille(Location),
        identifiser: identifiserByggeplass,
        siste: () => {
          const db = hentDatabase();
          return db ? sisteBesok(db, dagId) : null;
        },
      }).then((forslag) => {
        if (aktiv && forslag !== undefined) setS1(forslag);
      });
    maal();
    const sub = AppState.addEventListener("change", (tilstand) => {
      if (tilstand === "active") maal();
    });
    return () => {
      aktiv = false;
      sub.remove();
    };
  }, [aktivDag, orgIdKort]);

  const registrer = useCallback(
    (sted: BesokSted, kilde: BesokKilde) => {
      const db = hentDatabase();
      if (!db || !aktivDag) return;
      const naaIso = new Date().toISOString();
      registrerBesok(db, {
        id: randomUUID(),
        arbeidsdagId: aktivDag.id,
        sted,
        ankomstAt: naaIso,
        kilde,
        naaIso,
      });
      setS1(null);
      setBesokNonce((n) => n + 1);
    },
    [aktivDag],
  );

  // L4-A S2 (§ 2.4): arket åpnes straks; GPS-treffet legges øverst når det kommer.
  const aapneS2 = useCallback(() => {
    setS2Treff(null);
    setVisS2(true);
    void fangGps().then(({ lat, lng }) =>
      setS2Treff(identifiserByggeplass(lat, lng, orgIdKort)),
    );
  }, [orgIdKort]);

  const velgS2 = useCallback(
    (sted: BesokSted) => {
      setVisS2(false);
      const db = hentDatabase();
      if (!db || !aktivDag) return;
      // Samme sted som siste besøk → ingen ny rad (velgS2Besok).
      const naaIso = new Date().toISOString();
      if (velgS2Besok(db, { id: randomUUID(), arbeidsdagId: aktivDag.id, sted, naaIso })) {
        setS1(null);
        setBesokNonce((n) => n + 1);
      }
    },
    [aktivDag],
  );

  // Tikk forløpt-tid hvert minutt mens dagen pågår.
  useEffect(() => {
    if (!aktivDag) return;
    setNaa(Date.now());
    const id = setInterval(() => setNaa(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [aktivDag]);

  // L3-A (G1, Kenneth 2026-11-06): «Slutt dag» fanger slutt-GPS og henter
  // fersk norm, og åpner så `/timer/bekreft-dag`. Ingenting skrives her —
  // forslaget blir lønnsgrunnlag først når arbeideren bekrefter i skjermen.
  // Avbryter arbeideren der, står dagen `paagaar`.
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
      const orgId = valgtFirmaId ?? "";
      const sluttIso = overstyrtSluttIso ?? new Date().toISOString();
      // B6 v3: hent serverens norm-SVAR for de berørte datoene (start + slutt,
      // midnatt gir to) FØR skjermens lese-fase, så forslaget bruker fersk norm
      // når nett finnes. Best-effort — offline beholder cachen (markøren
      // signaliserer).
      const berorteDatoer = new Set<string>([
        formatIsoDato(new Date(aktivDag.startAt)),
        formatIsoDato(new Date(sluttIso)),
      ]);
      await Promise.all(
        Array.from(berorteDatoer).map((d) =>
          hentOgCacheArbeidstidSvar(utils.client, orgId, d),
        ),
      );
      router.push({
        pathname: "/timer/bekreft-dag",
        params: {
          arbeidsdagId: aktivDag.id,
          sluttIso,
          endLat: lat == null ? "" : String(lat),
          endLng: lng == null ? "" : String(lng),
          sisteSegmentKilde,
        },
      });
    } finally {
      setBehandler(false);
    }
  }, [aktivDag, bruker?.id, valgtFirmaId, behandler, router, setBehandler, utils]);

  // Lag 2 (glemt dag): gjenoppretting — estimer slutt-tid og generer draft
  // arbeider kan korrigere. Slutt merkes sluttTidKilde="system" → kontroll-badge
  // i attestering (tiden er gjettet, ikke bekreftet).
  const gjenopprettGlemtDag = useCallback(() => {
    if (!aktivDag || behandler) return;
    const startDato = formatIsoDato(new Date(aktivDag.startAt));
    // Estimatet (ikke lønn): tider fra lokal utledning, norm fra svar-cachen med
    // 7,5t-fallback når normen er ukjent. Arbeider korrigerer uansett.
    const tider = hentArbeidsdagTiderLokalt(
      valgtFirmaId ?? "",
      new Date(`${startDato}T00:00:00`),
    );
    const norm = hentDagsnormLokalt(valgtFirmaId ?? "", startDato);
    // Nattskift-edge (4b-2): standardsluttid før start → start + dagsnorm.
    // DEL 5 d: estimatet kappes ved midnatt — aldri automatisk tid på neste
    // dato. Bekreft dag krever at arbeideren godkjenner eller retter (del c).
    const { sluttIso } = estimerGlemtSlutt(aktivDag.startAt, tider.sluttTid, norm?.dagsnorm);
    void utforSluttDag(sluttIso, "system");
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

  const stedNavn = (b: Pick<Besok, "byggeplassId" | "byggeplassNavn">) =>
    b.byggeplassId ? (b.byggeplassNavn ?? "") : t("timer.besok.utenfor");

  return (
    <>
    {s1 && siste ? (
      <View className="mx-4 mt-3 rounded-lg border border-green-300 bg-green-100 p-3">
        <View className="flex-row items-center gap-2">
          <MapPin size={16} color="#047857" />
          <Text className="flex-1 text-sm font-semibold text-green-900">
            {t("timer.besok.forslag", { sted: s1.navn ?? "" })}
          </Text>
        </View>
        <Text className="mt-1 pl-6 text-xs text-green-800">
          {t("timer.besok.sisteStopp", { sted: stedNavn(siste), tid: tilHHMM(siste.ankomstAt) })}
        </Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => registrer(s1, "gps_forslag")}
            className="flex-1 items-center rounded-lg bg-blue-600 py-3 active:bg-blue-700"
          >
            <Text className="text-base font-semibold text-white">{t("timer.besok.ankommet")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              // [Nei] skriver ingenting — demper samme byggeplass i 30 min.
              if (s1.id) s1Prosessvakt.demp(s1.id, Date.now());
              setS1(null);
            }}
            className="flex-1 items-center rounded-lg border border-green-300 bg-white py-3 active:bg-green-50"
          >
            <Text className="text-base font-medium text-green-900">{t("timer.besok.nei")}</Text>
          </Pressable>
        </View>
      </View>
    ) : null}
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
      {siste && siste.rekkefolge > 1 ? (
        <Text className="mt-1 pl-6 text-xs text-green-700">
          {t("timer.besok.naa", { sted: stedNavn(siste), tid: tilHHMM(siste.ankomstAt) })}
        </Text>
      ) : null}
      <View className="mt-3 flex-row gap-2">
      <Pressable
        onPress={aapneS2}
        disabled={behandler}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-green-300 bg-white py-3 active:bg-green-100 disabled:opacity-50"
      >
        <ArrowRightLeft size={16} color="#047857" />
        <Text className="text-base font-medium text-green-900">
          {t("timer.besok.byttByggeplass")}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => { void utforSluttDag(); }}
        disabled={behandler}
        className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-red-600 py-3 active:bg-red-700 disabled:opacity-50"
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
    </View>
    {visS2 ? (
      <AnkommetHvorModal
        orgId={orgIdKort}
        gpsTreff={s2Treff}
        onVelg={velgS2}
        onLukk={() => setVisS2(false)}
      />
    ) : null}
    </>
  );
}
