"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/timer/StatusBadge";
import { ProsjektRadVelger } from "@/components/timer/ProsjektRadVelger";

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
  // Maskin-fra-til (2026-05-17): brukes til å foreslå default for maskin-rad
  // i samme bucket (Alt D — sammenheng-prinsipp).
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  // T.12 (2026-06-21): fritekst per rad — «hva gjorde du?». Speiler mobil.
  beskrivelse: string | null;
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
};

type MaskinRad = {
  id: string;
  projectId: string;
  externalCostObjectId: string | null;
  vehicleId: string;
  // Maskin-fra-til (2026-05-17): valgfri tidsregistrering for maskinbruk.
  fraTid: string | null;
  tilTid: string | null;
  timer: unknown;
  mengde: unknown;
  enhet: string | null;
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

  const [redigerHeader, setRedigerHeader] = useState(false);
  const [aktivModal, setAktivModal] = useState<
    | { type: "timer"; projectId: string; defaultEcoId?: string | null; rad?: TimerRad }
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
  const [ekstraProsjektIder, setEkstraProsjektIder] = useState<string[]>([]);
  const [feil, setFeil] = useState<string | null>(null);

  const send = trpc.timer.dagsseddel.send.useMutation({
    onSuccess: () => utils.timer.dagsseddel.hentMedId.invalidate({ id: params.id }),
    onError: (e: { message: string }) => setFeil(e.message),
  });

  const slett = trpc.timer.dagsseddel.slett.useMutation({
    onSuccess: () => router.push("/dashbord/timer/mine"),
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
  const tilleggRader = sheet.tillegg as unknown as TilleggRad[];
  const maskinRader = (sheet.maskiner ?? []) as unknown as MaskinRad[];
  const totaltimer = timerRader.reduce((acc, r) => acc + tilTall(r.timer), 0);

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

  // T7-1a: arbeidstid utledes fra startAt/endAt/pauseMin
  const arbeidstidTimer = (() => {
    const startIso = sheet.startAt as string | null;
    const endIso = sheet.endAt as string | null;
    if (!startIso || !endIso) return null;
    const diff =
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3600000;
    return Math.max(0, diff - (sheet.pauseMin ?? 0) / 60);
  })();

  // Filtrer prosjekter som ikke er aktive ennå (tilgjengelige for «+ Legg til prosjekt»)
  const ledigeProsjekter = prosjekterForVelger.filter(
    (p) => !aktiveProsjektIder.includes(p.id),
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
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
          <h3 className="text-sm font-semibold text-gray-900">
            {t("timer.arbeidstidIDag")}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            {t("timer.arbeidstidIDagBeskrivelse")}
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
              onTilfoyTimer={(ecoId) =>
                setAktivModal({ type: "timer", projectId, defaultEcoId: ecoId })
              }
              onTilfoyTillegg={() =>
                setAktivModal({ type: "tillegg", projectId })
              }
              onTilfoyMaskin={(ecoId, timerRaderIBucket) =>
                setAktivModal({
                  type: "maskin",
                  projectId,
                  defaultEcoId: ecoId,
                  // Maskin-fra-til (Alt D): foreslå fra første og siste
                  // timer-rad i bucket. Faller tilbake til firma-default
                  // hvis bucket er tom.
                  defaultFraTid:
                    timerRaderIBucket[0]?.fraTid ??
                    orgSetting?.standardStartTid ??
                    null,
                  defaultTilTid:
                    timerRaderIBucket.at(-1)?.tilTid ??
                    orgSetting?.standardSluttTid ??
                    null,
                })
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

      {/* T7-1a-summering */}
      {erRedigerbar && (
        <div
          className={`mb-4 rounded-lg border p-4 text-sm ${
            arbeidstidTimer === null
              ? "border-gray-200 bg-gray-50 text-gray-600"
              : totaltimer >= arbeidstidTimer
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-yellow-200 bg-yellow-50 text-yellow-800"
          }`}
        >
          {t("timer.summering", {
            registrert: totaltimer.toFixed(2),
            total:
              arbeidstidTimer === null ? "?" : arbeidstidTimer.toFixed(2),
          })}
        </div>
      )}

      {/* Send + slett */}
      {erRedigerbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-5">
          {sheet.status === "draft" && (
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm(t("timer.detalj.slettBekreft"))) {
                  slett.mutate({ id: sheet.id });
                }
              }}
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
          prosjektType={prosjektNavnMap.get(aktivModal.projectId)?.type ?? "kunde"}
          defaultAktivitetId={sheetAktivitetId}
          defaultEcoId={aktivModal.defaultEcoId ?? null}
          rad={aktivModal.rad}
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
  onTilfoyTimer,
  onTilfoyTillegg,
  onTilfoyMaskin,
  onRedigerTimer,
  onRedigerTillegg,
  onRedigerMaskin,
}: {
  projectId: string;
  prosjektNavn: ProsjektRef | undefined;
  tillegg: TilleggRad[];
  ecoBuckets: EcoBucket[];
  erRedigerbar: boolean;
  onTilfoyTimer: (ecoId: string | null) => void;
  onTilfoyTillegg: () => void;
  // Maskin-fra-til (2026-05-17): sender med timer-radene i bucket slik
  // at parent kan foreslå default fra/til (Alt D — sammenheng-prinsipp).
  onTilfoyMaskin: (ecoId: string | null, timerRaderIBucket: TimerRad[]) => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerTillegg: (rad: TilleggRad) => void;
  onRedigerMaskin: (rad: MaskinRad) => void;
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
            onTilfoyTimer={() => onTilfoyTimer(bucket.ecoId)}
            onTilfoyMaskin={() => onTilfoyMaskin(bucket.ecoId, bucket.timer)}
            onRedigerTimer={onRedigerTimer}
            onRedigerMaskin={onRedigerMaskin}
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
  onTilfoyTimer,
  onTilfoyMaskin,
  onRedigerTimer,
  onRedigerMaskin,
}: {
  ecoId: string | null;
  ecoNavn: { kortNavn: string; proAdmId: string } | null;
  timer: TimerRad[];
  maskin: MaskinRad[];
  erRedigerbar: boolean;
  onTilfoyTimer: () => void;
  onTilfoyMaskin: () => void;
  onRedigerTimer: (rad: TimerRad) => void;
  onRedigerMaskin: (rad: MaskinRad) => void;
}) {
  const { t } = useTranslation();
  const sumTimer = timer.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const sumMaskin = maskin.reduce((acc, r) => acc + tilTall(r.timer), 0);
  const maskinOk = sumMaskin <= sumTimer + 0.001;

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
        {timer.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.detalj.ingenTimer")}
          </p>
        ) : (
          <RaderTimer
            rader={timer}
            erRedigerbar={erRedigerbar}
            onRediger={onRedigerTimer}
          />
        )}
      </div>

      {/* Maskintimer som underpost (indentert, mindre kontrast) */}
      <div className="ml-3 border-l-2 border-gray-200 pl-3">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {t("timer.gruppe.maskintimer")}{" "}
            <span className="font-mono font-normal text-gray-500">
              ({sumMaskin.toFixed(2)} {t("timer.timerEnhet")})
            </span>
          </h4>
          {erRedigerbar && (
            <Button variant="secondary" size="sm" onClick={onTilfoyMaskin}>
              <Plus className="mr-1 h-3 w-3" />
              {t("timer.detalj.tilfoyMaskin")}
            </Button>
          )}
        </div>
        {maskin.length === 0 ? (
          <p className="text-xs italic text-gray-500">
            {t("timer.detalj.ingenMaskiner")}
          </p>
        ) : (
          <RaderMaskinKompakt
            rader={maskin}
            erRedigerbar={erRedigerbar}
            onRediger={onRedigerMaskin}
          />
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
}: {
  rader: TimerRad[];
  erRedigerbar: boolean;
  onRediger: (rad: TimerRad) => void;
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
}: {
  rader: TilleggRad[];
  erRedigerbar: boolean;
  onRediger: (rad: TilleggRad) => void;
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
 * T7-4c (2026-05-16): RaderMaskinKompakt — kun rad-listen, ingen header.
 * Header (seksjonstittel + "+ Legg til maskin"-knapp) ligger nå i EcoGruppe
 * fordi maskintimer er underpost per (projectId, ECO)-bucket, ikke per prosjekt.
 */
function RaderMaskinKompakt({
  rader,
  erRedigerbar,
  onRediger,
}: {
  rader: MaskinRad[];
  erRedigerbar: boolean;
  onRediger: (rad: MaskinRad) => void;
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
  const equipmentMap = new Map<string, string>(
    (equipment ?? []).map((e) => [
      e.id,
      `${e.merke} ${e.modell}${e.internNavn ? ` (${e.internNavn})` : ""}`,
    ]),
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
  prosjektType,
  defaultAktivitetId,
  defaultEcoId,
  rad,
  onLukk,
}: {
  sheetId: string;
  projectId: string;
  // Fase 2 / T.10: "internt" → vis maskinvelger (vedlikehold-kostnadsbærer).
  prosjektType?: string;
  defaultAktivitetId: string | null;
  defaultEcoId?: string | null;
  rad?: TimerRad;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({
    projectId,
  });

  // T.10 / §2.D: maskinvelger for kostnadsbærer ved maskinvedlikehold. Hentes
  // kun for interne prosjekter (verksted). Tom liste / inaktiv maskin-modul →
  // feltet skjules. Org-validering håndheves uansett på server.
  const erInternt = prosjektType === "internt";
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
  const [timer, setTimer] = useState<string>(
    rad ? String(tilTall(rad.timer)) : "",
  );
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
  const [feil, setFeil] = useState<string | null>(null);

  const tilfoy = trpc.timer.dagsseddel.tilfoyTimerRad.useMutation({
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
    const tNum = parseFloat(timer);
    if (!lonnsartId || !aktivitetId || isNaN(tNum) || tNum < 0 || tNum > 24) {
      setFeil(t("timer.feil.ugyldigInput"));
      return;
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
      });
    } else {
      tilfoy.mutate({
        sheetId,
        projectId,
        lonnsartId,
        aktivitetId,
        timer: tNum,
        externalCostObjectId: ecoId,
        vehicleId: erInternt ? vehicleId : null,
        beskrivelse: beskrivelse.trim() || null,
      });
    }
  }

  const lagrer = tilfoy.isPending || oppdater.isPending;

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
            onChange={(e) => setTimer(e.target.value)}
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
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button
            type="submit"
            disabled={lagrer || !lonnsartId || !aktivitetId || !timer}
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
      }>
    | undefined;
  // T7-4c: ECO-katalog for prosjektet — maskin følger samme prosjekt+ECO-
  // gruppe som arbeidstimer (T.7 låst 2026-05-16).
  const { data: ecoer } = trpc.eksternKostObjekt.list.useQuery({ projectId });

  const [vehicleId, setVehicleId] = useState<string>(rad?.vehicleId ?? "");
  const [timer, setTimer] = useState<string>(
    rad ? String(tilTall(rad.timer)) : "",
  );
  const [fraTid, setFraTid] = useState<string>(
    rad?.fraTid ?? defaultFraTid ?? "",
  );
  const [tilTid, setTilTid] = useState<string>(
    rad?.tilTid ?? defaultTilTid ?? "",
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
    if (!vehicleId || isNaN(tNum) || tNum < 0 || tNum > 24) {
      setFeil(t("timer.feil.ugyldigInput"));
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
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          >
            <option value="">{t("timer.velgUtstyr")}</option>
            {equipment?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.merke} {e.modell}
                {e.internNavn ? ` (${e.internNavn})` : ""}
                {e.internNummer ? ` — #${e.internNummer}` : ""}
              </option>
            ))}
          </select>
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
            onChange={(e) => setTimer(e.target.value)}
            required
          />
        </div>
        {/* Maskin-fra-til (2026-05-17): valgfrie tidspunkter for maskinbruk.
            Forslag fra første/siste timer-rad i samme bucket (Alt D).
            Bruker kan justere — maskin kan ha overlapp/lenger enn arbeid. */}
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
              onChange={(e) => setFraTid(e.target.value)}
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
              onChange={(e) => setTilTid(e.target.value)}
            />
          </div>
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
        {feil && <p className="text-sm text-red-600">{feil}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onLukk}>
            {t("handling.avbryt")}
          </Button>
          <Button type="submit" disabled={lagrer || !vehicleId || !timer}>
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
