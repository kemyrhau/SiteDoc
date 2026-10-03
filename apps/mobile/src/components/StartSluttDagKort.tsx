import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Play, Square, Clock, AlertTriangle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { eq, and } from "drizzle-orm";
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
import { splittVedMidnatt, kappGlemtDagSlutt } from "../utils/dagsegment";
import {
  beregnDagsforslag,
  avgjorSluttDagHandling,
  skalMarkereAvsluttet,
  MAKS_ENKELTSKIFT_TIMER,
  type BeregnDagsforslagInput,
  type DagsforslagEffektiv,
  type DagsforslagEksisterendeSedel,
} from "../utils/dagsforslag";
import { tolkStart, tolkSlutt, velgDestinasjon } from "@sitedoc/shared";
import { anvendDagsforslag } from "../utils/dagsforslagAnvend";
import {
  useArbeidsdag,
  formatIsoDato,
  tilHHMM,
  fangGps,
  type AktivDag,
} from "../hooks/useArbeidsdag";
import { hentProsjekterLokalt } from "../services/prosjektKatalog";
import { hentArbeidsdagTiderLokalt } from "../services/kalenderKatalog";
import {
  hentDagsnormLokalt,
  hentOgCacheArbeidstidSvar,
} from "../services/arbeidstidSvarKatalog";
import {
  hentStandardLonnsartLokalt,
  hentReiseLonnsartId,
} from "../services/timerKatalog";
import { hentOrganizationSettingLokalt } from "../services/organizationSettingKatalog";
import { hentMatriseRadLokalt } from "../services/reisetidMatriseKatalog";
import {
  hentByggeplasserForFirmaLokalt,
  hentByggeplasserForProsjektLokalt,
} from "../services/byggeplassKatalog";
import { hentOppmotederLokalt } from "../services/oppmotestedKatalog";
import { hentReiseGrensepunkterLokalt } from "../services/reiseGrensepunktKatalog";
import { trpc } from "../lib/trpc";

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export function StartSluttDagKort() {
  const { t } = useTranslation();
  const router = useRouter();
  const utils = trpc.useUtils();
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
      const orgId = valgtFirmaId ?? "";
      const sluttIso = overstyrtSluttIso ?? new Date().toISOString();
      // B6 v3: hent serverens norm-SVAR for de berørte datoene (start + slutt,
      // midnatt gir to) FØR lese-fasen, så forslaget bruker fersk norm når nett
      // finnes. Best-effort — offline beholder cachen (markøren signaliserer).
      const berorteDatoer = new Set<string>([
        formatIsoDato(new Date(aktivDag.startAt)),
        formatIsoDato(new Date(sluttIso)),
      ]);
      await Promise.all(
        Array.from(berorteDatoer).map((d) =>
          hentOgCacheArbeidstidSvar(utils.client, orgId, d),
        ),
      );
      // LAG 0b: tre faser — LES (samle alt DB-kunnskapen) → REGN UT (ren
      // beregnDagsforslag, ingen DB) → SKRIV (anvendDagsforslag). Splitten
      // lukker at «avsluttet» ble satt uten å vite utfallet av skrivingen.
      const input = samleDagsforslagInput(db, {
        userId: bruker.id,
        orgId,
        dag: aktivDag,
        sluttIso,
        endLat: lat,
        endLng: lng,
        kontekstByggeplassId: valgtBygningId,
        aktivtProsjektId: valgtProsjektId,
        sisteSegmentKilde,
      });
      const forslag = beregnDagsforslag(input);
      const resultat = anvendDagsforslag(db, forslag, {
        userId: bruker.id,
        orgId,
        nyId: randomUUID,
        naa: Date.now,
      });
      // H7: avgjør handlingen FØR vi rører arbeidsdagen. Dagen markeres
      // «avsluttet» KUN når skrivingen lyktes (suksess/playVek/forKort); to
      // utfall holder den ÅPEN så GPS-økta ikke går tapt — blokkertSendt (økta
      // kunne ikke appendes på en sendt sedel) og kildeManglet (ingen sedel ble
      // opprettet). Tidligere ble «avsluttet» satt uansett utfall.
      const handling = avgjorSluttDagHandling(resultat);
      if (skalMarkereAvsluttet(handling)) {
        db.update(arbeidsdagLocal)
          .set({
            endAt: sluttIso,
            endLat: lat,
            endLng: lng,
            status: "avsluttet",
            generertDagsseddelId: resultat.startSheetId,
            sistEndretLokalt: Date.now(),
          })
          .where(eq(arbeidsdagLocal.id, aktivDag.id))
          .run();
      }
      // Re-les fra DB (ved avsluttet blir aktivDag null i hooken; ellers står
      // dagen fortsatt åpen).
      refresh();
      oppdaterTellere();
      void triggerSync();
      switch (handling.type) {
        case "suksess":
          router.push(`/timer/${handling.sheetId}`);
          // B6.3-markør: normen var ikke dagens server-svar → si det (banneret på
          // sedelen står også). "ukjent" = ingen overtid-splitt (UNDERbetaling).
          if (forslag.normStatus === "ukjent") {
            Alert.alert(
              t("timer.normMarkor.ukjent.tittel"),
              t("timer.normMarkor.ukjent.melding"),
            );
          } else if (forslag.normStatus === "cachet") {
            Alert.alert(
              t("timer.normMarkor.cachet.tittel"),
              t("timer.normMarkor.cachet.melding"),
            );
          }
          break;
        case "blokkertSendt":
          // Dagen står ÅPEN — timene reddes ved at lederen returnerer sedelen.
          router.push(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.appendSendt.tittel"),
            t("timer.appendSendt.melding"),
          );
          break;
        case "playVek":
          // 1b (fabel): si HVA som vek — tidsrommene — og at manuell rad er
          // beholdt. Foran «for kort» (om play vek helt, er overlapp den reelle
          // grunnen, ikke kort økt).
          router.push(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.playVek.tittel"),
            t("timer.playVek.melding", { intervaller: handling.intervaller }),
          );
          break;
        case "forKort":
          // F-c: økta førte 0 rader (for kort etter pause/runding) — gi
          // tilbakemelding i stedet for et stille tomt dagskort. F-g: pre-fylt-
          // variant når sedelen alt HAR rader.
          router.push(`/timer/${handling.sheetId}`);
          Alert.alert(
            t(handling.preFylt ? "timer.forKort.preFyltTittel" : "timer.forKort.tittel"),
            t(handling.preFylt ? "timer.forKort.preFyltMelding" : "timer.forKort.melding"),
          );
          break;
        case "kildeManglet":
          // Prosjekt/aktivitet kunne ikke utledes offline → ingen sedel. Dagen
          // står ÅPEN (H7) og brukeren varsles — ellers forsvinner dagen stumt.
          // Manuell opprettelse er fortsatt tilgjengelig som fallback.
          router.push("/timer/ny");
          Alert.alert(
            t("timer.kildeManglet.tittel"),
            t("timer.kildeManglet.melding"),
          );
          break;
        case "prosjektUkjent":
          // §2: A5 fant ingen destinasjon og arbeideren har ikke valgt prosjekt.
          // Dagen står ÅPEN; meldingen navngir veien ut (velg prosjekt, prøv
          // igjen) — et utfall uten stemme er verre enn et som blokkerer.
          Alert.alert(
            t("timer.prosjektUkjent.tittel"),
            t("timer.prosjektUkjent.melding"),
          );
          break;
      }
    } finally {
      setBehandler(false);
    }
  }, [aktivDag, bruker?.id, valgtFirmaId, valgtBygningId, valgtProsjektId, behandler, router, oppdaterTellere, triggerSync, t, refresh, setBehandler, utils]);

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
    // Estimatet (ikke lønn): tider fra lokal utledning, norm fra svar-cachen med
    // 7,5t-fallback når normen er ukjent. Arbeider korrigerer uansett.
    const tider = hentArbeidsdagTiderLokalt(
      valgtFirmaId ?? "",
      new Date(`${startDato}T00:00:00`),
    );
    const norm = hentDagsnormLokalt(valgtFirmaId ?? "", startDato);
    const start = new Date(aktivDag.startAt);
    const [tt, mm] = tider.sluttTid.split(":").map(Number);
    let slutt = new Date(start);
    slutt.setHours(tt, mm, 0, 0);
    // Nattskift-edge (4b-2): standardSluttTid ligger før start-klokkeslettet →
    // 0/negativ varighet. Estimer i stedet start + dagsnorm (krysser evt.
    // midnatt → 4a-splitt håndterer det). Arbeider korrigerer uansett.
    if (slutt.getTime() <= start.getTime()) {
      const dagsnormTimer =
        norm?.dagsnorm && norm.dagsnorm > 0 ? norm.dagsnorm : 7.5;
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
 * LES-fasen: samle ALT `beregnDagsforslag` trenger fra lokal DB — kataloger,
 * org-setting, reise-oppslag (matrise + grensepunkter) og eksisterende-sedel-
 * status per dato. Dette er stedet DB-kunnskapen gjøres SYNLIG; den rene
 * utregningen (`beregnDagsforslag`) rører aldri databasen.
 *
 * 🔴 LAG 3-GRENSE: denne lese-fasen flyttes UT av komponenten når bekreftelses-
 * skjermen (`/timer/bekreft-dag`) kommer — skjermen trenger nøyaktig samme
 * input fra et annet sted (henter kataloger + status, kaller `beregnDagsforslag`,
 * viser forslaget, og kaller `anvendDagsforslag` først ved «Bekreft»). Flytt den
 * da til en delt kilde; ALDRI dupliser lesningen inn i skjermen (fire slike
 * kopier er lukket denne uken).
 */
function samleDagsforslagInput(
  db: LokalDb,
  p: {
    userId: string;
    orgId: string;
    dag: AktivDag;
    sluttIso: string;
    endLat: number | null;
    endLng: number | null;
    kontekstByggeplassId: string | null;
    aktivtProsjektId: string | null;
    sisteSegmentKilde: "bruker" | "system";
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
    const alleByggeplasser = hentByggeplasserForFirmaLokalt(orgId);
    const byggGeofencer = alleByggeplasser.filter(
      (b): b is typeof b & { lat: number; lng: number; radiusM: number } =>
        b.lat != null && b.lng != null && b.radiusM != null,
    );
    const oppmGeofencer = hentOppmotederLokalt(orgId).filter(
      (o): o is typeof o & { lat: number; lng: number; radiusM: number } =>
        o.lat != null && o.lng != null && o.radiusM != null,
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
    const destinasjon = velgDestinasjon({
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
    .select({ fraTid: sheetTimerLocal.fraTid, tilTid: sheetTimerLocal.tilTid })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
    .all();
  return { finnes: true, status: sedel.status, eksisterendeRader: rader };
}
