import { useCallback, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
} from "expo-router";
import {
  ArrowLeft,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Plus,
  Sparkles,
  Split,
  ChevronRight,
  Info,
  MapPin,
  X,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../src/db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  sheetUtleggLocal,
  equipmentLocal,
  byggeplassLocal,
} from "../../src/db/schema";
import { useTimerSync } from "../../src/providers/TimerSyncProvider";
import { useNettverk } from "../../src/providers/NettverkProvider";
import { trpc } from "../../src/lib/trpc";
import {
  dagskortSammenligning,
  overlappSammenligning,
  type Side,
} from "../../src/lib/dagskortSammenligning";
import { DagskortSammenligning } from "../../src/components/timer-detalj/DagskortSammenligning";
import { TimerStatusMerkelapp } from "../../src/components/TimerStatusMerkelapp";
import { DagstotalBanner } from "../../src/components/DagstotalBanner";
import {
  ArbeidstidSeksjon,
  RedigerArbeidstidModal,
} from "../../src/components/timer-detalj/ArbeidstidSeksjon";
import { ProsjektkortSamleside } from "../../src/components/timer-detalj/ProsjektkortSamleside";
import { lesTimerModusLokalt } from "../../src/services/organizationSettingKatalog";
import {
  kortProsjektIder,
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
} from "../../src/lib/prosjektkortMobil";
import { SummeringsBanner } from "../../src/components/timer-detalj/SummeringsBanner";
import { ProsjektVelgerModal } from "../../src/components/timer-detalj/ProsjektVelger";
import { ByggeplassVelgerModal } from "../../src/components/timer-detalj/ByggeplassVelger";
import { ProsjektGruppe } from "../../src/components/timer-detalj/ProsjektGruppe";
import { finnProsjektLokalt } from "../../src/services/prosjektKatalog";
import {
  flyttMatpauseVedAvhuking,
  settMatpauseBaerer,
  fjernMatpause,
} from "../../src/services/matpause";
import { useMiniToast, MiniToast } from "../../src/components/MiniToast";
import {
  hentDagsnormLokalt,
  hentOgCacheArbeidstidSvar,
} from "../../src/services/arbeidstidSvarKatalog";
import {
  hentStandardLonnsartLokalt,
  harOvertidLonnsartLokalt,
  hentReiseLonnsartId,
} from "../../src/services/timerKatalog";
import { harMaskinforerbevisLokalt } from "../../src/services/maskinKatalog";
import { formatNorskDato, formatTidspunkt, isoTidspunktTilHHMM } from "../../src/utils/dato";
import { kanGjenaapneDagsseddel } from "../../src/utils/gjenaapne-tilgang";
import type { ForsonRad as DeltForsonRad } from "@sitedoc/shared";
import { slaaSammenVarelinjer } from "@sitedoc/shared";
import { hentLokaleVarelinjer } from "../../src/services/vareforbrukSync";
import type {
  Sedel,
  TimerRad,
  TilleggRad,
  MaskinRad,
  UtleggRad,
} from "../../src/types/timer-detalj";
import { bekreftConflict } from "../../src/services/timerSync";
import {
  anvendForsonetLokalt,
  byggForsonOverlappKall,
  type ForsonetServerRad,
} from "../../src/lib/forsoningSpeil";
import { useReLesVedSynk } from "../../src/hooks/useReLesVedSynk";
import { useFirma } from "../../src/kontekst/FirmaKontekst";

/** Felt-settet `forsonDagskort` tar for en rad (uten id = ny rad). */
type ForsonRad = {
  projectId: string;
  byggeplassId?: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string;
  tilTid: string;
  beskrivelse?: string | null;
  externalCostObjectId?: string | null;
};

/**
 * Lokal timer-rad → forson-payload. Returnerer null når raden mangler et felt serveren
 * krever (projectId/fra/til) — da kan den ikke forsones, og kalleren avbryter med melding
 * i stedet for å sende et ugyldig valg inn på lønnsdata.
 */
function lokalRadTilForson(r: TimerRad): ForsonRad | null {
  if (!r.projectId || !r.fraTid || !r.tilTid) return null;
  return {
    projectId: r.projectId,
    byggeplassId: r.byggeplassId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    timer: r.timer,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    beskrivelse: r.beskrivelse,
    externalCostObjectId: r.externalCostObjectId,
  };
}

/** Rå timer-/forslagsrad fra `hentMedId` (smal cast FØR bruk → unngår TS2589). */
type RaaRad = {
  id: string;
  fraTid: string | null;
  tilTid: string | null;
  timer: number | string;
  projectId: string | null;
  byggeplassId?: string | null;
  lonnsartId: string | null;
  aktivitetId?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
  beskrivelse: string | null;
  // V19.9 (B'-6): forslagsradens grunn (SheetTimerForslag.grunn). Kun på forslag-
  // rader; serverens timer-rader har den ikke (→ undefined, ren overlapp-slot).
  grunn?: string | null;
};

/**
 * V19-B: rå rad (serverrad/forslag) → delt `ForsonRad`. `timer` kommer som streng
 * (Prisma Decimal) → tall. projectId kan være null på en tom serverrad — koerser til
 * "" (brukes aldri i skriveveien: en serverrad sendes bare via sin id). Ren → modul-
 * scope (ikke en hook-dep).
 */
function raaTilForsonRad(r: RaaRad): DeltForsonRad {
  return {
    id: r.id,
    projectId: r.projectId ?? "",
    byggeplassId: r.byggeplassId ?? null,
    lonnsartId: r.lonnsartId ?? "",
    aktivitetId: r.aktivitetId ?? "",
    timer: Number(r.timer),
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    beskrivelse: r.beskrivelse,
    externalCostObjectId: r.externalCostObjectId ?? null,
    vehicleId: r.vehicleId ?? null,
    grunn: r.grunn as DeltForsonRad["grunn"],
  };
}

export default function DagsseddelDetalj() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    id: string;
    aapnetEksisterende?: string;
    nyttProsjekt?: string;
  }>();
  const sheetId = params.id ?? "";
  const { triggerSync, oppdaterTellere, sistSynkronisert } = useTimerSync();
  // UF-4: recall — online-only (server er sannhetskilde for sent/accepted).
  const gjenaapneMutation = trpc.timer.dagsseddel.gjenaapneDagsseddel.useMutation();
  // Kenneth-vedtak 2026-10-09 (2): slett returnert-ikke-attestert. En returnert sedel
  // LEVER på serveren (ble sendt → returnert) — lokal sletting alene ville la den komme
  // tilbake ved neste pull. Derfor server-mutasjon (online). Draft slettes lokalt (under).
  const slettMutation = trpc.timer.dagsseddel.slett.useMutation();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [utleggRader, setUtleggRader] = useState<UtleggRad[]>([]);
  const [harEquipmentCache, setHarEquipmentCache] = useState(false);
  // T.11: default true så arbeider ikke får falsk-flagg før status er synket.
  const [harMaskinforerbevis, setHarMaskinforerbevis] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  // Tomme prosjekt-grupper som brukeren har lagt til via «+ Legg til prosjekt».
  // Gruppen blir varig så snart første rad er lagt til i den.
  const [ekstraProsjektIder, setEkstraProsjektIder] = useState<string[]>([]);
  const [visLeggTilProsjekt, setVisLeggTilProsjekt] = useState(false);
  // L1 / B6 sedel-nivå: byggeplass-velger for aktivt prosjekt.
  const [visByggeplassVelger, setVisByggeplassVelger] = useState(false);
  // Prosjektkort L2: «Endre» i «Dagens ramme» åpner fra/til-modalen.
  const [visRammeModal, setVisRammeModal] = useState(false);
  // F5: matpause-toast + bekreftelsesmodal ved fjerning (ingen kvalifisert rad).
  const { melding: pauseToast, vis: visPauseToast } = useMiniToast();
  const [bekreftFjernRadId, setBekreftFjernRadId] = useState<string | null>(null);
  // UF-0: find-or-open fra «+ Ny» — subtil notis om at dagen alt fantes.
  const [visAapnetNotis, setVisAapnetNotis] = useState(
    params.aapnetEksisterende === "1",
  );

  // UF-0: bevart prosjekt-valg — kom brukeren hit via find-or-open med et valgt
  // prosjekt, vis det som en (tom) gruppe så de straks kan føre rader på det.
  useEffect(() => {
    const pid = params.nyttProsjekt;
    if (!pid) return;
    setEkstraProsjektIder((forrige) =>
      forrige.includes(pid) ? forrige : [...forrige, pid],
    );
  }, [params.nyttProsjekt]);

  const lesData = useCallback(() => {
    const db = hentDatabase();
    if (!db) return;

    const sedelRad = db
      .select()
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, sheetId))
      .all()[0];

    if (!sedelRad) {
      setSedel(null);
      return;
    }
    setSedel(sedelRad);

    const tider = db
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all();
    setTimerRader(tider);

    const tillegg = db
      .select()
      .from(sheetTilleggLocal)
      .where(eq(sheetTilleggLocal.dagsseddelId, sheetId))
      .all();
    setTilleggRader(tillegg);

    const maskiner = db
      .select()
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all();
    setMaskinRader(maskiner);

    const utlegg = db
      .select()
      .from(sheetUtleggLocal)
      .where(eq(sheetUtleggLocal.dagsseddelId, sheetId))
      .all();
    setUtleggRader(utlegg);

    // Soft-skjul-sjekk: maskin-seksjonen vises kun hvis Equipment-cache er
    // populert (Maskin-modul aktivert + firmaet har utstyr) eller hvis
    // sedlen allerede har maskin-rader (gamle rader bevares).
    const equipmentCount = db
      .select({ id: equipmentLocal.id })
      .from(equipmentLocal)
      .where(eq(equipmentLocal.organizationId, sedelRad.organizationId))
      .all().length;
    setHarEquipmentCache(equipmentCount > 0);
  }, [sheetId]);

  useFocusEffect(
    useCallback(() => {
      lesData();
    }, [lesData]),
  );

  // FUNN 2026-10-06: skjermen leste BARE ved fokus (useFocusEffect). Fullfører
  // en bakgrunnssynk mens skjermen alt er i fokus, oppdateres `syncStatus` på
  // skjermen nå via dette signalet — «Venter» blir ikke stående. Trygt for
  // pågående arbeid: `lesData()` setter kun data-arrayene (sedel + rader). En
  // åpen rad-modal (TimerRadModal m.fl.) holder kladden i egen intern state via
  // state-INITIALISATORER (kjøres kun ved mount), og conflict-valgene ligger i
  // `valgOverstyr` (røres ikke her) — begge overlever en foreldre-re-render.
  useReLesVedSynk(sistSynkronisert, lesData);

  // T.11: les innlogget brukers maskinførerbevis-status (SecureStore, async)
  // for sedelens org. Styrer soft-varsel i MaskinSeksjon — aldri blokkerende.
  useEffect(() => {
    const orgId = sedel?.organizationId;
    if (!orgId) return;
    let aktiv = true;
    void harMaskinforerbevisLokalt(orgId).then((gyldig) => {
      if (aktiv) setHarMaskinforerbevis(gyldig);
    });
    return () => {
      aktiv = false;
    };
  }, [sedel?.organizationId]);

  // U-BEKREFT steg 1: sammenligningsvisning ved conflict. Server-radene finnes IKKE
  // lokalt under conflict (timerSync beholder kun lokale rader) → hent web-kortet LIVE
  // via hentMedId, kun når sedelen er i conflict OG vi har nett. Offline → ingen
  // server-side → «får ikke kontakt» (ikke tomt panel). Leser kun; skriver aldri.
  const { erPaaNettet } = useNettverk();
  const erKonflikt = sedel?.syncStatus === "conflict";
  // V19-B (B-3): overlapp-konflikt → sammenligningen leser FORSLAGET fra serveren
  // som «appen»-siden (ikke lokale rader). Alle andre conflict-årsaker (laast/nyere)
  // beholder den eksisterende U-BEKREFT-modusen (lokale rader mot web).
  const erOverlapp = sedel?.konfliktAarsak === "overlapp";
  const webKortQuery = trpc.timer.dagsseddel.hentMedId.useQuery(
    { id: sheetId },
    { enabled: !!erKonflikt && erPaaNettet && !!sheetId },
  );
  // Smal cast av det dypt-inferrede tRPC-svaret FØR bruk — ellers TS2589 (dyp union)
  // når .map/useMemo ekspanderer hele hentMedId-outputen. Vi trenger hode-status,
  // sedelens timer-rader + V19-forslaget, begge med feltene forsoningen skriver.
  const webKortData = webKortQuery.data as
    | { status: string; timer: RaaRad[]; forslag?: RaaRad[] }
    | undefined;
  const webSedelRader = useMemo(
    () => (webKortData ? webKortData.timer.map(raaTilForsonRad) : []),
    [webKortData],
  );
  const forslagRader = useMemo(
    () => (webKortData?.forslag ? webKortData.forslag.map(raaTilForsonRad) : []),
    [webKortData],
  );
  const sammenligning = useMemo(
    () =>
      erOverlapp
        ? overlappSammenligning({
            nettStatus: erPaaNettet ? "online" : "offline",
            webLaster: webKortQuery.isLoading,
            webKort: webKortData
              ? {
                  status: webKortData.status as "draft" | "returned" | "sent" | "accepted",
                  sedelRader: webSedelRader,
                }
              : null,
            forslag: forslagRader,
          })
        : dagskortSammenligning({
            nettStatus: erPaaNettet ? "online" : "offline",
            webLaster: webKortQuery.isLoading,
            webKort: webKortData
              ? {
                  status: webKortData.status as "draft" | "returned" | "sent" | "accepted",
                  // Server-radenes `timer` → tall så sammenligningen står på samme
                  // enhet som de lokale (Drizzle real).
                  timer: webKortData.timer.map((r) => ({
                    id: r.id,
                    fraTid: r.fraTid,
                    tilTid: r.tilTid,
                    timer: Number(r.timer),
                    projectId: r.projectId,
                    lonnsartId: r.lonnsartId,
                    beskrivelse: r.beskrivelse,
                  })),
                }
              : null,
            lokaleTimer: timerRader,
          }),
    [
      erOverlapp,
      erPaaNettet,
      webKortQuery.isLoading,
      webKortData,
      webSedelRader,
      forslagRader,
      timerRader,
    ],
  );
  // Radvalg registreres i skjerm-state, nøklet på rad.nokkel (V19-overlapp) ellers
  // tidsrom (U-BEKREFT). Overstyrer forhåndsvalget fra den rene funksjonen.
  const [valgOverstyr, setValgOverstyr] = useState<Record<string, Side>>({});
  const effektivtValg = useMemo(() => {
    if (sammenligning.slag !== "modusB" && sammenligning.slag !== "modusC") return {};
    const v: Record<string, Side> = {};
    for (const rad of sammenligning.rader) {
      const key = rad.nokkel ?? rad.tidsrom;
      v[key] = valgOverstyr[key] ?? rad.valgt;
    }
    return v;
  }, [sammenligning, valgOverstyr]);

  // Steg 2: anvend valgene ATOMISK på web-kortet (forsonDagskort), speil svaret til lokal,
  // og kvitter ut konflikten. Kun modus B (redigerbart). Fravalgte rader fjernes bevisst.
  const forsonMutation = trpc.timer.dagsseddel.forsonDagskort.useMutation();
  const [bekreftFeilTekst, setBekreftFeilTekst] = useState<string | null>(null);
  const håndterBekreft = useCallback(async () => {
    if (sammenligning.slag !== "modusB") return;

    let oppdateringer: (ForsonRad & { id: string })[] = [];
    let nyeRader: ForsonRad[] = [];
    // V19.9 (RETUR 1, vilkår 1): serverrad-id-er valget «Telefonen slettet» gir
    // (slettet_telefon → «forslag»). Må sendes til forsonDagskort, ellers slettes
    // forslaget men serverraden blir stående. Tom i U-BEKREFT (ikke-overlapp).
    let slettinger: string[] = [];

    if (erOverlapp) {
      // V19-B (B-3) + V19.9 (RETUR 1, vilkår 1): bygg skriveveien fra FORSLAGET via
      // den delte `byggForsonOverlappKall` (samme paring som visningen). Den mapper
      // ALLE valgbare slots (også `slettet_pc`, server=null) og BÆRER `slettinger`
      // (slettet_telefon → «forslag»). Ekstrahert til lib så harnessen tester seamen.
      const input = byggForsonOverlappKall(
        sammenligning.rader,
        effektivtValg,
        webSedelRader,
        forslagRader,
      );
      oppdateringer = input.oppdateringer as (ForsonRad & { id: string })[];
      nyeRader = input.nyeRader as ForsonRad[];
      slettinger = input.slettinger;
    } else {
      // U-BEKREFT (ikke-overlapp): lokale rader mot web pr. eksakt tidsrom.
      const lokalEtterId = new Map(timerRader.map((r) => [r.id, r]));
      for (const rad of sammenligning.rader) {
        const key = rad.nokkel ?? rad.tidsrom;
        const v = effektivtValg[key];
        if (rad.lokal && rad.server && v === "lokal") {
          // Valgt-lokal på et tidsrom begge hadde → erstatt server-raden in-place.
          const full = lokalEtterId.get(rad.lokal.id);
          const p = full ? lokalRadTilForson(full) : null;
          if (!p) {
            setBekreftFeilTekst(t("timer.sammenlign.radMangler"));
            return;
          }
          oppdateringer.push({ id: rad.server.id, ...p });
        } else if (rad.lokal && !rad.server) {
          // Lokal-only beholdt → ny rad på kortet.
          const full = lokalEtterId.get(rad.lokal.id);
          const p = full ? lokalRadTilForson(full) : null;
          if (!p) {
            setBekreftFeilTekst(t("timer.sammenlign.radMangler"));
            return;
          }
          nyeRader.push(p);
        }
        // Valgt-server / server-only beholdt → no-op (ligger alt på kortet).
      }
    }

    setBekreftFeilTekst(null);
    try {
      const forsonet = (await forsonMutation.mutateAsync({
        sheetId,
        oppdateringer,
        nyeRader,
        slettinger,
      })) as ForsonetServerRad[];
      anvendForsonetLokalt(sheetId, forsonet);
      bekreftConflict(sheetId);
      lesData();
      oppdaterTellere();
    } catch {
      setBekreftFeilTekst(t("timer.sammenlign.bekreftFeil"));
    }
  }, [
    sammenligning,
    effektivtValg,
    erOverlapp,
    webSedelRader,
    forslagRader,
    timerRader,
    sheetId,
    forsonMutation,
    lesData,
    oppdaterTellere,
    t,
  ]);
  // V19-B (B-3): «hele dagen»-snarvei — sett alle valgbare slots til samme side.
  const håndterVelgAlle = useCallback(
    (side: Side) => {
      if (sammenligning.slag !== "modusB" && sammenligning.slag !== "modusC") return;
      setValgOverstyr((forrige) => {
        const neste = { ...forrige };
        for (const rad of sammenligning.rader) {
          if (rad.valgbar === false) continue;
          neste[rad.nokkel ?? rad.tidsrom] = side;
        }
        return neste;
      });
    },
    [sammenligning],
  );

  const erRedigerbar = useMemo(() => {
    if (!sedel) return false;
    return sedel.status === "draft" || sedel.status === "returned";
  }, [sedel]);

  // (d) Direkte-deteksjon: auto-utkast der firmaet mangler standard-lønnsart →
  // auto-genereringen kan ikke gjette lønnsart, så arbeids-rader droppes
  // (`genererForslag` :723-gate). Surface i stedet for stille 0 — aldri tapt,
  // aldri feil lønn. Arbeider fører timer manuelt med riktig lønnsart.
  // Ikke ansatt i sedelens firma → serveren nekter den. Rødt banner vinner over
  // (d) og overtid-banneret (de peker på lønnsart-konfig, som ikke er problemet).
  // `null` = ukjent → bannerne som før.
  const { firmaer, erAnsattIFirma } = useFirma();
  const ikkeAnsatt = erAnsattIFirma(sedel?.organizationId) === false;
  const ikkeAnsattFirmanavn =
    firmaer.find((f) => f.id === sedel?.organizationId)?.name ?? "";

  const manglerStandardLonnsart = useMemo(() => {
    if (!sedel?.autoGenerert) return false;
    return hentStandardLonnsartLokalt(sedel.organizationId) == null;
  }, [sedel?.autoGenerert, sedel?.organizationId]);

  // B6 v3: hent serverens norm-SVAR for sedelens dato ved åpning (femte
  // hente-sted), så en sedel laget på en annen enhet får normen sin. Best-effort;
  // offline beholder cachen. `normNonce` tvinger re-les når svaret er cachet.
  const svarUtils = trpc.useUtils();
  const [normNonce, settNormNonce] = useState(0);
  useEffect(() => {
    if (!sedel?.organizationId || !sedel?.dato) return;
    void hentOgCacheArbeidstidSvar(
      svarUtils.client,
      sedel.organizationId,
      sedel.dato,
    ).then((ok) => {
      if (ok) settNormNonce((n) => n + 1);
    });
  }, [sedel?.organizationId, sedel?.dato, svarUtils]);

  // Topp-sum-normen LESES fra svar-cachen (server-utledet), REGNES aldri lokalt.
  // `null` = norm ukjent (→ "norm ukjent", ikke et gjettet tall).
  const normSvar = useMemo(() => {
    if (!sedel) return null;
    return hentDagsnormLokalt(sedel.organizationId, sedel.dato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedel, normNonce]);
  const normTimer = normSvar?.dagsnorm ?? null;
  const normStatus = normSvar?.normStatus ?? "ukjent";

  const totaltimer = useMemo(
    () => timerRader.reduce((sum, r) => sum + (r.timer ?? 0), 0),
    [timerRader],
  );

  // ③a fallback: auto-utkast der dagen nådde normaltid (overtid var aktuelt)
  // men firmaet mangler overtid-lønnsart → auto-gen kunne ikke føre overtid.
  // Surface (aldri feil-match, aldri stille drop) — arbeider fører manuelt.
  const manglerOvertidLonnsart = useMemo(() => {
    if (!sedel?.autoGenerert) return false;
    if (normTimer == null || totaltimer < normTimer - 0.001) return false;
    return !harOvertidLonnsartLokalt(sedel.organizationId);
  }, [sedel?.autoGenerert, sedel?.organizationId, normTimer, totaltimer]);

  const totalMaskin = useMemo(
    () => maskinRader.reduce((sum, r) => sum + (r.timer ?? 0), 0),
    [maskinRader],
  );

  // T7-3b2: aktive prosjekt-grupper. Inkluder alltid sedel.projectId som
  // standard-gruppe, samt alle distinkte projectId fra rader og bruker-
  // tilføyde ekstra-grupper.
  const aktiveProsjektIder = useMemo(() => {
    if (!sedel) return [];
    const ider = new Set<string>([sedel.projectId]);
    for (const r of timerRader) if (r.projectId) ider.add(r.projectId);
    for (const r of tilleggRader) if (r.projectId) ider.add(r.projectId);
    for (const r of maskinRader) if (r.projectId) ider.add(r.projectId);
    for (const r of utleggRader) if (r.projectId) ider.add(r.projectId);
    for (const id of ekstraProsjektIder) ider.add(id);
    return Array.from(ider);
  }, [sedel, timerRader, tilleggRader, maskinRader, utleggRader, ekstraProsjektIder]);

  // Prosjektkort L2 (spec § 9): firmaets modus fra lokal cache (fornyes ved synk).
  // Offline uten cache → «dagskort» (lesTimerModus-default). Dagskort-grenen under
  // er uendret; kortmodus bytter kun ut sedel-boks/arbeidstid/grupper/send.
  const kortModus = useMemo(
    () =>
      sedel ? lesTimerModusLokalt(sedel.organizationId) === "prosjektkort" : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sedel?.organizationId, sistSynkronisert],
  );
  const orgId = sedel?.organizationId;
  const reiseLonnsartId = useMemo(
    () => (orgId ? hentReiseLonnsartId(orgId) : null),
    [orgId],
  );
  const kortTimer = useMemo(
    () =>
      sedel ? tilKortTimerRader(timerRader, sedel.projectId, reiseLonnsartId) : [],
    [sedel, timerRader, reiseLonnsartId],
  );
  const kortMaskin = useMemo(
    () => (sedel ? tilKortMaskinRader(maskinRader, sedel.projectId) : []),
    [sedel, maskinRader],
  );
  const kortIder = useMemo(
    () =>
      sedel
        ? kortProsjektIder(
            sedel.projectId,
            [timerRader, maskinRader, tilleggRader, utleggRader],
            [],
          )
        : [],
    [sedel, timerRader, maskinRader, tilleggRader, utleggRader],
  );
  const utleggAntall = useMemo(() => {
    const m = new Map<string, number>();
    if (!sedel) return m;
    for (const r of utleggRader) {
      const pid = r.projectId ?? sedel.projectId;
      m.set(pid, (m.get(pid) ?? 0) + 1);
    }
    return m;
  }, [sedel, utleggRader]);
  // Vareforbruk: server-linjer (online) + linjer ført fra prosjektkortet lokalt
  // (L3, også offline). Samme klient-id → telles én gang.
  const vareQuery = trpc.vareforbruk.hentMineForDato.useQuery(
    { organizationId: sedel?.organizationId ?? "", dato: sedel?.dato ?? "" },
    { enabled: kortModus && erPaaNettet && !!sedel },
  );
  const kortVarer = useMemo(
    () =>
      slaaSammenVarelinjer<{ id: string; projectId: string; antall: number; vare: { enhet: string } }>(
        tilKortVarer(vareQuery.data ?? []),
        kortModus && sedel ? hentLokaleVarelinjer(sedel.id) : [],
      ),
    [vareQuery.data, kortModus, sedel],
  );
  const byggeplassNavn = useCallback((byggeplassId: string): string | null => {
    const db = hentDatabase();
    if (!db) return null;
    return (
      db
        .select({ navn: byggeplassLocal.navn })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, byggeplassId))
        .all()[0]?.navn ?? null
    );
  }, []);
  const prosjektNavn = useCallback((projectId: string): string => {
    const p = finnProsjektLokalt(projectId);
    if (!p) return projectId;
    return `${p.projectNumber ? p.projectNumber + " — " : ""}${p.name}`;
  }, []);

  // L1 / B6: aktivt prosjekt-navn (sedelens primærprosjekt) for blå topp-oversikt.
  const sedelProsjektNavn = useMemo(() => {
    if (!sedel) return "";
    const p = finnProsjektLokalt(sedel.projectId);
    if (!p) return sedel.projectId;
    return `${p.projectNumber ? p.projectNumber + " — " : ""}${p.name}`;
  }, [sedel]);

  // L1 / B6 sedel-nivå byggeplass: navn til topp-oversikten + mismatch-deteksjon.
  // 1) Eksplisitt sedel-byggeplass (GPS ved «Start dag», eller valgt i velgeren)
  //    → navn via id. Mismatch = byggeplassens prosjekt ≠ sedelens prosjekt
  //    (GPS plasserte arbeider på en byggeplass under et annet prosjekt enn valgt).
  // 2) Ellers: entydig byggeplass for sedelens prosjekt (nøyaktig én i cache).
  const byggeplassInfo = useMemo(() => {
    const db = hentDatabase();
    if (!db || !sedel) return { navn: null as string | null, mismatch: null as
      | { byggeplass: string; gpsProsjekt: string; sedelProsjekt: string }
      | null };
    if (sedel.byggeplassId) {
      const bp = db
        .select({
          navn: byggeplassLocal.navn,
          projectId: byggeplassLocal.projectId,
        })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, sedel.byggeplassId))
        .all()[0];
      if (bp) {
        const navn = bp.navn ?? null;
        const mismatch =
          bp.projectId !== sedel.projectId
            ? {
                byggeplass: navn ?? sedel.byggeplassId,
                gpsProsjekt:
                  finnProsjektLokalt(bp.projectId)?.name ?? bp.projectId,
                sedelProsjekt:
                  finnProsjektLokalt(sedel.projectId)?.name ?? sedel.projectId,
              }
            : null;
        return { navn, mismatch };
      }
    }
    const perProsjekt = db
      .select({ navn: byggeplassLocal.navn })
      .from(byggeplassLocal)
      .where(eq(byggeplassLocal.projectId, sedel.projectId))
      .all();
    if (perProsjekt.length === 1 && perProsjekt[0].navn) {
      return { navn: perProsjekt[0].navn, mismatch: null };
    }
    return { navn: null, mismatch: null };
  }, [sedel]);

  // L1 / B6: skriv valgt byggeplass på sedelen (sedel-nivå) + merk pending.
  // Sync-laget sender byggeplassId på sedel-nivå; server propagerer til rader.
  // Funn #2 (device 2026-08-08): `null` = «Ingen byggeplass» — gjenoppretter den
  // opprinnelige tomme tilstanden så en feilvalgt byggeplass kan angres (feltet
  // var nullbart før første valg; nedstrøms tåler null: byggeplassInfo faller til
  // «entydig/ingen»-grenen, og rad-arven blir umarkert «Arv fra dagskortet»).
  const velgByggeplass = useCallback(
    (byggeplassId: string | null) => {
      const db = hentDatabase();
      if (!db || !sedel) return;
      db.update(dagsseddelLocal)
        .set({
          byggeplassId,
          sistEndretLokalt: Date.now(),
          syncStatus: "pending",
        })
        .where(eq(dagsseddelLocal.id, sheetId))
        .run();
      setVisByggeplassVelger(false);
      oppdaterTellere();
      void triggerSync();
      lesData();
    },
    [sedel, sheetId, oppdaterTellere, triggerSync, lesData],
  );

  const markerEndretOgLes = useCallback(() => {
    const db = hentDatabase();
    if (!db || !sedel) return;
    db.update(dagsseddelLocal)
      .set({
        sistEndretLokalt: Date.now(),
        syncStatus: "pending",
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    oppdaterTellere();
    void triggerSync();
    lesData();
  }, [sedel, sheetId, oppdaterTellere, triggerSync, lesData]);

  // F5: matpause-toggle (dag-nivå, kryss-bøtte via sheetId). Flytt-ikke-radio:
  //  - PÅ på en rad → sett bæreren der (forrige nulles stille).
  //  - AV på bæreren → flytt til neste kvalifiserte rad (+ toast); ingen
  //    kvalifisert → ekte bekreftelsesmodal FØR fjerning (AML-varsel).
  // Servicen skriver rad-pauseMin + recompute timer + dagsseddel.pauseMin=Σ i én
  // tx; markerEndretOgLes marker pending + synk + les. (Ikke Alert/confirm.)
  const handterPauseToggle = useCallback(
    (radId: string, vilHa: boolean) => {
      if (!sedel) return;
      if (vilHa) {
        settMatpauseBaerer(sheetId, radId, sedel.organizationId, sedel.dato);
        markerEndretOgLes();
        return;
      }
      const res = flyttMatpauseVedAvhuking(
        sheetId,
        radId,
        sedel.organizationId,
        sedel.dato,
      );
      if (res.utfall === "flyttet") {
        markerEndretOgLes();
        visPauseToast(t("timer.matpause.flyttet", { tidsrom: res.tilTidsrom }));
      } else if (res.utfall === "ingenKvalifisert") {
        setBekreftFjernRadId(radId);
      }
    },
    [sedel, sheetId, markerEndretOgLes, visPauseToast, t],
  );

  const bekreftFjernMatpause = useCallback(() => {
    if (!sedel) return;
    fjernMatpause(sheetId, sedel.organizationId, sedel.dato);
    setBekreftFjernRadId(null);
    markerEndretOgLes();
  }, [sedel, sheetId, markerEndretOgLes]);

  function sendTilAttestering() {
    if (!sedel) return;
    if (timerRader.length === 0) {
      setFeil(t("timer.feil.minstEnTimerRad"));
      return;
    }
    const db = hentDatabase();
    if (!db) return;
    db.update(dagsseddelLocal)
      .set({
        status: "sent",
        syncStatus: "pending",
        sistEndretLokalt: Date.now(),
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    setFeil(null);
    oppdaterTellere();
    void triggerSync();
    lesData();
  }

  // UF-4: gjenåpne en sendt sedel for etter-registrering. Online-only — kaller
  // server-mutasjonen direkte (man kan ikke recalle uten å kjenne server-status).
  // Suksess → speil server lokalt (draft, synced). accepted/offline → melding.
  //
  // M7 (2026-07-10): bekreftelse før gjenåpning. `gjenaapne()` viser Alert
  // (mobilens bekreftelses-idiom, samme som slettSedel), `utforGjenaapne()`
  // kjører mutasjonen. IKKE style: "destructive" — gjenåpning er reversibel
  // (sedelen sendes bare på nytt), ulikt slettSedel. Gjenbruker webs
  // bekreft*-nøkler (M4 la dem, brukt kun av web til nå).
  function gjenaapne() {
    if (!sedel) return;
    Alert.alert(
      t("timer.gjenaapne.bekreftTittel"),
      t("timer.gjenaapne.bekreftTekst"),
      [
        { text: t("handling.avbryt"), style: "cancel" },
        { text: t("timer.gjenaapne.bekreftKnapp"), onPress: utforGjenaapne },
      ],
    );
  }

  function utforGjenaapne() {
    if (!sedel) return;
    setFeil(null);
    gjenaapneMutation.mutate(
      { id: sheetId },
      {
        onSuccess: () => {
          const db = hentDatabase();
          if (db) {
            db.update(dagsseddelLocal)
              .set({
                status: "draft",
                syncStatus: "synced",
                sistEndretLokalt: Date.now(),
              })
              .where(eq(dagsseddelLocal.id, sheetId))
              .run();
          }
          oppdaterTellere();
          lesData();
        },
        onError: (e: unknown) => {
          // M4 (2026-07-10): map på tRPC-feilkode, ikke delstreng på meldingen.
          // To kjente koder får egne i18n-tekster; enhver ANNEN kode (BAD_REQUEST
          // fra ikke-sent-status, FORBIDDEN/NOT_FOUND fra hentEgenDagsseddel, samt
          // alt fremtidig) viser serverens egen melding. KUN når e.data.code helt
          // mangler er det en ekte nettverksfeil → «Krever nett».
          const code = (e as { data?: { code?: string } } | null)?.data?.code;
          const melding = e instanceof Error ? e.message : "";
          setFeil(
            code === "CONFLICT"
              ? t("timer.gjenaapne.feilGodkjent")
              : code === "PRECONDITION_FAILED"
                ? t("timer.gjenaapne.laastAttestert")
                : code != null
                  ? melding
                  : t("timer.gjenaapne.feilNett"),
          );
        },
      },
    );
  }

  function slettLokalt() {
    const db = hentDatabase();
    if (!db) return;
    // Fjern lokale rader + selve sedlen.
    db.delete(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .run();
    db.delete(sheetTilleggLocal)
      .where(eq(sheetTilleggLocal.dagsseddelId, sheetId))
      .run();
    db.delete(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .run();
    db.delete(sheetUtleggLocal)
      .where(eq(sheetUtleggLocal.dagsseddelId, sheetId))
      .run();
    db.delete(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
    oppdaterTellere();
    router.back();
  }

  function slettSedel() {
    // Returnert sedel lever på serveren (ble sendt → returnert). Den må slettes der
    // først (online), ellers kommer den tilbake ved neste pull. En draft som aldri er
    // sendt finnes bare lokalt → ren lokal sletting (server så den aldri).
    const erServerSedel = sedel?.status === "returned";
    if (erServerSedel && !erPaaNettet) {
      Alert.alert(t("timer.slettDagsseddel"), t("timer.slettReturnertKreverNett"));
      return;
    }
    Alert.alert(t("timer.bekreftSlett"), t("timer.bekreftSlettBeskrivelse"), [
      { text: t("handling.avbryt"), style: "cancel" },
      {
        text: t("handling.slett"),
        style: "destructive",
        onPress: () => {
          if (erServerSedel) {
            slettMutation.mutate(
              { id: sheetId },
              {
                onSuccess: () => slettLokalt(),
                onError: (e) =>
                  Alert.alert(t("timer.slettDagsseddel"), e.message),
              },
            );
          } else {
            slettLokalt();
          }
        },
      },
    ]);
  }

  if (!sedel) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-row items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color="#1f2937" />
          </Pressable>
          <Text className="flex-1 text-lg font-semibold text-gray-900">
            {t("timer.dagsseddel")}
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">{t("timer.ikkeFunnet")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Topp-bar */}
      <View className="flex-row items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color="#1f2937" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {formatNorskDato(sedel.dato)}
          </Text>
        </View>
        <TimerStatusMerkelapp
          status={sedel.status}
          syncStatus={sedel.syncStatus}
        />
      </View>

      {/* Dagstotal-banner — sum på tvers av prosjekter for samme dato.
          Ekskluderer denne sedlen for å vise hva som er ført ANDRE steder. */}
      <DagstotalBanner
        userId={sedel.userId}
        dato={sedel.dato}
        ekskluderSheetId={sedel.id}
      />

      {/* B6.3-markør: normen er ikke dagens server-svar. "ukjent" = ingen
          overtid-splitt (UNDERbetaling-risiko) → aldri stille. Lag 3 flytter
          markøren til bekreftelsesskjermen. */}
      {normStatus !== "server" && (
        <View className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <Text className="text-xs text-amber-800">
            {normStatus === "ukjent"
              ? t("timer.normMarkor.ukjent.banner")
              : t("timer.normMarkor.cachet.banner")}
          </Text>
        </View>
      )}

      {/* U1: topp-sum — dagens registrerte timer vs norm, synlig uten scroll
          (flyttet fra bunn-handlingsblokken). Fast over ScrollView; vises i
          alle tilstander, ikke bare ved redigerbar. */}
      <View className="mx-4 mt-3">
        <SummeringsBanner
          totaltimer={totaltimer}
          normTimer={normTimer}
          maskinTimer={totalMaskin}
        />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-24">
        {/* L1 / B6 sedel-nivå: blå topp-oversikt — aktivt prosjekt + byggeplass.
            Pil-til-høyre åpner byggeplass-velger (kun redigerbar). Byggeplass er
            sedel-nivå (én/dag); per-rad/«splitt dagen» er Beslutning 6-oppfølger. */}
        {/* Prosjektkort L2 (spec § 7): sedel-boksen faller bort i kortmodus —
            byggeplass vises pr. kort, arv-kilden i «Dagens ramme». */}
        {!kortModus && (
        <Pressable
          disabled={!erRedigerbar}
          onPress={() => setVisByggeplassVelger(true)}
          className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3"
        >
          <MapPin size={18} color="#1e40af" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-sitedoc-primary">
              {sedelProsjektNavn}
            </Text>
            <Text className="text-xs text-gray-600">
              {byggeplassInfo.navn ?? t("timer.byggeplass.velg")}
            </Text>
          </View>
          {erRedigerbar && <ChevronRight size={18} color="#1e40af" />}
        </Pressable>
        )}

        {/* Del 3: myk, ikke-blokkerende advisory — GPS-byggeplassen tilhører et
            annet prosjekt enn det valgte (G1: arbeider-valg er autoritativt). */}
        {byggeplassInfo.mismatch && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.byggeplassMismatch.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.byggeplassMismatch.tekst", {
                byggeplass: byggeplassInfo.mismatch.byggeplass,
                gpsProsjekt: byggeplassInfo.mismatch.gpsProsjekt,
                sedelProsjekt: byggeplassInfo.mismatch.sedelProsjekt,
              })}
            </Text>
          </View>
        )}

        {/* UF-0: subtil notis — dagen fantes alt, find-or-open åpnet den. */}
        {visAapnetNotis && (
          <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <Info size={14} color="#6b7280" />
            <Text className="flex-1 text-xs text-gray-600">
              {t("timer.dagFinnes.notis")}
            </Text>
            <Pressable onPress={() => setVisAapnetNotis(false)} hitSlop={8}>
              <X size={14} color="#9ca3af" />
            </Pressable>
          </View>
        )}

        {/* Status-banners */}
        {sedel.status === "returned" && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.detalj.returnertTittel")}
              </Text>
            </View>
            {sedel.lederKommentar && (
              <Text className="mt-1 text-sm text-amber-800">
                {sedel.lederKommentar}
              </Text>
            )}
            <Text className="mt-1 text-xs text-amber-700">
              {t("timer.detalj.returnertHjelp")}
            </Text>
          </View>
        )}

        {sedel.status === "accepted" && (
          <View className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={16} color="#15803d" />
              <Text className="text-sm font-semibold text-green-900">
                {/* F4-3: bruk ren «Attestert»-nøkkel (uten {{dato}}) — mobil
                    viser attestert-tidspunktet separat under (formatTidspunkt,
                    linjen rett nedenfor). Den delte `attestertTittel`-nøkkelen
                    har {{dato}} og brukes fortsatt av web (page.tsx:441), der
                    tittelen er eneste dato-sted; endres derfor ikke. */}
                {t("timer.status.attestert")}
              </Text>
            </View>
            {sedel.attestertVed && (
              <Text className="mt-1 text-xs text-green-800">
                {formatTidspunkt(sedel.attestertVed)}
              </Text>
            )}
          </View>
        )}

        {sedel.syncStatus === "avvist" && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-900">
                {t("timer.sync.avvist")}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-red-800">
              {sedel.feilmelding ?? t("timer.sync.avvistBeskrivelse")}
            </Text>
          </View>
        )}

        {/* U-BEKREFT steg 1: det røde conflict-banneret peker nå HIT — sammenlignings-
            visningen er den ekte veien videre. Viser begge dagskort pr. tidsrom (modus B
            redigerbar / modus C låst lesevisning), eller «får ikke kontakt» offline.
            Skriver ingenting i dette steget. */}
        {sedel.syncStatus === "conflict" && (
          <>
            {/* V19-B (B-2): overlapp-banner — dagen er også ført på PC, og tidene
                overlapper. Sammenligningen rett under er veien til å velge. */}
            {erOverlapp && (
              <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <View className="flex-row items-start gap-2">
                  <AlertTriangle size={16} color="#b45309" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-sm text-amber-900">
                    {t("timer.sammenlign.overlappBanner")}
                  </Text>
                </View>
              </View>
            )}
            <DagskortSammenligning
              resultat={sammenligning}
              valg={effektivtValg}
              onVelg={(nokkel, side) =>
                setValgOverstyr((forrige) => ({ ...forrige, [nokkel]: side }))
              }
              onVelgAlle={erOverlapp ? håndterVelgAlle : undefined}
              onBekreft={håndterBekreft}
              bekrefter={forsonMutation.isPending}
            />
            {bekreftFeilTekst && (
              <View className="mx-4 mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                <Text className="text-sm text-red-800">{bekreftFeilTekst}</Text>
              </View>
            )}
          </>
        )}

        {sedel.syncStatus === "pending" && (
          <View className="mx-4 mt-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
            <View className="flex-row items-center gap-2">
              <RotateCcw size={14} color="#a16207" />
              {/* FUNN 2026-10-05: pending-banneret LESTE aldri feilmelding (søsterfunn
                  :304) — et mislykket synk-forsøk var usynlig. Vis server-/klient-
                  feilen når den finnes, ellers dagens «venter»-tekst. */}
              <Text className="flex-1 text-sm text-yellow-800">
                {sedel.feilmelding
                  ? t("timer.sync.venterFeil", { feilmelding: sedel.feilmelding })
                  : t("timer.sync.venterEn")}
              </Text>
            </View>
            {/* Escape-luke: tving en synk nå i stedet for å vente på 30s-intervallet. */}
            <Pressable
              onPress={() => void triggerSync()}
              className="mt-2 self-start rounded-md border border-yellow-300 bg-white px-3 py-1.5"
              accessibilityRole="button"
            >
              <Text className="text-sm font-medium text-yellow-900">
                {t("timer.sync.proevIgjenNaa")}
              </Text>
            </Pressable>
          </View>
        )}

        {/* F-A: glemt-dag (sluttTidKilde="system") — konkret estimat-banner så
            arbeider ser gjettet slutt + total + antall rader. Ikke-blokkerende. */}
        {sedel.status === "draft" &&
        sedel.autoGenerert &&
        sedel.sluttTidKilde === "system" ? (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.glemtDag.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.glemtDag.hjelp", {
                sluttTid: isoTidspunktTilHHMM(sedel.endAt),
                timer: totaltimer.toFixed(1),
                antall: timerRader.length,
              })}
            </Text>
          </View>
        ) : sedel.status === "draft" && sedel.autoGenerert ? (
          /* Slice 3: generisk auto-fyll-banner (bruker-bekreftet slutt). */
          <View className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <View className="flex-row items-center gap-2">
              <Sparkles size={16} color="#1e40af" />
              <Text className="text-sm font-semibold text-blue-900">
                {t("timer.autoFyll.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-blue-700">
              {t("timer.autoFyll.hjelp")}
            </Text>
          </View>
        ) : null}

        {ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="flex-1 text-sm text-red-900">
                {t("timer.ikkeAnsatt", { firma: ikkeAnsattFirmanavn })}
              </Text>
            </View>
          </View>
        )}

        {/* (d): firmaet mangler standard-lønnsart → auto-rader kunne ikke føres.
            Surface tydelig (aldri stille 0) — arbeider fører manuelt m/ riktig
            lønnsart. Ingen gjetting = ingen feil lønn. */}
        {manglerStandardLonnsart && erRedigerbar && !ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b91c1c" />
              <Text className="text-sm font-semibold text-red-900">
                {t("timer.manglerLonnsart.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-red-800">
              {t("timer.manglerLonnsart.hjelp")}
            </Text>
          </View>
        )}

        {/* ③a: firmaet mangler overtid-lønnsart → overtid utover normaltid ble
            ikke ført automatisk (aldri feil-match). Amber = konfig-nudge, ikke
            kritisk: normaltiden er ført; arbeider fører evt. overtid manuelt. */}
        {manglerOvertidLonnsart && erRedigerbar && !ikkeAnsatt && (
          <View className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="#b45309" />
              <Text className="text-sm font-semibold text-amber-900">
                {t("timer.manglerOvertid.tittel")}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-amber-800">
              {t("timer.manglerOvertid.hjelp")}
            </Text>
          </View>
        )}

        {/* Slice 4a: «delt ved midnatt»-merking — sedelen er ett segment av et
            skift som krysset midnatt. Forklarer lave per-dag-timer som legitim
            splitt. Vises uavhengig av status (fakta om sedelen). */}
        {sedel.deltVedMidnatt && (
          <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <Split size={14} color="#4338ca" />
            <Text className="flex-1 text-xs text-indigo-800">
              <Text className="font-semibold">{t("timer.deltMidnatt.tittel")}</Text>
              {" — "}
              {t("timer.deltMidnatt.hjelp")}
            </Text>
          </View>
        )}

        {kortModus ? (
          <ProsjektkortSamleside
            prosjektIder={kortIder}
            timer={kortTimer}
            maskin={kortMaskin}
            varer={kortVarer}
            utleggAntall={utleggAntall}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            sedelStatus={sedel.status}
            normTimer={normTimer}
            ramme={{
              fra: isoTidspunktTilHHMM(sedel.startAt),
              til: isoTidspunktTilHHMM(sedel.endAt),
              pauseMin: sedel.pauseMin ?? 0,
            }}
            rammeByggeplassNavn={byggeplassInfo.navn}
            prosjektNavn={prosjektNavn}
            byggeplassNavn={byggeplassNavn}
            redigerbar={erRedigerbar}
            onAapneKort={(pid) => router.push(`/timer/${sheetId}/kort/${pid}`)}
            onNyttKort={() => setVisLeggTilProsjekt(true)}
            onEndreRamme={() => setVisRammeModal(true)}
            onEndreByggeplass={() => setVisByggeplassVelger(true)}
            onSend={sendTilAttestering}
          />
        ) : (
        <>
        <ArbeidstidSeksjon
          sheetId={sheetId}
          dato={sedel.dato}
          startAt={sedel.startAt}
          endAt={sedel.endAt}
          pauseMin={sedel.pauseMin}
          beskrivelse={sedel.beskrivelse ?? null}
          timerRader={timerRader}
          redigerbar={erRedigerbar}
          onEndret={markerEndretOgLes}
        />

        {/* T7-4e (2026-05-16): per-prosjekt blokker, med N ECO-bukets per
            prosjekt. Hver bucket inneholder timer + maskin (underpost).
            Tillegg holdes per-prosjekt (ingen ECO-felt på SheetTillegg).
            Speil av T7-4c web-strukturen. */}
        {aktiveProsjektIder.map((pid) => (
          <ProsjektGruppe
            key={pid}
            projectId={pid}
            visHeader={true}
            sheetId={sheetId}
            organizationId={sedel.organizationId}
            sedelProjectId={sedel.projectId}
            sedelByggeplassId={sedel.byggeplassId ?? null}
            dato={sedel.dato}
            pauseMin={sedel.pauseMin}
            defaultAktivitetId={sedel.aktivitetId ?? null}
            harEquipmentCache={harEquipmentCache}
            harMaskinforerbevis={harMaskinforerbevis}
            redigerbar={erRedigerbar}
            onPauseToggle={handterPauseToggle}
            timerRader={timerRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            alleTimerRader={timerRader}
            tilleggRader={tilleggRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            maskinRader={maskinRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            utleggRader={utleggRader.filter((r) => (r.projectId ?? sedel.projectId) === pid)}
            onEndret={markerEndretOgLes}
          />
        ))}

        {erRedigerbar && (
          <Pressable
            onPress={() => setVisLeggTilProsjekt(true)}
            className="mx-4 mt-4 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white py-3 active:bg-gray-50"
          >
            <Plus size={14} color="#1e40af" />
            <Text className="text-sm font-medium text-sitedoc-primary">
              {t("timer.leggTilProsjekt")}
            </Text>
          </Pressable>
        )}
        </>
        )}

        {feil && (
          <Text className="mx-4 mt-4 text-sm text-red-600">{feil}</Text>
        )}

        {/* Handlinger (topp-sum flyttet til toppen — U1) */}
        <View className="mx-4 mt-6 gap-2">
          {erRedigerbar && !kortModus && (
            <Pressable
              onPress={sendTilAttestering}
              className="flex-row items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 active:bg-blue-700"
            >
              <Send size={16} color="#ffffff" />
              <Text className="text-base font-semibold text-white">
                {t("timer.sendMedSum", { timer: totaltimer.toFixed(2) })}
              </Text>
            </Pressable>
          )}
          {erRedigerbar && !kortModus && (
            <Text className="text-center text-xs text-gray-500">
              {t("timer.sendGodkjennHint")}
            </Text>
          )}
          {/* UF-4: recall — kun på SENDT sedel (ikke godkjent). */}
          {sedel.status === "sent" &&
            (kanGjenaapneDagsseddel(sedel.status, sedel.syncStatus) ? (
              <>
                <Pressable
                  onPress={gjenaapne}
                  disabled={gjenaapneMutation.isPending}
                  className="flex-row items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-3 active:bg-blue-50 disabled:opacity-50"
                >
                  <RotateCcw size={16} color="#1e40af" />
                  <Text className="text-base font-medium text-sitedoc-primary">
                    {t("timer.gjenaapne.knapp")}
                  </Text>
                </Pressable>
                <Text className="text-center text-xs text-gray-500">
                  {t("timer.gjenaapne.hjelp")}
                </Text>
              </>
            ) : (
              /* Datatap-ordre 2026-09-30: Gjenåpne er DEAKTIVERT i conflict.
                 Å gjenåpne ville bumpe server-updatedAt → neste pull sletter de
                 lokale radene (som kun finnes her). Knappen står synlig men grå
                 så flaten ikke blir en ny stille tomhet, med tekst som sier at
                 timene er bevart og at lederen kan returnere sedelen. */
              <>
                <Pressable
                  disabled
                  className="flex-row items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 py-3 opacity-50"
                >
                  <RotateCcw size={16} color="#9ca3af" />
                  <Text className="text-base font-medium text-gray-400">
                    {t("timer.gjenaapne.knapp")}
                  </Text>
                </Pressable>
                <Text className="text-center text-xs text-gray-500">
                  {t("timer.gjenaapne.sperretKonflikt")}
                </Text>
              </>
            ))}
          {/* Kenneth-vedtak 2026-10-09 (2): slett draft ELLER returnert-ikke-attestert.
              attestertVed=null gjelder alltid for returned i mobil-cachen (en attestert
              sedel har status accepted, ikke returned). */}
          {(sedel.status === "draft" || sedel.status === "returned") && (
            <Pressable
              onPress={slettSedel}
              className="flex-row items-center justify-center gap-2 rounded-lg border border-red-300 bg-white py-3 active:bg-red-50"
            >
              <Trash2 size={16} color="#dc2626" />
              <Text className="text-base font-medium text-red-600">
                {t("timer.slettDagsseddel")}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {visLeggTilProsjekt && (
        <ProsjektVelgerModal
          organizationId={sedel.organizationId}
          valgtId={null}
          ekskluderIder={kortModus ? kortIder : aktiveProsjektIder}
          onVelg={(id) => {
            setVisLeggTilProsjekt(false);
            // Kortmodus: nytt kort åpnes direkte; lagres når første rad legges til.
            if (kortModus) {
              router.push(`/timer/${sheetId}/kort/${id}`);
              return;
            }
            setEkstraProsjektIder((forrige) =>
              forrige.includes(id) ? forrige : [...forrige, id],
            );
          }}
          onLukk={() => setVisLeggTilProsjekt(false)}
        />
      )}

      {visRammeModal && (
        <RedigerArbeidstidModal
          sheetId={sheetId}
          dato={sedel.dato}
          startAt={sedel.startAt}
          endAt={sedel.endAt}
          beskrivelse={sedel.beskrivelse ?? null}
          onLukk={() => setVisRammeModal(false)}
          onLagret={() => {
            setVisRammeModal(false);
            markerEndretOgLes();
          }}
        />
      )}

      {visByggeplassVelger && (
        <ByggeplassVelgerModal
          projectId={sedel.projectId}
          valgtId={sedel.byggeplassId ?? null}
          tillatIngen
          onVelg={velgByggeplass}
          onLukk={() => setVisByggeplassVelger(false)}
        />
      )}

      {/* F5: ekte bekreftelsesmodal (ikke confirm/Alert) når matpausen hukes av
          uten kvalifisert rad å flytte til — AML-varsel, ikke-blokkerende. */}
      <Modal
        visible={bekreftFjernRadId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBekreftFjernRadId(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View className="w-full max-w-sm rounded-2xl bg-white p-5">
            <View className="mb-2 flex-row items-center gap-2">
              <AlertTriangle size={20} color="#d97706" />
              <Text className="flex-1 text-base font-semibold text-gray-900">
                {t("timer.matpause.fjernTittel")}
              </Text>
            </View>
            <Text className="mb-4 text-sm text-gray-600">
              {t("timer.matpause.fjernTekst")}
            </Text>
            <View className="flex-row justify-end gap-2">
              <Pressable
                onPress={() => setBekreftFjernRadId(null)}
                className="rounded-lg px-4 py-2.5 active:bg-gray-100"
              >
                <Text className="text-base font-medium text-gray-700">
                  {t("handling.avbryt")}
                </Text>
              </Pressable>
              <Pressable
                onPress={bekreftFjernMatpause}
                className="rounded-lg bg-amber-600 px-4 py-2.5 active:bg-amber-700"
              >
                <Text className="text-base font-semibold text-white">
                  {t("timer.matpause.fjernBekreft")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <MiniToast melding={pauseToast} />
    </SafeAreaView>
  );
}
