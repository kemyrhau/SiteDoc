import { useCallback, useState, useMemo, useEffect } from "react";
import { Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { eq } from "drizzle-orm";
import { hentDatabase } from "../../../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
  sheetUtleggLocal,
  byggeplassLocal,
} from "../../../db/schema";
import { leggSedelTombstone } from "../../../services/sedelTombstone";
import { useTimerSync } from "../../../providers/TimerSyncProvider";
import { useNettverk } from "../../../providers/NettverkProvider";
import { trpc } from "../../../lib/trpc";
import {
  dagskortSammenligning,
  overlappSammenligning,
  type Side,
} from "../../../lib/dagskortSammenligning";
import { lesTimerModusLokalt } from "../../../services/organizationSettingKatalog";
import {
  kortNokler,
  kortProsjektIder,
  tilKortMaskinRader,
  tilKortTimerRader,
  tilKortVarer,
  type KortValg,
  type SedelKortKontekst,
} from "../../../lib/prosjektkortMobil";
import type { VisVarelinje } from "../VareforbrukLesListe";
import { finnProsjektLokalt } from "../../../services/prosjektKatalog";
import { prosjektVisningsnavn } from "../../../utils/prosjektNavn";
import {
  hentDagsnormLokalt,
  hentOgCacheArbeidstidSvar,
} from "../../../services/arbeidstidSvarKatalog";
import {
  hentStandardLonnsartLokalt,
  harOvertidLonnsartLokalt,
  hentReiseLonnsartId,
  finnUnderprosjektLokalt,
} from "../../../services/timerKatalog";
import type { ForsonRad as DeltForsonRad } from "@sitedoc/shared";
import { slaaSammenVarelinjer } from "@sitedoc/shared";
import { hentLokaleVarelinjer } from "../../../services/vareforbrukSync";
import type {
  Sedel,
  TimerRad,
  TilleggRad,
  MaskinRad,
  UtleggRad,
} from "../../../types/timer-detalj";
import { bekreftConflict } from "../../../services/timerSync";
import {
  anvendForsonetLokalt,
  byggForsonOverlappKall,
  type ForsonetServerRad,
} from "../../../lib/forsoningSpeil";
import { useReLesVedSynk } from "../../../hooks/useReLesVedSynk";
import { useFirma } from "../../../kontekst/FirmaKontekst";
import { hentEquipmentLokalt } from "../../../services/maskinKatalog";
import { hentVarelagerProsjekterLokalt } from "../../../services/vareKatalog";

// ORDRE 35 (I2): prosjektkortets datalag. Dette er en KOPI av logikken i
// `app/timer/[id].tsx` (dagskortet) — lesing, synk, konflikt/forsoning, norm,
// send, gjenåpne, slett og byggeplass — så dagskortet aldri må røres når
// prosjektkortet endres. En fiks i den ene kopien skal vurderes i den andre;
// `prosjektkort-glue-vakt.test.ts` feiler hvis en kopi bytter eller dropper et
// service-kall (timer.md § Prosjektkort-isolering).

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

/** Lokal timer-rad → forson-payload; null når et serverkrevd felt mangler. */
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
  grunn?: string | null;
};

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

export function useProsjektkortSedel(sheetId: string) {
  const router = useRouter();
  const { t } = useTranslation();
  const { triggerSync, oppdaterTellere, sistSynkronisert } = useTimerSync();
  const gjenaapneMutation = trpc.timer.dagsseddel.gjenaapneDagsseddel.useMutation();
  // Returnert sedel lever på serveren → slettes der (online); draft slettes lokalt.
  const slettMutation = trpc.timer.dagsseddel.slett.useMutation();

  const [sedel, setSedel] = useState<Sedel | null>(null);
  const [timerRader, setTimerRader] = useState<TimerRad[]>([]);
  const [tilleggRader, setTilleggRader] = useState<TilleggRad[]>([]);
  const [maskinRader, setMaskinRader] = useState<MaskinRad[]>([]);
  const [utleggRader, setUtleggRader] = useState<UtleggRad[]>([]);
  const [feil, setFeil] = useState<string | null>(null);

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
    setTimerRader(
      db.select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).all(),
    );
    setTilleggRader(
      db.select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.dagsseddelId, sheetId)).all(),
    );
    setMaskinRader(
      db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
    );
    setUtleggRader(
      db.select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.dagsseddelId, sheetId)).all(),
    );
  }, [sheetId]);

  useFocusEffect(
    useCallback(() => {
      lesData();
    }, [lesData]),
  );
  // Bakgrunnssynk mens skjermen er i fokus → les på nytt (som dagskortet).
  useReLesVedSynk(sistSynkronisert, lesData);

  // Konflikt: hent web-kortet live (kun conflict + nett), som dagskortet.
  const { erPaaNettet } = useNettverk();
  const erKonflikt = sedel?.syncStatus === "conflict";
  const erOverlapp = sedel?.konfliktAarsak === "overlapp";
  const webKortQuery = trpc.timer.dagsseddel.hentMedId.useQuery(
    { id: sheetId },
    { enabled: !!erKonflikt && erPaaNettet && !!sheetId },
  );
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

  // Anvend valgene atomisk på web-kortet, speil svaret lokalt og kvitter konflikten.
  const forsonMutation = trpc.timer.dagsseddel.forsonDagskort.useMutation();
  const [bekreftFeilTekst, setBekreftFeilTekst] = useState<string | null>(null);
  const håndterBekreft = useCallback(async () => {
    if (sammenligning.slag !== "modusB") return;

    let oppdateringer: (ForsonRad & { id: string })[] = [];
    let nyeRader: ForsonRad[] = [];
    let slettinger: string[] = [];

    if (erOverlapp) {
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
      const lokalEtterId = new Map(timerRader.map((r) => [r.id, r]));
      for (const rad of sammenligning.rader) {
        const key = rad.nokkel ?? rad.tidsrom;
        const v = effektivtValg[key];
        if (rad.lokal && rad.server && v === "lokal") {
          const full = lokalEtterId.get(rad.lokal.id);
          const p = full ? lokalRadTilForson(full) : null;
          if (!p) {
            setBekreftFeilTekst(t("timer.sammenlign.radMangler"));
            return;
          }
          oppdateringer.push({ id: rad.server.id, ...p });
        } else if (rad.lokal && !rad.server) {
          const full = lokalEtterId.get(rad.lokal.id);
          const p = full ? lokalRadTilForson(full) : null;
          if (!p) {
            setBekreftFeilTekst(t("timer.sammenlign.radMangler"));
            return;
          }
          nyeRader.push(p);
        }
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

  const { firmaer, erAnsattIFirma } = useFirma();
  const ikkeAnsatt = erAnsattIFirma(sedel?.organizationId) === false;
  const ikkeAnsattFirmanavn =
    firmaer.find((f) => f.id === sedel?.organizationId)?.name ?? "";

  const manglerStandardLonnsart = useMemo(() => {
    if (!sedel?.autoGenerert) return false;
    return hentStandardLonnsartLokalt(sedel.organizationId) == null;
  }, [sedel?.autoGenerert, sedel?.organizationId]);

  // Norm-svaret hentes fra serveren ved åpning; leses fra cachen, regnes aldri lokalt.
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

  const manglerOvertidLonnsart = useMemo(() => {
    if (!sedel?.autoGenerert) return false;
    if (normTimer == null || totaltimer < normTimer - 0.001) return false;
    return !harOvertidLonnsartLokalt(sedel.organizationId);
  }, [sedel?.autoGenerert, sedel?.organizationId, normTimer, totaltimer]);

  const totalMaskin = useMemo(
    () => maskinRader.reduce((sum, r) => sum + (r.timer ?? 0), 0),
    [maskinRader],
  );

  // Firmaets modus fra lokal cache (fornyes ved synk) — skjermen sender tilbake
  // til dagskortet hvis firmaet ikke lenger er i prosjektkort-modus.
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
  // Vareforbruk: server-linjer (online) + lokalt førte linjer; samme klient-id telles én gang.
  const vareQuery = trpc.vareforbruk.hentMineForDato.useQuery(
    { organizationId: sedel?.organizationId ?? "", dato: sedel?.dato ?? "" },
    { enabled: erPaaNettet && !!sedel },
  );
  const serverVarer = useMemo(() => tilKortVarer(vareQuery.data ?? []), [vareQuery.data]);
  const lokaleVarer = useMemo(() => (sedel ? hentLokaleVarelinjer(sedel.id) : []), [sedel]);
  // ORDRE 36b: dagsoversikten avgjør Maskin-/Varer-linjene (P1/P2) lokalt.
  const harEquipmentCache = useMemo(
    () => (orgId ? hentEquipmentLokalt(orgId).length > 0 : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, sistSynkronisert],
  );
  const [varelagerProsjekter, setVarelagerProsjekter] = useState<string[]>([]);
  useEffect(() => {
    if (!orgId) return;
    let aktiv = true;
    void hentVarelagerProsjekterLokalt(orgId).then((ider) => {
      if (aktiv) setVarelagerProsjekter(ider);
    });
    return () => {
      aktiv = false;
    };
  }, [orgId, sistSynkronisert]);
  const kortVarer = useMemo(
    () => slaaSammenVarelinjer<VisVarelinje>(serverVarer, lokaleVarer),
    [serverVarer, lokaleVarer],
  );
  // ORDRE 36b: dagens byggeplass med prosjekt — grunnlaget for effektiv
  // byggeplass i kortnøkkelen (rad uten egen byggeplass arver dagens bare i
  // samme prosjekt).
  const sedelKontekst = useMemo<SedelKortKontekst | null>(() => {
    if (!sedel) return null;
    const db = hentDatabase();
    const bp =
      db && sedel.byggeplassId
        ? db
            .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
            .from(byggeplassLocal)
            .where(eq(byggeplassLocal.id, sedel.byggeplassId))
            .all()[0]
        : undefined;
    return {
      projectId: sedel.projectId,
      byggeplass: bp ? { id: bp.id, projectId: bp.projectId } : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedel?.projectId, sedel?.byggeplassId, sistSynkronisert]);
  const ecoNavn = useCallback((ecoId: string): string => {
    const e = finnUnderprosjektLokalt(ecoId);
    return e ? `${e.proAdmId} — ${e.kortNavn}` : ecoId;
  }, []);
  // Kortlista (ORDRE 36b): ett kort per (prosjekt, effektiv byggeplass,
  // underprosjekt) over arbeid, maskin, varer, tillegg og utlegg (spec
  // tillegg-utlegg-prosjektkort § 3). Reise ligger i dag-seksjonen og lager ikke kort.
  const kort = useMemo<KortValg[]>(() => {
    if (!sedel || !sedelKontekst) return [];
    const db = hentDatabase();
    const bpNavn = (id: string) =>
      db
        ?.select({ navn: byggeplassLocal.navn })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, id))
        .all()[0]?.navn ?? id;
    return kortNokler(
      sedelKontekst,
      [timerRader.filter((_, i) => !kortTimer[i]?.erReise), maskinRader, kortVarer, tilleggRader, utleggRader],
      [],
      {
        byggeplassNavn: bpNavn,
        ecoNokkel: (id) => finnUnderprosjektLokalt(id)?.proAdmId ?? id,
      },
    );
  }, [sedel, sedelKontekst, timerRader, kortTimer, maskinRader, kortVarer, tilleggRader, utleggRader]);
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
    return prosjektVisningsnavn(finnProsjektLokalt(projectId), t("timer.detalj.ukjentProsjekt"));
  }, [t]);

  // Sedel-nivå byggeplass: navn + mismatch (GPS-byggeplass under et annet prosjekt).
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
                  prosjektVisningsnavn(finnProsjektLokalt(bp.projectId), t("timer.detalj.ukjentProsjekt")),
                sedelProsjekt:
                  prosjektVisningsnavn(finnProsjektLokalt(sedel.projectId), t("timer.detalj.ukjentProsjekt")),
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
  }, [sedel, t]);

  // Skriv valgt byggeplass på sedelen (null = «Ingen byggeplass») + merk pending.
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

  // Gjenåpne en sendt sedel (online-only), med bekreftelse først.
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
          // Map på tRPC-feilkode; ingen kode = ekte nettverksfeil.
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
            // ORDRE 36e (pkt. 2): en synket draft finnes også på serveren. Legg en
            // sedel-tombstone — synken sender `slett` (også offline senere) og
            // pull gjenoppliver den ikke. Aldri synket → serveren svarer
            // NOT_FOUND og tombstonen ryddes.
            const db = hentDatabase();
            if (db) leggSedelTombstone(db, sheetId);
            slettLokalt();
          }
        },
      },
    ]);
  }

  return {
    sedel,
    timerRader,
    feil,
    erOverlapp,
    sammenligning,
    effektivtValg,
    setValgOverstyr,
    håndterBekreft,
    håndterVelgAlle,
    bekrefter: forsonMutation.isPending,
    bekreftFeilTekst,
    erRedigerbar,
    ikkeAnsatt,
    ikkeAnsattFirmanavn,
    manglerStandardLonnsart,
    manglerOvertidLonnsart,
    normTimer,
    normStatus,
    totaltimer,
    totalMaskin,
    kortModus,
    kortTimer,
    kortMaskin,
    kortIder,
    kort,
    sedelKontekst,
    ecoNavn,
    tilleggRader,
    utleggRader,
    utleggAntall,
    kortVarer,
    maskinRader,
    reiseLonnsartId,
    harEquipmentCache,
    varelagerProsjekter,
    byggeplassNavn,
    prosjektNavn,
    byggeplassInfo,
    velgByggeplass,
    markerEndretOgLes,
    sendTilAttestering,
    gjenaapne,
    gjenaapnerPending: gjenaapneMutation.isPending,
    slettSedel,
    triggerSync,
  };
}
