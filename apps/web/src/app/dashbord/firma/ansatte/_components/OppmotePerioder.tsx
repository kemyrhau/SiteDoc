"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { finnPeriodeKonflikt, type OppmotePeriodeInput } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";

/**
 * POST 2026-11-15 (12) D § 6 — ansattens oppmøtested med perioder, i
 * ansatt-redigeringen (firmaadmin). Oppsummeringslinje + liste med «Satt av»,
 * «+ Periode» (type som knapper → sted/prosjekt → fra/til) og slett via modal.
 * Overlapp sjekkes med samme delte regel som serveren (`finnPeriodeKonflikt`).
 */

type PeriodeType = "fast" | "midlertidig" | "byggeplass";

type PeriodeRad = OppmotePeriodeInput & {
  id: string;
  organizationMemberId: string;
  oppmotestedNavn: string | null;
  prosjektNavn: string | null;
  sattAvNavn: string | null;
  sattVed: string | Date;
};

function iDag(): string {
  return new Date().toISOString().slice(0, 10);
}

/** «2026-12-01» → «1.12». */
function kortDato(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

function typeAv(p: OppmotePeriodeInput): PeriodeType {
  if (p.type === "byggeplass") return "byggeplass";
  return p.fast ? "fast" : "midlertidig";
}

export function OppmotePerioder({
  organizationId,
  organizationMemberId,
}: {
  organizationId: string;
  organizationMemberId: string;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const alle = trpc.oppmotePeriode.hentForFirma.useQuery({ organizationId });
  const { data: steder } = trpc.oppmotested.hentForFirma.useQuery({ organizationId });
  const { data: prosjekter } = trpc.organisasjon.hentProsjekter.useQuery({ organizationId });

  const [nyAapen, setNyAapen] = useState(false);
  const [slettRad, setSlettRad] = useState<PeriodeRad | null>(null);

  const perioder = useMemo(
    () =>
      ((alle.data ?? []) as PeriodeRad[])
        .filter((p) => p.organizationMemberId === organizationMemberId)
        .sort((a, b) => (a.fraDato < b.fraDato ? 1 : -1)),
    [alle.data, organizationMemberId],
  );

  const navnFor = (p: PeriodeRad) =>
    (p.type === "byggeplass" ? p.prosjektNavn : p.oppmotestedNavn) ?? "—";
  const spenn = (p: PeriodeRad) =>
    p.tilDato ? `${kortDato(p.fraDato)}–${kortDato(p.tilDato)}` : t("firma.ansatte.oppmote.fraOgMed", { dato: kortDato(p.fraDato) });

  // Oppsummering: gjeldende fast + midlertidig/byggeplass som ikke er utløpt.
  const idag = iDag();
  const oppsummering = perioder
    .filter((p) => (p.fast ? p.tilDato == null : (p.tilDato ?? idag) >= idag))
    .sort((a, b) => (a.fraDato < b.fraDato ? -1 : 1))
    .map((p) =>
      p.fast
        ? `${t("firma.ansatte.oppmote.type.fast")}: ${navnFor(p)}`
        : `${t(`firma.ansatte.oppmote.type.${typeAv(p)}`)}: ${navnFor(p)} ${spenn(p)}`,
    )
    .join(" · ");

  const oppfrisk = () => void utils.oppmotePeriode.hentForFirma.invalidate({ organizationId });

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {t("firma.ansatte.oppmote.label")}
      </label>
      <p className="mb-2 text-sm text-gray-900">
        {oppsummering || <span className="text-gray-500">{t("firma.ansatte.oppmote.ikkeValgt")}</span>}
      </p>

      {perioder.length > 0 && (
        <ul className="mb-2 divide-y divide-gray-100 rounded-md border border-gray-200">
          {perioder.map((p) => (
            <li key={p.id} className="flex items-start gap-2 px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="text-gray-900">
                  {t(`firma.ansatte.oppmote.type.${typeAv(p)}`)}: {navnFor(p)} · {spenn(p)}
                </div>
                <div className="text-xs text-gray-500">
                  {t("firma.ansatte.oppmote.sattAv", {
                    navn: p.sattAvNavn ?? t("firma.ansatte.utenNavn"),
                    dato: new Date(p.sattVed).toLocaleDateString("nb-NO"),
                  })}
                </div>
              </div>
              {/* Lukket fast sted er historikk — kan ikke slettes (serveren avviser). */}
              {!(p.fast && p.tilDato) && (
                <button
                  type="button"
                  onClick={() => setSlettRad(p)}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  aria-label={t("firma.ansatte.oppmote.slett")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {nyAapen ? (
        <NyPeriode
          organizationId={organizationId}
          organizationMemberId={organizationMemberId}
          perioder={perioder}
          steder={steder ?? []}
          prosjekter={(prosjekter ?? [])
            // Samme regel som serveren (verifiserMaal): kun prosjekter firmaet eier.
            .filter((p) => p.primaryOrganizationId === organizationId)
            .map((p) => ({ id: p.id, navn: p.name }))}
          onAvbryt={() => setNyAapen(false)}
          onLagret={() => {
            setNyAapen(false);
            oppfrisk();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setNyAapen(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-sitedoc-primary hover:underline"
        >
          <Plus className="h-4 w-4" />
          {t("firma.ansatte.oppmote.nyPeriode")}
        </button>
      )}

      {slettRad && (
        <SlettPeriodeModal
          organizationId={organizationId}
          tekst={`${t(`firma.ansatte.oppmote.type.${typeAv(slettRad)}`)}: ${navnFor(slettRad)} · ${spenn(slettRad)}`}
          id={slettRad.id}
          onLukk={() => setSlettRad(null)}
          onSlettet={() => {
            setSlettRad(null);
            oppfrisk();
          }}
        />
      )}
    </div>
  );
}

function NyPeriode({
  organizationId,
  organizationMemberId,
  perioder,
  steder,
  prosjekter,
  onAvbryt,
  onLagret,
}: {
  organizationId: string;
  organizationMemberId: string;
  perioder: PeriodeRad[];
  steder: Array<{ id: string; navn: string }>;
  prosjekter: Array<{ id: string; navn: string }>;
  onAvbryt: () => void;
  onLagret: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<PeriodeType | null>(null);
  const [mal, setMal] = useState("");
  const [fra, setFra] = useState(iDag());
  const [til, setTil] = useState("");
  const opprett = trpc.oppmotePeriode.opprett.useMutation({ onSuccess: () => onLagret() });

  const ny: OppmotePeriodeInput | null = type
    ? {
        type: type === "byggeplass" ? "byggeplass" : "kontor",
        fast: type === "fast",
        oppmotestedId: type === "byggeplass" ? null : mal || null,
        projectId: type === "byggeplass" ? mal || null : null,
        fraDato: fra,
        tilDato: type === "fast" ? null : til || null,
      }
    : null;
  const konflikt = ny ? finnPeriodeKonflikt(ny, perioder) : null;
  const trengerTil = type !== null && type !== "fast";
  const kanLagre =
    ny !== null && !!mal && !!fra && (!trengerTil || (!!til && til >= fra)) && !konflikt && !opprett.isPending;

  const valg = type === "byggeplass" ? prosjekter : steder;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="flex flex-wrap gap-2">
        {(["fast", "midlertidig", "byggeplass"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setType(v);
              setMal("");
            }}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              type === v
                ? "border-sitedoc-primary bg-sitedoc-primary text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t(`firma.ansatte.oppmote.type.${v}`)}
          </button>
        ))}
      </div>

      {type && (
        <>
          <select
            value={mal}
            onChange={(e) => setMal(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">
              {t(type === "byggeplass" ? "firma.ansatte.oppmote.velgProsjekt" : "firma.ansatte.oppmote.velgSted")}
            </option>
            {valg.map((v) => (
              <option key={v.id} value={v.id}>
                {v.navn}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-gray-600">
              {t("firma.ansatte.oppmote.fra")}
              <input
                type="date"
                value={fra}
                onChange={(e) => setFra(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            {trengerTil && (
              <label className="flex-1 text-xs text-gray-600">
                {t("firma.ansatte.oppmote.til")}
                <input
                  type="date"
                  value={til}
                  min={fra}
                  onChange={(e) => setTil(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            )}
          </div>
          {type === "fast" && (
            <p className="text-xs text-gray-500">{t("firma.ansatte.oppmote.fastHjelp")}</p>
          )}
          {konflikt && <p className="text-sm text-red-600">{t("firma.ansatte.oppmote.overlapp")}</p>}
          {opprett.isError && <p className="text-sm text-red-600">{opprett.error.message}</p>}
        </>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onAvbryt}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t("handling.avbryt")}
        </button>
        <button
          type="button"
          disabled={!kanLagre}
          onClick={() =>
            ny &&
            opprett.mutate({
              organizationId,
              organizationMemberId,
              type: ny.type,
              fast: ny.fast,
              oppmotestedId: ny.oppmotestedId,
              projectId: ny.projectId,
              fraDato: ny.fraDato,
              tilDato: ny.tilDato,
            })
          }
          className="rounded-md bg-sitedoc-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {t("firma.ansatte.oppmote.lagre")}
        </button>
      </div>
    </div>
  );
}

function SlettPeriodeModal({
  organizationId,
  id,
  tekst,
  onLukk,
  onSlettet,
}: {
  organizationId: string;
  id: string;
  tekst: string;
  onLukk: () => void;
  onSlettet: () => void;
}) {
  const { t } = useTranslation();
  const slett = trpc.oppmotePeriode.slett.useMutation({ onSuccess: () => onSlettet() });
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{t("firma.ansatte.oppmote.slettTittel")}</h2>
          <button
            type="button"
            onClick={onLukk}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t("handling.avbryt")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-900">{tekst}</p>
          <p className="text-sm text-gray-600">{t("firma.ansatte.oppmote.slettHva")}</p>
          {slett.isError && (
            <p className="text-sm text-red-600">{t(slett.error.message, { defaultValue: slett.error.message })}</p>
          )}
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
            <button
              type="button"
              onClick={onLukk}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("handling.avbryt")}
            </button>
            <button
              type="button"
              disabled={slett.isPending}
              onClick={() => slett.mutate({ id, organizationId })}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {t("firma.ansatte.oppmote.slett")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
