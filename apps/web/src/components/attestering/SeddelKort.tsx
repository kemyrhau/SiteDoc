"use client";

// T7-4f-3b (2026-05-17): Kompakt sedel-kort med tabell-layout per mockup v7.
// Speiler ikke ProsjektSectionAttest — bygger egen flat tabell med ECO som
// sub-headers og maskin-rader indentert under timer-rader.
// T7-4f-splitt-1-klikk (2026-05-17): ✂-ikon per rad åpner SplittRadModal
// direkte fra listen — sparer 2 klikk (oversikt → detalj → splitt).
// T7-4g (2026-05-17): Kompakt header på én linje + default-kollapsing.
// Header alltid synlig (~48px), tabell vises kun ved expanded. Auto-expand
// ved tilleggHarKrav eller mertid (totaltimer > dagsnorm). Action-rad
// fjernet — ↩/✓/⋯ flyttet til header. Detalj-lenke i ⋯-menyen.

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Check,
  ChevronDown,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import type { ProsjektValg } from "@/components/timer/rediger-types";
import { RedigerRadModal } from "./RedigerRadModal";
import type { MaskinRad, TilleggRad, TimerRad } from "./attestering-buckets";

type SplittAktiv =
  | { radType: "timer"; original: TimerRad }
  | { radType: "maskin"; original: MaskinRad };

type Ansatt = {
  id: string;
  name: string | null;
  email: string;
  ansattnummer: string | null;
  avdelingId: string | null;
};

export type SeddelKortData = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  tilleggHarKrav: boolean;
  dagsnorm: number;
  // B5 (2026-05-27): pauseMin trengs for maskin-av-arbeid-invarianten
  // (døgn-utleide maskiner går mens operatør pauser, T.7 2026-05-18).
  pauseMin: number;
  beskrivelse: string | null;
  aktivitet: { id: string; navn: string; kode: string | null } | null;
  ansatt: Ansatt | null;
  timer: TimerRad[];
  tillegg: TilleggRad[];
  maskiner: MaskinRad[];
};

function initialer(navn: string | null | undefined, email: string | undefined): string {
  const kilde = (navn?.trim() || email?.split("@")[0] || "").trim();
  if (!kilde) return "?";
  const parts = kilde.split(/[\s.]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length >= 2 ? parts[parts.length - 1]?.[0] ?? "" : "";
  if (first && last) return (first + last).toUpperCase();
  return kilde.slice(0, 2).toUpperCase();
}

function formatDato(d: Date | string): string {
  return new Date(d).toLocaleDateString("no-NB", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

function tilTall(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

export function SeddelKort({
  sedel,
  onAttester,
  onReturner,
  attesterPending,
  readOnly = false,
}: {
  sedel: SeddelKortData;
  onAttester: () => void;
  onReturner: () => void;
  attesterPending: boolean;
  // T7-5e: read-only-modus skjuler ↩/✓/⋯-meny og per-rad penn/✂.
  // Brukes på "Attestert"-fanen i firma-attestering-listen.
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();
  const [menyApen, setMenyApen] = useState(false);
  const [splittAktiv, setSplittAktiv] = useState<SplittAktiv | null>(null);
  // T7-5d: penn-klikk åpner kun bucken (projectId + ecoId) raden tilhører,
  // ikke hele sedelen.
  const [redigerBucket, setRedigerBucket] = useState<{
    projectId: string;
    ecoId: string | null;
  } | null>(null);
  const oransje = sedel.tilleggHarKrav;
  // T7-4g: mertid = arbeidet mer enn dagsnorm. Krever dagsnorm > 0 for å
  // unngå false positive på sedler uten konfigurert norm.
  const harMertid =
    sedel.dagsnorm > 0 && sedel.totaltimer > sedel.dagsnorm + 0.001;
  // B5 (2026-05-27): maskin-av-arbeid-invariant speilet fra EcoBucketAttest
  // (attestering-buckets.tsx:572). Pause-buffer fordi døgn-utleide maskiner
  // går mens operatør pauser (T.7 2026-05-18). Auto-expand når brutt så
  // leder ser detaljene umiddelbart.
  const sumMaskin = sedel.maskiner.reduce(
    (acc, r) => acc + tilTall(r.timer),
    0,
  );
  const pauseTimer = sedel.pauseMin / 60;
  const maskinOk = sumMaskin <= sedel.totaltimer + pauseTimer + 0.001;
  const maskinOver = sumMaskin > 0 && !maskinOk;
  // T7-4g: default-expanded ved tilleggskrav ELLER mertid ELLER maskin
  // over invariant — leder må se detaljene når noe avviker.
  const [expanded, setExpanded] = useState<boolean>(
    oransje || harMertid || maskinOver,
  );

  // T7-4f-splitt-1-klikk: prosjekter + tidsrunding for SplittRadModal.
  // trpc-cache dedupliserer på tvers av sedel-kort — én faktisk query per side.
  const { data: prosjekterRaw } = trpc.prosjekt.hentAlle.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  // T7-4f-splitt: prosjekt.hentAlle returnerer komplekse Project-objekter som
  // trigger TS2589 ved direkte .map. Kast til minimal shape for å unngå
  // dyp type-instantiation (CLAUDE.md § tRPC TS2589-fallgruven).
  const prosjekter: ProsjektValg[] = (
    (prosjekterRaw ?? []) as unknown as Array<{ id: string; name: string }>
  ).map((p) => ({ id: p.id, name: p.name }));
  const { data: orgSetting } = trpc.organisasjon.hentSetting.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const tidsrundingMinutter = orgSetting?.tidsrundingMinutter ?? null;

  // Kataloger for navn-oppslag (queries deler cache på tvers av sedler).
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery();
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery();
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery();
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery();
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string; modell: string; internNavn: string | null }>
    | undefined;

  // ECO-katalog for første prosjekt (flertallet av sedler er ett prosjekt).
  // Multi-prosjekt-sedler vil få "—" for ECO-er som ligger på andre prosjekter.
  const førsteProsjektId =
    sedel.timer[0]?.projectId ?? sedel.maskiner[0]?.projectId;
  const { data: ecoListe } = trpc.eksternKostObjekt.list.useQuery(
    { projectId: førsteProsjektId ?? "" },
    { enabled: !!førsteProsjektId },
  );

  const lonnsartNavn = (id: string): string =>
    lonnsarter?.find((l) => l.id === id)?.navn ?? "—";
  const aktivitetNavn = (id: string): string =>
    aktiviteter?.find((a) => a.id === id)?.navn ?? "—";
  const tilleggNavn = (id: string): string =>
    tilleggKatalog?.find((x) => x.id === id)?.navn ?? "—";
  const maskinNavn = (id: string): string => {
    const e = equipment?.find((x) => x.id === id);
    if (!e) return "—";
    // T7-5b-B2 (2026-05-17): merke/modell kan være null eller tom streng
    // i DB (Heatwork-rader importert uten merke/modell-data). Tidligere
    // template literal ga "null null (Heatwork 7626)". Null-safe: bygg
    // navn av non-empty deler, fallback til internNavn alene.
    const navn = [e.merke, e.modell].filter(Boolean).join(" ").trim();
    return navn
      ? `${navn}${e.internNavn ? ` (${e.internNavn})` : ""}`
      : e.internNavn ?? "—";
  };
  const ecoEtikett = (id: string | null): string | null => {
    if (!id) return null;
    const eco = ecoListe?.find((e) => e.id === id);
    return eco ? `${eco.proAdmId} · ${eco.kortNavn}` : null;
  };

  // Buckets per ECO (null = "ingen ECO" / hoved). Bevarer rekkefølge.
  const buckets = useMemo(() => {
    type B = { ecoId: string | null; timer: TimerRad[]; maskin: MaskinRad[] };
    const map = new Map<string, B>();
    const rekkefolge: string[] = [];
    const hent = (ecoId: string | null): B => {
      const key = ecoId ?? "";
      if (!map.has(key)) {
        map.set(key, { ecoId, timer: [], maskin: [] });
        rekkefolge.push(key);
      }
      return map.get(key)!;
    };
    for (const r of sedel.timer) hent(r.externalCostObjectId).timer.push(r);
    for (const r of sedel.maskiner) hent(r.externalCostObjectId).maskin.push(r);
    return rekkefolge.map((k) => map.get(k)!);
  }, [sedel]);

  const ansattNavn = sedel.ansatt?.name ?? sedel.ansatt?.email ?? "—";

  function toggleExpanded() {
    setExpanded((o) => !o);
  }

  return (
    <div
      className={`rounded-lg border bg-white ${
        oransje
          ? "border-orange-200 border-l-4 border-l-orange-400"
          : "border-gray-200"
      }`}
    >
      {/* ---------- Kompakt header (én linje, ~48px) ---------- */}
      <header
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded();
          }
        }}
        className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50"
      >
        {/* Avatar 20×20 */}
        <div
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
            oransje
              ? "bg-orange-100 text-orange-800"
              : "bg-gray-200 text-gray-700"
          }`}
          aria-hidden="true"
        >
          {initialer(sedel.ansatt?.name ?? null, sedel.ansatt?.email)}
        </div>

        {/* Navn + ansattnr */}
        <span className="text-sm font-medium text-gray-900">{ansattNavn}</span>
        {sedel.ansatt?.ansattnummer && (
          <span className="text-xs text-gray-500">
            #{sedel.ansatt.ansattnummer}
          </span>
        )}

        <span className="text-gray-400">·</span>
        <span className="text-sm text-gray-700">{formatDato(sedel.dato)}</span>

        {/* Tilleggskrav-pille */}
        {oransje && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-800">
            {t("timer.attestering.sedel.tilleggskrav")}
          </span>
        )}

        {/* Spacer + totaltimer/dagsnorm — oransje ved mertid */}
        <span
          className={`ml-auto font-mono text-sm ${
            harMertid
              ? "font-semibold text-orange-700"
              : "text-gray-900"
          }`}
        >
          {sedel.totaltimer.toFixed(2)}t / {sedel.dagsnorm.toFixed(2)}t
        </span>

        {/* ↩ returner — T7-5e: skjult i read-only-modus */}
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReturner();
            }}
            disabled={attesterPending}
            className="rounded p-1 text-amber-600 hover:bg-amber-50 disabled:opacity-40"
            title={t("timer.attestering.returner")}
            aria-label={t("timer.attestering.returner")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ✓ attester — T7-5e: skjult i read-only-modus */}
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAttester();
            }}
            disabled={attesterPending}
            className={`rounded p-1 disabled:opacity-40 ${
              oransje
                ? "text-orange-700 hover:bg-orange-100"
                : "text-green-700 hover:bg-green-100"
            }`}
            title={t("timer.attestering.attester")}
            aria-label={t("timer.attestering.attester")}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ⋯-meny: Rediger, Returner, Detalj — T7-5e: skjult i read-only-modus */}
        {!readOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenyApen((o) => !o);
            }}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            title={t("timer.attestering.meny.tittel")}
            aria-label={t("timer.attestering.meny.tittel")}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menyApen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenyApen(false);
                }}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {/* T7-5d: «Rediger hele sedelen» går til detaljsiden (full
                    kontekst). Per-rad-redigering skjer via penn-ikon i tabellen. */}
                <Link
                  href={`/dashbord/firma/timer/attestering/${sedel.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenyApen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t("timer.attestering.meny.rediger")}
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenyApen(false);
                    onReturner();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  {t("timer.attestering.meny.returner")}
                </button>
              </div>
            </>
          )}
        </div>
        )}

        {/* ▾ expand-indikator */}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </header>

      {/* ---------- Expanded innhold ---------- */}
      {expanded && (
        <>
          {/* Sub-info: dagsnorm/aktivitet/beskrivelse */}
          {(sedel.aktivitet || sedel.beskrivelse) && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              {sedel.aktivitet && <div>{sedel.aktivitet.navn}</div>}
              {sedel.beskrivelse && (
                <p className="mt-1 line-clamp-2 max-w-xl italic">
                  {sedel.beskrivelse}
                </p>
              )}
            </div>
          )}

          {/* Tabell */}
          {(sedel.timer.length > 0 ||
            sedel.maskiner.length > 0 ||
            sedel.tillegg.length > 0) && (
            <table className="w-full border-t border-gray-100 text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">
                    {t("timer.felt.lonnsart")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("timer.kol.aktivitet")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("timer.kol.fraTil")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("timer.kol.timer")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b, bi) => {
                  const ecoNavn = ecoEtikett(b.ecoId);
                  return (
                    <Fragment key={`b${bi}`}>
                      {b.ecoId && (
                        <tr className="border-y border-blue-100 bg-blue-50">
                          <td
                            colSpan={4}
                            className="border-l-4 border-l-blue-400 px-3 py-1.5"
                          >
                            <span className="text-xs font-semibold text-gray-800">
                              {t("timer.attestering.flyttEco.etikett")}{" "}
                              {ecoNavn ? `«${ecoNavn}»` : "—"}
                            </span>
                            <span
                              className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
                              title={t("timer.gruppe.tilByggherreHint")}
                            >
                              → {t("timer.gruppe.tilByggherre")}
                            </span>
                          </td>
                        </tr>
                      )}
                      {b.timer.map((rad) => (
                        <tr
                          key={rad.id}
                          className="group border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-3 py-2 text-gray-900">
                            {lonnsartNavn(rad.lonnsartId)}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {aktivitetNavn(rad.aktivitetId)}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500">
                            {rad.fraTid && rad.tilTid
                              ? `${rad.fraTid}–${rad.tilTid}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-900">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {/* T7-5e: penn/✂ skjult i read-only-modus */}
                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRedigerBucket({
                                        projectId: rad.projectId,
                                        ecoId: rad.externalCostObjectId,
                                      })
                                    }
                                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                                    title={t("timer.attestering.meny.rediger")}
                                    aria-label={t("timer.attestering.meny.rediger")}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplittAktiv({ radType: "timer", original: rad })
                                    }
                                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                                    title={t("timer.attestering.meny.splittRad")}
                                    aria-label={t("timer.attestering.meny.splittRad")}
                                  >
                                    <Scissors className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              {tilTall(rad.timer).toFixed(2)}t
                            </span>
                          </td>
                        </tr>
                      ))}
                      {b.maskin.map((rad) => (
                        <tr
                          key={rad.id}
                          className="group border-b border-gray-100 text-gray-500 last:border-b-0"
                        >
                          <td colSpan={3} className="py-1.5 pl-9 pr-3 italic">
                            ↳ {maskinNavn(rad.vehicleId)}
                            {rad.fraTid && rad.tilTid && (
                              <span className="ml-2 font-mono">
                                {rad.fraTid}–{rad.tilTid}
                              </span>
                            )}
                            {rad.mengde !== null && rad.mengde !== undefined && (
                              <span className="ml-2 text-gray-400">
                                ({tilTall(rad.mengde).toFixed(2)} {rad.enhet ?? ""})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {/* T7-5e: penn/✂ skjult i read-only-modus */}
                              {!readOnly && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRedigerBucket({
                                        projectId: rad.projectId,
                                        ecoId: rad.externalCostObjectId,
                                      })
                                    }
                                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                                    title={t("timer.attestering.meny.rediger")}
                                    aria-label={t("timer.attestering.meny.rediger")}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSplittAktiv({ radType: "maskin", original: rad })
                                    }
                                    className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                                    title={t("timer.attestering.meny.splittRad")}
                                    aria-label={t("timer.attestering.meny.splittRad")}
                                  >
                                    <Scissors className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              {tilTall(rad.timer).toFixed(2)}t
                            </span>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}

                {/* Tillegg-rader: direkte i tabellen, oransje venstrekant per rad */}
                {sedel.tillegg.map((rad) => (
                  <tr
                    key={rad.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="border-l-4 border-l-orange-400 px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                        {tilleggNavn(rad.tilleggId)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {rad.kommentar ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-400">—</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">
                      {tilTall(rad.antall).toFixed(2)}
                    </td>
                  </tr>
                ))}

                {/* Sum-rad: total timer-sum i Timer-kolonnen */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Sum
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold text-gray-900">
                    {sedel.totaltimer.toFixed(2)}t
                  </td>
                </tr>
                {/* B5 (2026-05-27): maskin-av-arbeid-validering — speiler
                    EcoBucketAttest. Vises kun når sedel har arbeid eller
                    maskin-rader registrert. */}
                {(sumMaskin > 0 || sedel.totaltimer > 0) && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={3} className="px-3 py-1.5 text-right">
                      <span
                        className={`inline-block rounded border px-2 py-1 text-xs font-medium ${
                          maskinOk
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-300 bg-red-50 text-red-800"
                        }`}
                      >
                        {t("timer.gruppe.maskinAvArbeid", {
                          maskin: sumMaskin.toFixed(2),
                          arbeid: sedel.totaltimer.toFixed(2),
                        })}
                      </span>
                    </td>
                    <td className="px-3 py-1.5" />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* T7-4f-splitt-1-klikk: SplittRadModal åpnes direkte fra ✂-ikon per rad.
          Diskriminert union må eksplisitt smales — TS klarer ikke ellers. */}
      {splittAktiv?.radType === "timer" && (
        <SplittRadModal
          radType="timer"
          original={splittAktiv.original}
          sheetId={sedel.id}
          prosjekter={prosjekter}
          tidsrundingMinutter={tidsrundingMinutter}
          onLukk={() => setSplittAktiv(null)}
          onLagret={() => {
            void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
            setSplittAktiv(null);
          }}
        />
      )}
      {splittAktiv?.radType === "maskin" && (
        <SplittRadModal
          radType="maskin"
          original={splittAktiv.original}
          sheetId={sedel.id}
          prosjekter={prosjekter}
          tidsrundingMinutter={tidsrundingMinutter}
          onLukk={() => setSplittAktiv(null)}
          onLagret={() => {
            void utils.timer.dagsseddel.hentTilAttesteringFirma.invalidate();
            setSplittAktiv(null);
          }}
        />
      )}

      {/* T7-5d: penn-klikk åpner RedigerRadModal kun for raden+ECO-bucken.
          Hele-sedel-redigering går til detaljsiden via ⋯-menyen. */}
      {redigerBucket && (
        <RedigerRadModal
          sheetId={sedel.id}
          projectId={redigerBucket.projectId}
          ecoId={redigerBucket.ecoId}
          onLukk={() => setRedigerBucket(null)}
        />
      )}
    </div>
  );
}
