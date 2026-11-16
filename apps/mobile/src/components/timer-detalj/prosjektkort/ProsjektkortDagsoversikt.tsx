import { useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, Modal, TextInput } from "react-native";
import { Clock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  beregnMaskinBrudd,
  byggNormtakBruddLinje,
  overstigerMaskinTak,
  visVareforbrukKnapp,
} from "@sitedoc/shared";
import {
  matpauseKontekst,
  matpauseRegelTrigget,
  radKanBaerePause,
  pauseTrukketMinForRad,
} from "../../../services/matpause";
import { hentDatabase } from "../../../db/database";
import { useAuth } from "../../../providers/AuthProvider";
import { trpc } from "../../../lib/trpc";
import { useTimerSync } from "../../../providers/TimerSyncProvider";
import { useNettverk } from "../../../providers/NettverkProvider";
import { finnLonnsartLokalt, finnNormtakArtLokalt } from "../../../services/timerKatalog";
import { bruddForDag } from "../../../utils/fravaerNormtakMobil";
import { finnEquipmentLokalt } from "../../../services/maskinKatalog";
import { erReiseRadVisning } from "../../../utils/reiseRad";
import { formatNorskDato } from "../../../utils/dato";
import {
  linjerForProsjekt,
  statusOrd,
  dagsoversiktSum,
  dagSumTimer,
  type OversiktTimerRad,
  type OversiktMaskinRad,
  type ProsjektLinjer,
} from "../../../utils/dagsoversikt";
import { raderForDag, grupperPaaKort, forsteRadUtenBeskrivelse } from "../../../utils/dagsoversiktRader";
import {
  formatKortTall,
  kortNokkel,
  kortNokkelFor,
  kortValgFor,
  lagretByggeplassForKort,
  vareByggeplassForKort,
  sendKnappTekst,
  type KortRad,
  type KortValg,
  type ProsjektKortValg,
  erProsjektKort,
  radProsjektId,
  type SedelKortKontekst,
} from "../../../lib/prosjektkortMobil";
import { TimerRadModal } from "../TimerSeksjon";
import { MaskinRadModal } from "../MaskinSeksjon";
import { SplittRadModal } from "../SplittRadModal";
import { KortVareforbrukModal } from "../KortVareforbrukModal";
import type { VisVarelinje } from "../VareforbrukLesListe";
import { ProsjektkortKontekst, type KortLaas } from "../prosjektkortKontekst";
import {
  leggTilTimerRad,
  oppdaterTimerRad,
  fjernTimerRad,
  oppdaterMaskinRad,
  fjernMaskinRad,
  type RadKontekst,
} from "./radLagring";
import {
  flyttKort,
  flyttMaskinRad,
  flyttVareLokalt,
  kortUtfallTekst,
  kanEndreVare,
  slettVarelinje,
  endreVareMengde,
  type KortUtfall,
  radInnhold,
  foelgKobletMaskin,
  loftByggeplassArv,
  trengerByggeplassLoft,
  type FlyttMaal,
} from "./kortRadFlytt";
import { KortValgModal } from "./KortValgModal";
import { FravaerKortModal } from "./FravaerKortModal";
import { skrivKortBeskrivelse } from "./kortBeskrivelse";
import { BekreftSlettModal } from "./BekreftSlettModal";
import { TastaturFerdig, TASTATUR_FERDIG_ID } from "../TastaturFerdig";
import type { Sedel, TimerRad, MaskinRad } from "../../../types/timer-detalj";

/**
 * ORDRE 36b (spec `dagsoversikt-beskrivelse-spec.md` § 2): dagsoversikten i
 * prosjektkort-modus. Erstatter samlesiden på `timer/[id]/prosjektkort` og
 * redigeringen på kortskjermen (`enkeltProsjekt`). Faste linjer pr. prosjekt,
 * bare grått og amber, to skriftstørrelser, ingen ikoner. Linjene åpner de
 * delte rad-modalene; ALL skriving går via `radLagring` (lagring C).
 *
 * Revidert plan RETUR 3: ett kort = (prosjekt, byggeplass, underprosjekt).
 * Prosjektnavnet står én gang, kortene under med «byggeplass · underprosjekt».
 * Rad-modalene åpnes med kortlås (byggeplass og underprosjekt grå); retting
 * går via «Flytt raden» (`kortRadFlytt.ts`). Reise hører til dagen
 * (`dagSeksjon`). Tillegg og utlegg hører til kortet (spec
 * tillegg-utlegg-prosjektkort § 3): samlesiden viser antallet i kortlinja,
 * føring skjer på kortskjermen.
 */

type TimerModal = {
  radId: string | null;
  kort: ProsjektKortValg;
  fokusBeskrivelse: boolean;
};

type Flytt =
  | { radType: "timer"; rad: TimerRad; fra: ProsjektKortValg }
  | { radType: "maskin"; rad: MaskinRad; fra: ProsjektKortValg }
  | { radType: "vare"; vare: VisVarelinje; fra: ProsjektKortValg };

type KortBlokk = { valg: ProsjektKortValg; linjer: ProsjektLinjer<VisVarelinje> };

/** Effektiv byggeplass i kortlåsen — modalen viser kortets byggeplass. */
const laasFor = (k: ProsjektKortValg): KortLaas => ({ byggeplassId: k.byggeplassId, ecoId: k.ecoId });

type Splitt =
  | { radType: "timer"; original: TimerRad }
  | { radType: "maskin"; original: MaskinRad };

export function ProsjektkortDagsoversikt({
  sheetId,
  sedel,
  sedelKontekst,
  kort: alleKort,
  timerRader,
  maskinRader,
  varer,
  reiseLonnsartId,
  harEquipmentCache,
  varelagerProsjekter,
  normTimer,
  normtakTimer,
  ramme,
  rammeByggeplassNavn,
  prosjektNavn,
  byggeplassNavn,
  ecoNavn,
  dagSeksjon,
  tilleggRader,
  utleggRader,
  redigerbar,
  enkeltProsjekt = false,
  onAapneKort,
  onNyttKort,
  onEndreRamme,
  onEndreByggeplass,
  onSend,
  onPauseToggle,
  onEndret,
  onVarerLagret,
}: {
  sheetId: string;
  sedel: Sedel;
  sedelKontekst: SedelKortKontekst;
  /** Kortene i visningsrekkefølge (`kortNokler`). */
  kort: KortValg[];
  /** Alle dagens rader (overlapp og matpause gjelder hele dagen). */
  timerRader: TimerRad[];
  maskinRader: MaskinRad[];
  varer: VisVarelinje[];
  reiseLonnsartId: string | null;
  harEquipmentCache: boolean;
  varelagerProsjekter: string[];
  normTimer: number | null;
  /** U12: datoens eksakte norm (ukjent → null → intet tak). Bare B10 leser den. */
  normtakTimer: number | null;
  ramme: { fra: string; til: string; pauseMin: number };
  rammeByggeplassNavn: string | null;
  prosjektNavn: (projectId: string) => string;
  byggeplassNavn: (byggeplassId: string) => string | null;
  ecoNavn: (ecoId: string) => string;
  /**
   * Spec tillegg-utlegg-prosjektkort § 3.1: dagens tillegg/utlegg — telles pr.
   * kort i kortlinja («Tillegg n · Utlegg n»). Kortskjermen sender dem ikke.
   */
  tilleggRader?: readonly KortRad[];
  utleggRader?: readonly KortRad[];
  /** Dagens reise — under kortene, over sum og Send. */
  dagSeksjon?: ReactNode;
  redigerbar: boolean;
  /** Kortskjermen: ett kort, uten sum-kort, Send og «+ Nytt prosjektkort». */
  enkeltProsjekt?: boolean;
  onAapneKort?: (kort: KortValg) => void;
  onNyttKort?: () => void;
  onEndreRamme?: () => void;
  onEndreByggeplass?: () => void;
  onSend?: () => void;
  /** 36b: kortskjermens matpause-flytt (dag-nivå); avhukingen vises i rad-modalen. */
  onPauseToggle?: (radId: string, vilHa: boolean) => void;
  onEndret: () => void;
  onVarerLagret: () => void;
}) {
  const { t } = useTranslation();
  const { bruker } = useAuth();
  const k: RadKontekst = { sheetId, organizationId: sedel.organizationId };
  // Spec § 11.2: fraværskortet (prosjekt `null`) har egen visning; resten er prosjektkort.
  const kort = useMemo(() => alleKort.filter(erProsjektKort), [alleKort]);

  const [timerModal, setTimerModal] = useState<TimerModal | null>(null);
  // ORDRE (33) c2: fraværskortet (spec § 11.5). `nyLinje` = åpnet fra «+ Fravær».
  const [fravaerKort, setFravaerKort] = useState<{ nyLinje: boolean } | null>(null);
  const [maskinModal, setMaskinModal] = useState<MaskinRad | null>(null);
  const [splitt, setSplitt] = useState<Splitt | null>(null);
  const [vareKort, setVareKort] = useState<ProsjektKortValg | null>(null);
  // Radform: ny vare ført fra en rad kobles til raden (`sheetTimerId`).
  const [vareRadId, setVareRadId] = useState<string | null>(null);
  const [vareValgt, setVareValgt] = useState<{ vare: VisVarelinje; kort: ProsjektKortValg } | null>(null);
  const [flytt, setFlytt] = useState<Flytt | null>(null);
  const [flyttFeil, setFlyttFeil] = useState<string | null>(null);
  const oppdaterVare = trpc.vareforbruk.oppdater.useMutation();
  // Punkt 7: «Endre mengde» (tekst i feltet; null = lukket) og «Slett» i vare-arket.
  const slettVare = trpc.vareforbruk.slett.useMutation();
  const [vareMengde, setVareMengde] = useState<string | null>(null);
  const [vareSlett, setVareSlett] = useState(false);
  const [vareFeil, setVareFeil] = useState<string | null>(null);
  const [vareLagrer, setVareLagrer] = useState(false);
  const { pushSedel } = useTimerSync();
  const { erPaaNettet } = useNettverk();

  // 36b: matpausen er dag-nivå — samme regel som dagskortets rad-kort.
  const { standardPauseMin } = useMemo(
    () => matpauseKontekst(sedel.organizationId, sedel.dato, timerRader),
    [sedel.organizationId, sedel.dato, timerRader],
  );
  const pauseRegelTrigget = useMemo(
    () => matpauseRegelTrigget(timerRader, standardPauseMin),
    [timerRader, standardPauseMin],
  );
  const matpauseFor = (rad: TimerRad) =>
    onPauseToggle && redigerbar && pauseRegelTrigget && radKanBaerePause(rad, standardPauseMin)
      ? {
          avhuket: rad.pauseMin > 0,
          trukketMin: pauseTrukketMinForRad(rad),
          // Lukker modalen: flyttet skrives med en gang, og en åpen modal ville
          // lagret radens gamle pause-bærer tilbake.
          onToggle: () => {
            setTimerModal(null);
            onPauseToggle(rad.id, !(rad.pauseMin > 0));
          },
        }
      : undefined;

  const oversiktTimer = useMemo<OversiktTimerRad[]>(
    () =>
      // Fraværskortets rader (spec § 11.2) er ikke prosjektrader — egen seksjon.
      timerRader.filter((r) => !r.utenProsjekt).map((r) => ({
        id: r.id,
        projectId: radProsjektId(r, sedel) ?? "",
        // Lagret verdi: null = arver dagens byggeplass (kortnøkkelen avgjør).
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
        timer: r.timer,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        beskrivelse: r.beskrivelse,
        erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
        overtidsnivaa: finnLonnsartLokalt(r.lonnsartId)?.overtidsnivaa ?? null,
        // Lokale rader bærer ikke attesteringsstatus.
        attestertStatus: null,
      })),
    [timerRader, sedel.projectId, reiseLonnsartId],
  );
  const oversiktMaskin = useMemo<OversiktMaskinRad[]>(
    () =>
      maskinRader.map((r) => ({
        id: r.id,
        projectId: r.projectId ?? sedel.projectId,
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
        vehicleId: r.vehicleId,
        timer: r.timer,
        attestertStatus: null,
      })),
    [maskinRader, sedel.projectId],
  );
  // Kortene grupperes pr. prosjekt (kortNokler sorterer prosjektene samlet).
  // Reise hører til dagen og telles bare i sum-kortet.
  const grupper = useMemo(() => {
    const arbeidTimer = oversiktTimer.filter((r) => !r.erReise);
    const ut: { projectId: string; blokker: KortBlokk[] }[] = [];
    for (const valg of kort) {
      const linjer = linjerForProsjekt({
        projectId: valg.projectId,
        timer: arbeidTimer,
        maskin: oversiktMaskin,
        varer,
        utlegg: 0,
        harEquipmentCache,
        harVarelager: varelagerProsjekter.includes(valg.projectId),
        kort: { valg, sedel: sedelKontekst },
      });
      const siste = ut[ut.length - 1];
      if (siste?.projectId === valg.projectId) siste.blokker.push({ valg, linjer });
      else ut.push({ projectId: valg.projectId, blokker: [{ valg, linjer }] });
    }
    return ut;
  }, [kort, oversiktTimer, oversiktMaskin, varer, harEquipmentCache, varelagerProsjekter, sedelKontekst]);
  const reiseSum = oversiktTimer.filter((r) => r.erReise).reduce((a, r) => a + r.timer, 0);
  const sum = {
    ...dagsoversiktSum(grupper.flatMap((g) => g.blokker.map((b) => b.linjer))),
    reise: reiseSum,
  };
  const status = statusOrd(sedel.status);

  // Radform (Kenneth 2026-11-12): kortet hver linje hører til (kortlås i
  // modalene) — samme filtrering som før via linjerForProsjekt.
  const kortFor = useMemo(() => {
    const timer = new Map<string, ProsjektKortValg>();
    const maskin = new Map<string, ProsjektKortValg>();
    const vare = new Map<string, ProsjektKortValg>();
    for (const g of grupper) {
      for (const b of g.blokker) {
        for (const r of [...b.linjer.arbeid, ...b.linjer.overtid]) timer.set(r.id, b.valg);
        for (const m of b.linjer.maskin) maskin.set(m.id, b.valg);
        for (const v of b.linjer.varer) vare.set(v.id, b.valg);
      }
    }
    return { timer, maskin, vare };
  }, [grupper]);
  // Én boks pr. rad i tidsrekkefølge; maskin/varer under sin rad, resten
  // under «Uten rad». Ingen sammenslåing (dagsoversiktRader.ts).
  const dag = useMemo(
    () =>
      raderForDag({
        timer: oversiktTimer.filter((r) => kortFor.timer.has(r.id)),
        maskin: maskinRader
          .filter((m) => kortFor.maskin.has(m.id))
          .map((m) => ({ ...m, projectId: m.projectId ?? sedel.projectId })),
        varer: varer.filter((v) => kortFor.vare.has(v.id)),
      }),
    [oversiktTimer, maskinRader, varer, kortFor, sedel.projectId],
  );
  // ORDRE (27b): radene samles i prosjektkortet sitt (linjer i tidsrekkefølge).
  // «Uten rad» (gamle, ukoblede linjer) står i kortet linja selv hører til.
  const kortGrupper = useMemo(() => {
    const nokkel = (m: Map<string, ProsjektKortValg>) => (id: string) => {
      const v = m.get(id);
      return v ? kortNokkel(v) : undefined;
    };
    return grupperPaaKort(dag, {
      timer: nokkel(kortFor.timer),
      maskin: nokkel(kortFor.maskin),
      vare: nokkel(kortFor.vare),
    });
  }, [dag, kortFor]);
  const kortEtterNokkel = useMemo(() => new Map(kort.map((v) => [kortNokkel(v), v])), [kort]);
  const kortUtenRader = kort.filter((valg) => !kortGrupper.some((g) => g.nokkel === kortNokkel(valg)));
  const blokkFor = (valg: ProsjektKortValg) =>
    grupper.flatMap((g) => g.blokker).find((b) => kortNokkel(b.valg) === kortNokkel(valg));
  const overtidSum = dag.rader.reduce((a, b) => a + (b.rad.overtidsnivaa != null ? b.rad.timer : 0), 0);
  const maskinOverTak = grupper.flatMap((g) =>
    g.blokker.filter(
      (b) =>
        b.linjer.summer.maskin > 0 &&
        overstigerMaskinTak(b.linjer.summer.maskin, b.linjer.summer.arbeid, sedel.pauseMin),
    ),
  );
  // Beslutning 3: Send sperres når en arbeidsrad mangler beskrivelse.
  const manglerBeskrivelse = redigerbar ? forsteRadUtenBeskrivelse(dag.rader.map((b) => b.rad)) : null;
  // ORDRE (33) c2 (U11/F4, TF9): fraværskortet teller i beskrivelses-sperren — ett felt pr. kort.
  const fravaerRader = timerRader.filter((r) => r.utenProsjekt);
  const fravaerManglerBeskrivelse =
    redigerbar && fravaerRader.some((r) => !(r.beskrivelse ?? "").trim());
  // B10 (ORDRE (33) c3, § 11.10.4): fravær med tak over resten av dagsnormen — det eneste
  // varselet om fravær og arbeid samme dag (N10). Ett trykk retter siste linje med tak;
  // med F9 = A sperres Send til bruddet er rettet. Hele dagens rader teller (N5).
  const normtakBrudd = useMemo(
    () =>
      bruddForDag({
        dagsnorm: normtakTimer,
        rader: timerRader.map((r) => ({
          id: r.id,
          lonnsartId: r.lonnsartId,
          timer: r.timer,
          erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
        })),
        finnArt: finnNormtakArtLokalt,
      }),
    [normtakTimer, timerRader, reiseLonnsartId],
  );

  const timerRad = (id: string | null) => (id ? timerRader.find((r) => r.id === id) ?? null : null);
  const maskinNavn = (vehicleId: string) => {
    const e = finnEquipmentLokalt(vehicleId);
    if (!e) return vehicleId;
    return `${e.merke ?? ""} ${e.modell ?? ""}`.trim() || e.internNavn || vehicleId;
  };
  const t2 = (n: number) => `${formatKortTall(n)} ${t("timer.tEnhet")}`;

  const aapneTimer = (kortValg: ProsjektKortValg, radId: string | null, fokusBeskrivelse = false) => {
    if (!redigerbar) return;
    setTimerModal({ radId, kort: kortValg, fokusBeskrivelse });
  };
  // Maskinrader bærer aldri `uten_prosjekt` (K8) → alltid et prosjektkort.
  const kortForRad = (r: {
    projectId: string | null;
    byggeplassId?: string | null;
    externalCostObjectId?: string | null;
  }): ProsjektKortValg => {
    const valg = kortValgFor(
      {
        projectId: r.projectId,
        byggeplassId: r.byggeplassId ?? null,
        externalCostObjectId: r.externalCostObjectId ?? null,
      },
      sedelKontekst,
    );
    return { ...valg, projectId: valg.projectId ?? "" };
  };
  /**
   * Koblet = vises under en rad (samme regel som `raderForDag`: raden finnes og
   * prosjektet stemmer). Ellers «Uten rad» med egen flytt som før.
   */
  const erKoblet = (x: { sheetTimerId?: string | null; projectId: string | null }) =>
    x.sheetTimerId != null &&
    timerRader.some(
      (r) => r.id === x.sheetTimerId && radProsjektId(r, sedel) === (x.projectId ?? sedel.projectId),
    );
  const startFlytt = (f: Flytt) => {
    setFlyttFeil(null);
    setFlytt(f);
  };

  const db = () => hentDatabase()!;
  // Ett trykk retter fraværslinja (N5/N6): ned til `rettTil`, eller slett ved 0.
  // Fra–til som ikke lenger stemmer med timene, tas bort (FM23: fravær uten klokkeslett).
  const rettNormtakBrudd = () => {
    if (!normtakBrudd || !redigerbar) return;
    const r = timerRad(normtakBrudd.radId);
    if (!r) return;
    if (normtakBrudd.rettTil <= 0) {
      fjernTimerRad(db(), k, r.id);
    } else {
      const res = oppdaterTimerRad(db(), k, r.id, {
        projectId: radProsjektId(r, sedel),
        byggeplassId: r.byggeplassId ?? null,
        lonnsartId: r.lonnsartId,
        aktivitetId: r.aktivitetId,
        timer: normtakBrudd.rettTil,
        externalCostObjectId: r.externalCostObjectId ?? null,
        fraTid: null,
        tilTid: null,
        beskrivelse: r.beskrivelse,
        pauseMin: r.pauseMin,
      });
      if (!res.ok) return;
    }
    onEndret();
  };
  const redigert = timerRad(timerModal?.radId ?? null);

  // RETUR 36c-2 P1 (a2): «Uten byggeplass» på en sedel med byggeplass —
  // løft arven ut før lagring, så NULL på raden betyr ekte «uten».
  const loftArvVedBehov = (kort: ProsjektKortValg) => {
    if (trengerByggeplassLoft(kort, sedelKontekst)) loftByggeplassArv(db(), sheetId, sedelKontekst);
  };

  const utforFlytt = async (til: ProsjektKortValg) => {
    if (!flytt) return;
    loftArvVedBehov(til);
    const maal: FlyttMaal = {
      projectId: til.projectId,
      byggeplassId: lagretByggeplassForKort(til, sedelKontekst),
      ecoId: til.ecoId,
    };
    if (flytt.radType === "timer") {
      // TILLEGG 2026-11-12 regel 1: raden tar med koblede maskiner OG varer,
      // timer og mengde uendret. Samme sti som «Endre kort» (server-varer først
      // etter push), så en synket vare aldri flyttes bare lokalt.
      const u = await flyttKort(
        db(),
        {
          sheetId,
          organizationId: sedel.organizationId,
          status: sedel.status,
          pauseMin: sedel.pauseMin,
          sedel: sedelKontekst,
          timerRader,
          maskinRader,
          reiseLonnsartId,
        },
        radInnhold({ rad: flytt.rad, maskinRader, varer }),
        flytt.fra,
        til,
        {
          erPaaNettet,
          pushSedel: () => pushSedel(sheetId),
          flyttVare: async (id, vm) => {
            await oppdaterVare.mutateAsync({
              id,
              projectId: vm.projectId,
              byggeplassId: vm.byggeplassId,
              externalCostObjectId: vm.ecoId,
            });
          },
        },
      );
      const feil = kortUtfallTekst(u, "flytt");
      if (u.utfall !== "ok" && u.utfall !== "uendret") onEndret();
      if (feil) {
        setFlyttFeil(t(feil, { defaultValue: feil }));
        if (u.utfall === "delvis") onVarerLagret();
        return;
      }
      setFlytt(null);
      onEndret();
      onVarerLagret();
      return;
    } else if (flytt.radType === "maskin") {
      // Samme bøtte-regel (prosjekt, underprosjekt) som ved ny rad og på server.
      // Ordre (6): maskin måles mot arbeid UTEN reise.
      const brudd = beregnMaskinBrudd(
        timerRader
          .filter((r) => !erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId))
          .map((r) => ({
          projectId: radProsjektId(r, sedel),
          externalCostObjectId: r.externalCostObjectId ?? null,
          timer: r.timer,
        })),
        maskinRader.map((m) =>
          m.id === flytt.rad.id
            ? { projectId: til.projectId, externalCostObjectId: til.ecoId, timer: m.timer }
            : {
                projectId: m.projectId ?? sedel.projectId,
                externalCostObjectId: m.externalCostObjectId ?? null,
                timer: m.timer,
              },
        ),
        sedel.pauseMin,
      );
      if (brudd.some((b) => b.projectId === til.projectId && (b.externalCostObjectId ?? null) === til.ecoId)) {
        setFlyttFeil(t("timer.maskin.overstigerArbeid"));
        return;
      }
      flyttMaskinRad(db(), flytt.rad.id, maal);
    } else {
      const v = flytt.vare;
      // Varer har ingen sedel-arv: kortets effektive byggeplass lagres (RETUR 4).
      const vareMaal: FlyttMaal = { ...maal, byggeplassId: vareByggeplassForKort(til) };
      // Linjen finnes på server: flytt der først (vaktene sjekker prosjekt og firma).
      if (v.syncStatus !== "pending" && v.syncStatus !== "avvist") {
        try {
          await oppdaterVare.mutateAsync({
            id: v.id,
            projectId: til.projectId,
            byggeplassId: vareMaal.byggeplassId,
            externalCostObjectId: til.ecoId,
          });
        } catch (e) {
          const melding = e instanceof Error ? e.message : String(e);
          setFlyttFeil(t(melding, { defaultValue: melding }));
          return;
        }
      }
      flyttVareLokalt(db(), v.id, vareMaal);
      setFlytt(null);
      onVarerLagret();
      return;
    }
    setFlytt(null);
    onEndret();
  };

  // Punkt 7: samme kall som kortsiden (`vareforbruk.oppdater`/`slett`) via
  // kortRadFlytt; ventende linje skrives bare lokalt.
  const lukkVare = () => {
    setVareValgt(null);
    setVareMengde(null);
    setVareSlett(false);
    setVareFeil(null);
  };
  const vareUtfall = (u: KortUtfall) => {
    if (u.utfall === "ok") {
      lukkVare();
      onVarerLagret();
      return;
    }
    if (u.utfall === "uendret") {
      setVareFeil(t("timer.feil.ugyldigAntall"));
      return;
    }
    const tekst =
      u.utfall === "offline" ? "timer.dagsoversikt.offlineVare" : kortUtfallTekst(u, "slett");
    setVareMengde(null);
    setVareSlett(false);
    setVareFeil(tekst ? t(tekst, { defaultValue: tekst }) : null);
  };
  const lagreVareMengde = async () => {
    if (!vareValgt || vareMengde === null || vareLagrer) return;
    setVareLagrer(true);
    try {
      vareUtfall(
        await endreVareMengde(db(), vareValgt.vare, Number(vareMengde.replace(",", ".")), {
          erPaaNettet,
          oppdaterVare: (input) => oppdaterVare.mutateAsync(input),
        }),
      );
    } finally {
      setVareLagrer(false);
    }
  };
  const bekreftSlettVare = async () => {
    if (!vareValgt || vareLagrer) return;
    setVareLagrer(true);
    try {
      vareUtfall(
        await slettVarelinje(db(), vareValgt.vare, {
          erPaaNettet,
          slettVare: async (id) => {
            await slettVare.mutateAsync({ id });
          },
        }),
      );
    } finally {
      setVareLagrer(false);
    }
  };

  const antallPaaKort = (rader: readonly KortRad[] | undefined, valg: ProsjektKortValg) =>
    (rader ?? []).filter((r) => kortNokkelFor(r, sedelKontekst) === kortNokkel(valg)).length;
  const kortHode = (valg: ProsjektKortValg) => {
    const tillegg = antallPaaKort(tilleggRader, valg);
    const utlegg = antallPaaKort(utleggRader, valg);
    return [
      valg.byggeplassId
        ? byggeplassNavn(valg.byggeplassId) ?? t("timer.byggeplass.ingenValgt")
        : t("timer.kortValg.utenByggeplass"),
      valg.ecoId ? ecoNavn(valg.ecoId) : null,
      tillegg > 0 ? `${t("timer.prosjektkort.kolonne.tillegg")} ${tillegg}` : null,
      utlegg > 0 ? `${t("timer.prosjektkort.kolonne.utlegg")} ${utlegg}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const kanForeVare = (projectId: string) =>
    visVareforbrukKnapp({ prosjektIderMedVarelager: varelagerProsjekter, projectId, erRedigerbar: redigerbar });
  const tidTekst = (r: { fraTid: string | null; tilTid: string | null }) =>
    r.fraTid && r.tilTid ? `${r.fraTid}–${r.tilTid}` : t("timer.dagsoversikt.utenTid");

  const maskinLinje = (m: MaskinRad) => (
    <Verdi
      key={m.id}
      onPress={() => {
        if (!redigerbar) return;
        setMaskinModal(m);
      }}
    >
      {maskinNavn(m.vehicleId)} · {t2(m.timer)}
    </Verdi>
  );
  const vareLinje = (v: VisVarelinje) => {
    const valg = kortFor.vare.get(v.id);
    return (
      <View key={v.id}>
        <Verdi
          onPress={() => {
            if (!valg || !kanForeVare(v.projectId)) return;
            setVareFeil(null);
            setVareValgt({ vare: v, kort: valg });
          }}
        >
          {v.vare.navn} {formatKortTall(v.antall).replace(/,0$/, "")} {v.vare.enhet}
          {v.syncStatus === "pending" ? ` · ${t("timer.sync.venter")}` : ""}
        </Verdi>
        {/* Som VareforbrukLesListe: avvist linje viser serverens grunn. */}
        {v.syncStatus === "avvist" && v.feilmelding && (
          <Text className="text-sm text-amber-700">{t(v.feilmelding, { defaultValue: v.feilmelding })}</Text>
        )}
      </View>
    );
  };

  // ORDRE (27b): én linje pr. rad i kortet — «07:00–15:00 · 7,5 t · Timelønn».
  // Overtid er en linje som de andre; trykk åpner rad-vinduet for raden.
  // Kalles som funksjon (ikke komponent) så linjene ikke remountes ved hver render.
  // RETUR (27b), Kenneth 2026-11-16: maskin og varer registreres som før — under
  // linja de ble ført fra, med «+ Vare» koblet til linja (`setVareRadId(rad.id)`).
  function kortLinje({ rad, maskin, varer: radVarer }: (typeof dag.rader)[number], valg: ProsjektKortValg) {
    const lonnsart =
      rad.overtidsnivaa != null
        ? t("timer.dagsoversikt.overtid", { prosent: rad.overtidsnivaa })
        : finnLonnsartLokalt(timerRad(rad.id)?.lonnsartId ?? "")?.navn ?? null;
    const iBrudd = normtakBrudd?.radId === rad.id;
    return (
      <View key={rad.id}>
        <Pressable
          onPress={() => aapneTimer(valg, rad.id)}
          accessibilityRole="button"
          className="min-h-[44px] flex-row items-center gap-2 active:bg-gray-50"
        >
          <Clock size={16} color="#6b7280" />
          <Text
            className={`flex-1 text-sm ${iBrudd ? "text-amber-700" : "text-gray-900"}`}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {[tidTekst(rad), t2(rad.timer), lonnsart].filter(Boolean).join(" · ")}
          </Text>
        </Pressable>
        {maskin.map((m) => maskinLinje(maskinRader.find((x) => x.id === m.id)!))}
        {radVarer.map(vareLinje)}
        {kanForeVare(rad.projectId) && (
          <Pressable
            onPress={() => {
              setVareRadId(rad.id);
              setVareKort(valg);
            }}
            className="min-h-[44px] justify-center active:bg-gray-50"
          >
            <Text className="text-sm font-medium text-gray-700">{t("timer.dagsoversikt.leggTilVare")}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ORDRE (27b), timer.md § «Prosjektkort og dagskort — definisjon»: ett kort pr.
  // (prosjekt, byggeplass, underprosjekt) med linjene i tidsrekkefølge, én
  // beskrivelse og ett sett maskin/varer. Overtid deler aldri kortet.
  function prosjektkort(valg: ProsjektKortValg, gruppe: (typeof kortGrupper)[number] | undefined) {
    const rader = gruppe?.rader ?? [];
    const utenRad = gruppe?.utenRad ?? { maskin: [], varer: [] };
    const sumTimer = rader.reduce((a, b) => a + b.rad.timer, 0);
    const utenTekst = rader.find((b) => !(b.rad.beskrivelse ?? "").trim())?.rad ?? null;
    // Én beskrivelse pr. kort (ORDRE 24); gamle rader med ulik tekst vises alle, aldri skjult.
    const beskrivelser = [...new Set(rader.map((b) => (b.rad.beskrivelse ?? "").trim()).filter(Boolean))];
    const forsteRad = rader[0]?.rad ?? null;
    return (
      <View
        key={kortNokkel(valg)}
        className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
        style={utenTekst && redigerbar ? { borderLeftWidth: 3, borderLeftColor: "#f59e0b" } : undefined}
      >
        {/* Som før (05c5488e `radBoks`): eneste prosjekt → navnet åpner raden (her kortets
            første linje); ellers åpner det kortet. Kort uten linjer: ingen handling, som før. */}
        <Pressable
          onPress={() =>
            enkeltProsjekt ? forsteRad && aapneTimer(valg, forsteRad.id) : onAapneKort?.(valg)
          }
          className="min-h-[44px] justify-center active:bg-gray-50"
        >
          <View className="flex-row items-baseline justify-between">
            <Text className="flex-1 text-base font-semibold text-gray-900">{prosjektNavn(valg.projectId)}</Text>
            {rader.length > 0 ? (
              <Text className="text-base font-semibold text-gray-900" style={{ fontVariant: ["tabular-nums"] }}>
                {t2(sumTimer)}
              </Text>
            ) : null}
          </View>
          <Text className="text-sm text-gray-500">{kortHode(valg)}</Text>
        </Pressable>
        {rader.map((b) => kortLinje(b, valg))}
        {utenTekst ? (
          <Pressable onPress={() => aapneTimer(valg, utenTekst.id, true)} className="min-h-[44px] justify-center">
            <Text className="text-sm text-amber-700">{t("timer.dagsoversikt.manglerBeskrivelse")}</Text>
          </Pressable>
        ) : null}
        {beskrivelser.map((tekst) => (
          <Text key={tekst} className="py-2 text-sm text-gray-900">
            {tekst}
          </Text>
        ))}
        {/* Beslutning B: ukoblede (gamle) maskin- og varelinjer vises alltid, i kortet de hører til. */}
        {(utenRad.maskin.length > 0 || utenRad.varer.length > 0) && (
          <View>
            <Text className="py-2 text-sm font-semibold text-gray-700">{t("timer.dagsoversikt.utenRad")}</Text>
            {utenRad.maskin.map((m) => maskinLinje(maskinRader.find((x) => x.id === m.id)!))}
            {utenRad.varer.map(vareLinje)}
          </View>
        )}
        {forsteRad ? null : (
          // Kort uten arbeidsrad (nytt kort, eller bare maskin/varer/tillegg/utlegg):
          // «+ Legg til arbeid», så kortet ikke forsvinner.
          <>
            <Tom
              onPress={() => aapneTimer(valg, null)}
              leggTil={redigerbar ? t("timer.prosjektkort.leggTilArbeid") : undefined}
            />
            {/* Som før: tom maskin åpner ny timer-rad med maskinseksjonen (P1). */}
            {blokkFor(valg)?.linjer.visMaskin && (
              <Tom
                onPress={() => aapneTimer(valg, null)}
                leggTil={redigerbar ? t("timer.prosjektkort.leggTilMaskin") : undefined}
              />
            )}
            {kanForeVare(valg.projectId) && (
              <Tom
                onPress={() => {
                  setVareRadId(null);
                  setVareKort(valg);
                }}
                leggTil={redigerbar ? t("timer.dagsoversikt.leggTilVare") : undefined}
              />
            )}
          </>
        )}
      </View>
    );
  }

  // TILLEGG (33) pkt 3: «Sum i dag» og Send-knappen leser samme tall (`dagSumTimer`).
  const dagSum = dagSumTimer({ arbeid: sum.arbeid, fravaer: fravaerRader.reduce((a, r) => a + r.timer, 0) });
  const sendTekst = sendKnappTekst(sedel.status, dagSum, sum.reise);

  return (
    <ProsjektkortKontekst.Provider value={true}>
      {dag.rader.length === 0 && kort.length === 0 && !enkeltProsjekt && (
        <Text className="mx-4 mt-4 text-sm text-gray-500">{t("timer.prosjektkort.ingenKort")}</Text>
      )}
      {kortGrupper.map((g) => {
        const valg = kortEtterNokkel.get(g.nokkel);
        return valg ? prosjektkort(valg, g) : null;
      })}
      {kortUtenRader.map((valg) => prosjektkort(valg, undefined))}

      {/* ORDRE (33) c2 — fraværskortet (U5/U10): art og timer pr. linje, én beskrivelse. */}
      {!enkeltProsjekt && fravaerRader.length > 0 && (
        <Pressable
          onPress={() => (redigerbar ? setFravaerKort({ nyLinje: false }) : undefined)}
          className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3 active:bg-gray-50"
        >
          <Text className="text-base font-semibold text-gray-900">{t("timer.fravaerKort.tittel")}</Text>
          {fravaerRader.map((r) => (
            <Text
              key={r.id}
              className={`py-1 text-sm ${normtakBrudd?.radId === r.id ? "text-amber-700" : "text-gray-700"}`}
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {t("timer.fravaerKort.linje", {
                timer: formatKortTall(r.timer),
                art: finnLonnsartLokalt(r.lonnsartId)?.navn ?? "",
              })}
            </Text>
          ))}
          {fravaerManglerBeskrivelse ? (
            <Text className="py-1 text-sm text-amber-700">{t("timer.dagsoversikt.manglerBeskrivelse")}</Text>
          ) : (
            <Text className="py-1 text-sm text-gray-900">{fravaerRader.find((r) => r.beskrivelse)?.beskrivelse}</Text>
          )}
        </Pressable>
      )}

      {redigerbar && enkeltProsjekt && kort[0] && (
        <Pressable
          onPress={() => aapneTimer(kort[0]!, null)}
          className="mx-4 mt-2 min-h-[44px] justify-center active:bg-gray-50"
        >
          <Text className="text-sm text-gray-700">{t("timer.prosjektkort.nyTimer")}</Text>
        </Pressable>
      )}

      {!enkeltProsjekt && (
        <>
          {redigerbar && (
            <Pressable onPress={onNyttKort} className="mx-4 mt-2 min-h-[44px] justify-center active:bg-gray-50">
              <Text className="text-base font-medium text-sitedoc-primary">{t("timer.prosjektkort.nyttKort")}</Text>
            </Pressable>
          )}
          {/* U1 inngang 1: «+ Fravær» rett under «+ Nytt prosjektkort». */}
          {redigerbar && (
            <Pressable
              onPress={() => setFravaerKort({ nyLinje: true })}
              className="mx-4 min-h-[44px] justify-center active:bg-gray-50"
            >
              <Text className="text-base font-medium text-sitedoc-primary">{t("timer.fravaerKort.leggTil")}</Text>
            </Pressable>
          )}

          {dagSeksjon}

          <View className="mx-4 mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-sm text-gray-500">{t("timer.dagsoversikt.sumIDag")}</Text>
              <Text className="text-base font-semibold text-gray-900" style={{ fontVariant: ["tabular-nums"] }}>
                {t2(dagSum)}
              </Text>
            </View>
            {overtidSum > 0 || (sum.maskin != null && sum.maskin > 0) || sum.reise > 0 ? (
              <Text className="text-sm text-gray-500" style={{ fontVariant: ["tabular-nums"] }}>
                {[
                  overtidSum > 0 ? t("timer.dagsoversikt.sumOvertid", { timer: formatKortTall(overtidSum) }) : null,
                  sum.maskin != null && sum.maskin > 0
                    ? t("timer.prosjektkort.sumMaskin", { timer: formatKortTall(sum.maskin) })
                    : null,
                  sum.reise > 0 ? t("timer.prosjektkort.sumReise", { timer: formatKortTall(sum.reise) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
            {maskinOverTak.map((b) => (
              <Text key={kortNokkel(b.valg)} className="text-sm text-amber-700">
                {prosjektNavn(b.valg.projectId)} ·{" "}
                {t("timer.gruppe.maskin", { maskin: formatKortTall(b.linjer.summer.maskin) })} ·{" "}
                {t("timer.rediger.maskinOverstiger")}
              </Text>
            ))}
            <Pressable
              onPress={() => redigerbar && onEndreRamme?.()}
              className="min-h-[44px] justify-center active:bg-gray-50"
            >
              <Text className="text-sm text-gray-500" style={{ fontVariant: ["tabular-nums"] }}>
                {t("timer.dagsoversikt.normRamme", {
                  norm: normTimer != null ? formatKortTall(normTimer) : "–",
                  fra: ramme.fra,
                  til: ramme.til,
                  pause: ramme.pauseMin,
                })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => redigerbar && onEndreByggeplass?.()}
              className="min-h-[44px] justify-center active:bg-gray-50"
            >
              <Text className="text-sm text-gray-500">
                {rammeByggeplassNavn ?? t("timer.byggeplass.ingenValgt")}
              </Text>
            </Pressable>
            <Text className={`py-2 text-sm ${status.amber ? "text-amber-700" : "text-gray-500"}`}>
              {status.amber ? "● " : ""}
              {t(status.nokkel, {
                dato: sedel.attestertVed ? formatNorskDato(sedel.attestertVed) : "",
              })}
            </Text>
            {manglerBeskrivelse && (
              <Pressable
                onPress={() => aapneTimer(kortFor.timer.get(manglerBeskrivelse.id)!, manglerBeskrivelse.id, true)}
                className="min-h-[44px] justify-center active:bg-gray-50"
              >
                <Text className="text-sm text-amber-700">
                  {t("timer.dagsoversikt.sendSperret", { rad: tidTekst(manglerBeskrivelse) })}
                </Text>
              </Pressable>
            )}
            {!manglerBeskrivelse && fravaerManglerBeskrivelse && (
              <Pressable
                onPress={() => setFravaerKort({ nyLinje: false })}
                className="min-h-[44px] justify-center active:bg-gray-50"
              >
                <Text className="text-sm text-amber-700">{t("timer.fravaerKort.sendSperret")}</Text>
              </Pressable>
            )}
            {normtakBrudd && (
              <View className="py-1">
                <Text className="text-sm text-amber-700" style={{ fontVariant: ["tabular-nums"] }}>
                  {byggNormtakBruddLinje(t, normtakBrudd.data, formatKortTall)}
                </Text>
                {redigerbar && (
                  <Pressable
                    onPress={rettNormtakBrudd}
                    accessibilityRole="button"
                    className="min-h-[44px] justify-center active:bg-gray-50"
                  >
                    <Text className="text-sm font-semibold text-amber-700">
                      {normtakBrudd.rettTil > 0
                        ? t("timer.normtak.rettTil", { timer: formatKortTall(normtakBrudd.rettTil) })
                        : t("timer.normtak.slettFravaer")}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
            {redigerbar && (
              <Pressable
                onPress={() =>
                  manglerBeskrivelse
                    ? aapneTimer(kortFor.timer.get(manglerBeskrivelse.id)!, manglerBeskrivelse.id, true)
                    : fravaerManglerBeskrivelse
                      ? setFravaerKort({ nyLinje: false })
                      : normtakBrudd
                        ? undefined
                        : onSend?.()
                }
                disabled={normtakBrudd != null && !manglerBeskrivelse}
                className={`mt-2 min-h-[44px] items-center justify-center rounded-lg ${
                  normtakBrudd != null && !manglerBeskrivelse ? "bg-gray-400" : "bg-gray-900 active:bg-gray-700"
                }`}
              >
                <Text className="text-base font-semibold text-white">
                  {sendTekst.nokkel === "timer.detalj.sendPaaNytt"
                    ? t(sendTekst.nokkel)
                    : sendTekst.nokkel === "timer.prosjektkort.sendDagenMedReise"
                      ? t(sendTekst.nokkel, {
                          timer: formatKortTall(sendTekst.timer),
                          reise: formatKortTall(sendTekst.reise),
                        })
                      : t(sendTekst.nokkel, { timer: formatKortTall(sendTekst.timer) })}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {timerModal && (
        <ProsjektkortKontekst.Provider value={laasFor(timerModal.kort)}>
        <TimerRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={timerModal.kort.projectId}
          defaultEcoId={timerModal.kort.ecoId}
          dato={sedel.dato}
          sheetPauseMin={sedel.pauseMin}
          harEquipmentCache={harEquipmentCache}
          eksisterendeRader={timerRader.filter(
            (r) => radProsjektId(r, sedel) === timerModal.kort.projectId,
          )}
          alleTimerRader={timerRader}
          defaultAktivitetId={sedel.aktivitetId ?? null}
          eksisterendeRad={redigert}
          tvungetValg={null}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          fokusBeskrivelse={timerModal.fokusBeskrivelse}
          // V21 (Kenneth 2026-11-12): overtidsforslaget krever begge — samme
          // som dagskortets TimerSeksjon. Normal-delen lagres via onLagre,
          // overtid-delen som ny rad på samme kort (ingen koblet maskin).
          dagsnormTimer={normTimer}
          normtakDagsnorm={normtakTimer}
          onLeggTilOvertidDel={(
            projectId,
            _byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
          ) => {
            leggTilTimerRad(
              db(),
              k,
              {
                projectId,
                byggeplassId: lagretByggeplassForKort(timerModal.kort, sedelKontekst),
                lonnsartId,
                aktivitetId,
                timer,
                externalCostObjectId,
                fraTid,
                tilTid,
                beskrivelse,
                pauseMin,
              },
              [],
            );
            onEndret();
          }}
          handlinger={
            redigert
              ? {
                  onFlytt: () => {
                    setTimerModal(null);
                    startFlytt({ radType: "timer", rad: redigert, fra: timerModal.kort });
                  },
                  onDelOpp: () => {
                    setTimerModal(null);
                    setSplitt({ radType: "timer", original: redigert });
                  },
                  onSlett: () => {
                    fjernTimerRad(db(), k, redigert.id);
                    setTimerModal(null);
                    onEndret();
                  },
                  matpause: matpauseFor(redigert),
                }
              : undefined
          }
          onLagre={(
            projectId,
            _byggeplassId,
            lonnsartId,
            aktivitetId,
            timer,
            externalCostObjectId,
            fraTid,
            tilTid,
            beskrivelse,
            pauseMin,
            maskin,
          ) => {
            loftArvVedBehov(timerModal.kort);
            const felt = {
              projectId,
              // Kortlåsen gir effektiv byggeplass; lagres som null når den arves.
              byggeplassId: lagretByggeplassForKort(timerModal.kort, sedelKontekst),
              lonnsartId,
              aktivitetId,
              timer,
              externalCostObjectId,
              fraTid,
              tilTid,
              beskrivelse,
              pauseMin,
            };
            const radId = redigert
              ? (oppdaterTimerRad(db(), k, redigert.id, felt, maskin), redigert.id)
              : leggTilTimerRad(db(), k, felt, maskin.linjer);
            // Koblet maskin følger raden også på byggeplass (GO punkt 5).
            foelgKobletMaskin(db(), radId);
            // K5 (c1): én beskrivelse pr. kort — teksten skrives på kortets øvrige arbeidsrader.
            skrivKortBeskrivelse(db(), { sheetId: k.sheetId, radId, beskrivelse });
            setTimerModal(null);
            onEndret();
          }}
          onLukk={() => setTimerModal(null)}
        />
        </ProsjektkortKontekst.Provider>
      )}

      {maskinModal && (
        <ProsjektkortKontekst.Provider value={laasFor(kortForRad(maskinModal))}>
        <MaskinRadModal
          sheetId={sheetId}
          organizationId={sedel.organizationId}
          defaultProjectId={maskinModal.projectId ?? sedel.projectId}
          defaultEcoId={maskinModal.externalCostObjectId ?? null}
          dato={sedel.dato}
          pauseMin={sedel.pauseMin}
          eksisterendeRad={maskinModal}
          handlinger={{
            // TILLEGG 2026-11-12 regel 1: koblet maskin følger raden (flyttes med den).
            ...(erKoblet(maskinModal)
              ? { folgerRaden: true }
              : {
                  onFlytt: () => {
                    setMaskinModal(null);
                    startFlytt({ radType: "maskin", rad: maskinModal, fra: kortForRad(maskinModal) });
                  },
                }),
            onDelOpp: () => {
              setMaskinModal(null);
              setSplitt({ radType: "maskin", original: maskinModal });
            },
            onSlett: () => {
              fjernMaskinRad(db(), k, maskinModal.id);
              setMaskinModal(null);
              onEndret();
            },
          }}
          onLagre={(projectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid) => {
            oppdaterMaskinRad(db(), k, maskinModal.id, {
              projectId,
              ecoId,
              vehicleId,
              timer,
              mengde,
              enhet,
              fraTid,
              tilTid,
            });
            setMaskinModal(null);
            onEndret();
          }}
          onLukk={() => setMaskinModal(null)}
        />
        </ProsjektkortKontekst.Provider>
      )}

      {splitt && (
        <SplittRadModal
          {...splitt}
          organizationId={sedel.organizationId}
          onLagret={() => {
            setSplitt(null);
            onEndret();
          }}
          onLukk={() => setSplitt(null)}
        />
      )}

      {bruker?.id && vareKort && (
        <KortVareforbrukModal
          synlig
          userId={bruker.id}
          organizationId={sedel.organizationId}
          sheetId={sheetId}
          projectId={vareKort.projectId}
          prosjektNavn={prosjektNavn(vareKort.projectId)}
          dato={sedel.dato}
          sedelByggeplassId={sedel.byggeplassId ?? null}
          kortLaas={{ byggeplassId: vareByggeplassForKort(vareKort), ecoId: vareKort.ecoId }}
          sheetTimerId={vareRadId}
          onAvbryt={() => {
            setVareKort(null);
            setVareRadId(null);
          }}
          onLagret={() => {
            setVareKort(null);
            setVareRadId(null);
            onVarerLagret();
          }}
        />
      )}

      {/* Varelinje: ny vare (som før), «Flytt raden» (§ 5b), og (punkt 7) «Endre mengde» / «Slett». */}
      {vareValgt && (
        <Modal
          visible={vareMengde === null && !vareSlett}
          transparent
          animationType="fade"
          onRequestClose={lukkVare}
        >
          <Pressable className="flex-1 justify-end bg-black/40" onPress={lukkVare}>
            <Pressable className="rounded-t-2xl bg-white px-4 pb-8 pt-4" onPress={() => {}}>
              <Text className="mb-2 text-base font-semibold text-gray-900">
                {vareValgt.vare.vare.navn} {formatKortTall(vareValgt.vare.antall).replace(/,0$/, "")}{" "}
                {vareValgt.vare.vare.enhet}
              </Text>
              {vareFeil && <Text className="mb-2 text-sm text-amber-700">{vareFeil}</Text>}
              {/* Låst linje (attestert, avvist, dagen ikke redigerbar) får ingen knapper. */}
              {kanEndreVare(vareValgt.vare, redigerbar) && (
                <>
                  <Pressable
                    onPress={() => {
                      setVareFeil(null);
                      setVareMengde(formatKortTall(vareValgt.vare.antall).replace(/,0$/, ""));
                    }}
                    className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
                  >
                    <Text className="text-base text-gray-700">{t("timer.dagsoversikt.endreMengde")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setVareFeil(null);
                      setVareSlett(true);
                    }}
                    className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
                  >
                    <Text className="text-base text-gray-900">{t("timer.dagsoversikt.slettVare")}</Text>
                  </Pressable>
                </>
              )}
              {erKoblet(vareValgt.vare) ? (
                // TILLEGG 2026-11-12 regel 1: koblet vare følger raden.
                <View className="min-h-[44px] justify-center border-t border-gray-100">
                  <Text className="text-sm text-gray-500">{t("timer.dagsoversikt.folgerRaden")}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    const v = vareValgt;
                    setVareValgt(null);
                    startFlytt({ radType: "vare", vare: v.vare, fra: v.kort });
                  }}
                  className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
                >
                  <Text className="text-base text-gray-700">{t("timer.dagsoversikt.flyttRad")}</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  const v = vareValgt;
                  setVareValgt(null);
                  // Ny vare fra en koblet vare kobles til samme rad.
                  setVareRadId(v.vare.sheetTimerId ?? null);
                  setVareKort(v.kort);
                }}
                className="min-h-[44px] justify-center border-t border-gray-100 active:bg-gray-50"
              >
                <Text className="text-base text-gray-700">{t("timer.prosjektkort.nyVare")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {vareValgt && vareMengde !== null && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setVareMengde(null)}>
          <View className="flex-1 items-center justify-center bg-black/40 px-8">
            <View className="w-full max-w-sm rounded-2xl bg-white p-5">
              <Text className="mb-2 text-base font-semibold text-gray-900">{vareValgt.vare.vare.navn}</Text>
              <Text className="mb-1 text-sm font-medium text-gray-500">
                {`${t("timer.mengde")} (${vareValgt.vare.vare.enhet})`}
              </Text>
              <TextInput
                value={vareMengde}
                onChangeText={setVareMengde}
                keyboardType="decimal-pad"
                autoFocus
                inputAccessoryViewID={TASTATUR_FERDIG_ID}
                className="mb-2 rounded-lg border border-gray-300 px-3 py-2 text-base"
              />
              {vareFeil && <Text className="mb-2 text-sm text-amber-700">{vareFeil}</Text>}
              <View className="mt-2 flex-row justify-end gap-2">
                <Pressable
                  onPress={() => {
                    setVareMengde(null);
                    setVareFeil(null);
                  }}
                  className="rounded-lg px-4 py-2.5 active:bg-gray-100"
                >
                  <Text className="text-base font-medium text-gray-700">{t("handling.avbryt")}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void lagreVareMengde()}
                  disabled={vareLagrer}
                  className="rounded-lg bg-gray-900 px-4 py-2.5 active:bg-gray-700"
                >
                  <Text className="text-base font-semibold text-white">
                    {vareLagrer ? t("handling.lagrer") : t("handling.lagre")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
          <TastaturFerdig />
        </Modal>
      )}

      <BekreftSlettModal
        synlig={!!vareValgt && vareSlett}
        tekst={t("timer.dagsoversikt.slettVareTekst", { navn: vareValgt?.vare.vare.navn ?? "" })}
        bekreftTekst={t("handling.slett")}
        onAvbryt={() => setVareSlett(false)}
        onBekreft={() => void bekreftSlettVare()}
      />

      {fravaerKort && (
        <FravaerKortModal
          userId={sedel.userId}
          organizationId={sedel.organizationId}
          dato={sedel.dato}
          dagsnorm={normtakTimer}
          dagRader={timerRader
            .filter((r) => !r.utenProsjekt)
            .map((r) => ({
              id: r.id,
              lonnsartId: r.lonnsartId,
              timer: r.timer,
              erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
            }))}
          eksisterende={fravaerRader.map((r) => ({
            id: r.id,
            lonnsartId: r.lonnsartId,
            timer: r.timer,
            beskrivelse: r.beskrivelse,
          }))}
          nyLinje={fravaerKort.nyLinje}
          onLagret={() => {
            setFravaerKort(null);
            onEndret();
          }}
          onLukk={() => setFravaerKort(null)}
        />
      )}
      {flytt && (
        <KortValgModal
          organizationId={sedel.organizationId}
          modus={{ type: "flytt", fra: flytt.fra }}
          sedel={sedelKontekst}
          prosjektNavn={prosjektNavn}
          feil={flyttFeil}
          onVelg={(til) => void utforFlytt(til)}
          onLukk={() => setFlytt(null)}
        />
      )}
    </ProsjektkortKontekst.Provider>
  );
}

function Verdi({ onPress, gra = false, children }: { onPress: () => void; gra?: boolean; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} className="min-h-[44px] justify-center active:bg-gray-50">
      <Text className={`text-sm ${gra ? "text-gray-500" : "text-gray-900"}`} style={{ fontVariant: ["tabular-nums"] }}>
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * Tom celle. RETUR 36c-2 (D2): `leggTil` gir en tydelig «+ Legg til …» der
 * trykket oppretter en ny rad — «–» ble lest som en rad som kunne redigeres.
 */
function Tom({ onPress, leggTil }: { onPress: () => void; leggTil?: string }) {
  return (
    <Pressable onPress={onPress} className="min-h-[44px] justify-center active:bg-gray-50">
      {leggTil ? (
        <Text className="text-sm font-medium text-gray-700">{leggTil}</Text>
      ) : (
        <Text className="text-sm text-gray-400">–</Text>
      )}
    </Pressable>
  );
}
