import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  AppState,
  InputAccessoryView,
  type TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { AlertTriangle, ArrowLeft, Calendar, Car, ChevronRight, Minus, Plus, Trash2, Undo2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { randomUUID } from "expo-crypto";
import { eq, and } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import { SedelIAnnetFirmaFeil } from "../../src/services/dagsseddelOpprett";
import {
  arbeidsdagLocal,
  aktivitetLocal,
  dagsseddelLocal,
} from "../../src/db/schema";
import { useAuth } from "../../src/providers/AuthProvider";
import { useFirma, hentLagretAnsattStatus } from "../../src/kontekst/FirmaKontekst";
import { useProsjekt } from "../../src/kontekst/ProsjektKontekst";
import { useByggeplass } from "../../src/kontekst/ByggeplassKontekst";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { tilHHMM } from "../../src/hooks/useArbeidsdag";
import { hentProsjekterLokalt } from "../../src/services/prosjektKatalog";
import {
  hentByggeplasserForProsjektLokalt,
  hentByggeplasserForFirmaLokalt,
  identifiserByggeplass,
} from "../../src/services/byggeplassKatalog";
import { gpsForslagLinje } from "../../src/utils/gpsForslagLinje";
import {
  hentUnderprosjekterLokalt,
  hentReiseKnappLokalt,
  hentLonnsarterLokalt,
  erReiseLonnsartLokalt,
  finnLonnsartLokalt,
} from "../../src/services/timerKatalog";
import { FravaerKortModal } from "../../src/components/timer-detalj/prosjektkort/FravaerKortModal";
import {
  forslagSomDagRader,
  fravaerVedBekreft,
  hentFravaerKortDag,
} from "../../src/components/timer-detalj/prosjektkort/fravaerKortDag";
import { LonnsartVelgerModal } from "../../src/components/timer-detalj/TimerSeksjon";
import {
  MAKS_LINJE_CHIPS,
  grupperLinjeLonnsarter,
  linjerIDag,
  lonnsarterForLinje,
  ryddLonnsartPerLinje,
  utenLinje,
  velgLinjeLonnsart,
} from "../../src/utils/linjeLonnsart";
import { ReiseKort } from "../../src/components/timer-detalj/ReiseKort";
import { hentWebUrl } from "../../src/config/auth";
import { apnLenke } from "../../src/lib/apnLenke";
import { FraTilTidFelt } from "../../src/components/timer-detalj/FraTilTidFelt";
import { hentBesok } from "../../src/services/arbeidsdagBesok";
import { hentOppmotederLokalt } from "../../src/services/oppmotestedKatalog";
import { useOppmotePeriodeVersjon } from "../../src/services/oppmotePeriodeKatalog";
import { maaltAnkomst, type MaaltTidspunkt } from "../../src/utils/maaltArbeidstid";
import { hhmmTilMin, minTilHhmm } from "@sitedoc/shared";
import { ModalFlate } from "../../src/components/ModalFlate";
import { OppmoteSporsmaalArk, useOppmoteSporsmaal } from "../../src/components/OppmoteSporsmaal";
import { useModalInnsetter } from "../../src/components/ModalInnsetter";
import {
  forberedBekreftDag,
  bekreftDag,
  avsluttDagUtenSedel,
  erTomtForslag,
  erAlleDatoerSendt,
  sendteDatoer,
  visSluttTid,
  bekreftSperre,
  stegSluttIso,
  manglerBeskrivelse,
  prosjekterMedArbeid,
  flyttBeskrivelse,
  flyttBeskrivelseVedProsjektbytte,
} from "../../src/utils/bekreftDag";
import { BekreftDagLonnUtlegg } from "../../src/components/timer-detalj/BekreftDagLonnUtlegg";
import type { LonnUtlegg } from "../../src/utils/dagsforslagAnvend";
import { slettLokaltBilde } from "../../src/services/lokalBilde";
import {
  erTomtUtkast,
  finnUtkast,
  forkastUtkast,
  gpsUtkastNokkel,
  lagreUtkast,
  manuellUtkastNokkel,
  slettbareEtterSkriving,
  type UtkastData,
} from "../../src/utils/prosjektkortUtkast";
import { HjelpIkon } from "../../src/components/HjelpIkon";
import { useOpplastingsKo } from "../../src/providers/OpplastingsKoProvider";
import { forberedManuellDag } from "../../src/utils/manuellDag";
import { hentDagsnormLokalt, hentOgCacheArbeidstidSvar } from "../../src/services/arbeidstidSvarKatalog";
import { trpc } from "../../src/lib/trpc";
import { DatoVelgerFelt } from "../../src/components/DatoVelgerFelt";
import { formatNorskDato, lokalIsoDato } from "../../src/utils/dato";
import { BekreftDagBeskrivelse } from "../../src/components/timer-detalj/BekreftDagBeskrivelse";
import { kortMedArbeid, kortMedFlestTimer, arbeidsraderPerKort, foreldreloseBeskrivelser, type BeskrivelseKort } from "../../src/utils/beskrivelseKort";
import { angreKortDeling, delTilEgetKort, delingsVindu } from "../../src/utils/kortIdForslag";
import { DelKortModal } from "../../src/components/timer-detalj/DelKortModal";
import { knyttLonnUtleggTilKort } from "../../src/utils/lonnUtleggKort";
import { kortNokkel } from "../../src/lib/prosjektkortMobil";
import { sisteBeskrivelser, beskrivelseChips } from "../../src/services/beskrivelseForslag";
import {
  vaktGrunnlag,
  maskinerForDato,
  tilleggUtenRad,
  type BekreftDagTillegg,
  type TilleggPerRad,
  type VaktGrunnlag,
} from "../../src/utils/bekreftDagTillegg";
import {
  BekreftDagRadTillegg,
  TilleggLinjer,
  useTilleggKatalog,
} from "../../src/components/timer-detalj/BekreftDagRadTillegg";
import { kortArbeidstimer, settTilleggPaaKort, tilleggPaaKort } from "../../src/utils/tilleggPaaKort";
import {
  leggTilOvertidRetting,
  overtidEditorFra,
  stegOvertidFra,
  vekslOvertidNivaa,
} from "../../src/utils/dagsforslag";
import type {
  ArbeidLinje,
  DagsforslagLinjeUtenLonnsart,
  DagsforslagRetting,
  DagsforslagRettingDato,
  DagsforslagDag,
  DagsforslagRad,
  DagsforslagLonnsart,
  DagsforslagKjedeKonflikt,
} from "../../src/utils/dagsforslag";

/**
 * L3-A «Bekreft dag» (spec § 3 / § 10, helhetsplan § 3 G1, Kenneth 2026-11-06).
 *
 * GPS gir FORSLAG til sted, prosjekt og reise. Forslaget blir lønnsgrunnlag
 * først når arbeideren bekrefter her. Arbeider-valget i skjermen er autoritativt.
 *
 * Invariant: ingenting skrives før [Bekreft og lagre] / [Avslutt dag]. Forlater
 * arbeideren skjermen (Ikke nå, tilbake, drept app) står dagen `paagaar`, og
 * «Slutt dag» åpner skjermen på nytt med fersk slutt-GPS. Slutt-posisjonen
 * kommer som ruteparametre fra kortet (transient, ikke lagret).
 *
 * ORDRE 36c — MANUELL modus (`opprinnelse=manuell`, «+» og «+ Nytt
 * prosjektkort»): samme skjerm uten GPS og uten arbeidsdag. Datoen er valgt på
 * forhånd og kan byttes (ikke fra et prosjektkort: `laastDato`). Finnes en
 * dagsseddel den datoen, legges registreringen inn i den (`bekreftDag`).
 */

type Valgark = "prosjekt" | "byggeplass" | "aktivitet" | null;

function tilTall(v: string | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatTimer(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

const PAUSE_STEG = 15;
const UTKAST_DEBOUNCE_MS = 2000;

function formaterKlokke(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}
const PAUSE_MAKS = 120;

/** RETUR 36c pkt 3: iOS «Ferdig»-linje over tastaturet for «Hva gjorde du i dag?». */
const TASTATUR_ID = "bekreftDagTastatur";

export default function BekreftDagSkjerm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    arbeidsdagId: string;
    sluttIso: string;
    endLat?: string;
    endLng?: string;
    sisteSegmentKilde?: string;
    opprinnelse?: string;
    dato?: string;
    laastDato?: string;
    /** Ordre c (T12): åpnet fra «+ Nytt prosjektkort» — raden blir et nytt kort. */
    nyttKort?: string;
  }>();
  const manuell = params.opprinnelse === "manuell";
  const laastDato = params.laastDato === "1";
  const { bruker } = useAuth();
  const { valgtFirmaId, valgtFirma, erAnsattIValgtFirma } = useFirma();
  const { valgtProsjektId } = useProsjekt();
  // (18) RETUR: aldri (c) «første byggeplass» i Bekreft dag — kun lagret valg/GPS.
  const { kontekstByggeplassId: valgtBygningId, gpsByggeplassId } = useByggeplass();
  const { triggerSync, oppdaterTellere } = useTimerSync();

  const orgId = valgtFirmaId ?? "";
  // POST (12) D: manuell dag stiller «Hvor møter du vanligvis?» først (kun på
  // nett, kun når serveren sier trengerValg). Lukk = fortsett uten.
  const oppmote = useOppmoteSporsmaal(manuell ? orgId : "");
  const [oppmoteFerdig, setOppmoteFerdig] = useState(false);
  const sluttIso = params.sluttIso;
  const endLat = tilTall(params.endLat);
  const endLng = tilTall(params.endLng);
  const sisteSegmentKilde: "bruker" | "system" =
    params.sisteSegmentKilde === "system" ? "system" : "bruker";

  // Ordre c (T12): «+ Nytt prosjektkort» gir et nytt kort, også på et prosjekt som alt har kort.
  const nyttKortFroe = useCallback(
    (r: DagsforslagRetting): DagsforslagRetting =>
      manuell && params.nyttKort === "1" && !r.nyttKort ? { ...r, nyttKort: randomUUID() } : r,
    [manuell, params.nyttKort],
  );
  const [retting, setRetting] = useState<DagsforslagRetting>(() => nyttKortFroe({}));
  const [manuellDato, setManuellDato] = useState(params.dato ?? lokalIsoDato(new Date()));
  const [visDatoVelger, setVisDatoVelger] = useState(false);
  // Funn 3 (telefontest 13.11): manuell modus («+», «+ Nytt prosjektkort») har
  // ingen `forberedSluttDag` foran seg og leste bare svar-cachen — uten et svar
  // for datoen ble normen «cachet» selv med nett. Hent dagens svar for den valgte
  // datoen og regn på nytt når det er lagret; offline beholdes cachen (varselet står).
  const normUtils = trpc.useUtils();
  const [normNonce, settNormNonce] = useState(0);
  useEffect(() => {
    if (!manuell || !orgId) return;
    let avbrutt = false;
    void hentOgCacheArbeidstidSvar(normUtils.client, orgId, manuellDato).then((ok) => {
      if (ok && !avbrutt) settNormNonce((n) => n + 1);
    });
    return () => {
      avbrutt = true;
    };
  }, [manuell, orgId, manuellDato, normUtils.client]);
  // POST 2026-11-14 (8) punkt 1: «+ Reise» i Nytt prosjektkort — samme knapp,
  // resolver og skjuleregel som det lagrede kortet (`DagSeksjon`). Kun manuell
  // modus; GPS-dagen foreslår reisen selv.
  const reiseKnapp = useMemo(
    () => (manuell && orgId ? hentReiseKnappLokalt(orgId) : null),
    [manuell, orgId],
  );
  const reiseKnappLonnsartId =
    reiseKnapp?.status === "valgt" || reiseKnapp?.status === "automatisk"
      ? reiseKnapp.lonnsartId
      : null;
  // Firmaadmin-signal som i `DagSeksjon`: hentSetting krever firma-admin.
  const reiseAdminSetting = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId },
    { enabled: manuell && !!orgId && reiseKnapp != null && reiseKnappLonnsartId == null, retry: false },
  );
  const visReiseHint =
    reiseKnapp != null && reiseKnappLonnsartId == null && !!reiseAdminSetting.data
      ? reiseKnapp.status === "flere"
        ? "flere"
        : "ingen"
      : null;
  const [reiseModalApen, setReiseModalApen] = useState(false);
  // A2: byggeplassvalget kjører lese-fasen på nytt (kun select).
  const [valgtByggeplassId, setValgtByggeplassId] = useState<
    string | null | undefined
  >(undefined);
  const [erAnsatt, setErAnsatt] = useState<boolean | null | undefined>(undefined);
  const [valgark, setValgark] = useState<Valgark>(null);
  const [lagrer, setLagrer] = useState(false);
  // DEL 5 c: anslått slutt må godkjennes («Tidene stemmer») eller rettes før lagring.
  const [sluttGodkjent, setSluttGodkjent] = useState(false);
  const [rettetSluttIso, setRettetSluttIso] = useState<string | null>(null);
  // L3-D + PRESISERING TILLEGG: maskin og varer pr. arbeidsrad, i minnet til Bekreft.
  const [tilleggPerRad, setTilleggPerRad] = useState<TilleggPerRad>({});
  // ORDRE Tillegg/Utlegg i Bekreft dag: lønnstillegg + utlegg i minnet til Bekreft.
  const [lonnUtlegg, setLonnUtlegg] = useState<LonnUtlegg>({ tillegg: [], utlegg: [] });
  // Kvitteringsfilene som ennå ikke er registrert — ryddes når skjermen forlates
  // uten lagring. Tømmes synkront så snart Bekreft har skrevet dem.
  const pendingKvitteringer = useRef<string[]>([]);
  // RETUR avvik 10: kvitteringer arbeideren har fjernet. Fila slettes først når
  // en utkastversjon UTEN utlegget er skrevet (`skrivUtkastNaa`) — ellers kan et
  // krasj i debounce-vinduet gjenopprette utlegget med en død `lokalSti`.
  const fjernetKvitteringer = useRef<Set<string>>(new Set());
  const { leggIKo } = useOpplastingsKo();
  // ORDRE 36a: feltet er nøytralt til første Bekreft-forsøk med tom beskrivelse.
  const [forsoktBekreft, setForsoktBekreft] = useState(false);
  const rulleRef = useRef<ScrollView>(null);
  const beskrivelseFelt = useRef(new Map<string, TextInput>());
  const beskrivelseY = useRef(new Map<string, number>());
  // RETUR 36c-2 (D4): tekstfeltets y innenfor kortet — rullemålet er feltet.
  const beskrivelseFeltY = useRef(new Map<string, number>());
  // Radform: radfeltene inne i kortet (nøkkel `rad:…`).
  const [tastaturOppe, setTastaturOppe] = useState(false);
  useEffect(() => {
    const vis = Keyboard.addListener("keyboardDidShow", () => setTastaturOppe(true));
    const skjul = Keyboard.addListener("keyboardDidHide", () => setTastaturOppe(false));
    return () => {
      vis.remove();
      skjul.remove();
    };
  }, []);

  // UTKAST (plan 2026-11-13 § 2/§ 6): rettingene lagres lokalt mens arbeideren
  // fører. Skrives KUN fra brukerhandlinger (`endret()`), aldri fra effekter —
  // åpning med bare forslag gir ingen rad. Skrivingen er synkron (SQLite), så
  // hvert flush-punkt er ferdig før navigeringen fortsetter.
  const utkastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const harEndretRef = useRef(false);
  // Nøkkelen raden sist ble lest/skrevet under — datobytte flytter fra den.
  const lagretNokkelRef = useRef<string | null>(null);
  const utkastKontekstRef = useRef<{
    userId: string;
    orgId: string;
    nokkel: string;
    dato: string;
    arbeidsdagId: string | null;
    data: UtkastData;
  } | null>(null);
  const [utkastLastet, setUtkastLastet] = useState(false);
  const [gjenopprettetTid, setGjenopprettetTid] = useState<string | null>(null);
  const [lagretTid, setLagretTid] = useState<string | null>(null);

  const skrivUtkastNaa = useCallback(() => {
    if (utkastTimerRef.current) {
      clearTimeout(utkastTimerRef.current);
      utkastTimerRef.current = null;
    }
    const k = utkastKontekstRef.current;
    const db = hentDatabase();
    if (!harEndretRef.current || !k || !db || !k.orgId) return;
    const res = lagreUtkast(db, {
      userId: k.userId,
      orgId: k.orgId,
      nokkel: k.nokkel,
      dato: k.dato,
      arbeidsdagId: k.arbeidsdagId,
      data: k.data,
      naa: new Date().toISOString(),
      nyId: randomUUID,
      fraNokkel: lagretNokkelRef.current ?? undefined,
    });
    if (res === "opptatt") return;
    for (const sti of slettbareEtterSkriving(fjernetKvitteringer.current, k.data)) {
      fjernetKvitteringer.current.delete(sti);
      void slettLokaltBilde(sti);
    }
    harEndretRef.current = false;
    lagretNokkelRef.current = k.nokkel;
    if (res === "lagret") setLagretTid(formaterKlokke(new Date()));
  }, []);

  const endret = useCallback(() => {
    harEndretRef.current = true;
    if (utkastTimerRef.current) clearTimeout(utkastTimerRef.current);
    utkastTimerRef.current = setTimeout(skrivUtkastNaa, UTKAST_DEBOUNCE_MS);
  }, [skrivUtkastNaa]);

  // Flush: sveip/tilbake/maskinvare-tilbake (beforeRemove) og app i bakgrunnen.
  const navigation = useNavigation();
  useEffect(() => {
    const fjern = navigation.addListener("beforeRemove", () => skrivUtkastNaa());
    return fjern;
  }, [navigation, skrivUtkastNaa]);
  useEffect(() => {
    const lytter = AppState.addEventListener("change", (tilstand) => {
      if (tilstand !== "active") skrivUtkastNaa();
    });
    return () => lytter.remove();
  }, [skrivUtkastNaa]);

  // Ikke ansatt → ingen sedel. Fersk kontekst først, ellers sist lagrede svar.
  useEffect(() => {
    let avbrutt = false;
    if (erAnsattIValgtFirma != null) {
      setErAnsatt(erAnsattIValgtFirma);
      return;
    }
    void hentLagretAnsattStatus(orgId).then((svar) => {
      if (!avbrutt) setErAnsatt(svar);
    });
    return () => {
      avbrutt = true;
    };
  }, [erAnsattIValgtFirma, orgId]);

  // Dagen leses fra DB — kun en `paagaar`-dag kan bekreftes.
  const dag = useMemo(() => {
    const db = hentDatabase();
    if (!db || manuell || !params.arbeidsdagId) return null;
    const rad = db
      .select()
      .from(arbeidsdagLocal)
      .where(eq(arbeidsdagLocal.id, params.arbeidsdagId))
      .all()[0];
    if (!rad || rad.status !== "paagaar") return null;
    return {
      startAt: rad.startAt,
      startLat: rad.startLat,
      startLng: rad.startLng,
      oppmotestedId: rad.oppmotestedId ?? null,
      byggeplassId: rad.byggeplassId ?? null,
    };
  }, [manuell, params.arbeidsdagId]);

  // LES + REGN på nytt ved hver retting. Ingen skriving.
  // (17, P2): kjeden beregnes på nytt når periode-cachen skrives (overføring/refresh).
  const periodeVersjon = useOppmotePeriodeVersjon();
  // ORDRE (26): Bekreft stoppet fordi en dato ble sendt mens skjermen sto →
  // regn forslaget ut på nytt (useMemo-en har ingen sync-avhengighet).
  const [sendtNonce, settSendtNonce] = useState(0);
  const beregnet = useMemo(() => {
    const db = hentDatabase();
    if (!db || !bruker?.id) return null;
    if (manuell) {
      return forberedManuellDag(
        db,
        {
          userId: bruker.id,
          orgId,
          dato: manuellDato,
          kontekstByggeplassId: valgtBygningId,
          aktivtProsjektId: valgtProsjektId,
          valgtByggeplassId,
        },
        retting,
      );
    }
    if (!dag || !sluttIso) return null;
    // DEL 5 c: arbeiderens rettede slutt erstatter anslaget — kilden er da arbeideren.
    const brukSluttIso = rettetSluttIso ?? sluttIso;
    const lest = forberedBekreftDag(
      db,
      {
        userId: bruker.id,
        orgId,
        dag,
        sluttIso: brukSluttIso,
        endLat,
        endLng,
        kontekstByggeplassId: valgtBygningId,
        aktivtProsjektId: valgtProsjektId,
        sisteSegmentKilde: rettetSluttIso ? "bruker" : sisteSegmentKilde,
        valgtByggeplassId,
      },
      retting,
    );
    return { ...lest, sluttIso: brukSluttIso };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- normNonce: re-les svar-cachen (funn 3); sendtNonce: re-les sedel-status (ORDRE 26)
  }, [manuell, manuellDato, normNonce, dag, bruker?.id, orgId, sluttIso, rettetSluttIso, endLat, endLng, valgtBygningId, valgtProsjektId, sisteSegmentKilde, valgtByggeplassId, retting, periodeVersjon, sendtNonce]);
  // ORDRE (28) V4-⚠️: artene en linje kan få — firmaets aktive ordinære
  // (med og uten overtidsnivå) og fravær; reise-arter ute.
  const linjeArter = useMemo(
    () =>
      orgId
        ? lonnsarterForLinje(hentLonnsarterLokalt(orgId), (l) => erReiseLonnsartLokalt(orgId, l.id))
        : [],
    [orgId],
  );
  // DEL 5 c: panelet for anslått slutt — GPS-veien, slutten satt av systemet
  // (glemt dag) eller kappet. Står også etter retting, så arbeideren ser tiden.
  const sluttPanel =
    !manuell &&
    beregnet != null &&
    (sisteSegmentKilde === "system" || beregnet.forslag.kappet || rettetSluttIso != null);
  const sluttIkkeGodkjent = sluttPanel && !sluttGodkjent && rettetSluttIso == null;
  // Manuell: sluttiden er utledet (`manuellDag`), ikke en slutt-GPS.
  const effSluttIso = beregnet?.sluttIso ?? sluttIso;

  const prosjekter = useMemo(() => hentProsjekterLokalt(orgId), [orgId]);
  const aktiviteter = useMemo(() => {
    const db = hentDatabase();
    if (!db) return [];
    return db
      .select()
      .from(aktivitetLocal)
      .where(
        and(
          eq(aktivitetLocal.organizationId, orgId),
          eq(aktivitetLocal.aktiv, true),
        ),
      )
      .all();
  }, [orgId]);
  const prosjektId = beregnet?.forslag.prosjektId ?? null;

  // ORDRE 36a/36b: ett beskrivelsesfelt pr. kort med arbeid; chips pr. prosjekt fra lokal DB.
  const arbeidProsjekter = useMemo(
    () => (beregnet ? prosjekterMedArbeid(beregnet.forslag) : []),
    [beregnet],
  );
  // T12 (spec § 5, B6): standard = kortet med flest timer, ikke prosjektet.
  const lonnUtleggProsjekt = useMemo(
    () => (beregnet ? (kortMedFlestTimer(beregnet.forslag)?.projectId ?? null) : null),
    [beregnet],
  );
  const arbeidKort = useMemo(
    () => (beregnet ? kortMedArbeid(beregnet.forslag) : []),
    [beregnet],
  );
  // Kortets navn: prosjekt, byggeplassen når flere kort deler prosjektet, og
  // datoen når prosjektet har kort på flere datoer (RETUR 24: nattevakt 21–06
  // = to kort, «Prosjekt · 16.11.» og «Prosjekt · 17.11.»).
  // Brukes av beskrivelsesfeltene og kortvalget på tillegg/utlegg (T12).
  const kortEtikett = useCallback(
    (k: BeskrivelseKort) =>
      [
        prosjekter.find((pr) => pr.id === k.projectId)?.name ?? null,
        k.delerProsjekt
          ? (k.byggeplassId
              ? hentByggeplasserForProsjektLokalt(k.projectId).find((b) => b.id === k.byggeplassId)?.navn
              : null) ?? t("timer.kortValg.utenByggeplass")
          : null,
        k.visDato ? kortDato(k.dato) : null,
      ]
        .filter(Boolean)
        .join(" · "),
    [prosjekter, t],
  );
  const standardKortFor = useCallback(
    (projectId: string) => (beregnet ? kortMedFlestTimer(beregnet.forslag, projectId) : null),
    [beregnet],
  );
  const manglerNokler = useMemo(
    () => (beregnet ? manglerBeskrivelse(beregnet.forslag) : []),
    [beregnet],
  );
  const raderPerKort = useMemo(
    () => (beregnet ? arbeidsraderPerKort(beregnet.forslag) : new Map<string, never[]>()),
    [beregnet],
  );
  // Ordre c: to kort på samme prosjekt, byggeplass og dato (etter «Del til eget
  // kort») skilles med tidsrommet: «Prosjekt A · 07:00–12:00».
  const kortNavn = useCallback(
    (k: BeskrivelseKort) => {
      const navn = kortEtikett(k);
      const sammeSted = arbeidKort.some(
        (x) => x.nokkel !== k.nokkel && x.projectId === k.projectId && x.byggeplassId === k.byggeplassId && x.dato === k.dato,
      );
      if (!sammeSted) return navn;
      const tider = (raderPerKort.get(k.nokkel) ?? []).filter((r) => r.fraTid && r.tilTid);
      if (tider.length === 0) return navn;
      const tidsrom = `${tider[0]!.fraTid}–${tider[tider.length - 1]!.tilTid}`;
      return [navn, tidsrom].filter(Boolean).join(" · ");
    },
    [kortEtikett, arbeidKort, raderPerKort],
  );
  // TILLEGG (33) pkt 4.1 — fraværskortet, U1 inngang 2: samme kort som på dagskortet, for
  // datoen som står åpen (manuell: valgt dato, også fram i tid — U12; GPS: dagens første dato).
  // Lagres i kortet selv (`lagreFravaerKort`), ikke i utkastet: det har verken prosjekt eller
  // klokkeslett (F2/F3) og vises derfor også uten valgt prosjekt.
  const fravaerDato = manuell ? manuellDato : (beregnet?.forslag.datoer[0]?.dato ?? null);
  const [fravaerKortApen, setFravaerKortApen] = useState<{ nyLinje: boolean } | null>(null);
  const [fravaerNonce, settFravaerNonce] = useState(0);
  const fravaerDag = useMemo(() => {
    const db = hentDatabase();
    return db && bruker?.id && fravaerDato ? hentFravaerKortDag(db, { userId: bruker.id, dato: fravaerDato }) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fravaerNonce/sendtNonce: les datoen på nytt etter lagring/sending
  }, [bruker?.id, fravaerDato, fravaerNonce, sendtNonce]);
  // U12/U3: bare datoens eksakte norm — ukjent norm gir tomt felt og intet tak, aldri en annen dags.
  const fravaerNorm = useMemo(
    () => (orgId && fravaerDato ? (hentDagsnormLokalt(orgId, fravaerDato, undefined, { kunEksakt: true })?.dagsnorm ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- normNonce: svaret for datoen er hentet og cachet
    [orgId, fravaerDato, normNonce],
  );
  const chipDato = beregnet?.forslag.datoer[0]?.dato ?? null;
  const aktivitetIdForChip = beregnet?.forslag.aktivitetId ?? null;
  const beskrivelseChipsPerProsjekt = useMemo(() => {
    const db = hentDatabase();
    const ut = new Map<string, string[]>();
    if (!db || !bruker?.id || !chipDato) return ut;
    const aktivitet = aktiviteter.find((a) => a.id === aktivitetIdForChip)?.navn ?? null;
    for (const p of arbeidProsjekter) {
      const siste = sisteBeskrivelser(db, { userId: bruker.id, projectId: p, dato: chipDato });
      ut.set(p, beskrivelseChips(siste, aktivitet));
    }
    return ut;
  }, [arbeidProsjekter, bruker?.id, chipDato, aktiviteter, aktivitetIdForChip]);

  const settBeskrivelse = useCallback((nokkel: string, tekst: string) => {
    setRetting((r) => ({ ...r, beskrivelse: { ...r.beskrivelse, [nokkel]: tekst } }));
    endret();
  }, [endret]);

  // Ordre c (spec § 5.1): «Del til eget kort» og underprosjekt pr. kort.
  const [delKort, setDelKort] = useState<BeskrivelseKort | null>(null);
  const delKortNaa = useCallback(
    (kl: string) => {
      const k = delKort;
      setDelKort(null);
      if (!k?.kortId) return;
      setRetting((r) => delTilEgetKort(r, { dato: k.dato, fraKortId: k.kortId!, fra: kl }, randomUUID));
      endret();
    },
    [delKort, endret],
  );
  const angreDeling = useCallback(
    (k: BeskrivelseKort) => {
      if (!k.kortId) return;
      setRetting((r) => angreKortDeling(r, k.kortId!));
      endret();
    },
    [endret],
  );
  const fjernForeldrelos = useCallback(
    (nokkel: string) => {
      setRetting((r) => {
        const { [nokkel]: _fjernet, ...resten } = r.beskrivelse ?? {};
        return { ...r, beskrivelse: resten };
      });
      endret();
    },
    [endret],
  );

  // Rød ramme + rull til første tomme felt + fokus. Ingen Alert, ingen toast.
  const visTomBeskrivelse = useCallback((nokler: string[]) => {
    setForsoktBekreft(true);
    const forste = nokler[0];
    if (!forste) return;
    const y = beskrivelseY.current.get(forste);
    if (y != null) rulleRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    beskrivelseFelt.current.get(forste)?.focus();
  }, []);
  // RETUR 36c pkt 3: feltet det skrives i ruller over tastaturet når det er oppe.
  // RETUR 36c-2 (D4): målet er selve tekstfeltet (kortets y + feltets y), ikke
  // kortets topp — chips over feltet ruller ut av syne og kan ikke treffes.
  const rullTilBeskrivelse = useCallback((nokkel: string) => {
    const rull = () => {
      const y = beskrivelseY.current.get(nokkel);
      if (y == null) return;
      const feltY = beskrivelseFeltY.current.get(nokkel) ?? 0;
      rulleRef.current?.scrollTo({ y: Math.max(0, y + feltY - 16), animated: true });
    };
    if (Keyboard.isVisible()) {
      rull();
      return;
    }
    const lytter = Keyboard.addListener("keyboardDidShow", () => {
      lytter.remove();
      rull();
    });
    setTimeout(() => lytter.remove(), 1500);
  }, []);
  const byggeplasser = useMemo(
    () => (prosjektId ? hentByggeplasserForProsjektLokalt(prosjektId) : []),
    [prosjektId],
  );
  // Ordre (17): stedsnavn for reisekjeden («Reise Kontor → Byggeplass»).
  const stedNavn = useMemo(() => {
    const m = new Map<string, string>();
    if (!orgId) return m;
    for (const o of hentOppmotederLokalt(orgId)) if (o.navn) m.set(o.id, o.navn);
    for (const b of hentByggeplasserForFirmaLokalt(orgId)) if (b.navn) m.set(b.id, b.navn);
    return m;
  }, [orgId]);
  // Ordre (17) punkt 3: dagens bekreftede besøk — målt ankomst (kun lesing).
  const besok = useMemo(() => {
    const db = hentDatabase();
    return db && !manuell && params.arbeidsdagId ? hentBesok(db, params.arbeidsdagId) : [];
  }, [manuell, params.arbeidsdagId]);
  // POST (8) TILLEGG punkt 4: firmaets byggeplasser for den gule GPS-linja
  // (forslaget kan høre til et annet prosjekt enn kortets).
  const firmaByggeplasser = useMemo(
    () => (manuell && orgId ? hentByggeplasserForFirmaLokalt(orgId) : []),
    [manuell, orgId],
  );
  // ORDRE 36c (rettelse S2): valgfritt underprosjekt i manuell modus. Vises når
  // prosjektet har aktive underprosjekter (K3, til firmavalget i 36d-2). Tomt
  // ved åpning, forhåndsvelges aldri; nytt trykk på valgt chip tømmer.
  const underprosjekter = useMemo(
    () =>
      manuell && prosjektId
        ? hentUnderprosjekterLokalt(prosjektId)
            .map((e) => ({ id: e.id, navn: `${e.proAdmId} — ${e.kortNavn}` }))
            .sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true }))
        : [],
    [manuell, prosjektId],
  );
  const [ecoId, setEcoId] = useState<string | null>(null);
  // Ordre c (spec § 5.1): underprosjekt pr. kort — også i GPS-modus. Kortets
  // valg står i `retting.ecoPerKort`; uten eget valg gjelder dagens valg over
  // (manuell modus, forslagets prosjekt), ellers «Uten».
  const underprosjekterPerProsjekt = useMemo(() => {
    const ut = new Map<string, Array<{ id: string; navn: string }>>();
    for (const k of arbeidKort) {
      if (ut.has(k.projectId)) continue;
      ut.set(
        k.projectId,
        hentUnderprosjekterLokalt(k.projectId)
          .map((e) => ({ id: e.id, navn: `${e.proAdmId} — ${e.kortNavn}` }))
          .sort((a, b) => a.navn.localeCompare(b.navn, "nb", { numeric: true })),
      );
    }
    return ut;
  }, [arbeidKort]);
  const antallKortPaaProsjekt = useCallback(
    (projectId: string | null) => arbeidKort.filter((k) => k.projectId === projectId).length,
    [arbeidKort],
  );
  const ecoForKort = useCallback(
    (k: BeskrivelseKort): string | null => {
      const valgt = retting.ecoPerKort?.[k.nokkel];
      if (valgt !== undefined) return valgt;
      return manuell && k.projectId === prosjektId ? ecoId : null;
    },
    [retting.ecoPerKort, manuell, prosjektId, ecoId],
  );
  // Prosjektbytte nullstiller underprosjektet — men ikke et valg gjenopprettet
  // fra utkastet: grunnlinjen settes først når utkastet er lest.
  const ecoProsjektRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!utkastLastet) return;
    if (ecoProsjektRef.current === undefined) {
      ecoProsjektRef.current = prosjektId;
      return;
    }
    if (ecoProsjektRef.current !== prosjektId) {
      ecoProsjektRef.current = prosjektId;
      setEcoId(null);
    }
  }, [prosjektId, utkastLastet]);

  // UTKAST: nøkkel og delta for denne skjermen — leses av flush-punktene.
  const utkastNokkel = manuell
    ? manuellUtkastNokkel(manuellDato)
    : params.arbeidsdagId
      ? gpsUtkastNokkel(params.arbeidsdagId)
      : null;
  const utkastData: UtkastData = {
    retting,
    tilleggPerRad,
    lonnUtlegg,
    valgtByggeplassId,
    rettetSluttIso: manuell ? null : rettetSluttIso,
    ecoId: manuell ? ecoId : null,
  };
  const utkastDato = manuell ? manuellDato : dag ? lokalIsoDato(new Date(dag.startAt)) : null;
  utkastKontekstRef.current =
    bruker?.id && utkastNokkel && utkastDato
      ? {
          userId: bruker.id,
          orgId,
          nokkel: utkastNokkel,
          dato: utkastDato,
          arbeidsdagId: manuell ? null : params.arbeidsdagId,
          data: utkastData,
        }
      : null;
  const utkastInnhold = !erTomtUtkast(utkastData);

  // Gjenoppretting (én gang): utkastets rettinger legges oppå FERSKT forslag.
  // Anslått slutt må godkjennes på nytt (`sluttGodkjent` gjenopprettes ikke).
  useEffect(() => {
    if (utkastLastet || !bruker?.id || !orgId) return;
    if (!manuell && !dag) return;
    const db = hentDatabase();
    if (!db) return;
    const nokkel = manuell ? manuellUtkastNokkel(manuellDato) : gpsUtkastNokkel(params.arbeidsdagId);
    lagretNokkelRef.current = nokkel;
    const u = finnUtkast(db, { userId: bruker.id, orgId, nokkel });
    if (u) {
      const d = u.data;
      setRetting(nyttKortFroe(d.retting ?? {}));
      setTilleggPerRad(d.tilleggPerRad ?? {});
      setLonnUtlegg(d.lonnUtlegg ?? { tillegg: [], utlegg: [] });
      setValgtByggeplassId(d.valgtByggeplassId ?? undefined);
      if (!manuell && d.rettetSluttIso) setRettetSluttIso(d.rettetSluttIso);
      if (manuell) setEcoId(d.ecoId ?? null);
      setGjenopprettetTid(formaterKlokke(new Date(u.sistEndret)));
    }
    setUtkastLastet(true);
  }, [utkastLastet, bruker?.id, orgId, manuell, dag, manuellDato, params.arbeidsdagId, nyttKortFroe]);

  // L3-D: vakten leser datoens sedel (om den finnes) + forslagets nye rader.
  const grunnlagPerDato = useMemo(() => {
    const db = hentDatabase();
    const ut = new Map<string, VaktGrunnlag | null>();
    if (!db || !beregnet || !bruker?.id) return ut;
    for (const d of beregnet.forslag.datoer) ut.set(d.dato, vaktGrunnlag(db, bruker.id, beregnet.forslag, d.dato));
    return ut;
  }, [beregnet, bruker?.id]);
  const tilleggKatalog = useTilleggKatalog(orgId);
  const settRadTillegg = useCallback((nokkel: string, neste: BekreftDagTillegg) => {
    setTilleggPerRad((tl) => {
      const ny = { ...tl };
      if (neste.maskiner.length === 0 && neste.varer.length === 0) delete ny[nokkel];
      else ny[nokkel] = neste;
      return ny;
    });
    endret();
  }, [endret]);

  // Prosjektbytte flytter linjene med (de følger raden); byggeplassen gjettes ikke på nytt.
  useEffect(() => {
    if (!prosjektId) return;
    setTilleggPerRad((tl) => {
      const alleRiktige = Object.values(tl).every(
        (x) => x.maskiner.every((m) => m.projectId === prosjektId) && x.varer.every((v) => v.projectId === prosjektId),
      );
      if (alleRiktige) return tl;
      return Object.fromEntries(
        Object.entries(tl).map(([k, x]) => [
          k,
          {
            maskiner: x.maskiner.map((m) => ({ ...m, projectId: prosjektId })),
            varer: x.varer.map((v) =>
              v.projectId === prosjektId ? v : { ...v, projectId: prosjektId, byggeplassId: null },
            ),
          },
        ]),
      );
    });
  }, [prosjektId]);

  // Ordre c: beskrivelser uten kort — vises for seg; Bekreft stopper på dem.
  const foreldrelose = useMemo(() => (beregnet ? foreldreloseBeskrivelser(beregnet.forslag) : []), [beregnet]);
  // Linjer på en rad som ikke finnes lenger — vises for seg; Bekreft stopper på dem.
  const utenRad = useMemo(
    () => (beregnet ? tilleggUtenRad(beregnet.forslag, tilleggPerRad) : []),
    [beregnet, tilleggPerRad],
  );

  const rettDato = useCallback(
    (dato: string, endring: DagsforslagRettingDato) => {
      setRetting((r) => ({
        ...r,
        perDato: { ...r.perDato, [dato]: { ...r.perDato?.[dato], ...endring } },
      }));
      endret();
    },
    [endret],
  );
  // ORDRE (28) V7: forsvinner en linje (tidene endret), faller valget bort med den.
  useEffect(() => {
    if (!beregnet) return;
    for (const d of beregnet.forslag.datoer) {
      const rett = retting.perDato?.[d.dato];
      if (d.blokkert || rett?.fjernArbeid) continue;
      const rydd = ryddLonnsartPerLinje(rett?.lonnsartPerLinje, linjerIDag(d));
      if (rydd) rettDato(d.dato, rydd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun når forslaget er regnet på nytt
  }, [beregnet]);
  const fjernKvittering = useCallback((sti: string) => {
    fjernetKvitteringer.current.add(sti);
  }, []);
  const endreLonnUtlegg = useCallback(
    (neste: (forrige: LonnUtlegg) => LonnUtlegg) => {
      setLonnUtlegg(neste);
      endret();
    },
    [endret],
  );

  useEffect(() => {
    pendingKvitteringer.current = lonnUtlegg.utlegg.flatMap((u) => (u.kvittering ? [u.kvittering.lokalSti] : []));
  }, [lonnUtlegg]);
  // Skjermen forlates uten at Bekreft skrev: siste flush, og kun filer som
  // utkastet IKKE eier slettes (feilet flush / tomt utkast). Raden eier resten.
  useEffect(
    () => () => {
      let eide: string[] = [];
      let flushFeilet = false;
      try {
        skrivUtkastNaa();
        const k = utkastKontekstRef.current;
        const db = hentDatabase();
        const nokkel = lagretNokkelRef.current;
        if (k && db && k.orgId && nokkel) {
          eide = finnUtkast(db, { userId: k.userId, orgId: k.orgId, nokkel })?.kvitteringer ?? [];
        }
      } catch {
        eide = [];
        flushFeilet = true;
      }
      for (const sti of pendingKvitteringer.current) {
        if (!eide.includes(sti)) void slettLokaltBilde(sti);
      }
      // Fjernede kvitteringer som siste skrevne utkast ikke lenger eier. Feilet
      // flushen, kan forrige rad fortsatt eie fila — da blir den stående.
      if (!flushFeilet) for (const sti of fjernetKvitteringer.current) {
        if (!eide.includes(sti)) void slettLokaltBilde(sti);
      }
    },
    [skrivUtkastNaa],
  );

  // «Ikke nå» / «Fortsett senere» / «Lukk» / pil: lagre først, så tilbake.
  const ikkeNaa = useCallback(() => {
    skrivUtkastNaa();
    router.back();
  }, [router, skrivUtkastNaa]);

  const forkast = useCallback(() => {
    const k = utkastKontekstRef.current;
    if (!k) return;
    Alert.alert(
      t("timer.utkast.forkastTittel"),
      t("timer.utkast.forkastTekst", { dato: formatNorskDato(k.dato) }),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        {
          text: t("timer.utkast.forkast"),
          style: "destructive",
          onPress: () => {
            if (utkastTimerRef.current) clearTimeout(utkastTimerRef.current);
            utkastTimerRef.current = null;
            harEndretRef.current = false;
            const db = hentDatabase();
            const nokkel = lagretNokkelRef.current ?? k.nokkel;
            const ferdig = () => router.back();
            if (!db || !k.orgId) return ferdig();
            void forkastUtkast(db, { userId: k.userId, orgId: k.orgId, nokkel }).finally(ferdig);
          },
        },
      ],
    );
  }, [router, t]);

  const avsluttUtenTimer = useCallback(() => {
    const db = hentDatabase();
    if (!db || !params.arbeidsdagId || !sluttIso) return;
    const arbeidsdagId = params.arbeidsdagId;
    const utfor = () => {
      // Dagen avsluttes og utkastet slettes i én transaksjon; filene etter commit.
      if (utkastTimerRef.current) clearTimeout(utkastTimerRef.current);
      utkastTimerRef.current = null;
      harEndretRef.current = false;
      const kvitteringer = avsluttDagUtenSedel(db, {
        arbeidsdagId,
        sluttIso,
        endLat,
        endLng,
        naa: Date.now,
        sluttSted: identifiserByggeplass(endLat, endLng, orgId),
        nyId: randomUUID,
        utkast: bruker?.id && orgId
          ? { userId: bruker.id, orgId, nokkel: gpsUtkastNokkel(arbeidsdagId) }
          : undefined,
      });
      for (const sti of kvitteringer) void slettLokaltBilde(sti);
      oppdaterTellere();
      router.back();
    };
    if (!utkastInnhold) return utfor();
    Alert.alert(t("timer.utkast.avsluttUtenTimerTittel"), t("timer.utkast.avsluttUtenTimerTekst"), [
      { text: t("handling.avbryt"), style: "cancel" },
      { text: t("timer.bekreftDag.avsluttUtenTimer"), style: "destructive", onPress: utfor },
    ]);
  }, [params.arbeidsdagId, sluttIso, endLat, endLng, orgId, bruker?.id, utkastInnhold, oppdaterTellere, router, t]);

  const bekreft = useCallback(() => {
    const db = hentDatabase();
    // Dobbelttrykk mens lagring pågår: knappen viser laste-indikator.
    if (lagrer) return;
    // TILLEGG (33) pkt 4.1: fraværskortet uten beskrivelse sperrer (F4, TF9). Intet prosjekt
    // valgt i manuell modus, men fraværskortet er lagret → arbeidskortet er ikke påbegynt, og
    // `manglerProsjekt` gjelder bare arbeidskort (U8): skjermen går til dagen. GPS-dagen har
    // arbeid som skal lagres, så der gjelder sperren som før.
    const fravaerUtfall = fravaerVedBekreft({
      manglerProsjekt: manuell && beregnet?.forslag.prosjektId == null,
      fravaerRader: fravaerDag?.fravaerRader ?? [],
    });
    if (fravaerUtfall === "manglerBeskrivelse") {
      Alert.alert(t("timer.bekreftDag.sperre.tittel"), t("timer.fravaerKort.sperret.manglerBeskrivelse"));
      setFravaerKortApen({ nyLinje: false });
      return;
    }
    if (fravaerUtfall === "tilDagen" && fravaerDag?.sheetId) {
      if (laastDato) router.back();
      else router.replace(`/timer/${fravaerDag.sheetId}`);
      return;
    }
    // DEL 5 a: ingen sperre er stille — hver sier hva som mangler.
    const sperre = bekreftSperre({
      harDb: db != null,
      harBeregnet: beregnet != null,
      harBruker: !!bruker?.id,
      manuell,
      harArbeidsdagId: !!params.arbeidsdagId,
      manglerProsjekt: beregnet?.forslag.prosjektId == null,
      sluttIkkeGodkjent,
      // Ordre (17) punkt 2: overlapp/over midnatt sperrer lagring; begrunnelsen står i kortet.
      kjedeKonflikt: beregnet?.forslag.datoer.some((d) => !d.blokkert && d.kjedeKonflikt) ?? false,
      // ORDRE (28) V2/T19: linje med «Velg lønnsart» sperrer til arbeideren har valgt.
      manglerLonnsart:
        beregnet?.forslag.datoer.some(
          (d) => !d.blokkert && !retting.perDato?.[d.dato]?.fjernArbeid && (d.linjerUtenLonnsart?.length ?? 0) > 0,
        ) ?? false,
    });
    if (sperre || !db || !beregnet || !bruker?.id) {
      Alert.alert(
        t("timer.bekreftDag.sperre.tittel"),
        t(`timer.bekreftDag.sperre.${sperre ?? "ikkeKlar"}`),
      );
      return;
    }
    // ORDRE 36a: påkrevd beskrivelse — sperren står FØR noe skrives.
    const tomme = manglerBeskrivelse(beregnet.forslag);
    if (tomme.length > 0) {
      visTomBeskrivelse(tomme);
      return;
    }
    setLagrer(true);
    try {
      const { forslag } = beregnet;
      // UTKAST: debounce nulles FØR Bekreft (en sen lagring skal ikke gjenskape
      // utkastet etter slettingen), og siste retting skrives — stopper Bekreft,
      // står utkastet med det arbeideren så.
      if (utkastTimerRef.current) clearTimeout(utkastTimerRef.current);
      utkastTimerRef.current = null;
      skrivUtkastNaa();
      const { handling, resultat } = bekreftDag(db, forslag, {
        userId: bruker.id,
        orgId,
        erAnsatt: erAnsatt ?? null,
        nyId: randomUUID,
        naa: Date.now,
        arbeidsdagId: manuell ? null : params.arbeidsdagId,
        ecoId: manuell ? ecoId : null,
        // Ordre c: underprosjekt pr. kort (også GPS-modus).
        ecoPerKort: retting.ecoPerKort,
        // RETUR 36c-3: eksplisitt «Ingen byggeplass» i manuell modus løfter
        // arven på en eksisterende sedel med byggeplass. GPS-veien: som før.
        utenByggeplassValgt: manuell && retting.byggeplassId === null,
        sluttIso: effSluttIso,
        endLat,
        endLng,
        sluttSted: manuell ? null : identifiserByggeplass(endLat, endLng, orgId),
        utkastNokkel: utkastNokkel ?? undefined,
      }, tilleggPerRad, knyttLonnUtleggTilKort(lonnUtlegg, arbeidKort, forslag));
      // Sedel skrevet → utkastet er slettet i `bekreftDag`; ingenting å flushe.
      if (resultat?.forsteLagredeSheetId != null) harEndretRef.current = false;
      if (handling.type === "tilleggUtleggUtenDag") {
        // Ingenting er skrevet — alle datoer er sendt (også om de ble sendt mellom
        // forslag og Bekreft); skjermen står, linjene og kvitteringene beholdes.
        Alert.alert(
          t("timer.bekreftDag.tilleggUtlegg.utenDagTittel"),
          t("timer.bekreftDag.tilleggUtlegg.utenDagTekst"),
        );
        return;
      }
      if (handling.type === "datoSendtUnderveis") {
        // ORDRE (26): ingenting er skrevet — datoen ble sendt mens skjermen sto.
        // Kortene regnes ut på nytt uten den; nytt trykk på Bekreft er en ren retry.
        settSendtNonce((n) => n + 1);
        Alert.alert(
          t("timer.bekreftDag.sendtUnderveis.tittel"),
          t("timer.bekreftDag.sendtUnderveis.tekst", {
            datoer: handling.datoer.map(formatNorskDato).join(", "),
          }),
        );
        return;
      }
      if (handling.type === "sedelIAnnetFirma") {
        // Gate (34): ingenting er skrevet — en dato kan bare ha én sedel (ett firma).
        Alert.alert(t("timer.sedelIAnnetFirma.tittel"), t("timer.sedelIAnnetFirma.melding"));
        return;
      }
      if (handling.type === "tilleggUtenRad") {
        // Ingenting er skrevet — linjene står under «Uten rad» til arbeideren fjerner dem.
        Alert.alert(t("timer.bekreftDag.tillegg.utenRadTittel"), t("timer.bekreftDag.tillegg.utenRadMelding"));
        return;
      }
      if (handling.type === "maskinBrudd") {
        // Ingenting er skrevet — skjermen står, arbeideren justerer maskintimene.
        Alert.alert(t("timer.bekreftDag.tillegg.bruddTittel"), t("timer.maskin.overstigerArbeid"));
        return;
      }
      if (handling.type === "manglerBeskrivelse") {
        // Sikkerhetsnett — ingenting er skrevet, skjermen står.
        visTomBeskrivelse(handling.nokler);
        return;
      }
      if (resultat?.lonnUtleggSkrevet) {
        // Linjene er skrevet: filene eies nå av utleggs-vedleggene (ikke rydd ved
        // unmount), og kvitteringene køes ETTER at radene finnes (server-row-orden).
        pendingKvitteringer.current = [];
        setLonnUtlegg({ tillegg: [], utlegg: [] });
        for (const ko of resultat.utleggKo ?? []) void leggIKo(ko);
      }
      oppdaterTellere();
      void triggerSync();
      // Utfallene fra «Slutt dag» (H7), nå bak Bekreft.
      switch (handling.type) {
        case "suksess":
          // Fra prosjektkortet (låst dato): tilbake dit — kortet leser på nytt ved fokus.
          if (laastDato) router.back();
          else router.replace(`/timer/${handling.sheetId}`);
          // B6.3-markør: normen var ikke dagens server-svar → si det.
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
        case "delvisSendt":
          // DEL 5 a: noe ble lagret, noe ble stoppet av en sendt sedel — økten er lukket.
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.delvisSendt.tittel"),
            t("timer.delvisSendt.melding", {
              lagret: handling.lagret.map(formatNorskDato).join(", "),
              blokkert: handling.blokkert.map(formatNorskDato).join(", "),
            }),
          );
          break;
        case "blokkertSendt":
          // Dagen står ÅPEN — timene reddes ved at lederen returnerer sedelen.
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(t("timer.appendSendt.tittel"), t("timer.appendSendt.melding"));
          break;
        case "playVek":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t("timer.playVek.tittel"),
            t("timer.playVek.melding", { intervaller: handling.intervaller }),
          );
          break;
        case "forKort":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(
            t(handling.preFylt ? "timer.forKort.preFyltTittel" : "timer.forKort.tittel"),
            t(handling.preFylt ? "timer.forKort.preFyltMelding" : "timer.forKort.melding"),
          );
          break;
        case "manglerLonnsart":
          router.replace(`/timer/${handling.sheetId}`);
          Alert.alert(t("timer.manglerLonnsart.tittel"), t("timer.manglerLonnsart.hjelp"));
          break;
        case "ikkeAnsatt":
          Alert.alert(
            t("timer.kildeManglet.tittel"),
            t("timer.ikkeAnsatt", { firma: valgtFirma?.name ?? "" }),
          );
          break;
        case "kildeManglet":
          // A5: «Velg prosjekt» i skjermen erstatter onNyRad-fallbacken.
          Alert.alert(t("timer.kildeManglet.tittel"), t("timer.kildeManglet.melding"));
          break;
        case "prosjektUkjent":
          Alert.alert(t("timer.prosjektUkjent.tittel"), t("timer.prosjektUkjent.melding"));
          break;
      }
    } catch (e) {
      // Gate (34): sikkerhetsnett — forhåndssjekken i bekreftDag skal fange dette først.
      if (e instanceof SedelIAnnetFirmaFeil) {
        Alert.alert(t("timer.sedelIAnnetFirma.tittel"), t("timer.sedelIAnnetFirma.melding"));
        return;
      }
      throw e;
    } finally {
      setLagrer(false);
    }
  }, [beregnet, bruker?.id, manuell, laastDato, ecoId, params.arbeidsdagId, lagrer, orgId, erAnsatt, effSluttIso, endLat, endLng, oppdaterTellere, triggerSync, router, t, valgtFirma?.name, tilleggPerRad, visTomBeskrivelse, retting.byggeplassId, sluttIkkeGodkjent, lonnUtlegg, arbeidKort, leggIKo, skrivUtkastNaa, utkastNokkel, fravaerDag]);

  // A4-grenen (isolert): sedelen for den sendte datoen, for lenken.
  const sendtSedelId = useMemo(() => {
    if (!beregnet || !bruker?.id || !erAlleDatoerSendt(beregnet.forslag)) return null;
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ id: dagsseddelLocal.id })
        .from(dagsseddelLocal)
        .where(
          and(
            eq(dagsseddelLocal.userId, bruker.id),
            eq(dagsseddelLocal.dato, beregnet.forslag.datoer[0]!.dato),
          ),
        )
        .all()[0]?.id ?? null
    );
  }, [beregnet, bruker?.id]);

  const topp = (
    <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <Pressable onPress={ikkeNaa} hitSlop={12}>
        <ArrowLeft size={22} color="#1f2937" />
      </Pressable>
      <Text className="flex-1 text-lg font-semibold text-gray-900">
        {t(manuell ? "timer.bekreftDag.manuell.tittel" : "timer.bekreftDag.tittel")}
      </Text>
      <HjelpIkon
        tittel={t("timer.bekreftDag.utkastHjelpTittel")}
        tekst={t("timer.bekreftDag.utkastHjelpTekst")}
      />
    </View>
  );

  if ((!manuell && !dag) || !beregnet || erAnsatt === undefined || (!!orgId && !utkastLastet)) {
    return (
      <ModalFlate className="bg-gray-50">
        {topp}
        <View className="flex-1 items-center justify-center">
          {dag || manuell ? <ActivityIndicator /> : (
            <Text className="text-sm text-gray-500">{t("timer.bekreftDag.ingenAapenDag")}</Text>
          )}
        </View>
      </ModalFlate>
    );
  }

  const { forslag, input } = beregnet;
  const alleRader = forslag.datoer.flatMap((d) => d.rader);
  const sum = alleRader.reduce((s, r) => s + r.timer, 0);
  const forsteDag = forslag.datoer[0];
  const sisteDag = forslag.datoer[forslag.datoer.length - 1];
  const anslaatt = !manuell && (sisteSegmentKilde === "system" || forslag.kappet);
  const norm = forsteDag ? input.effektivPerDato[forsteDag.dato]?.dagsnorm : undefined;
  const otNivaa = new Map(
    input.alleLonnsarter.map((l) => [l.id, l.overtidsnivaa] as const),
  );
  // ORDRE 34 pkt 4: nivå-chips — kun aktive lønnsarter med overtidsnivå.
  const overtidValg = input.alleLonnsarter
    .filter((l) => l.aktiv && l.overtidsnivaa != null)
    .sort((a, b) => a.rekkefolge - b.rekkefolge)
    .map((l) => ({ id: l.id, navn: l.navn ?? `${l.overtidsnivaa}%` }));
  const prosjektNavn = prosjekter.find((p) => p.id === prosjektId)?.name ?? null;
  // POST (8) TILLEGG punkt 4: samme GPS-forslag som Hjem, vist gult under
  // Byggeplass når det avviker fra kortet. Kun informasjon — kortet endres ikke.
  const gpsLinje = manuell ? gpsForslagLinje({
    gpsByggeplassId,
    kortDato: forsteDag?.dato,
    iDag: lokalIsoDato(new Date()),
    prosjektId,
    byggeplassId: forsteDag?.byggeplassId,
    firmaByggeplasser,
    prosjektNavn: (id) => prosjekter.find((p) => p.id === id)?.name ?? null,
  }) : null;
  const aktivitetNavn =
    aktiviteter.find((a) => a.id === forslag.aktivitetId)?.navn ?? null;

  // Grenene (§ 3.1). A4 venter Kenneth: sendt dag → lesemodus, [Lukk], dagen åpen.
  const alleSendt = erAlleDatoerSendt(forslag);
  const ikkeAnsatt = erAnsatt === false;
  const tomt = !ikkeAnsatt && erTomtForslag(forslag);
  const manglerProsjekt = prosjektId == null;
  // DEL 5 a: datoer med sendt sedel vises FØR lagring — timene der lagres ikke.
  const sendte = sendteDatoer(forslag);
  // DEL 5 d-tillegg: hver dato med timer blir et eget prosjektkort (egen sedel, egen rad).
  const kortPrDato = forslag.datoer.filter((d) => !d.blokkert && d.rader.length > 0).length;
  const startIso = forsteDag?.segmentStartIso ?? dag?.startAt ?? "";
  const slutt = visSluttTid(startIso, sisteDag?.segmentSluttIso ?? effSluttIso ?? startIso);
  const sluttTekst = slutt.dato ? `${kortDato(slutt.dato)} ${slutt.tid}` : slutt.tid;
  const flyttSlutt = (stegMin: number) => {
    if (!dag) return;
    setRettetSluttIso(
      stegSluttIso(sisteDag?.segmentSluttIso ?? effSluttIso ?? dag.startAt, dag.startAt, stegMin),
    );
    // Tidsrettingene hørte til forrige slutt.
    setRetting((r) => ({ ...r, perDato: undefined }));
    endret();
  };

  // «Fortsett senere» når et utkast finnes — teksten lover at kortet ligger der.
  const sekundarKnapp = utkastInnhold ? (
    <View className="gap-1">
      <Knapp tekst={t("timer.bekreftDag.fortsettSenere")} onPress={ikkeNaa} sekundaer />
      <Text className="text-center text-xs text-gray-500">{t("timer.bekreftDag.fortsettSenereHint")}</Text>
    </View>
  ) : (
    <Knapp tekst={t("timer.bekreftDag.ikkeNaa")} onPress={ikkeNaa} sekundaer />
  );

  return (
    <ModalFlate className="bg-gray-50">
      {manuell && oppmote.trengerValg && !oppmoteFerdig ? (
        <OppmoteSporsmaalArk
          orgId={orgId}
          onVelg={async (id) => {
            await oppmote.velg(id);
            setOppmoteFerdig(true);
          }}
          onLukk={() => setOppmoteFerdig(true)}
        />
      ) : null}
      {topp}
      <ScrollView
        ref={rulleRef}
        contentContainerClassName="gap-3 p-4"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        {gjenopprettetTid ? (
          <Text className="text-sm text-gray-500">
            {t("timer.utkast.gjenopprettet", { tid: gjenopprettetTid })}
          </Text>
        ) : null}
        {manuell && !laastDato ? (
          <View>
            <Text className="mb-1 text-sm font-medium text-gray-700">{t("timer.felt.dato")}</Text>
            <Pressable
              onPress={() => setVisDatoVelger((v) => !v)}
              className="flex-row items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Calendar size={18} color="#6b7280" />
                <Text className="text-base text-gray-900">{formatNorskDato(manuellDato)}</Text>
              </View>
              <ChevronRight size={18} color="#9ca3af" />
            </Pressable>
            {visDatoVelger && (
              <DatoVelgerFelt
                value={new Date(`${manuellDato}T00:00:00`)}
                mode="date"
                iosDisplay="inline"
                onChange={(_, valgt) => {
                  if (Platform.OS !== "ios") setVisDatoVelger(false); // Android lukker selv
                  if (!valgt) return;
                  const ny = lokalIsoDato(valgt);
                  if (ny === manuellDato) return;
                  const db = hentDatabase();
                  // Et ikke bekreftet kort finnes alt på måldatoen: åpne det, aldri overskriv.
                  if (db && bruker?.id && orgId && finnUtkast(db, { userId: bruker.id, orgId, nokkel: manuellUtkastNokkel(ny) })) {
                    Alert.alert(
                      t("timer.utkast.finnesPaaDato", { dato: formatNorskDato(ny) }),
                      undefined,
                      [
                        { text: t("handling.avbryt"), style: "cancel" },
                        {
                          text: t("timer.utkast.aapne"),
                          onPress: () => {
                            skrivUtkastNaa();
                            router.replace(`/timer/bekreft-dag?opprinnelse=manuell&dato=${ny}`);
                          },
                        },
                      ],
                    );
                    return;
                  }
                  setManuellDato(ny);
                  // Tidsrettingene hørte til forrige dato; prosjekt og beskrivelse følger med.
                  setRetting((r) => ({ ...r, perDato: undefined }));
                  // Utkastet flytter med (fra lagret nøkkel til ny dato).
                  endret();
                }}
                onLukk={() => setVisDatoVelger(false)}
              />
            )}
          </View>
        ) : null}

        {/* Topplinje: dato · start/slutt · sum · norm */}
        <View className="rounded-lg border border-gray-200 bg-white p-3">
          <Text className="text-sm font-semibold text-gray-900">
            {t("timer.bekreftDag.topplinje", {
              dato: forsteDag?.dato ?? "",
              start: tilHHMM(startIso),
              slutt: sluttTekst,
              sum: formatTimer(sum),
            })}
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            {[
              anslaatt ? t("timer.bekreftDag.sluttAnslaatt") : null,
              norm != null && forslag.normStatus !== "ukjent"
                ? t("timer.bekreftDag.norm", { norm: formatTimer(norm) })
                : t("timer.normMarkor.ukjent.tittel"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {sluttPanel ? (
          // DEL 5 c: anslått slutt — godkjennes eller rettes før noe lagres.
          <View
            className={`gap-2 rounded-lg border p-3 ${
              sluttIkkeGodkjent ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
            }`}
          >
            <Text className="text-sm font-semibold text-gray-900">
              {t(rettetSluttIso ? "timer.bekreftDag.slutt.rettet" : "timer.bekreftDag.slutt.anslaatt", {
                slutt: sluttTekst,
              })}
            </Text>
            <Text className="text-xs text-gray-600">{t("timer.bekreftDag.slutt.hjelp")}</Text>
            <View className="flex-row gap-2">
              {[-60, -15, 15, 60].map((steg) => (
                <Pressable
                  key={steg}
                  onPress={() => flyttSlutt(steg)}
                  className="min-h-[40px] flex-1 items-center justify-center rounded-md border border-gray-300 bg-white active:bg-gray-100"
                >
                  <Text className="text-sm text-gray-800">
                    {t(`timer.bekreftDag.slutt.steg.${steg < 0 ? "minus" : "pluss"}${Math.abs(steg)}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {sluttIkkeGodkjent ? (
              <Pressable
                onPress={() => {
                  setSluttGodkjent(true);
                  endret();
                }}
                className="min-h-[44px] items-center justify-center rounded-md bg-amber-600 active:bg-amber-700"
              >
                <Text className="text-sm font-semibold text-white">
                  {t("timer.bekreftDag.slutt.godkjenn")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {alleSendt ? (
          <View className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">{t("timer.bekreftDag.alleredeSendt")}</Text>
            {sendte.map((dato) => (
              <Text key={dato} className="mt-1 text-sm text-amber-900">
                {t("timer.bekreftDag.datoSendt", { dato: kortDato(dato) })}
              </Text>
            ))}
            {sendtSedelId ? (
              <Pressable onPress={() => router.replace(`/timer/${sendtSedelId}`)} className="mt-2">
                <Text className="text-sm font-medium text-blue-700">
                  {t("timer.bekreftDag.aapneSedel")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {ikkeAnsatt ? (
          <View className="rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-800">
              {t("timer.ikkeAnsatt", { firma: valgtFirma?.name ?? "" })}
            </Text>
          </View>
        ) : null}

        {tomt ? (
          <View className="rounded-lg border border-gray-200 bg-white p-3">
            <Text className="text-sm font-semibold text-gray-900">
              {t("timer.bekreftDag.tomTittel")}
            </Text>
          </View>
        ) : null}

        {!alleSendt && !ikkeAnsatt && !tomt ? (
          <>
            {/* Prosjekt · byggeplass · aktivitet — gjelder hele dagen */}
            <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
              <Valgfelt
                etikett={t("timer.bekreftDag.prosjekt")}
                verdi={prosjektNavn ?? t("timer.bekreftDag.velgProsjekt")}
                feil={manglerProsjekt}
                onPress={() => setValgark("prosjekt")}
              />
              {!manglerProsjekt ? (
                <>
                  <Valgfelt
                    etikett={t("timer.bekreftDag.byggeplass")}
                    verdi={
                      byggeplasser.find((b) => b.id === forsteDag?.byggeplassId)?.navn ??
                      t("timer.bekreftDag.ingenByggeplass")
                    }
                    onPress={() => setValgark("byggeplass")}
                  />
                  {gpsLinje ? (
                    <Text className="text-xs text-amber-600" numberOfLines={2}>
                      {gpsLinje.prosjekt
                        ? t("timer.bekreftDag.gpsForeslarMedProsjekt", {
                            byggeplass: gpsLinje.byggeplass,
                            prosjekt: gpsLinje.prosjekt,
                          })
                        : t("timer.bekreftDag.gpsForeslar", { byggeplass: gpsLinje.byggeplass })}
                    </Text>
                  ) : null}
                  {/* Ordre c: med flere kort på prosjektet velges underprosjekt pr. kort (under hvert kort). */}
                  {underprosjekter.length > 0 && antallKortPaaProsjekt(prosjektId) <= 1 ? (
                    <View className="gap-1">
                      <Text className="text-sm text-gray-500">{t("timer.felt.underprosjekt")}</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {underprosjekter.map((e) => {
                          const valgt = ecoId === e.id;
                          return (
                            <Pressable
                              key={e.id}
                              onPress={() => {
                                setEcoId(valgt ? null : e.id);
                                endret();
                              }}
                              accessibilityState={{ selected: valgt }}
                              className={`min-h-[36px] justify-center rounded-full border px-3 ${
                                valgt ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white active:bg-gray-50"
                              }`}
                            >
                              <Text className={`text-sm ${valgt ? "text-white" : "text-gray-700"}`}>{e.navn}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                  <Valgfelt
                    etikett={t("timer.bekreftDag.aktivitet")}
                    verdi={aktivitetNavn ?? "—"}
                    onPress={() => setValgark("aktivitet")}
                  />
                </>
              ) : null}
            </View>

            {kortPrDato > 1 ? (
              <Text className="px-1 text-xs text-gray-600">
                {t("timer.bekreftDag.kortPrDato", { antall: kortPrDato })}
              </Text>
            ) : null}

            {forslag.datoer.map((d) =>
              d.blokkert ? (
                // DEL 5 a: sendt dato — vises før lagring, timene her lagres ikke.
                <View key={d.dato} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <Text className="text-sm text-amber-900">
                    {t("timer.bekreftDag.datoSendt", { dato: kortDato(d.dato) })}
                  </Text>
                </View>
              ) : (
              <DatoKort
                key={d.dato}
                dag={d}
                visDato={forslag.datoer.length > 1}
                fjernet={retting.perDato?.[d.dato]?.fjernArbeid === true}
                fjernetOverforing={retting.perDato?.[d.dato]?.fjernOverforing ?? []}
                otNivaa={otNivaa}
                overtidValg={overtidValg}
                alleLonnsarter={input.alleLonnsarter}
                rettetOvertidFra={retting.perDato?.[d.dato]?.overtidFra}
                overtidAv={retting.perDato?.[d.dato]?.overtidAv === true}
                lonnsartPerLinje={retting.perDato?.[d.dato]?.lonnsartPerLinje}
                linjeArter={linjeArter}
                rettetArbeidFra={retting.perDato?.[d.dato]?.arbeidFra}
                rettetReiseTid={retting.perDato?.[d.dato]?.reiseTid ?? {}}
                maaltAnkomst={maaltAnkomst(besok, d.dato)}
                stedNavn={stedNavn}
                tidsrunding={input.regel?.tidsrundingMinutter ?? null}
                onRett={(endring) => rettDato(d.dato, endring)}
              />
              ),
            )}

            {arbeidKort.map((k) => (
              <BekreftDagBeskrivelse
                key={k.nokkel}
                ref={(felt) => {
                  if (felt) beskrivelseFelt.current.set(k.nokkel, felt);
                  else beskrivelseFelt.current.delete(k.nokkel);
                }}
                onLayout={(e) => beskrivelseY.current.set(k.nokkel, e.nativeEvent.layout.y)}
                tastaturId={TASTATUR_ID}
                onFokus={() => rullTilBeskrivelse(k.nokkel)}
                onFeltY={(y) => beskrivelseFeltY.current.set(k.nokkel, y)}
                onInnholdEndret={() => rullTilBeskrivelse(k.nokkel)}
                prosjektNavn={kortNavn(k) || null}
                visProsjekt={arbeidKort.length > 1}
                verdi={retting.beskrivelse?.[k.nokkel] ?? ""}
                chips={beskrivelseChipsPerProsjekt.get(k.projectId) ?? []}
                visFeil={forsoktBekreft && manglerNokler.includes(k.nokkel)}
                onEndre={(tekst) => settBeskrivelse(k.nokkel, tekst)}
                tillegg={<>{(() => {
                  // Ordre c (spec § 5.1): underprosjekt pr. kort + «Del til eget kort».
                  if (alleSendt || ikkeAnsatt || tomt) return null;
                  const ups = underprosjekterPerProsjekt.get(k.projectId) ?? [];
                  const visEco = ups.length > 0 && (!manuell || antallKortPaaProsjekt(k.projectId) > 1);
                  const vindu = k.kortId
                    ? delingsVindu(
                        (raderPerKort.get(k.nokkel) ?? []).map((r) => ({ fraTid: r.fraTid, tilTid: r.tilTid, erReise: false })),
                        input.regel?.tidsrundingMinutter ?? null,
                      )
                    : null;
                  if (!visEco && !vindu && !k.egetKort) return null;
                  const valgtEco = ecoForKort(k);
                  const settEco = (id: string | null) => {
                    setRetting((r) => ({ ...r, ecoPerKort: { ...r.ecoPerKort, [k.nokkel]: id } }));
                    endret();
                  };
                  return (
                    <View className="gap-2">
                      {visEco ? (
                        <View className="gap-1">
                          <Text className="text-sm text-gray-500">{t("timer.felt.underprosjekt")}</Text>
                          <View className="flex-row flex-wrap gap-2">
                            {[{ id: null as string | null, navn: t("timer.bekreftDag.kort.utenUnderprosjekt") }, ...ups].map((e) => {
                              const valgt = valgtEco === e.id;
                              return (
                                <Pressable
                                  key={e.id ?? "uten"}
                                  onPress={() => settEco(e.id)}
                                  accessibilityState={{ selected: valgt }}
                                  className={`min-h-[36px] justify-center rounded-full border px-3 ${
                                    valgt ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white active:bg-gray-50"
                                  }`}
                                >
                                  <Text className={`text-sm ${valgt ? "text-white" : "text-gray-700"}`}>{e.navn}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                      {vindu || k.egetKort ? (
                        <View className="flex-row flex-wrap gap-4">
                          {vindu ? (
                            <Pressable onPress={() => setDelKort(k)} className="min-h-[36px] justify-center active:opacity-60">
                              <Text className="text-sm font-medium text-blue-700">{t("timer.bekreftDag.kort.delTilEgetKort")}</Text>
                            </Pressable>
                          ) : null}
                          {k.egetKort ? (
                            <Pressable onPress={() => angreDeling(k)} className="min-h-[36px] justify-center active:opacity-60">
                              <Text className="text-sm font-medium text-gray-600">{t("timer.bekreftDag.kort.slaaSammen")}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })()}{(() => {
                  // ORDRE 24 (Kenneth 2026-11-16): ETT sett maskin/varer pr. kort.
                  // Holdes under første arbeidsrads nøkkel; fordeles på radene ved
                  // Bekreft (`fordelTilleggPaaKort`). Vakten: maskin ≤ kortets sum.
                  // RETUR (24): kortet er én dato, så «+ Maskin» forvelger kortets
                  // timer (21–24 → 3 t) og ingenting flyttes over midnatt.
                  const rader = raderPerKort.get(k.nokkel) ?? [];
                  const forste = rader.find((x) => x.tilleggNokkel);
                  if (!forste || alleSendt || ikkeAnsatt || tomt || !bruker?.id) return null;
                  const egne = tilleggPaaKort(tilleggPerRad, rader);
                  return (
                    <BekreftDagRadTillegg
                      orgId={orgId}
                      userId={bruker.id}
                      projectId={k.projectId}
                      prosjektNavn={prosjekter.find((pr) => pr.id === k.projectId)?.name ?? ""}
                      dato={forste.dato}
                      byggeplassId={forste.byggeplassId}
                      radTimer={kortArbeidstimer(rader)}
                      grunnlag={grunnlagPerDato.get(forste.dato) ?? null}
                      andreMaskiner={maskinerForDato(forslag, tilleggPerRad, forste.dato).filter(
                        (m) => !egne.maskiner.some((e) => e.lokalId === m.lokalId),
                      )}
                      katalog={tilleggKatalog}
                      tillegg={egne}
                      onEndre={(neste) => {
                        setTilleggPerRad((tl) => settTilleggPaaKort(tl, rader, neste));
                        endret();
                      }}
                    />
                  );
                })()}</>}
              />
            ))}

            {foreldrelose.length > 0 ? (
              // Ordre c (spec § 5.1, T14): tekst hvis kort ikke finnes lenger (delingen
              // angret, tiden flyttet, gammelt utkast) — droppes aldri stille.
              <View className="gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <Text className="text-sm text-amber-900">{t("timer.bekreftDag.kort.utenKortMelding")}</Text>
                {foreldrelose.map((n) => (
                  <View key={n} className="flex-row items-center gap-2">
                    <Text className="flex-1 text-sm text-gray-900">{retting.beskrivelse?.[n]}</Text>
                    <Pressable
                      onPress={() => fjernForeldrelos(n)}
                      accessibilityLabel={t("timer.bekreftDag.kort.fjernTekst")}
                      className="h-9 w-9 items-center justify-center rounded-full active:bg-amber-100"
                    >
                      <Trash2 size={16} color="#92400e" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {utenRad.length > 0 ? (
              // PRESISERING TILLEGG: raden forsvant (fjernet arbeid, færre rader) —
              // linjene kastes aldri stille; arbeideren fjerner dem før Bekreft.
              <View className="gap-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <Text className="text-sm text-amber-900">{t("timer.bekreftDag.tillegg.utenRadMelding")}</Text>
                {utenRad.map((n) => (
                  <TilleggLinjer
                    key={n}
                    tillegg={tilleggPerRad[n] ?? { maskiner: [], varer: [] }}
                    onEndre={(neste) => settRadTillegg(n, neste)}
                  />
                ))}
              </View>
            ) : null}

            {/* POST (8) punkt 1: «+ Reise» — manuell modus. Radene legges i rettingen
                (utkastet) og skrives som erReise ved Bekreft. */}
            {manuell && !alleSendt && !ikkeAnsatt && !tomt && prosjektId ? (
              <View className="rounded-lg border border-gray-200 bg-white">
                {(retting.manuellReise ?? []).map((r0, i) => {
                  // Ordre (17): vis tidene slik reisekjeden har lagt dem.
                  const sekvensert = forslag.datoer
                    .flatMap((d) => d.rader)
                    .find((x) => x.kjedeNokkel === `manuell-${i}`);
                  const r = { ...r0, fraTid: sekvensert?.fraTid ?? r0.fraTid, tilTid: sekvensert?.tilTid ?? r0.tilTid };
                  return (
                  <View
                    key={`${i}-${r.fraTid ?? ""}`}
                    className="min-h-[44px] flex-row items-center gap-3 border-b border-gray-100 px-4 py-2"
                  >
                    <Car size={14} color="#6b7280" />
                    {/* Ordre (9): under terskel føres raden som arbeidstid. */}
                    <Text className="text-sm text-gray-500">
                      {t(
                        r.reiseSpor && !r.reiseSpor.erReise
                          ? "timer.prosjektkort.kolonne.arbeid"
                          : "timer.prosjektkort.kolonne.reise",
                      )}
                    </Text>
                    <Text className="flex-1 text-sm text-gray-900">
                      {r.fraTid && r.tilTid ? `${r.fraTid}–${r.tilTid} · ` : ""}
                      {formatTimer(r.timer)} {t("timer.timerEnhet")}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      accessibilityLabel={t("timer.bekreftDag.fjernReise")}
                      onPress={() =>
                        setRetting((x) => ({
                          ...x,
                          manuellReise: (x.manuellReise ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 size={16} color="#6b7280" />
                    </Pressable>
                  </View>
                  );
                })}
                {reiseKnappLonnsartId != null ? (
                  <Pressable
                    onPress={() => setReiseModalApen(true)}
                    className="min-h-[44px] justify-center px-4 active:bg-gray-50"
                  >
                    <Text className="text-sm font-medium text-gray-700">
                      + {t("timer.prosjektkort.kolonne.reise")}
                    </Text>
                  </Pressable>
                ) : null}
                {visReiseHint ? (
                  <Pressable
                    onPress={() =>
                      void apnLenke(`${hentWebUrl()}/dashbord/firma/innstillinger#reise-regelsett`)
                    }
                    className="min-h-[44px] justify-center px-4 active:bg-gray-50"
                  >
                    <Text className="text-xs text-gray-500">
                      {t(
                        visReiseHint === "flere"
                          ? "timer.prosjektkort.reiseSkjultFlere"
                          : "timer.prosjektkort.reiseSkjultIngen",
                      )}{" "}
                      <Text className="text-sitedoc-primary">
                        {t("timer.prosjektkort.reiseVelgLonnsart")}
                      </Text>
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {/* POST (13) L2 § 7 C: «+ Reise» → reise-kortet. Overføringen er alt en
                forslagsrad her (Fjern/Angre), så kortet tilbyr bare Tur/Retur. */}
            {reiseModalApen && reiseKnappLonnsartId != null && prosjektId && forsteDag && bruker?.id ? (
              <ReiseKort
                organizationId={orgId}
                userId={bruker.id}
                dato={forsteDag.dato}
                projectId={prosjektId}
                sedelByggeplassId={forsteDag.byggeplassId}
                aktivitetId={forslag.aktivitetId}
                dagsrader={forsteDag.rader.map((r) => ({
                  fraTid: r.fraTid,
                  tilTid: r.tilTid,
                  erReise: r.erReise,
                  erOverforing: !!r.overforing || r.reiseKilde === "overforing",
                }))}
                resolverLonnsartId={reiseKnappLonnsartId}
                medOverforing={false}
                onLagre={(l) => {
                  setRetting((x) => ({
                    ...x,
                    manuellReise: [
                      ...(x.manuellReise ?? []),
                      {
                        projectId: l.projectId,
                        byggeplassId: l.byggeplassId,
                        lonnsartId: l.lonnsartId,
                        aktivitetId: l.aktivitetId,
                        timer: l.timer,
                        fraTid: l.fraTid,
                        tilTid: l.tilTid,
                        reiseSpor: l.reiseSpor,
                      },
                    ],
                  }));
                  setReiseModalApen(false);
                }}
                onLukk={() => setReiseModalApen(false)}
              />
            ) : null}

            {/* ORDRE Tillegg/Utlegg i Bekreft dag — ORDRE 25: hver linje velger datokort og skrives på den datoens sedel. */}
            {!alleSendt && !ikkeAnsatt && !tomt && lonnUtleggProsjekt ? (
              <BekreftDagLonnUtlegg
                verdi={lonnUtlegg}
                onEndre={endreLonnUtlegg}
                organizationId={orgId}
                defaultProjectId={lonnUtleggProsjekt}
                prosjektValg={prosjekter.map((p) => ({ id: p.id, navn: p.name }))}
                kort={arbeidKort}
                standardKortFor={standardKortFor}
                kortEtikett={kortNavn}
                onFjernKvittering={fjernKvittering}
              />
            ) : null}

            {/* RETUR 36c pkt 4: manuell føring bruker aldri GPS — ingen reise-årsak. */}
            {!manuell && (forslag.reiseAarsak || forslag.destinasjonAarsak) ? (
              <Text className="px-1 text-xs text-gray-500">
                {t("timer.bekreftDag.ingenReise", {
                  aarsak: t(
                    `timer.bekreftDag.aarsak.${forslag.reiseAarsak ?? forslag.destinasjonAarsak}`,
                  ),
                })}
              </Text>
            ) : null}


            <Text className="px-1 text-xs text-gray-500">
              {t(manuell ? "timer.bekreftDag.manuell.hjelp" : "timer.bekreftDag.hjelp")}
            </Text>
          </>
        ) : null}
        {/* TILLEGG (33) pkt 4.1 — U1 inngang 2: «+ Fravær» i lenkeraden, også uten valgt prosjekt
            (U8). Kortet viser art og timer pr. linje og én beskrivelse (U5, U10, U11). */}
        {!alleSendt && !ikkeAnsatt && fravaerDag && !fravaerDag.laast ? (
          <View className="rounded-lg border border-gray-200 bg-white">
            {fravaerDag.fravaerRader.length > 0 ? (
              <Pressable
                onPress={() => setFravaerKortApen({ nyLinje: false })}
                className="border-b border-gray-100 px-4 py-2 active:bg-gray-50"
              >
                <Text className="text-sm font-semibold text-gray-900">{t("timer.fravaerKort.tittel")}</Text>
                {fravaerDag.fravaerRader.map((r) => (
                  <Text key={r.id} className="py-0.5 text-sm text-gray-700" style={{ fontVariant: ["tabular-nums"] }}>
                    {t("timer.fravaerKort.linje", {
                      timer: formatTimer(r.timer),
                      art: finnLonnsartLokalt(r.lonnsartId)?.navn ?? "",
                    })}
                  </Text>
                ))}
                {fravaerVedBekreft({ manglerProsjekt: false, fravaerRader: fravaerDag.fravaerRader }) ===
                "manglerBeskrivelse" ? (
                  <Text className="py-0.5 text-sm text-amber-700">{t("timer.dagsoversikt.manglerBeskrivelse")}</Text>
                ) : (
                  <Text className="py-0.5 text-sm text-gray-900">
                    {fravaerDag.fravaerRader.find((r) => r.beskrivelse)?.beskrivelse}
                  </Text>
                )}
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setFravaerKortApen({ nyLinje: true })}
              className="min-h-[44px] justify-center px-4 active:bg-gray-50"
            >
              <Text className="text-sm font-medium text-gray-700">{t("timer.fravaerKort.leggTil")}</Text>
            </Pressable>
          </View>
        ) : null}
        <DelKortModal
          synlig={delKort !== null}
          vindu={
            delKort
              ? delingsVindu(
                  (raderPerKort.get(delKort.nokkel) ?? []).map((r) => ({ fraTid: r.fraTid, tilTid: r.tilTid, erReise: false })),
                  input?.regel?.tidsrundingMinutter ?? null,
                )
              : null
          }
          tidsrunding={input?.regel?.tidsrundingMinutter ?? null}
          onAvbryt={() => setDelKort(null)}
          onDel={delKortNaa}
        />
        {fravaerKortApen && fravaerDag && fravaerDato && bruker?.id && orgId ? (
          <FravaerKortModal
            userId={bruker.id}
            organizationId={orgId}
            dato={fravaerDato}
            dagsnorm={fravaerNorm}
            dagRader={[
              ...fravaerDag.andreRader,
              // U3: arbeidet som står i Bekreft dag for datoen teller før det er lagret.
              ...forslagSomDagRader(
                forslag.datoer
                  .filter((d) => d.dato === fravaerDato && !d.blokkert && !retting.perDato?.[d.dato]?.fjernArbeid)
                  .flatMap((d) => d.rader),
              ),
            ]}
            eksisterende={fravaerDag.fravaerRader}
            nyLinje={fravaerKortApen.nyLinje}
            onLagret={() => {
              setFravaerKortApen(null);
              settFravaerNonce((n) => n + 1);
              oppdaterTellere();
              void triggerSync();
            }}
            onLukk={() => setFravaerKortApen(null)}
          />
        ) : null}
        {/* RETUR 36c-2 (D4): luft under siste felt mens tastaturet er oppe, så
            rullingen til feltet ikke klemmes mot bunnen. */}
        {utkastInnhold && !alleSendt ? (
          <Pressable onPress={forkast} hitSlop={8} className="items-center py-2">
            <Text className="text-sm font-medium text-red-600">{t("timer.utkast.forkast")}</Text>
          </Pressable>
        ) : null}
        {tastaturOppe ? <View className="h-[120px]" /> : null}
      </ScrollView>

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={TASTATUR_ID}>
          <View className="border-t border-gray-200 bg-gray-100 px-4 py-2">
            <Pressable
              onPress={() => Keyboard.dismiss()}
              className="min-h-[44px] items-center justify-center rounded-lg bg-blue-600"
            >
              <Text className="text-base font-semibold text-white">{t("handling.ferdig")}</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {/* Handlinger */}
      <View className="gap-2 border-t border-gray-200 bg-white p-4">
        {lagretTid && !alleSendt ? (
          <Text className="text-center text-xs text-gray-400">
            {t("dokument.lagretAutomatisk", { tid: lagretTid })}
          </Text>
        ) : null}
        {alleSendt ? (
          <Knapp tekst={t("handling.lukk")} onPress={ikkeNaa} sekundaer />
        ) : manuell && (ikkeAnsatt || tomt) ? (
          // Ingen arbeidsdag å avslutte i manuell modus.
          sekundarKnapp
        ) : ikkeAnsatt || tomt ? (
          <>
            <Knapp
              tekst={t(ikkeAnsatt ? "timer.bekreftDag.avsluttUtenTimer" : "timer.bekreftDag.avsluttDag")}
              onPress={avsluttUtenTimer}
            />
            {sekundarKnapp}
          </>
        ) : (
          <>
            <Knapp
              tekst={t("timer.bekreftDag.bekreft")}
              onPress={bekreft}
              deaktivert={lagrer}
              laster={lagrer}
            />
            {sekundarKnapp}
          </>
        )}
      </View>

      <Valgliste
        synlig={valgark === "prosjekt"}
        tittel={t("timer.bekreftDag.prosjekt")}
        valg={prosjekter.map((p) => ({ id: p.id, navn: p.name }))}
        valgtId={prosjektId}
        onVelg={(id) => {
          // Nytt prosjekt → byggeplassen tilhørte det gamle; A5 velger på nytt.
          setValgtByggeplassId(undefined);
          setRetting((r) => ({
            ...r,
            prosjektId: id ?? undefined,
            byggeplassId: undefined,
            // ORDRE 36a: skrevet beskrivelse følger med til det nye prosjektet
            // (RETUR 4: også fra arve-kortet når prosjektet hadde flere kort).
            beskrivelse: flyttBeskrivelseVedProsjektbytte(
              r.beskrivelse,
              prosjektId,
              id,
              forsteDag?.byggeplassId ?? null,
            ),
          }));
          endret();
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
      <Valgliste
        synlig={valgark === "byggeplass"}
        tittel={t("timer.bekreftDag.byggeplass")}
        valg={byggeplasser.map((b) => ({ id: b.id, navn: b.navn ?? "" }))}
        ingenValg={t("timer.bekreftDag.ingenByggeplass")}
        valgtId={forsteDag?.byggeplassId ?? null}
        onVelg={(id) => {
          setValgtByggeplassId(id ?? undefined);
          setRetting((r) => {
            // ORDRE 36b: tekst på et kort som arver dagens byggeplass følger
            // med (ett kort pr. prosjekt bruker projectId-nøkkel og følger alltid).
            const fra = prosjektId
              ? kortNokkel({ projectId: prosjektId, byggeplassId: forsteDag?.byggeplassId ?? null, ecoId: null })
              : null;
            const til = prosjektId ? kortNokkel({ projectId: prosjektId, byggeplassId: id, ecoId: null }) : null;
            const b = flyttBeskrivelse(flyttBeskrivelse(r.beskrivelse, fra, til), fra, prosjektId);
            return { ...r, byggeplassId: id, beskrivelse: b };
          });
          endret();
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
      <Valgliste
        synlig={valgark === "aktivitet"}
        tittel={t("timer.bekreftDag.aktivitet")}
        valg={aktiviteter.map((a) => ({ id: a.id, navn: a.navn }))}
        valgtId={forslag.aktivitetId}
        onVelg={(id) => {
          setRetting((r) => ({ ...r, aktivitetId: id ?? undefined }));
          endret();
          setValgark(null);
        }}
        onLukk={() => setValgark(null)}
      />
    </ModalFlate>
  );
}

/** Ett kort pr. dato: reise ut · arbeid (fra/til, OT, fjern) · pause · reise retur. */
/** «2026-11-10» → «10.11.» */
function kortDato(iso: string): string {
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

/**
 * ORDRE (28), spec § 6.1 V1–V3: arbeidslinjene i kortet — «07:00–15:00 · 7,5 t ·
 * Timelønn ▾». Trykk åpner valget: chips (≤ 6 aktuelle arter) gruppert
 * Ordinær · Overtid · Fravær, ellers den søkbare lista (`LonnsartVelgerModal`).
 * Linje uten lønnsart (firmaet mangler arten) vises amber «Velg lønnsart» (V2).
 */
function ArbeidLinjer({
  arbeid,
  utenLonnsart,
  alleLonnsarter,
  linjeArter,
  onVelg,
}: {
  arbeid: DagsforslagRad[];
  utenLonnsart: DagsforslagLinjeUtenLonnsart[];
  alleLonnsarter: DagsforslagLonnsart[];
  linjeArter: DagsforslagLonnsart[];
  onVelg: (linje: ArbeidLinje, art: DagsforslagLonnsart) => void;
}) {
  const { t } = useTranslation();
  const [aapen, setAapen] = useState<string | null>(null);
  const linjer = [
    ...arbeid
      .filter((r) => r.linje)
      .map((r) => ({
        nokkel: `${r.linje}-${r.fraTid}`,
        linje: r.linje!,
        fraTid: r.fraTid ?? "",
        tilTid: r.tilTid ?? "",
        timer: r.timer,
        lonnsartId: r.lonnsartId as string | null,
      })),
    ...utenLonnsart.map((l) => ({ nokkel: `${l.linje}-${l.fraTid}`, ...l, lonnsartId: null as string | null })),
  ].sort((a, b) => a.fraTid.localeCompare(b.fraTid));
  if (linjer.length === 0) return null;
  const aapenLinje = linjer.find((l) => l.nokkel === aapen) ?? null;
  const chips = aapenLinje ? linjeArter.length <= MAKS_LINJE_CHIPS : true;
  const velg = (linje: ArbeidLinje, art: DagsforslagLonnsart) => {
    onVelg(linje, art);
    setAapen(null);
  };
  return (
    <View className="gap-1">
      {linjer.map((l) => {
        const navn = l.lonnsartId ? alleLonnsarter.find((a) => a.id === l.lonnsartId)?.navn ?? null : null;
        return (
          <View key={l.nokkel} className="gap-1">
            <Pressable
              onPress={() => setAapen((v) => (v === l.nokkel ? null : l.nokkel))}
              accessibilityHint={t("timer.bekreftDag.linjeLonnsartHint")}
              className={`flex-row items-center justify-between rounded px-2 py-1 ${navn ? "bg-white" : "border border-amber-300 bg-amber-50"}`}
            >
              <Text className="text-xs text-gray-700">
                {t("timer.bekreftDag.linje", { fra: l.fraTid, til: l.tilTid, timer: formatTimer(l.timer) })}
              </Text>
              <Text className={`text-xs font-medium ${navn ? "text-blue-700" : "text-amber-800"}`}>
                {navn ?? t("timer.bekreftDag.velgLonnsart")} ▾
              </Text>
            </Pressable>
            {aapen === l.nokkel && chips ? (
              <View className="gap-1 rounded-md border border-gray-200 bg-white p-2">
                {grupperLinjeLonnsarter(linjeArter).map((g) => (
                  <View key={g.gruppe} className="gap-1">
                    <Text className="text-xs font-semibold text-gray-500">
                      {t(`timer.bekreftDag.lonnsartGruppe.${g.gruppe}`)}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {g.arter.map((art) => {
                        const valgt = art.id === l.lonnsartId;
                        return (
                          <Pressable
                            key={art.id}
                            onPress={() => velg(l.linje, art)}
                            accessibilityState={{ selected: valgt }}
                            className={`rounded-full border px-3 py-1 ${valgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
                          >
                            <Text className={`text-xs ${valgt ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                              {art.navn ?? art.id}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {aapenLinje && !chips ? (
        <LonnsartVelgerModal
          valgtId={aapenLinje.lonnsartId ?? ""}
          kandidatIder={linjeArter.map((a) => a.id)}
          onVelg={(id) => {
            const art = linjeArter.find((a) => a.id === id);
            if (art) velg(aapenLinje.linje, art);
          }}
          onLukk={() => setAapen(null)}
        />
      ) : null}
    </View>
  );
}

function DatoKort({
  dag,
  visDato,
  fjernet,
  fjernetOverforing,
  otNivaa,
  overtidValg,
  alleLonnsarter,
  rettetOvertidFra,
  overtidAv,
  lonnsartPerLinje,
  linjeArter,
  rettetArbeidFra,
  rettetReiseTid,
  maaltAnkomst: maalt,
  stedNavn,
  tidsrunding,
  onRett,
}: {
  dag: DagsforslagDag;
  visDato: boolean;
  fjernet: boolean;
  fjernetOverforing: Array<"ut" | "retur">;
  otNivaa: Map<string, number | null>;
  overtidValg: Array<{ id: string; navn: string }>;
  alleLonnsarter: DagsforslagLonnsart[];
  rettetOvertidFra: string | undefined;
  /** ORDRE (27b) V5a: overtiden er slått av med nivå-knappen. */
  overtidAv: boolean;
  /** ORDRE (28) V7: arbeiderens lønnsart pr. linje. */
  lonnsartPerLinje: Partial<Record<ArbeidLinje, string>> | undefined;
  /** ORDRE (28) V4-⚠️: artene en linje kan få (firmaets, uten reise). */
  linjeArter: DagsforslagLonnsart[];
  /** Ordre (17): arbeiderens rettede arbeidsstart (ankomst). */
  rettetArbeidFra: string | undefined;
  /** Ordre (17): rettede kjedekort pr. nøkkel — fast punkt i kjeden. */
  rettetReiseTid: Record<string, { fraTid: string; tilTid: string }>;
  /** Ordre (17) punkt 3: målt ankomst fra dagens besøk, ellers null. */
  maaltAnkomst: MaaltTidspunkt | null;
  stedNavn: Map<string, string>;
  tidsrunding: number | null;
  onRett: (endring: DagsforslagRettingDato) => void;
}) {
  const { t } = useTranslation();
  const [redigerOvertid, setRedigerOvertid] = useState(false);
  // Ordre (17): kjedens kort pr. side, i tidsrekkefølge (overføring + reiser).
  const kjede = (side: "ut" | "retur") =>
    dag.rader
      .filter((r) => r.kjedeNokkel && r.kjedeSide === side)
      .sort((a, b) => (a.fraTid ?? "").localeCompare(b.fraTid ?? ""));
  const rettKjedeKort = (nokkel: string, fraTid: string, tilTid: string) =>
    onRett({ reiseTid: { ...rettetReiseTid, [nokkel]: { fraTid, tilTid } } });
  const angreKjedeKort = (nokkel: string) => {
    const { [nokkel]: _fjern, ...rest } = rettetReiseTid;
    onRett({ reiseTid: rest });
  };
  const kjedeLinjer = (side: "ut" | "retur") =>
    kjede(side).map((rad) => (
      <KjedeLinje
        key={rad.kjedeNokkel}
        rad={rad}
        side={side}
        stedNavn={stedNavn}
        rettet={rad.kjedeNokkel! in rettetReiseTid}
        tidsrunding={tidsrunding}
        onRett={(fra, til) => rettKjedeKort(rad.kjedeNokkel!, fra, til)}
        onAngre={() => angreKjedeKort(rad.kjedeNokkel!)}
        onFjernOverforing={
          rad.overforing
            ? () => onRett({ fjernOverforing: [...fjernetOverforing, rad.overforing!.retning] })
            : undefined
        }
      />
    ));
  // POST (13) L2: overføringsrader vises på egen linje, ikke som arbeid/reise.
  const vanlige = dag.rader.filter((r) => !r.overforing);
  const arbeid = vanlige.filter((r) => !r.erReise);
  const ut = vanlige.find((r) => r.erReise && r.reiseRetning === "ut");
  const retur = vanlige.find((r) => r.erReise && r.reiseRetning === "retur");
  // POST (13) L2: fjernet overføring kan angres.
  const overforingFjernetLinje = (retning: "ut" | "retur") =>
    fjernetOverforing.includes(retning) ? (
      <View className="flex-row items-center justify-between px-1">
        <Text className="flex-1 text-xs text-gray-500">{t("timer.bekreftDag.overforingFjernet")}</Text>
        <Pressable
          onPress={() => onRett({ fjernOverforing: fjernetOverforing.filter((x) => x !== retning) })}
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Undo2 size={14} color="#1d4ed8" />
          <Text className="text-xs font-medium text-blue-700">{t("timer.bekreftDag.angre")}</Text>
        </Pressable>
      </View>
    ) : null;
  const arbeidTimer = arbeid.reduce((s, r) => s + r.timer, 0);
  // ORDRE (28) V5: overtidslinja er linja etter normen / «Overtid fra» — også
  // når arbeideren har valgt en ordinær art på den (V6), så editoren står.
  const forsteOt = arbeid.find((r) => r.linje === "overtid");
  const forsteOtNivaa = forsteOt ? otNivaa.get(forsteOt.lonnsartId) ?? null : null;
  const otFra = overtidEditorFra(forsteOt?.fraTid, rettetOvertidFra);
  // Fra/til vises fra radene; ved «fjernet» fra arbeidsvinduet mellom reisene.
  const fra = arbeid[0]?.fraTid ?? ut?.tilTid ?? tilHHMM(dag.segmentStartIso);
  const til = arbeid[arbeid.length - 1]?.tilTid ?? retur?.fraTid ?? tilHHMM(dag.segmentSluttIso);
  // Ordre (17) punkt 3: beregnet ankomst huskes mens arbeidsstart ikke er rettet,
  // så valget «Beregnet» kan vises etter at «Målt» er valgt.
  const beregnetFraRef = useRef<string | null>(null);
  if (rettetArbeidFra == null) beregnetFraRef.current = fra;
  const beregnetFra = beregnetFraRef.current;
  const maaltValgt = maalt != null && rettetArbeidFra === maalt.tid;
  const visAnkomst = maalt != null && (maaltValgt || maalt.tid !== fra);

  return (
    <View className="gap-2 rounded-lg border border-gray-200 bg-white p-3">
      {visDato ? <Text className="text-xs font-semibold text-gray-500">{dag.dato}</Text> : null}
      {dag.kjedeKonflikt ? (
        <KjedeKonfliktLinje
          konflikt={dag.kjedeKonflikt}
          onFjernOverforing={(retning) =>
            onRett({ fjernOverforing: [...fjernetOverforing, retning] })
          }
        />
      ) : null}
      {overforingFjernetLinje("ut")}
      {kjedeLinjer("ut")}

      {fjernet ? (
        <View className="flex-row items-center justify-between rounded-md bg-gray-50 p-2">
          <Text className="flex-1 text-sm text-gray-500">{t("timer.bekreftDag.arbeidFjernet")}</Text>
          <Pressable onPress={() => onRett({ fjernArbeid: false })} hitSlop={8} className="flex-row items-center gap-1">
            <Undo2 size={16} color="#1d4ed8" />
            <Text className="text-sm font-medium text-blue-700">{t("timer.bekreftDag.angre")}</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2 rounded-md bg-gray-50 p-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-gray-900">
              {t("timer.bekreftDag.arbeid", { timer: formatTimer(arbeidTimer) })}
            </Text>
            <Pressable onPress={() => onRett({ fjernArbeid: true })} hitSlop={8}>
              <Trash2 size={18} color="#dc2626" />
            </Pressable>
          </View>
          <FraTilTidFelt
            fraTid={fra}
            tilTid={til}
            tidsrundingMinutter={tidsrunding}
            onFraEndret={(hhmm) => onRett({ arbeidFra: hhmm })}
            onTilEndret={(hhmm) => onRett({ arbeidTil: hhmm })}
          />
          {/* ORDRE (28) V1: hver arbeidslinje med lønnsart, valgbar før lagring. */}
          <ArbeidLinjer
            arbeid={arbeid}
            utenLonnsart={dag.linjerUtenLonnsart ?? []}
            alleLonnsarter={alleLonnsarter}
            linjeArter={linjeArter}
            onVelg={(linje, art) => {
              const nabo = linje === "normal" ? "overtid" : "normal";
              onRett(
                velgLinjeLonnsart({
                  linje,
                  art,
                  rettDato: { lonnsartPerLinje, overtidFra: rettetOvertidFra },
                  naboArtId: arbeid.find((r) => r.linje === nabo)?.lonnsartId ?? null,
                  overtidFra: forsteOt?.fraTid ?? null,
                  arbeidFra: fra,
                }),
              );
            }}
          />
          {visAnkomst && maalt ? (
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-xs text-gray-600">{t("timer.bekreftDag.ankomst")}</Text>
              <Pressable
                onPress={() => onRett({ arbeidFra: maalt.tid })}
                accessibilityState={{ selected: maaltValgt }}
                className={`rounded-full border px-2 py-0.5 ${maaltValgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
              >
                <Text className={`text-xs ${maaltValgt ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                  {t("timer.bekreftDag.maalt", { tid: maalt.tid })}
                  {t(`timer.bekreftDag.maaltKilde.${maalt.kilde}`, { defaultValue: "" })
                    ? ` (${t(`timer.bekreftDag.maaltKilde.${maalt.kilde}`)})`
                    : ""}
                </Text>
              </Pressable>
              {beregnetFra ? (
                <Pressable
                  onPress={() => onRett({ arbeidFra: undefined })}
                  accessibilityState={{ selected: !maaltValgt }}
                  className={`rounded-full border px-2 py-0.5 ${!maaltValgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
                >
                  <Text className={`text-xs ${!maaltValgt ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                    {t("timer.bekreftDag.beregnet", { tid: beregnetFra })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {forsteOt?.fraTid ? (
            <Pressable
              onPress={() => setRedigerOvertid((v) => !v)}
              accessibilityHint={t("timer.bekreftDag.overtidRedigerHint")}
              className="self-start rounded bg-amber-100 px-2 py-0.5"
            >
              <Text className="text-xs font-medium text-amber-800">
                {forsteOtNivaa != null
                  ? t("timer.bekreftDag.overtid", { nivaa: forsteOtNivaa, fra: forsteOt.fraTid })
                  : t("timer.bekreftDag.etterNormen", { fra: forsteOt.fraTid })}
              </Text>
            </Pressable>
          ) : null}
          {/* ORDRE 35 del B: ingen overtid ennå → start den fra arbeidsstart; samme motor
              (segmenterVedOvertidFra). Uten OT50 velges første nivå (leggTilOvertidRetting). */}
          {!forsteOt && overtidValg.length > 0 && !(redigerOvertid && overtidAv) ? (
            <Pressable
              onPress={() => {
                onRett(leggTilOvertidRetting(fra, alleLonnsarter, overtidValg));
                setRedigerOvertid(true);
              }}
              hitSlop={8}
              className="flex-row items-center gap-1 self-start"
            >
              <Plus size={14} color="#1d4ed8" />
              <Text className="text-xs font-medium text-blue-700">
                {t("timer.bekreftDag.overtidLeggTil")}
              </Text>
            </Pressable>
          ) : null}
          {redigerOvertid && otFra ? (
            <View className="gap-2 rounded-md border border-amber-200 bg-white p-2">
              {/* ORDRE (27b) V5a: overtiden av → «Overtid fra» skjules, nivå-knappene står. */}
              {!overtidAv ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-700">{t("timer.bekreftDag.overtidFra")}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(otFra, -1, fra, til, tidsrunding) })
                    }
                    hitSlop={8}
                    className="rounded-full border border-gray-300 p-1"
                  >
                    <Minus size={16} color="#374151" />
                  </Pressable>
                  <Text className="w-16 text-center text-sm text-gray-900">{otFra}</Text>
                  <Pressable
                    onPress={() =>
                      onRett({ overtidFra: stegOvertidFra(otFra, 1, fra, til, tidsrunding) })
                    }
                    hitSlop={8}
                    className="rounded-full border border-gray-300 p-1"
                  >
                    <Plus size={16} color="#374151" />
                  </Pressable>
                </View>
              </View>
              ) : null}
              <Text className="text-sm text-gray-700">{t("timer.bekreftDag.overtidNivaa")}</Text>
              <View className="flex-row flex-wrap gap-2">
                {overtidValg.map((l) => {
                  const valgt = l.id === forsteOt?.lonnsartId;
                  return (
                    <Pressable
                      key={l.id}
                      // V5a: blå knapp av, hvit knapp på (fra forrige «Overtid fra», ellers arbeidsstart).
                      // ORDRE (28) V5: nivået er samme valg som overtidslinjas lønnsart —
                      // et nivå-trykk erstatter et linjevalg på overtidslinja.
                      onPress={() =>
                        onRett({
                          ...vekslOvertidNivaa({
                            trykketId: l.id,
                            valgtId: forsteOt?.lonnsartId ?? null,
                            forsteOtFra: forsteOt?.fraTid ?? null,
                            rettetOvertidFra,
                            arbeidFra: fra,
                          }),
                          lonnsartPerLinje: utenLinje(lonnsartPerLinje, "overtid"),
                        })
                      }
                      accessibilityState={{ selected: valgt }}
                      className={`rounded-full border px-3 py-1 ${valgt ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
                    >
                      <Text className={`text-xs ${valgt ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                        {l.navn}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-gray-700">{t("timer.bekreftDag.pause")}</Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={() => onRett({ pauseMin: Math.max(0, dag.pauseMin - PAUSE_STEG) })}
                disabled={dag.pauseMin <= 0}
                hitSlop={8}
                className="rounded-full border border-gray-300 p-1 disabled:opacity-40"
              >
                <Minus size={16} color="#374151" />
              </Pressable>
              <Text className="w-16 text-center text-sm text-gray-900">
                {t("timer.bekreftDag.minutter", { min: dag.pauseMin })}
              </Text>
              <Pressable
                onPress={() => onRett({ pauseMin: Math.min(PAUSE_MAKS, dag.pauseMin + PAUSE_STEG) })}
                disabled={dag.pauseMin >= PAUSE_MAKS}
                hitSlop={8}
                className="rounded-full border border-gray-300 p-1 disabled:opacity-40"
              >
                <Plus size={16} color="#374151" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {kjedeLinjer("retur")}
      {overforingFjernetLinje("retur")}
    </View>
  );
}

/**
 * Ordre (17): ett kort i reisekjeden — «Reise X → Y 06:30–07:00 · 30 min» eller
 * «Overføring X → Y …». Tidene rettes med ett trykk (kompakt tidsfelt); rettet
 * kort er fast punkt, beregnede naboer flytter seg.
 */
function KjedeLinje({
  rad,
  side,
  stedNavn,
  rettet,
  tidsrunding,
  onRett,
  onAngre,
  onFjernOverforing,
}: {
  rad: DagsforslagRad;
  side: "ut" | "retur";
  stedNavn: Map<string, string>;
  rettet: boolean;
  tidsrunding: number | null;
  onRett: (fraTid: string, tilTid: string) => void;
  onAngre: () => void;
  onFjernOverforing?: () => void;
}) {
  const { t } = useTranslation();
  const fra = rad.fraTid ?? "";
  const til = rad.tilTid ?? "";
  const min = fra && til ? Math.max(0, hhmmTilMin(til) - hhmmTilMin(fra)) : Math.round(rad.timer * 60);
  let etikett: string;
  if (rad.overforing) {
    etikett = t("timer.bekreftDag.overforingRute", {
      fra: rad.overforing.fraNavn,
      til: rad.overforing.tilNavn,
    });
  } else {
    const kontor = rad.reiseOppmotestedId ? stedNavn.get(rad.reiseOppmotestedId) : undefined;
    const plass = rad.byggeplassId ? stedNavn.get(rad.byggeplassId) : undefined;
    const [a, b] = side === "ut" ? [kontor, plass] : [plass, kontor];
    etikett =
      a && b
        ? t("timer.bekreftDag.reiseRute", { fra: a, til: b })
        : t(side === "ut" ? "timer.bekreftDag.reiseUt" : "timer.bekreftDag.reiseRetur");
  }
  return (
    <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1 px-1">
      <Car size={14} color="#6b7280" />
      <Text className="text-xs text-gray-600">{etikett}</Text>
      <FraTilTidFelt
        kompakt
        fraTid={fra || null}
        tilTid={til || null}
        tidsrundingMinutter={tidsrunding}
        onFraEndret={(nyFra) => {
          // Ny start beholder slutten; havner start etter slutt, beholdes lengden.
          const nyTil = hhmmTilMin(nyFra) < hhmmTilMin(til || nyFra) ? til : minTilHhmm(hhmmTilMin(nyFra) + min);
          onRett(nyFra, nyTil);
        }}
        onTilEndret={(nyTil) => onRett(fra || nyTil, nyTil)}
      />
      <Text className="text-xs text-gray-600">{t("timer.bekreftDag.kjedeMin", { min })}</Text>
      {rettet ? (
        <Pressable onPress={onAngre} hitSlop={8} className="flex-row items-center gap-1">
          <Text className="text-xs text-gray-500">{t("timer.bekreftDag.kjedeRettet")}</Text>
          <Undo2 size={14} color="#1d4ed8" />
          <Text className="text-xs font-medium text-blue-700">{t("timer.bekreftDag.angre")}</Text>
        </Pressable>
      ) : null}
      <View className="flex-1" />
      {onFjernOverforing ? (
        <Pressable onPress={onFjernOverforing} hitSlop={8} accessibilityLabel={t("timer.bekreftDag.overforingFjern")}>
          <Trash2 size={16} color="#dc2626" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Ordre (17) punkt 2: kjeden henger ikke sammen — Bekreft er sperret til den er rettet. */
function KjedeKonfliktLinje({
  konflikt,
  onFjernOverforing,
}: {
  konflikt: DagsforslagKjedeKonflikt;
  onFjernOverforing: (retning: "ut" | "retur") => void;
}) {
  const { t } = useTranslation();
  const tekst =
    konflikt.type === "overlapp"
      ? t("timer.bekreftDag.kjedeKonflikt.overlapp", {
          fraTid: konflikt.fraTid,
          tilTid: konflikt.tilTid,
          annenFraTid: konflikt.annenFraTid,
          annenTilTid: konflikt.annenTilTid,
        })
      : t("timer.bekreftDag.kjedeKonflikt.overMidnatt");
  return (
    <View className="gap-1 rounded-md border border-amber-300 bg-amber-50 p-2">
      <View className="flex-row items-start gap-2">
        <AlertTriangle size={14} color="#b45309" />
        <Text className="flex-1 text-xs text-amber-800">{tekst}</Text>
      </View>
      {konflikt.type === "overMidnatt" && konflikt.erOverforing ? (
        <Pressable
          onPress={() => onFjernOverforing(konflikt.retning)}
          hitSlop={8}
          className="flex-row items-center gap-1 self-start"
        >
          <Trash2 size={14} color="#dc2626" />
          <Text className="text-xs font-medium text-red-700">{t("timer.bekreftDag.overforingFjern")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Valgfelt({
  etikett,
  verdi,
  feil = false,
  onPress,
}: {
  etikett: string;
  verdi: string;
  feil?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between rounded-md border px-3 py-2 ${feil ? "border-red-400 bg-red-50" : "border-gray-200"}`}
    >
      <Text className="text-xs text-gray-500">{etikett}</Text>
      <Text className={`ml-3 flex-1 text-right text-sm font-medium ${feil ? "text-red-700" : "text-gray-900"}`}>
        {verdi}
      </Text>
    </Pressable>
  );
}

function Valgliste({
  synlig,
  tittel,
  valg,
  valgtId,
  ingenValg,
  onVelg,
  onLukk,
}: {
  synlig: boolean;
  tittel: string;
  valg: { id: string; navn: string }[];
  valgtId: string | null;
  /** Satt = egen rad øverst som velger «ingen» (null). */
  ingenValg?: string;
  onVelg: (id: string | null) => void;
  onLukk: () => void;
}) {
  const insets = useModalInnsetter();
  const alle: { id: string | null; navn: string }[] = ingenValg
    ? [{ id: null, navn: ingenValg }, ...valg]
    : valg;
  return (
    <Modal visible={synlig} animationType="slide" transparent onRequestClose={onLukk}>
      <Pressable className="flex-1 bg-black/30" onPress={onLukk} />
      <View className="max-h-[70%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom }}>
        <Text className="px-4 pb-2 pt-4 text-base font-semibold text-gray-900">{tittel}</Text>
        <ScrollView>
          {alle.map((v) => (
            <Pressable
              key={v.id ?? "ingen"}
              onPress={() => onVelg(v.id)}
              className={`border-t border-gray-100 px-4 py-3 ${v.id === valgtId ? "bg-blue-50" : ""}`}
            >
              <Text className={`text-sm ${v.id === valgtId ? "font-semibold text-blue-700" : "text-gray-900"}`}>
                {v.navn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Knapp({
  tekst,
  onPress,
  sekundaer = false,
  deaktivert = false,
  laster = false,
}: {
  tekst: string;
  onPress: () => void;
  sekundaer?: boolean;
  deaktivert?: boolean;
  laster?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deaktivert}
      className={`flex-row items-center justify-center gap-2 rounded-lg py-3 disabled:opacity-50 ${
        sekundaer ? "border border-gray-300 bg-white active:bg-gray-100" : "bg-blue-600 active:bg-blue-700"
      }`}
    >
      {laster ? <ActivityIndicator size="small" color="#ffffff" /> : null}
      <Text className={`text-base font-semibold ${sekundaer ? "text-gray-800" : "text-white"}`}>
        {tekst}
      </Text>
    </Pressable>
  );
}
