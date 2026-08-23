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
//
// FABEL → STEG 3 (attestantvarsel): SKAL gjenbruke beregnUkeAvvik/
// overtidsgrunnlag — ikke duplisere regnestykket. Badge-slotten her er rett plass.
//
// Avviksbadgen regnes på HELE ukens grunnlag (sent+accepted samlet, `ukeGrunnlag`),
// ikke bare den viste fanen — en halv-attestert uke ga tidligere falsk «ført
// under norm». Visning (`visningsRader`) og avviksgrunnlag (`ukeGrunnlag`) er
// bevisst atskilte i AnsattPivot-signaturen.

import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@sitedoc/ui";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import {
  DagsKort,
  HoverKort,
  harKortInnhold,
  useKatalogNavn,
  type KatalogNavn,
} from "./DagsKort";

/* ------------------------------------------------------------------ */
/*  Typer (strukturelt kompatible med AttesteringRad i page.tsx)        */
/* ------------------------------------------------------------------ */

export type PivotTimerRad = {
  /** SheetTimer.id — maskinrader nøstes hit via sheetTimerId. */
  id: string;
  projectId: string;
  timer: number;
  aktivitetId: string;
  lonnsartId: string;
  beskrivelse: string | null;
};

export type PivotMaskinRad = {
  vehicleId: string;
  /** Kobling til timerraden maskinen ble ført med (nøsting). null = uten timerrad. */
  sheetTimerId: string | null;
  timer: number;
  mengde: number | null;
  enhet: string | null;
};

export type PivotTilleggRad = {
  tilleggId: string;
  antall: number;
  kommentar: string | null;
};

export type PivotUtleggRad = {
  /** Kategorinavn fra server-select (ingen katalog-oppslag på klient). */
  kategoriNavn: string | null;
  belop: number | null;
};

export type PivotRad = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  ukenorm: number;
  overtidsgrunnlag?: {
    sumOrdinaert: number;
    sumOvertid: number;
    beregnetOvertid: number;
    avvik: boolean;
  } | null;
  ansatt: { id: string; name: string | null; email: string } | null;
  prosjekt: { id: string; name: string; internalProjectNumber: string | null } | null;
  timer: PivotTimerRad[];
  // Dagskort: maskinrader (nøstes under timerrad via sheetTimerId) + T.11-flagg.
  maskiner: PivotMaskinRad[];
  // Dagskort: tillegg + utlegg registrert samme dag («ett kort» = alt).
  tillegg: PivotTilleggRad[];
  utlegg: PivotUtleggRad[];
  manglerMaskinforerbevis: boolean;
};

/** Uke-nivå avvik (D2): misforhold mellom FØRT og BEREGNET overtid — ikke
 *  «over norm». En ansatt som fører overtiden riktig har intet avvik. */
export type UkeAvvik = {
  norm: number;
  ukesum: number;
  sumOrdinaert: number;
  sumOvertid: number; // ført (valgt)
  beregnetOvertid: number; // ukesum − norm, gulv 0
  avvikTimer: number; // beregnet − ført; >0 = overtid ikke ført, <0 = ført under norm
};

function beregnUkeAvvik(sedler: PivotRad[]): UkeAvvik {
  const norm = sedler[0]?.ukenorm ?? 0;
  const ukesum = r2(sedler.reduce((a, s) => a + s.totaltimer, 0));
  const sumOvertid = r2(
    sedler.reduce((a, s) => a + (s.overtidsgrunnlag?.sumOvertid ?? 0), 0),
  );
  const sumOrdinaert = r2(ukesum - sumOvertid);
  const beregnetOvertid = r2(Math.max(0, ukesum - norm));
  const avvikTimer = r2(beregnetOvertid - sumOvertid);
  return { norm, ukesum, sumOrdinaert, sumOvertid, beregnetOvertid, avvikTimer };
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

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
      >
        {innhold}
      </button>
    </td>
  );
}

/** Celle som representerer ÉN dagsseddel (én ansatt, én dag). Som TallCelle,
 *  men med dagskort-hover når sedelen har beskrivelse eller maskinarbeid.
 *  Klikk på tallet går fortsatt til sedel-detaljen. */
function SeddelCelle({
  seddel,
  erHelg,
  onAapneSedel,
  katalog,
}: {
  seddel: PivotRad | undefined;
  erHelg: boolean;
  onAapneSedel: (sheetId: string) => void;
  katalog: KatalogNavn;
}) {
  const verdi = seddel?.totaltimer ?? 0;
  const innhold = fmt(verdi);
  const base = `px-2 py-1 text-right font-mono text-xs tabular-nums ${
    erHelg ? "bg-gray-50" : ""
  }`;
  if (!seddel || innhold === "") {
    return <td className={`${base} text-gray-400`}>{innhold || "·"}</td>;
  }
  const kort = harKortInnhold(seddel) ? (
    <DagsKort seddel={seddel} katalog={katalog} />
  ) : null;
  return (
    <td className={base}>
      <span className="flex justify-end">
        <HoverKort kort={kort}>
          <button
            onClick={() => onAapneSedel(seddel.id)}
            className="rounded px-1 text-right text-gray-900 hover:bg-blue-50 hover:text-blue-700"
          >
            {innhold}
          </button>
        </HoverKort>
      </span>
    </td>
  );
}

/* ================================================================== */
/*  Per prosjekt                                                        */
/* ================================================================== */

export function ProsjektPivot({
  visningsRader,
  ukestart,
  onAapneSedel,
  onAttesterMange,
  attesterPending,
  readOnly,
}: {
  /** Rader som VISES (aktiv fane, filtrert). Per-prosjekt-pivoten har ingen
   *  avviksbadge, så den trenger kun visnings-datasettet. */
  visningsRader: PivotRad[];
  ukestart: Date;
  onAapneSedel: (sheetId: string) => void;
  onAttesterMange: (sheetIds: string[]) => void;
  attesterPending: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const katalog = useKatalogNavn(valgtFirma?.id);
  const dager = useMemo(() => byggUkedager(ukestart), [ukestart]);
  const [apneProsjekt, setApneProsjekt] = useState<Set<string>>(new Set());

  const grupper = useMemo(() => {
    const m = new Map<
      string,
      { navn: string; nummer: string | null; sedler: PivotRad[] }
    >();
    for (const s of visningsRader) {
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
  }, [visningsRader]);

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
                          <SeddelCelle
                            key={i}
                            seddel={s}
                            erHelg={dager[i]?.erHelg ?? false}
                            onAapneSedel={onAapneSedel}
                            katalog={katalog}
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
  visningsRader,
  ukeGrunnlag,
  ukestart,
  onAapneSedel,
  onAttesterMange,
  attesterPending,
  readOnly,
}: {
  /** Rader som VISES (aktiv fane, filtrert). Styrer tabell-innholdet. */
  visningsRader: PivotRad[];
  /** Avviksgrunnlag: HELE uken (sent+accepted samlet), samme filtre. Styrer
   *  norm-kolonnens avviksbadge — badgen skal si sannheten om uken, ikke om
   *  fanen (en halv-attestert uke ga tidligere falsk «ført under norm»). */
  ukeGrunnlag: PivotRad[];
  ukestart: Date;
  onAapneSedel: (sheetId: string) => void;
  onAttesterMange: (sheetIds: string[]) => void;
  attesterPending: boolean;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const { valgtFirma } = useFirma();
  const katalog = useKatalogNavn(valgtFirma?.id);
  const dager = useMemo(() => byggUkedager(ukestart), [ukestart]);
  const [apenAnsatt, setApenAnsatt] = useState<Set<string>>(new Set());

  const ansatte = useMemo(() => grupperPerAnsatt(visningsRader), [visningsRader]);

  // Avviksgrunnlag per ansatt = hele ukens rader (sent+accepted), slått opp på
  // ansatt-id. Vises fanevis, men badgen regnes på unionen.
  const grunnlagPerAnsatt = useMemo(() => {
    const m = new Map<string, PivotRad[]>();
    for (const g of grupperPerAnsatt(ukeGrunnlag)) m.set(g.id, g.sedler);
    return m;
  }, [ukeGrunnlag]);

  // Prosjektnavn-oppslag for ekspanderte rader — aldri rå UUID (fix #2).
  const prosjektNavnFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of ukeGrunnlag) if (s.prosjekt) m.set(s.prosjekt.id, s.prosjekt.name);
    return (projectId: string): string =>
      m.get(projectId) ?? t("timer.attestering.pivot.annetProsjekt");
  }, [ukeGrunnlag, t]);

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
            // Avvik fra hele ukens grunnlag (union), ikke bare vist fane.
            const avvik = beregnUkeAvvik(grunnlagPerAnsatt.get(a.id) ?? a.sedler);
            // ukesum til visning følger fanen (det attestanten ser nå).
            const ukesum = r2(a.sedler.reduce((x, s) => x + s.totaltimer, 0));
            const apen = apenAnsatt.has(a.id);
            const prosjekter = grupperPerProsjekt(a.sedler, prosjektNavnFor);
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
                    <SeddelCelle
                      key={i}
                      seddel={s}
                      erHelg={dager[i]?.erHelg ?? false}
                      onAapneSedel={onAapneSedel}
                      katalog={katalog}
                    />
                  ))}
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold tabular-nums text-gray-900">
                    {ukesum.toFixed(1)}
                  </td>
                  {/* Norm-kolonne: eksplisitt tallfestet avviksbadge (D2) + norm */}
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Avviksbadge avvik={avvik} />
                      <span className="font-mono text-xs tabular-nums text-gray-500">
                        {avvik.norm > 0 ? avvik.norm.toFixed(1) : "·"}
                      </span>
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

function grupperPerProsjekt(
  sedler: PivotRad[],
  navnFor: (projectId: string) => string,
) {
  const m = new Map<string, { id: string; navn: string }>();
  for (const s of sedler) {
    for (const r of s.timer) {
      if (!m.has(r.projectId)) {
        m.set(r.projectId, { id: r.projectId, navn: navnFor(r.projectId) });
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

/** Eksplisitt tallfestet avviksbadge (D2). «over norm» = beregnet overtid ikke
 *  ført; «ført under norm» = overtid ført mens uken er under norm. Tooltip viser
 *  de tre D2-tallene. Intet avvik → ingen badge (norm forblir høyrejustert). */
function Avviksbadge({ avvik }: { avvik: UkeAvvik }) {
  const { t } = useTranslation();
  if (avvik.norm <= 0) return null;
  const over = avvik.avvikTimer > 0.01;
  const under = avvik.avvikTimer < -0.01;
  if (!over && !under) return null;
  const tooltip = t("timer.attestering.pivot.avvikTooltip", {
    norm: avvik.norm.toFixed(1),
    ord: avvik.sumOrdinaert.toFixed(1),
    ot: avvik.sumOvertid.toFixed(1),
  });
  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
    >
      <TriangleAlert className="h-3 w-3 shrink-0" />
      {over
        ? t("timer.attestering.pivot.avvikOver", { timer: avvik.avvikTimer.toFixed(1) })
        : t("timer.attestering.pivot.avvikUnder")}
    </span>
  );
}
