"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { SignertBilde } from "@/components/SignertBilde";
import { SignertLenke } from "@/components/SignertLenke";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Send,
  AlertCircle,
  RotateCcw,
  X,
  ChevronDown,
  Split,
  CheckSquare,
  Square,
} from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { ForslagValgSeksjon } from "@/components/timer/ForslagValgSeksjon";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import { ProsjektRadVelger } from "@/components/timer/ProsjektRadVelger";
import { MaskinVelger } from "@/components/timer/MaskinVelger";
import { KortVareforbrukModal } from "@/components/timer/KortVareforbrukModal";
import {
  RadByggeplassFelt,
  useRadByggeplass,
} from "@/components/timer/RadByggeplassFelt";
import {
  byggeplassPayload,
  radByggeplassLinje,
  type ByggeplassValg,
} from "@/lib/timerByggeplass";
import {
  maskinBucketKapasitet,
  overstigerMaskinTak,
  DEFAULT_PAUSE_ETTER_TIMER,
  pauseVinduFra,
  effektiveTimerFraSpenn,
  tilFraAntall,
  hhmmTilMin,
  pauseOverlappMin,
  pauseMinForDag,
  pauseFraForRad,
  fastPauseFraFor,
  utledArbeidstidFraRader,
  avgjorRadPauseMin,
  finnOverlappendeTidsrom,
  foreslaOvertidSplitt,
  erReiseLonnsart,
  forsokInnsending,
  svarPaaPauseSporsmaal,
  løsReiseKnappLonnsart,
  arbeidOgReise,
  arbeidUtenReise,
  sendDagenTekst,
  type ForsonRad,
  type ErReiseKontekst,
  type OvertidForslag,
} from "@sitedoc/shared";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import {
  beregnKortSummer,
  dagSummer,
  kortStatus,
  lesTimerModus,
  sumlinjeMotNorm,
  utledKortByggeplass,
  visVareforbrukKnapp,
  kortDagsseddelId,
} from "@sitedoc/shared";

const ENHETER = ["m", "m2", "m3", "kg", "tonn", "stk"] as const;

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function formatTimer(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("nb-NO");
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function isoTidspunktTilHHMM(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type TimerRad = {
  id: string;
  projectId: string;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  // T.10: kostnadsbærer for maskinvedlikehold (svak FK → Equipment). Settes kun
  // på interne verksted-rader.
  vehicleId: string | null;
  // P2 (arbeider-splitt): byggeplassId bæres videre til splittRadEier-originalen.
  byggeplassId: string | null;
  // Maskin-fra-til (2026-05-17): brukes til å foreslå default for maskin-rad
  // i samme bucket (Alt D — sammenheng-prinsipp).
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  // V20/PK1: radens egen matpause (min). Bæreren (én rad pr. dag) har > 0; alle
  // andre 0. Timetallet er trukket for denne. ÉN kilde — hodet utledes (PK6).
  pauseMin: number;
  // T.12 (2026-06-21): fritekst per rad — «hva gjorde du?». Speiler mobil.
  beskrivelse: string | null;
  // Bolk (f): rad-attestering. Brukes til å deaktivere gjenåpne-knappen når leder
  // alt har attestert (server-vakten er sannhetskilden; dette gater bare UI-et).
  attestertStatus: string | null;
  // Prosjektkort L1: reise-rad (V3/V9) — skilles fra arbeid i kortsummene.
  erReise?: boolean;
};

type TilleggVedlegg = {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

type TilleggRad = {
  id: string;
  projectId: string;
  tilleggId: string;
  antall: unknown;
  kommentar: string | null;
  // Funn #2 (2026-06-21): kvittering-vedlegg per tillegg-rad (fra hentMedId).
  vedlegg?: TilleggVedlegg[];
  attestertStatus: string | null;
  // Tillegg/utlegg på prosjektkortet (2026-11-13): NULL = arver sedelens
  // byggeplass / hovedgruppa. Valgfrie så gammel API-respons ikke bryter.
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

// U3 (2026-08-08): utlegg-rad (SheetUtlegg). Egen bærer med ordningVedFoering-
// stempel; kvittering-vedlegg speiler tillegg-vedlegg. `belop` er null for
// 'fakturert' (CHECK). Ordnings-pille + kilde utledes fra expenseCategory.list.
type UtleggRad = {
  id: string;
  projectId: string;
  expenseCategoryId: string;
  belop: unknown; // Decimal | null
  kommentar: string | null;
  ordningVedFoering: string;
  vedlegg?: TilleggVedlegg[];
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
};

type MaskinRad = {
  id: string;
  projectId: string;
  externalCostObjectId: string | null;
  vehicleId: string;
  // P2 (arbeider-splitt): byggeplassId bæres videre til splittRadEier-originalen.
  byggeplassId: string | null;
  // Maskin-fra-til (2026-05-17): valgfri tidsregistrering for maskinbruk.
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
  attestertStatus: string | null;
};

// V22: det timer-radens sekundærlinje trenger fra sedelen og gruppa.
type RadLinjeKontekst = {
  prosjektNavn: string;
  projectId: string;
  sedelByggeplassId: string | null;
  byggeplasser: ByggeplassValg[] | undefined;
  kortModus: boolean;
};

type ProsjektRef = {
  id: string;
  name: string;
  internalProjectNumber: string | null;
  type?: string;
};

// V20/PK3: dagens pause-kontekst for rad-lista. `standardPauseMin` = firmaets
// pauselengde, `regelTrigget` = dagsbrutto > 5,5 t. Avgjør om en rad viser
// kryss/tom avkrysning i lista (ORDRE 2026-11-13: ikke lenger et klokkevindu).
type PauseVisning = {
  standardPauseMin: number;
  regelTrigget: boolean;
};

export default function DagsseddelDetaljSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // D7: prosjektet valgt ved opprettelse bæres hit for å forhåndsåpne gruppa
  // (selv uten rader ennå) og bli default for nye rader. D1: `aapnetEksisterende`
  // signaliserer at sedelen fantes fra før (duplikat-dato) → subtil notis.
  const nyttProsjektParam = searchParams.get("nyttProsjekt");
  const aapnetEksisterende = searchParams.get("aapnetEksisterende") === "1";

  const utils = trpc.useUtils();
  const { data: sheet, isLoading } = trpc.timer.dagsseddel.hentMedId.useQuery(
    { id: params.id },
    { retry: false },
  );
  // Kenneth-vedtak 2026-10-09: prosjektvelgeren følger SEDELENS firma (en eksisterende
  // sedel tilhører ett bestemt firma — radene føres mot det firmaets prosjekter), ikke
  // det valgte toppbar-firmaet. Før sedelen er lastet → egen org (server-fallback).
  const { data: prosjekterRaw } = trpc.prosjekt.hentForTimer.useQuery(
    { organizationId: sheet?.organizationId ?? undefined },
    { enabled: !!sheet?.organizationId },
  );
  // Ordre (10): byggeplass per rad. hentForFirma (som mobil) er tilgjengelig for
  // arbeidere; dialogene filtrerer på radens prosjekt.
  const { data: byggeplasser } = trpc.bygning.hentForFirma.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: !!sheet?.organizationId },
  );
  // ORDRE 29: egne sist brukte maskiner (N = 5) løftes øverst i maskinvelgeren.
  const { data: sistBrukteMaskiner } = trpc.timer.dagsseddel.sistBrukteMaskiner.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: !!sheet?.organizationId },
  );
  const byggeplassNavn = useMemo(
    () => new Map((byggeplasser ?? []).map((b) => [b.id, b.name])),
    [byggeplasser],
  );

  // Maskin-fra-til (2026-05-17): orgSetting brukes som fallback når en
  // bucket mangler timer-rader (ingen rad å ta fra/til fra). Trpc-cache
  // dedupliserer på tvers av kall — én faktisk query per side.
  const { data: orgSetting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: !!sheet?.organizationId },
  );

  // D3 (web-paritet 2026-07-08): pausevindu-parametre for timer-radens fra/til
  // ↔ antall-synk. hentSetting krever firma-admin (utilgjengelig for vanlig
  // arbeider) → bruk den medlems-tilgjengelige hentArbeidstidDefaults, som
  // eksponerer nettopp standardStartTid/standardPauseMin/standardPauseEtterTimer.
  const { data: arbeidstidDefaults } =
    trpc.organisasjon.hentArbeidstidDefaults.useQuery(
      { organizationId: sheet?.organizationId ?? "" },
      { enabled: !!sheet?.organizationId },
    );

  // Ordre 2026-11-14 (6): «+ Reise» fører på ÉN løst reise-lønnsart (delt
  // resolver). Lønnsartene hentes fra sedelens firma — samme som raddialogen.
  const { data: sedelLonnsarter } = trpc.timer.lonnsart.list.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: !!sheet?.organizationId },
  );
  const reiseKnapp = useMemo(() => {
    if (!arbeidstidDefaults || !sedelLonnsarter) return null;
    const res = løsReiseKnappLonnsart(
      arbeidstidDefaults.reiseLonnsartId ?? null,
      sedelLonnsarter,
    );
    if (res.status === "valgt" || res.status === "automatisk") {
      const navn = sedelLonnsarter.find((l) => l.id === res.lonnsartId)?.navn ?? "";
      return { status: res.status, lonnsart: { id: res.lonnsartId, navn } };
    }
    return { status: res.status, lonnsart: null };
  }, [arbeidstidDefaults, sedelLonnsarter]);

  // B6 v3 (H22): topp-sum-normen hentes fra ÉN utledning på serveren
  // (sommertid + normKilde), pr. sedelens dato — IKKE den flate dagsnorm-
  // kolonnen. Samme svar som mobil (cachet) og attesteringsvarselet får.
  const { data: effektivNorm } =
    trpc.organisasjon.hentEffektivArbeidstid.useQuery(
      {
        organizationId: sheet?.organizationId ?? "",
        dato: sheet ? new Date(sheet.dato).toISOString().slice(0, 10) : "",
      },
      { enabled: !!sheet?.organizationId && !!sheet?.dato },
    );

  // Prosjektkort L1: firmaets visningsmodus (default dagskort). Kun visning —
  // samme sedel, samme mutasjoner. Varelinjene hentes bare i prosjektkort-modus.
  const prosjektkortModus =
    lesTimerModus(arbeidstidDefaults?.timerRegistreringsmodus) === "prosjektkort";
  const { data: mineVarer } = trpc.vareforbruk.hentMineForDato.useQuery(
    {
      organizationId: sheet?.organizationId ?? "",
      dato: sheet ? new Date(sheet.dato).toISOString().slice(0, 10) : "",
    },
    {
      enabled: prosjektkortModus && !!sheet?.organizationId && !!sheet?.dato,
      retry: false,
    },
  );
  // Prosjektkort L3: arbeiderens vare-katalog + prosjektene med Varelager på.
  // Feil (Varelager av for firmaet, ingen tilgang) → ingen «+ Vareforbruk».
  const { data: vareKatalog } = trpc.vareforbruk.katalogForFirma.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: prosjektkortModus && !!sheet?.organizationId, retry: false },
  );
  const [vareModalProsjekt, setVareModalProsjekt] = useState<string | null>(null);
  // Åpent kort: undefined = automatisk (eneste kort, eller nytt fra opprettelse).
  const [aapentKort, setAapentKort] = useState<string | null | undefined>(
    () => nyttProsjektParam ?? undefined,
  );

  const [redigerHeader, setRedigerHeader] = useState(false);
  const [aktivModal, setAktivModal] = useState<
    | {
        type: "timer";
        projectId: string;
        defaultEcoId?: string | null;
        // Bolk (d) R1: prefill fra/til på ny rad (siste rads tilTid ?? effektiv
        // start; til = effektiv slutt). Undefined ved redigering (radens verdier).
        defaultFraTid?: string | null;
        defaultTilTid?: string | null;
        rad?: TimerRad;
        // Ordre 2026-11-14 (6): «+ Reise» — lønnsarten er låst til den løste
        // reise-lønnsarten, og raden lagres med reiseKilde «manuell».
        reise?: { id: string; navn: string };
      }
    // U3: unified velger — «Legg til på dagsseddelen» (8a). Ruter til
    // tillegg-dialog (laastTilleggId) eller utlegg-dialog etter valg.
    | { type: "leggTil"; projectId: string }
    // laastTilleggId: kategori valgt i velgeren (add-via-velger) → vises
    // read-only i dialogen. rad: redigering (uendret sats-flyt).
    | { type: "tillegg"; projectId: string; rad?: TilleggRad; laastTilleggId?: string }
    // U3: utlegg-registrering. expenseCategoryId ved add, rad ved redigering.
    | { type: "utlegg"; projectId: string; expenseCategoryId?: string; rad?: UtleggRad }
    | {
        type: "maskin";
        projectId: string;
        defaultEcoId?: string | null;
        // Maskin-fra-til (2026-05-17): forslag basert på timer-radene i
        // samme prosjekt+ECO-bucket (Alt D — sammenheng-prinsipp).
        defaultFraTid?: string | null;
        defaultTilTid?: string | null;
        rad?: MaskinRad;
      }
    | { type: "nyProsjekt" }
    | null
  >(null);
  // P2 (arbeider-splitt): egen rad splittes til N plain rader via splittRadEier.
  // Kun tilgjengelig når erRedigerbar (draft/returned) — server håndhever eier
  // + status uansett. Discriminated union speiler radens type.
  const [splittModal, setSplittModal] = useState<
    | { type: "timer"; rad: TimerRad }
    | { type: "tillegg"; rad: TilleggRad }
    | { type: "maskin"; rad: MaskinRad }
    | null
  >(null);
  const [ekstraProsjektIder, setEkstraProsjektIder] = useState<string[]>(() =>
    nyttProsjektParam ? [nyttProsjektParam] : [],
  );
  const [notisAvvist, setNotisAvvist] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  // Bytter native confirm() til ekte modal for slett-bekreftelse
  // (CLAUDE.md § Slett-bekreftelse — confirm() blokkerer testing/automatisering).
  const [visSlettModal, setVisSlettModal] = useState(false);

  const send = trpc.timer.dagsseddel.send.useMutation({
    onSuccess: () => utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id }),
    onError: (e: { message: string }) => setFeil(e.message),
  });
  // Spørsmål ved innsending av dag over 5,5 t uten pause (Kenneth 2026-11-14
  // «still spørsmål, aksepter ved bekreftelse»). Delt flyt med mobil.
  const [visPauseSporsmaal, setVisPauseSporsmaal] = useState(false);

  const slett = trpc.timer.dagsseddel.slett.useMutation({
    onSuccess: () => router.push("/dashbord/timer/mine"),
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // Bolk (f): gjenåpne en sendt sedel (arbeiderens egen). Server nullstiller
  // lederens rad-attestering → ekte bekreftelsesmodal (CLAUDE.md § Slett-
  // bekreftelse). Web er bevisst strengere enn mobil, som fyrer uten dialog.
  const [visGjenaapneModal, setVisGjenaapneModal] = useState(false);
  const [gjenaapneFeil, setGjenaapneFeil] = useState<string | null>(null);

  const gjenaapne = trpc.timer.dagsseddel.gjenaapneDagsseddel.useMutation({
    onSuccess: () => {
      setVisGjenaapneModal(false);
      utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id });
    },
    // Speil mobilens feilGodkjent for accepted (server-melding inneholder
    // «godkjent»); ellers vis server-meldingen direkte.
    onError: (e: { message: string }) =>
      setGjenaapneFeil(
        e.message.includes("godkjent")
          ? t("timer.gjenaapne.feilGodkjent")
          : e.message,
      ),
  });

  // V19-C (C-1): arbeiderens valg mellom PC og mobilens forslag → forsonDagskort.
  // Server er sannheten (nuller konfliktVentendeSiden + sletter forslag atomisk);
  // onSuccess invaliderer detaljen så banneret forsvinner når feltet er nullet.
  const forson = trpc.timer.dagsseddel.forsonDagskort.useMutation({
    onSuccess: () => utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id }),
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // Kaster tRPC-respons til en enklere type for å unngå TS2589 (excessively
  // deep instantiation). hentMine returnerer Project med faggrupper + _count
  // som gir dyp type-tre.
  const prosjekterFlat = (prosjekterRaw ?? []) as unknown as ProsjektRef[];

  const prosjektNavnMap = useMemo(() => {
    const map = new Map<string, ProsjektRef>();
    for (const p of prosjekterFlat) {
      map.set(p.id, p);
    }
    return map;
  }, [prosjekterFlat]);

  const prosjekterForVelger = prosjekterFlat;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-red-600">{t("timer.detalj.ikkeFunnet")}</p>
        <Link
          href="/dashbord/timer/mine"
          className="mt-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("timer.tilbake")}
        </Link>
      </div>
    );
  }

  const erRedigerbar = sheet.status === "draft" || sheet.status === "returned";
  const sheetAktivitetId = sheet.aktivitetId ?? null;
  const timerRader = sheet.timer as unknown as TimerRad[];
  const utforSend = () => {
    setFeil(null);
    send.mutate({ id: sheet.id });
  };
  const sendMedPauseSporsmaal = () =>
    forsokInnsending(timerRader, {
      send: utforSend,
      spor: () => setVisPauseSporsmaal(true),
    });
  const svarPauseSporsmaal = (svar: "bekreft" | "avbryt") => {
    setVisPauseSporsmaal(false);
    svarPaaPauseSporsmaal(svar, utforSend);
  };
  const tilleggRader = sheet.tillegg as unknown as TilleggRad[];
  const maskinRader = (sheet.maskiner ?? []) as unknown as MaskinRad[];
  const utleggRader = ((sheet as { utlegg?: unknown }).utlegg ?? []) as unknown as UtleggRad[];

  // V19-C (C-1): mobilens forslag (SheetTimerForslag) + serverradene mappet til
  // ForsonRad (timer er Decimal/streng over tRPC → tilTall). Rekkefølgen av felt
  // speiler ForsonRad; begge sider mappes likt så byggForsonInputFraValg får ren
  // input.
  const tilForsonRad = (r: {
    id: string;
    projectId: string;
    byggeplassId: string | null;
    lonnsartId: string;
    aktivitetId: string;
    timer: unknown;
    fraTid: string | null;
    tilTid: string | null;
    beskrivelse: string | null;
    externalCostObjectId: string | null;
    vehicleId: string | null;
    // V19.9 (C'-1): forslagsradens grunn (SheetTimerForslag.grunn) styrer slot-
    // visningen. Sedelradene (serverens timer) har den ikke → undefined (ren overlapp).
    grunn?: string | null;
  }): ForsonRad => ({
    id: r.id,
    projectId: r.projectId,
    byggeplassId: r.byggeplassId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    timer: tilTall(r.timer),
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    beskrivelse: r.beskrivelse,
    externalCostObjectId: r.externalCostObjectId,
    vehicleId: r.vehicleId,
    grunn: r.grunn as ForsonRad["grunn"],
  });
  type ForslagRad = Parameters<typeof tilForsonRad>[0];
  const forslagRader = ((sheet as { forslag?: ForslagRad[] }).forslag ?? []).map(
    tilForsonRad,
  );
  const sedelForsonRader = timerRader.map((r) =>
    tilForsonRad(r as unknown as ForslagRad),
  );

  // Bolk (f): har leder attestert minst én rad? Da blokkerer server-vakten
  // gjenåpning — deaktiver knappen og be arbeideren kontakte leder for retur.
  const harAttestertRad =
    timerRader.some((r) => r.attestertStatus === "attestert") ||
    tilleggRader.some((r) => r.attestertStatus === "attestert") ||
    maskinRader.some((r) => r.attestertStatus === "attestert");
  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);

  // V20/PK7: «Arbeidstid i dag» er en VISNING utledet av radene (ikke hodet).
  // Finnes rader med tid: start = tidligste fraTid, slutt = seneste tilTid,
  // pause = Σ rad.pauseMin (delt `utledArbeidstidFraRader`). Uten slike rader
  // falles det tilbake til sedelens ramme (startAt/endAt) som prefyll-hint.
  const arbeidstidVisning = utledArbeidstidFraRader(
    timerRader.map((r) => ({
      fraTid: r.fraTid,
      tilTid: r.tilTid,
      pauseMin: r.pauseMin,
      timer: tilTall(r.timer),
    })),
  );
  const harRaderMedTid = arbeidstidVisning.startTid !== null;

  // Bolk (d) R1: dagens effektive arbeidstid-vindu — kilde til fra/til-prefill
  // på nye timer-rader OG pausevindu-start (pauseFra), speiler mobilens
  // hentEffektivArbeidstidLokal. sheet.startAt/endAt er kalender-effektiv for
  // dagen (prefylt server-side, cd58853a); firma-default som fallback.
  const effektivStart =
    isoTidspunktTilHHMM(sheet.startAt as string | null) ||
    arbeidstidDefaults?.standardStartTid ||
    "07:00";
  const effektivSlutt =
    isoTidspunktTilHHMM(sheet.endAt as string | null) ||
    arbeidstidDefaults?.standardSluttTid ||
    "15:00";

  // V20/PK3: pause-kontekst for rad-lista (kryss/tom avkrysning pr. rad, også
  // for rader ført på mobil). Regelen (dagsbrutto > 5,5 t) via delt
  // `pauseMinForDag`. ORDRE 2026-11-13: en rad kan bære pausen når spennet er
  // lengre enn pausen — pausen ligger der summert arbeid passerer grensen.
  const listeStandardPauseMin = arbeidstidDefaults?.standardPauseMin ?? 30;
  const dagBruttoTimer = timerRader.reduce((sum, r) => {
    if (!r.fraTid || !r.tilTid) return sum;
    const spenn = hhmmTilMin(r.tilTid) - hhmmTilMin(r.fraTid);
    return spenn > 0 ? sum + spenn / 60 : sum;
  }, 0);
  const pauseVisning = {
    standardPauseMin: listeStandardPauseMin,
    regelTrigget: pauseMinForDag(dagBruttoTimer, listeStandardPauseMin) > 0,
  };

  // T7-4c (2026-05-16): Grupper per (projectId, externalCostObjectId) for
  // arbeid + maskin. Tillegg/utlegg (2026-11-13): rader med underprosjekt går i
  // sin ECO-bøtte; rader uten (NULL) står i prosjektets tillegg/utlegg-seksjon
  // som før — og skaper ingen tom hovedbøtte.
  // Rekkefølge: prosjekt-IDer i den rekkefølgen de først dukker opp; innen
  // hvert prosjekt: hovedgruppe (ECO=null) først, deretter ECO-er i rekkefølge.
  type EcoGruppeData = {
    timer: TimerRad[];
    maskin: MaskinRad[];
    tillegg: TilleggRad[];
    utlegg: UtleggRad[];
  };
  const ecoGruppeKey = (pid: string, eco: string | null) =>
    `${pid}|${eco ?? ""}`;
  const ecoGrupper = new Map<string, EcoGruppeData>();
  const tilleggPerProsjekt = new Map<string, TilleggRad[]>();
  const utleggPerProsjekt = new Map<string, UtleggRad[]>();
  const prosjektEcoIder = new Map<string, string[]>(); // pid → ordered eco-ids (null = "")
  const prosjektRekkefolge: string[] = [];

  const noterProsjekt = (pid: string) => {
    if (!prosjektEcoIder.has(pid)) {
      prosjektEcoIder.set(pid, []);
      prosjektRekkefolge.push(pid);
    }
  };
  const noterEco = (pid: string, eco: string | null) => {
    noterProsjekt(pid);
    const liste = prosjektEcoIder.get(pid)!;
    const ekv = eco ?? "";
    if (!liste.includes(ekv)) liste.push(ekv);
  };
  const finnEcoGruppe = (pid: string, eco: string | null): EcoGruppeData => {
    const k = ecoGruppeKey(pid, eco);
    let g = ecoGrupper.get(k);
    if (!g) {
      g = { timer: [], maskin: [], tillegg: [], utlegg: [] };
      ecoGrupper.set(k, g);
    }
    return g;
  };

  for (const r of timerRader) {
    noterEco(r.projectId, r.externalCostObjectId);
    finnEcoGruppe(r.projectId, r.externalCostObjectId).timer.push(r);
  }
  for (const r of maskinRader) {
    noterEco(r.projectId, r.externalCostObjectId);
    finnEcoGruppe(r.projectId, r.externalCostObjectId).maskin.push(r);
  }
  for (const r of tilleggRader) {
    if (r.externalCostObjectId) {
      noterEco(r.projectId, r.externalCostObjectId);
      finnEcoGruppe(r.projectId, r.externalCostObjectId).tillegg.push(r);
      continue;
    }
    noterProsjekt(r.projectId);
    const liste = tilleggPerProsjekt.get(r.projectId) ?? [];
    liste.push(r);
    tilleggPerProsjekt.set(r.projectId, liste);
  }
  for (const r of utleggRader) {
    if (r.externalCostObjectId) {
      noterEco(r.projectId, r.externalCostObjectId);
      finnEcoGruppe(r.projectId, r.externalCostObjectId).utlegg.push(r);
      continue;
    }
    noterProsjekt(r.projectId);
    const liste = utleggPerProsjekt.get(r.projectId) ?? [];
    liste.push(r);
    utleggPerProsjekt.set(r.projectId, liste);
  }

  // Slå sammen prosjekt-IDer fra rader + bruker-tilføyde tomme grupper
  const aktiveProsjektIder = Array.from(
    new Set<string>([...prosjektRekkefolge, ...ekstraProsjektIder]),
  );
  for (const pid of ekstraProsjektIder) noterProsjekt(pid);

  // Topp-sum-norm = firmaets dagsnorm for sedelens dato (fase-0:1041), decouplet
  // fra arbeidstid-vinduet: en kort dag er gyldig og akseptert (blå), ikke en
  // falsk «under norm»-alarm. B6 v3 (H22): sesongjustert via server-servicen
  // (`hentEffektivArbeidstid`) — ikke lenger flat kolonne. null til lastet (grå).
  const normTimer =
    effektivNorm != null ? tilTall(effektivNorm.dagsnorm) : null;

  // Filtrer prosjekter som ikke er aktive ennå (tilgjengelige for «+ Legg til prosjekt»)
  const ledigeProsjekter = prosjekterForVelger.filter(
    (p) => !aktiveProsjektIder.includes(p.id),
  );

  // Bolk (g): fra = SENESTE tilTid på HELE sedelen (alle bøtter), ellers dagens
  // effektive start. «Fortsett der du slapp» på hele dagen — ikke bare bøtta.
  // Seneste slutt hindrer at ny rad prefylles inn i et allerede registrert
  // tidsrom (overlapp-vakt). Delt av dagskortets gruppe og prosjektkortets «+ Timer».
  const aapneNyTimerRad = (
    projectId: string,
    ecoId: string | null,
    reise?: { id: string; navn: string },
  ) => {
    const sisteTil = timerRader
      .map((r) => r.tilTid)
      .filter((t): t is string => !!t)
      .reduce<string | null>(
        (senest, t) =>
          senest === null || hhmmTilMin(t) > hhmmTilMin(senest) ? t : senest,
        null,
      );
    setAktivModal({
      type: "timer",
      projectId,
      defaultEcoId: ecoId,
      defaultFraTid: sisteTil ?? effektivStart,
      defaultTilTid: effektivSlutt,
      reise,
    });
  };

  // Props for én ProsjektGruppe — samme i dagskortet og i et åpent prosjektkort.
  const gruppeProps = (projectId: string) => {
    // T7-4c: hvis ingen rader på prosjektet ennå (bruker la til via
    // "+ Legg til prosjekt"), vis kun hovedgruppen (ECO=null).
    const ecoIder = prosjektEcoIder.get(projectId);
    const ecoListe = ecoIder && ecoIder.length > 0 ? ecoIder : [""];
    return {
      projectId,
      prosjektNavn: prosjektNavnMap.get(projectId),
      tillegg: tilleggPerProsjekt.get(projectId) ?? [],
      utlegg: utleggPerProsjekt.get(projectId) ?? [],
      ecoBuckets: ecoListe.map((ekv) => {
        const ecoId = ekv === "" ? null : ekv;
        const data = ecoGrupper.get(ecoGruppeKey(projectId, ecoId));
        return {
          ecoId,
          timer: data?.timer ?? [],
          maskin: data?.maskin ?? [],
          tillegg: data?.tillegg ?? [],
          utlegg: data?.utlegg ?? [],
        };
      }),
      erRedigerbar,
      pauseMin: sheet.pauseMin,
      pauseVisning,
      byggeplassNavn,
      radLinje: {
        prosjektNavn:
          prosjektNavnMap.get(projectId)?.name ?? t("timer.detalj.ukjentProsjekt"),
        projectId,
        sedelByggeplassId:
          (sheet as { byggeplassId?: string | null }).byggeplassId ?? null,
        byggeplasser,
        kortModus: prosjektkortModus,
      },
      onTilfoyTimer: (ecoId: string | null) => aapneNyTimerRad(projectId, ecoId),
      onLeggTil: () => setAktivModal({ type: "leggTil", projectId }),
      onRedigerTimer: (rad: TimerRad) =>
        setAktivModal({ type: "timer", projectId, rad }),
      onRedigerTillegg: (rad: TilleggRad) =>
        setAktivModal({ type: "tillegg", projectId, rad }),
      onRedigerUtlegg: (rad: UtleggRad) =>
        setAktivModal({ type: "utlegg", projectId, rad }),
      onRedigerMaskin: (rad: MaskinRad) =>
        setAktivModal({ type: "maskin", projectId, rad }),
      onSplittTimer: (rad: TimerRad) => setSplittModal({ type: "timer", rad }),
      onSplittTillegg: (rad: TilleggRad) =>
        setSplittModal({ type: "tillegg", rad }),
      onSplittMaskin: (rad: MaskinRad) => setSplittModal({ type: "maskin", rad }),
    };
  };

  // Prosjektkort L1: kortnavn «nr — navn» (overlapp-meldingen og pausebæreren).
  const kortNavn = (projectId: string) => {
    const p = prosjektNavnMap.get(projectId);
    if (!p) return t("timer.detalj.ukjentProsjekt");
    return p.internalProjectNumber
      ? `${p.internalProjectNumber} — ${p.name}`
      : p.name;
  };
  const kortNavnMap = new Map(aktiveProsjektIder.map((id) => [id, kortNavn(id)]));

  return (
    <div className="max-w-3xl p-6">
      <Link
        href="/dashbord/timer/mine"
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("timer.tilbake")}
      </Link>

      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {formatDato(sheet.dato)}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={sheet.status} />
          {!erRedigerbar && sheet.status !== "accepted" && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <AlertCircle className="h-3 w-3" />
              {t("timer.detalj.laast")}
            </span>
          )}
        </div>
      </div>

      {/* Bolk (f): gjenåpning — kun på SENDT sedel (ikke draft/returned/accepted).
          Speiler mobilens knapp + hjelpetekst; bekreftelse via modal under. */}
      {sheet.status === "sent" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            {harAttestertRad
              ? t("timer.gjenaapne.laastAttestert")
              : t("timer.gjenaapne.hjelp")}
          </p>
          <Button
            variant="secondary"
            disabled={harAttestertRad}
            onClick={() => {
              setGjenaapneFeil(null);
              setVisGjenaapneModal(true);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("timer.gjenaapne.knapp")}
          </Button>
        </div>
      )}

      {/* D1: sedelen fantes fra før for denne datoen (åpnet i stedet for feil). */}
      {aapnetEksisterende && !notisAvvist && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm text-blue-900">
            {t("timer.detalj.aapnetEksisterende")}
          </p>
          <button
            type="button"
            onClick={() => setNotisAvvist(true)}
            className="rounded p-1 text-blue-500 hover:bg-blue-100 hover:text-blue-700"
            title={t("handling.lukk")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {sheet.status === "returned" && sheet.lederKommentar && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4" />
            {t("timer.detalj.returnertTittel")}
          </div>
          <p className="whitespace-pre-wrap text-sm text-amber-900">
            {sheet.lederKommentar}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {t("timer.detalj.returnertHjelp")}
          </p>
        </div>
      )}

      {sheet.status === "accepted" && sheet.attestertVed && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-green-900">
            <AlertCircle className="h-4 w-4" />
            {t("timer.detalj.attestertTittel", {
              dato: new Date(sheet.attestertVed as string | Date).toLocaleString(
                "no-NB",
              ),
            })}
          </div>
        </div>
      )}

      {/* D5: maskinførerbevis-varsel til arbeider (T.11-paritet med mobil).
          Informativt, aldri blokkerende. Kun når sedelen har maskin-rader. */}
      {maskinRader.length > 0 && sheet.manglerMaskinforerbevis && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {t("timer.maskinforerbevis.arbeider")}
          </p>
        </div>
      )}

      {/* V19-C (C-1): mobilen overlappet PC-dagskortet → arbeideren velger side.
          Vises kun når det finnes et uavklart forslag (eier-queryen leverer
          forslaget; attestering er blokkert på serveren til valget er gjort). */}
      {forslagRader.length > 0 && (
        <ForslagValgSeksjon
          sedelRader={sedelForsonRader}
          forslag={forslagRader}
          bekrefter={forson.isPending}
          onBekreft={(input) =>
            forson.mutate({ sheetId: sheet.id, ...input })
          }
        />
      )}

      {/* Header-info — sedel-nivå. Prosjektkort-modus: «Dagens ramme» under kortene. */}
      {!prosjektkortModus && (
      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {t("timer.detalj.detaljer")}
          </h2>
          {erRedigerbar && (
            <button
              onClick={() => setRedigerHeader(true)}
              className="inline-flex items-center gap-1 rounded p-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <Pencil className="h-4 w-4" />
              {t("handling.rediger")}
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Definisjon
            term={t("timer.felt.aktivitet")}
            verdi={sheet.aktivitet?.navn ?? "—"}
            spann={2}
          />
          {sheet.beskrivelse && (
            <Definisjon
              term={t("timer.felt.beskrivelse")}
              verdi={sheet.beskrivelse}
              spann={2}
            />
          )}
        </dl>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <h3 className="text-sm font-medium text-gray-600">
            {t("timer.arbeidstidIDag")}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            {harRaderMedTid
              ? t("timer.arbeidstidUtledet")
              : t("timer.arbeidstidPrefyltHint")}
          </p>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Definisjon
              term={t("timer.felt.startTid")}
              verdi={
                harRaderMedTid
                  ? arbeidstidVisning.startTid ?? "—"
                  : isoTidspunktTilHHMM(sheet.startAt as string | null) || "—"
              }
            />
            <Definisjon
              term={t("timer.felt.sluttTid")}
              verdi={
                harRaderMedTid
                  ? arbeidstidVisning.sluttTid ?? "—"
                  : isoTidspunktTilHHMM(sheet.endAt as string | null) || "—"
              }
            />
            <Definisjon
              term={t("timer.felt.pauseMin")}
              verdi={`${harRaderMedTid ? arbeidstidVisning.sumPauseMin : sheet.pauseMin} min`}
            />
          </dl>
        </div>
      </section>
      )}

      {/* Prosjekt-grupper (dagskort) / prosjektkort-samleside */}
      {prosjektkortModus ? (
        <ProsjektkortSamleside
          prosjektIder={aktiveProsjektIder}
          aapentKort={
            aapentKort === undefined
              ? aktiveProsjektIder.length === 1
                ? aktiveProsjektIder[0]!
                : null
              : aapentKort
          }
          onVelgKort={setAapentKort}
          kortNavn={kortNavnMap}
          timerRader={timerRader}
          maskinRader={maskinRader}
          varer={(mineVarer ?? []) as KortVare[]}
          sedelByggeplassId={(sheet as { byggeplassId?: string | null }).byggeplassId ?? null}
          byggeplassNavn={byggeplassNavn}
          byggeplasser={byggeplasser}
          erRedigerbar={erRedigerbar}
          kanLeggeTilKort={ledigeProsjekter.length > 0}
          ramme={{
            fra: harRaderMedTid
              ? arbeidstidVisning.startTid ?? "—"
              : isoTidspunktTilHHMM(sheet.startAt as string | null) || "—",
            til: harRaderMedTid
              ? arbeidstidVisning.sluttTid ?? "—"
              : isoTidspunktTilHHMM(sheet.endAt as string | null) || "—",
            pauseMin: harRaderMedTid
              ? arbeidstidVisning.sumPauseMin
              : sheet.pauseMin,
            aktivitet: sheet.aktivitet?.navn ?? null,
            beskrivelse: sheet.beskrivelse ?? null,
          }}
          normTimer={normTimer}
          erReturnert={sheet.status === "returned"}
          kanSlette={
            sheet.status === "draft" ||
            (sheet.status === "returned" && !sheet.attestertVed)
          }
          sender={send.isPending}
          sletter={slett.isPending}
          renderKort={(projectId) => (
            <ProsjektGruppe iKort {...gruppeProps(projectId)} />
          )}
          onNyTimer={(projectId) => aapneNyTimerRad(projectId, null)}
          reiseLonnsart={reiseKnapp?.lonnsart ?? null}
          // Firmaadmin (hentSetting lykkes kun for admin) ser hvorfor «+ Reise»
          // mangler, med lenke til innstillingen. Andre ser ingenting.
          visReiseHint={
            !!orgSetting &&
            (reiseKnapp?.status === "ingen" || reiseKnapp?.status === "flere")
              ? reiseKnapp.status
              : null
          }
          onNyReise={(projectId, lonnsart) =>
            aapneNyTimerRad(projectId, null, lonnsart)
          }
          onNyMaskin={(projectId) =>
            setAktivModal({
              type: "maskin",
              projectId,
              defaultEcoId: null,
              defaultFraTid: effektivStart,
              defaultTilTid: effektivSlutt,
            })
          }
          onLeggTil={(projectId) => setAktivModal({ type: "leggTil", projectId })}
          varelagerProsjekter={vareKatalog?.prosjektIderMedVarelager}
          onNyVare={setVareModalProsjekt}
          onNyttKort={() => setAktivModal({ type: "nyProsjekt" })}
          onEndreRamme={() => setRedigerHeader(true)}
          onSlett={() => setVisSlettModal(true)}
          onSend={sendMedPauseSporsmaal}
        />
      ) : aktiveProsjektIder.length === 0 ? (
        <section className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.detalj.ingenProsjektGrupper")}
        </section>
      ) : (
        aktiveProsjektIder.map((projectId) => (
          <ProsjektGruppe key={projectId} {...gruppeProps(projectId)} />
        ))
      )}

      {/* + Legg til prosjekt */}
      {!prosjektkortModus && erRedigerbar && ledigeProsjekter.length > 0 && (
        <div className="mb-6">
          <Button
            variant="secondary"
            onClick={() => setAktivModal({ type: "nyProsjekt" })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {t("timer.leggTilProsjekt")}
          </Button>
        </div>
      )}

      {/* Topp-sum — tre-veis trafikklys relativt til dagsnorm (paritet m/ mobil
          SummeringsBanner). Rund KUN for farge (nærmeste 15 min, T.5-konsistent);
          vist tall uendret. grønn = treffer · gul = over · blå = under (akseptert). */}
      {!prosjektkortModus &&
        erRedigerbar &&
        (() => {
          const rundet = Math.round(totaltimer * 4) / 4;
          const sone =
            normTimer === null
              ? "grå"
              : Math.abs(rundet - normTimer) < 0.001
                ? "grønn"
                : rundet > normTimer
                  ? "gul"
                  : "blå";
          const farge =
            sone === "grå"
              ? "border-gray-200 bg-gray-50 text-gray-600"
              : sone === "grønn"
                ? "border-green-200 bg-green-50 text-green-700"
                : sone === "gul"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                  : "border-blue-200 bg-blue-50 text-blue-700";
          return (
            <div className={`mb-4 rounded-lg border p-4 text-sm ${farge}`}>
              {t("timer.summering", {
                registrert: totaltimer.toFixed(2),
                total: normTimer === null ? "?" : normTimer.toFixed(2),
              })}
            </div>
          );
        })()}

      {/* Send + slett (prosjektkort-modus: bunnlinja i samlesiden) */}
      {!prosjektkortModus && erRedigerbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          {/* Kenneth-vedtak 2026-10-09 (2): utkast ELLER returnert-og-ikke-attestert
              kan slettes av eieren (server håndhever samme regel). */}
          {(sheet.status === "draft" ||
            (sheet.status === "returned" && !sheet.attestertVed)) && (
            <Button
              variant="secondary"
              onClick={() => setVisSlettModal(true)}
              disabled={slett.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t("timer.detalj.slett")}
            </Button>
          )}
          <KnappMedForklaring
            sperret={timerRader.length === 0 && !send.isPending}
            forklaring={t("sperret.minstEnRad")}
          >
            <Button
              onClick={sendMedPauseSporsmaal}
              disabled={send.isPending || timerRader.length === 0}
            >
              <Send className="mr-1 h-4 w-4" />
              {sheet.status === "returned"
                ? t("timer.detalj.sendPaaNytt")
                : t("timer.detalj.sendTilLeder")}
            </Button>
          </KnappMedForklaring>
        </div>
      )}

      {feil && <p className="mt-3 text-sm text-red-600">{feil}</p>}

      {/* Modaler */}
      {redigerHeader && (
        <RedigerHeaderDialog
          sheet={sheet}
          onLukk={() => setRedigerHeader(false)}
        />
      )}
      {aktivModal?.type === "timer" && (
        <TimerRadDialog
          sheetId={sheet.id}
          // P1 (maskin-i-rad): firmaId for å speile resolveren (maskin-modulens
          // firmatak). Uten firmatak skjules maskin-seksjonen.
          organizationId={sheet.organizationId}
          projectId={aktivModal.projectId}
          prosjekter={prosjekterForVelger}
          byggeplasser={byggeplasser}
          defaultAktivitetId={sheetAktivitetId}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          rad={aktivModal.rad}
          laastReiseLonnsart={aktivModal.reise}
          // P4b: hele sedelens timer-rader sendes inn så dialogen kan kjøre samme
          // kryss-bøtte overlapp-vakt som mobil (delt finnOverlappendeTidsrom).
          alleTimerRader={timerRader}
          // Prosjektkort L1: inne i et kort er prosjektet låst, og overlapp-
          // meldingen navngir det andre kortet.
          laastProsjekt={prosjektkortModus}
          kortNavn={prosjektkortModus ? kortNavnMap : undefined}
          // P1 (maskin-i-rad): sedelens maskin-rader + sedel-pause for den valgfrie
          // maskin-seksjonen (bucket-kapasitet, samme regel som MaskinRadDialog).
          alleMaskinRader={maskinRader}
          sistBrukteMaskiner={sistBrukteMaskiner ?? []}
          pauseMin={sheet.pauseMin}
          // Bolk (d) R1: prefill fra/til på ny rad + T.5-runding, fra medlems-
          // tilgjengelig arbeidstidDefaults (tidsrundingMinutter eksponert der).
          defaultFraTid={aktivModal.defaultFraTid ?? null}
          defaultTilTid={aktivModal.defaultTilTid ?? null}
          tidsrundingMinutter={arbeidstidDefaults?.tidsrundingMinutter ?? null}
          // D3/bolk (d): pausevindu = effektiv skiftstart + standardPauseEtterTimer,
          // lengde standardPauseMin (effektivStart = dagens kalender-effektive start).
          skiftStart={effektivStart}
          standardPauseMin={arbeidstidDefaults?.standardPauseMin ?? 30}
          standardPauseEtterTimer={
            arbeidstidDefaults?.standardPauseEtterTimer ??
            DEFAULT_PAUSE_ETTER_TIMER
          }
          // V20/PK5: pausereferanse fra kalender-effektiv norm (samme kilde som
          // serveren). Default «ankomst» (firma-standard) til normen er lastet.
          pauseReferanse={effektivNorm?.pauseReferanse ?? "ankomst"}
          // V21: dagsnorm + reise-kontekst for overtidsforslaget i dialogen.
          normTimer={normTimer}
          reiseKontekst={{
            reiseLonnsartId: arbeidstidDefaults?.reiseLonnsartId ?? null,
            grensepunktLonnsartIds: (arbeidstidDefaults?.reiseGrenser ?? [])
              .map((g) => g.lonnsartId)
              .filter((id): id is string => id != null),
          }}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {vareModalProsjekt && vareKatalog && (
        <KortVareforbrukModal
          projectId={vareModalProsjekt}
          prosjektNavn={kortNavn(vareModalProsjekt)}
          dato={new Date(sheet.dato).toISOString().slice(0, 10)}
          dagsseddelId={kortDagsseddelId(sheet.id, timerRader, vareModalProsjekt)}
          varer={vareKatalog.varer}
          byggeplasser={byggeplasser}
          onClose={() => setVareModalProsjekt(null)}
        />
      )}

      {aktivModal?.type === "leggTil" && (
        <LeggTilVelger
          projectId={aktivModal.projectId}
          onValgTillegg={(tilleggId) =>
            setAktivModal({
              type: "tillegg",
              projectId: aktivModal.projectId,
              laastTilleggId: tilleggId,
            })
          }
          onValgUtlegg={(expenseCategoryId) =>
            setAktivModal({
              type: "utlegg",
              projectId: aktivModal.projectId,
              expenseCategoryId,
            })
          }
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "tillegg" && (
        <TilleggRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          byggeplasser={byggeplasser}
          rad={aktivModal.rad}
          laastTilleggId={aktivModal.laastTilleggId}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "utlegg" && (
        <UtleggRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          byggeplasser={byggeplasser}
          expenseCategoryId={aktivModal.expenseCategoryId}
          rad={aktivModal.rad}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "maskin" && (
        <MaskinRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          byggeplasser={byggeplasser}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          defaultFraTid={aktivModal.defaultFraTid ?? null}
          defaultTilTid={aktivModal.defaultTilTid ?? null}
          tidsrundingMinutter={orgSetting?.tidsrundingMinutter ?? null}
          rad={aktivModal.rad}
          // Del 2 (maskin ≤ arbeid): hele sedelen sendes inn så modalen kan
          // beregne bucket-kapasitet reaktivt for gjeldende (projectId, ECO).
          alleTimerRader={timerRader}
          alleMaskinRader={maskinRader}
          sistBrukteMaskiner={sistBrukteMaskiner ?? []}
          pauseMin={sheet.pauseMin}
          // B1/B2 (bolk e): pausevindu-parametre for spenn↔antall-synk. Samme
          // kilde som timer-modalen; standardPauseMin ≠ pauseMin (bucket-tak).
          skiftStart={effektivStart}
          standardPauseMin={arbeidstidDefaults?.standardPauseMin ?? 30}
          standardPauseEtterTimer={
            arbeidstidDefaults?.standardPauseEtterTimer ??
            DEFAULT_PAUSE_ETTER_TIMER
          }
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "nyProsjekt" && (
        <NyProsjektDialog
          ledigeProsjekter={ledigeProsjekter}
          onLukk={() => setAktivModal(null)}
          onVelg={(id) => {
            setEkstraProsjektIder((prev) =>
              prev.includes(id) ? prev : [...prev, id],
            );
            setAapentKort(id);
            setAktivModal(null);
          }}
        />
      )}

      {/* P2 (arbeider-splitt): arbeideren splitter egen rad i draft/returned.
          Gjenbruker SplittRadModal i eierModus → splittRadEier. onLagret
          invaliderer hentMedId (detalj-sidens datakilde). */}
      {splittModal?.type === "timer" && (
        <SplittRadModal
          eierModus
          radType="timer"
          original={{
            id: splittModal.rad.id,
            lonnsartId: splittModal.rad.lonnsartId,
            aktivitetId: splittModal.rad.aktivitetId,
            externalCostObjectId: splittModal.rad.externalCostObjectId,
            projectId: splittModal.rad.projectId,
            byggeplassId: splittModal.rad.byggeplassId,
            fraTid: splittModal.rad.fraTid,
            tilTid: splittModal.rad.tilTid,
            timer: splittModal.rad.timer,
          }}
          sheetId={sheet.id}
          organizationId={sheet.organizationId}
          prosjekter={prosjekterForVelger}
          tidsrundingMinutter={arbeidstidDefaults?.tidsrundingMinutter ?? null}
          onLukk={() => setSplittModal(null)}
          onLagret={() => {
            setSplittModal(null);
            utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id });
          }}
        />
      )}
      {splittModal?.type === "tillegg" && (
        <SplittRadModal
          eierModus
          radType="tillegg"
          original={{
            id: splittModal.rad.id,
            tilleggId: splittModal.rad.tilleggId,
            projectId: splittModal.rad.projectId,
            antall: splittModal.rad.antall,
            kommentar: splittModal.rad.kommentar,
          }}
          sheetId={sheet.id}
          organizationId={sheet.organizationId}
          prosjekter={prosjekterForVelger}
          tidsrundingMinutter={arbeidstidDefaults?.tidsrundingMinutter ?? null}
          onLukk={() => setSplittModal(null)}
          onLagret={() => {
            setSplittModal(null);
            utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id });
          }}
        />
      )}
      {splittModal?.type === "maskin" && (
        <SplittRadModal
          eierModus
          radType="maskin"
          original={{
            id: splittModal.rad.id,
            vehicleId: splittModal.rad.vehicleId,
            projectId: splittModal.rad.projectId,
            externalCostObjectId: splittModal.rad.externalCostObjectId,
            byggeplassId: splittModal.rad.byggeplassId,
            fraTid: splittModal.rad.fraTid,
            tilTid: splittModal.rad.tilTid,
            timer: splittModal.rad.timer,
            mengde: splittModal.rad.mengde,
            enhet: splittModal.rad.enhet,
          }}
          sheetId={sheet.id}
          organizationId={sheet.organizationId}
          prosjekter={prosjekterForVelger}
          tidsrundingMinutter={arbeidstidDefaults?.tidsrundingMinutter ?? null}
          onLukk={() => setSplittModal(null)}
          onLagret={() => {
            setSplittModal(null);
            utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id });
          }}
        />
      )}

      {/* Bolk (f): gjenåpne-bekreftelse. Ekte modal (aldri confirm()). Teksten
          sier eksplisitt at lederens rad-attestering nullstilles. */}
      {visGjenaapneModal && (
        <Modal
          open={true}
          onClose={() => setVisGjenaapneModal(false)}
          title={t("timer.gjenaapne.bekreftTittel")}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("timer.gjenaapne.bekreftTekst")}
            </p>
            {gjenaapneFeil && (
              <p className="text-sm text-sitedoc-error">{gjenaapneFeil}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setVisGjenaapneModal(false)}
              >
                {t("handling.avbryt")}
              </Button>
              <Button
                onClick={() => gjenaapne.mutate({ id: params.id })}
                loading={gjenaapne.isPending}
              >
                {t("timer.gjenaapne.bekreftKnapp")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {visPauseSporsmaal && (
        <Modal
          open={true}
          onClose={() => svarPauseSporsmaal("avbryt")}
          title={t("timer.pauseSporsmaal.tittel")}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("timer.pauseSporsmaal.tekst")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => svarPauseSporsmaal("avbryt")}
              >
                {t("handling.avbryt")}
              </Button>
              <Button onClick={() => svarPauseSporsmaal("bekreft")}>
                {t("timer.pauseSporsmaal.sendLikevel")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Slett-bekreftelse — ekte modal (erstatter native confirm(),
          CLAUDE.md § Slett-bekreftelse). */}
      {visSlettModal && (
        <Modal
          open={true}
          onClose={() => setVisSlettModal(false)}
          title={t("timer.detalj.slett")}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("timer.detalj.slettBekreft")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setVisSlettModal(false)}
              >
                {t("handling.avbryt")}
              </Button>
              <Button
                variant="danger"
                onClick={() => slett.mutate({ id: sheet.id })}
                loading={slett.isPending}
              >
                {t("handling.slett")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ProsjektkortSamleside — Prosjektkort L1 (2026-11-05)                */
/*  Visningsmodus over samme DailySheet (modell A): ett kort pr.        */
/*  prosjekt med Arbeid/Maskin/Varer/Reise, åpnes på plass. Innholdet   */
/*  i et åpent kort er dagskortets ProsjektGruppe (iKort). Sedelens      */
/*  ramme vises som nedtonet linje; innsending pr. dag i bunnlinja.     */
/* ------------------------------------------------------------------ */

type KortVare = {
  id: string;
  projectId: string;
  byggeplassId: string | null;
  antall: number;
  vare: { id: string; navn: string; enhet: string };
};

function ProsjektkortSamleside({
  prosjektIder,
  aapentKort,
  onVelgKort,
  kortNavn,
  timerRader,
  maskinRader,
  varer,
  sedelByggeplassId,
  byggeplassNavn,
  byggeplasser,
  erRedigerbar,
  kanLeggeTilKort,
  ramme,
  normTimer,
  erReturnert,
  kanSlette,
  sender,
  sletter,
  renderKort,
  onNyTimer,
  reiseLonnsart,
  visReiseHint,
  onNyReise,
  onNyMaskin,
  onLeggTil,
  varelagerProsjekter,
  onNyVare,
  onNyttKort,
  onEndreRamme,
  onSlett,
  onSend,
}: {
  prosjektIder: string[];
  aapentKort: string | null;
  onVelgKort: (projectId: string | null) => void;
  kortNavn: Map<string, string>;
  timerRader: TimerRad[];
  maskinRader: MaskinRad[];
  varer: KortVare[];
  sedelByggeplassId: string | null;
  byggeplassNavn: Map<string, string>;
  /** Funn 3: byggeplassens prosjekt, så arv på tvers av prosjekt ikke teller i kortoverskriften. */
  byggeplasser: ByggeplassValg[] | undefined;
  erRedigerbar: boolean;
  kanLeggeTilKort: boolean;
  ramme: {
    fra: string;
    til: string;
    pauseMin: number;
    aktivitet: string | null;
    beskrivelse: string | null;
  };
  normTimer: number | null;
  erReturnert: boolean;
  kanSlette: boolean;
  sender: boolean;
  sletter: boolean;
  renderKort: (projectId: string) => JSX.Element;
  onNyTimer: (projectId: string) => void;
  /** Løst reise-lønnsart for «+ Reise»; null = knappen skjules. */
  reiseLonnsart: { id: string; navn: string } | null;
  /** Firmaadmin-hint når knappen er skjult (ingen/flere kandidater). */
  visReiseHint: "ingen" | "flere" | null;
  onNyReise: (projectId: string, lonnsart: { id: string; navn: string }) => void;
  onNyMaskin: (projectId: string) => void;
  onLeggTil: (projectId: string) => void;
  varelagerProsjekter: readonly string[] | undefined;
  onNyVare: (projectId: string) => void;
  onNyttKort: () => void;
  onEndreRamme: () => void;
  onSlett: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const enhet = t("timer.timerEnhet");
  const visTimer = (n: number) =>
    n > 0
      ? `${n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${enhet}`
      : "—";

  // «Send dagen (7,5 t · reise 2 t)»: arbeid og reise hver for seg (ordre
  // 2026-11-14 (6)). Sumlinja mot normen teller ikke reise.
  const dagArbeidReise = arbeidOgReise(timerRader);
  const dag = dagSummer(timerRader, maskinRader);
  const { registrert: motNorm, sone } = sumlinjeMotNorm(timerRader, normTimer);
  const prikk =
    sone === "grå"
      ? "bg-gray-400"
      : sone === "grønn"
        ? "bg-green-500"
        : sone === "gul"
          ? "bg-yellow-500"
          : "bg-blue-500";
  // Pausen bæres av én rad pr. dag (V20/PK1) — navngi kortet den står på.
  const pauseBaerer = timerRader.find(
    (r) => r.attestertStatus !== "erstattet" && r.pauseMin > 0,
  );

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("timer.prosjektkort.overskrift", { antall: prosjektIder.length })}
      </h2>

      {prosjektIder.length === 0 && (
        <div className="mb-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.prosjektkort.ingenKort")}
        </div>
      )}

      <div className="space-y-3">
        {prosjektIder.map((projectId) => {
          const kTimer = timerRader.filter((r) => r.projectId === projectId);
          const kMaskin = maskinRader.filter((r) => r.projectId === projectId);
          const kVarer = varer.filter((v) => v.projectId === projectId);
          const summer = beregnKortSummer(kTimer, kMaskin, kVarer);
          const bp = utledKortByggeplass([...kTimer, ...kMaskin], sedelByggeplassId, {
            projectId,
            byggeplassProsjekt: (id) => byggeplasser?.find((b) => b.id === id)?.projectId,
          });
          const status = kortStatus([...kTimer, ...kMaskin]);
          const aapen = aapentKort === projectId;
          const varerTekst =
            summer.varer === null
              ? "—"
              : summer.varer.type === "mengde"
                ? `${summer.varer.antall.toLocaleString("nb-NO")} ${summer.varer.enhet}`
                : t("timer.prosjektkort.varelinjer", { antall: summer.varer.antall });
          const kolonner: [string, string][] = [
            [t("timer.prosjektkort.kolonne.arbeid"), visTimer(summer.arbeid)],
            [t("timer.prosjektkort.kolonne.maskin"), visTimer(summer.maskin)],
            [t("timer.prosjektkort.kolonne.varer"), varerTekst],
            [t("timer.prosjektkort.kolonne.reise"), visTimer(summer.reise)],
          ];
          return (
            <div
              key={projectId}
              className={`rounded-lg border bg-white ${aapen ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"}`}
            >
              <button
                type="button"
                aria-expanded={aapen}
                onClick={() => onVelgKort(aapen ? null : projectId)}
                className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {kortNavn.get(projectId) ?? t("timer.detalj.ukjentProsjekt")}
                    </span>
                    {status === "returnert" && (
                      <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                        {t("timer.prosjektkort.status.returnert")}
                      </span>
                    )}
                    {status === "attestert" && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                        {t("timer.prosjektkort.status.attestert")}
                      </span>
                    )}
                  </div>
                  {bp.type !== "ingen" && (
                    <div className="mt-0.5 truncate text-xs text-gray-500">
                      {bp.type === "en"
                        ? byggeplassNavn.get(bp.id) ?? ""
                        : t("timer.prosjektkort.flereByggeplasser", { antall: bp.antall })}
                    </div>
                  )}
                </div>
                <dl className="flex gap-6">
                  {kolonner.map(([etikett, verdi]) => (
                    <div key={etikett} className="min-w-[56px] text-right">
                      <dt className="text-[10px] uppercase tracking-wide text-gray-400">
                        {etikett}
                      </dt>
                      <dd className="text-sm font-medium tabular-nums text-gray-900">
                        {verdi}
                      </dd>
                    </div>
                  ))}
                </dl>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${aapen ? "rotate-180" : ""}`}
                />
              </button>

              {aapen && (
                <div className="border-t border-gray-100 p-4">
                  {renderKort(projectId)}

                  {kVarer.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {kVarer.map((v) => (
                        <li key={v.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                            {t("timer.prosjektkort.vareMerke")}
                          </span>
                          <span>
                            {v.vare.navn} · {v.antall.toLocaleString("nb-NO")} {v.vare.enhet}
                            {v.byggeplassId && byggeplassNavn.get(v.byggeplassId)
                              ? ` · ${byggeplassNavn.get(v.byggeplassId)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {erRedigerbar && (
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <button
                        type="button"
                        onClick={() => onNyTimer(projectId)}
                        className="font-medium text-sitedoc-primary hover:underline"
                      >
                        {t("timer.prosjektkort.nyTimer")}
                      </button>
                      {reiseLonnsart && (
                        <button
                          type="button"
                          onClick={() => onNyReise(projectId, reiseLonnsart)}
                          className="font-medium text-sitedoc-primary hover:underline"
                        >
                          {t("timer.prosjektkort.nyReise")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNyMaskin(projectId)}
                        className="font-medium text-sitedoc-primary hover:underline"
                      >
                        {t("timer.prosjektkort.nyMaskin")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onLeggTil(projectId)}
                        className="font-medium text-sitedoc-primary hover:underline"
                      >
                        {t("timer.prosjektkort.leggTil")}
                      </button>
                      {visVareforbrukKnapp({
                        prosjektIderMedVarelager: varelagerProsjekter,
                        projectId,
                        erRedigerbar,
                      }) && (
                        <button
                          type="button"
                          onClick={() => onNyVare(projectId)}
                          className="font-medium text-sitedoc-primary hover:underline"
                        >
                          {t("timer.prosjektkort.nyVare")}
                        </button>
                      )}
                    </div>
                  )}
                  {erRedigerbar && visReiseHint && (
                    <p className="mt-1 text-xs text-gray-500">
                      {visReiseHint === "ingen"
                        ? t("timer.prosjektkort.reiseSkjultIngen")
                        : t("timer.prosjektkort.reiseSkjultFlere")}{" "}
                      <Link
                        href="/dashbord/firma/innstillinger#reise-regelsett"
                        className="font-medium text-sitedoc-primary hover:underline"
                      >
                        {t("timer.prosjektkort.reiseVelgLonnsart")}
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {erRedigerbar && kanLeggeTilKort && (
        <button
          type="button"
          onClick={onNyttKort}
          className="mt-3 w-full rounded-lg border border-dashed border-gray-300 p-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
        >
          {t("timer.prosjektkort.nyttKort")}
        </button>
      )}

      {/* Dagens ramme — sedelens felles fra/til/pause, nedtonet. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-gray-200 px-4 py-2 text-xs text-gray-500">
        <span>
          {t("timer.prosjektkort.ramme", {
            fra: ramme.fra,
            til: ramme.til,
            pause: ramme.pauseMin,
          })}
          {pauseBaerer &&
            ` ${t("timer.prosjektkort.pauseBaeres", {
              kort: kortNavn.get(pauseBaerer.projectId) ?? "",
            })}`}
          {ramme.aktivitet && ` · ${ramme.aktivitet}`}
          {ramme.beskrivelse && ` · ${ramme.beskrivelse}`}
        </span>
        {erRedigerbar && (
          <button
            type="button"
            onClick={onEndreRamme}
            className="ml-auto font-medium text-sitedoc-primary hover:underline"
          >
            {t("handling.endre")}
          </button>
        )}
      </div>

      {/* Bunnlinje — sum i dag + innsending pr. dag. */}
      {erRedigerbar && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <span className={`h-2.5 w-2.5 rounded-full ${prikk}`} aria-hidden />
          <span className="text-sm text-gray-700">
            {t("timer.prosjektkort.sumIDag", {
              registrert: formatTimer(motNorm),
              total: normTimer === null ? "?" : formatTimer(normTimer),
            })}
            {dag.maskin > 0 &&
              ` · ${t("timer.prosjektkort.sumMaskin", { timer: formatTimer(dag.maskin) })}`}
            {dag.reise > 0 &&
              ` · ${t("timer.prosjektkort.sumReise", { timer: formatTimer(dag.reise) })}`}
          </span>
          <div className="ml-auto flex gap-2">
            {kanSlette && (
              <Button variant="secondary" onClick={onSlett} disabled={sletter}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("timer.detalj.slett")}
              </Button>
            )}
            <KnappMedForklaring
              sperret={timerRader.length === 0 && !sender}
              forklaring={t("sperret.minstEnRad")}
            >
              <Button onClick={onSend} disabled={sender || timerRader.length === 0}>
                <Send className="mr-1 h-4 w-4" />
                {/* Returnert sedel: samme tekst som dagskortets «Send på nytt». */}
                {(() => {
                  const tekst = sendDagenTekst(
                    erReturnert ? "returned" : "draft",
                    dagArbeidReise.arbeid,
                    dagArbeidReise.reise,
                  );
                  if (tekst.nokkel === "timer.detalj.sendPaaNytt") return t(tekst.nokkel);
                  if (tekst.nokkel === "timer.prosjektkort.sendDagen") {
                    return t(tekst.nokkel, { timer: formatTimer(tekst.timer) });
                  }
                  return t(tekst.nokkel, {
                    timer: formatTimer(tekst.timer),
                    reise: formatTimer(tekst.reise),
                  });
                })()}
              </Button>
            </KnappMedForklaring>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  ProsjektGruppe — én blokk per unikt projectId                       */
/*  T7-4c (2026-05-16): inneholder nå tillegg + N ECO-bukets.           */
/*  Hovedgruppe (ECO=null) vises uten subheader; ekte ECO-er får        */
/*  badge "→ Godkjenning byggherre" og navn fra eksternKostObjekt.list. */
/* ------------------------------------------------------------------ */

type EcoBucket = {
  ecoId: string | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
  // Tillegg/utlegg med dette underprosjektet. Hovedbøtta har alltid tomme
  // lister — NULL-radene vises i prosjektets egen seksjon.
  tillegg: TilleggRad[];
  utlegg: UtleggRad[];
};

function ProsjektGruppe({
  iKort,
  projectId,
  prosjektNavn,
  tillegg,
  utlegg,
  ecoBuckets,
  erRedigerbar,
  pauseMin,
  pauseVisning,
  byggeplassNavn,
  radLinje,
  onTilfoyTimer,
  onLeggTil,
  onRedigerTimer,
  onRedigerTillegg,
  onRedigerUtlegg,
  onRedigerMaskin,
  onSplittTimer,
  onSplittTillegg,
  onSplittMaskin,
}: {
  // Prosjektkort L1: innhold i et åpent kort — kortet bærer ramme, overskrift
  // og «+ Tillegg/Utlegg», så gruppa tegner bare bøttene og radene.
  iKort?: boolean;
  projectId: string;
  prosjektNavn: ProsjektRef | undefined;
  tillegg: TilleggRad[];
  utlegg: UtleggRad[];
  ecoBuckets: EcoBucket[];
  erRedigerbar: boolean;
  // D6: sedel-nivå pauseMin → maskin ≤ arbeid-buffer per bucket.
  pauseMin: number;
  // V20/PK3: pause-kontekst for rad-listas kryss-visning.
  pauseVisning: PauseVisning;
  // Ordre (10): byggeplass-id → navn for maskin-radlinja.
  byggeplassNavn: Map<string, string>;
  // V22: grunnlaget for timer-radens «Prosjekt · Byggeplass»-linje.
  radLinje: RadLinjeKontekst;
  // Bolk (d) R1: sender timer-radene i bucket slik at parent kan avlede
  // fra/til-prefill (siste rads tilTid).
  onTilfoyTimer: (ecoId: string | null, timerRaderIBucket: TimerRad[]) => void;
  // U3: unified «Legg til»-velger (tillegg + utlegg i ett).
  onLeggTil: () => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerTillegg: (rad: TilleggRad) => void;
  onRedigerUtlegg: (rad: UtleggRad) => void;
  onRedigerMaskin: (rad: MaskinRad) => void;
  // P2 (arbeider-splitt): kun kalt når erRedigerbar (knapp rendres i
  // erRedigerbar-blokk på raden).
  onSplittTimer: (rad: TimerRad) => void;
  onSplittTillegg: (rad: TilleggRad) => void;
  onSplittMaskin: (rad: MaskinRad) => void;
}) {
  const { t } = useTranslation();

  // Hent ECO-katalog for å mappe ID → kortNavn (kun for ECO-er som faktisk
  // brukes på dette prosjektet i en gruppe).
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId });
  const ecoNavnMap = new Map<string, { kortNavn: string; proAdmId: string }>(
    (ecoer ?? []).map((e) => [e.id, { kortNavn: e.kortNavn, proAdmId: e.proAdmId }]),
  );

  const Ramme = iKort ? "div" : "section";
  return (
    <Ramme
      className={
        iKort ? undefined : "mb-6 rounded-lg border border-gray-200 bg-white p-5"
      }
    >
      {!iKort && (
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-base font-semibold text-gray-900">
          {prosjektNavn?.name ?? t("timer.detalj.ukjentProsjekt")}
          {prosjektNavn?.internalProjectNumber && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({prosjektNavn.internalProjectNumber})
            </span>
          )}
        </h2>
      </div>
      )}

      {/* ECO-bukets (hoved først, deretter ECO-er) */}
      <div className="space-y-3">
        {ecoBuckets.map((bucket) => (
          <EcoGruppe
            key={bucket.ecoId ?? "hoved"}
            ecoId={bucket.ecoId}
            ecoNavn={
              bucket.ecoId
                ? ecoNavnMap.get(bucket.ecoId) ?? null
                : null
            }
            timer={bucket.timer}
            maskin={bucket.maskin}
            tillegg={bucket.tillegg}
            utlegg={bucket.utlegg}
            projectId={projectId}
            onRedigerTillegg={onRedigerTillegg}
            onRedigerUtlegg={onRedigerUtlegg}
            onSplittTillegg={onSplittTillegg}
            erRedigerbar={erRedigerbar}
            pauseMin={pauseMin}
            pauseVisning={pauseVisning}
            byggeplassNavn={byggeplassNavn}
            radLinje={radLinje}
            onTilfoyTimer={() => onTilfoyTimer(bucket.ecoId, bucket.timer)}
            onRedigerTimer={onRedigerTimer}
            onRedigerMaskin={onRedigerMaskin}
            onSplittTimer={onSplittTimer}
            onSplittMaskin={onSplittMaskin}
          />
        ))}
      </div>

      {/* Tillegg + utlegg — per-prosjekt, separat fra ECO-bukets. U3 (8a):
          ÉN «Legg til»-inngang (velger med to grupper); registrerte rader
          vises gruppert (Tillegg = lønnstillegg/sats · Utlegg = beløp/fakturert). */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {t("timer.detalj.tilleggUtlegg")}
          </h3>
          {erRedigerbar && !iKort && (
            <Button variant="secondary" onClick={onLeggTil}>
              <Plus className="mr-1 h-3 w-3" />
              {t("timer.detalj.leggTil")}
            </Button>
          )}
        </div>
        {tillegg.length === 0 &&
        utlegg.length === 0 &&
        !ecoBuckets.some((b) => b.tillegg.length > 0 || b.utlegg.length > 0) ? (
          <p className="text-sm text-gray-500">
            {t("timer.detalj.ingenTilleggUtlegg")}
          </p>
        ) : (
          <div className="space-y-3">
            {tillegg.length > 0 && (
              <RaderTillegg
                rader={tillegg}
                erRedigerbar={erRedigerbar}
                onRediger={onRedigerTillegg}
                onSplitt={onSplittTillegg}
              />
            )}
            {utlegg.length > 0 && (
              <RaderUtlegg
                rader={utlegg}
                projectId={projectId}
                erRedigerbar={erRedigerbar}
                onRediger={onRedigerUtlegg}
              />
            )}
          </div>
        )}
      </div>
    </Ramme>
  );
}

/* ------------------------------------------------------------------ */
/*  EcoGruppe — én bucket per (projectId, ECO)                          */
/*  Arbeidstimer er hovedposten; maskintimer rendres indentert under    */
/*  som visuell underpost (T.7 låst 2026-05-16). Server validerer       */
/*  sum(maskin) ≤ sum(arbeid) per bucket; UI sperrer i rad-modalen.    */
/*  Maskinlinja «Maskin X t» er nøytral (ordre (6) RETUR 1).            */
/* ------------------------------------------------------------------ */

function EcoGruppe({
  ecoId,
  ecoNavn,
  timer,
  maskin,
  tillegg,
  utlegg,
  projectId,
  onRedigerTillegg,
  onRedigerUtlegg,
  onSplittTillegg,
  erRedigerbar,
  pauseMin: _pauseMin,
  pauseVisning,
  byggeplassNavn,
  radLinje,
  onTilfoyTimer,
  onRedigerTimer,
  onRedigerMaskin,
  onSplittTimer,
  onSplittMaskin,
}: {
  ecoId: string | null;
  ecoNavn: { kortNavn: string; proAdmId: string } | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
  tillegg: TilleggRad[];
  utlegg: UtleggRad[];
  projectId: string;
  onRedigerTillegg: (rad: TilleggRad) => void;
  onRedigerUtlegg: (rad: UtleggRad) => void;
  onSplittTillegg: (rad: TilleggRad) => void;
  erRedigerbar: boolean;
  pauseMin: number;
  pauseVisning: PauseVisning;
  byggeplassNavn: Map<string, string>;
  radLinje: RadLinjeKontekst;
  onTilfoyTimer: () => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerMaskin: (rad: MaskinRad) => void;
  onSplittTimer: (rad: TimerRad) => void;
  onSplittMaskin: (rad: MaskinRad) => void;
}) {
  const { t } = useTranslation();
  // Ordre 2026-11-14 (6): arbeid og reise hver for seg. «Arbeidstimer (N t)»
  // og maskin-kontrollen bruker arbeid UTEN reise (og uten erstattede rader).
  const { arbeid: sumTimer, reise: sumReise } = arbeidOgReise(timer);
  const sumMaskin = maskin.reduce((acc, r) => acc + tilTall(r.timer), 0);
  // D6 (web-paritet): bruk delt overstigerMaskinTak MED pause-buffer — identisk
  // med attestering (`attestering-buckets.tsx`) og server.

  return (
    <div
      className={`rounded border bg-gray-50 p-3 ${
        ecoId ? "border-indigo-200" : "border-gray-200"
      }`}
    >
      {/* ECO-subheader med dokumentflyt-badge — kun ekte ECO-er */}
      {ecoId && (
        <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
          <div className="text-xs font-semibold text-gray-800">
            {ecoNavn
              ? `${ecoNavn.proAdmId} · ${ecoNavn.kortNavn}`
              : t("timer.detalj.ukjentEco")}
          </div>
          <span
            className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
            title={t("timer.gruppe.tilByggherreHint")}
          >
            → {t("timer.gruppe.tilByggherre")}
          </span>
        </div>
      )}

      {/* Arbeidstimer (hovedpost) */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.gruppe.arbeidstimer")}{" "}
            <span className="font-mono font-normal text-gray-500">
              ({sumTimer.toFixed(2)} {t("timer.timerEnhet")})
            </span>
            {sumReise > 0 && (
              <span className="ml-2 font-mono font-normal normal-case text-gray-500">
                {t("timer.gruppe.reise", { timer: sumReise.toFixed(2) })}
              </span>
            )}
          </h4>
          {erRedigerbar && (
            <Button variant="secondary" size="sm" onClick={onTilfoyTimer}>
              <Plus className="mr-1 h-3 w-3" />
              {t("timer.detalj.tilfoyTimer")}
            </Button>
          )}
        </div>
        {timer.length === 0 && maskin.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.detalj.ingenTimer")}
          </p>
        ) : (
          <>
            {timer.length > 0 && (
              <RaderTimer
                rader={timer}
                erRedigerbar={erRedigerbar}
                pauseVisning={pauseVisning}
                radLinje={radLinje}
                onRediger={onRedigerTimer}
                onSplitt={onSplittTimer}
              />
            )}
            {/* P1 (maskin-i-rad): maskin-radene står inline i samme rad-liste
                som timer-radene, med et slate «MASKIN»-merke per rad
                (RaderMaskinKompakt). Egen «Maskintimer»-underpost er fjernet. */}
            {maskin.length > 0 && (
              <RaderMaskinKompakt
                rader={maskin}
                erRedigerbar={erRedigerbar}
                byggeplassNavn={byggeplassNavn}
                onRediger={onRedigerMaskin}
                onSplitt={onSplittMaskin}
              />
            )}
          </>
        )}
      </div>

      {/* Tillegg/utlegg ført på dette underprosjektet (2026-11-13). */}
      {(tillegg.length > 0 || utlegg.length > 0) && (
        <div className="mb-3 space-y-3 border-t border-gray-200 pt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {t("timer.detalj.tilleggUtlegg")}
          </h4>
          {tillegg.length > 0 && (
            <RaderTillegg
              rader={tillegg}
              erRedigerbar={erRedigerbar}
              onRediger={onRedigerTillegg}
              onSplitt={onSplittTillegg}
            />
          )}
          {utlegg.length > 0 && (
            <RaderUtlegg
              rader={utlegg}
              projectId={projectId}
              erRedigerbar={erRedigerbar}
              onRediger={onRedigerUtlegg}
            />
          )}
        </div>
      )}

      {/* Ordre 2026-11-14 (6) + RETUR 1: «Maskin X t», alltid nøytral — ingen
          rød/grønn, ingen varseltekst. Sperren mot maskin over arbeid (uten reise)
          står i rad-modalene. */}
      {sumMaskin > 0 && (
        <div
          className="mt-3 rounded border px-3 py-1.5 text-xs font-medium border-gray-200 bg-white text-gray-700"
        >
          {t("timer.gruppe.maskin", { maskin: sumMaskin.toFixed(2) })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Definisjon — liten labelrad i dl                                    */
/* ------------------------------------------------------------------ */

function Definisjon({
  term,
  verdi,
  spann,
}: {
  term: string;
  verdi: React.ReactNode;
  spann?: number;
}) {
  return (
    <div className={spann === 2 ? "col-span-2" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {term}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{verdi}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  RaderTimer + RaderTillegg + MaskinSeksjon                           */
/* ------------------------------------------------------------------ */

function RaderTimer({
  rader,
  erRedigerbar,
  pauseVisning,
  radLinje,
  onRediger,
  onSplitt,
}: {
  rader: TimerRad[];
  erRedigerbar: boolean;
  // V20/PK3: dagens pause-kontekst → kryss/tom avkrysning pr. rad.
  pauseVisning: PauseVisning;
  radLinje: RadLinjeKontekst;
  onRediger: (rad: TimerRad) => void;
  onSplitt: (rad: TimerRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();

  const fjern = trpc.timer.dagsseddel.fjernTimerRad.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => {
        const lonnsart = lonnsarter?.find((l) => l.id === rad.lonnsartId);
        const aktivitet = aktiviteter?.find((a) => a.id === rad.aktivitetId);
        // V20/PK3: vis matpause-status på raden (også for mobil-førte rader) når
        // regelen trigger for dagen OG raden krysser lunsjvinduet — samme
        // synlighetsregel som mobilens `visPauseRad`. Bæreren (pauseMin > 0) vises
        // huket; andre kvalifiserte rader viser tom avkrysning. Les-visning;
        // redigering skjer i rad-dialogen (PK3).
        // ORDRE 2026-11-13: kan bære = spennet er lengre enn pausen; trukne
        // minutter utledes av lagret timer (spenn − timer), så gamle vindu-rader
        // vises som de ble lagret.
        const radSpennMin =
          rad.fraTid && rad.tilTid
            ? hhmmTilMin(rad.tilTid) - hhmmTilMin(rad.fraTid)
            : 0;
        const radKanBaere = radSpennMin > pauseVisning.standardPauseMin;
        const visPause =
          (pauseVisning.regelTrigget && radKanBaere) || rad.pauseMin > 0;
        const pauseTrukketMin =
          radSpennMin > 0
            ? Math.min(
                rad.pauseMin,
                Math.max(0, Math.round(radSpennMin - tilTall(rad.timer) * 60)),
              )
            : 0;
        // V22: byggeplassen står på sekundærlinja, ikke i tittelen (erstatter
        // ordre 10s « · navn» etter lønnsarten).
        const bpLinje = radByggeplassLinje({
          radByggeplassId: rad.byggeplassId ?? null,
          sedelByggeplassId: radLinje.sedelByggeplassId,
          projectId: radLinje.projectId,
          byggeplasser: radLinje.byggeplasser,
          kortModus: radLinje.kortModus,
          t,
        });
        const linjeInnhold = (
          <>
            {radLinje.prosjektNavn}
            {" · "}
            <span className={bpLinje.arvet || bpLinje.ingen ? "text-gray-400" : "text-gray-600"}>
              {bpLinje.tekst}
            </span>
          </>
        );
        return (
          <li key={rad.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {lonnsart?.navn ?? "—"}
              </p>
              <p className="text-xs text-gray-500">{aktivitet?.navn ?? "—"}</p>
              {/* Bolk (d) R2: fra–til under aktiviteten når begge er satt
                  (speiler mobil TimerRadVis). */}
              {rad.fraTid && rad.tilTid && (
                <p className="text-xs text-gray-500">
                  {rad.fraTid}–{rad.tilTid}
                </p>
              )}
              {/* V20/PK3: matpause-status (les-visning). */}
              {visPause && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                  {rad.pauseMin > 0 ? (
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-sitedoc-primary" />
                  ) : (
                    <Square className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  )}
                  {rad.pauseMin > 0
                    ? t("timer.matpause.trukket", { min: pauseTrukketMin })
                    : t("timer.matpause.trukketUmerket")}
                </p>
              )}
              {/* T.12: fritekst-beskrivelse av hva som ble gjort (speiler mobil) */}
              {rad.beskrivelse && (
                <p className="mt-0.5 text-xs italic text-gray-600">
                  {rad.beskrivelse}
                </p>
              )}
              {/* V22: «Prosjekt · Byggeplass» (speiler mobil F3). Klikk åpner
                  rad-dialogen, der byggeplass-feltet står. */}
              {erRedigerbar ? (
                <button
                  type="button"
                  onClick={() => onRediger(rad)}
                  className="mt-0.5 block text-left text-xs text-gray-500 hover:underline"
                >
                  {linjeInnhold}
                </button>
              ) : (
                <p className="mt-0.5 text-xs text-gray-500">{linjeInnhold}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {tilTall(rad.timer).toFixed(2)} {t("timer.timerEnhet")}
              </span>
              {erRedigerbar && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onRediger(rad)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("handling.rediger")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onSplitt(rad)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("timer.rediger.splittRad")}
                  >
                    <Split className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fjern.mutate({ id: rad.id })}
                    disabled={fjern.isPending}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title={t("handling.slett")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RaderTillegg({
  rader,
  erRedigerbar,
  onRediger,
  onSplitt,
}: {
  rader: TilleggRad[];
  erRedigerbar: boolean;
  onRediger: (rad: TilleggRad) => void;
  onSplitt: (rad: TilleggRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  const fjern = trpc.timer.dagsseddel.fjernTilleggRad.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => {
        const info = tilleggKatalog?.find((x) => x.id === rad.tilleggId);
        const type = info?.type ?? "antall";
        return (
          <li key={rad.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {info?.navn ?? "—"}
              </p>
              {rad.kommentar && (
                <p className="text-xs text-gray-500">{rad.kommentar}</p>
              )}
              {/* Funn #2: kvittering-vedlegg — leder kan se/forstørre/laste ned. */}
              {rad.vedlegg && rad.vedlegg.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {rad.vedlegg.map((v) => (
                    <SignertLenke
                      key={v.id}
                      url={v.fileUrl}
                      nyFane
                      title={v.fileName}
                    >
                      <SignertBilde
                        url={v.fileUrl}
                        alt={t("timer.vedlegg.tittel")}
                        className="h-14 w-14 rounded border border-gray-200 object-cover hover:opacity-80"
                      />
                    </SignertLenke>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {type === "avhuking"
                  ? tilTall(rad.antall) > 0
                    ? "✓"
                    : "—"
                  : tilTall(rad.antall).toFixed(2)}
              </span>
              {erRedigerbar && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onRediger(rad)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("handling.rediger")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onSplitt(rad)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("timer.rediger.splittRad")}
                  >
                    <Split className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fjern.mutate({ id: rad.id })}
                    disabled={fjern.isPending}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title={t("handling.slett")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * RaderMaskinKompakt — maskin-rader vist inline i EcoGruppes rad-liste (P1
 * maskin-i-rad, 2026-07): hver rad bærer et «MASKIN»-merke. Egen «Maskintimer»-
 * seksjonstittel + «+ Legg til maskin»-knapp er fjernet — ny maskin legges via
 * timerrad-dialogens valgfrie maskin-seksjon; eksisterende rader redigeres inline.
 */
function RaderMaskinKompakt({
  rader,
  erRedigerbar,
  byggeplassNavn,
  onRediger,
  onSplitt,
}: {
  rader: MaskinRad[];
  erRedigerbar: boolean;
  byggeplassNavn: Map<string, string>;
  onRediger: (rad: MaskinRad) => void;
  onSplitt: (rad: MaskinRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
      }>
    | undefined;
  // Null-vakt (2026-07-21): merke/modell er nullbare i praksis (jf. typen på
  // linje ~1535). Uten filtrering rendret raden «null null (7648 CAT 311F)» i
  // prod. Samme mønster som utstyrs-nedtrekket lenger ned i fila.
  const equipmentMap = new Map<string, string>(
    (equipment ?? []).map((e) => {
      const merkeModell = [e.merke, e.modell].filter(Boolean).join(" ");
      return [
        e.id,
        merkeModell
          ? `${merkeModell}${e.internNavn ? ` (${e.internNavn})` : ""}`
          : e.internNavn ?? "—",
      ];
    }),
  );

  const fjern = trpc.timer.dagsseddel.maskin.fjern.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });

  return (
        <ul className="divide-y divide-gray-100">
          {rader.map((rad) => (
            <li key={rad.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {/* P1 (maskin-i-rad): slate-merke skiller maskin-rader fra
                      timer-rader når de står i samme liste. */}
                  <span className="mr-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {t("timer.maskinSeksjon.merke")}
                  </span>
                  {equipmentMap.get(rad.vehicleId) ?? "—"}
                  {rad.byggeplassId && byggeplassNavn.has(rad.byggeplassId)
                    ? ` · ${byggeplassNavn.get(rad.byggeplassId)}`
                    : ""}
                </p>
                {rad.mengde !== null && rad.mengde !== undefined && (
                  <p className="text-xs text-gray-500">
                    {tilTall(rad.mengde).toFixed(2)} {rad.enhet ?? ""}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-900">
                  {tilTall(rad.timer).toFixed(2)} {t("timer.timerEnhet")}
                </span>
                {erRedigerbar && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => onRediger(rad)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title={t("handling.rediger")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onSplitt(rad)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title={t("timer.rediger.splittRad")}
                    >
                      <Split className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => fjern.mutate({ id: rad.id })}
                      disabled={fjern.isPending}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      title={t("handling.slett")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  TimerRadDialog                                                      */
/* ------------------------------------------------------------------ */

function TimerRadDialog({
  sheetId,
  organizationId,
  laastReiseLonnsart,
  projectId,
  prosjekter,
  byggeplasser,
  defaultAktivitetId,
  defaultEcoId,
  rad,
  alleTimerRader,
  laastProsjekt,
  kortNavn,
  alleMaskinRader,
  sistBrukteMaskiner,
  pauseMin,
  defaultFraTid,
  defaultTilTid,
  tidsrundingMinutter,
  skiftStart,
  standardPauseMin,
  standardPauseEtterTimer,
  pauseReferanse,
  normTimer,
  reiseKontekst,
  onLukk,
}: {
  sheetId: string;
  organizationId: string;
  projectId: string;
  prosjekter: ProsjektRef[];
  byggeplasser: readonly ByggeplassValg[] | undefined;
  defaultAktivitetId: string | null;
  defaultEcoId?: string | null;
  rad?: TimerRad;
  // P4b: alle timer-rader på sedelen — for kryss-bøtte overlapp-vakt (delt regel).
  alleTimerRader: TimerRad[];
  // Prosjektkort L1: prosjektet låst til kortets (ny rad også), og kortnavn
  // (projectId → «nr — navn») så overlapp-meldingen navngir det andre kortet.
  laastProsjekt?: boolean;
  kortNavn?: Map<string, string>;
  // P1 (maskin-i-rad): sedelens maskin-rader + sedel-pause for den valgfrie
  // maskin-seksjonen (bucket-kapasitet, speiler MaskinRadDialog).
  alleMaskinRader: MaskinRad[];
  /** ORDRE 29: egne sist brukte maskiner (nyeste først) — øverst i velgeren. */
  sistBrukteMaskiner: string[];
  pauseMin: number;
  // Bolk (d) R1: prefill fra/til ved ny rad. R4: T.5-runding ved commit.
  defaultFraTid?: string | null;
  defaultTilTid?: string | null;
  tidsrundingMinutter?: number | null;
  // D3: pausevindu-parametre for fra/til ↔ antall-synk.
  skiftStart: string;
  standardPauseMin: number;
  standardPauseEtterTimer: number;
  // V20/PK5: pausereferanse for dagen — «ankomst» regner vinduet fra tidligste
  // rad-fraTid, «fastStart» fra skiftstart. Må matche serverens vindu, ellers
  // avviser den interaktive PK4-vakten.
  pauseReferanse: "fastStart" | "ankomst";
  // V21: firmaets dagsnorm for datoen (null = ikke lastet → ingen forslag) og
  // reise-kontekst (reise er aldri overtid).
  normTimer: number | null;
  reiseKontekst: ErReiseKontekst;
  /** Ordre 2026-11-14 (6): «+ Reise» — lønnsarten er låst, raden får
   *  reiseKilde «manuell». Kun ved ny rad. */
  laastReiseLonnsart?: { id: string; navn: string };
  onLukk: () => void;
}) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const reiseModus = !rad && !!laastReiseLonnsart;
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();

  // ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer»: pausepunktet for
  // kandidat-spennet = der summert arbeid (sedelens rader før + raden) passerer
  // firmaets grense; «fastStart» bruker fast klokkeslett når det ligger i raden.
  // Samme delte `pauseFraForRad` som mobil og serveren. Andre rader = alle
  // unntatt den som redigeres.
  const andreRaderFraTid = alleTimerRader
    .filter((r) => r.id !== rad?.id)
    .map((r) => ({ fraTid: r.fraTid, tilTid: r.tilTid, erReise: r.erReise ?? false }));
  const fastPauseFra = fastPauseFraFor({
    startTid: skiftStart,
    pauseEtterTimer: standardPauseEtterTimer,
    pauseReferanse,
  });
  function beregnPauseFra(kFra: string | null, kTil: string | null): string {
    if (!kFra) return "00:00";
    return pauseFraForRad({
      fraTid: kFra,
      tilTid: kTil ?? kFra,
      andreRader: andreRaderFraTid,
      pauseEtterTimer: standardPauseEtterTimer,
      pauseMin: standardPauseMin,
      fastPauseFra,
    });
  }

  // V20/PK2: snapshot av sedelens rader (id + spenn + pause) for auto-bærer-
  // avgjørelsen (delt `avgjorRadPauseMin`). Bæreren = den ENE raden pr. dag som
  // krysser pausevinduet; returnerer `standardPauseMin` når regelen trigger og
  // ingen annen rad alt bærer, ellers 0.
  const alleRaderForPause = alleTimerRader.map((r) => ({
    id: r.id,
    fraTid: r.fraTid,
    tilTid: r.tilTid,
    pauseMin: r.pauseMin,
    erReise: r.erReise ?? false,
  }));
  function beregnAutoPause(kFra: string | null, kTil: string | null): number {
    return avgjorRadPauseMin({
      alleRader: alleRaderForPause,
      radId: rad?.id ?? null,
      fraTid: kFra,
      tilTid: kTil,
      standardPauseMin,
      pauseEtterTimer: standardPauseEtterTimer,
      fastPauseFra,
    });
  }

  // D2 (web-paritet): prosjekt velges i modalen (som mobil). Ved NY rad kan den
  // endres (raden opprettes under valgt prosjekt); ved redigering er den låst —
  // server-oppdaterTimerRad flytter ikke rad mellom prosjekter (egen oppfølger).
  const [valgtProjectId, setValgtProjectId] = useState<string>(
    rad?.projectId ?? projectId,
  );
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({
    projectId: valgtProjectId,
  });
  // Ordre (10): følger valgt prosjekt — prosjektbytte nullstiller ugyldig valg.
  const bp = useRadByggeplass({ byggeplasser, projectId: valgtProjectId, rad });

  // T.10 / §2.D: maskinvelger for kostnadsbærer ved maskinvedlikehold. Hentes
  // kun for interne prosjekter (verksted). Tom liste / inaktiv maskin-modul →
  // feltet skjules. Org-validering håndheves uansett på server.
  const erInternt =
    prosjekter.find((p) => p.id === valgtProjectId)?.type === "internt";
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery(undefined, {
    enabled: erInternt,
  });
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string | null; modell: string | null; internNavn: string | null }>
    | undefined;

  // V1c: ved NY rad (ingen forrige å arve fra) prefylles firma-default lønnsart
  // (Lonnsart.erStandardvalg) i stedet for tomt felt. Redigering av eksisterende
  // rad beholder radens lønnsart. Dekker cache-treff her; async-lasting i effekt
  // under (lonnsarter kan være uhentet ved mount).
  const [lonnsartId, setLonnsartId] = useState<string>(
    rad?.lonnsartId ??
      laastReiseLonnsart?.id ??
      lonnsarter?.find((l) => l.erStandardvalg)?.id ??
      "",
  );
  useEffect(() => {
    if (!rad && !lonnsartId) {
      const standard = lonnsarter?.find((l) => l.erStandardvalg)?.id;
      if (standard) setLonnsartId(standard);
    }
  }, [rad, lonnsartId, lonnsarter]);
  const [aktivitetId, setAktivitetId] = useState<string>(
    rad?.aktivitetId ?? defaultAktivitetId ?? "",
  );
  // Bolk (g): prefill er kun gyldig når begge tider finnes OG fra < til. Er
  // beregnet fra ≥ til (f.eks. forrige rad sluttet etter skiftslutt), forhånds-
  // utfyller vi verken til eller antall — tomme felt slår en ugyldig rad.
  const prefillGyldig =
    !!defaultFraTid &&
    !!defaultTilTid &&
    hhmmTilMin(defaultFraTid) < hhmmTilMin(defaultTilTid);
  const [timer, setTimer] = useState<string>(() => {
    if (rad) return String(tilTall(rad.timer));
    // B3: init antall fra prefill-spennet (pause-bevisst) — kun ved gyldig
    // prefill; ellers tom (ingen 0-rad). V20/PK1+PK2: pausen er radens
    // auto-bærer-avgjørelse, ikke firma-default/hodet.
    if (prefillGyldig) {
      const pf = beregnPauseFra(defaultFraTid!, defaultTilTid!);
      const pm = beregnAutoPause(defaultFraTid!, defaultTilTid!);
      return String(effektiveTimerFraSpenn(defaultFraTid!, defaultTilTid!, pf, pm));
    }
    return "";
  });
  // T7-4c: defaultEcoId pre-selekteres når bruker klikker "+Legg til timer"
  // i en spesifikk ECO-gruppe (eks. ECO «Mur øst»). Ved redigering brukes
  // radens egen ECO.
  const [ecoId, setEcoId] = useState<string | null>(
    rad?.externalCostObjectId ?? defaultEcoId ?? null,
  );
  // T.10: kostnadsbærer for maskinvedlikehold (kun interne prosjekter).
  const [vehicleId, setVehicleId] = useState<string | null>(
    rad?.vehicleId ?? null,
  );
  // T.12: fritekst per rad — «hva gjorde du?» (valgfritt). Speiler mobil.
  const [beskrivelse, setBeskrivelse] = useState<string>(
    rad?.beskrivelse ?? "",
  );
  // D2/D3: per-rad fra/til med pause-bevisst auto-synk mot antall (som mobil).
  // Bolk (d) R1: ny rad prefylles fra defaultFraTid/Til; redigering bruker
  // radens egne verdier.
  const [fraTid, setFraTid] = useState<string>(rad?.fraTid ?? defaultFraTid ?? "");
  // Bolk (g): til prefylles kun ved gyldig prefill (fra < til). Ellers tom.
  const [tilTid, setTilTid] = useState<string>(
    rad?.tilTid ?? (prefillGyldig ? defaultTilTid! : ""),
  );
  // V20/PK3: brukerens overstyring av matpause-avkrysningen. `null` = følg
  // auto-bæreren (PK2); et tall (0 / standardPauseMin) = bruker har huket av/på
  // selv. Ved redigering starter den fra radens lagrede tilstand, så krysset
  // speiler det faktiske fradraget fra første render.
  const [pauseOverstyrt, setPauseOverstyrt] = useState<number | null>(
    rad ? (rad.pauseMin > 0 ? standardPauseMin : 0) : null,
  );
  const [feil, setFeil] = useState<string | null>(null);

  // P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon — kun ved NY rad.
  // Utstyrslisten hentes ufiltrert (full shape m/ internNummer + kategori for
  // MaskinVelger), speiler MaskinRadDialogs equipment-query.
  const { data: maskinEquipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const maskinEquipment = maskinEquipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
      }>
    | undefined;
  // Speiler resolveren: maskin-modulens firmatak (ingen prosjektId → firmatak
  // alene; dagsseddelen spenner over prosjekter og kan være internt, så prosjekt-
  // scoping ville skjult seksjonen feil). equipment.list gates ALDRI (designlås 1)
  // — dette er en VISNINGS-sjekk i UI, ikke en gate på katalogen.
  const { data: maskinModulTilstand } = trpc.modul.effektivTilstand.useQuery(
    { firmaId: organizationId, slugs: ["maskin"] },
    { enabled: !!organizationId },
  );
  const maskinAktiv = maskinModulTilstand?.maskin === true;
  const [visMaskin, setVisMaskin] = useState(false);
  const [maskinVehicleId, setMaskinVehicleId] = useState<string>("");
  const [maskinMengde, setMaskinMengde] = useState<string>("");
  const [maskinEnhet, setMaskinEnhet] = useState<string>("");

  // ORDRE 2026-11-13: pausepunktet for GJELDENDE fra/til.
  const pauseFra = useMemo(
    () => beregnPauseFra(fraTid || null, tilTid || null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fraTid, tilTid, alleTimerRader, rad?.id, skiftStart, standardPauseEtterTimer, pauseReferanse, standardPauseMin],
  );

  // V20/PK2: auto-bærer-avgjørelse for gjeldende fra/til. radPauseMin =
  // brukerens overstyring hvis satt, ellers auto. ÉN verdi driver timetallet
  // (PK1) og avkrysningen — aldri firma-default eller hodet.
  const autoPauseMin = useMemo(
    () => (fraTid && tilTid ? beregnAutoPause(fraTid, tilTid) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fraTid, tilTid, alleTimerRader, rad?.id, standardPauseMin, standardPauseEtterTimer, fastPauseFra],
  );
  const radPauseMin = pauseOverstyrt ?? autoPauseMin;

  // R4 (T.5): tving picker-steg ≤ 30 min så minutt-selektoren vises selv ved
  // 60-min-runding (Chrome skjuler minutter ved step=3600). Default 15 min.
  const timeStep = Math.min((tidsrundingMinutter ?? 15) * 60, 1800);

  // R3-transparens: hvor mange minutter pause raden faktisk absorberer
  // (0 = ingen). Speiler mobilens pauseOverlapp — bruker radens egen pause.
  const pauseOverlapp = useMemo(() => {
    if (!fraTid || !tilTid) return 0;
    const fm = hhmmTilMin(fraTid);
    const tm = hhmmTilMin(tilTid);
    if (tm <= fm) return 0;
    return pauseOverlappMin(fm, tm, hhmmTilMin(pauseFra), radPauseMin);
  }, [fraTid, tilTid, pauseFra, radPauseMin]);

  // V20/PK3: avkrysningen vises kun når matpause-regelen trigger for dagen
  // (dagsbrutto inkl. denne raden > 5,5 t) OG raden kan bære pausen (spennet er
  // lengre enn pausen — ORDRE 2026-11-13, samme som mobilens `radKanBaerePause`).
  // `pauseTrukketMin` er de FAKTISK trukne minuttene.
  const dagKrysserPause = useMemo(() => {
    if (!fraTid || !tilTid) return false;
    return hhmmTilMin(tilTid) - hhmmTilMin(fraTid) > standardPauseMin;
  }, [fraTid, tilTid, standardPauseMin]);
  const pauseRegelTrigget = useMemo(() => {
    const spenn = (r: { fraTid: string | null; tilTid: string | null }) =>
      r.fraTid && r.tilTid
        ? Math.max(0, hhmmTilMin(r.tilTid) - hhmmTilMin(r.fraTid)) / 60
        : 0;
    const brutto =
      andreRaderFraTid.length === 0
        ? 0
        : alleTimerRader
            .filter((r) => r.id !== rad?.id)
            .reduce((sum, r) => sum + spenn(r), 0);
    const denne = fraTid && tilTid ? spenn({ fraTid, tilTid }) : 0;
    return pauseMinForDag(brutto + denne, standardPauseMin) > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fraTid, tilTid, alleTimerRader, rad?.id, standardPauseMin]);
  const visPauseRad = pauseRegelTrigget && dagKrysserPause;
  // Kun-én-pr.-dag: en ANNEN rad bærer alt pausen (web redigerer én rad av
  // gangen, så vi kan ikke flytte bæreren i samme skriving — da låses krysset).
  const annenRadBaerer = alleTimerRader.some(
    (r) => r.id !== rad?.id && r.pauseMin > 0,
  );
  const pauseTrukketMin =
    fraTid && tilTid
      ? pauseOverlappMin(
          hhmmTilMin(fraTid),
          hhmmTilMin(tilTid),
          hhmmTilMin(pauseFra),
          radPauseMin,
        )
      : 0;

  function toggleMatpause() {
    const ny = radPauseMin > 0 ? 0 : standardPauseMin;
    setPauseOverstyrt(ny);
    if (fraTid && tilTid) {
      setTimer(String(effektiveTimerFraSpenn(fraTid, tilTid, pauseFra, ny)));
    }
  }

  // P1 (maskin-i-rad): bucket-kapasitet for den valgfrie maskin-seksjonen.
  // Samme (projectId, ECO)-bøtte-regel som MaskinRadDialog — arbeidSum og
  // maskin-sum for gjeldende (valgtProjectId, ecoId), ledig via delt regel.
  const maskinKapasitet = useMemo(() => {
    const iBucket = (r: {
      projectId: string;
      externalCostObjectId: string | null;
    }) =>
      r.projectId === valgtProjectId &&
      (r.externalCostObjectId ?? null) === (ecoId ?? null);
    // Ordre 2026-11-14 (6): maskin måles mot arbeid UTEN reise og uten
    // erstattede rader (delt regel).
    const arbeidSum = arbeidUtenReise(alleTimerRader.filter(iBucket));
    const sumMaskin = alleMaskinRader
      .filter(iBucket)
      .reduce((acc, r) => acc + tilTall(r.timer), 0);
    const { ledig } = maskinBucketKapasitet({
      arbeidSum,
      sumMaskinEksisterende: sumMaskin,
      pauseMin,
    });
    return { arbeidSum, sumMaskin, ledig };
  }, [alleTimerRader, alleMaskinRader, valgtProjectId, ecoId, pauseMin]);

  // Sist-rørte felt vinner (mobil-atferd): endrer fra/til → regn antall;
  // skriver antall → regn til (pausevinduet skyves inn ved lunsj-kryssing).
  // R4: rund fra/til via rundTilNarmeste ved commit (samme punkt som mobilens
  // FraTilTidFelt.commit).
  function endreFra(v: string) {
    const r = rundTilNarmeste(v, tidsrundingMinutter ?? null);
    setFraTid(r);
    if (r && tilTid) {
      // PK5: vinduet kan flytte seg (ankomst). PK1/PK2: pause = overstyring
      // eller auto-bærer for det NYE spennet.
      const pf = beregnPauseFra(r, tilTid);
      const pm = pauseOverstyrt ?? beregnAutoPause(r, tilTid);
      setTimer(String(effektiveTimerFraSpenn(r, tilTid, pf, pm)));
    }
  }
  function endreTil(v: string) {
    const r = rundTilNarmeste(v, tidsrundingMinutter ?? null);
    setTilTid(r);
    if (fraTid && r) {
      const pf = beregnPauseFra(fraTid, r);
      const pm = pauseOverstyrt ?? beregnAutoPause(fraTid, r);
      setTimer(String(effektiveTimerFraSpenn(fraTid, r, pf, pm)));
    }
  }
  function endreTimer(v: string) {
    setTimer(v);
    const n = parseFloat(v);
    if (fraTid && !isNaN(n) && n > 0) {
      // Antall er autoritativt → utled til-tid med gjeldende pause (radens).
      // ORDRE 2026-11-13: pausen ligger alltid i bærer-raden → til = fra +
      // antall + pause (pausepunkt = fra gjør at hele pausen legges til).
      setTilTid(tilFraAntall(fraTid, n, fraTid, radPauseMin));
    }
  }

  // P1 (maskin-i-rad): onSuccess håndteres per-kall i handleSubmit (dual-mutasjon
  // fanger tNum + maskin-verdiene i closure). Hook-nivå gjør kun feilhåndtering.
  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // P1 (maskin-i-rad): valgfri maskin-rad lagres etter timer-raden. Speiler
  // MaskinRadDialogs tilfoy — invalidér + lukk i onSuccess.
  const maskinTilfoy = trpc.timer.dagsseddel.maskin.tilfoy.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const oppdater = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  // V21: første kall i overtid-delingen (normal-delen av en eksisterende rad).
  // Lukker IKKE — andre kall (overtid-delen) følger i `brukOvertidForslag`.
  const oppdaterDel = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // V21: overtidsforslag for DENNE raden — de andre radene på sedelen + dialogens
  // gjeldende verdier, delt regel (`foreslaOvertidSplitt`). Kun et forslag; ingenting
  // skrives før brukeren trykker knappen.
  const overtidForslag = useMemo(() => {
    if (!lonnsarter || !fraTid || !tilTid) return null;
    const nivaaFor = (id: string) =>
      lonnsarter.find((l) => l.id === id)?.overtidsnivaa ?? null;
    const egenId = rad?.id ?? "__ny__";
    const egenNavn = lonnsarter.find((l) => l.id === lonnsartId)?.navn ?? "";
    const rader = [
      ...alleTimerRader
        .filter((r) => r.id !== rad?.id)
        .map((r) => ({
          id: r.id,
          fraTid: r.fraTid,
          tilTid: r.tilTid,
          pauseMin: r.pauseMin,
          erReise: r.erReise ?? false,
          overtidsnivaa: nivaaFor(r.lonnsartId),
        })),
      {
        id: egenId,
        fraTid,
        tilTid,
        pauseMin: radPauseMin,
        erReise:
          !!lonnsartId && erReiseLonnsart(lonnsartId, egenNavn, reiseKontekst),
        overtidsnivaa: lonnsartId ? nivaaFor(lonnsartId) : null,
      },
    ];
    return (
      foreslaOvertidSplitt(rader, normTimer, lonnsarter, {
        pauseFra: (r) =>
          r.id === egenId
            ? pauseFra
            : r.fraTid && r.tilTid
              ? pauseFraForRad({
                  fraTid: r.fraTid,
                  tilTid: r.tilTid,
                  andreRader: rader.filter((a) => a.id !== r.id),
                  pauseEtterTimer: standardPauseEtterTimer,
                  pauseMin: r.pauseMin,
                  fastPauseFra,
                })
              : "00:00",
      }).find(
        (f) => f.radId === egenId,
      ) ?? null
    );
  }, [
    lonnsarter,
    fraTid,
    tilTid,
    rad?.id,
    lonnsartId,
    alleTimerRader,
    radPauseMin,
    reiseKontekst,
    normTimer,
    pauseFra,
    standardPauseEtterTimer,
    fastPauseFra,
  ]);
  const formaterT = (n: number) =>
    n.toLocaleString(i18n.language, { maximumFractionDigits: 2 });
  const lonnsartNavn = (id: string) =>
    lonnsarter?.find((l) => l.id === id)?.navn ?? "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tNum = validerSkjema();
    if (tNum == null) return;
    lagreRad(tNum, lonnsartId);
  }

  // V21: knappen i forslagslinja. Hel rad over normen → vanlig lagring med
  // overtid-lønnsarten. Krysser normen → to kall: normal-delen (oppdater/tilføy),
  // så overtid-delen (tilføy). Feiler kall 2, står raden forkortet og dialogen
  // viser feilen (kjent begrensning, timer.md § V21).
  async function brukOvertidForslag(
    f: OvertidForslag<{ id: string }>,
  ): Promise<void> {
    const tNum = validerSkjema();
    if (tNum == null) return;
    if (!f.normal) {
      lagreRad(tNum, f.overtidLonnsart.id);
      return;
    }
    const felles = {
      aktivitetId,
      externalCostObjectId: ecoId,
      vehicleId: erInternt ? vehicleId : null,
      beskrivelse: beskrivelse.trim() || null,
    };
    try {
      if (rad) {
        await oppdaterDel.mutateAsync({
          id: rad.id,
          ...felles,
          lonnsartId,
          ...f.normal,
          ...byggeplassPayload(bp),
        });
      } else {
        await tilfoy.mutateAsync({
          sheetId,
          projectId: valgtProjectId,
          ...felles,
          lonnsartId,
          ...f.normal,
          byggeplassId: bp.byggeplassId,
        });
      }
      await tilfoy.mutateAsync({
        sheetId,
        projectId: valgtProjectId,
        ...felles,
        lonnsartId: f.overtidLonnsart.id,
        ...f.overtid,
        // Ny rad: dialogens byggeplass (uendret = radens egen) — samme som normal-delen.
        byggeplassId: bp.byggeplassId,
      });
    } catch {
      // Hook-nivå onError har satt feilen; vis det som faktisk ble lagret.
      utils.timer.dagsseddel.hentMedId.invalidate();
      return;
    }
    utils.timer.dagsseddel.hentMedId.invalidate();
    if (!rad && maskinVehicleId) {
      maskinTilfoy.mutate({
        sheetId,
        projectId: valgtProjectId,
        externalCostObjectId: ecoId,
        vehicleId: maskinVehicleId,
        timer: tNum,
        byggeplassId: bp.byggeplassId,
        mengde: maskinMengde ? parseFloat(maskinMengde) : null,
        enhet: maskinEnhet || null,
        fraTid: fraTid || null,
        tilTid: tilTid || null,
      });
    } else {
      onLukk();
    }
  }

  // Felles skjema-validering (lagre + overtidsforslag). Returnerer antall timer,
  // eller null når feilen er satt.
  function validerSkjema(): number | null {
    setFeil(null);
    // Fra/til obligatorisk på timer-rader (2026-07-13) — reverserer a2. Sjekkes
    // FØR de andre valideringene (tid-løse rader er ufullstendige lønnsdata).
    if (!fraTid || !tilTid) {
      setFeil(t("timer.feil.fraTilPaakrevd"));
      return null;
    }
    const tNum = parseFloat(timer);
    if (!lonnsartId || !aktivitetId || isNaN(tNum) || tNum <= 0 || tNum > 24) {
      setFeil(t("timer.feil.ugyldigInput"));
      return null;
    }
    // Pause-synk-sikkerhetsnett (paritet m/ mobil TimerSeksjon.tsx:681). Krev
    // FØRST til > fra (bolk (g): lukker 0==0-hullet der fra≥til gir forventet=0
    // og en 0-rad ellers slipper gjennom). Så: antall == spenn − pause.
    if (fraTid && tilTid) {
      if (hhmmTilMin(tilTid) <= hhmmTilMin(fraTid)) {
        setFeil(t("timer.feil.sluttForStart"));
        return null;
      }
      // P4b: kryss-bøtte overlapp-vakt (paritet m/ mobil TimerSeksjon + server).
      // Én arbeider kan ikke være to steder samtidig — sjekk mot alle andre
      // rader på sedelen (unntatt raden som redigeres). Delt @sitedoc/shared-regel.
      const andreRader = alleTimerRader.filter((r) => r.id !== rad?.id);
      const overlapp = finnOverlappendeTidsrom(fraTid, tilTid, andreRader);
      if (overlapp) {
        setFeil(
          kortNavn
            ? t("timer.feil.overlappKort", {
                fra: fraTid,
                til: tilTid,
                annenFra: overlapp.fraTid,
                annenTil: overlapp.tilTid,
                kort: kortNavn.get(overlapp.projectId) ?? "",
              })
            : t("timer.feil.overlapp", {
                fra: fraTid,
                til: tilTid,
                annenFra: overlapp.fraTid,
                annenTil: overlapp.tilTid,
              }),
        );
        return null;
      }
      const forventet = effektiveTimerFraSpenn(
        fraTid,
        tilTid,
        pauseFra,
        radPauseMin,
      );
      if (Math.abs(forventet - tNum) > 0.01) {
        setFeil(t("timer.feil.timerAvvik", { forventet: forventet.toFixed(2) }));
        return null;
      }
    }
    return tNum;
  }

  // Vanlig lagring av raden (uendret sti); V21 sender inn overtid-lønnsarten
  // når hele raden ligger over dagsnormen.
  function lagreRad(tNum: number, lagreLonnsartId: string) {
    if (rad) {
      oppdater.mutate({
        id: rad.id,
        lonnsartId: lagreLonnsartId,
        aktivitetId,
        timer: tNum,
        externalCostObjectId: ecoId,
        // Send alltid (kan nullstilles); ignoreres for ikke-interne prosjekter.
        vehicleId: erInternt ? vehicleId : null,
        beskrivelse: beskrivelse.trim() || null,
        fraTid: fraTid || null,
        tilTid: tilTid || null,
        // V20/PK3: radens matpause — server validerer timetallet mot denne.
        pauseMin: radPauseMin,
        // Ordre (10): kun ved endring — mobilens byggeplass overskrives ikke.
        ...byggeplassPayload(bp),
      });
    } else {
      // P1 (maskin-i-rad): dual-mutasjon. Per-kall onSuccess fanger tNum +
      // maskin-verdiene i closure. Er maskin valgt: lagre maskin-rad med
      // timer = timerradens tNum (herav-semantikk) og lukk i DENS onSuccess;
      // ellers lukk direkte.
      tilfoy.mutate(
        {
          sheetId,
          projectId: valgtProjectId,
          lonnsartId: lagreLonnsartId,
          aktivitetId,
          timer: tNum,
          externalCostObjectId: ecoId,
          vehicleId: erInternt ? vehicleId : null,
          beskrivelse: beskrivelse.trim() || null,
          fraTid: fraTid || null,
          tilTid: tilTid || null,
          // V20/PK3: radens matpause (auto-bærer for ny rad, PK2).
          pauseMin: radPauseMin,
          byggeplassId: bp.byggeplassId,
          ...(reiseModus && lagreLonnsartId === laastReiseLonnsart?.id
            ? { reiseKilde: "manuell" as const }
            : {}),
        },
        {
          onSuccess: () => {
            utils.timer.dagsseddel.hentMedId.invalidate();
            if (maskinVehicleId) {
              maskinTilfoy.mutate({
                sheetId,
                projectId: valgtProjectId,
                externalCostObjectId: ecoId,
                vehicleId: maskinVehicleId,
                timer: tNum,
                byggeplassId: bp.byggeplassId,
                mengde: maskinMengde ? parseFloat(maskinMengde) : null,
                enhet: maskinEnhet || null,
                fraTid: fraTid || null,
                tilTid: tilTid || null,
              });
            } else {
              onLukk();
            }
          },
        },
      );
    }
  }

  const lagrer =
    tilfoy.isPending ||
    oppdater.isPending ||
    oppdaterDel.isPending ||
    maskinTilfoy.isPending;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={
        rad
          ? t("timer.detalj.redigerTimerRad")
          : reiseModus
            ? t("timer.prosjektkort.nyReise")
            : t("timer.detalj.tilfoyTimer")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* D2: prosjekt i modalen (mobil-paritet). Låst ved redigering. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")}
          </label>
          <select
            value={valgtProjectId}
            onChange={(e) => {
              setValgtProjectId(e.target.value);
              setEcoId(null); // ECO tilhører gammelt prosjekt
            }}
            disabled={!!rad || !!laastProsjekt}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
            required
          >
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.internalProjectNumber ? `${p.internalProjectNumber} — ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <RadByggeplassFelt
          kandidater={bp.kandidater}
          verdi={bp.byggeplassId}
          onEndre={bp.setByggeplassId}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.timer.fane.lonnsarter")}
          </label>
          {reiseModus ? (
            // «+ Reise»: lønnsarten er låst til den løste reise-lønnsarten.
            <div className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {laastReiseLonnsart?.navn}
            </div>
          ) : (
          <select
            value={lonnsartId}
            onChange={(e) => setLonnsartId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgLonnsart")}</option>
            {lonnsarter?.map((l) => (
              <option key={l.id} value={l.id} disabled={!l.aktiv}>
                {l.navn}
              </option>
            ))}
          </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.aktivitet")}
          </label>
          <select
            value={aktivitetId}
            onChange={(e) => setAktivitetId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgAktivitet")}</option>
            {aktiviteter?.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.aktiv}>
                {a.navn}
              </option>
            ))}
          </select>
        </div>
        {/* D2/D3: fra/til med pause-bevisst auto-synk mot antall (mobil-paritet).
            Fra/til er obligatorisk på timer-rader (2026-07-13) — reverserer a2. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.startTid")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="time"
              step={timeStep}
              value={fraTid}
              onChange={(e) => endreFra(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.sluttTid")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Input
              type="time"
              step={timeStep}
              value={tilTid}
              onChange={(e) => endreTil(e.target.value)}
            />
          </div>
        </div>
        {/* R3-transparens: hvor mange minutter lunsjpause raden trekker fra. */}
        {pauseOverlapp > 0 && (
          <p className="-mt-2 text-xs text-gray-500">
            {t("timer.pauseFradrag", { min: pauseOverlapp })}
          </p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.antallTimer")}
          </label>
          <Input
            type="number"
            step="0.25"
            min={0}
            max={24}
            value={timer}
            onChange={(e) => endreTimer(e.target.value)}
            autoFocus
            required
          />
        </div>
        {/* V20/PK3: matpause-avkrysning — samme regel + tekstnøkkel som mobil.
            Vises når dag > 5,5 t OG raden krysser lunsjvinduet. Huket = raden
            bærer dagens pause (timetallet er trukket). Deaktivert når en annen
            rad alt bærer (kun-én-pr.-dag; flytt ved å fjerne krysset der først). */}
        {visPauseRad && (
          <button
            type="button"
            onClick={toggleMatpause}
            disabled={radPauseMin === 0 && annenRadBaerer}
            className="flex w-full items-center gap-2 rounded border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            title={
              radPauseMin === 0 && annenRadBaerer
                ? t("timer.matpause.annenRadBaerer")
                : undefined
            }
          >
            {radPauseMin > 0 ? (
              <CheckSquare className="h-5 w-5 shrink-0 text-sitedoc-primary" />
            ) : (
              <Square className="h-5 w-5 shrink-0 text-gray-400" />
            )}
            <span
              className={`text-sm ${radPauseMin > 0 ? "text-gray-700" : "text-gray-500"}`}
            >
              {radPauseMin > 0
                ? t("timer.matpause.trukket", { min: pauseTrukketMin })
                : t("timer.matpause.trukketUmerket")}
            </span>
          </button>
        )}
        {/* V21: overtidsforslag — én linje, én knapp. Vises kun når raden (eller
            dagen) passerer dagsnormen og firmaet har en overtid-lønnsart. */}
        {overtidForslag && (
          <div className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-sm text-amber-900">
              {overtidForslag.normal
                ? t("timer.overtidForslag.splitt", {
                    over: formaterT(overtidForslag.overTimer),
                    normalNavn: lonnsartNavn(lonnsartId),
                    nFra: overtidForslag.normal.fraTid,
                    nTil: overtidForslag.normal.tilTid,
                    otNavn: overtidForslag.overtidLonnsart.navn,
                    oFra: overtidForslag.overtid.fraTid,
                    oTil: overtidForslag.overtid.tilTid,
                  })
                : t("timer.overtidForslag.helRad", {
                    over: formaterT(overtidForslag.overTimer),
                    otNavn: overtidForslag.overtidLonnsart.navn,
                  })}
            </span>
            <button
              type="button"
              onClick={() => void brukOvertidForslag(overtidForslag)}
              disabled={lagrer}
              className="shrink-0 rounded border border-amber-300 bg-white px-3 py-1 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {overtidForslag.normal
                ? t("timer.overtidForslag.delKnapp")
                : t("timer.overtidForslag.helKnapp")}
            </button>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.underprosjekt")}{" "}
            <span className="text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={ecoId ?? ""}
              onChange={(e) => setEcoId(e.target.value || null)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ecoer?.map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.proAdmId} — {eco.kortNavn}
                </option>
              ))}
            </select>
            {ecoId && (
              <button
                type="button"
                onClick={() => setEcoId(null)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title={t("handling.fjern")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {/* T.10: maskinvedlikehold-kostnadsbærer — kun interne prosjekter med
            maskiner i firmaets register. */}
        {erInternt && equipment && equipment.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.maskin")}{" "}
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            </label>
            <div className="flex items-center gap-2">
              <select
                value={vehicleId ?? ""}
                onChange={(e) => setVehicleId(e.target.value || null)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {equipment.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.internNavn ?? [m.merke, m.modell].filter(Boolean).join(" ")}
                  </option>
                ))}
              </select>
              {vehicleId && (
                <button
                  type="button"
                  onClick={() => setVehicleId(null)}
                  className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  title={t("handling.fjern")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        {/* T.12: fritekst per rad — «hva gjorde du?» (valgfritt). Speiler mobil. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.radBeskrivelse")}{" "}
            <span className="text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            placeholder={t("timer.radBeskrivelsePlaceholder")}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {/* P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon — kun ved NY rad.
            Maskintimer settes lik timer-radens antall; kortere drift redigeres
            på maskin-raden etterpå. Speiler resolveren (maskinAktiv) + tom-liste-
            sjekk, samme mønster som kostnadsbærer-feltet over (:2066). */}
        {!rad && !reiseModus && maskinAktiv && maskinEquipment && maskinEquipment.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setVisMaskin((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  {t("timer.maskinSeksjon.merke")}
                </span>
                {t("timer.maskinSeksjon.tittel")}
              </span>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                  visMaskin ? "rotate-180" : ""
                }`}
              />
            </button>
            {visMaskin && (
              <div className="space-y-3 border-t border-gray-200 p-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("timer.felt.utstyr")}
                  </label>
                  <MaskinVelger
                    utstyr={maskinEquipment ?? []}
                    valgtId={maskinVehicleId}
                    onVelg={setMaskinVehicleId}
                    bruktPaaSeddel={alleMaskinRader.map((m) => m.vehicleId)}
                    sistBrukt={sistBrukteMaskiner}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("timer.felt.mengde")}{" "}
                      <span className="text-xs text-gray-400">
                        ({t("label.valgfritt")})
                      </span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={maskinMengde}
                      onChange={(e) => setMaskinMengde(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t("timer.felt.enhet")}
                    </label>
                    <select
                      value={maskinEnhet}
                      onChange={(e) => setMaskinEnhet(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {ENHETER.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {t("timer.maskinSeksjon.kapasitet", {
                    arbeid: maskinKapasitet.arbeidSum.toFixed(2),
                    maskin: maskinKapasitet.sumMaskin.toFixed(2),
                    ledig: maskinKapasitet.ledig.toFixed(2),
                  })}
                </p>
                <p className="text-xs text-gray-400">
                  {t("timer.maskinSeksjon.hint")}
                </p>
              </div>
            )}
          </div>
        )}
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring
            sperret={
              (!lonnsartId || !aktivitetId || !timer || !fraTid || !tilTid) && !lagrer
            }
            forklaring={t("sperret.timerRad")}
          >
            <Button
              type="submit"
              disabled={
                lagrer ||
                !lonnsartId ||
                !aktivitetId ||
                !timer ||
                // Fra/til obligatorisk på timer-rader (2026-07-13) — reverserer a2.
                !fraTid ||
                !tilTid
              }
            >
              {lagrer ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TilleggRadDialog                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Tillegg/utlegg: byggeplass + underprosjekt pr. rad (2026-11-13)     */
/*  Ny rad: byggeplass forhåndsvelges som på timer-raden; underprosjekt */
/*  tomt. Redigering: feltene sendes bare når de er endret, så en rad   */
/*  ført på mobil (eller NULL = arv) står urørt.                        */
/* ------------------------------------------------------------------ */

function useRadSted(args: {
  byggeplasser: readonly ByggeplassValg[] | undefined;
  projectId: string;
  rad?: { byggeplassId?: string | null; externalCostObjectId?: string | null };
}) {
  const { byggeplasser, projectId, rad } = args;
  const bp = useRadByggeplass({
    byggeplasser,
    projectId,
    rad: rad ? { byggeplassId: rad.byggeplassId ?? null } : undefined,
  });
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId });
  const opprinneligEco = rad?.externalCostObjectId ?? null;
  const [ecoId, setEcoId] = useState<string | null>(opprinneligEco);
  const ecoEndret = !rad || ecoId !== opprinneligEco;
  const payload: { byggeplassId?: string | null; externalCostObjectId?: string | null } = {
    ...(rad ? byggeplassPayload(bp) : { byggeplassId: bp.byggeplassId }),
    ...(ecoEndret ? { externalCostObjectId: ecoId } : {}),
  };
  return { bp, ecoer: ecoer ?? [], ecoId, setEcoId, payload };
}

function RadStedFelt({ sted }: { sted: ReturnType<typeof useRadSted> }) {
  const { t } = useTranslation();
  return (
    <>
      <RadByggeplassFelt
        kandidater={sted.bp.kandidater}
        verdi={sted.bp.byggeplassId}
        onEndre={sted.bp.setByggeplassId}
      />
      {(sted.ecoer.length > 0 || !!sted.ecoId) && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.underprosjekt")}{" "}
            <span className="text-xs text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <select
            value={sted.ecoId ?? ""}
            onChange={(e) => sted.setEcoId(e.target.value || null)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {sted.ecoer.map((eco) => (
              <option key={eco.id} value={eco.id}>
                {eco.proAdmId} — {eco.kortNavn}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}

function TilleggRadDialog({
  sheetId,
  projectId,
  byggeplasser,
  rad,
  laastTilleggId,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  rad?: TilleggRad;
  // U3 (8a): kategori valgt i den unified velgeren → vises read-only her.
  // Redigering (rad) og fri-select-veien er uendret (bit-for-bit sats-flyt).
  laastTilleggId?: string;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  // Add-via-velger: kategori er allerede valgt (låst). Ellers fri select.
  const laast = !rad && !!laastTilleggId;
  const [tilleggId, setTilleggId] = useState<string>(
    rad?.tilleggId ?? laastTilleggId ?? "",
  );
  const [antall, setAntall] = useState<string>(
    rad ? String(tilTall(rad.antall)) : "1",
  );
  const [kommentar, setKommentar] = useState<string>(rad?.kommentar ?? "");
  const sted = useRadSted({ byggeplasser, projectId, rad });
  const [feil, setFeil] = useState<string | null>(null);
  // D4 (web-paritet): kvittering-opplasting (mobil har kamera/galleri).
  const [vedleggFeil, setVedleggFeil] = useState<string | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);

  const valgt = tilleggKatalog?.find((x) => x.id === tilleggId);
  const erAvhuking = valgt?.type === "avhuking";

  const tilfoy = trpc.timer.dagsseddel.tilfoyTilleggRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const oppdater = trpc.timer.dagsseddel.oppdaterTilleggRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // D4: kvittering-vedlegg. Kun for en LAGRET rad (som mobil — «lagre først»).
  const { data: vedleggListe } =
    trpc.timer.dagsseddel.listTilleggVedlegg.useQuery(
      { sheetId },
      { enabled: !!rad },
    );
  const radVedlegg = (
    (vedleggListe ?? []) as unknown as Array<{
      id: string;
      fileUrl: string;
      fileName: string;
      sheetTilleggId: string;
    }>
  ).filter((v) => v.sheetTilleggId === rad?.id);

  const invaliderVedlegg = () => {
    utils.timer.dagsseddel.listTilleggVedlegg.invalidate({ sheetId });
    utils.timer.dagsseddel.hentMedId.invalidate();
  };
  const tilfoyVedlegg = trpc.timer.dagsseddel.tilfoyTilleggVedlegg.useMutation({
    onSuccess: invaliderVedlegg,
    onError: (e: { message: string }) => setVedleggFeil(e.message),
  });
  const fjernVedlegg = trpc.timer.dagsseddel.fjernTilleggVedlegg.useMutation({
    onSuccess: invaliderVedlegg,
    onError: (e: { message: string }) => setVedleggFeil(e.message),
  });

  async function handleVedleggValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    e.target.value = "";
    if (!fil) return;
    // Funn 3 (defensiv): UI skjuler input når raden ikke er lagret, men aldri stille retur.
    if (!rad) {
      setVedleggFeil(t("timer.vedlegg.lagreForst"));
      return;
    }
    setVedleggFeil(null);
    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      // Timer-kvittering/utlegg er sensitiv → uploads/privat/ (signatur-KUN, S1 Fase 1)
      const res = await fetch("/api/upload?privat=1", { method: "POST", body: formData });
      // Funn 1: robust svar-lesing — les som tekst, forsøk JSON. Et ikke-JSON-svar
      // skal gi en forståelig feil (+ diagnostikk i konsoll), ikke et blindt kast
      // som maskeres til «Ugyldig verdi.».
      const raaTekst = await res.text();
      let data: { fileUrl?: string; fileSize?: number; error?: string } = {};
      try {
        data = raaTekst ? JSON.parse(raaTekst) : {};
      } catch {
        console.error("[vedlegg] upload-svar er ikke JSON:", res.status, raaTekst.slice(0, 300));
      }
      if (!res.ok) {
        setVedleggFeil(data.error ?? t("timer.vedlegg.opplastingFeilet"));
        return;
      }
      if (!data.fileUrl) {
        console.error("[vedlegg] upload 200 uten fileUrl:", res.status, raaTekst.slice(0, 300));
        setVedleggFeil(t("timer.vedlegg.opplastingFeilet"));
        return;
      }
      await tilfoyVedlegg.mutateAsync({
        sheetTilleggId: rad.id,
        fileUrl: data.fileUrl,
        fileName: fil.name,
        mimeType: fil.type || "application/octet-stream",
        fileSize: data.fileSize ?? fil.size,
      });
    } catch (e) {
      // Vis faktisk årsak (tRPC onError-melding / nettverksfeil) — aldri overskriv med generisk tekst.
      setVedleggFeil(e instanceof Error ? e.message : t("timer.vedlegg.opplastingFeilet"));
    } finally {
      setLasterOpp(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    const a = erAvhuking ? 1 : parseFloat(antall);
    if (!tilleggId || isNaN(a) || a < 0) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
    }
    const data = {
      tilleggId,
      antall: a,
      kommentar: kommentar.trim() || null,
    };
    if (rad) {
      oppdater.mutate({ id: rad.id, ...data, ...sted.payload });
    } else {
      tilfoy.mutate({ sheetId, projectId, ...data, ...sted.payload });
    }
  }

  const lagrer = tilfoy.isPending || oppdater.isPending;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={
        rad
          ? t("timer.detalj.redigerTilleggRad")
          : t("timer.detalj.tilfoyTillegg")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <RadStedFelt sted={sted} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.timer.fane.tillegg")}
          </label>
          {laast ? (
            // Kategori valgt i velgeren — vis navn read-only (8b: kategori som
            // overskrift, ikke et nytt valg).
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
              {valgt?.navn ?? "—"}
            </p>
          ) : (
            <select
              value={tilleggId}
              onChange={(e) => setTilleggId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              required
            >
              <option value="">{t("timer.velgTillegg")}</option>
              {tilleggKatalog?.map((tt) => (
                <option key={tt.id} value={tt.id} disabled={!tt.aktiv}>
                  {tt.navn}
                </option>
              ))}
            </select>
          )}
        </div>
        {!erAvhuking && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.antall")}
            </label>
            <Input
              type="number"
              step="0.5"
              min={0}
              value={antall}
              onChange={(e) => setAntall(e.target.value)}
              autoFocus
              required
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.kommentar")}{" "}
            <span className="text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <Input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
          />
        </div>
        {/* D4: kvittering-vedlegg (mobil-paritet). Kun på lagret rad. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.vedlegg.tittel")}{" "}
            <span className="text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          {!rad ? (
            <p className="text-xs text-gray-500">
              {t("timer.vedlegg.lagreForst")}
            </p>
          ) : (
            <div className="space-y-2">
              {radVedlegg.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {radVedlegg.map((v) => (
                    <div key={v.id} className="relative">
                      <SignertBilde
                        url={v.fileUrl}
                        alt={v.fileName}
                        className="h-16 w-16 rounded border border-gray-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => fjernVedlegg.mutate({ id: v.id })}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-gray-500 shadow hover:text-red-600"
                        title={t("handling.fjern")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <Plus className="h-4 w-4" />
                {lasterOpp
                  ? t("timer.vedlegg.laster")
                  : t("timer.vedlegg.leggTil")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={lasterOpp}
                  onChange={handleVedleggValgt}
                />
              </label>
              {vedleggFeil && (
                <p className="text-sm text-red-600">{vedleggFeil}</p>
              )}
            </div>
          )}
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring sperret={!tilleggId && !lagrer} forklaring={t("sperret.velgTillegg")}>
            <Button type="submit" disabled={lagrer || !tilleggId}>
              {lagrer ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Utlegg (U3, ordningsmodell) — velger, rad-liste, rad-dialog          */
/* ------------------------------------------------------------------ */

/** Ordnings-pille (undertekst, aldri et valg). Speiler den delte utledningen. */
function ordningPille(
  ordning: string,
  t: (k: string) => string,
): { label: string; cls: string } {
  switch (ordning) {
    case "lonnstillegg":
      return {
        label: t("timer.utleggReg.ordning.lonnstillegg"),
        cls: "bg-blue-50 text-blue-700",
      };
    case "fakturert":
      return {
        label: t("timer.utleggReg.ordning.fakturert"),
        cls: "bg-gray-100 text-gray-600",
      };
    case "utlegg":
    default:
      return {
        label: t("timer.utleggReg.ordning.utlegg"),
        cls: "bg-teal-50 text-teal-700",
      };
  }
}

// Utleggskategori med utledet ordning + kilde (fra expenseCategory.list).
type UtleggKategori = {
  id: string;
  navn: string;
  aktiv: boolean;
  firmaDefault: string;
  ordning: string;
  kilde: "firma-standard" | "overstyrt";
};

/**
 * RaderUtlegg — registrerte utlegg-rader (speiler RaderTillegg). Viser
 * ordnings-pille fra radens EGET stempel (ordningVedFoering), kilde-linje fra
 * gjeldende katalog, beløp (utlegg) eller «dekket av firma» (fakturert), og
 * kvittering-vedlegg. Ingen splitt (utlegg har ingen attesterings-/splittflyt i U3).
 */
function RaderUtlegg({
  rader,
  projectId,
  erRedigerbar,
  onRediger,
}: {
  rader: UtleggRad[];
  projectId: string;
  erRedigerbar: boolean;
  onRediger: (rad: UtleggRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: katalog } = trpc.timer.expenseCategory.list.useQuery({ projectId });

  const fjern = trpc.timer.dagsseddel.fjernUtleggRad.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });

  return (
    <ul className="divide-y divide-gray-100">
      {rader.map((rad) => {
        const kat = (katalog as UtleggKategori[] | undefined)?.find(
          (k) => k.id === rad.expenseCategoryId,
        );
        const ordning = rad.ordningVedFoering;
        const pille = ordningPille(ordning, t);
        const kildeTekst =
          kat?.kilde === "overstyrt"
            ? t("timer.utleggReg.kilde.overstyrt")
            : t("timer.utleggReg.kilde.firmaStandard");
        const kreverKvitt = ordning === "utlegg";
        const manglerKvitt = kreverKvitt && (rad.vedlegg?.length ?? 0) === 0;
        return (
          <li key={rad.id} className="flex items-start justify-between py-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {kat?.navn ?? "—"}
                </p>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pille.cls}`}
                >
                  {pille.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">{kildeTekst}</p>
              {rad.kommentar && (
                <p className="text-xs text-gray-500">{rad.kommentar}</p>
              )}
              {rad.vedlegg && rad.vedlegg.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {rad.vedlegg.map((v) => (
                    <SignertLenke
                      key={v.id}
                      url={v.fileUrl}
                      nyFane
                      title={v.fileName}
                    >
                      <SignertBilde
                        url={v.fileUrl}
                        alt={t("timer.vedlegg.tittel")}
                        className="h-14 w-14 rounded border border-gray-200 object-cover hover:opacity-80"
                      />
                    </SignertLenke>
                  ))}
                </div>
              )}
              {manglerKvitt && (
                <p className="mt-1 text-[11px] font-medium text-amber-600">
                  {t("timer.utleggReg.manglerKvittering")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {ordning === "fakturert"
                  ? "✓"
                  : `${tilTall(rad.belop).toFixed(2)} kr`}
              </span>
              {erRedigerbar && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onRediger(rad)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("handling.rediger")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => fjern.mutate({ id: rad.id })}
                    disabled={fjern.isPending}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    title={t("handling.slett")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * LeggTilVelger (8a) — ÉN inngang, to grupper (Tillegg = lønnstillegg/sats ·
 * Utlegg = ExpenseCategory). Feltarbeideren leter etter «diesel», ikke etter
 * taksonomi — ordningen er undertekst, aldri et valg. Flat markør over begge
 * grupper (↑/↓/Enter, klikk = velg), overskrifter er ikke-fokuserbare.
 *
 * NB (U1-default): til U5 lander står alle utleggskategorier på ordning='utlegg'
 * → Utlegg-gruppa viser «beløp + kvittering» for alt. sats-kategorier (om noen
 * settes manuelt) bæres av lønnstillegg og vises deaktivert her (ingen
 * lønnsart-bro i U1) — de føres via Tillegg-gruppa.
 */
function LeggTilVelger({
  projectId,
  onValgTillegg,
  onValgUtlegg,
  onLukk,
}: {
  projectId: string;
  onValgTillegg: (tilleggId: string) => void;
  onValgUtlegg: (expenseCategoryId: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();
  const { data: utleggKatalog } = trpc.timer.expenseCategory.list.useQuery({
    projectId,
  });

  // Flat sekvens av valgbare rader (markøren indekserer disse; deaktiverte
  // sats-kategorier hoppes over).
  type TilleggValg = { kind: "tillegg"; id: string; navn: string; hint: string };
  type UtleggValg = {
    kind: "utlegg";
    id: string;
    navn: string;
    hint: string;
    ordning: string;
    disabled: boolean;
  };
  type Valg = TilleggValg | UtleggValg;

  const tilleggRader: TilleggValg[] = (tilleggKatalog ?? [])
    .filter((x) => x.aktiv)
    .map((x) => ({
      kind: "tillegg" as const,
      id: x.id,
      navn: x.navn,
      hint:
        x.type === "avhuking"
          ? t("timer.utleggReg.hint.avhuking")
          : t("timer.utleggReg.hint.antall"),
    }));

  const utleggRader: UtleggValg[] = ((utleggKatalog as UtleggKategori[] | undefined) ?? []).map(
    (k) => ({
      kind: "utlegg" as const,
      id: k.id,
      navn: k.navn,
      ordning: k.ordning,
      // lonnstillegg-ordning bæres av lønnstillegg-katalogen (SheetTillegg), ikke
      // utlegg (ingen lønnsart-bro i U1). Deaktiveres i utlegg-velgeren.
      disabled: k.ordning === "lonnstillegg",
      // U5-fiks: deaktivert lonnstillegg-rad skal IKKE si «beløp + kvittering» — den
      // fører ingen beløp. Egen hint som peker til lønnstillegg-katalogen.
      hint:
        k.ordning === "lonnstillegg"
          ? t("timer.utleggReg.hint.lonnstillegg")
          : k.ordning === "fakturert"
            ? t("timer.utleggReg.hint.avhuking")
            : t("timer.utleggReg.hint.beloepKvittering"),
    }),
  );

  const flate = useMemo(
    () =>
      [...tilleggRader, ...utleggRader].filter(
        (v) => !(v.kind === "utlegg" && v.disabled),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tilleggKatalog, utleggKatalog],
  );

  const [markør, setMarkør] = useState(0);
  const radRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (markør >= flate.length) setMarkør(flate.length > 0 ? flate.length - 1 : 0);
  }, [flate.length, markør]);
  // Fokuser lista ved åpning så ↑/↓/Enter virker uten et klikk først.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function velg(v: Valg) {
    if (v.kind === "tillegg") onValgTillegg(v.id);
    else if (!v.disabled) onValgUtlegg(v.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkør((m) => {
        const ny = Math.min(m + 1, flate.length - 1);
        radRefs.current[ny]?.scrollIntoView({ block: "nearest" });
        return ny;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkør((m) => {
        const ny = Math.max(m - 1, 0);
        radRefs.current[ny]?.scrollIntoView({ block: "nearest" });
        return ny;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = flate[markør];
      if (v) velg(v);
    }
  }

  // Index i `flate` for hver valgbar rad (markør-highlight); deaktiverte får -1.
  const flatIndex = (id: string) => flate.findIndex((v) => v.id === id);

  const radKlasse = (aktivMarkør: boolean, disabled?: boolean) =>
    `flex w-full items-center gap-2 px-4 py-2 text-left ${
      disabled
        ? "cursor-not-allowed opacity-40"
        : aktivMarkør
          ? "bg-sitedoc-primary/5 border-l-2 border-sitedoc-primary"
          : "hover:bg-gray-50 border-l-2 border-transparent"
    }`;

  const seksjonTittel = (tekst: string) => (
    <div className="px-4 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-wide text-gray-400">
      {tekst}
    </div>
  );

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.utleggReg.leggTilTittel")}>
      <div
        ref={containerRef}
        tabIndex={0}
        className="max-h-[60vh] overflow-y-auto outline-none"
        onKeyDown={onKeyDown}
      >
        {/* Gruppe: Tillegg (lønnstillegg / sats) */}
        {tilleggRader.length > 0 && seksjonTittel(t("timer.utleggReg.gruppeTillegg"))}
        {tilleggRader.map((v) => {
          const i = flatIndex(v.id);
          return (
            <button
              key={`t-${v.id}`}
              type="button"
              ref={(el) => {
                if (i >= 0) radRefs.current[i] = el;
              }}
              onClick={() => velg(v)}
              className={radKlasse(i === markør)}
            >
              <span className="text-sm font-medium text-gray-900">{v.navn}</span>
              <span className="ml-auto text-[10.5px] text-gray-400">{v.hint}</span>
            </button>
          );
        })}

        {/* Gruppe: Utlegg (ExpenseCategory) */}
        {utleggRader.length > 0 && seksjonTittel(t("timer.utleggReg.gruppeUtlegg"))}
        {utleggRader.map((v) => {
          const i = flatIndex(v.id);
          const pille = ordningPille(v.ordning, t);
          return (
            <button
              key={`u-${v.id}`}
              type="button"
              ref={(el) => {
                if (i >= 0) radRefs.current[i] = el;
              }}
              onClick={() => velg(v)}
              disabled={v.disabled}
              className={radKlasse(i === markør, v.disabled)}
            >
              <span className="text-sm font-medium text-gray-900">{v.navn}</span>
              {v.ordning !== "utlegg" && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pille.cls}`}
                >
                  {pille.label}
                </span>
              )}
              <span className="ml-auto text-[10.5px] text-gray-400">{v.hint}</span>
            </button>
          );
        })}

        {tilleggRader.length === 0 && utleggRader.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            {t("timer.utleggReg.ingenKategorier")}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * UtleggRadDialog (8b) — én radform per utledet ordning:
 *   utlegg    → beløp (påkrevd) + kvittering (påkrevd, legges på lagret rad)
 *   fakturert → ren avhuking (ingen beløp), kvittering valgfri
 * Kategori + ordning er låst (utledet). Redigering endrer beløp/kommentar
 * innenfor radens ordning; ordningsbytte = ny rad (server håndhever immutabilitet).
 */
function UtleggRadDialog({
  sheetId,
  projectId,
  byggeplasser,
  expenseCategoryId,
  rad,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  expenseCategoryId?: string;
  rad?: UtleggRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: katalog } = trpc.timer.expenseCategory.list.useQuery({ projectId });

  const sted = useRadSted({ byggeplasser, projectId, rad });
  const kategoriId = rad?.expenseCategoryId ?? expenseCategoryId ?? "";
  const kat = (katalog as UtleggKategori[] | undefined)?.find(
    (k) => k.id === kategoriId,
  );
  // Redigering: ordning fra radens stempel (immutabelt). Add: utledet fra katalog.
  const ordning = rad?.ordningVedFoering ?? kat?.ordning ?? "utlegg";
  const pille = ordningPille(ordning, t);
  const kildeTekst =
    kat?.kilde === "overstyrt"
      ? t("timer.utleggReg.kilde.overstyrt")
      : t("timer.utleggReg.kilde.firmaStandard");
  const krevesBeloepUI = ordning === "utlegg";

  const [belop, setBelop] = useState<string>(
    rad?.belop != null ? String(tilTall(rad.belop)) : "",
  );
  const [kommentar, setKommentar] = useState<string>(rad?.kommentar ?? "");
  const [feil, setFeil] = useState<string | null>(null);
  const [vedleggFeil, setVedleggFeil] = useState<string | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);

  const tilfoy = trpc.timer.dagsseddel.tilfoyUtleggRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const oppdater = trpc.timer.dagsseddel.oppdaterUtleggRad.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // Kvittering-vedlegg — kun på lagret rad (som tillegg/mobil: «lagre først»).
  const { data: vedleggListe } =
    trpc.timer.dagsseddel.listUtleggVedlegg.useQuery(
      { sheetId },
      { enabled: !!rad },
    );
  const radVedlegg = (
    (vedleggListe ?? []) as unknown as Array<{
      id: string;
      fileUrl: string;
      fileName: string;
      sheetUtleggId: string;
    }>
  ).filter((v) => v.sheetUtleggId === rad?.id);

  const invaliderVedlegg = () => {
    utils.timer.dagsseddel.listUtleggVedlegg.invalidate({ sheetId });
    utils.timer.dagsseddel.hentMedId.invalidate();
  };
  const tilfoyVedlegg = trpc.timer.dagsseddel.tilfoyUtleggVedlegg.useMutation({
    onSuccess: invaliderVedlegg,
    onError: (e: { message: string }) => setVedleggFeil(e.message),
  });
  const fjernVedlegg = trpc.timer.dagsseddel.fjernUtleggVedlegg.useMutation({
    onSuccess: invaliderVedlegg,
    onError: (e: { message: string }) => setVedleggFeil(e.message),
  });

  async function handleVedleggValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    e.target.value = "";
    if (!fil) return;
    if (!rad) {
      setVedleggFeil(t("timer.vedlegg.lagreForst"));
      return;
    }
    setVedleggFeil(null);
    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload?privat=1", { method: "POST", body: formData });
      const raaTekst = await res.text();
      let data: { fileUrl?: string; fileSize?: number; error?: string } = {};
      try {
        data = raaTekst ? JSON.parse(raaTekst) : {};
      } catch {
        console.error("[utlegg-vedlegg] upload-svar er ikke JSON:", res.status, raaTekst.slice(0, 300));
      }
      if (!res.ok) {
        setVedleggFeil(data.error ?? t("timer.vedlegg.opplastingFeilet"));
        return;
      }
      if (!data.fileUrl) {
        console.error("[utlegg-vedlegg] upload 200 uten fileUrl:", res.status, raaTekst.slice(0, 300));
        setVedleggFeil(t("timer.vedlegg.opplastingFeilet"));
        return;
      }
      await tilfoyVedlegg.mutateAsync({
        sheetUtleggId: rad.id,
        fileUrl: data.fileUrl,
        fileName: fil.name,
        mimeType: fil.type || "application/octet-stream",
        fileSize: data.fileSize ?? fil.size,
      });
    } catch (e) {
      setVedleggFeil(e instanceof Error ? e.message : t("timer.vedlegg.opplastingFeilet"));
    } finally {
      setLasterOpp(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    // Beløp: 'utlegg' krever > 0; 'fakturert' fører ingen beløp (null).
    let belopVal: number | null = null;
    if (krevesBeloepUI) {
      const b = parseFloat(belop.replace(",", "."));
      if (isNaN(b) || b <= 0) {
        setFeil(t("timer.utleggReg.beloepPaakrevd"));
        return;
      }
      belopVal = b;
    }
    const kommentarVal = kommentar.trim() || null;
    if (rad) {
      oppdater.mutate({
        id: rad.id,
        belop: belopVal,
        kommentar: kommentarVal,
        ...sted.payload,
      });
    } else {
      tilfoy.mutate({
        sheetId,
        projectId,
        expenseCategoryId: kategoriId,
        belop: belopVal,
        kommentar: kommentarVal,
        ...sted.payload,
      });
    }
  }

  const lagrer = tilfoy.isPending || oppdater.isPending;
  const manglerKvitt = krevesBeloepUI && !!rad && radVedlegg.length === 0;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={rad ? t("timer.utleggReg.redigerUtlegg") : t("timer.detalj.leggTil")}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <RadStedFelt sted={sted} />
        {/* Kategori-overskrift + ordnings-pille + kilde (8b). Aldri et valg. */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{kat?.navn ?? "—"}</p>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${pille.cls}`}
            >
              {pille.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-400">{kildeTekst}</p>
        </div>

        {krevesBeloepUI ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.beloep")}
            </label>
            <Input
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              value={belop}
              onChange={(e) => setBelop(e.target.value)}
              autoFocus
              required
            />
          </div>
        ) : (
          <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {t("timer.utleggReg.fakturertInfo")}
          </p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.kommentar")}{" "}
            <span className="text-xs text-gray-400">({t("label.valgfritt")})</span>
          </label>
          <Input
            type="text"
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
          />
        </div>

        {/* Kvittering — påkrevd for 'utlegg' (refusjonsgrunnlag), valgfri for
            'fakturert' (dokumentasjon). Legges på lagret rad (som tillegg). */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.vedlegg.tittel")}{" "}
            <span className="text-xs text-gray-400">
              {krevesBeloepUI ? "" : `(${t("label.valgfritt")})`}
            </span>
          </label>
          {!rad ? (
            <p className="text-xs text-gray-500">{t("timer.vedlegg.lagreForst")}</p>
          ) : (
            <div className="space-y-2">
              {radVedlegg.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {radVedlegg.map((v) => (
                    <div key={v.id} className="relative">
                      <SignertBilde
                        url={v.fileUrl}
                        alt={v.fileName}
                        className="h-16 w-16 rounded border border-gray-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => fjernVedlegg.mutate({ id: v.id })}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-gray-500 shadow hover:text-red-600"
                        title={t("handling.fjern")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                <Plus className="h-4 w-4" />
                {lasterOpp ? t("timer.vedlegg.laster") : t("timer.vedlegg.leggTil")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={lasterOpp}
                  onChange={handleVedleggValgt}
                />
              </label>
              {manglerKvitt && (
                <p className="text-xs font-medium text-amber-600">
                  {t("timer.utleggReg.kvitteringPaakrevd")}
                </p>
              )}
              {vedleggFeil && <p className="text-sm text-red-600">{vedleggFeil}</p>}
            </div>
          )}
        </div>

        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring sperret={!kategoriId && !lagrer} forklaring={t("sperret.velgKategori")}>
            <Button type="submit" disabled={lagrer || !kategoriId}>
              {lagrer ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  MaskinRadDialog                                                     */
/* ------------------------------------------------------------------ */

function MaskinRadDialog({
  sheetId,
  projectId,
  byggeplasser,
  defaultEcoId,
  defaultFraTid,
  defaultTilTid,
  tidsrundingMinutter,
  rad,
  alleTimerRader,
  alleMaskinRader,
  sistBrukteMaskiner,
  pauseMin,
  skiftStart,
  standardPauseMin,
  standardPauseEtterTimer,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  defaultEcoId?: string | null;
  // Maskin-fra-til (2026-05-17): forslag fra parent basert på timer-rader
  // i bucket (Alt D — sammenheng-prinsipp). null hvis bucket er tom og
  // ingen firma-default. Brukes kun for ny rad (ikke rediger).
  defaultFraTid?: string | null;
  defaultTilTid?: string | null;
  tidsrundingMinutter?: number | null;
  rad?: MaskinRad;
  // Del 2 (maskin ≤ arbeid): hele sedelens rader + sedel-pause, for reaktiv
  // bucket-kapasitet. Samme regel som server (validerMaskinUnderArbeid).
  alleTimerRader: TimerRad[];
  alleMaskinRader: MaskinRad[];
  /** ORDRE 29: egne sist brukte maskiner (nyeste først) — øverst i velgeren. */
  sistBrukteMaskiner: string[];
  pauseMin: number;
  // B1/B2 (bolk e): pause-bevisst spenn↔antall-synk + spenn-validering på
  // maskin-rad. standardPauseMin = firma-default (samme kilde som timer-
  // modalen, IKKE sheet.pauseMin som bucket-taket bruker) — maskin følger
  // førerens økt, så fradraget må være identisk med timer-radens.
  skiftStart: string;
  standardPauseMin: number;
  standardPauseEtterTimer: number;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
      }>
    | undefined;
  // T7-4c: ECO-katalog for prosjektet — maskin følger samme prosjekt+ECO-
  // gruppe som arbeidstimer (T.7 låst 2026-05-16).
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId });
  // Ordre (10): samme regel som timer-raden.
  const bp = useRadByggeplass({ byggeplasser, projectId, rad });

  const [vehicleId, setVehicleId] = useState<string>(rad?.vehicleId ?? "");
  // Bolk (g): prefill gyldig kun når begge tider finnes OG fra < til.
  const prefillGyldig =
    !!defaultFraTid &&
    !!defaultTilTid &&
    hhmmTilMin(defaultFraTid) < hhmmTilMin(defaultTilTid);
  const [timer, setTimer] = useState<string>(() => {
    if (rad) return String(tilTall(rad.timer));
    // B3: init antall fra prefill-spennet (pause-bevisst) — kun ved gyldig
    // prefill; ellers tom (ingen 0-rad).
    if (prefillGyldig) {
      return String(
        effektiveTimerFraSpenn(
          defaultFraTid!,
          defaultTilTid!,
          pauseVinduFra(skiftStart, standardPauseEtterTimer),
          standardPauseMin,
        ),
      );
    }
    return "";
  });
  const [fraTid, setFraTid] = useState<string>(
    rad?.fraTid ?? defaultFraTid ?? "",
  );
  // Bolk (g): til prefylles kun ved gyldig prefill (fra < til).
  const [tilTid, setTilTid] = useState<string>(
    rad?.tilTid ?? (prefillGyldig ? defaultTilTid! : ""),
  );
  const [mengde, setMengde] = useState<string>(
    rad?.mengde !== null && rad?.mengde !== undefined
      ? String(tilTall(rad.mengde))
      : "",
  );
  const [enhet, setEnhet] = useState<string>(rad?.enhet ?? "");
  const [ecoId, setEcoId] = useState<string | null>(
    rad?.externalCostObjectId ?? defaultEcoId ?? null,
  );
  const [feil, setFeil] = useState<string | null>(null);

  // T7-2e-mønster: tving step ≤ 1800 (30 min) slik at minutt-selektor vises
  // selv om firmaet har tidsrunding på 60 min — Chrome skjuler minutter ved
  // step=3600. Default 15 min hvis ingen orgSetting.
  const timeStep = Math.min((tidsrundingMinutter ?? 15) * 60, 1800);

  // B1/B2 (bolk e): pausevindu + pause-bevisst spenn↔antall-synk, speiler
  // TimerRadDialog. standardPauseMin (ikke pauseMin) — maskin følger føreren.
  const pauseFra = pauseVinduFra(skiftStart, standardPauseEtterTimer);

  // R3-transparens: hvor mange minutter lunsjpause maskin-raden trekker fra.
  const pauseOverlapp = useMemo(() => {
    if (!fraTid || !tilTid) return 0;
    const fm = hhmmTilMin(fraTid);
    const tm = hhmmTilMin(tilTid);
    if (tm <= fm) return 0;
    return pauseOverlappMin(fm, tm, hhmmTilMin(pauseFra), standardPauseMin);
  }, [fraTid, tilTid, pauseFra, standardPauseMin]);

  // Sist-rørte felt vinner: fra/til → antall (spenn − pause); antall → til
  // (pausevindu skjøvet inn ved lunsj-kryssing). R4: rund fra/til ved commit.
  function endreFra(v: string) {
    const r = rundTilNarmeste(v, tidsrundingMinutter ?? null);
    setFraTid(r);
    if (r && tilTid) {
      setTimer(
        String(effektiveTimerFraSpenn(r, tilTid, pauseFra, standardPauseMin)),
      );
    }
  }
  function endreTil(v: string) {
    const r = rundTilNarmeste(v, tidsrundingMinutter ?? null);
    setTilTid(r);
    if (fraTid && r) {
      setTimer(
        String(effektiveTimerFraSpenn(fraTid, r, pauseFra, standardPauseMin)),
      );
    }
  }
  function endreTimer(v: string) {
    setTimer(v);
    const n = parseFloat(v);
    if (fraTid && !isNaN(n) && n > 0) {
      setTilTid(tilFraAntall(fraTid, n, pauseFra, standardPauseMin));
    }
  }

  // Del 2 (maskin ≤ arbeid): reaktiv bucket-kapasitet for gjeldende
  // (projectId, ecoId). Bruker delt @sitedoc/shared-regel — identisk med
  // serverens validerMaskinUnderArbeid (samme epsilon + pause-modell).
  const kapasitet = useMemo(() => {
    const iBucket = (r: {
      projectId: string;
      externalCostObjectId: string | null;
    }) =>
      r.projectId === projectId &&
      (r.externalCostObjectId ?? null) === (ecoId ?? null);
    // Ordre 2026-11-14 (6): arbeid uten reise og uten erstattede rader.
    const arbeidSum = arbeidUtenReise(alleTimerRader.filter(iBucket));
    const sumMaskinEksisterende = alleMaskinRader
      .filter((r) => iBucket(r) && r.id !== rad?.id)
      .reduce((acc, r) => acc + tilTall(r.timer), 0);
    const { tak, ledig } = maskinBucketKapasitet({
      arbeidSum,
      sumMaskinEksisterende,
      pauseMin,
    });
    const nyTimer = parseFloat(timer);
    const nyBidrag = isNaN(nyTimer) ? 0 : nyTimer;
    const overstiger = overstigerMaskinTak(
      sumMaskinEksisterende + nyBidrag,
      arbeidSum,
      pauseMin,
    );
    return { arbeidSum, sumMaskinEksisterende, tak, ledig, overstiger };
  }, [
    alleTimerRader,
    alleMaskinRader,
    projectId,
    ecoId,
    rad?.id,
    pauseMin,
    timer,
  ]);

  const tilfoy = trpc.timer.dagsseddel.maskin.tilfoy.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const oppdater = trpc.timer.dagsseddel.maskin.oppdater.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    const tNum = parseFloat(timer);
    if (!vehicleId || isNaN(tNum) || tNum <= 0 || tNum > 24) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
    }
    // B2 (bolk e): når begge tider er satt MÅ antall stemme med (spenn − pause).
    // Standardvalget er «maskinen gikk hele økta»; kortere drift krever justert
    // fra/til. Bolk (g): krev FØRST til > fra (lukker 0==0-hullet).
    if (fraTid && tilTid) {
      if (hhmmTilMin(tilTid) <= hhmmTilMin(fraTid)) {
        setFeil(t("timer.feil.sluttForStart"));
        return;
      }
      const forventet = effektiveTimerFraSpenn(
        fraTid,
        tilTid,
        pauseFra,
        standardPauseMin,
      );
      if (Math.abs(forventet - tNum) > 0.01) {
        setFeil(t("timer.feil.timerAvvik", { forventet: forventet.toFixed(2) }));
        return;
      }
    }
    const mengdeNum = mengde.trim() ? parseFloat(mengde) : null;
    if (mengdeNum !== null && (isNaN(mengdeNum) || mengdeNum < 0)) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
    }
    const data = {
      vehicleId,
      timer: tNum,
      mengde: mengdeNum,
      enhet: enhet || null,
      externalCostObjectId: ecoId,
      // Maskin-fra-til (2026-05-17): tom streng → null (felt er valgfrie).
      fraTid: fraTid || null,
      tilTid: tilTid || null,
      // Ordre (10): kun ved endring — mobilens byggeplass overskrives ikke.
      ...byggeplassPayload(bp),
    };
    if (rad) {
      oppdater.mutate({ id: rad.id, ...data });
    } else {
      tilfoy.mutate({ sheetId, projectId, ...data });
    }
  }

  const lagrer = tilfoy.isPending || oppdater.isPending;

  return (
    <Modal
      open={true}
      onClose={onLukk}
      title={
        rad ? t("timer.detalj.redigerMaskinRad") : t("timer.detalj.tilfoyMaskin")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.utstyr")}
          </label>
          <MaskinVelger
            utstyr={equipment ?? []}
            valgtId={vehicleId}
            onVelg={setVehicleId}
            bruktPaaSeddel={alleMaskinRader.map((m) => m.vehicleId)}
            sistBrukt={sistBrukteMaskiner}
          />
        </div>
        <RadByggeplassFelt
          kandidater={bp.kandidater}
          verdi={bp.byggeplassId}
          onEndre={bp.setByggeplassId}
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.antallTimer")}
          </label>
          <Input
            type="number"
            step="0.25"
            min={0}
            max={24}
            value={timer}
            onChange={(e) => endreTimer(e.target.value)}
            required
          />
        </div>
        {/* Maskin-fra-til = maskinens driftsvindu. B1/B2 (bolk e): antall er
            pause-bevisst avledet av spennet og validert mot det. Prefill fra
            bucketens arbeidsspenn (B4). Kortere drift → juster fra/til. */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.startTid")}{" "}
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            </label>
            <Input
              type="time"
              step={timeStep}
              value={fraTid}
              onChange={(e) => endreFra(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.sluttTid")}{" "}
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            </label>
            <Input
              type="time"
              step={timeStep}
              value={tilTid}
              onChange={(e) => endreTil(e.target.value)}
            />
          </div>
        </div>
        {/* R3-transparens: hvor mange minutter lunsjpause maskin-raden trekker. */}
        {pauseOverlapp > 0 && (
          <p className="-mt-2 text-xs text-gray-500">
            {t("timer.pauseFradrag", { min: pauseOverlapp })}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.mengde")}{" "}
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            </label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={mengde}
              onChange={(e) => setMengde(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("timer.felt.enhet")}
            </label>
            <select
              value={enhet}
              onChange={(e) => setEnhet(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ENHETER.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.underprosjekt")}{" "}
            <span className="text-xs text-gray-400">
              ({t("label.valgfritt")})
            </span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={ecoId ?? ""}
              onChange={(e) => setEcoId(e.target.value || null)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {ecoer?.map((eco) => (
                <option key={eco.id} value={eco.id}>
                  {eco.proAdmId} — {eco.kortNavn}
                </option>
              ))}
            </select>
            {ecoId && (
              <button
                type="button"
                onClick={() => setEcoId(null)}
                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title={t("handling.fjern")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {/* Del 2: inline kapasitet-linje — arbeid/maskin/ledig for bucketen.
            Rød når inntastet verdi overstiger taket; Lagre disables da. */}
        <div
          className={`rounded border px-3 py-2 text-xs ${
            kapasitet.overstiger
              ? "border-sitedoc-error/40 bg-sitedoc-error/5 text-sitedoc-error"
              : "border-gray-200 bg-gray-50 text-gray-500"
          }`}
        >
          {t("timer.maskin.kapasitet", {
            arbeid: formatTimer(kapasitet.arbeidSum),
            maskin: formatTimer(kapasitet.sumMaskinEksisterende),
            ledig: formatTimer(Math.max(0, kapasitet.ledig)),
          })}
          {kapasitet.overstiger && (
            <span className="mt-0.5 block font-medium">
              {t("timer.maskin.overstigerArbeid")}
            </span>
          )}
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring
            sperret={(!vehicleId || !timer) && !lagrer}
            forklaring={t("sperret.maskinRad")}
          >
            <Button
              type="submit"
              disabled={lagrer || !vehicleId || !timer || kapasitet.overstiger}
            >
              {lagrer ? t("handling.lagrer") : t("handling.lagre")}
            </Button>
          </KnappMedForklaring>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  RedigerHeaderDialog                                                 */
/* ------------------------------------------------------------------ */

function RedigerHeaderDialog({
  sheet,
  onLukk,
}: {
  sheet: {
    id: string;
    aktivitetId: string | null;
    dato: string | Date;
    startAt: unknown;
    endAt: unknown;
    beskrivelse: string | null;
  };
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();

  const [aktivitetId, setAktivitetId] = useState<string>(
    sheet.aktivitetId ?? "",
  );
  const [dato, setDato] = useState<string>(
    new Date(sheet.dato).toISOString().slice(0, 10),
  );
  const [startAt, setStartAt] = useState(
    isoTidspunktTilHHMM(sheet.startAt as string | null),
  );
  const [endAt, setEndAt] = useState(
    isoTidspunktTilHHMM(sheet.endAt as string | null),
  );
  const [beskrivelse, setBeskrivelse] = useState<string>(
    sheet.beskrivelse ?? "",
  );
  const [feil, setFeil] = useState<string | null>(null);

  const oppdater = trpc.timer.dagsseddel.oppdater.useMutation({
    onSuccess: () => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
    },
    onError: (e: { message: string }) => setFeil(e.message),
  });

  function tidIso(verdi: string): string | null {
    if (!verdi) return null;
    return new Date(`${dato}T${verdi}:00`).toISOString();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    // V20/PK6+PK7: hodet-pausen er IKKE lenger input — den utledes server-side
    // (Σ rad). Rediger-dialogen sender bare rammen (start/slutt).
    oppdater.mutate({
      id: sheet.id,
      aktivitetId: aktivitetId || undefined,
      dato,
      startAt: tidIso(startAt),
      endAt: tidIso(endAt),
      beskrivelse: beskrivelse.trim() || null,
    });
  }

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.detalj.redigerHeader")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.dato")}
          </label>
          <Input
            type="date"
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.aktivitet")}
          </label>
          <select
            value={aktivitetId}
            onChange={(e) => setAktivitetId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {aktiviteter?.map((a) => (
              <option key={a.id} value={a.id} disabled={!a.aktiv}>
                {a.navn}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {t("timer.felt.aktivitetDefaultHjelp")}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 p-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.arbeidstidIDag")}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            {t("timer.arbeidstidIDagBeskrivelse")}
          </p>
          {/* V20/PK7: pause-feltet er fjernet — matpausen eies av radene
              (avkrysning), hodet utledes server-side. Her settes kun rammen. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.startTid")}
              </label>
              <Input
                type="time"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.sluttTid")}
              </label>
              <Input
                type="time"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.beskrivelse")}
          </label>
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={oppdater.isPending}>
            {oppdater.isPending ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  NyProsjektDialog — velg et nytt prosjekt å legge til               */
/* ------------------------------------------------------------------ */

function NyProsjektDialog({
  ledigeProsjekter,
  onVelg,
  onLukk,
}: {
  ledigeProsjekter: Array<{ id: string; name: string; internalProjectNumber: string | null }>;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [valgtId, setValgtId] = useState<string | null>(null);

  return (
    <Modal open={true} onClose={onLukk} title={t("timer.leggTilProsjekt")}>
      <div className="space-y-4">
        <ProsjektRadVelger
          valgtId={valgtId}
          onVelg={setValgtId}
          prosjekter={ledigeProsjekter}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <KnappMedForklaring sperret={!valgtId} forklaring={t("sperret.velgProsjekt")}>
            <Button
              type="button"
              onClick={() => valgtId && onVelg(valgtId)}
              disabled={!valgtId}
            >
              {t("handling.leggTil")}
            </Button>
          </KnappMedForklaring>
        </div>
      </div>
    </Modal>
  );
}
