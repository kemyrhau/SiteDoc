"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type ReactElement, type ReactNode, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  SorterPil,
  KolonneFilter,
  useBreddeDragning,
  BreddeHandtak,
  type SorterRetning,
} from "@sitedoc/ui";
import { TIMER_TABELL_KOL, TIMER_TABELL_KOL_BREDDE, type TimerTabellKolKey } from "@sitedoc/shared";
import { FlyttbareKolonner, useFlyttbarKolonne } from "@/components/FlyttbareKolonner";

/**
 * Tabellen for timeregistreringer — ÉN komponent for firma-attesteringen og rapportens
 * Detaljer (spec prosjektkort-kortid R1, T47). Rapportens virtualiserte grid er løftet hit;
 * hodets verktøy (sorterpil, filter, bredde, flytting) er de samme delene som `Table`
 * bruker (`@sitedoc/ui` tabellverktoy + `useFlyttbarKolonne`, T51).
 *
 *  - Overskrifter og standardbredder fra den delte kolonnelista `TIMER_TABELL_KOL` (R16).
 *    Dratt bredde vinner (R6); kalleren lagrer den (useTabelloppsett).
 *  - Hodet står fast øverst (R5). Venstre- og høyrekolonnen (avkrysning, knapper) står
 *    fast ved tabellens kanter; bare kolonnene mellom ruller sidelengs (R22).
 *  - En linje kan ha flere tekstlinjer (én pr. maskin/vare, H14). Bakgrunnen veksler pr.
 *    linje, skillestreken står bare mellom linjer, og en stripe i venstrekolonnen går over
 *    hele linja (R25).
 *  - Sortering gjelder besøket (lokal tilstand, R7): stigende → synkende → kortrekkefølge.
 *    Sortert tabell er en flat liste uten oversikts- og sumrader. Uten `sorterVerdi`
 *    er det ingen sorterpil (rapporten, R19).
 *  - Filteret styres av kalleren (verdier + hvilke kolonner som har filter), fordi
 *    kalleren filtrerer hele strukturen og viser brikkene over tabellen.
 */

/**
 * w5b (B14 A): radens plass i en dagsblokk. Utelatt → vanlig rad, som i timerapporten.
 * En blokk har farget venstrekant, ramme til høyre og luft etter siste rad; linjene i
 * blokka veksler ikke mellom hvit og grå.
 */
export interface TimerRadBlokk {
  /** Venstrekantens farge (Tailwind `border-…`-klasse). */
  kant: string;
  /** Siste rad i blokka: bunnstrek og luft til neste blokk. */
  slutt?: boolean;
}

export type TimerRadTabellRad<R> =
  | {
      kind: "linje";
      nokkel: string;
      data: R;
      underlinjer: number;
      blokk?: TimerRadBlokk;
      /**
       * w5b: kolonner som står tomme fordi raden over viser verdien (dato, ansatt, pr.nr.).
       * Sortert tabell er en flat liste, og da vises de igjen (WM82).
       */
      skjul?: readonly TimerTabellKolKey[];
    }
  | { kind: "overskrift"; nokkel: string; innhold: ReactNode }
  /** w5 (bilde 7): innhold under en linje i tabellens synlige bredde (registreringen åpnet). */
  | { kind: "panel"; nokkel: string; innhold: ReactNode; blokk?: TimerRadBlokk }
  | {
      kind: "sum";
      nokkel: string;
      /** Innholdet i en kolonne på sumraden (tom = ingenting). */
      celle: (k: TimerTabellKolKey) => ReactNode;
      sterk?: boolean;
      venstre?: ReactNode;
      hoyre?: ReactNode;
      /**
       * w5b: «dag» = blå dagsrad øverst i dagen; «jobb» = jobbrad (ett kort) med strek over.
       * Utelatt → sumrad som før.
       */
      variant?: "dag" | "jobb";
      blokk?: TimerRadBlokk;
    };

export interface TimerRadTabellFilter {
  verdier: Record<string, string>;
  onEndring: (kolonne: TimerTabellKolKey, verdi: string) => void;
  /** Valgene i kolonnens filter. `undefined` = kolonnen har ikke filter. */
  alternativer: (kolonne: TimerTabellKolKey) => { value: string; label: string }[] | undefined;
  /** Tekstsøk i kolonnens filter (f.eks. Beskrivelse, R8). */
  sok?: (kolonne: TimerTabellKolKey) => { verdi: string; onChange: (v: string) => void } | undefined;
}

export type TimerRadTabellSortering = { k: TimerTabellKolKey; retning: SorterRetning };

interface Props<R> {
  /** Synlige kolonner i visningsrekkefølge. */
  kolonner: readonly TimerTabellKolKey[];
  rader: TimerRadTabellRad<R>[];
  /** Cellen i kolonne `k` på tekstlinje `under` (0 = første) av en linje. */
  celle: (k: TimerTabellKolKey, data: R, under: number) => ReactNode;
  /** `title` på cella (kuttet tekst). Utelatt → ingen title. */
  celleTittel?: (k: TimerTabellKolKey, data: R, under: number) => string | undefined;
  /** Dratte bredder pr. kolonne (px). */
  bredder?: Record<string, number>;
  /** Utelatt → ingen bredde-håndtak. */
  onBreddeEndring?: (bredder: Record<string, number>) => void;
  /** Utelatt → ingen flytting i hodet. */
  onRekkefolgeEndring?: (ny: TimerTabellKolKey[]) => void;
  /** Sorteringsverdi. Utelatt → ingen sortering (rapporten, R19). */
  sorterVerdi?: (k: TimerTabellKolKey, data: R) => string | number | null;
  filter?: TimerRadTabellFilter;
  /** Styrt sortering (brikke med × over tabellen). Utelatt → tabellen holder den selv. */
  sortering?: TimerRadTabellSortering | null;
  onSortering?: (s: TimerRadTabellSortering | null) => void;
  /** Fast venstrekolonne (avkrysning). Bredde i px. */
  venstre?: { bredde: number; hode?: ReactNode; celle: (data: R) => ReactNode };
  /** Fast høyrekolonne (knapper). Bredde i px. */
  hoyre?: { bredde: number; hode?: ReactNode; celle: (data: R) => ReactNode };
  /** Ekstra klasse på linja (f.eks. markert ved avvik). */
  linjeKlasse?: (data: R) => string | undefined;
  /** Klassen som setter rammas høyde. Standard som rapporten. */
  rammeKlasse?: string;
  /** Innrykk i Betegnelse (rapportens ↳-rader). */
  innrykk?: (k: TimerTabellKolKey, data: R) => boolean;
  /**
   * w5 (bilde 7): klikk på linja (ikke på knapper, felt eller lenker i den). Utelatt →
   * linja er ikke klikkbar.
   */
  onLinjeKlikk?: (data: R) => void;
  /** Linja som har registreringen åpen (markeres). */
  erAapen?: (data: R) => boolean;
  /** Standardbredde pr. kolonne når kalleren vil ha andre enn den delte lista (px). */
  standardBredder?: Partial<Record<TimerTabellKolKey, number>>;
  /**
   * Kompakt hode (smale kolonner, w5): vanlige bokstaver i stedet for versaler, og overskriften
   * brytes over inntil to linjer ved mellomrom eller myk bindestrek i stedet for å kuttes.
   */
  hodeBrytes?: boolean;
  /** Kortere overskrift pr. kolonne i hodet; full tittel vises ved hover. */
  hodeTekst?: (k: TimerTabellKolKey) => string | undefined;
}

/** Klikk på disse i en linje er cellens egne og åpner ikke registreringen. */
const INTERAKTIV = "button,input,select,textarea,a,label,[role=button],[data-avvik-merke]";

const UNDERLINJE_HOYDE = 30;

function minBredde(k: TimerTabellKolKey, egne?: Partial<Record<TimerTabellKolKey, number>>): number {
  return egne?.[k] ?? TIMER_TABELL_KOL_BREDDE[k].min;
}

function standardBredde(k: TimerTabellKolKey, egne?: Partial<Record<TimerTabellKolKey, number>>): string {
  const b = TIMER_TABELL_KOL_BREDDE[k];
  const min = minBredde(k, egne);
  return b.vekt === 0 ? `${min}px` : `minmax(${min}px, ${b.vekt}fr)`;
}

function sammenlign(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "nb", { numeric: true });
}

export function TimerRadTabell<R>(props: Props<R>) {
  const { kolonner, onRekkefolgeEndring } = props;
  if (!onRekkefolgeEndring) return <Tabell {...props} />;
  return (
    <FlyttbareKolonner
      kolonneIder={[...kolonner]}
      rekkefolge={[...kolonner]}
      onRekkefolgeEndring={(ny) => onRekkefolgeEndring(ny as TimerTabellKolKey[])}
    >
      <Tabell {...props} />
    </FlyttbareKolonner>
  );
}

function Tabell<R>({
  kolonner,
  rader,
  celle,
  celleTittel,
  bredder = {},
  onBreddeEndring,
  onRekkefolgeEndring,
  sorterVerdi,
  filter,
  sortering,
  onSortering,
  venstre,
  hoyre,
  linjeKlasse,
  rammeKlasse = "max-h-[70vh]",
  innrykk,
  onLinjeKlikk,
  erAapen,
  standardBredder,
  hodeBrytes = false,
  hodeTekst,
}: Props<R>) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const hodeRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Sortering gjelder besøket (R7) — aldri lagret.
  const [egenSort, setEgenSort] = useState<TimerRadTabellSortering | null>(null);
  const sort = onSortering ? (sortering ?? null) : egenSort;
  const setSort = (ny: TimerRadTabellSortering | null) => (onSortering ? onSortering(ny) : setEgenSort(ny));
  // Bredde under dragning (vises straks, lagres ved slipp).
  const [liveBredder, setLiveBredder] = useState<Record<string, number>>({});
  const breddeAlle = useMemo(() => ({ ...bredder, ...liveBredder }), [bredder, liveBredder]);

  const dragning = useBreddeDragning({
    startBredde: useCallback((id: string) => hodeRef.current[id]?.offsetWidth, []),
    onLive: (id, b) => setLiveBredder((f) => ({ ...f, [id]: b })),
    onSlutt: (id) => {
      setLiveBredder((f) => {
        const b = f[id];
        if (b !== undefined && onBreddeEndring) onBreddeEndring({ ...bredder, [id]: b });
        const { [id]: _fjernet, ...rest } = f;
        return rest;
      });
    },
  });

  const synlige = useMemo(() => {
    if (!sort || !sorterVerdi) return rader;
    const linjer = rader.filter((r): r is Extract<TimerRadTabellRad<R>, { kind: "linje" }> => r.kind === "linje");
    const faktor = sort.retning === "asc" ? 1 : -1;
    return [...linjer].sort((a, b) => {
      const va = sorterVerdi(sort.k, a.data);
      const vb = sorterVerdi(sort.k, b.data);
      // Tomme verdier står alltid sist, uansett retning.
      if (va === null || vb === null) return sammenlign(va, vb);
      return faktor * sammenlign(va, vb);
    });
  }, [rader, sort, sorterVerdi]);

  // Linjenummer for vekslende bakgrunn (R25): tell bare linjer.
  const linjeIndeks = useMemo(() => {
    const m = new Map<string, number>();
    let i = 0;
    for (const r of synlige) if (r.kind === "linje") m.set(r.nokkel, i++);
    return m;
  }, [synlige]);

  // Synlig bredde (panelet under en linje står i den, uansett sidelengs rulling).
  const [synligBredde, setSynligBredde] = useState<number | null>(null);
  useEffect(() => {
    const el = parentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(() => setSynligBredde(el.clientWidth));
    obs.observe(el);
    setSynligBredde(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const midtKolonner = kolonner.map((k) => (breddeAlle[k] ? `${breddeAlle[k]}px` : standardBredde(k, standardBredder)));
  const gridTemplate = [
    ...(venstre ? [`${venstre.bredde}px`] : []),
    ...midtKolonner,
    ...(hoyre ? [`${hoyre.bredde}px`] : []),
  ].join(" ");
  const totalBredde =
    (venstre?.bredde ?? 0) +
    (hoyre?.bredde ?? 0) +
    kolonner.reduce((s, k) => s + (breddeAlle[k] ?? minBredde(k, standardBredder)), 0);
  const forskyvning = venstre ? 1 : 0;

  const virtualizer = useVirtualizer({
    count: synlige.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const r = synlige[i];
      return r?.kind === "linje" ? 4 + UNDERLINJE_HOYDE * r.underlinjer : 34;
    },
    overscan: 12,
  });

  // Sortert tabell er en flat liste (WM82): da vises også kolonnene en blokk-linje skjuler.
  const sortert = !!(sort && sorterVerdi);

  function klikkSorter(k: TimerTabellKolKey) {
    if (!sorterVerdi) return;
    setSort(sort?.k !== k ? { k, retning: "asc" } : sort.retning === "asc" ? { k, retning: "desc" } : null);
  }

  // Kompakt (w5): smalere sidemarg i cellene, så kjernen får plass på 1 440.
  const celleX = hodeBrytes ? "px-1.5" : "px-2";
  const fastVenstre: CSSProperties = { position: "sticky", left: 0, zIndex: 2 };
  const fastHoyre: CSSProperties = { position: "sticky", right: 0, zIndex: 2 };

  return (
    <div ref={parentRef} className={`${rammeKlasse} overflow-auto rounded-lg border border-gray-200 bg-white`}>
      {/* Hodet — fast øverst (R5) */}
      <div
        className={`sticky top-0 z-10 grid border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 ${
          hodeBrytes ? "" : "uppercase tracking-wide"
        }`}
        style={{ gridTemplateColumns: gridTemplate, minWidth: totalBredde }}
      >
        {venstre && (
          <div className="flex items-center bg-gray-50 px-2 py-2" style={fastVenstre}>
            {venstre.hode}
          </div>
        )}
        {kolonner.map((k) => (
          <Hodecelle
            key={k}
            k={k}
            overskrift={t(`timer.eksport.${TIMER_TABELL_KOL[k].i18n}`)}
            kort={hodeTekst?.(k)}
            num={TIMER_TABELL_KOL[k].num}
            flyttbar={!!onRekkefolgeEndring}
            sortRetning={sort?.k === k ? sort.retning : null}
            onSorter={sorterVerdi ? () => klikkSorter(k) : undefined}
            filter={filter}
            hodeRef={(el) => { hodeRef.current[k] = el; }}
            brytes={hodeBrytes}
            bredde={onBreddeEndring ? { aktiv: dragning.aktivId === k, start: (e) => dragning.start(e, k) } : undefined}
          />
        ))}
        {hoyre && (
          <div className="flex items-center justify-end bg-gray-50 px-2 py-2" style={fastHoyre}>
            {hoyre.hode}
          </div>
        )}
      </div>

      {/* Virtualisert kropp */}
      <div style={{ height: virtualizer.getTotalSize(), minWidth: totalBredde, position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const rad = synlige[vi.index];
          if (!rad) return null;
          const plass: CSSProperties = {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vi.start}px)`,
          };
          // w5b: luft etter en dagsblokk. Rada pakkes i en ytre div med bunnmarg, så målingen
          // tar luften med. Rader uten blokk tegnes nøyaktig som før (timerapporten).
          // Sortert tabell er en flat liste uten blokker (WM82).
          const blokk = sortert || rad.kind === "overskrift" ? undefined : rad.blokk;
          const luft = !!blokk?.slutt;
          const maal = { "data-index": vi.index, ref: virtualizer.measureElement };
          const p = luft ? {} : maal;
          const st: CSSProperties = luft ? {} : plass;
          const pakk = (el: ReactElement) =>
            luft ? (
              <div key={vi.key} {...maal} style={plass} className="pb-3" data-blokk-slutt="">
                {el}
              </div>
            ) : el;
          const bunn = luft ? "border-b border-gray-300" : "border-b border-gray-200";
          const kantV = blokk ? `border-l-4 ${blokk.kant}` : "";
          const kantH = blokk ? "border-r border-gray-300" : "";

          if (rad.kind === "overskrift") {
            return (
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={plass}
                className="flex items-center border-b border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                {rad.innhold}
              </div>
            );
          }

          if (rad.kind === "panel") {
            return pakk(
              <div key={vi.key} {...p} style={st} className={`${bunn} bg-blue-50/40 ${kantV} ${kantH}`}>
                <div style={{ position: "sticky", left: 0, width: synligBredde ?? "100%" }}>{rad.innhold}</div>
              </div>,
            );
          }

          if (rad.kind === "sum") {
            const v = rad.variant;
            const bg = v === "dag" ? "bg-blue-50" : v === "jobb" ? "bg-white" : rad.sterk ? "bg-gray-50" : "bg-gray-100";
            const utseende =
              v === "dag" ? "border-t-2 border-blue-700 bg-blue-50 font-semibold text-gray-900" :
              v === "jobb" ? "border-t border-gray-300 bg-white font-semibold text-gray-800" :
              rad.sterk ? "border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900" :
              "border-t border-gray-200 bg-gray-50/60 font-medium text-gray-700";
            return pakk(
              <div
                key={vi.key}
                {...p}
                data-rad={v}
                className={`grid text-sm ${utseende} ${bunn}`}
                style={{ ...st, gridTemplateColumns: gridTemplate }}
              >
                {venstre && <div className={`px-2 py-1.5 ${bg} ${kantV}`} style={fastVenstre}>{rad.venstre}</div>}
                {kolonner.map((k) => (
                  <div
                    key={k}
                    className={`min-w-0 truncate ${celleX} py-1.5 ${TIMER_TABELL_KOL[k].num ? "text-right tabular-nums" : "text-left"}`}
                  >
                    {rad.celle(k)}
                  </div>
                ))}
                {hoyre && <div className={`flex items-center justify-end px-2 py-1 ${bg} ${kantH}`} style={fastHoyre}>{rad.hoyre}</div>}
              </div>,
            );
          }

          // Linje: én eller flere tekstlinjer (H14), skille bare mellom linjer (R25).
          const d = rad.data;
          const n = Math.max(1, rad.underlinjer);
          const odde = (linjeIndeks.get(rad.nokkel) ?? 0) % 2 === 1;
          // w5b: inne i en blokk veksler ikke linjene mellom hvit og grå.
          const bg = !blokk && odde ? "bg-gray-50" : "bg-white";
          const aapen = erAapen?.(d) ?? false;
          const ekstra = `${linjeKlasse?.(d) ?? ""} ${onLinjeKlikk ? "cursor-pointer hover:bg-blue-50/60" : ""} ${aapen ? "!bg-blue-50" : ""}`;
          const skjult = (k: TimerTabellKolKey) => !sortert && (rad.skjul?.includes(k) ?? false);
          return pakk(
            <div
              key={vi.key}
              {...p}
              data-linje={rad.nokkel}
              data-aapen={aapen ? "" : undefined}
              onClick={onLinjeKlikk ? (e) => {
                if ((e.target as HTMLElement).closest(INTERAKTIV)) return;
                onLinjeKlikk(d);
              } : undefined}
              className={`grid ${bunn} text-sm text-gray-800 ${bg} ${ekstra}`}
              style={{ ...st, gridTemplateColumns: gridTemplate, gridTemplateRows: `repeat(${n}, auto)` }}
            >
              {venstre && (
                <div
                  className={`flex items-start border-l-4 ${blokk?.kant ?? "border-blue-300"} px-2 py-1.5 ${bg}`}
                  style={{ ...fastVenstre, gridColumn: 1, gridRow: `1 / span ${n}` }}
                >
                  {venstre.celle(d)}
                </div>
              )}
              {Array.from({ length: n }, (_, under) =>
                kolonner.map((k, ki) => {
                  const num = TIMER_TABELL_KOL[k].num;
                  const nøsting = innrykk?.(k, d) ?? false;
                  const tom = skjult(k);
                  return (
                    <div
                      key={`${under}-${k}`}
                      className={`min-w-0 ${celleX} py-1.5 ${num ? "text-right tabular-nums" : "text-left"} ${
                        k === "beskrivelse" ? "whitespace-pre-wrap break-words" : "truncate"
                      } ${nøsting ? "pl-5 text-gray-500" : ""}`}
                      style={{ gridColumn: ki + 1 + forskyvning, gridRow: under + 1 }}
                      title={tom ? undefined : celleTittel?.(k, d, under)}
                    >
                      {tom ? null : celle(k, d, under)}
                    </div>
                  );
                }),
              )}
              {hoyre && (
                <div
                  className={`flex items-start justify-end px-2 py-1 ${bg} ${kantH}`}
                  style={{ ...fastHoyre, gridColumn: kolonner.length + 1 + forskyvning, gridRow: `1 / span ${n}` }}
                >
                  {hoyre.celle(d)}
                </div>
              )}
            </div>,
          );
        })}
      </div>
    </div>
  );
}

function Hodecelle({
  k,
  overskrift,
  num,
  flyttbar,
  sortRetning,
  onSorter,
  filter,
  hodeRef,
  bredde,
  brytes,
  kort,
}: {
  k: TimerTabellKolKey;
  overskrift: string;
  kort?: string;
  num: boolean;
  brytes?: boolean;
  flyttbar: boolean;
  sortRetning: SorterRetning | null;
  onSorter?: () => void;
  filter?: TimerRadTabellFilter;
  hodeRef: (el: HTMLDivElement | null) => void;
  bredde?: { aktiv: boolean; start: (e: ReactMouseEvent) => void };
}) {
  const { t } = useTranslation();
  const alternativer = filter?.alternativer(k);
  const sok = filter?.sok?.(k);
  const innhold = (
    <>
      <span className={`inline-flex min-w-0 items-center gap-1 ${num ? "justify-end" : ""}`}>
        <span className={brytes ? "line-clamp-2 leading-tight [overflow-wrap:normal]" : "truncate"} title={overskrift}>
          {kort ?? overskrift}
        </span>
        {sortRetning && <SorterPil retning={sortRetning} />}
      </span>
      {filter && (alternativer || sok) && (
        <KolonneFilter
          alternativer={alternativer ?? []}
          verdi={filter.verdier[k] ?? ""}
          onChange={(v) => filter.onEndring(k, v)}
          tekster={{ filtrer: t("handling.filtrer"), alle: t("filter.alle"), sok: t("handling.sok") }}
          sok={sok}
        />
      )}
      {bredde && <BreddeHandtak aktiv={bredde.aktiv} onMouseDown={bredde.start} />}
    </>
  );
  const klasse = `group relative flex items-center ${brytes ? "pl-1.5 pr-1" : "px-2"} py-2 ${num ? "justify-end text-right" : "text-left"} ${
    onSorter ? "cursor-pointer select-none hover:text-gray-700" : ""
  }`;
  if (flyttbar) {
    return (
      <FlyttbarHodecelle k={k} overskrift={overskrift} klasse={klasse} hodeRef={hodeRef} onClick={onSorter}>
        {innhold}
      </FlyttbarHodecelle>
    );
  }
  return (
    <div ref={hodeRef} className={klasse} onClick={onSorter} data-kolonne={k}>
      {innhold}
    </div>
  );
}

function FlyttbarHodecelle({
  k,
  overskrift,
  klasse,
  hodeRef,
  onClick,
  children,
}: {
  k: TimerTabellKolKey;
  overskrift: string;
  klasse: string;
  hodeRef: (el: HTMLDivElement | null) => void;
  onClick?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { setNodeRef, flyttStil, handtak } = useFlyttbarKolonne(k, t("kolonne.flytt", { navn: overskrift }));
  return (
    <div
      ref={(el) => { hodeRef(el); setNodeRef(el); }}
      className={`${klasse} pl-4`}
      style={flyttStil}
      onClick={onClick}
      data-kolonne={k}
    >
      {handtak}
      {children}
    </div>
  );
}
