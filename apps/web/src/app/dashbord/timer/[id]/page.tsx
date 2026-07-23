"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button, Input, Modal, Spinner } from "@sitedoc/ui";
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
} from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import { ProsjektRadVelger } from "@/components/timer/ProsjektRadVelger";
import { MaskinVelger } from "@/components/timer/MaskinVelger";
import {
  maskinBucketKapasitet,
  overstigerMaskinTak,
  DEFAULT_PAUSE_ETTER_TIMER,
  pauseVinduFra,
  effektiveTimerFraSpenn,
  tilFraAntall,
  hhmmTilMin,
  pauseOverlappMin,
  finnOverlappendeTidsrom,
} from "@sitedoc/shared";
import { rundTilNarmeste } from "@/lib/tidsrunding";

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
  // T.12 (2026-06-21): fritekst per rad — «hva gjorde du?». Speiler mobil.
  beskrivelse: string | null;
  // Bolk (f): rad-attestering. Brukes til å deaktivere gjenåpne-knappen når leder
  // alt har attestert (server-vakten er sannhetskilden; dette gater bare UI-et).
  attestertStatus: string | null;
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

type ProsjektRef = {
  id: string;
  name: string;
  projectNumber: string;
  type?: string;
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
  const { data: prosjekterRaw } = trpc.prosjekt.hentForTimer.useQuery();

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
      }
    | { type: "tillegg"; projectId: string; rad?: TilleggRad }
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
  const tilleggRader = sheet.tillegg as unknown as TilleggRad[];
  const maskinRader = (sheet.maskiner ?? []) as unknown as MaskinRad[];

  // Bolk (f): har leder attestert minst én rad? Da blokkerer server-vakten
  // gjenåpning — deaktiver knappen og be arbeideren kontakte leder for retur.
  const harAttestertRad =
    timerRader.some((r) => r.attestertStatus === "attestert") ||
    tilleggRader.some((r) => r.attestertStatus === "attestert") ||
    maskinRader.some((r) => r.attestertStatus === "attestert");
  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);

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

  // T7-4c (2026-05-16): Grupper per (projectId, externalCostObjectId) for
  // arbeid + maskin. Tillegg holdes per-prosjekt (ingen ECO-felt på SheetTillegg).
  // Rekkefølge: prosjekt-IDer i den rekkefølgen de først dukker opp; innen
  // hvert prosjekt: hovedgruppe (ECO=null) først, deretter ECO-er i rekkefølge.
  type EcoGruppeData = { timer: TimerRad[]; maskin: MaskinRad[] };
  const ecoGruppeKey = (pid: string, eco: string | null) =>
    `${pid}|${eco ?? ""}`;
  const ecoGrupper = new Map<string, EcoGruppeData>();
  const tilleggPerProsjekt = new Map<string, TilleggRad[]>();
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
      g = { timer: [], maskin: [] };
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
    noterProsjekt(r.projectId);
    const liste = tilleggPerProsjekt.get(r.projectId) ?? [];
    liste.push(r);
    tilleggPerProsjekt.set(r.projectId, liste);
  }

  // Slå sammen prosjekt-IDer fra rader + bruker-tilføyde tomme grupper
  const aktiveProsjektIder = Array.from(
    new Set<string>([...prosjektRekkefolge, ...ekstraProsjektIder]),
  );
  for (const pid of ekstraProsjektIder) noterProsjekt(pid);

  // Topp-sum-norm = firmaets dagsnorm (fase-0:1041), decouplet fra arbeidstid-
  // vinduet: en kort dag er gyldig og akseptert (blå), ikke en falsk «under
  // norm»-alarm. Web bruker flat OrganizationSetting.dagsnorm (sesongjustering
  // krever server-endepunkt → utenfor scope); null til orgSetting er lastet (grå).
  const normTimer = orgSetting ? tilTall(orgSetting.dagsnorm) : null;

  // Filtrer prosjekter som ikke er aktive ennå (tilgjengelige for «+ Legg til prosjekt»)
  const ledigeProsjekter = prosjekterForVelger.filter(
    (p) => !aktiveProsjektIder.includes(p.id),
  );

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

      {/* Header-info — sedel-nivå */}
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
            {t("timer.arbeidstidPrefyltHint")}
          </p>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <Definisjon
              term={t("timer.felt.startTid")}
              verdi={isoTidspunktTilHHMM(sheet.startAt as string | null) || "—"}
            />
            <Definisjon
              term={t("timer.felt.sluttTid")}
              verdi={isoTidspunktTilHHMM(sheet.endAt as string | null) || "—"}
            />
            <Definisjon
              term={t("timer.felt.pauseMin")}
              verdi={`${sheet.pauseMin} min`}
            />
          </dl>
        </div>
      </section>

      {/* Prosjekt-grupper */}
      {aktiveProsjektIder.length === 0 ? (
        <section className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          {t("timer.detalj.ingenProsjektGrupper")}
        </section>
      ) : (
        aktiveProsjektIder.map((projectId) => {
          // T7-4c: hvis ingen rader på prosjektet ennå (bruker la til via
          // "+ Legg til prosjekt"), vis kun hovedgruppen (ECO=null).
          const ecoIder = prosjektEcoIder.get(projectId);
          const ecoListe =
            ecoIder && ecoIder.length > 0 ? ecoIder : [""];
          return (
            <ProsjektGruppe
              key={projectId}
              projectId={projectId}
              prosjektNavn={prosjektNavnMap.get(projectId)}
              tillegg={tilleggPerProsjekt.get(projectId) ?? []}
              ecoBuckets={ecoListe.map((ekv) => {
                const ecoId = ekv === "" ? null : ekv;
                const data = ecoGrupper.get(ecoGruppeKey(projectId, ecoId));
                return {
                  ecoId,
                  timer: data?.timer ?? [],
                  maskin: data?.maskin ?? [],
                };
              })}
              erRedigerbar={erRedigerbar}
              pauseMin={sheet.pauseMin}
              onTilfoyTimer={(ecoId) => {
                // Bolk (g): fra = SENESTE tilTid på HELE sedelen (alle bøtter),
                // ellers dagens effektive start. «Fortsett der du slapp» på hele
                // dagen — ikke bare bøtta. Seneste slutt hindrer at ny rad
                // prefylles inn i et allerede registrert tidsrom (overlapp-vakt).
                const sisteTil = timerRader
                  .map((r) => r.tilTid)
                  .filter((t): t is string => !!t)
                  .reduce<string | null>(
                    (senest, t) =>
                      senest === null || hhmmTilMin(t) > hhmmTilMin(senest)
                        ? t
                        : senest,
                    null,
                  );
                setAktivModal({
                  type: "timer",
                  projectId,
                  defaultEcoId: ecoId,
                  defaultFraTid: sisteTil ?? effektivStart,
                  defaultTilTid: effektivSlutt,
                });
              }}
              onTilfoyTillegg={() =>
                setAktivModal({ type: "tillegg", projectId })
              }
              onRedigerTimer={(rad) =>
                setAktivModal({ type: "timer", projectId, rad })
              }
              onRedigerTillegg={(rad) =>
                setAktivModal({ type: "tillegg", projectId, rad })
              }
              onRedigerMaskin={(rad) =>
                setAktivModal({ type: "maskin", projectId, rad })
              }
              onSplittTimer={(rad) => setSplittModal({ type: "timer", rad })}
              onSplittTillegg={(rad) =>
                setSplittModal({ type: "tillegg", rad })
              }
              onSplittMaskin={(rad) => setSplittModal({ type: "maskin", rad })}
            />
          );
        })
      )}

      {/* + Legg til prosjekt */}
      {erRedigerbar && ledigeProsjekter.length > 0 && (
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
      {erRedigerbar &&
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

      {/* Send + slett */}
      {erRedigerbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          {sheet.status === "draft" && (
            <Button
              variant="secondary"
              onClick={() => setVisSlettModal(true)}
              disabled={slett.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {t("timer.detalj.slett")}
            </Button>
          )}
          <Button
            onClick={() => {
              setFeil(null);
              send.mutate({ id: sheet.id });
            }}
            disabled={send.isPending || timerRader.length === 0}
          >
            <Send className="mr-1 h-4 w-4" />
            {sheet.status === "returned"
              ? t("timer.detalj.sendPaaNytt")
              : t("timer.detalj.sendTilLeder")}
          </Button>
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
          projectId={aktivModal.projectId}
          prosjekter={prosjekterForVelger}
          defaultAktivitetId={sheetAktivitetId}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          rad={aktivModal.rad}
          // P4b: hele sedelens timer-rader sendes inn så dialogen kan kjøre samme
          // kryss-bøtte overlapp-vakt som mobil (delt finnOverlappendeTidsrom).
          alleTimerRader={timerRader}
          // P1 (maskin-i-rad): sedelens maskin-rader + sedel-pause for den valgfrie
          // maskin-seksjonen (bucket-kapasitet, samme regel som MaskinRadDialog).
          alleMaskinRader={maskinRader}
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
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "tillegg" && (
        <TilleggRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          rad={aktivModal.rad}
          onLukk={() => setAktivModal(null)}
        />
      )}
      {aktivModal?.type === "maskin" && (
        <MaskinRadDialog
          sheetId={sheet.id}
          projectId={aktivModal.projectId}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          defaultFraTid={aktivModal.defaultFraTid ?? null}
          defaultTilTid={aktivModal.defaultTilTid ?? null}
          tidsrundingMinutter={orgSetting?.tidsrundingMinutter ?? null}
          rad={aktivModal.rad}
          // Del 2 (maskin ≤ arbeid): hele sedelen sendes inn så modalen kan
          // beregne bucket-kapasitet reaktivt for gjeldende (projectId, ECO).
          alleTimerRader={timerRader}
          alleMaskinRader={maskinRader}
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
/*  ProsjektGruppe — én blokk per unikt projectId                       */
/*  T7-4c (2026-05-16): inneholder nå tillegg + N ECO-bukets.           */
/*  Hovedgruppe (ECO=null) vises uten subheader; ekte ECO-er får        */
/*  badge "→ Godkjenning byggherre" og navn fra eksternKostObjekt.list. */
/* ------------------------------------------------------------------ */

type EcoBucket = {
  ecoId: string | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
};

function ProsjektGruppe({
  projectId,
  prosjektNavn,
  tillegg,
  ecoBuckets,
  erRedigerbar,
  pauseMin,
  onTilfoyTimer,
  onTilfoyTillegg,
  onRedigerTimer,
  onRedigerTillegg,
  onRedigerMaskin,
  onSplittTimer,
  onSplittTillegg,
  onSplittMaskin,
}: {
  projectId: string;
  prosjektNavn: ProsjektRef | undefined;
  tillegg: TilleggRad[];
  ecoBuckets: EcoBucket[];
  erRedigerbar: boolean;
  // D6: sedel-nivå pauseMin → maskin ≤ arbeid-buffer per bucket.
  pauseMin: number;
  // Bolk (d) R1: sender timer-radene i bucket slik at parent kan avlede
  // fra/til-prefill (siste rads tilTid).
  onTilfoyTimer: (ecoId: string | null, timerRaderIBucket: TimerRad[]) => void;
  onTilfoyTillegg: () => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerTillegg: (rad: TilleggRad) => void;
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

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-base font-semibold text-gray-900">
          {prosjektNavn?.name ?? t("timer.detalj.ukjentProsjekt")}
          {prosjektNavn?.projectNumber && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({prosjektNavn.projectNumber})
            </span>
          )}
        </h2>
      </div>

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
            erRedigerbar={erRedigerbar}
            pauseMin={pauseMin}
            onTilfoyTimer={() => onTilfoyTimer(bucket.ecoId, bucket.timer)}
            onRedigerTimer={onRedigerTimer}
            onRedigerMaskin={onRedigerMaskin}
            onSplittTimer={onSplittTimer}
            onSplittMaskin={onSplittMaskin}
          />
        ))}
      </div>

      {/* Tillegg — per-prosjekt, separat fra ECO-bukets (ingen ECO-felt på Tillegg) */}
      <div className="mt-4 border-t border-gray-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {t("timer.detalj.tilleggRader")}
          </h3>
          {erRedigerbar && (
            <Button variant="secondary" onClick={onTilfoyTillegg}>
              <Plus className="mr-1 h-3 w-3" />
              {t("timer.detalj.tilfoyTillegg")}
            </Button>
          )}
        </div>
        {tillegg.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("timer.detalj.ingenTillegg")}
          </p>
        ) : (
          <RaderTillegg
            rader={tillegg}
            erRedigerbar={erRedigerbar}
            onRediger={onRedigerTillegg}
            onSplitt={onSplittTillegg}
          />
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  EcoGruppe — én bucket per (projectId, ECO)                          */
/*  Arbeidstimer er hovedposten; maskintimer rendres indentert under    */
/*  som visuell underpost (T.7 låst 2026-05-16). Server validerer       */
/*  sum(maskin) ≤ sum(arbeid) per bucket — UI viser samme indikator     */
/*  med grønn/rød fargekode.                                            */
/* ------------------------------------------------------------------ */

function EcoGruppe({
  ecoId,
  ecoNavn,
  timer,
  maskin,
  erRedigerbar,
  pauseMin,
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
  erRedigerbar: boolean;
  pauseMin: number;
  onTilfoyTimer: () => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerMaskin: (rad: MaskinRad) => void;
  onSplittTimer: (rad: TimerRad) => void;
  onSplittMaskin: (rad: MaskinRad) => void;
}) {
  const { t } = useTranslation();
  const sumTimer = timer.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const sumMaskin = maskin.reduce((acc, r) => acc + tilTall(r.timer), 0);
  // D6 (web-paritet): bruk delt overstigerMaskinTak MED pause-buffer — identisk
  // med attestering (`attestering-buckets.tsx`) og server. Fjerner det tidligere
  // «+ 0.001 uten buffer» som kunne vise rød for arbeider men grønn for attestør.
  const maskinOk = !overstigerMaskinTak(sumMaskin, sumTimer, pauseMin);

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
                onRediger={onRedigerMaskin}
                onSplitt={onSplittMaskin}
              />
            )}
          </>
        )}
      </div>

      {/* Sum-indikator — grønn når maskin ≤ arbeid, rød ellers */}
      {(sumTimer > 0 || sumMaskin > 0) && (
        <div
          className={`mt-3 rounded border px-3 py-1.5 text-xs font-medium ${
            maskinOk
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {t("timer.gruppe.maskinAvArbeid", {
            maskin: sumMaskin.toFixed(2),
            arbeid: sumTimer.toFixed(2),
          })}
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
  onRediger,
  onSplitt,
}: {
  rader: TimerRad[];
  erRedigerbar: boolean;
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
              {/* T.12: fritekst-beskrivelse av hva som ble gjort (speiler mobil) */}
              {rad.beskrivelse && (
                <p className="mt-0.5 text-xs italic text-gray-600">
                  {rad.beskrivelse}
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
                    <a
                      key={v.id}
                      href={`/api${v.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={v.fileName}
                    >
                      <img
                        src={`/api${v.fileUrl}`}
                        alt={t("timer.vedlegg.tittel")}
                        className="h-14 w-14 rounded border border-gray-200 object-cover hover:opacity-80"
                      />
                    </a>
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
  onRediger,
  onSplitt,
}: {
  rader: MaskinRad[];
  erRedigerbar: boolean;
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
  projectId,
  prosjekter,
  defaultAktivitetId,
  defaultEcoId,
  rad,
  alleTimerRader,
  alleMaskinRader,
  pauseMin,
  defaultFraTid,
  defaultTilTid,
  tidsrundingMinutter,
  skiftStart,
  standardPauseMin,
  standardPauseEtterTimer,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  prosjekter: ProsjektRef[];
  defaultAktivitetId: string | null;
  defaultEcoId?: string | null;
  rad?: TimerRad;
  // P4b: alle timer-rader på sedelen — for kryss-bøtte overlapp-vakt (delt regel).
  alleTimerRader: TimerRad[];
  // P1 (maskin-i-rad): sedelens maskin-rader + sedel-pause for den valgfrie
  // maskin-seksjonen (bucket-kapasitet, speiler MaskinRadDialog).
  alleMaskinRader: MaskinRad[];
  pauseMin: number;
  // Bolk (d) R1: prefill fra/til ved ny rad. R4: T.5-runding ved commit.
  defaultFraTid?: string | null;
  defaultTilTid?: string | null;
  tidsrundingMinutter?: number | null;
  // D3: pausevindu-parametre for fra/til ↔ antall-synk.
  skiftStart: string;
  standardPauseMin: number;
  standardPauseEtterTimer: number;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();

  // D2 (web-paritet): prosjekt velges i modalen (som mobil). Ved NY rad kan den
  // endres (raden opprettes under valgt prosjekt); ved redigering er den låst —
  // server-oppdaterTimerRad flytter ikke rad mellom prosjekter (egen oppfølger).
  const [valgtProjectId, setValgtProjectId] = useState<string>(
    rad?.projectId ?? projectId,
  );
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({
    projectId: valgtProjectId,
  });

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

  const [lonnsartId, setLonnsartId] = useState<string>(rad?.lonnsartId ?? "");
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
  const [visMaskin, setVisMaskin] = useState(false);
  const [maskinVehicleId, setMaskinVehicleId] = useState<string>("");
  const [maskinMengde, setMaskinMengde] = useState<string>("");
  const [maskinEnhet, setMaskinEnhet] = useState<string>("");

  // Pausevindu = skiftstart + standardPauseEtterTimer, lengde standardPauseMin.
  const pauseFra = pauseVinduFra(skiftStart, standardPauseEtterTimer);

  // R4 (T.5): tving picker-steg ≤ 30 min så minutt-selektoren vises selv ved
  // 60-min-runding (Chrome skjuler minutter ved step=3600). Default 15 min.
  const timeStep = Math.min((tidsrundingMinutter ?? 15) * 60, 1800);

  // R3-transparens: hvor mange minutter pause raden faktisk absorberer
  // (0 = ingen). Speiler mobilens pauseOverlapp.
  const pauseOverlapp = useMemo(() => {
    if (!fraTid || !tilTid) return 0;
    const fm = hhmmTilMin(fraTid);
    const tm = hhmmTilMin(tilTid);
    if (tm <= fm) return 0;
    return pauseOverlappMin(fm, tm, hhmmTilMin(pauseFra), standardPauseMin);
  }, [fraTid, tilTid, pauseFra, standardPauseMin]);

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
    const arbeidSum = alleTimerRader
      .filter(iBucket)
      .reduce((acc, r) => acc + tilTall(r.timer), 0);
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
      setTimer(String(effektiveTimerFraSpenn(r, tilTid, pauseFra, standardPauseMin)));
    }
  }
  function endreTil(v: string) {
    const r = rundTilNarmeste(v, tidsrundingMinutter ?? null);
    setTilTid(r);
    if (fraTid && r) {
      setTimer(String(effektiveTimerFraSpenn(fraTid, r, pauseFra, standardPauseMin)));
    }
  }
  function endreTimer(v: string) {
    setTimer(v);
    const n = parseFloat(v);
    if (fraTid && !isNaN(n) && n > 0) {
      setTilTid(tilFraAntall(fraTid, n, pauseFra, standardPauseMin));
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeil(null);
    // Fra/til obligatorisk på timer-rader (2026-07-13) — reverserer a2. Sjekkes
    // FØR de andre valideringene (tid-løse rader er ufullstendige lønnsdata).
    if (!fraTid || !tilTid) {
      setFeil(t("timer.feil.fraTilPaakrevd"));
      return;
    }
    const tNum = parseFloat(timer);
    if (!lonnsartId || !aktivitetId || isNaN(tNum) || tNum <= 0 || tNum > 24) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
    }
    // Pause-synk-sikkerhetsnett (paritet m/ mobil TimerSeksjon.tsx:681). Krev
    // FØRST til > fra (bolk (g): lukker 0==0-hullet der fra≥til gir forventet=0
    // og en 0-rad ellers slipper gjennom). Så: antall == spenn − pause.
    if (fraTid && tilTid) {
      if (hhmmTilMin(tilTid) <= hhmmTilMin(fraTid)) {
        setFeil(t("timer.feil.sluttForStart"));
        return;
      }
      // P4b: kryss-bøtte overlapp-vakt (paritet m/ mobil TimerSeksjon + server).
      // Én arbeider kan ikke være to steder samtidig — sjekk mot alle andre
      // rader på sedelen (unntatt raden som redigeres). Delt @sitedoc/shared-regel.
      const andreRader = alleTimerRader.filter((r) => r.id !== rad?.id);
      const overlapp = finnOverlappendeTidsrom(fraTid, tilTid, andreRader);
      if (overlapp) {
        setFeil(
          t("timer.feil.overlapp", {
            fra: fraTid,
            til: tilTid,
            annenFra: overlapp.fraTid,
            annenTil: overlapp.tilTid,
          }),
        );
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
    if (rad) {
      oppdater.mutate({
        id: rad.id,
        lonnsartId,
        aktivitetId,
        timer: tNum,
        externalCostObjectId: ecoId,
        // Send alltid (kan nullstilles); ignoreres for ikke-interne prosjekter.
        vehicleId: erInternt ? vehicleId : null,
        beskrivelse: beskrivelse.trim() || null,
        fraTid: fraTid || null,
        tilTid: tilTid || null,
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
          lonnsartId,
          aktivitetId,
          timer: tNum,
          externalCostObjectId: ecoId,
          vehicleId: erInternt ? vehicleId : null,
          beskrivelse: beskrivelse.trim() || null,
          fraTid: fraTid || null,
          tilTid: tilTid || null,
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
    tilfoy.isPending || oppdater.isPending || maskinTilfoy.isPending;

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
            disabled={!!rad}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
            required
          >
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} — {p.name}
              </option>
            ))}
          </select>
        </div>
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
            på maskin-raden etterpå. */}
        {!rad && (
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
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TilleggRadDialog                                                    */
/* ------------------------------------------------------------------ */

function TilleggRadDialog({
  sheetId,
  projectId,
  rad,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  rad?: TilleggRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();

  const [tilleggId, setTilleggId] = useState<string>(rad?.tilleggId ?? "");
  const [antall, setAntall] = useState<string>(
    rad ? String(tilTall(rad.antall)) : "1",
  );
  const [kommentar, setKommentar] = useState<string>(rad?.kommentar ?? "");
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
    if (!fil || !rad) return;
    setVedleggFeil(null);
    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setVedleggFeil(err.error ?? t("timer.feil.ugyldigInput"));
        return;
      }
      const opplastet = await res.json();
      await tilfoyVedlegg.mutateAsync({
        sheetTilleggId: rad.id,
        fileUrl: opplastet.fileUrl,
        fileName: fil.name,
        mimeType: fil.type || "application/octet-stream",
        fileSize: opplastet.fileSize ?? fil.size,
      });
    } catch {
      setVedleggFeil(t("timer.feil.ugyldigInput"));
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
        rad
          ? t("timer.detalj.redigerTilleggRad")
          : t("timer.detalj.tilfoyTillegg")
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("firma.timer.fane.tillegg")}
          </label>
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api${v.fileUrl}`}
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
          <Button type="submit" disabled={lagrer || !tilleggId}>
            {lagrer ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
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
  defaultEcoId,
  defaultFraTid,
  defaultTilTid,
  tidsrundingMinutter,
  rad,
  alleTimerRader,
  alleMaskinRader,
  pauseMin,
  skiftStart,
  standardPauseMin,
  standardPauseEtterTimer,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
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
    const arbeidSum = alleTimerRader
      .filter(iBucket)
      .reduce((acc, r) => acc + tilTall(r.timer), 0);
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
          />
        </div>
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
          <Button
            type="submit"
            disabled={lagrer || !vehicleId || !timer || kapasitet.overstiger}
          >
            {lagrer ? t("handling.lagrer") : t("handling.lagre")}
          </Button>
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
    pauseMin: number;
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
  const [pauseMin, setPauseMin] = useState(sheet.pauseMin);
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
    oppdater.mutate({
      id: sheet.id,
      aktivitetId: aktivitetId || undefined,
      dato,
      pauseMin,
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
          <div className="grid grid-cols-3 gap-3">
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("timer.felt.pauseMin")}
              </label>
              <Input
                type="number"
                min={0}
                value={pauseMin}
                onChange={(e) => setPauseMin(parseInt(e.target.value || "0"))}
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
  ledigeProsjekter: Array<{ id: string; name: string; projectNumber: string }>;
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
          <Button
            type="button"
            onClick={() => valgtId && onVelg(valgtId)}
            disabled={!valgtId}
          >
            {t("handling.leggTil")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
