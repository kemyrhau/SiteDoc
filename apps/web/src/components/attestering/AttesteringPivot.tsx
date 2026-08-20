"use client";

// ORDRE 2 STEG 2 (D3) — pivot-visninger for firma-attestering.
// To pivoter over SAMME datakilde (hentTilAttesteringFirma, partner-scope) og
// samme uke/filtre som Sedler-visningen: «Per prosjekt» og «Per ansatt».
// Aggregatene er oversikt + inngang — attestering skjer fortsatt på sedel
// (celle-klikk → sedel-detalj) eller batch per pivot-rad.
//
// Per-ansatt har en norm-kolonne (ukenorm fra beregnUkenorm, servert per sedel)
// med avviksmarkering. D2-varselet (STEG 3) bor i badge-slotten som er reservert
// her nå — ikke fjern den.

import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer (strukturelt kompatible med AttesteringRad i page.tsx)        */
/* ------------------------------------------------------------------ */

export type PivotRad = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  ukenorm: number;
  overtidsgrunnlag?: { avvik: boolean } | null;
  ansatt: { id: string; name: string | null; email: string } | null;
  prosjekt: { id: string; name: string; internalProjectNumber: string | null } | null;
  timer: { projectId: string; timer: number | string }[];
};

/* ------------------------------------------------------------------ */
/*  Ukedag-akse                                                         */
/* ------------------------------------------------------------------ */

type Ukedag = { iso: string; kortnavn: string; erHelg: boolean };

function byggUkedager(ukestart: Date): Ukedag[] {
  const dager: Ukedag[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ukestart);
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dager.push({
      iso: `${y}-${m}-${day}`,
      kortnavn: d.toLocaleDateString("no-NB", { weekday: "short" }),
      erHelg: d.getDay() === 0 || d.getDay() === 6,
    });
  }
  return dager;
}

function isoAv(d: Date | string): string {
  const dato = new Date(d);
  const y = dato.getFullYear();
  const m = String(dato.getMonth() + 1).padStart(2, "0");
  const day = String(dato.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const fmt = (n: number): string => (n === 0 ? "" : n.toFixed(1));

/* ------------------------------------------------------------------ */
/*  Felles celle                                                        */
/* ------------------------------------------------------------------ */

function TallCelle({
  verdi,
  onClick,
  erHelg,
}: {
  verdi: number;
  onClick?: () => void;
  erHelg: boolean;
}) {
  const innhold = fmt(verdi);
  const base = `px-2 py-1 text-right font-mono text-xs tabular-nums ${
    erHelg ? "bg-gray-50" : ""
  }`;
  if (!onClick || innhold === "") {
    return <td className={`${base} text-gray-400`}>{innhold || "·"}</td>;
  }
  return (
    <td className={base}>
      <button
        onClick={onClick}
        className="w-full rounded px-1 text-right text-gray-900 hover:bg-blue-50 hover:text-blue-700"
        title=""
      >
        {innhold}
      </button>
    </td>
  );
}

/* ================================================================== */
/*  Per prosjekt                                                        */
/* ================================================================== */

export function ProsjektPivot({
  sedler,
  ukestart,
  onAapneSedel,
  onAttesterMange,
  attesterPending,
  readOnly,
}: {
  sedler: PivotRad[];
  ukestart: Date;
  onAapneSedel: (sheetId: string) => void;
  onAttesterMange: (sheetIds: string[]) => void;
  attesterPending: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const dager = useMemo(() => byggUkedager(ukestart), [ukestart]);
  const [apneProsjekt, setApneProsjekt] = useState<Set<string>>(new Set());

  const grupper = useMemo(() => {
    const m = new Map<
      string,
      { navn: string; nummer: string | null; sedler: PivotRad[] }
    >();
    for (const s of sedler) {
      const key = s.prosjekt?.id ?? "—";
      const g = m.get(key) ?? {
        navn: s.prosjekt?.name ?? "—",
        nummer: s.prosjekt?.internalProjectNumber ?? null,
        sedler: [],
      };
      g.sedler.push(s);
      m.set(key, g);
    }
    return Array.from(m.entries()).map(([id, g]) => ({ id, ...g }));
  }, [sedler]);

  if (grupper.length === 0) return <TomPivot />;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100 text-xs text-gray-600">
            <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold">
              {t("timer.attestering.pivot.prosjekt")}
            </th>
            {dager.map((d) => (
              <th
                key={d.iso}
                className={`px-2 py-2 text-right font-medium ${d.erHelg ? "bg-gray-50 text-gray-400" : ""}`}
              >
                {d.kortnavn}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">
              {t("timer.attestering.pivot.sum")}
            </th>
            {!readOnly && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {grupper.map((g) => {
            const dagSum = dager.map((d) =>
              g.sedler
                .filter((s) => isoAv(s.dato) === d.iso)
                .reduce((a, s) => a + s.totaltimer, 0),
            );
            const ukesum = dagSum.reduce((a, b) => a + b, 0);
            const apen = apneProsjekt.has(g.id);
            const ansatte = grupperPerAnsatt(g.sedler);
            return (
              <Fragment key={g.id}>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <th className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium text-gray-900">
                    <button
                      onClick={() =>
                        setApneProsjekt((prev) => {
                          const n = new Set(prev);
                          if (n.has(g.id)) n.delete(g.id);
                          else n.add(g.id);
                          return n;
                        })
                      }
                      className="flex items-center gap-1 hover:text-blue-700"
                    >
                      {apen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{g.navn}</span>
                      {g.nummer && (
                        <span className="text-xs text-gray-400">{g.nummer}</span>
                      )}
                    </button>
                  </th>
                  {dager.map((d, i) => (
                    <TallCelle key={d.iso} verdi={dagSum[i] ?? 0} erHelg={d.erHelg} />
                  ))}
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold tabular-nums text-gray-900">
                    {ukesum.toFixed(1)}
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 text-right">
                      <BatchKnapp
                        antall={g.sedler.length}
                        onClick={() => onAttesterMange(g.sedler.map((s) => s.id))}
                        pending={attesterPending}
                      />
                    </td>
                  )}
                </tr>
                {apen &&
                  ansatte.map((a) => {
                    const aDag = dager.map((d) =>
                      a.sedler.find((s) => isoAv(s.dato) === d.iso),
                    );
                    return (
                      <tr
                        key={`${g.id}-${a.id}`}
                        className="border-b border-gray-50 bg-gray-50/40 text-gray-600"
                      >
                        <td className="sticky left-0 z-10 bg-gray-50 py-1 pl-9 pr-3 text-left text-xs">
                          {a.navn}
                        </td>
                        {aDag.map((s, i) => (
                          <TallCelle
                            key={i}
                            verdi={s?.totaltimer ?? 0}
                            erHelg={dager[i]?.erHelg ?? false}
                            onClick={s ? () => onAapneSedel(s.id) : undefined}
                          />
                        ))}
                        <td className="px-3 py-1 text-right font-mono text-xs tabular-nums">
                          {a.sedler.reduce((x, s) => x + s.totaltimer, 0).toFixed(1)}
                        </td>
                        {!readOnly && <td />}
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/*  Per ansatt                                                          */
/* ================================================================== */

export function AnsattPivot({
  sedler,
  ukestart,
  onAapneSedel,
  onAttesterMange,
  attesterPending,
  readOnly,
}: {
  sedler: PivotRad[];
  ukestart: Date;
  onAapneSedel: (sheetId: string) => void;
  onAttesterMange: (sheetIds: string[]) => void;
  attesterPending: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const dager = useMemo(() => byggUkedager(ukestart), [ukestart]);
  const [apenAnsatt, setApenAnsatt] = useState<Set<string>>(new Set());

  const ansatte = useMemo(() => grupperPerAnsatt(sedler), [sedler]);
  if (ansatte.length === 0) return <TomPivot />;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100 text-xs text-gray-600">
            <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold">
              {t("timer.attestering.pivot.ansatt")}
            </th>
            {dager.map((d) => (
              <th
                key={d.iso}
                className={`px-2 py-2 text-right font-medium ${d.erHelg ? "bg-gray-50 text-gray-400" : ""}`}
              >
                {d.kortnavn}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-semibold">
              {t("timer.attestering.pivot.sum")}
            </th>
            <th className="px-3 py-2 text-right font-semibold text-gray-500">
              {t("timer.attestering.pivot.norm")}
            </th>
            {!readOnly && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {ansatte.map((a) => {
            const aDag = dager.map((d) =>
              a.sedler.find((s) => isoAv(s.dato) === d.iso),
            );
            const ukesum = a.sedler.reduce((x, s) => x + s.totaltimer, 0);
            const norm = a.sedler[0]?.ukenorm ?? 0;
            const harAvvik =
              a.sedler.some((s) => s.overtidsgrunnlag?.avvik) ||
              (norm > 0 && ukesum > norm + 0.01);
            const apen = apenAnsatt.has(a.id);
            const prosjekter = grupperPerProsjekt(a.sedler);
            return (
              <Fragment key={a.id}>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <th className="sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium text-gray-900">
                    <button
                      onClick={() =>
                        setApenAnsatt((prev) => {
                          const n = new Set(prev);
                          if (n.has(a.id)) n.delete(a.id);
                          else n.add(a.id);
                          return n;
                        })
                      }
                      className="flex items-center gap-1 hover:text-blue-700"
                    >
                      {apen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{a.navn}</span>
                    </button>
                  </th>
                  {aDag.map((s, i) => (
                    <TallCelle
                      key={i}
                      verdi={s?.totaltimer ?? 0}
                      erHelg={dager[i]?.erHelg ?? false}
                      onClick={s ? () => onAapneSedel(s.id) : undefined}
                    />
                  ))}
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold tabular-nums text-gray-900">
                    {ukesum.toFixed(1)}
                  </td>
                  {/* Norm-kolonne + reservert badge-slot for D2-varsel (STEG 3) */}
                  <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-gray-500">
                    <div className="flex items-center justify-end gap-1">
                      {/* badge-slot: STEG 3 fyller denne med D2-varsel */}
                      <span className="inline-flex h-4 w-4 items-center justify-center">
                        {harAvvik && (
                          <TriangleAlert
                            className="h-3.5 w-3.5 text-amber-500"
                            aria-label={t("timer.attestering.pivot.avvik")}
                          />
                        )}
                      </span>
                      <span>{norm > 0 ? norm.toFixed(1) : "·"}</span>
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 text-right">
                      <BatchKnapp
                        antall={a.sedler.length}
                        onClick={() => onAttesterMange(a.sedler.map((s) => s.id))}
                        pending={attesterPending}
                      />
                    </td>
                  )}
                </tr>
                {apen &&
                  prosjekter.map((p) => {
                    const pDag = dager.map((d) => {
                      const s = a.sedler.find((x) => isoAv(x.dato) === d.iso);
                      if (!s) return { timer: 0, sheetId: null as string | null };
                      const timer = s.timer
                        .filter((r) => r.projectId === p.id)
                        .reduce((x, r) => x + Number(r.timer), 0);
                      return { timer, sheetId: timer > 0 ? s.id : null };
                    });
                    return (
                      <tr
                        key={`${a.id}-${p.id}`}
                        className="border-b border-gray-50 bg-gray-50/40 text-gray-600"
                      >
                        <td className="sticky left-0 z-10 bg-gray-50 py-1 pl-9 pr-3 text-left text-xs">
                          {p.navn}
                        </td>
                        {pDag.map((c, i) => (
                          <TallCelle
                            key={i}
                            verdi={c.timer}
                            erHelg={dager[i]?.erHelg ?? false}
                            onClick={c.sheetId ? () => onAapneSedel(c.sheetId!) : undefined}
                          />
                        ))}
                        <td className="px-3 py-1 text-right font-mono text-xs tabular-nums">
                          {pDag.reduce((x, c) => x + c.timer, 0).toFixed(1)}
                        </td>
                        <td />
                        {!readOnly && <td />}
                      </tr>
                    );
                  })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Delte helpers                                                       */
/* ------------------------------------------------------------------ */

function grupperPerAnsatt(sedler: PivotRad[]) {
  const m = new Map<string, { id: string; navn: string; sedler: PivotRad[] }>();
  for (const s of sedler) {
    const id = s.ansatt?.id ?? "—";
    const g = m.get(id) ?? {
      id,
      navn: s.ansatt?.name ?? s.ansatt?.email ?? "—",
      sedler: [],
    };
    g.sedler.push(s);
    m.set(id, g);
  }
  return Array.from(m.values()).sort((a, b) => a.navn.localeCompare(b.navn, "no"));
}

function grupperPerProsjekt(sedler: PivotRad[]) {
  const m = new Map<string, { id: string; navn: string }>();
  for (const s of sedler) {
    for (const r of s.timer) {
      if (!m.has(r.projectId)) {
        m.set(r.projectId, {
          id: r.projectId,
          navn:
            s.prosjekt?.id === r.projectId ? s.prosjekt.name : r.projectId.slice(0, 8),
        });
      }
    }
  }
  return Array.from(m.values());
}

function BatchKnapp({
  antall,
  onClick,
  pending,
}: {
  antall: number;
  onClick: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={pending}>
      <Check className="mr-1 h-3.5 w-3.5" />
      {t("timer.attestering.pivot.attesterRad", { antall })}
    </Button>
  );
}

function TomPivot() {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <p className="text-sm text-gray-500">{t("timer.attestering.pivot.ingenData")}</p>
    </div>
  );
}
