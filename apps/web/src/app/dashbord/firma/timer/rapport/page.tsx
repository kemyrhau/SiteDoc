"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@sitedoc/ui";
import { useFirma } from "@/kontekst/firma-kontekst";

type StatusFordeling = { kladd: number; sent: number; attestert: number };

type AnsattRad = {
  userId: string;
  navn: string | null;
  email: string;
  ansattnummer: string | null;
  totalTimer: number;
  antallSedler: number;
  sistRegistrert: string | null;
  statusFordeling: StatusFordeling;
  perProsjekt: Array<{
    prosjektId: string;
    prosjektNavn: string;
    prosjektNummer: string | null;
    timer: number;
  }>;
  perDag: Array<{ dato: string; timer: number }>;
};

type RapportResultat = {
  ansatte: AnsattRad[];
  prosjekter: Array<{ id: string; navn: string; nummer: string | null }>;
  totalTimer: number;
  antallSedler: number;
  statusFordeling: StatusFordeling;
};

type SortKolonne =
  | "navn"
  | "ansattnummer"
  | "totalTimer"
  | "antallSedler"
  | "sistRegistrert";
type SortRetning = "asc" | "desc";

type DetaljVy = "dag" | "uke";

function isoUkeNokkel(datoStr: string): string {
  const d = new Date(datoStr);
  const year = d.getUTCFullYear();
  const dag = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));
  // ISO 8601 ukeberegning
  const dayNum = (dag.getUTCDay() + 6) % 7;
  dag.setUTCDate(dag.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dag.getUTCFullYear(), 0, 4));
  const diff = (dag.getTime() - firstThursday.getTime()) / 86400000;
  const uke = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${dag.getUTCFullYear()}-U${String(uke).padStart(2, "0")}`;
}

function formaterTimer(t: number): string {
  return t.toFixed(2).replace(/\.?0+$/, "");
}

function førsteOgSisteIMåneden(): { fra: string; til: string } {
  const nå = new Date();
  const fra = new Date(nå.getFullYear(), nå.getMonth(), 1);
  const til = new Date(nå.getFullYear(), nå.getMonth() + 1, 0);
  return {
    fra: fra.toISOString().slice(0, 10),
    til: til.toISOString().slice(0, 10),
  };
}

export default function TimerRapportSide() {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const orgId = valgtFirma?.id;
  const harTimer = valgtFirma?.aktiveFirmamoduler.includes("timer") ?? false;

  const standardPeriode = useMemo(() => førsteOgSisteIMåneden(), []);
  const [fra, setFra] = useState(standardPeriode.fra);
  const [til, setTil] = useState(standardPeriode.til);
  const [valgtProsjektId, setValgtProsjektId] = useState<string>("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string>("");
  const [sortKolonne, setSortKolonne] = useState<SortKolonne>("totalTimer");
  const [sortRetning, setSortRetning] = useState<SortRetning>("desc");
  const [ekspandertUserId, setEkspandertUserId] = useState<string | null>(null);
  const [detaljVy, setDetaljVy] = useState<DetaljVy>("dag");

  const { data: prosjekter } = trpc.timer.rapport.hentFirmaProsjekterMedTimer.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && harTimer },
  );
  const { data: ansatte } = trpc.timer.rapport.hentFirmaAnsatteMedTimer.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && harTimer },
  );
  const { data: rapport, isLoading } = trpc.timer.rapport.firmaPeriodeRapport.useQuery(
    {
      organizationId: orgId!,
      fra,
      til,
      prosjektId: valgtProsjektId || undefined,
      ansattId: valgtAnsattId || undefined,
    },
    { enabled: !!orgId && harTimer },
  );

  // Viktig: useMemo MÅ kalles før alle conditional returns under,
  // ellers brytes Rules of Hooks (React error #310 — flagget i memory
  // som tidligere ftd-økonomi-bug 2026-04).
  const rapportData = (rapport ?? null) as RapportResultat | null;
  const sorterteAnsatte = useMemo(() => {
    if (!rapportData) return [];
    const arr = [...rapportData.ansatte];
    arr.sort((a, b) => {
      const dir = sortRetning === "asc" ? 1 : -1;
      switch (sortKolonne) {
        case "navn":
          return ((a.navn ?? a.email).localeCompare(b.navn ?? b.email)) * dir;
        case "ansattnummer":
          return ((a.ansattnummer ?? "").localeCompare(b.ansattnummer ?? "")) * dir;
        case "totalTimer":
          return (a.totalTimer - b.totalTimer) * dir;
        case "antallSedler":
          return (a.antallSedler - b.antallSedler) * dir;
        case "sistRegistrert": {
          const ad = a.sistRegistrert ? new Date(a.sistRegistrert).getTime() : 0;
          const bd = b.sistRegistrert ? new Date(b.sistRegistrert).getTime() : 0;
          return (ad - bd) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [rapportData, sortKolonne, sortRetning]);

  if (!orgId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!harTimer) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-base font-semibold text-amber-900">
          {t("firma.timer.rapport.modulIkkeAktivert.tittel")}
        </h2>
        <p className="mt-2 text-sm text-amber-800">
          {t("firma.timer.rapport.modulIkkeAktivert.beskrivelse")}
        </p>
      </div>
    );
  }

  function settHurtigPeriode(type: "denne-uken" | "forrige-uken" | "denne-maaneden" | "forrige-maaneden") {
    const nå = new Date();
    let fraDato: Date;
    let tilDato: Date;
    if (type === "denne-uken") {
      const dag = (nå.getDay() + 6) % 7;
      fraDato = new Date(nå);
      fraDato.setDate(nå.getDate() - dag);
      tilDato = new Date(fraDato);
      tilDato.setDate(fraDato.getDate() + 6);
    } else if (type === "forrige-uken") {
      const dag = (nå.getDay() + 6) % 7;
      fraDato = new Date(nå);
      fraDato.setDate(nå.getDate() - dag - 7);
      tilDato = new Date(fraDato);
      tilDato.setDate(fraDato.getDate() + 6);
    } else if (type === "denne-maaneden") {
      fraDato = new Date(nå.getFullYear(), nå.getMonth(), 1);
      tilDato = new Date(nå.getFullYear(), nå.getMonth() + 1, 0);
    } else {
      fraDato = new Date(nå.getFullYear(), nå.getMonth() - 1, 1);
      tilDato = new Date(nå.getFullYear(), nå.getMonth(), 0);
    }
    setFra(fraDato.toISOString().slice(0, 10));
    setTil(tilDato.toISOString().slice(0, 10));
  }

  function bytteSort(kolonne: SortKolonne) {
    if (sortKolonne === kolonne) {
      setSortRetning(sortRetning === "asc" ? "desc" : "asc");
    } else {
      setSortKolonne(kolonne);
      setSortRetning("desc");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-gray-900">
        {t("firma.timer.rapport.tittel")}
      </h1>

      {/* Filter-rad */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.fra")}
            </label>
            <input
              type="date"
              value={fra}
              onChange={(e) => setFra(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.til")}
            </label>
            <input
              type="date"
              value={til}
              onChange={(e) => setTil(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <HurtigKnapp onClick={() => settHurtigPeriode("denne-uken")}>
              {t("firma.timer.rapport.filter.denneUken")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("forrige-uken")}>
              {t("firma.timer.rapport.filter.forrigeUken")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("denne-maaneden")}>
              {t("firma.timer.rapport.filter.denneMaaneden")}
            </HurtigKnapp>
            <HurtigKnapp onClick={() => settHurtigPeriode("forrige-maaneden")}>
              {t("firma.timer.rapport.filter.forrigeMaaneden")}
            </HurtigKnapp>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.prosjekt")}
            </label>
            <select
              value={valgtProsjektId}
              onChange={(e) => setValgtProsjektId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t("firma.timer.rapport.filter.alleProsjekter")}</option>
              {(prosjekter ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">
              {t("firma.timer.rapport.filter.ansatt")}
            </label>
            <select
              value={valgtAnsattId}
              onChange={(e) => setValgtAnsattId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">{t("firma.timer.rapport.filter.alleAnsatte")}</option>
              {(ansatte ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Sammendrag */}
      {rapportData && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t("firma.timer.rapport.sammendrag.totalTimer")} verdi={formaterTimer(rapportData.totalTimer)} fremhev />
          <Stat label={t("firma.timer.rapport.sammendrag.antallAnsatte")} verdi={String(rapportData.ansatte.length)} />
          <Stat label={t("firma.timer.rapport.sammendrag.antallSedler")} verdi={String(rapportData.antallSedler)} />
          <Stat label={t("firma.timer.rapport.sammendrag.sent")} verdi={String(rapportData.statusFordeling.sent)} />
          <Stat label={t("firma.timer.rapport.sammendrag.attestert")} verdi={String(rapportData.statusFordeling.attestert)} />
        </div>
      )}

      {/* Tabell */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !rapportData || rapportData.ansatte.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-sm text-gray-600">
          {t("firma.timer.rapport.tom")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="w-8 px-3 py-3"></th>
                <SortHeader k="navn" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.ansatt")}
                </SortHeader>
                <SortHeader k="ansattnummer" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.ansattnummer")}
                </SortHeader>
                <SortHeader k="totalTimer" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort} høyre>
                  {t("firma.timer.rapport.kolonne.totalTimer")}
                </SortHeader>
                <SortHeader k="antallSedler" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort} høyre>
                  {t("firma.timer.rapport.kolonne.sedler")}
                </SortHeader>
                <SortHeader k="sistRegistrert" aktiv={sortKolonne} retning={sortRetning} onClick={bytteSort}>
                  {t("firma.timer.rapport.kolonne.sistRegistrert")}
                </SortHeader>
                <th className="px-3 py-3">{t("firma.timer.rapport.kolonne.status")}</th>
              </tr>
            </thead>
            <tbody>
              {sorterteAnsatte.map((a) => {
                const ekspandert = ekspandertUserId === a.userId;
                return (
                  <>
                    <tr
                      key={a.userId}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setEkspandertUserId(ekspandert ? null : a.userId)}
                    >
                      <td className="px-3 py-2">
                        {ekspandert ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{a.navn ?? a.email}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{a.ansattnummer ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{formaterTimer(a.totalTimer)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{a.antallSedler}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {a.sistRegistrert ? new Date(a.sistRegistrert).toLocaleDateString("nb-NO") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadges fordeling={a.statusFordeling} t={t} />
                      </td>
                    </tr>
                    {ekspandert && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <Detaljvisning ansatt={a} vy={detaljVy} setVy={setDetaljVy} t={t} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HurtigKnapp({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
    >
      {children}
    </button>
  );
}

function Stat({ label, verdi, fremhev }: { label: string; verdi: string; fremhev?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className={`text-2xl font-semibold ${fremhev ? "text-sitedoc-primary" : "text-gray-900"}`}>{verdi}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function SortHeader({
  k,
  aktiv,
  retning,
  onClick,
  høyre,
  children,
}: {
  k: SortKolonne;
  aktiv: SortKolonne;
  retning: SortRetning;
  onClick: (k: SortKolonne) => void;
  høyre?: boolean;
  children: React.ReactNode;
}) {
  return (
    <th
      className={`cursor-pointer select-none px-3 py-3 hover:text-gray-900 ${høyre ? "text-right" : ""}`}
      onClick={() => onClick(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {aktiv === k && <span className="text-gray-400">{retning === "asc" ? "↑" : "↓"}</span>}
      </span>
    </th>
  );
}

function StatusBadges({ fordeling, t }: { fordeling: StatusFordeling; t: (k: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {fordeling.kladd > 0 && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {t("firma.timer.rapport.status.kladd")}: {fordeling.kladd}
        </span>
      )}
      {fordeling.sent > 0 && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
          {t("firma.timer.rapport.status.sent")}: {fordeling.sent}
        </span>
      )}
      {fordeling.attestert > 0 && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
          {t("firma.timer.rapport.status.attestert")}: {fordeling.attestert}
        </span>
      )}
    </div>
  );
}

function Detaljvisning({
  ansatt,
  vy,
  setVy,
  t,
}: {
  ansatt: AnsattRad;
  vy: DetaljVy;
  setVy: (v: DetaljVy) => void;
  t: (k: string) => string;
}) {
  const perPeriode = useMemo(() => {
    if (vy === "dag") return ansatt.perDag;
    const map = new Map<string, number>();
    for (const d of ansatt.perDag) {
      const uke = isoUkeNokkel(d.dato);
      map.set(uke, (map.get(uke) ?? 0) + d.timer);
    }
    return Array.from(map.entries()).map(([dato, timer]) => ({ dato, timer }));
  }, [ansatt.perDag, vy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          {ansatt.navn ?? ansatt.email}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setVy("dag")}
            className={`rounded-md px-2 py-1 text-xs ${vy === "dag" ? "bg-sitedoc-primary text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            {t("firma.timer.rapport.detalj.perDag")}
          </button>
          <button
            type="button"
            onClick={() => setVy("uke")}
            className={`rounded-md px-2 py-1 text-xs ${vy === "uke" ? "bg-sitedoc-primary text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            {t("firma.timer.rapport.detalj.perUke")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Per periode */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {vy === "dag" ? t("firma.timer.rapport.detalj.perDag") : t("firma.timer.rapport.detalj.perUke")}
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {perPeriode.map((d) => (
                <tr key={d.dato} className="border-t border-gray-100 first:border-t-0">
                  <td className="py-1 text-gray-700">{d.dato}</td>
                  <td className="py-1 text-right font-medium text-gray-900">{formaterTimer(d.timer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per prosjekt */}
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("firma.timer.rapport.detalj.perProsjekt")}
          </h4>
          <table className="w-full text-xs">
            <tbody>
              {ansatt.perProsjekt
                .slice()
                .sort((a, b) => b.timer - a.timer)
                .map((p) => (
                  <tr key={p.prosjektId} className="border-t border-gray-100 first:border-t-0">
                    <td className="py-1 text-gray-700">
                      {p.prosjektNavn}
                      {p.prosjektNummer && (
                        <span className="ml-1 font-mono text-[10px] text-gray-400">{p.prosjektNummer}</span>
                      )}
                    </td>
                    <td className="py-1 text-right font-medium text-gray-900">{formaterTimer(p.timer)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
