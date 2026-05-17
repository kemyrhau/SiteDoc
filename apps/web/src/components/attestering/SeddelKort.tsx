"use client";

// T7-4f-3b (2026-05-17): Kompakt sedel-kort med tabell-layout per mockup v7.
// Speiler ikke ProsjektSectionAttest — bygger egen flat tabell med ECO som
// sub-headers og maskin-rader indentert under timer-rader.
// T7-4f-splitt-1-klikk (2026-05-17): ✂-ikon per rad åpner SplittRadModal
// direkte fra listen — sparer 2 klikk (oversikt → detalj → splitt).

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";
import { trpc } from "@/lib/trpc";
import {
  Check,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { SplittRadModal } from "@/components/timer/SplittRadModal";
import type { ProsjektValg } from "@/components/timer/rediger-types";
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
}: {
  sedel: SeddelKortData;
  onAttester: () => void;
  onReturner: () => void;
  attesterPending: boolean;
}) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const utils = trpc.useUtils();
  const [menyApen, setMenyApen] = useState(false);
  const [splittAktiv, setSplittAktiv] = useState<SplittAktiv | null>(null);
  const oransje = sedel.tilleggHarKrav;

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
    return `${e.merke} ${e.modell}${e.internNavn ? ` (${e.internNavn})` : ""}`;
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

  return (
    <div
      className={`rounded-lg border bg-white ${
        oransje
          ? "border-orange-200 border-l-4 border-l-orange-400"
          : "border-gray-200"
      }`}
    >
      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar med initialer */}
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              oransje
                ? "bg-orange-100 text-orange-800"
                : "bg-gray-200 text-gray-700"
            }`}
            aria-hidden="true"
          >
            {initialer(sedel.ansatt?.name ?? null, sedel.ansatt?.email)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-900">
              <span>{ansattNavn}</span>
              {sedel.ansatt?.ansattnummer && (
                <span className="text-xs text-gray-500">
                  #{sedel.ansatt.ansattnummer}
                </span>
              )}
              <span className="text-gray-400">·</span>
              <span>{formatDato(sedel.dato)}</span>
              {oransje && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                  {t("timer.attestering.sedel.tilleggskrav")}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {t("timer.attestering.sedel.dagsnorm", {
                dagsnorm: sedel.dagsnorm.toFixed(2),
              })}
              {sedel.aktivitet && (
                <>
                  <span className="mx-2 text-gray-400">·</span>
                  {sedel.aktivitet.navn}
                </>
              )}
            </div>
            {sedel.beskrivelse && (
              <p className="mt-1 line-clamp-2 max-w-xl text-xs italic text-gray-500">
                {sedel.beskrivelse}
              </p>
            )}
          </div>
        </div>
        <Link
          href={`/dashbord/firma/timer/attestering/${sedel.id}`}
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink className="h-3 w-3" />
          {t("timer.attestering.meny.detalj")}
        </Link>
      </header>

      {/* ---------- Tabell ---------- */}
      {(sedel.timer.length > 0 ||
        sedel.maskiner.length > 0 ||
        sedel.tillegg.length > 0) && (
        <table className="w-full text-xs">
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
                          <Link
                            href={`/dashbord/firma/timer/attestering/${sedel.id}`}
                            className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                            title={t("timer.attestering.meny.rediger")}
                            aria-label={t("timer.attestering.meny.rediger")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
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
                          <Link
                            href={`/dashbord/firma/timer/attestering/${sedel.id}`}
                            className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                            title={t("timer.attestering.meny.rediger")}
                            aria-label={t("timer.attestering.meny.rediger")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
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
          </tbody>
        </table>
      )}

      {/* ---------- Actions under tabellen ---------- */}
      <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-3">
        <button
          onClick={onReturner}
          disabled={attesterPending}
          className="rounded p-1.5 text-amber-600 hover:bg-amber-50 disabled:opacity-40"
          title={t("timer.attestering.returner")}
          aria-label={t("timer.attestering.returner")}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <Button
          onClick={onAttester}
          disabled={attesterPending}
          size="sm"
          className={
            oransje
              ? "bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500"
              : ""
          }
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          {t("timer.attestering.attester")}
        </Button>
        <div className="relative">
          <button
            onClick={() => setMenyApen((o) => !o)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
            title={t("timer.attestering.meny.tittel")}
            aria-label={t("timer.attestering.meny.tittel")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menyApen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenyApen(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <Link
                  href={`/dashbord/firma/timer/attestering/${sedel.id}`}
                  className="block px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenyApen(false)}
                >
                  {t("timer.attestering.meny.rediger")}
                </Link>
                <Link
                  href={`/dashbord/firma/timer/attestering/${sedel.id}`}
                  className="block px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  onClick={() => setMenyApen(false)}
                >
                  {t("timer.attestering.meny.splittRad")}
                </Link>
                <button
                  onClick={() => {
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
      </div>

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
    </div>
  );
}
