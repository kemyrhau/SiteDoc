"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
import { KnappMedForklaring } from "@/components/KnappMedForklaring";
import { SignertBilde } from "@/components/SignertBilde";
import { SignertLenke } from "@/components/SignertLenke";
import {
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
  AlertTriangle,
} from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { ForslagValgSeksjon } from "@/components/timer/ForslagValgSeksjon";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import { ProsjektRadVelger } from "@/components/timer/ProsjektRadVelger";
import { OppmoteSporsmaalModal } from "@/components/timer/OppmoteSporsmaalModal";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useFirma } from "@/kontekst/firma-kontekst";
import { TilbakeLenke, useTilbakeAdresse } from "@/components/nivaa/TilbakeLenke";
import { RESERVE_MINE_TIMER } from "@/lib/tilbake-adresse";
import {
  adresseEtterRegistrering,
  byggeplassForRegistrering,
  loesAapentKort,
  nyKortId,
  registrerTimerSteg,
  visDagDato,
} from "@/lib/registrerTimer";
import { MaskinVelger } from "@/components/timer/MaskinVelger";
import { KortVareforbrukModal } from "@/components/timer/KortVareforbrukModal";
import {
  RadByggeplassFelt,
  useRadByggeplass,
} from "@/components/timer/RadByggeplassFelt";
import {
  byggeplassPayload,
  byggeplasserForProsjekt,
  radByggeplassLinje,
  velgStandardByggeplass,
  type ByggeplassValg,
} from "@/lib/timerByggeplass";
import {
  maskinHoystPerRad,
  maskinForslagFraJobb,
  jobbArbeidSum,
  overMaskinHoyst,
  DEFAULT_PAUSE_ETTER_TIMER,
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
  maskinKreverTimerad,
  kortIdNokkel,
  sendDagenTekst,
  type ForsonRad,
  type ErReiseKontekst,
  type OvertidForslag,
  finnOverlappVarsel,
  jobberSomManglerBeskrivelse,
  radGirJobbBeskrivelse,
} from "@sitedoc/shared";
import { rundTilNarmeste } from "@/lib/tidsrunding";
import { ReiseKort } from "./ReiseKort";
import { JobbSkjema } from "./JobbSkjema";
import { jobbSkjemaLinjer, nyJobbForslag, senesteTilTid, type SkjemaKilde } from "@/lib/jobbSkjema";
import type { SkjemaLonnsart } from "./JobbSkjema";
import { KorrigeringProvider, KorrigertMerke, type KorrigeringerPrRad } from "@/components/timer/KorrigertMerke";
import { reiseHavnerI, type ReiseHavnerAnnenRad } from "@/hooks/useManuellReiseWeb";
import { formaterBelop, formaterTimer } from "@/lib/tallformat";
import {
  beregnKortSummer,
  kortStatus,
  lesTimerModus,
  sumlinjeDag,
  utledKortByggeplass,
  visVareforbrukKnapp,
  kortDagsseddelId,
  grupperPaaKort,
} from "@sitedoc/shared";

const ENHETER = ["m", "m2", "m3", "kg", "tonn", "stk"] as const;

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
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
  // POST (13) L2: sporet — overføringsretninger som alt finnes tilbys ikke igjen.
  reiseKilde?: string | null;
  // w9: jobben (prosjektkortet) raden hører til — «høyst» regnes pr. jobb.
  kortId?: string | null;
  reiseRetning?: string | null;
  createdAt?: string | Date;
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
  // w3a: jobben raden hører til (kort-id) og føringstidspunktet (rekkefølgen i kortet).
  kortId?: string | null;
  createdAt?: string | Date;
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
  kortId?: string | null;
  createdAt?: string | Date;
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
  // Ordre d2c-1 (R24): timeraden maskinen står på. Valgfri så eldre respons ikke bryter.
  sheetTimerId?: string | null;
  // w9: jobben maskinen hører til (K6: følger timeraden).
  kortId?: string | null;
  createdAt?: string | Date;
};

// w3a: jobben et vindu åpnes fra. Vinduet arver prosjekt, byggeplass, underprosjekt og
// kort-id; `sheetTimerId` er jobbens første arbeidsrad (S2 A), `fra`/`til` jobbens spenn (S3 A).
type JobbKontekst = {
  kortId: string;
  projectId: string;
  byggeplassId: string | null;
  ecoId: string | null;
  sheetTimerId: string | null;
  fra: string | null;
  til: string | null;
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

// Post 2026-11-14 (7) punkt 3: sedelens firma til alle kataloger i
// underkomponentene (lønnsart, aktivitet, tillegg, utleggskategori, maskin,
// underprosjekt). Uten provider (undefined) faller endepunktet tilbake til
// brukerens eget firma — samme som før.
const SedelFirmaKontekst = createContext<string | undefined>(undefined);
function useSedelFirma(): string | undefined {
  return useContext(SedelFirmaKontekst);
}

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
  const { data: vareKatalog, error: vareKatalogFeil } = trpc.vareforbruk.katalogForFirma.useQuery(
    { organizationId: sheet?.organizationId ?? "" },
    { enabled: prosjektkortModus && !!sheet?.organizationId, retry: false },
  );
  // w3b (B37 A): firmaadministrator for SEDELENS firma (ikke toppens valgte) ser hvor Varelager
  // slås på når firmaet ikke har det (katalogen svarer FORBIDDEN). Samme regel som
  // kanAdministrereFirma (firma-kontekst.tsx): sitedoc_admin eller firma_admin-medlemskap.
  // Serveren krever firma-admin for å slå på (organisasjon.ts verifiserFirmaAdmin).
  const { data: adminFirmaer } = trpc.organisasjon.hentTilgjengelige.useQuery(undefined, {
    enabled: prosjektkortModus,
  });
  const { data: minBrukerRaw } = trpc.bruker.hentMin.useQuery(undefined, { enabled: prosjektkortModus });
  const visVarelagerLenke =
    prosjektkortModus &&
    (vareKatalogFeil as { data?: { code?: string } | null } | null | undefined)?.data?.code === "FORBIDDEN" &&
    ((minBrukerRaw as { role?: string } | null | undefined)?.role === "sitedoc_admin" ||
      ((adminFirmaer ?? []) as Array<{ id: string }>).some((f) => f.id === sheet?.organizationId));
  // w3a: vare-vinduet åpnes fra en jobb (ny vare) eller fra blyanten på en varelinje (rad).
  const [vareModal, setVareModal] = useState<
    { projectId: string; jobb?: JobbKontekst; rad?: KortVare } | null
  >(null);
  // Åpent kort (w3a: kort-id, prosjekt-id for et tomt kort, eller «utenJobb»):
  // undefined = automatisk (eneste kort, eller nytt fra opprettelse). S8 A: ett om gangen.
  const [aapentKort, setAapentKort] = useState<string | null | undefined>(
    () => nyttProsjektParam ?? undefined,
  );

  // Plan § 8.22 L3a: jobbskjemaet. `skjemaKilde` gir gule felt og merket for jobben forslaget
  // kom til (nøkkel = kort-id, eller prosjekt-id for dagens første jobb). `nyJobbUtkast` er neste
  // jobb før Til er fylt — bare på skjermen. `ulagredeKort` sperrer «Send dagen».
  const [skjemaKilde, setSkjemaKilde] = useState<{ nokkel: string; kilde: SkjemaKilde } | null>(null);
  const [nyJobbUtkast, setNyJobbUtkast] = useState<{
    kortId: string;
    projectId: string;
    fraTid: string;
    tilTid: string;
    pauseMin: number;
    kilde: SkjemaKilde;
  } | null>(null);
  const [ulagredeKort, setUlagredeKort] = useState<ReadonlySet<string>>(() => new Set());
  const meldUlagret = useCallback((kortId: string, ulagret: boolean) => {
    setUlagredeKort((prev) => {
      if (prev.has(kortId) === ulagret) return prev;
      const neste = new Set(prev);
      if (ulagret) neste.add(kortId);
      else neste.delete(kortId);
      return neste;
    });
  }, []);
  const harUlagret = ulagredeKort.size > 0;
  useEffect(() => {
    if (!harUlagret) return;
    // Nettleserens egen «Forlat siden?» — teksten styres av nettleseren.
    const vakt = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", vakt);
    return () => window.removeEventListener("beforeunload", vakt);
  }, [harUlagret]);

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
        // w2 (B1, WM59): «+ Registrer timer» — ny jobb = nytt kort, og prosjektet kan
        // byttes i vinduet (annet prosjekt uten eget steg).
        kortId?: string;
        aapentProsjekt?: boolean;
        // w3a: vinduet er åpnet fra en jobb (lenkeraden eller blyanten på en linje i kortet).
        jobb?: JobbKontekst;
      }
    // U3: unified velger — «Legg til på dagsseddelen» (8a). Ruter til
    // tillegg-dialog (laastTilleggId) eller utlegg-dialog etter valg.
    | { type: "leggTil"; projectId: string; jobb?: JobbKontekst }
    // laastTilleggId: kategori valgt i velgeren (add-via-velger) → vises
    // read-only i dialogen. rad: redigering (uendret sats-flyt).
    | { type: "tillegg"; projectId: string; rad?: TilleggRad; laastTilleggId?: string; jobb?: JobbKontekst }
    // U3: utlegg-registrering. expenseCategoryId ved add, rad ved redigering.
    | { type: "utlegg"; projectId: string; expenseCategoryId?: string; rad?: UtleggRad; jobb?: JobbKontekst }
    | {
        type: "maskin";
        projectId: string;
        defaultEcoId?: string | null;
        rad?: MaskinRad;
        jobb?: JobbKontekst;
      }
    // w2: `forJobb` = «+ Registrer timer» uten kjent prosjekt — alle prosjekter
    // (også de som alt har kort, WM47), og valget åpner timervinduet for jobben.
    | { type: "nyProsjekt"; forJobb?: boolean }
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
  // w2 (B1): dagen åpnet fra «+ Registrer timer» (`registrer=1`). Flyten kjøres én gang når
  // sedelen og firmaets modus er lastet: ny jobb, prosjektvalg eller gjenåpning først.
  // «etterGjenaapning» venter på at dagen er gjenåpnet, og åpner så jobben.
  const fraRegistrer = searchParams.get("registrer") === "1";
  const registrerEksisterte = searchParams.get("eksisterte") === "1";
  const [registrer, setRegistrer] = useState<"start" | "etterGjenaapning" | null>(() =>
    fraRegistrer ? "start" : null,
  );
  const registrerFlyt = useRef<() => void>(() => {});
  useEffect(() => {
    registrerFlyt.current();
  });
  // B2 trinn 3: prosjektet i toppen er forvalget for neste jobb på dagen.
  const { prosjektId: toppProsjektId } = useProsjekt();
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

  // w14 (TK1–TK3): samme adresse som tilbake-knappen — lista brukeren kom fra, ellers Mine timer.
  const tilbake = useTilbakeAdresse(RESERVE_MINE_TIMER);
  const slett = trpc.timer.dagsseddel.slett.useMutation({
    onSuccess: () => router.push(tilbake?.href ?? RESERVE_MINE_TIMER.href),
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
        <TilbakeLenke
          reserve={RESERVE_MINE_TIMER}
          className="mt-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
        />
      </div>
    );
  }

  const erRedigerbar = sheet.status === "draft" || sheet.status === "returned";
  const sheetAktivitetId = sheet.aktivitetId ?? null;
  const timerRader = sheet.timer as unknown as TimerRad[];
  // Kenneth-vedtak 2026-11-15 (17): overlappende rader vises med varsel i
  // kortet. Kun prosjektkort-modus — dagskortet står urørt.
  const overlappVarsel = finnOverlappVarsel(timerRader);
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
  // w15f (F55): kort uten arbeid — linja «havner i» ser maskin, tillegg og utlegg, og regner
  // reisens egne kort-id med sedelens eier og dato, som serveren.
  const kortRaderUtenArbeid: ReiseHavnerAnnenRad[] = [...maskinRader, ...tilleggRader, ...utleggRader].map((r) => ({
    kortId: r.kortId ?? null,
    projectId: r.projectId,
    ecoId: r.externalCostObjectId ?? null,
    byggeplassId: r.byggeplassId ?? null,
    opprettet: r.createdAt ? new Date(r.createdAt).getTime() : 0,
  }));
  const kortEier = { userId: sheet.userId, dato: new Date(sheet.dato).toISOString().slice(0, 10) };

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

  // § 8.22 L3a: grunnlaget for jobbskjemaet (prosjektkort-modus, redigerbar dag). Lønnsart-
  // nedtrekket har arbeids-lønnsartene (ikke reise). Uten lønnsart eller aktivitet står jobben
  // som i dag (vinduet).
  const reiseKontekstSide = {
    reiseLonnsartId: arbeidstidDefaults?.reiseLonnsartId ?? null,
    grensepunktLonnsartIds: (arbeidstidDefaults?.reiseGrenser ?? [])
      .map((g) => g.lonnsartId)
      .filter((id): id is string => id != null),
  };
  const skjemaLonnsarter = (sedelLonnsarter ?? []) as SkjemaLonnsart[];
  const velgbareLonnsarter = skjemaLonnsarter.filter(
    (l) => l.type === "ordinaer" && !erReiseLonnsart(l.id, l.navn, reiseKontekstSide),
  );
  const standardLonnsartId =
    (sedelLonnsarter ?? []).find(
      (l) => l.erStandardvalg && velgbareLonnsarter.some((v) => v.id === l.id),
    )?.id ??
    velgbareLonnsarter[0]?.id ??
    null;
  const kanBrukeSkjema =
    prosjektkortModus && erRedigerbar && !!sedelLonnsarter && !!standardLonnsartId && !!sheetAktivitetId;
  const erOvertidsart = (id: string) =>
    skjemaLonnsarter.find((l) => l.id === id)?.overtidsnivaa != null;
  const overtidRaderUten = (ider: ReadonlySet<string>) =>
    timerRader
      .filter((r) => !ider.has(r.id) && r.attestertStatus !== "erstattet" && !!r.fraTid && !!r.tilTid)
      .map((r) => ({
        id: r.id,
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        pauseMin: r.pauseMin,
        erReise: r.erReise ?? false,
        overtidsnivaa: skjemaLonnsarter.find((l) => l.id === r.lonnsartId)?.overtidsnivaa ?? null,
      }));
  const skjemaPauseEtterTimer =
    arbeidstidDefaults?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
  const skjemaFelles = {
    sheetId: sheet.id,
    lonnsarter: skjemaLonnsarter,
    velgbareLonnsarter,
    norm: normTimer,
    pauseEtterTimer: skjemaPauseEtterTimer,
    fastPauseFra: fastPauseFraFor({
      startTid: effektivStart,
      pauseEtterTimer: skjemaPauseEtterTimer,
      pauseReferanse: effektivNorm?.pauseReferanse ?? "ankomst",
    }),
    datoTekst: visDagDato(sheet.dato, false),
    organizationId: sheet.organizationId ?? undefined,
    onUlagret: meldUlagret,
    tidsrundingMinutter: arbeidstidDefaults?.tidsrundingMinutter ?? null,
  };

  // Bolk (g): fra = SENESTE tilTid på HELE sedelen (alle bøtter), ellers dagens
  // effektive start. «Fortsett der du slapp» på hele dagen — ikke bare bøtta.
  // Seneste slutt hindrer at ny rad prefylles inn i et allerede registrert
  // tidsrom (overlapp-vakt). Delt av dagskortets gruppe og prosjektkortets «+ Timer».
  const aapneNyTimerRad = (
    projectId: string,
    ecoId: string | null,
    reise?: { id: string; navn: string },
    jobb?: { kortId: string; aapentProsjekt: boolean; jobb?: JobbKontekst },
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
      ...jobb,
    });
  };

  // w2 (B1, WM59): ny jobb = nytt kort (ny kort-id), Fra etter siste til-tid (WM6).
  // NB: dagssiden grupperer fortsatt pr. prosjekt — jobb 2 på samme prosjekt står i
  // samme prosjektkort her til w3, men er eget kort på serveren og i attesteringen.
  const aapneNyJobb = (projectId: string) => {
    const kortId = nyKortId();
    // § 8.22 L3a: i prosjektkort-modus lander jobben i skjemaet i kortet. Fra = slutten på
    // forrige jobb, Til = firmaets slutt når den ligger etter. Ingen rad før Til er fylt.
    if (prosjektkortModus && kanBrukeSkjema) {
      setNyJobbUtkast({
        kortId,
        projectId,
        ...nyJobbForslag({
          sisteTil: senesteTilTid(timerRader),
          firmaStart: effektivStart,
          firmaSlutt: effektivSlutt,
          firmaPauseMin: sheet.pauseMin,
        }),
      });
      setAapentKort(kortId);
      return;
    }
    setEkstraProsjektIder((prev) => (prev.includes(projectId) ? prev : [...prev, projectId]));
    // w3a: den nye jobben får eget kort — det åpnes når raden er lagret.
    setAapentKort(kortId);
    aapneNyTimerRad(projectId, null, undefined, { kortId, aapentProsjekt: true });
  };
  const startRegistrering = () => {
    if (toppProsjektId && prosjektNavnMap.has(toppProsjektId)) aapneNyJobb(toppProsjektId);
    else setAktivModal({ type: "nyProsjekt", forJobb: true });
  };
  const ryddRegistrerAdresse = () =>
    router.replace(adresseEtterRegistrering(`/dashbord/timer/${params.id}`, searchParams.toString()), {
      scroll: false,
    });
  registrerFlyt.current = () => {
    if (!registrer || !arbeidstidDefaults || !prosjekterRaw) return;
    if (!prosjektkortModus) {
      setRegistrer(null);
      ryddRegistrerAdresse();
      return;
    }
    const kjent =
      nyttProsjektParam && prosjektNavnMap.has(nyttProsjektParam) ? nyttProsjektParam : null;
    const steg = registrerTimerSteg({
      eksisterte: registrer === "etterGjenaapning" || registrerEksisterte,
      status: sheet.status,
      harAttestertRad,
      projectId: kjent,
    });
    // Venter på gjenåpningen (statusen er fortsatt «sendt»).
    if (registrer === "etterGjenaapning" && steg === "gjenaapne") return;
    setRegistrer(steg === "gjenaapne" ? "etterGjenaapning" : null);
    // w15a: flyten er kjørt — omlasting skal ikke kjøre den igjen.
    if (steg !== "gjenaapne") ryddRegistrerAdresse();
    if (steg === "gjenaapne") {
      setGjenaapneFeil(null);
      setVisGjenaapneModal(true);
    } else if (steg === "ferdig" && kjent) {
      // § 8.22 L3a: serveren laget dagens første jobb med firmaets arbeidstid — gule felt.
      // Uten arbeidsrad på prosjektet (ingen rad laget) lander jobben i skjemaet som utkast.
      if (timerRader.some((r) => r.projectId === kjent && !r.erReise)) {
        setSkjemaKilde({ nokkel: kjent, kilde: "firma" });
      } else {
        aapneNyJobb(kjent);
      }
    } else if (steg === "nyJobb" && kjent) {
      aapneNyJobb(kjent);
    } else if (steg === "velgProsjekt") {
      setAktivModal({ type: "nyProsjekt", forJobb: true });
    }
  };

  // V22: grunnlaget for timer-radens «Prosjekt · Byggeplass»-linje.
  const radLinjeFor = (projectId: string): RadLinjeKontekst => ({
    // Kort-id-spec § 11.6: rad uten prosjekt (null) er fravær, ikke «Ukjent prosjekt».
    prosjektNavn:
      projectId === null
        ? t("timer.detalj.fravaerUtenProsjekt")
        : (prosjektNavnMap.get(projectId)?.name ?? t("timer.detalj.ukjentProsjekt")),
    projectId,
    sedelByggeplassId:
      (sheet as { byggeplassId?: string | null }).byggeplassId ?? null,
    byggeplasser,
    kortModus: prosjektkortModus,
  });

  // Props for én ProsjektGruppe (dagskortet).
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
      radLinje: radLinjeFor(projectId),
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
    // Kort-id-spec § 11.6: gruppen uten prosjekt heter «Fravær».
    if (projectId === null) return t("timer.detalj.fravaerUtenProsjekt");
    const p = prosjektNavnMap.get(projectId);
    if (!p) return t("timer.detalj.ukjentProsjekt");
    return p.internalProjectNumber
      ? `${p.internalProjectNumber} — ${p.name}`
      : p.name;
  };
  const kortNavnMap = new Map(aktiveProsjektIder.map((id) => [id, kortNavn(id)]));

  // w3a: ett kort pr. jobb (kort-id) på PC, gruppert med den delte `grupperPaaKort`
  // (samme linjer og rekkefølge som mobilen og attesteringen). Rader uten kort-id står i
  // ett samlekort sist. Prosjekter lagt til uten jobb ennå får et tomt kort med «+ Timer».
  const kortVarer = (mineVarer ?? []) as KortVare[];
  const jobbGruppering = prosjektkortModus
    ? grupperPaaKort({
        timer: timerRader.map((r) => ({ ...r, kortId: r.kortId ?? null })),
        maskiner: maskinRader.map((r) => ({ ...r, kortId: r.kortId ?? null })),
        varer: kortVarer.map((v) => ({ ...v, kortId: v.kortId ?? null })),
        tillegg: tilleggRader.map((r) => ({ ...r, kortId: r.kortId ?? null })),
        utlegg: utleggRader.map((r) => ({ ...r, kortId: r.kortId ?? null })),
      })
    : null;
  const jobbKort: JobbKortData[] = (jobbGruppering?.kort ?? []).map((k) => {
    const arbeid = k.linjer.flatMap((l) => (l.type === "timer" ? [l.rad] : []));
    const timer = k.linjer.flatMap((l) =>
      l.type === "timer" || l.type === "reise" ? [l.rad] : [],
    );
    const maskin = k.linjer.flatMap((l) =>
      l.type === "maskin" ? [l.rad] : l.type === "timer" ? l.maskiner : [],
    );
    const varer = k.linjer.flatMap((l) =>
      l.type === "vare" ? [l.rad] : l.type === "timer" ? l.varer : [],
    );
    const forste = k.linjer[0]?.rad as { projectId?: string | null } | undefined;
    const fraer = arbeid.map((r) => r.fraTid).filter((x): x is string => !!x);
    const tiler = arbeid.map((r) => r.tilTid).filter((x): x is string => !!x);
    return {
      jobb: {
        kortId: k.kortId,
        projectId: (k.hode?.projectId ?? forste?.projectId ?? null) as string,
        byggeplassId: k.hode?.byggeplassId ?? null,
        ecoId: k.hode?.externalCostObjectId ?? null,
        sheetTimerId: arbeid[0]?.id ?? null,
        fra: fraer.length > 0 ? fraer.reduce((a, b) => (hhmmTilMin(b) < hhmmTilMin(a) ? b : a)) : null,
        til: tiler.length > 0 ? tiler.reduce((a, b) => (hhmmTilMin(b) > hhmmTilMin(a) ? b : a)) : null,
      },
      linjer: k.linjer,
      timer,
      maskin,
      varer,
    };
  });
  const tommeProsjektKort = ekstraProsjektIder.filter(
    (pid) => !jobbKort.some((k) => k.jobb.projectId === pid),
  );
  const utenJobbLinjer: KortLinje[] = jobbGruppering
    ? [
        ...jobbGruppering.utenKort,
        ...jobbGruppering.reise.map((rad): KortLinje => ({ type: "reise", rad })),
      ]
    : [];
  const kortNokler = [
    ...jobbKort.map((k) => k.jobb.kortId),
    ...tommeProsjektKort,
    ...(utenJobbLinjer.length > 0 ? [UTEN_JOBB] : []),
  ];
  // w15a (B41 A): prosjekt-id fra «+ Registrer timer»/«Ny dagsseddel» åpner jobbens kort.
  const aapentKortNokkel = loesAapentKort({
    aapentKort,
    kortNokler,
    jobbKort: jobbKort.map((k) => ({ kortId: k.jobb.kortId, projectId: k.jobb.projectId })),
  });

  // w3b (B38 A): «+ Maskin» fra jobben fører Utstyr og Antall timer, ingen fra–til.
  const aapneMaskinForJobb = (jobb: JobbKontekst) =>
    setAktivModal({
      type: "maskin",
      projectId: jobb.projectId,
      defaultEcoId: jobb.ecoId,
      jobb,
    });

  // § 8.22 L3a: skjemaet for en jobb, eller null når jobben står som i dag (mer enn to linjer,
  // hull, linje 2 som ikke er overtid, linje uten fra–til, attestert linje).
  const skjemaFor = (k: JobbKortData): SkjemaOppsett | null => {
    if (!kanBrukeSkjema) return null;
    const arbeid = k.linjer.flatMap((l) => (l.type === "timer" ? [l.rad] : []));
    const linjer = jobbSkjemaLinjer(arbeid, erOvertidsart);
    if (!linjer) return null;
    const forste = linjer[0]!;
    const forsteJobbIProsjekt =
      skjemaKilde?.nokkel === k.jobb.projectId &&
      jobbKort.filter((j) => j.jobb.projectId === k.jobb.projectId).length === 1;
    const kilde =
      skjemaKilde && (skjemaKilde.nokkel === k.jobb.kortId || forsteJobbIProsjekt)
        ? skjemaKilde.kilde
        : null;
    // Utkastet er lagret og står nå som kortet: forslaget er arbeiderens tid (ikke gult), og
    // skjemaet (montert på nytt her) starter med «✓ Lagret».
    const fraUtkast = nyJobbUtkast?.kortId === k.jobb.kortId;
    return {
      ...skjemaFelles,
      startLagret: fraUtkast,
      kortId: k.jobb.kortId,
      linjer: linjer.map((r) => ({
        id: r.id,
        fraTid: r.fraTid as string,
        tilTid: r.tilTid as string,
        pauseMin: r.pauseMin,
        lonnsartId: r.lonnsartId,
        timer: tilTall(r.timer),
        beskrivelse: r.beskrivelse,
      })),
      kilde,
      andreRader: overtidRaderUten(new Set(linjer.map((r) => r.id))),
      projectId: k.jobb.projectId,
      ecoId: k.jobb.ecoId,
      onAapneVindu: () =>
        setAktivModal({ type: "timer", projectId: forste.projectId, rad: forste, jobb: k.jobb }),
    };
  };
  const utkastSkjema: SkjemaOppsett | null =
    nyJobbUtkast &&
    kanBrukeSkjema &&
    standardLonnsartId &&
    sheetAktivitetId &&
    !jobbKort.some((k) => k.jobb.kortId === nyJobbUtkast.kortId)
      ? {
          ...skjemaFelles,
          kortId: nyJobbUtkast.kortId,
          linjer: [],
          ny: {
            projectId: nyJobbUtkast.projectId,
            aktivitetId: sheetAktivitetId,
            byggeplassId: byggeplassForRegistrering({
              toppbarByggeplassId: (sheet as { byggeplassId?: string | null }).byggeplassId ?? null,
              projectId: nyJobbUtkast.projectId,
              byggeplasser,
            }),
            fraTid: nyJobbUtkast.fraTid,
            tilTid: nyJobbUtkast.tilTid,
            pauseMin: nyJobbUtkast.pauseMin,
            lonnsartId: standardLonnsartId,
          },
          kilde: nyJobbUtkast.kilde,
          andreRader: overtidRaderUten(new Set()),
          projectId: nyJobbUtkast.projectId,
          ecoId: null,
        }
      : null;
  const velgKort = (nokkel: string | null) => {
    setAapentKort(nokkel);
    // Neste jobb uten Til forsvinner når et annet kort åpnes (ingenting er lagret).
    if (nyJobbUtkast && nokkel !== nyJobbUtkast.kortId) setNyJobbUtkast(null);
  };

  // Linjene i et kort. Blyanten åpner vinduet med jobben (S7 A); samlekortet har ingen jobb.
  const renderLinjer = (linjer: KortLinje[], jobb: JobbKontekst | undefined) => (
    <div className="divide-y divide-gray-100">
      {linjer.map((l) => {
        const nokkel = `${l.type}:${l.rad.id}`;
        // w15d (F18): reisen har egen tegning — merket «Reise», stedet og klokka.
        if (l.type === "reise") {
          const rad = l.rad;
          return (
            <ReiseLinje
              key={nokkel}
              rad={rad}
              jobbEcoId={jobb ? jobb.ecoId : undefined}
              prosjektNavn={radLinjeFor(rad.projectId).prosjektNavn}
              byggeplassNavn={byggeplassNavn}
              maskinIProsjekt={maskinRader.filter((m) => m.projectId === rad.projectId)}
              erRedigerbar={erRedigerbar}
              onRediger={(r) =>
                setAktivModal({ type: "timer", projectId: r.projectId, rad: r, jobb })
              }
              onSplitt={(r) => setSplittModal({ type: "timer", rad: r })}
            />
          );
        }
        if (l.type === "timer") {
          const rad = l.rad;
          return (
            <div key={nokkel}>
              <RaderTimer
                rader={[rad]}
                maskinIProsjekt={maskinRader.filter((m) => m.projectId === rad.projectId)}
                erRedigerbar={erRedigerbar}
                pauseVisning={pauseVisning}
                radLinje={radLinjeFor(rad.projectId)}
                onRediger={(r) =>
                  setAktivModal({ type: "timer", projectId: r.projectId, rad: r, jobb })
                }
                onSplitt={(r) => setSplittModal({ type: "timer", rad: r })}
              />
              {(l.maskiner.length > 0 || l.varer.length > 0) && (
                <div className="mb-2 ml-3 border-l-2 border-gray-200 pl-3">
                  {l.maskiner.length > 0 && (
                    <RaderMaskinKompakt
                      rader={l.maskiner}
                      erRedigerbar={erRedigerbar}
                      byggeplassNavn={byggeplassNavn}
                      onRediger={(r) =>
                        setAktivModal({ type: "maskin", projectId: r.projectId, rad: r, jobb })
                      }
                      onSplitt={(r) => setSplittModal({ type: "maskin", rad: r })}
                    />
                  )}
                  {l.varer.length > 0 && (
                    <RaderVare
                      rader={l.varer}
                      erRedigerbar={erRedigerbar}
                      byggeplassNavn={byggeplassNavn}
                      onRediger={(v) => setVareModal({ projectId: v.projectId, rad: v, jobb })}
                    />
                  )}
                </div>
              )}
            </div>
          );
        }
        if (l.type === "maskin") {
          return (
            <RaderMaskinKompakt
              key={nokkel}
              rader={[l.rad]}
              erRedigerbar={erRedigerbar}
              byggeplassNavn={byggeplassNavn}
              onRediger={(r) =>
                setAktivModal({ type: "maskin", projectId: r.projectId, rad: r, jobb })
              }
              onSplitt={(r) => setSplittModal({ type: "maskin", rad: r })}
            />
          );
        }
        if (l.type === "vare") {
          return (
            <RaderVare
              key={nokkel}
              rader={[l.rad]}
              erRedigerbar={erRedigerbar}
              byggeplassNavn={byggeplassNavn}
              onRediger={(v) => setVareModal({ projectId: v.projectId, rad: v, jobb })}
            />
          );
        }
        if (l.type === "tillegg") {
          return (
            <RaderTillegg
              key={nokkel}
              rader={[l.rad]}
              erRedigerbar={erRedigerbar}
              onRediger={(r) =>
                setAktivModal({ type: "tillegg", projectId: r.projectId, rad: r, jobb })
              }
              onSplitt={(r) => setSplittModal({ type: "tillegg", rad: r })}
            />
          );
        }
        return (
          <RaderUtlegg
            key={nokkel}
            rader={[l.rad]}
            projectId={l.rad.projectId}
            erRedigerbar={erRedigerbar}
            onRediger={(r) =>
              setAktivModal({ type: "utlegg", projectId: r.projectId, rad: r, jobb })
            }
          />
        );
      })}
    </div>
  );

  return (
    <SedelFirmaKontekst.Provider value={sheet.organizationId ?? undefined}>
    <div className="max-w-3xl p-6">
      {/* w2: skjemaet hoppes over i prosjektkort-modus — spørsmålet følger med hit. */}
      {fraRegistrer && <OppmoteSporsmaalModal organizationId={sheet.organizationId ?? null} />}
      <TilbakeLenke
        reserve={RESERVE_MINE_TIMER}
        className="mb-3 inline-flex items-center gap-1 text-sm text-sitedoc-primary hover:underline"
      />

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

      {prosjektkortModus && overlappVarsel && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {t("timer.feil.overlapp", { ...overlappVarsel })}
        </p>
      )}

      {/* Prosjekt-grupper (dagskort) / prosjektkort-samleside */}
      {prosjektkortModus ? (
        // w15g: merket «Korrigert av» gis bare i prosjektkort-modus (dagskortet er urørt).
        <KorrigeringProvider korrigeringer={(sheet as { korrigeringer?: KorrigeringerPrRad }).korrigeringer}>
        <ProsjektkortSamleside
          jobbKort={jobbKort}
          tommeProsjektKort={tommeProsjektKort}
          utenJobbLinjer={utenJobbLinjer}
          aapentKort={aapentKortNokkel}
          onVelgKort={velgKort}
          skjemaFor={skjemaFor}
          utkastSkjema={utkastSkjema}
          harUlagret={harUlagret}
          kortNavn={kortNavn}
          timerRader={timerRader}
          maskinRader={maskinRader}
          sedelByggeplassId={(sheet as { byggeplassId?: string | null }).byggeplassId ?? null}
          byggeplassNavn={byggeplassNavn}
          byggeplasser={byggeplasser}
          erRedigerbar={erRedigerbar}
          kanLeggeTilKort={prosjekterForVelger.length > 0}
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
          renderLinjer={renderLinjer}
          onNyTimer={(jobb) =>
            aapneNyTimerRad(jobb.projectId, jobb.ecoId, undefined, {
              kortId: jobb.kortId,
              aapentProsjekt: false,
              jobb,
            })
          }
          onNyJobb={aapneNyJobb}
          reiseLonnsart={reiseKnapp?.lonnsart ?? null}
          // Firmaadmin (hentSetting lykkes kun for admin) ser hvorfor «+ Reise»
          // mangler, med lenke til innstillingen. Andre ser ingenting.
          visReiseHint={
            !!orgSetting &&
            (reiseKnapp?.status === "ingen" || reiseKnapp?.status === "flere")
              ? reiseKnapp.status
              : null
          }
          onNyReise={(jobb, lonnsart) =>
            setAktivModal({
              type: "timer",
              projectId: jobb.projectId,
              defaultEcoId: jobb.ecoId,
              reise: lonnsart,
              jobb,
            })
          }
          onNyMaskin={aapneMaskinForJobb}
          onLeggTil={(jobb) =>
            setAktivModal({ type: "leggTil", projectId: jobb.projectId, jobb })
          }
          varelagerProsjekter={vareKatalog?.prosjektIderMedVarelager}
          varelagerLenkeFirmaId={visVarelagerLenke ? (sheet?.organizationId ?? undefined) : undefined}
          onNyVare={(jobb) => setVareModal({ projectId: jobb.projectId, jobb })}
          onNyttKort={startRegistrering}
          onEndreRamme={() => setRedigerHeader(true)}
          onSlett={() => setVisSlettModal(true)}
          onSend={sendMedPauseSporsmaal}
        />
        </KorrigeringProvider>
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
          // Post 2026-11-14 (7) punkt 6: dekningen måles på arbeid UTEN reise
          // (samme regel som prosjektkortet og maskin-kontrollen); reise vises
          // separat. Kun banneret — resten av dagskortet bruker `totaltimer`.
          const { arbeid: bannerArbeid, reise: bannerReise } = arbeidOgReise(timerRader);
          const rundet = Math.round(bannerArbeid * 4) / 4;
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
                registrert: formaterTimer(bannerArbeid),
                total: normTimer === null ? "?" : formaterTimer(normTimer),
              })}
              {bannerReise > 0 && (
                <>
                  {" · "}
                  {t("timer.summeringReise", { reise: formaterTimer(bannerReise) })}
                </>
              )}
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
      {aktivModal?.type === "timer" && aktivModal.reise && !aktivModal.rad && (
        // POST (13) L2 § 7 C: «+ Reise» åpner reise-kortet (Tur / Retur /
        // overføring) — ikke den generelle timer-dialogen.
        <ReiseKort
          sheetId={sheet.id}
          organizationId={sheet.organizationId}
          dato={new Date(sheet.dato).toISOString().slice(0, 10)}
          projectId={aktivModal.projectId}
          prosjekter={prosjekterForVelger}
          sedelByggeplassId={(sheet as { byggeplassId?: string | null }).byggeplassId ?? null}
          byggeplasser={byggeplasser}
          prosjektNavn={kortNavn}
          aktivitetId={sheetAktivitetId ?? null}
          // w15b: radene bærer kort, sted og prosjekt — overlapp-sperren og linja «havner i».
          dagsrader={timerRader.map((r) => ({
            fraTid: r.fraTid,
            tilTid: r.tilTid,
            erReise: r.erReise ?? false,
            kortId: r.kortId ?? null,
            projectId: r.projectId,
            ecoId: r.externalCostObjectId,
            byggeplassId: r.byggeplassId,
            opprettet: r.createdAt ? new Date(r.createdAt).getTime() : 0,
            attestertStatus: r.attestertStatus,
          }))}
          andreRader={kortRaderUtenArbeid}
          eierId={sheet.userId}
          resolverLonnsartId={aktivModal.reise.id}
          erFirmaAdmin={!!orgSetting}
          forvalgtByggeplassId={aktivModal.jobb?.byggeplassId}
          forvalgtEcoId={aktivModal.jobb?.ecoId}
          jobbKortId={aktivModal.jobb?.kortId}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "timer" && !(aktivModal.reise && !aktivModal.rad) && (
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
          // P4b: hele sedelens timer-rader sendes inn så dialogen kan kjøre samme
          // kryss-bøtte overlapp-vakt som mobil (delt finnOverlappendeTidsrom).
          alleTimerRader={timerRader}
          // Prosjektkort L1: inne i et kort er prosjektet låst, og overlapp-
          // meldingen navngir det andre kortet.
          laastProsjekt={prosjektkortModus && !aktivModal.aapentProsjekt}
          kortId={aktivModal.kortId ?? aktivModal.jobb?.kortId}
          // w3a (S1 A, S7 A): åpnet fra en jobb — stedet arves, feltene skjules.
          jobb={aktivModal.jobb}
          // w3b (A13): maskindelen er lik i «Legg til» og «Rediger» i prosjektkort-modus.
          kortModus={prosjektkortModus}
          sedelByggeplassId={(sheet as { byggeplassId?: string | null }).byggeplassId ?? null}
          kortRaderUtenArbeid={kortRaderUtenArbeid}
          kortEier={kortEier}
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
      {vareModal && vareKatalog && (
        <KortVareforbrukModal
          projectId={vareModal.projectId}
          prosjektNavn={kortNavn(vareModal.projectId)}
          dato={new Date(sheet.dato).toISOString().slice(0, 10)}
          dagsseddelId={kortDagsseddelId(sheet.id, timerRader, vareModal.projectId)}
          timerRader={timerRader}
          varer={vareKatalog.varer}
          byggeplasser={byggeplasser}
          rad={vareModal.rad}
          jobb={vareModal.jobb}
          onClose={() => setVareModal(null)}
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
              jobb: aktivModal.jobb,
            })
          }
          onValgUtlegg={(expenseCategoryId) =>
            setAktivModal({
              type: "utlegg",
              projectId: aktivModal.projectId,
              expenseCategoryId,
              jobb: aktivModal.jobb,
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
          jobb={aktivModal.jobb}
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
          jobb={aktivModal.jobb}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "maskin" && (
        <MaskinRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          byggeplasser={byggeplasser}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          rad={aktivModal.rad}
          // Del 2 (maskin ≤ arbeid): hele sedelen sendes inn så modalen kan
          // beregne bucket-kapasitet reaktivt for gjeldende (projectId, ECO).
          alleTimerRader={timerRader}
          alleMaskinRader={maskinRader}
          sistBrukteMaskiner={sistBrukteMaskiner ?? []}
          pauseMin={sheet.pauseMin}
          jobb={aktivModal.jobb}
          kortModus={prosjektkortModus}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "nyProsjekt" && aktivModal.forJobb && (
        <NyProsjektDialog
          tittel={t("timer.registrerTimer")}
          ledigeProsjekter={prosjekterForVelger}
          onLukk={() => setAktivModal(null)}
          onVelg={(id) => {
            setAktivModal(null);
            aapneNyJobb(id);
          }}
        />
      )}
      {aktivModal?.type === "nyProsjekt" && !aktivModal.forJobb && (
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
          onClose={() => {
            setVisGjenaapneModal(false);
            if (registrer) ryddRegistrerAdresse();
            setRegistrer(null);
          }}
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
                onClick={() => {
                  setVisGjenaapneModal(false);
                  if (registrer) ryddRegistrerAdresse();
                  setRegistrer(null);
                }}
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
    </SedelFirmaKontekst.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  ProsjektkortSamleside — Prosjektkort L1 (2026-11-05), w3a           */
/*  Visningsmodus over samme DailySheet (modell A). w3a: ett kort pr.   */
/*  jobb (kort-id, `grupperPaaKort`) med Arbeid/Maskin/Varer/Reise for  */
/*  jobben; linjene med blyant og søppelkasse og lenkeraden pr. jobb.   */
/*  Sedelens ramme vises nedtonet; innsending pr. dag i bunnlinja.      */
/* ------------------------------------------------------------------ */

type KortVare = {
  id: string;
  projectId: string;
  byggeplassId: string | null;
  externalCostObjectId?: string | null;
  sheetTimerId?: string | null;
  kortId?: string | null;
  createdAt?: string | Date;
  antall: number;
  // Punkt 7 (2026-11-13): attestert vare har ingen blyant eller søppelkasse.
  attestert?: boolean;
  vare: { id: string; navn: string; enhet: string };
};

// w3a: én linje i et kort (delt `grupperPaaKort`).
type KortLinje =
  | { type: "timer"; rad: TimerRad; maskiner: MaskinRad[]; varer: KortVare[] }
  | { type: "maskin"; rad: MaskinRad }
  | { type: "vare"; rad: KortVare }
  | { type: "tillegg"; rad: TilleggRad }
  | { type: "utlegg"; rad: UtleggRad }
  | { type: "reise"; rad: TimerRad };

type SkjemaOppsett = Omit<React.ComponentProps<typeof JobbSkjema>, "rader47">;

type JobbKortData = {
  jobb: JobbKontekst;
  linjer: KortLinje[];
  /** Arbeid og reise i jobben (summene i hodet). */
  timer: TimerRad[];
  maskin: MaskinRad[];
  varer: KortVare[];
};

/** Nøkkelen til samlekortet for rader uten kort-id. */
const UTEN_JOBB = "utenJobb";

/** w3b (B37 A): lenken til firmaets moduler. Modulsiden leser firmaet valgt i toppen, så sedelens
 *  firma velges før navigeringen — ellers havner en admin med et annet firma valgt på feil firma. */
function VarelagerLenke({ firmaId, className }: { firmaId: string; className: string }) {
  const { t } = useTranslation();
  const { velgFirma } = useFirma();
  return (
    <p className="mt-1 text-xs text-gray-500" data-testid="varelager-lenke">
      {t("timer.prosjektkort.varelagerAv")}{" "}
      <Link href="/dashbord/firma/moduler" onClick={() => velgFirma(firmaId)} className={className}>
        {t("timer.prosjektkort.slaaPaaVarelager")}
      </Link>
    </p>
  );
}

function ProsjektkortSamleside({
  jobbKort,
  tommeProsjektKort,
  utenJobbLinjer,
  aapentKort,
  onVelgKort,
  skjemaFor,
  utkastSkjema,
  harUlagret,
  kortNavn,
  timerRader,
  maskinRader,
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
  renderLinjer,
  onNyTimer,
  onNyJobb,
  reiseLonnsart,
  visReiseHint,
  onNyReise,
  onNyMaskin,
  onLeggTil,
  varelagerProsjekter,
  varelagerLenkeFirmaId,
  onNyVare,
  onNyttKort,
  onEndreRamme,
  onSlett,
  onSend,
}: {
  jobbKort: JobbKortData[];
  /** Prosjekter lagt til på dagen uten jobb ennå — tomt kort med «+ Timer». */
  tommeProsjektKort: string[];
  /** Rader uten kort-id (ført før kortet pr. jobb) — ett samlekort sist. */
  utenJobbLinjer: KortLinje[];
  aapentKort: string | null;
  onVelgKort: (nokkel: string | null) => void;
  /** § 8.22 L3a: skjemaet for jobben, eller null (jobben står som i dag). */
  skjemaFor: (k: JobbKortData) => SkjemaOppsett | null;
  /** Neste jobb før Til er fylt — eget kort med skjemaet. */
  utkastSkjema: SkjemaOppsett | null;
  /** Noe i et skjema er ikke lagret: «Send dagen» er sperret. */
  harUlagret: boolean;
  kortNavn: (projectId: string) => string;
  timerRader: TimerRad[];
  maskinRader: MaskinRad[];
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
  renderLinjer: (linjer: KortLinje[], jobb: JobbKontekst | undefined) => JSX.Element;
  onNyTimer: (jobb: JobbKontekst) => void;
  /** Tomt prosjektkort: «+ Timer» starter jobben. */
  onNyJobb: (projectId: string) => void;
  /** Løst reise-lønnsart for «+ Reise»; null = knappen skjules. */
  reiseLonnsart: { id: string; navn: string } | null;
  /** Firmaadmin-hint når knappen er skjult (ingen/flere kandidater). */
  visReiseHint: "ingen" | "flere" | null;
  onNyReise: (jobb: JobbKontekst, lonnsart: { id: string; navn: string }) => void;
  onNyMaskin: (jobb: JobbKontekst) => void;
  onLeggTil: (jobb: JobbKontekst) => void;
  varelagerProsjekter: readonly string[] | undefined;
  /** w3b (B37 A): satt (sedelens firma-id) når firmaet ikke har Varelager og brukeren er
   *  firmaadministrator for sedelens firma. */
  varelagerLenkeFirmaId?: string;
  onNyVare: (jobb: JobbKontekst) => void;
  onNyttKort: () => void;
  onEndreRamme: () => void;
  onSlett: () => void;
  onSend: () => void;
}) {
  const { t } = useTranslation();

  // «Send dagen (7,5 t · reise 2 t)»: arbeid og reise hver for seg (ordre
  // 2026-11-14 (6)). Bunnlinja: totalt = arbeid + reise (Kenneth
  // 2026-11-21); trafikklyset regnes mot normen uten reise.
  const dagArbeidReise = arbeidOgReise(timerRader);
  const dag = sumlinjeDag(timerRader, maskinRader, normTimer);
  const sone = dag.sone;
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
  const lenke = "font-medium text-sitedoc-primary hover:underline";
  const antallKort = jobbKort.length + tommeProsjektKort.length;
  // Plan § 8.22 L2 «ikke ferdig»: jobber uten «Hva gjorde du?» merkes, og «Send dagen» åpner
  // den første i stedet for å sende. Samlesiden vises bare i prosjektkort-modus.
  const manglerJobber = erRedigerbar ? jobberSomManglerBeskrivelse(timerRader) : [];
  const [sendSperret, setSendSperret] = useState(false);
  const sendDagen = () => {
    if (harUlagret) return;
    const forste = manglerJobber[0];
    if (forste === undefined) {
      setSendSperret(false);
      onSend();
      return;
    }
    setSendSperret(true);
    onVelgKort(forste.startsWith("rad:") ? UTEN_JOBB : forste);
  };

  // § 8.22 L3a rad 4–7: dagens linjer med blyant og vinduer, og lenken for en ny linje.
  const rader47For = (k: JobbKortData, jobb: JobbKontekst) => {
    const maskiner = k.linjer.flatMap((l): KortLinje[] =>
      l.type === "maskin" ? [l] : l.type === "timer" ? l.maskiner.map((rad) => ({ type: "maskin", rad })) : [],
    );
    const varer = k.linjer.flatMap((l): KortLinje[] =>
      l.type === "vare" ? [l] : l.type === "timer" ? l.varer.map((rad) => ({ type: "vare", rad })) : [],
    );
    const reise = k.linjer.filter((l) => l.type === "reise");
    const tilleggUtlegg = k.linjer.filter((l) => l.type === "tillegg" || l.type === "utlegg");
    const blokk = (linjer: KortLinje[], lenkeTekst: string | null, onLenke: () => void) => (
      <>
        {linjer.length > 0 && renderLinjer(linjer, jobb)}
        {lenkeTekst && (
          <button type="button" onClick={onLenke} className={`text-sm ${lenke}`}>
            {lenkeTekst}
          </button>
        )}
      </>
    );
    const visVare = visVareforbrukKnapp({
      prosjektIderMedVarelager: varelagerProsjekter,
      projectId: jobb.projectId,
      erRedigerbar,
    });
    return [
      { nr: 4, etikett: t("timer.jobbSkjema.maskiner"), innhold: blokk(maskiner, t("timer.prosjektkort.nyMaskin"), () => onNyMaskin(jobb)) },
      {
        nr: 5,
        etikett: t("timer.jobbSkjema.varer"),
        innhold: (
          <>
            {blokk(varer, visVare ? t("timer.prosjektkort.nyVareKort") : null, () => onNyVare(jobb))}
            {varelagerLenkeFirmaId && <VarelagerLenke firmaId={varelagerLenkeFirmaId} className={lenke} />}
          </>
        ),
      },
      {
        nr: 6,
        etikett: t("timer.jobbSkjema.reise"),
        innhold: (
          <>
            {blokk(reise, reiseLonnsart ? t("timer.prosjektkort.nyReise") : null, () =>
              reiseLonnsart ? onNyReise(jobb, reiseLonnsart) : undefined,
            )}
            {visReiseHint && (
              <p className="mt-1 text-xs text-gray-500">
                {visReiseHint === "ingen"
                  ? t("timer.prosjektkort.reiseSkjultIngen")
                  : t("timer.prosjektkort.reiseSkjultFlere")}{" "}
                <Link href="/dashbord/firma/innstillinger#reise-regelsett" className={lenke}>
                  {t("timer.prosjektkort.reiseVelgLonnsart")}
                </Link>
              </p>
            )}
          </>
        ),
      },
      { nr: 7, etikett: t("timer.jobbSkjema.tilleggUtlegg"), innhold: blokk(tilleggUtlegg, t("timer.prosjektkort.leggTil"), () => onLeggTil(jobb)) },
    ];
  };

  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t("timer.prosjektkort.overskrift", { antall: antallKort })}
      </h2>

      {antallKort === 0 && utenJobbLinjer.length === 0 && (
        <div className="mb-3 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.prosjektkort.ingenKort")}
        </div>
      )}

      <div className="space-y-3">
        {jobbKort.map((k) => {
          const { jobb } = k;
          const aapen = aapentKort === jobb.kortId;
          // w15d (B45 A + § 8.19): maskin og vare hører til en timerad — kortet med bare
          // reise har dem ikke før det får en. § 8.22: reise til annet kontor har ingen
          // særregel — alle kort får «+ Timer».
          const harArbeid = k.linjer.some((l) => l.type === "timer");
          const skjema = skjemaFor(k);
          return (
            <JobbKortRamme
              key={jobb.kortId}
              tittel={kortNavn(jobb.projectId)}
              projectId={jobb.projectId}
              ecoId={jobb.ecoId}
              timer={k.timer}
              maskin={k.maskin}
              varer={k.varer}
              sedelByggeplassId={sedelByggeplassId}
              byggeplassNavn={byggeplassNavn}
              byggeplasser={byggeplasser}
              aapen={aapen}
              onVelg={() => onVelgKort(aapen ? null : jobb.kortId)}
              manglerBeskrivelse={manglerJobber.includes(jobb.kortId)}
            >
              {skjema ? (
                <>
                  <JobbSkjema {...skjema} rader47={rader47For(k, jobb)} />
                  <div className="mt-3 text-sm">
                    <button type="button" onClick={() => onNyTimer(jobb)} className={lenke}>
                      {t("timer.prosjektkort.nyTimer")}
                    </button>
                  </div>
                </>
              ) : (
                renderLinjer(k.linjer, jobb)
              )}
              {erRedigerbar && !skjema && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <button type="button" onClick={() => onNyTimer(jobb)} className={lenke}>
                    {t("timer.prosjektkort.nyTimer")}
                  </button>
                  {harArbeid && (
                    <button type="button" onClick={() => onNyMaskin(jobb)} className={lenke}>
                      {t("timer.prosjektkort.nyMaskin")}
                    </button>
                  )}
                  {harArbeid && visVareforbrukKnapp({
                    prosjektIderMedVarelager: varelagerProsjekter,
                    projectId: jobb.projectId,
                    erRedigerbar,
                  }) && (
                    <button type="button" onClick={() => onNyVare(jobb)} className={lenke}>
                      {t("timer.prosjektkort.nyVareKort")}
                    </button>
                  )}
                  {reiseLonnsart && (
                    <button
                      type="button"
                      onClick={() => onNyReise(jobb, reiseLonnsart)}
                      className={lenke}
                    >
                      {t("timer.prosjektkort.nyReise")}
                    </button>
                  )}
                  <button type="button" onClick={() => onLeggTil(jobb)} className={lenke}>
                    {t("timer.prosjektkort.leggTil")}
                  </button>
                </div>
              )}
              {erRedigerbar && !skjema && varelagerLenkeFirmaId && (
                <VarelagerLenke firmaId={varelagerLenkeFirmaId} className={lenke} />
              )}
              {erRedigerbar && !skjema && visReiseHint && (
                <p className="mt-1 text-xs text-gray-500">
                  {visReiseHint === "ingen"
                    ? t("timer.prosjektkort.reiseSkjultIngen")
                    : t("timer.prosjektkort.reiseSkjultFlere")}{" "}
                  <Link href="/dashbord/firma/innstillinger#reise-regelsett" className={lenke}>
                    {t("timer.prosjektkort.reiseVelgLonnsart")}
                  </Link>
                </p>
              )}
            </JobbKortRamme>
          );
        })}

        {tommeProsjektKort.map((projectId) => {
          const aapen = aapentKort === projectId;
          return (
            <JobbKortRamme
              key={projectId}
              tittel={kortNavn(projectId)}
              projectId={projectId}
              ecoId={null}
              timer={[]}
              maskin={[]}
              varer={[]}
              sedelByggeplassId={sedelByggeplassId}
              byggeplassNavn={byggeplassNavn}
              byggeplasser={byggeplasser}
              aapen={aapen}
              onVelg={() => onVelgKort(aapen ? null : projectId)}
            >
              {erRedigerbar && (
                <button type="button" onClick={() => onNyJobb(projectId)} className={`text-sm ${lenke}`}>
                  {t("timer.prosjektkort.nyTimer")}
                </button>
              )}
            </JobbKortRamme>
          );
        })}

        {utkastSkjema && (
          <JobbKortRamme
            key={utkastSkjema.kortId}
            tittel={kortNavn(utkastSkjema.projectId)}
            projectId={utkastSkjema.projectId}
            ecoId={null}
            timer={[]}
            maskin={[]}
            varer={[]}
            sedelByggeplassId={sedelByggeplassId}
            byggeplassNavn={byggeplassNavn}
            byggeplasser={byggeplasser}
            aapen={aapentKort === utkastSkjema.kortId}
            onVelg={() => onVelgKort(aapentKort === utkastSkjema.kortId ? null : utkastSkjema.kortId)}
          >
            <JobbSkjema
              {...utkastSkjema}
              rader47={[
                { nr: 4, etikett: t("timer.jobbSkjema.maskiner"), innhold: null },
                { nr: 5, etikett: t("timer.jobbSkjema.varer"), innhold: null },
                { nr: 6, etikett: t("timer.jobbSkjema.reise"), innhold: null },
                { nr: 7, etikett: t("timer.jobbSkjema.tilleggUtlegg"), innhold: null },
              ]}
            />
          </JobbKortRamme>
        )}

        {utenJobbLinjer.length > 0 && (
          <JobbKortRamme
            tittel={t("timer.prosjektkort.utenJobb")}
            undertittel={t("timer.prosjektkort.utenJobbHint")}
            projectId={null}
            ecoId={null}
            timer={utenJobbLinjer.flatMap((l) =>
              l.type === "timer" || l.type === "reise" ? [l.rad] : [],
            )}
            maskin={utenJobbLinjer.flatMap((l) => (l.type === "maskin" ? [l.rad] : []))}
            varer={utenJobbLinjer.flatMap((l) => (l.type === "vare" ? [l.rad] : []))}
            sedelByggeplassId={sedelByggeplassId}
            byggeplassNavn={byggeplassNavn}
            byggeplasser={byggeplasser}
            aapen={aapentKort === UTEN_JOBB}
            onVelg={() => onVelgKort(aapentKort === UTEN_JOBB ? null : UTEN_JOBB)}
            manglerBeskrivelse={utenJobbLinjer.some(
              (l) => l.type === "timer" && manglerJobber.includes(`rad:${l.rad.id}`),
            )}
            stiplet
          >
            {renderLinjer(utenJobbLinjer, undefined)}
          </JobbKortRamme>
        )}
      </div>

      {erRedigerbar && kanLeggeTilKort && (
        <button
          type="button"
          onClick={onNyttKort}
          className="mt-3 w-full rounded-lg border border-dashed border-gray-300 p-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
        >
          <span className="text-gray-900">{t("timer.prosjektkort.registrerTimer")}</span>
          <span className="font-normal text-gray-500"> · {t("timer.prosjektkort.registrerTimerHint")}</span>
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
              kort: kortNavn(pauseBaerer.projectId),
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
            {t("timer.prosjektkort.sumArbeid", {
              timer: formaterTimer(dag.arbeid),
              norm: normTimer === null ? "?" : formaterTimer(normTimer),
            })}
            {dag.maskin > 0 &&
              ` · ${t("timer.prosjektkort.sumMaskin", { timer: formaterTimer(dag.maskin) })}`}
            {dag.reise > 0 &&
              ` · ${t("timer.prosjektkort.sumReise", { timer: formaterTimer(dag.reise) })}`}
            {` · ${t("timer.prosjektkort.sumTotalt", { timer: formaterTimer(dag.totalt) })}`}
          </span>
          <div className="ml-auto flex gap-2">
            {kanSlette && (
              <Button variant="secondary" onClick={onSlett} disabled={sletter}>
                <Trash2 className="mr-1 h-4 w-4" />
                {t("timer.detalj.slett")}
              </Button>
            )}
            <KnappMedForklaring
              sperret={(timerRader.length === 0 || manglerJobber.length > 0 || harUlagret) && !sender}
              forklaring={
                timerRader.length === 0
                  ? t("sperret.minstEnRad")
                  : harUlagret
                    ? t("timer.jobbSkjema.ulagretSperre")
                    : t("timer.prosjektkort.sendSperretBeskrivelse")
              }
            >
              <Button
                onClick={sendDagen}
                disabled={sender || timerRader.length === 0 || harUlagret}
                className={manglerJobber.length > 0 ? "opacity-50" : undefined}
              >
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
                    return t(tekst.nokkel, { timer: formaterTimer(tekst.timer) });
                  }
                  return t(tekst.nokkel, {
                    timer: formaterTimer(tekst.timer),
                    reise: formaterTimer(tekst.reise),
                  });
                })()}
              </Button>
            </KnappMedForklaring>
          </div>
          {sendSperret && manglerJobber.length > 0 && (
            <p className="w-full text-sm text-red-600" role="alert">
              {t("timer.prosjektkort.sendSperretBeskrivelse")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * w3a: ett kort — hodet (prosjekt, byggeplass · underprosjekt, fire summer for jobben) og
 * innholdet når kortet er åpent. Underprosjektet står i hodet, ikke i en bøtte (A).
 */
function JobbKortRamme({
  tittel,
  undertittel,
  projectId,
  ecoId,
  timer,
  maskin,
  varer,
  sedelByggeplassId,
  byggeplassNavn,
  byggeplasser,
  aapen,
  onVelg,
  stiplet,
  manglerBeskrivelse,
  children,
}: {
  tittel: string;
  undertittel?: string;
  /** null = samlekortet (ingen byggeplass/underprosjekt i hodet). */
  projectId: string | null;
  ecoId: string | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
  varer: KortVare[];
  sedelByggeplassId: string | null;
  byggeplassNavn: Map<string, string>;
  byggeplasser: ByggeplassValg[] | undefined;
  aapen: boolean;
  onVelg: () => void;
  stiplet?: boolean;
  /** Plan § 8.22 L2: jobben mangler «Hva gjorde du?» — merket står også når kortet er lukket. */
  manglerBeskrivelse?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const sedelFirmaId = useSedelFirma();
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: projectId ?? "", organizationId: sedelFirmaId },
    { enabled: !!projectId && !!ecoId },
  );
  const eco = ecoId ? (ecoer ?? []).find((e) => e.id === ecoId) : undefined;
  const enhet = t("timer.timerEnhet");
  const visTimer = (n: number) =>
    n > 0
      ? `${formaterTimer(n)} ${enhet}`
      : "—";
  const summer = beregnKortSummer(timer, maskin, varer);
  // w15d (F19, F20): hodet regner sted og klokke av arbeidet — reisen teller ikke. Et kort
  // uten arbeid er reise: merket «Reise», reisens sted og klokka for reisene.
  const arbeid = timer.filter((r) => !r.erReise);
  const reiseRader = timer.filter((r) => r.erReise);
  const bareReise = arbeid.length === 0 && reiseRader.length > 0;
  const stedKilde = bareReise ? reiseRader : arbeid;
  const fraer = stedKilde.map((r) => r.fraTid).filter((x): x is string => !!x);
  const tiler = stedKilde.map((r) => r.tilTid).filter((x): x is string => !!x);
  const klokke =
    fraer.length > 0 && tiler.length > 0
      ? `${fraer.reduce((a, b) => (hhmmTilMin(b) < hhmmTilMin(a) ? b : a))}–${tiler.reduce((a, b) => (hhmmTilMin(b) > hhmmTilMin(a) ? b : a))}`
      : "";
  const bp = projectId
    ? utledKortByggeplass([...stedKilde, ...maskin], sedelByggeplassId, {
        projectId,
        byggeplassProsjekt: (id) => byggeplasser?.find((b) => b.id === id)?.projectId,
      })
    : ({ type: "ingen" } as const);
  const status = kortStatus([...timer, ...maskin]);
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
  const stedDeler = [
    bp.type === "en"
      ? byggeplassNavn.get(bp.id) ?? ""
      : bp.type === "flere"
        ? t("timer.prosjektkort.flereByggeplasser", { antall: bp.antall })
        : "",
    klokke,
    ecoId
      ? eco
        ? `${eco.proAdmId} ${eco.kortNavn}`
        : t("timer.detalj.ukjentEco")
      : "",
  ].filter(Boolean);

  return (
    <div
      className={`rounded-lg border bg-white ${
        aapen
          ? "border-blue-400 ring-1 ring-blue-200"
          : stiplet
            ? "border-dashed border-gray-300"
            : "border-gray-200"
      }`}
    >
      <button
        type="button"
        aria-expanded={aapen}
        onClick={onVelg}
        className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-900">{tittel}</span>
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
            {manglerBeskrivelse && (
              <span
                data-testid="mangler-beskrivelse"
                className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
              >
                {t("timer.dagsoversikt.manglerBeskrivelse")}
              </span>
            )}
          </div>
          {(stedDeler.length > 0 || undertittel || bareReise) && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
              {bareReise && !undertittel && (
                <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">
                  {t("timer.prosjektkort.reiseMerke")}
                </span>
              )}
              <span className="truncate">{undertittel ?? stedDeler.join(" · ")}</span>
            </div>
          )}
          {ecoId && (
            <span
              className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800"
              title={t("timer.gruppe.tilByggherreHint")}
            >
              → {t("timer.gruppe.tilByggherre")}
            </span>
          )}
        </div>
        <dl className="flex gap-6">
          {kolonner.map(([etikett, verdi]) => (
            <div key={etikett} className="min-w-[56px] text-right">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">{etikett}</dt>
              <dd className="text-sm font-medium tabular-nums text-gray-900">{verdi}</dd>
            </div>
          ))}
        </dl>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${aapen ? "rotate-180" : ""}`}
        />
      </button>
      {aapen && <div className="border-t border-gray-100 px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

/**
 * w3a: varelinjer i kortet med blyant og søppelkasse. Blyanten åpner vare-vinduet med
 * linja (mengden kan rettes); søppelkassen spør før sletting. Attestert vare er låst.
 */
function RaderVare({
  rader,
  erRedigerbar,
  byggeplassNavn,
  onRediger,
}: {
  rader: KortVare[];
  erRedigerbar: boolean;
  byggeplassNavn: Map<string, string>;
  onRediger: (rad: KortVare) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [bekreft, setBekreft] = useState<KortVare | null>(null);
  const slett = trpc.vareforbruk.slett.useMutation({
    onSuccess: () => {
      void utils.vareforbruk.hentMineForDato.invalidate();
      setBekreft(null);
    },
    onError: (e: { message: string }) => alert(e.message),
  });
  return (
    <>
      {bekreft && (
        <Modal open={true} onClose={() => setBekreft(null)} title={t("timer.prosjektkort.slettVareTittel")}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("timer.prosjektkort.slettVareTekst", {
                navn: bekreft.vare.navn,
                antall: bekreft.antall.toLocaleString("nb-NO"),
                enhet: bekreft.vare.enhet,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBekreft(null)}>
                {t("handling.avbryt")}
              </Button>
              <Button
                variant="danger"
                loading={slett.isPending}
                onClick={() => slett.mutate({ id: bekreft.id })}
              >
                {t("handling.slett")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <ul className="divide-y divide-gray-100">
        {rader.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-2">
            <p className="text-sm font-medium text-gray-900">
              <span className="mr-2 inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                {t("timer.prosjektkort.vareMerke")}
              </span>
              {v.vare.navn}
              {v.byggeplassId && byggeplassNavn.get(v.byggeplassId)
                ? ` · ${byggeplassNavn.get(v.byggeplassId)}`
                : ""}
            </p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {v.antall.toLocaleString("nb-NO")} {v.vare.enhet}
              </span>
              {erRedigerbar && !v.attestert && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onRediger(v)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    title={t("handling.rediger")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setBekreft(v)}
                    className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
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
    </>
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
  const sedelFirmaId = useSedelFirma();
  // § 11.6: gruppen uten prosjekt (fravær) har ingen underprosjekter å slå opp.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId, organizationId: sedelFirmaId },
    { enabled: !!projectId },
  );
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
          {projectId === null
            ? t("timer.detalj.fravaerUtenProsjekt")
            : (prosjektNavn?.name ?? t("timer.detalj.ukjentProsjekt"))}
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
            maskinIProsjekt={ecoBuckets.flatMap((b) => b.maskin)}
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
  maskinIProsjekt,
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
  // Ordre d2c-1: alle maskinrader i prosjektet — en timerads maskiner kan stå i
  // en annen underprosjekt-bøtte, men aldri i et annet prosjekt (R24).
  maskinIProsjekt: MaskinRad[];
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
              ({formaterTimer(sumTimer)} {t("timer.timerEnhet")})
            </span>
            {sumReise > 0 && (
              <span className="ml-2 font-mono font-normal normal-case text-gray-500">
                {t("timer.gruppe.reise", { timer: formaterTimer(sumReise) })}
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
                maskinIProsjekt={maskinIProsjekt}
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
          {t("timer.gruppe.maskin", { maskin: formaterTimer(sumMaskin) })}
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

/**
 * w15d (F18, § 4.15 del C pkt. 2): reiselinja i prosjektkortet — merket «Reise», «Til/Fra
 * {sted}» og klokka; under: beskrivelse · lønnsart. Ingen aktivitet og ingen matpause.
 * Underprosjektet vises når det avviker fra jobbens (B48 A: «Uten underprosjekt» når reisen
 * ikke har og jobben har). Knappene er de samme som på arbeidslinja. `RaderTimer` (begge
 * moduser) er urørt.
 */
function ReiseLinje({
  rad,
  jobbEcoId,
  prosjektNavn,
  byggeplassNavn,
  maskinIProsjekt,
  erRedigerbar,
  onRediger,
  onSplitt,
}: {
  rad: TimerRad;
  /** Jobbens underprosjekt; undefined = samlekortet (ingen jobb å sammenligne med). */
  jobbEcoId: string | null | undefined;
  prosjektNavn: string;
  byggeplassNavn: Map<string, string>;
  maskinIProsjekt: MaskinRad[];
  erRedigerbar: boolean;
  onRediger: (rad: TimerRad) => void;
  onSplitt: (rad: TimerRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery({ organizationId: sedelFirmaId });
  const ecoAvviker = jobbEcoId !== undefined && (rad.externalCostObjectId ?? null) !== (jobbEcoId ?? null);
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: rad.projectId, organizationId: sedelFirmaId },
    { enabled: ecoAvviker && !!rad.externalCostObjectId },
  );
  const fjern = trpc.timer.dagsseddel.fjernTimerRad.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId });
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string | null; modell: string | null; internNavn: string | null; utleieEnhet?: string | null }>
    | undefined;
  const [bekreftSlett, setBekreftSlett] = useState<string[] | null>(null);
  // Samme sperre som arbeidslinja (d2c-1, R24): maskiner som krever raden, navngis først.
  function slett() {
    const navn = maskinIProsjekt
      .filter((m) => m.sheetTimerId === rad.id)
      .flatMap((m) => {
        const e = equipment?.find((x) => x.id === m.vehicleId);
        if (e && !maskinKreverTimerad(e.utleieEnhet)) return [];
        const merkeModell = [e?.merke, e?.modell].filter(Boolean).join(" ");
        return [merkeModell || e?.internNavn || "—"];
      });
    if (navn.length > 0) setBekreftSlett(navn);
    else fjern.mutate({ id: rad.id });
  }

  const sted = (rad.byggeplassId && byggeplassNavn.get(rad.byggeplassId)) || prosjektNavn;
  // § 8.22 punkt 2: reise til annet kontor har ingen egen linjetekst — vanlig reise.
  const stedTekst =
    rad.reiseRetning === "ut"
      ? t("timer.prosjektkort.reiseTil", { sted })
      : rad.reiseRetning === "retur"
        ? t("timer.prosjektkort.reiseFra", { sted })
        : sted;
  const eco = rad.externalCostObjectId
    ? (ecoer ?? []).find((e) => e.id === rad.externalCostObjectId)
    : undefined;
  const ecoTekst = !ecoAvviker
    ? null
    : rad.externalCostObjectId
      ? eco
        ? `${eco.proAdmId} ${eco.kortNavn}`
        : t("timer.detalj.ukjentEco")
      : t("timer.prosjektkort.utenUnderprosjekt");
  const lonnsart = lonnsarter?.find((l) => l.id === rad.lonnsartId)?.navn;
  const under = [rad.beskrivelse, lonnsart, ecoTekst].filter(Boolean).join(" · ");
  const hoved = (
    <>
      <span className="mr-2 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
        {t("timer.prosjektkort.reiseMerke")}
      </span>
      <span className="text-sm font-medium text-gray-900">{stedTekst}</span>
      {rad.fraTid && rad.tilTid && (
        <span className="ml-2 text-xs text-gray-500">
          {rad.fraTid}–{rad.tilTid}
        </span>
      )}
    </>
  );

  return (
    <>
      {bekreftSlett && (
        <Modal open={true} onClose={() => setBekreftSlett(null)} title={t("timer.fjernTimerRad.tittel")}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {t("timer.fjernTimerRad.maskiner", {
                count: bekreftSlett.length,
                navn: bekreftSlett.join(", "),
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBekreftSlett(null)}>
                {t("handling.avbryt")}
              </Button>
              <Button
                variant="danger"
                loading={fjern.isPending}
                onClick={() =>
                  fjern.mutate(
                    { id: rad.id, slettMaskiner: true },
                    { onSettled: () => setBekreftSlett(null) },
                  )
                }
              >
                {t("timer.fjernTimerRad.bekreft")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      <ul>
        <li className="flex items-center justify-between py-2" data-reiselinje={rad.id}>
          <div className="min-w-0">
            {erRedigerbar ? (
              <button type="button" onClick={() => onRediger(rad)} className="block text-left hover:underline">
                {hoved}
              </button>
            ) : (
              <p>{hoved}</p>
            )}
            {under && <p className="mt-0.5 text-xs text-gray-500">{under}</p>}
            <KorrigertMerke type="timer" radId={rad.id} />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-gray-900">
              {formaterTimer(tilTall(rad.timer))} {t("timer.timerEnhet")}
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
                  onClick={slett}
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
      </ul>
    </>
  );
}

function RaderTimer({
  rader,
  maskinIProsjekt,
  erRedigerbar,
  pauseVisning,
  radLinje,
  onRediger,
  onSplitt,
}: {
  rader: TimerRad[];
  maskinIProsjekt: MaskinRad[];
  erRedigerbar: boolean;
  // V20/PK3: dagens pause-kontekst → kryss/tom avkrysning pr. rad.
  pauseVisning: PauseVisning;
  radLinje: RadLinjeKontekst;
  onRediger: (rad: TimerRad) => void;
  onSplitt: (rad: TimerRad) => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery({ organizationId: sedelFirmaId });
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery({ organizationId: sedelFirmaId });

  const fjern = trpc.timer.dagsseddel.fjernTimerRad.useMutation({
    onSuccess: () => void utils.timer.dagsseddel.hentMedId.invalidate(),
    onError: (e: { message: string }) => alert(e.message),
  });

  // Ordre d2c-1 (R24): maskiner som krever raden, slettes bare etter en
  // bekreftelse som navngir dem. Døgn-maskiner blir stående (serveren nuller koblingen).
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId });
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string | null; modell: string | null; internNavn: string | null; utleieEnhet?: string | null }>
    | undefined;
  const [bekreftSlett, setBekreftSlett] = useState<{ radId: string; navn: string[] } | null>(null);
  function slettRad(rad: TimerRad) {
    const navn = maskinIProsjekt
      .filter((m) => m.sheetTimerId === rad.id)
      .flatMap((m) => {
        const e = equipment?.find((x) => x.id === m.vehicleId);
        if (e && !maskinKreverTimerad(e.utleieEnhet)) return [];
        const merkeModell = [e?.merke, e?.modell].filter(Boolean).join(" ");
        return [merkeModell || e?.internNavn || "—"];
      });
    if (navn.length > 0) setBekreftSlett({ radId: rad.id, navn });
    else fjern.mutate({ id: rad.id });
  }

  return (
    <>
    {bekreftSlett && (
      <Modal
        open={true}
        onClose={() => setBekreftSlett(null)}
        title={t("timer.fjernTimerRad.tittel")}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {t("timer.fjernTimerRad.maskiner", {
              count: bekreftSlett.navn.length,
              navn: bekreftSlett.navn.join(", "),
            })}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBekreftSlett(null)}>
              {t("handling.avbryt")}
            </Button>
            <Button
              variant="danger"
              loading={fjern.isPending}
              onClick={() =>
                fjern.mutate(
                  { id: bekreftSlett.radId, slettMaskiner: true },
                  { onSettled: () => setBekreftSlett(null) },
                )
              }
            >
              {t("timer.fjernTimerRad.bekreft")}
            </Button>
          </div>
        </div>
      </Modal>
    )}
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
              {/* w15g: «Korrigert av» (bare i prosjektkort-modus, via kontekst). */}
              <KorrigertMerke type="timer" radId={rad.id} />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {formaterTimer(tilTall(rad.timer))} {t("timer.timerEnhet")}
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
                    onClick={() => slettRad(rad)}
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
    </>
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
  const sedelFirmaId = useSedelFirma();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery({ organizationId: sedelFirmaId });

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
              <KorrigertMerke type="tillegg" radId={rad.id} />
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-900">
                {type === "avhuking"
                  ? tilTall(rad.antall) > 0
                    ? "✓"
                    : "—"
                  : formaterTimer(tilTall(rad.antall))}
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
  const sedelFirmaId = useSedelFirma();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId });
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
                    {formaterTimer(tilTall(rad.mengde))} {rad.enhet ?? ""}
                  </p>
                )}
                <KorrigertMerke type="maskin" radId={rad.id} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-gray-900">
                  {formaterTimer(tilTall(rad.timer))} {t("timer.timerEnhet")}
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

// w3b: utstyrets navn som i maskinlinja i kortet («Merke Modell (internnavn)»).
function utstyrVisningsnavn(e: { merke: string | null; modell: string | null; internNavn: string | null }): string {
  const merkeModell = [e.merke, e.modell].filter(Boolean).join(" ");
  return merkeModell ? `${merkeModell}${e.internNavn ? ` (${e.internNavn})` : ""}` : (e.internNavn ?? "—");
}

function TimerRadDialog({
  sheetId,
  organizationId,
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
  kortId,
  jobb,
  kortModus,
  sedelByggeplassId,
  kortRaderUtenArbeid,
  kortEier,
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
  /** w2 (B1, WM59): «+ Registrer timer» — ny jobb = nytt kort. Sendes på alle nye
   *  rader dialogen lager (også overtid-delen), så jobben står samlet på ett kort. */
  kortId?: string;
  /** w3a (S1 A, S7 A): vinduet er åpnet fra en jobb. Prosjekt, underprosjekt og byggeplass
   *  arves fra jobben og vises ikke; ny rad sendes med jobbens sted. */
  jobb?: JobbKontekst;
  /** w3b (A13, S2 A): prosjektkort-modus — maskindelen er lik i «Legg til» og «Rediger»,
   *  viser jobbens maskiner og én ny linje med Utstyr og Antall timer. Uten: som i dag. */
  kortModus?: boolean;
  /** w15d: sedelens byggeplass — jobbenes effektive byggeplass i teksten under lønnsarten. */
  sedelByggeplassId?: string | null;
  /** w15f (F55): maskin, tillegg og utlegg på sedelen — linja «havner i» ser kort uten arbeid. */
  kortRaderUtenArbeid?: readonly ReiseHavnerAnnenRad[];
  /** w15f (F55): sedelens eier og dato — reisens egen kort-id regnes som på serveren. */
  kortEier?: { userId: string; dato: string };
  onLukk: () => void;
}) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery({ organizationId: sedelFirmaId });
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery({ organizationId: sedelFirmaId });

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
  // endres (raden opprettes under valgt prosjekt); ved redigering er den låst for
  // arbeid. w15f: på en reise kan prosjektet byttes (`oppdaterTimerRad` tar det imot).
  const [valgtProjectId, setValgtProjectId] = useState<string>(
    rad?.projectId ?? projectId,
  );
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: valgtProjectId, organizationId: sedelFirmaId },
    // § 11.6: en fraværsrad uten prosjekt har ingen underprosjekter.
    { enabled: !!valgtProjectId },
  );
  // Ordre (10): følger valgt prosjekt — prosjektbytte nullstiller ugyldig valg.
  // w3a: ny rad i en jobb tar jobbens byggeplass (ingen auto-forslag) — jobben er stedet.
  const bp = useRadByggeplass({
    byggeplasser,
    projectId: valgtProjectId,
    rad: rad ?? (jobb ? { byggeplassId: jobb.byggeplassId } : undefined),
  });

  // T.10 / §2.D: maskinvelger for kostnadsbærer ved maskinvedlikehold. Hentes
  // kun for interne prosjekter (verksted). Tom liste / inaktiv maskin-modul →
  // feltet skjules. Org-validering håndheves uansett på server.
  const erInternt =
    prosjekter.find((p) => p.id === valgtProjectId)?.type === "internt";
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId }, {
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
  // § 8.22 punkt 7 (O4): «Legg til timer-rad» fra en jobb forvelger «—» (uten underprosjekt),
  // ikke jobbens underprosjekt.
  const [ecoId, setEcoId] = useState<string | null>(
    rad ? (rad.externalCostObjectId ?? null) : jobb ? null : (defaultEcoId ?? null),
  );
  // O4: en ny rad med annen kort-nøkkel (prosjekt|byggeplass|underprosjekt) enn jobbens blir en
  // egen jobb med egen kort-id (regel 1) — registreringer slås aldri sammen med en annen jobb.
  // Lik nøkkel: jobbens kort-id som før.
  const [egenJobbKortId] = useState(() => nyKortId());
  const nyRadEgenJobb =
    !!jobb &&
    !rad &&
    kortIdNokkel({ projectId: valgtProjectId, byggeplassId: bp.byggeplassId ?? null, ecoId }) !==
      kortIdNokkel({ projectId: jobb.projectId, byggeplassId: jobb.byggeplassId, ecoId: jobb.ecoId });
  const lagreKortId = nyRadEgenJobb ? egenJobbKortId : kortId;
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
  // w15d (§ 4.15 del C pkt. 4, F21): er lønnsarten reise, sier vinduet hvor reisen havner —
  // samme regel som reisevinduet (`reiseHavnerI` → `velgReiseKort`), så teksten følger
  // regelen når w15c merges. Bare prosjektkort-modus; dagskortet er urørt.
  const valgtLonnsartNavn = lonnsarter?.find((l) => l.id === lonnsartId)?.navn ?? "";
  const erReiseValgt =
    !!kortModus && !!lonnsartId && erReiseLonnsart(lonnsartId, valgtLonnsartNavn, reiseKontekst);
  // Plan § 8.22 L2: i prosjektkort-modus er «Hva gjorde du?» påkrevd på arbeid — ett kort = én
  // beskrivelse, så feltet kan stå tomt når en annen arbeidsrad i samme jobb alt har den (overtid).
  // Reise og dagskort-modus: valgfritt som før.
  const jobbensKortId = rad?.kortId ?? lagreKortId ?? jobb?.kortId ?? null;
  const annenRadHarBeskrivelse =
    jobbensKortId != null &&
    alleTimerRader.some(
      (r) =>
        r.id !== rad?.id &&
        r.kortId === jobbensKortId &&
        // Samme filter som sperren: ikke reise, ikke `erstattet`, ikke uten prosjekt.
        radGirJobbBeskrivelse(r),
    );
  const beskrivelsePakrevd =
    !!kortModus && !erReiseValgt && rad?.erReise !== true && !annenRadHarBeskrivelse;
  const beskrivelseMangler = beskrivelsePakrevd && beskrivelse.trim() === "";
  const reiseHavner = erReiseValgt
    ? reiseHavnerI({
        rader: alleTimerRader
          .filter((r) => r.id !== rad?.id)
          .map((r) => ({
            fraTid: r.fraTid,
            erReise: r.erReise ?? false,
            kortId: r.kortId ?? null,
            projectId: r.projectId,
            ecoId: r.externalCostObjectId,
            byggeplassId: r.byggeplassId,
            opprettet: r.createdAt ? new Date(r.createdAt).getTime() : 0,
            attestertStatus: r.attestertStatus,
          })),
        andreRader: kortRaderUtenArbeid,
        eier: kortEier ?? null,
        sedelByggeplass: sedelByggeplassId
          ? ((byggeplasser ?? []).find((b) => b.id === sedelByggeplassId) ?? null)
          : null,
        reise: {
          projectId: valgtProjectId,
          ecoId,
          byggeplassId: bp.byggeplassId,
          retning:
            rad?.reiseRetning === "ut" || rad?.reiseRetning === "retur" ? rad.reiseRetning : null,
          fraTid: fraTid || null,
          erReise: true,
        },
        // § 8.22 punkt 3: en lagret reise blir i kortet sitt til prosjekt/byggeplass/underprosjekt rettes.
        lagret: rad
          ? {
              kortId: rad.kortId ?? null,
              projectId: rad.projectId,
              byggeplassId: rad.byggeplassId,
              ecoId: rad.externalCostObjectId,
              erReise: rad.erReise ?? false,
            }
          : null,
      })
    : null;
  // w15f (§ 4.15 del E): prosjektfeltet er åpent på en reise som finnes, låst for arbeid.
  const prosjektApent = !!rad && !!rad.erReise && erReiseValgt;
  const prosjektByttet = !!rad && valgtProjectId !== rad.projectId;
  function byttProsjekt(id: string) {
    setValgtProjectId(id);
    setEcoId(null); // ECO tilhører gammelt prosjekt
    // w15f: på en reise foreslås byggeplassen på nytt for det nye prosjektet, som i reisevinduet.
    if (rad) {
      bp.setByggeplassId(
        velgStandardByggeplass({ gjeldende: null, kandidater: byggeplasserForProsjekt(byggeplasser, id), toppbar: null }),
      );
    }
  }
  // w15f: bytter arbeideren lønnsarten bort fra reise etter et prosjektbytte, går prosjektet
  // og stedet tilbake til radens — arbeid bytter ikke prosjekt.
  useEffect(() => {
    if (!rad || prosjektApent || valgtProjectId === rad.projectId) return;
    setValgtProjectId(rad.projectId);
    setEcoId(rad.externalCostObjectId ?? null);
    bp.setByggeplassId(rad.byggeplassId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prosjektApent]);
  // Prosjekt, byggeplass og underprosjekt sendes i samme kall når prosjektet er byttet.
  const prosjektPayload = prosjektByttet
    ? { projectId: valgtProjectId, byggeplassId: bp.byggeplassId, externalCostObjectId: ecoId }
    : {};
  const reiseHavnerTekst = !reiseHavner
    ? null
    : reiseHavner.type === "jobb"
      ? t("timer.rediger.reiseHavnerJobb", {
          sted:
            (reiseHavner.byggeplassId &&
              (byggeplasser ?? []).find((b) => b.id === reiseHavner.byggeplassId)?.name) ||
            prosjekter.find((p) => p.id === reiseHavner.projectId)?.name ||
            "",
        })
      : reiseHavner.type === "kort"
        ? t("timer.rediger.reiseHavnerKort", {
            sted:
              (reiseHavner.byggeplassId &&
                (byggeplasser ?? []).find((b) => b.id === reiseHavner.byggeplassId)?.name) ||
              prosjekter.find((p) => p.id === reiseHavner.projectId)?.name ||
              "",
          })
        : t("timer.rediger.reiseHavnerEget");
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
  const { data: maskinEquipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId });
  const maskinEquipment = maskinEquipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
        utleieEnhet?: string | null;
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

  // w9 (2c): «høyst X t» for maskinen på den nye timeraden. Maskinen får radens
  // timer og følger radens jobb (K6). Jobben er den eldste med samme prosjekt,
  // byggeplass og underprosjekt (regel 3), ellers en ny jobb uten andre maskiner.
  // Delt regel med serveren (maskinHoystPerRad); serveren avgjør til slutt.
  const maskinHoyst = useMemo(() => {
    if (!maskinVehicleId) return null;
    const utstyr = maskinEquipment?.find((e) => e.id === maskinVehicleId);
    if (!utstyr) return null;
    const jobb = alleTimerRader.find(
      (r) =>
        r.kortId &&
        r.erReise !== true &&
        r.projectId === valgtProjectId &&
        (r.externalCostObjectId ?? null) === (ecoId ?? null) &&
        (r.byggeplassId ?? null) === (bp.byggeplassId ?? null),
    );
    const kortId = jobb?.kortId ?? "ny-jobb";
    const nyTimer = parseFloat(timer);
    const nyTimerTall = isNaN(nyTimer) ? 0 : nyTimer;
    const enhetFor = (vehicleIdArg: string) =>
      maskinEquipment?.find((e) => e.id === vehicleIdArg)?.utleieEnhet ?? null;
    const [denne] = maskinHoystPerRad(
      [
        ...alleTimerRader.map((r) => ({
          kortId: r.kortId ?? null,
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId,
          timer: tilTall(r.timer),
          erReise: r.erReise === true,
        })),
        { kortId, projectId: valgtProjectId, externalCostObjectId: ecoId, timer: nyTimerTall, erReise: false },
      ],
      [
        { kortId, projectId: valgtProjectId, externalCostObjectId: ecoId, timer: nyTimerTall, utleieEnhet: utstyr.utleieEnhet ?? null },
        ...alleMaskinRader.map((r) => ({
          kortId: r.kortId ?? null,
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId,
          timer: tilTall(r.timer),
          utleieEnhet: enhetFor(r.vehicleId),
        })),
      ],
    );
    return denne ?? null;
  }, [maskinVehicleId, maskinEquipment, alleTimerRader, alleMaskinRader, valgtProjectId, ecoId, bp.byggeplassId, timer]);
  const maskinOverHoyst = overMaskinHoyst(parseFloat(timer) || 0, maskinHoyst);

  // w3b (A13, S2 A): maskindelen i prosjektkort-modus. Jobben er kortet (jobbens, radens
  // eller den nye jobbens kort-id); eldre rad uten kort: maskinene koblet til raden.
  const jobbKortId = nyRadEgenJobb ? egenJobbKortId : (jobb?.kortId ?? rad?.kortId ?? kortId ?? null);
  const visKortMaskin = !!kortModus && rad?.erReise !== true;
  const [jobbMaskiner, setJobbMaskiner] = useState<
    Array<{ rad: MaskinRad; timer: string; fjernet: boolean; laast: boolean }>
  >(() =>
    // § 8.22 punkt 3 (O3): «Legg til timer-rad» starter tom — en maskin som føres der, hører
    // bare til den nye raden. «Rediger timer-rad» viser jobbens maskiner som før (punkt 6).
    !visKortMaskin || !rad
      ? []
      : alleMaskinRader
          .filter((m) =>
            jobbKortId ? m.kortId === jobbKortId : !!rad && m.sheetTimerId === rad.id,
          )
          .map((m) => ({
            rad: m,
            timer: String(tilTall(m.timer)),
            fjernet: false,
            laast: m.attestertStatus === "attestert",
          })),
  );
  const [nyMaskinTimerInput, setNyMaskinTimerInput] = useState<string>("");
  const [nyMaskinRort, setNyMaskinRort] = useState(false);
  const enhetForUtstyr = (vehicleIdArg: string) =>
    maskinEquipment?.find((e) => e.id === vehicleIdArg)?.utleieEnhet ?? null;
  const nyUtstyr = maskinEquipment?.find((e) => e.id === maskinVehicleId);
  // Timeradene med denne radens gjeldende verdier, og nøkkelen ny maskin får.
  const kortTimerLive = useMemo(() => {
    const nyTimer = parseFloat(timer);
    return [
      ...alleTimerRader
        .filter((r) => r.id !== rad?.id)
        .map((r) => ({
          kortId: r.kortId ?? null,
          projectId: r.projectId,
          externalCostObjectId: r.externalCostObjectId,
          timer: tilTall(r.timer),
          erReise: r.erReise === true,
        })),
      {
        kortId: rad ? (rad.kortId ?? null) : (jobbKortId ?? "ny-jobb"),
        projectId: valgtProjectId,
        externalCostObjectId: ecoId,
        timer: isNaN(nyTimer) ? 0 : nyTimer,
        erReise: rad?.erReise === true,
      },
    ];
  }, [alleTimerRader, rad, jobbKortId, valgtProjectId, ecoId, timer]);
  const nyMaskinNokkel = {
    kortId: jobbKortId ?? (rad ? null : "ny-jobb"),
    projectId: valgtProjectId,
    externalCostObjectId: ecoId,
  };
  const andreMaskinerLive = useMemo(() => {
    const jobbIder = new Set(jobbMaskiner.map((l) => l.rad.id));
    return alleMaskinRader
      .filter((m) => !jobbIder.has(m.id))
      .map((m) => ({
        kortId: m.kortId ?? null,
        projectId: m.projectId,
        externalCostObjectId: m.externalCostObjectId,
        timer: tilTall(m.timer),
        utleieEnhet: enhetForUtstyr(m.vehicleId),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alleMaskinRader, jobbMaskiner, maskinEquipment]);
  const jobbMaskinerLive = jobbMaskiner
    .filter((l) => !l.fjernet)
    .map((l) => ({
      kortId: l.rad.kortId ?? null,
      projectId: l.rad.projectId,
      externalCostObjectId: l.rad.externalCostObjectId,
      timer: parseFloat(l.timer) || 0,
      utleieEnhet: enhetForUtstyr(l.rad.vehicleId),
    }));
  // S1 A: forslaget = «høyst» for en førermaskin; døgn-maskin får jobbens arbeid.
  // § 8.22 punkt 3 (O3): i «Legg til timer-rad» foreslås bare radens egne timer (førermaskin
  // aldri over «høyst»). Forslaget er et åpent felt; maskin har aldri fra–til.
  const nyMaskinForslag = (() => {
    if (!visKortMaskin) return "";
    if (!rad) {
      const radTimer = parseFloat(timer);
      if (isNaN(radTimer) || radTimer <= 0) return "";
      if (nyUtstyr && !maskinKreverTimerad(nyUtstyr.utleieEnhet)) return String(radTimer);
      const [forer] = maskinHoystPerRad(
        kortTimerLive,
        [{ ...nyMaskinNokkel, timer: 0, utleieEnhet: null }, ...andreMaskinerLive],
        pauseMin,
      );
      const forslag = forer !== null && forer !== undefined ? Math.min(radTimer, forer) : radTimer;
      return forslag > 0 ? String(forslag) : "";
    }
    if (nyUtstyr && !maskinKreverTimerad(nyUtstyr.utleieEnhet)) {
      const arbeid = jobbArbeidSum(kortTimerLive, nyMaskinNokkel, pauseMin);
      return arbeid > 0 ? String(arbeid) : "";
    }
    const [forer] = maskinHoystPerRad(
      kortTimerLive,
      [{ ...nyMaskinNokkel, timer: 0, utleieEnhet: null }, ...jobbMaskinerLive, ...andreMaskinerLive],
      pauseMin,
    );
    return forer !== null && forer !== undefined && forer > 0 ? String(forer) : "";
  })();
  const nyMaskinTimer = nyMaskinRort ? nyMaskinTimerInput : nyMaskinForslag;
  // «Høyst» over alle linjene: jobbens maskiner først, så den nye.
  const kortHoyst = useMemo(() => {
    if (!visKortMaskin) return [] as Array<number | null>;
    const ny = nyUtstyr
      ? [{ ...nyMaskinNokkel, timer: parseFloat(nyMaskinTimer) || 0, utleieEnhet: nyUtstyr.utleieEnhet ?? null }]
      : [];
    return maskinHoystPerRad(kortTimerLive, [...jobbMaskinerLive, ...ny, ...andreMaskinerLive], pauseMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visKortMaskin, nyUtstyr, nyMaskinTimer, kortTimerLive, jobbMaskiner, andreMaskinerLive, pauseMin, valgtProjectId, ecoId]);
  const aktiveJobbMaskiner = jobbMaskiner.filter((l) => !l.fjernet);
  const hoystForJobbLinje = (i: number) => kortHoyst[i] ?? null;
  const nyMaskinHoyst = nyUtstyr ? (kortHoyst[aktiveJobbMaskiner.length] ?? null) : null;
  const kortOverHoyst =
    visKortMaskin &&
    (aktiveJobbMaskiner.some((l, i) => overMaskinHoyst(parseFloat(l.timer) || 0, hoystForJobbLinje(i))) ||
      overMaskinHoyst(parseFloat(nyMaskinTimer) || 0, nyMaskinHoyst));

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

  // w3b (S2 A): jobbens maskiner lagres sammen med raden. Ingen onSuccess her — kalleren
  // venter på alle kallene og lukker til slutt.
  const maskinTilfoyKort = trpc.timer.dagsseddel.maskin.tilfoy.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const maskinOppdaterKort = trpc.timer.dagsseddel.maskin.oppdater.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });
  const maskinFjernKort = trpc.timer.dagsseddel.maskin.fjern.useMutation({
    onError: (e: { message: string }) => setFeil(e.message),
  });

  // Rekkefølgen holder hvert mellomsteg innenfor serverens maskinregel (w9: ingen nye eller
  // økte brudd): først det som minker eller fjernes, så raden, så det som øker og den nye.
  async function lagreJobbMaskinerFoer(): Promise<void> {
    for (const l of jobbMaskiner) {
      if (l.laast) continue;
      const ny = parseFloat(l.timer);
      if (l.fjernet) await maskinFjernKort.mutateAsync({ id: l.rad.id });
      else if (!isNaN(ny) && ny < tilTall(l.rad.timer)) {
        await maskinOppdaterKort.mutateAsync({ id: l.rad.id, timer: ny });
      }
    }
  }
  async function lagreJobbMaskinerEtter(radId: string | null): Promise<void> {
    for (const l of jobbMaskiner) {
      if (l.laast || l.fjernet) continue;
      const ny = parseFloat(l.timer);
      if (!isNaN(ny) && ny > tilTall(l.rad.timer)) {
        await maskinOppdaterKort.mutateAsync({ id: l.rad.id, timer: ny });
      }
    }
    const nyTimer = parseFloat(nyMaskinTimer);
    if (maskinVehicleId && !isNaN(nyTimer) && nyTimer > 0) {
      // B38 A / B37 A: uten fra–til, mengde og enhet.
      await maskinTilfoyKort.mutateAsync({
        sheetId,
        projectId: valgtProjectId,
        sheetTimerId: radId,
        externalCostObjectId: ecoId,
        vehicleId: maskinVehicleId,
        timer: nyTimer,
        byggeplassId: bp.byggeplassId,
        ...(jobbKortId ? { kortId: jobbKortId } : {}),
      });
    }
  }

  const oppdater = trpc.timer.dagsseddel.oppdaterTimerRad.useMutation({
    onSuccess: (_data: unknown) => {
      utils.timer.dagsseddel.hentMedId.invalidate();
      // Gate 107: raden er lagret, men koblet vare ble ikke flyttet. Vinduet står åpent med
      // meldingen — et nytt «Lagre» retter varen.
      if ((_data as { vareIkkeFlyttet?: boolean } | null)?.vareIkkeFlyttet) {
        setFeil(t("timer.feil.vareIkkeFlyttet"));
        return;
      }
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

  const formaterT = (n: number) => formaterTimer(n, i18n.language);
  const lonnsartNavn = (id: string) =>
    lonnsarter?.find((l) => l.id === id)?.navn ?? "";

  // O5 B (§ 8.22, Kenneth etter test d4bec43e: «overtid må fremgå»): i prosjektkort-modus deles
  // raden automatisk ved lagring når dagen går over normen — samme regel og samme to kall som
  // V21-knappen (`foreslaOvertidSplitt` → `brukOvertidForslag`, regelen `regnJobbTid` bygger på).
  // «Rediger» deler bare når tiden er endret, som jobbskjemaet (`lagreJobbTid`, gate 129 V1):
  // et bevisst bytte av lønnsart på uendret tid står.
  const tidEndret =
    !rad ||
    fraTid !== (rad.fraTid ?? "") ||
    tilTid !== (rad.tilTid ?? "") ||
    radPauseMin > 0 !== rad.pauseMin > 0;
  const autoOvertid = kortModus && tidEndret ? overtidForslag : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tNum = validerSkjema();
    if (tNum == null) return;
    if (autoOvertid) {
      void brukOvertidForslag(autoOvertid);
      return;
    }
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
    // Ordre d2c-1: maskinen føres på normal-delen (timeraden den gikk på).
    let normalRadId: string | null = null;
    try {
      if (visKortMaskin) await lagreJobbMaskinerFoer();
      if (rad) {
        await oppdaterDel.mutateAsync({
          id: rad.id,
          ...felles,
          lonnsartId,
          ...f.normal,
          ...byggeplassPayload(bp),
        });
      } else {
        const normal: unknown = await tilfoy.mutateAsync({
          sheetId,
          projectId: valgtProjectId,
          ...(lagreKortId ? { kortId: lagreKortId } : {}),
          ...felles,
          lonnsartId,
          ...f.normal,
          byggeplassId: bp.byggeplassId,
        });
        normalRadId = (normal as { id: string }).id;
      }
      await tilfoy.mutateAsync({
        sheetId,
        projectId: valgtProjectId,
        ...(lagreKortId ? { kortId: lagreKortId } : {}),
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
    if (visKortMaskin) {
      try {
        await lagreJobbMaskinerEtter(normalRadId ?? rad?.id ?? null);
      } catch {
        utils.timer.dagsseddel.hentMedId.invalidate();
        return;
      }
      utils.timer.dagsseddel.hentMedId.invalidate();
      onLukk();
      return;
    }
    utils.timer.dagsseddel.hentMedId.invalidate();
    if (!rad && maskinVehicleId) {
      maskinTilfoy.mutate({
        sheetId,
        projectId: valgtProjectId,
        sheetTimerId: normalRadId,
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
        setFeil(t("timer.feil.timerAvvik", { forventet: formaterTimer(forventet) }));
        return null;
      }
    }
    return tNum;
  }

  // Vanlig lagring av raden (uendret sti); V21 sender inn overtid-lønnsarten
  // når hele raden ligger over dagsnormen.
  function lagreRad(tNum: number, lagreLonnsartId: string) {
    if (visKortMaskin) {
      void lagreRadKort(tNum, lagreLonnsartId);
      return;
    }
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
        ...prosjektPayload,
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
          ...(lagreKortId ? { kortId: lagreKortId } : {}),
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
        },
        {
          onSuccess: (lagret: unknown) => {
            utils.timer.dagsseddel.hentMedId.invalidate();
            if (maskinVehicleId) {
              maskinTilfoy.mutate({
                sheetId,
                projectId: valgtProjectId,
                // Ordre d2c-1: maskinen står på timeraden som nettopp ble lagret.
                sheetTimerId: (lagret as { id: string }).id,
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

  // w3b (S2 A): prosjektkort-modus — raden og jobbens maskiner i én lagring.
  async function lagreRadKort(tNum: number, lagreLonnsartId: string): Promise<void> {
    let vareIkkeFlyttet = false;
    try {
      await lagreJobbMaskinerFoer();
      let radId: string;
      if (rad) {
        const svar: unknown = await oppdaterDel.mutateAsync({
          id: rad.id,
          lonnsartId: lagreLonnsartId,
          aktivitetId,
          timer: tNum,
          externalCostObjectId: ecoId,
          vehicleId: erInternt ? vehicleId : null,
          beskrivelse: beskrivelse.trim() || null,
          fraTid: fraTid || null,
          tilTid: tilTid || null,
          pauseMin: radPauseMin,
          ...byggeplassPayload(bp),
          ...prosjektPayload,
        });
        vareIkkeFlyttet = (svar as { vareIkkeFlyttet?: boolean } | null)?.vareIkkeFlyttet === true;
        radId = rad.id;
      } else {
        const lagret: unknown = await tilfoy.mutateAsync({
          sheetId,
          projectId: valgtProjectId,
          ...(lagreKortId ? { kortId: lagreKortId } : {}),
          lonnsartId: lagreLonnsartId,
          aktivitetId,
          timer: tNum,
          externalCostObjectId: ecoId,
          vehicleId: erInternt ? vehicleId : null,
          beskrivelse: beskrivelse.trim() || null,
          fraTid: fraTid || null,
          tilTid: tilTid || null,
          pauseMin: radPauseMin,
          byggeplassId: bp.byggeplassId,
        });
        radId = (lagret as { id: string }).id;
      }
      await lagreJobbMaskinerEtter(radId);
    } catch {
      // Hook-nivå onError har satt feilen; vis det som faktisk ble lagret.
      utils.timer.dagsseddel.hentMedId.invalidate();
      return;
    }
    utils.timer.dagsseddel.hentMedId.invalidate();
    // Gate 107: raden er lagret, men koblet vare ble ikke flyttet — vinduet står åpent.
    if (vareIkkeFlyttet) {
      setFeil(t("timer.feil.vareIkkeFlyttet"));
      return;
    }
    onLukk();
  }

  const lagrer =
    maskinTilfoyKort.isPending ||
    maskinOppdaterKort.isPending ||
    maskinFjernKort.isPending ||
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
          : t("timer.detalj.tilfoyTimer")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* D2: prosjekt i modalen (mobil-paritet). Låst ved redigering. w3a: skjult bare for ny rad
            fra jobben — ved redigering står feltene, så A7 kan nås fra kortet (gate 107). */}
        {!(jobb && !rad) && (<div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.prosjekt")}
          </label>
          <select
            value={valgtProjectId}
            onChange={(e) => byttProsjekt(e.target.value)}
            disabled={prosjektApent ? false : !!rad || !!laastProsjekt}
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
        </div>)}
        {!(jobb && !rad) && (
          <RadByggeplassFelt
            kandidater={bp.kandidater}
            verdi={bp.byggeplassId}
            onEndre={bp.setByggeplassId}
          />
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.timer.fane.lonnsarter")}
          </label>
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
          {reiseHavnerTekst && (
            <p className="mt-1 text-xs text-gray-600">{reiseHavnerTekst}</p>
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
        {/* O5 B: prosjektkort-modus — ingen knapp; en opplysning om hvordan raden lagres. */}
        {kortModus && autoOvertid && (
          <p className="text-sm text-gray-600" data-testid="overtid-ved-lagring">
            {autoOvertid.normal
              ? t("timer.overtidForslag.delesVedLagring", {
                  over: formaterT(autoOvertid.overTimer),
                  normalNavn: lonnsartNavn(lonnsartId),
                  nFra: autoOvertid.normal.fraTid,
                  nTil: autoOvertid.normal.tilTid,
                  otNavn: autoOvertid.overtidLonnsart.navn,
                  oFra: autoOvertid.overtid.fraTid,
                  oTil: autoOvertid.overtid.tilTid,
                })
              : t("timer.overtidForslag.helRadVedLagring", {
                  over: formaterT(autoOvertid.overTimer),
                  otNavn: autoOvertid.overtidLonnsart.navn,
                })}
          </p>
        )}
        {/* V21: overtidsforslag — én linje, én knapp. Vises kun når raden (eller
            dagen) passerer dagsnormen og firmaet har en overtid-lønnsart. Dagskort-modus. */}
        {!kortModus && overtidForslag && (
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
        {/* O4: fra en jobb vises nedtrekket bare når prosjektet har åpne underprosjekter
            (lista har ikke lukkede). */}
        {(!(jobb && !rad) || (ecoer?.length ?? 0) > 0) && (<div>
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
        </div>)}
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
        {/* T.12: fritekst per rad — «hva gjorde du?». Speiler mobil. Plan § 8.22 L2: påkrevd på
            arbeid i prosjektkort-modus (rød markør), ellers valgfritt. */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.radBeskrivelse")}{" "}
            {beskrivelsePakrevd ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            )}
          </label>
          <textarea
            value={beskrivelse}
            onChange={(e) => setBeskrivelse(e.target.value)}
            placeholder={t("timer.radBeskrivelsePlaceholder")}
            rows={3}
            required={beskrivelsePakrevd}
            aria-invalid={beskrivelseMangler || undefined}
            className={`w-full rounded border px-3 py-2 text-sm ${
              beskrivelseMangler ? "border-red-400" : "border-gray-300"
            }`}
          />
        </div>
        {/* P1 (maskin-i-rad): valgfri kollapsbar maskin-seksjon — kun ved NY rad.
            Maskintimer settes lik timer-radens antall; kortere drift redigeres
            på maskin-raden etterpå. Speiler resolveren (maskinAktiv) + tom-liste-
            sjekk, samme mønster som kostnadsbærer-feltet over (:2066). */}
        {/* w3b (A13, S2 A): prosjektkort-modus — lik i «Legg til» og «Rediger». Jobbens maskiner
            (utstyr låst, antall kan rettes, × fjerner) og én ny linje med Utstyr og Antall timer. */}
        {visKortMaskin && maskinAktiv && maskinEquipment && maskinEquipment.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50" data-testid="kort-maskindel">
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
                  visMaskin || jobbMaskiner.length > 0 ? "rotate-180" : ""
                }`}
              />
            </button>
            {(visMaskin || jobbMaskiner.length > 0) && (
              <div className="space-y-3 border-t border-gray-200 p-3">
                {aktiveJobbMaskiner.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">
                      {t("timer.maskinSeksjon.jobbensMaskiner")}
                    </p>
                    {aktiveJobbMaskiner.map((l, i) => {
                      const utstyr = maskinEquipment.find((e) => e.id === l.rad.vehicleId);
                      const h = hoystForJobbLinje(i);
                      const over = overMaskinHoyst(parseFloat(l.timer) || 0, h);
                      return (
                        <div key={l.rad.id} data-testid="jobb-maskin">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 truncate rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                              {utstyr ? utstyrVisningsnavn(utstyr) : "—"}
                            </div>
                            <Input
                              type="number"
                              step="0.25"
                              min={0}
                              max={24}
                              aria-label={t("timer.felt.antallTimer")}
                              value={l.timer}
                              disabled={l.laast}
                              onChange={(e) =>
                                setJobbMaskiner((alle) =>
                                  alle.map((x) => (x.rad.id === l.rad.id ? { ...x, timer: e.target.value } : x)),
                                )
                              }
                              aria-invalid={over || undefined}
                              className={`!w-24 ${over ? "!border-red-500 !text-red-600" : ""}`}
                            />
                            {!l.laast && (
                              <button
                                type="button"
                                onClick={() =>
                                  setJobbMaskiner((alle) =>
                                    alle.map((x) => (x.rad.id === l.rad.id ? { ...x, fjernet: true } : x)),
                                  )
                                }
                                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                title={t("timer.maskinSeksjon.fjern")}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          {h !== null && over && (
                            <p className="mt-1 text-xs font-medium text-red-600">
                              {t("timer.maskin.hoyst", { timer: formaterTimer(h) })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <MaskinVelger
                      utstyr={maskinEquipment ?? []}
                      valgtId={maskinVehicleId}
                      onVelg={setMaskinVehicleId}
                      bruktPaaSeddel={alleMaskinRader.map((m) => m.vehicleId)}
                      sistBrukt={sistBrukteMaskiner}
                      iVindu={!!kortModus}
                    />
                  </div>
                  <Input
                    type="number"
                    step="0.25"
                    min={0}
                    max={24}
                    aria-label={t("timer.felt.antallTimer")}
                    data-testid="ny-maskin-timer"
                    value={nyMaskinTimer}
                    onChange={(e) => {
                      setNyMaskinTimerInput(e.target.value);
                      setNyMaskinRort(true);
                    }}
                    aria-invalid={overMaskinHoyst(parseFloat(nyMaskinTimer) || 0, nyMaskinHoyst) || undefined}
                    className={`!w-24 ${
                      overMaskinHoyst(parseFloat(nyMaskinTimer) || 0, nyMaskinHoyst)
                        ? "!border-red-500 !text-red-600"
                        : ""
                    }`}
                  />
                  <span className="w-8" />
                </div>
                {nyMaskinHoyst !== null && (
                  <p
                    data-testid="maskin-hoyst"
                    className={`text-xs ${
                      overMaskinHoyst(parseFloat(nyMaskinTimer) || 0, nyMaskinHoyst)
                        ? "font-medium text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {t("timer.maskin.hoyst", { timer: formaterTimer(nyMaskinHoyst) })}
                  </p>
                )}
                <p className="text-xs text-gray-400">{t("timer.maskinSeksjon.hintJobb")}</p>
              </div>
            )}
          </div>
        )}
        {!kortModus && !rad && maskinAktiv && maskinEquipment && maskinEquipment.length > 0 && (
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
                {maskinHoyst !== null && (
                  <p
                    data-testid="maskin-hoyst"
                    className={`text-xs ${maskinOverHoyst ? "font-medium text-red-600" : "text-gray-500"}`}
                  >
                    {t("timer.maskin.hoyst", { timer: formaterTimer(maskinHoyst) })}
                  </p>
                )}
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
              (!lonnsartId || !aktivitetId || !timer || !fraTid || !tilTid || beskrivelseMangler) && !lagrer
            }
            forklaring={
              !lonnsartId || !aktivitetId || !timer || !fraTid || !tilTid
                ? t("sperret.timerRad")
                : t("sperret.beskrivelse")
            }
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
                !tilTid ||
                // w9 (2c): maskinen over jobbens «høyst».
                (!kortModus && maskinOverHoyst) ||
                // w3b: en av jobbens maskiner eller den nye over «høyst».
                kortOverHoyst ||
                // Plan § 8.22 L2: «Hva gjorde du?» påkrevd i prosjektkort-modus.
                beskrivelseMangler
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
  /** w3a: åpnet fra en jobb — stedet arves (ny rad får jobbens sted) og feltene skjules. */
  jobb?: JobbKontekst;
}) {
  const { byggeplasser, projectId, rad, jobb } = args;
  const bp = useRadByggeplass({
    byggeplasser,
    projectId,
    rad: rad ? { byggeplassId: rad.byggeplassId ?? null } : undefined,
  });
  const sedelFirmaId = useSedelFirma();
  // § 11.6: gruppen uten prosjekt (fravær) har ingen underprosjekter å slå opp.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId, organizationId: sedelFirmaId },
    { enabled: !!projectId },
  );
  const opprinneligEco = rad?.externalCostObjectId ?? null;
  const [ecoId, setEcoId] = useState<string | null>(opprinneligEco);
  const ecoEndret = !rad || ecoId !== opprinneligEco;
  const payload: { byggeplassId?: string | null; externalCostObjectId?: string | null; kortId?: string } =
    jobb && !rad
      ? { byggeplassId: jobb.byggeplassId, externalCostObjectId: jobb.ecoId, kortId: jobb.kortId }
      : {
          ...(rad ? byggeplassPayload(bp) : { byggeplassId: bp.byggeplassId }),
          ...(ecoEndret ? { externalCostObjectId: ecoId } : {}),
        };
  return { bp, ecoer: ecoer ?? [], ecoId, setEcoId, payload, skjult: !!jobb };
}

function RadStedFelt({ sted }: { sted: ReturnType<typeof useRadSted> }) {
  const { t } = useTranslation();
  if (sted.skjult) return null;
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
  jobb,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  rad?: TilleggRad;
  // U3 (8a): kategori valgt i den unified velgeren → vises read-only her.
  // Redigering (rad) og fri-select-veien er uendret (bit-for-bit sats-flyt).
  laastTilleggId?: string;
  jobb?: JobbKontekst;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery({ organizationId: sedelFirmaId });

  // Add-via-velger: kategori er allerede valgt (låst). Ellers fri select.
  const laast = !rad && !!laastTilleggId;
  const [tilleggId, setTilleggId] = useState<string>(
    rad?.tilleggId ?? laastTilleggId ?? "",
  );
  const [antall, setAntall] = useState<string>(
    rad ? String(tilTall(rad.antall)) : "1",
  );
  const [kommentar, setKommentar] = useState<string>(rad?.kommentar ?? "");
  const sted = useRadSted({ byggeplasser, projectId, rad, jobb });
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
  const sedelFirmaId = useSedelFirma();
  const { data: katalog } = trpc.timer.expenseCategory.list.useQuery({ projectId, organizationId: sedelFirmaId });

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
                  : `${formaterBelop(tilTall(rad.belop))} kr`}
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
  const sedelFirmaId = useSedelFirma();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery({ organizationId: sedelFirmaId });
  const { data: utleggKatalog } = trpc.timer.expenseCategory.list.useQuery({
    projectId,
    organizationId: sedelFirmaId,
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
  jobb,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  expenseCategoryId?: string;
  rad?: UtleggRad;
  jobb?: JobbKontekst;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: katalog } = trpc.timer.expenseCategory.list.useQuery({ projectId, organizationId: sedelFirmaId });

  const sted = useRadSted({ byggeplasser, projectId, rad, jobb });
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
  rad,
  alleTimerRader,
  alleMaskinRader,
  sistBrukteMaskiner,
  pauseMin,
  jobb,
  kortModus = false,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  defaultEcoId?: string | null;
  /** § 8.22 L1: prosjektkort-modus — maskinlista i full høyde. Dagskort-modus uendret. */
  kortModus?: boolean;
  /** w3a: åpnet fra en jobb — timerad, byggeplass og underprosjekt følger jobben og
   *  vises ikke. Ny maskin kobles til jobbens første arbeidsrad og sendes med kort-id. */
  jobb?: JobbKontekst;
  rad?: MaskinRad;
  // w9 (maskin ≤ arbeid): hele sedelens rader + sedel-pause, for «høyst» pr. jobb
  // (maskinHoystPerRad). Samme regel som serveren (krevIngenNyeMaskinBrudd).
  alleTimerRader: TimerRad[];
  alleMaskinRader: MaskinRad[];
  /** ORDRE 29: egne sist brukte maskiner (nyeste først) — øverst i velgeren. */
  sistBrukteMaskiner: string[];
  pauseMin: number;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const sedelFirmaId = useSedelFirma();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery({ organizationId: sedelFirmaId });
  const equipment = equipmentRaw as unknown as
    | Array<{
        id: string;
        merke: string;
        modell: string;
        internNavn: string | null;
        internNummer: string | null;
        kategori: string | null;
        utleieEnhet?: string | null;
      }>
    | undefined;
  // T7-4c: ECO-katalog for prosjektet — maskin følger samme prosjekt+ECO-
  // gruppe som arbeidstimer (T.7 låst 2026-05-16).
  // § 11.6: gruppen uten prosjekt (fravær) har ingen underprosjekter å slå opp.
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery(
    { projectId, organizationId: sedelFirmaId },
    { enabled: !!projectId },
  );
  // Ordre (10): samme regel som timer-raden.
  const bp = useRadByggeplass({ byggeplasser, projectId, rad });

  const [vehicleId, setVehicleId] = useState<string>(rad?.vehicleId ?? "");
  // § 8.22 punkt 4 (Kenneth 2026-11-21): maskin føres som antall timer etter skjønn —
  // aldri fra–til. Fra jobben foreslås antall = jobbens arbeid minus maskintimene alt ført
  // på jobben (O5) til brukeren rører feltet; uten jobb er feltet tomt. Mengde og enhet føres ikke
  // fra jobben (B37 A).
  const fraJobb = !!jobb;
  const [timerRort, setTimerRort] = useState<boolean>(!!rad || !jobb);
  const [timerInput, setTimer] = useState<string>(() => (rad ? String(tilTall(rad.timer)) : ""));
  const [mengde, setMengde] = useState<string>(
    rad?.mengde !== null && rad?.mengde !== undefined
      ? String(tilTall(rad.mengde))
      : "",
  );
  const [enhet, setEnhet] = useState<string>(rad?.enhet ?? "");
  const [ecoId, setEcoId] = useState<string | null>(
    rad ? (rad.externalCostObjectId ?? null) : (jobb?.ecoId ?? defaultEcoId ?? null),
  );
  const [feil, setFeil] = useState<string | null>(null);

  // Ordre d2c-1 (R24): timeraden maskinen gikk på — kortets arbeidsrader (samme
  // prosjekt, ikke reise, mer enn 0 timer). Forvalgt når kortet har én.
  const arbeidsrader = useMemo(
    () =>
      alleTimerRader
        .filter((r) => r.projectId === projectId && arbeidUtenReise([r]) > 0)
        .sort((a, b) => (a.fraTid ?? "").localeCompare(b.fraTid ?? "")),
    [alleTimerRader, projectId],
  );
  const [sheetTimerId, setSheetTimerId] = useState<string>(() => {
    if (jobb && !rad) return jobb.sheetTimerId ?? "";
    if (rad?.sheetTimerId && arbeidsrader.some((r) => r.id === rad.sheetTimerId)) {
      return rad.sheetTimerId;
    }
    return arbeidsrader.length === 1 ? arbeidsrader[0]!.id : "";
  });
  const valgtUtstyr = equipment?.find((e) => e.id === vehicleId);
  // Utstyret er ikke lastet ennå → ukjent; serveren avgjør (H15 A).
  const kreverTimerad = valgtUtstyr ? maskinKreverTimerad(valgtUtstyr.utleieEnhet) : false;

  function endreTimer(v: string) {
    setTimer(v);
    setTimerRort(true);
  }

  // w9 (2c): «høyst X t» = jobbens arbeid − de andre førermaskinene på jobben.
  // Jobben er timeradens (K6), ellers radens egen; uten jobb gjelder bøtta med pause.
  // Delt regel med serveren (maskinHoystPerRad). Døgn-maskin: ingen grense.
  // O5 (§ 8.22): forslaget fra jobben = jobbens arbeid minus ALLE maskintimer som alt er ført
  // på jobben (fører- og døgn-maskin), aldri under 0. Det er aldri over «høyst» (som bare trekker
  // fra førermaskinene), så taket står uendret.
  const jobbForslag = useMemo(() => {
    if (!jobb || rad) return "";
    const forslag = maskinForslagFraJobb(
      alleTimerRader.map((r) => ({
        kortId: r.kortId ?? null,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId,
        timer: tilTall(r.timer),
        erReise: r.erReise === true,
      })),
      alleMaskinRader.map((r) => ({
        kortId: r.kortId ?? null,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId,
        timer: tilTall(r.timer),
      })),
      { kortId: jobb.kortId, projectId, externalCostObjectId: jobb.ecoId },
      pauseMin,
    );
    return forslag > 0 ? String(forslag) : "";
  }, [jobb, rad, alleTimerRader, alleMaskinRader, projectId, pauseMin]);
  const timer = timerRort ? timerInput : jobbForslag;

  const hoyst = useMemo(() => {
    const kobletTimerrad = alleTimerRader.find((r) => r.id === sheetTimerId);
    const kortId = kreverTimerad
      ? (kobletTimerrad?.kortId ?? rad?.kortId ?? null)
      : (rad?.kortId ?? null);
    const enhetFor = (vehicleIdArg: string) =>
      equipment?.find((e) => e.id === vehicleIdArg)?.utleieEnhet ?? null;
    const nyTimer = parseFloat(timer);
    const [denne] = maskinHoystPerRad(
      alleTimerRader.map((r) => ({
        kortId: r.kortId ?? null,
        projectId: r.projectId,
        externalCostObjectId: r.externalCostObjectId,
        timer: tilTall(r.timer),
        erReise: r.erReise === true,
      })),
      [
        {
          kortId,
          projectId,
          externalCostObjectId: kortId ? (kobletTimerrad?.externalCostObjectId ?? ecoId) : ecoId,
          timer: isNaN(nyTimer) ? 0 : nyTimer,
          utleieEnhet: valgtUtstyr ? (valgtUtstyr.utleieEnhet ?? null) : null,
        },
        ...alleMaskinRader
          .filter((r) => r.id !== rad?.id)
          .map((r) => ({
            kortId: r.kortId ?? null,
            projectId: r.projectId,
            externalCostObjectId: r.externalCostObjectId,
            timer: tilTall(r.timer),
            utleieEnhet: enhetFor(r.vehicleId),
          })),
      ],
      pauseMin,
    );
    // Utstyret ikke lastet: ukjent enhet → ingen tekst; serveren avgjør (H15 A).
    return valgtUtstyr ? (denne ?? null) : null;
  }, [alleTimerRader, alleMaskinRader, sheetTimerId, kreverTimerad, rad?.kortId, rad?.id, equipment, timer, projectId, ecoId, valgtUtstyr, pauseMin]);
  const overHoyst = overMaskinHoyst(parseFloat(timer) || 0, hoyst);

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
    // Ordre d2c-1 (R24): samme regel som serveren — maskin som krever timerad.
    if (kreverTimerad && !sheetTimerId) {
      setFeil(
        arbeidsrader.length === 0
          ? t("timer.maskinTimerad.ingenArbeidsrad")
          : t("timer.maskinTimerad.velg"),
      );
      return;
    }
    const mengdeNum = mengde.trim() ? parseFloat(mengde) : null;
    if (mengdeNum !== null && (isNaN(mengdeNum) || mengdeNum < 0)) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
    }
    const data = {
      vehicleId,
      timer: tNum,
      // § 8.22 punkt 4: fra–til sendes aldri — ved redigering står lagrede verdier
      // (maskin.oppdater: undefined = urørt). w3b: fra jobben føres verken mengde eller enhet.
      ...(fraJobb ? {} : { mengde: mengdeNum, enhet: enhet || null }),
      externalCostObjectId: ecoId,
      // Ordre (10): kun ved endring — mobilens byggeplass overskrives ikke.
      // w3a: ny maskin i en jobb tar jobbens byggeplass (serveren bekrefter, A7).
      ...(jobb && !rad ? { byggeplassId: jobb.byggeplassId } : byggeplassPayload(bp)),
      // Ordre d2c-1: tom = uten timerad (bare døgn-maskin slipper gjennom).
      sheetTimerId: sheetTimerId || null,
    };
    if (rad) {
      oppdater.mutate({ id: rad.id, ...data });
    } else {
      tilfoy.mutate({ sheetId, projectId, ...data, ...(jobb ? { kortId: jobb.kortId } : {}) });
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
            iVindu={kortModus}
          />
        </div>
        {/* Ordre d2c-1 (R24): timeraden maskinen gikk på. w3a: i en jobb følger den jobben. */}
        {!jobb && (<div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("timer.felt.timerad")}{" "}
            {!kreverTimerad && (
              <span className="text-xs text-gray-400">
                ({t("label.valgfritt")})
              </span>
            )}
          </label>
          <select
            value={sheetTimerId}
            onChange={(e) => setSheetTimerId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {arbeidsrader.map((r) => (
              <option key={r.id} value={r.id}>
                {t("timer.maskinTimerad.valg", {
                  fra: r.fraTid ?? "",
                  til: r.tilTid ?? "",
                  timer: tilTall(r.timer),
                })}
              </option>
            ))}
          </select>
          {kreverTimerad && arbeidsrader.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {t("timer.maskinTimerad.ingenArbeidsrad")}
            </p>
          )}
        </div>)}
        {!jobb && (
          <RadByggeplassFelt
            kandidater={bp.kandidater}
            verdi={bp.byggeplassId}
            onEndre={bp.setByggeplassId}
          />
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
            required
            aria-invalid={overHoyst || undefined}
            className={overHoyst ? "!border-red-500 !text-red-600" : undefined}
          />
          {hoyst !== null && (
            <p
              data-testid="maskin-hoyst"
              className={`mt-1 text-xs ${overHoyst ? "font-medium text-red-600" : "text-gray-500"}`}
            >
              {t("timer.maskin.hoyst", { timer: formaterTimer(hoyst) })}
            </p>
          )}
        </div>
        {/* w3b (B37 A): fra jobben vises verken mengde eller enhet. */}
        {!fraJobb && (<>
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
        </>)}
        {!jobb && (<div>
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
        </div>)}
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
              disabled={lagrer || !vehicleId || !timer || overHoyst}
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
  const sedelFirmaId = useSedelFirma();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery({ organizationId: sedelFirmaId });

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
  tittel,
  ledigeProsjekter,
  onVelg,
  onLukk,
}: {
  tittel?: string;
  ledigeProsjekter: Array<{ id: string; name: string; internalProjectNumber: string | null }>;
  onVelg: (id: string) => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [valgtId, setValgtId] = useState<string | null>(null);

  return (
    <Modal open={true} onClose={onLukk} title={tittel ?? t("timer.leggTilProsjekt")}>
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
