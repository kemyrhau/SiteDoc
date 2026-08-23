"use client";

// Dagskort — komprimert lese-visning av én dagsseddel, vist som hover (desktop)
// eller via utvidelsesikon (touch) på pivotenes seddel-celler. Ren lesing, ingen
// handling: klikk på tallet går fortsatt til sedel-detaljen.
//
// Vokabular portert fra mobilens MaskinRadVis (apps/mobile/src/components/
// timer-detalj/MaskinSeksjon.tsx) + kombinert rad-liste (apps/mobile/app/timer/
// [id].tsx): slate «MASKIN»-merke, maskin nøstet under sin timerrad. Web bygger
// nøstingen eksplisitt via sheetTimerId (mobil har to sekvensielle lister).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { PivotRad, PivotMaskinRad } from "./AttesteringPivot";
import type { TimerRad, MaskinRad, TilleggRad } from "./attestering-buckets";

const nbTall = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* ------------------------------------------------------------------ */
/*  Mapper: rå sedel (hentTilAttesteringFirma) → PivotRad             */
/*  Delt kilde for pivotene (page.tsx) OG Sedler-lista (SeddelKort),   */
/*  så mappingen ikke drifter mellom flatene (SAMARBEIDSREGLER-        */
/*  advarselen om cast-lekkasje). Decimal-felt (`unknown`) → Number.   */
/* ------------------------------------------------------------------ */

export type RaaUtlegg = {
  belop: unknown;
  kommentar: string | null;
  expenseCategory: { navn: string } | null;
};

/** Strukturelt minimum dagskortet trenger. ukenorm/overtidsgrunnlag/prosjekt
 *  brukes ikke av kortet (kun av pivotenes norm-kolonne) → valgfrie her, så
 *  SeddelKortData (uten dem) også kan mappes. */
export type RaaSedel = {
  id: string;
  dato: Date | string;
  totaltimer: number;
  ukenorm?: number;
  overtidsgrunnlag?: PivotRad["overtidsgrunnlag"];
  ansatt: { id: string; name: string | null; email: string } | null;
  prosjekt?: PivotRad["prosjekt"];
  timer: TimerRad[];
  maskiner: MaskinRad[];
  tillegg: TilleggRad[];
  utlegg: RaaUtlegg[];
  manglerMaskinforerbevis: boolean;
};

const tallEllerNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export function tilPivotRad(r: RaaSedel): PivotRad {
  return {
    id: r.id,
    dato: r.dato,
    totaltimer: r.totaltimer,
    ukenorm: r.ukenorm ?? 0,
    overtidsgrunnlag: r.overtidsgrunnlag ?? null,
    ansatt: r.ansatt
      ? { id: r.ansatt.id, name: r.ansatt.name, email: r.ansatt.email }
      : null,
    prosjekt: r.prosjekt ?? null,
    timer: r.timer.map((rad) => ({
      id: rad.id,
      projectId: rad.projectId,
      timer: Number(rad.timer),
      aktivitetId: rad.aktivitetId,
      lonnsartId: rad.lonnsartId,
      beskrivelse: rad.beskrivelse,
    })),
    maskiner: r.maskiner.map((m) => ({
      vehicleId: m.vehicleId,
      sheetTimerId: m.sheetTimerId,
      timer: Number(m.timer),
      mengde: tallEllerNull(m.mengde),
      enhet: m.enhet,
    })),
    tillegg: r.tillegg.map((tl) => ({
      tilleggId: tl.tilleggId,
      antall: Number(tl.antall),
      kommentar: tl.kommentar,
    })),
    utlegg: r.utlegg.map((u) => ({
      kategoriNavn: u.expenseCategory?.navn ?? null,
      belop: tallEllerNull(u.belop),
      kommentar: u.kommentar,
    })),
    manglerMaskinforerbevis: r.manglerMaskinforerbevis,
  };
}

/* ------------------------------------------------------------------ */
/*  Katalog-navn — org-scopet oppslag (ett kall, delt via query-cache) */
/* ------------------------------------------------------------------ */

export type KatalogNavn = {
  lonnsartNavn: (id: string) => string;
  aktivitetNavn: (id: string) => string;
  maskinNavn: (id: string) => string;
  tilleggNavn: (id: string) => string;
};

/** Henter lønnsart-/aktivitet-/maskin-/tillegg-katalogene for det VISTE firmaet
 *  og gir navn-resolvere. Samme org-scope-krav som SeddelKort (uten
 *  organizationId avleder serveren feil firma for en cross-org admin).
 *  Utlegg trenger ingen katalog — kategorinavnet følger med i sedel-payloaden. */
export function useKatalogNavn(orgId: string | undefined): KatalogNavn {
  const { t } = useTranslation();
  const enabled = !!orgId;
  const input = { organizationId: orgId ?? "" };
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery(input, { enabled });
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery(input, { enabled });
  const { data: tilleggKatalog } = trpc.timer.tillegg.list.useQuery(input, { enabled });
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery(input, { enabled });
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string; modell: string; internNavn: string | null }>
    | undefined;

  const ukjent = t("timer.attestering.dagskort.ukjent");
  return {
    lonnsartNavn: (id) => lonnsarter?.find((l) => l.id === id)?.navn ?? ukjent,
    aktivitetNavn: (id) => aktiviteter?.find((a) => a.id === id)?.navn ?? ukjent,
    tilleggNavn: (id) => tilleggKatalog?.find((x) => x.id === id)?.navn ?? ukjent,
    maskinNavn: (id) => {
      const e = equipment?.find((x) => x.id === id);
      if (!e) return ukjent;
      const base = `${e.merke} ${e.modell}`.trim();
      return base || e.internNavn || ukjent;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Kort-verdig? — ingen beskrivelse OG ingen maskin → intet kort       */
/* ------------------------------------------------------------------ */

export function harKortInnhold(seddel: PivotRad): boolean {
  return (
    seddel.timer.some((tr) => (tr.beskrivelse ?? "").trim() !== "") ||
    seddel.maskiner.length > 0 ||
    seddel.tillegg.length > 0 ||
    seddel.utlegg.length > 0
  );
}

/* ------------------------------------------------------------------ */
/*  Maskin-linje (slate MASKIN-merke portert fra mobil)                 */
/* ------------------------------------------------------------------ */

function MaskinLinje({
  rad,
  maskinNavn,
}: {
  rad: PivotMaskinRad;
  maskinNavn: (id: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
        {t("timer.maskinSeksjon.merke")}
      </span>
      <span className="min-w-0 flex-1 text-xs text-gray-700">
        {maskinNavn(rad.vehicleId)}
        {rad.mengde !== null && (
          <span className="ml-2 text-gray-500">
            {rad.mengde.toFixed(2)} {rad.enhet ?? ""}
          </span>
        )}
      </span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-gray-700">
        {rad.timer.toFixed(2)} {t("timer.timerEnhet")}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Selve kortet (ren lesing)                                          */
/* ------------------------------------------------------------------ */

export function DagsKort({
  seddel,
  katalog,
}: {
  seddel: PivotRad;
  katalog: KatalogNavn;
}) {
  const { t } = useTranslation();

  // Nøst maskin under sin timerrad via sheetTimerId. Maskin uten (gyldig)
  // sheetTimerId samles nederst — vis ærlig, ikke skjul.
  const timerIder = new Set(seddel.timer.map((tr) => tr.id));
  const maskinPerTimer = new Map<string, PivotMaskinRad[]>();
  const maskinUtenTimerrad: PivotMaskinRad[] = [];
  for (const m of seddel.maskiner) {
    if (m.sheetTimerId && timerIder.has(m.sheetTimerId)) {
      const arr = maskinPerTimer.get(m.sheetTimerId) ?? [];
      arr.push(m);
      maskinPerTimer.set(m.sheetTimerId, arr);
    } else {
      maskinUtenTimerrad.push(m);
    }
  }

  return (
    <div className="w-80 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg">
      {/* T.11 — én linje per kort, nær maskinbolken (over radene). Egenskap ved
          PERSONEN, ikke raden → aldri per maskinrad. */}
      {seddel.manglerMaskinforerbevis && seddel.maskiner.length > 0 && (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
          {t("timer.attestering.dagskort.manglerBevis")}
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {seddel.timer.map((tr) => (
          <li key={tr.id} className="py-1.5">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-xs font-medium text-gray-900">
                {katalog.aktivitetNavn(tr.aktivitetId)}
                <span className="font-normal text-gray-500">
                  {" · "}
                  {katalog.lonnsartNavn(tr.lonnsartId)}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-gray-900">
                {tr.timer.toFixed(2)} {t("timer.timerEnhet")}
              </span>
            </div>
            {/* Beskrivelsen er hele poenget — aldri trunkert. */}
            {(tr.beskrivelse ?? "").trim() !== "" && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-gray-600">
                {tr.beskrivelse}
              </p>
            )}
            {/* Maskin nøstet under sin timerrad, innrykket. */}
            {(maskinPerTimer.get(tr.id) ?? []).length > 0 && (
              <div className="mt-1 border-l-2 border-slate-100 pl-3">
                {maskinPerTimer.get(tr.id)!.map((m, i) => (
                  <MaskinLinje key={i} rad={m} maskinNavn={katalog.maskinNavn} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {maskinUtenTimerrad.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-1">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {t("timer.attestering.dagskort.maskinUtenTimerad")}
          </p>
          {maskinUtenTimerrad.map((m, i) => (
            <MaskinLinje key={i} rad={m} maskinNavn={katalog.maskinNavn} />
          ))}
        </div>
      )}

      {/* Tillegg registrert samme dag: navn + antall. */}
      {seddel.tillegg.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-1">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {t("timer.tillegg")}
          </p>
          {seddel.tillegg.map((tl, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="min-w-0 flex-1 text-xs text-gray-700">
                {katalog.tilleggNavn(tl.tilleggId)}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-gray-700">
                {nbTall.format(tl.antall)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Utlegg registrert samme dag: kategori + beløp (kr). Vedlegg ses i
          detaljen (private/signeringskrevende — bevisst ute av liste-payloaden). */}
      {seddel.utlegg.length > 0 && (
        <div className="mt-1 border-t border-gray-100 pt-1">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            {t("timer.utlegg")}
          </p>
          {seddel.utlegg.map((u, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="min-w-0 flex-1 text-xs text-gray-700">
                {u.kategoriNavn ?? t("timer.attestering.dagskort.ukjent")}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-gray-700">
                {u.belop === null
                  ? "—"
                  : t("timer.attestering.dagskort.kr", { belop: nbTall.format(u.belop) })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  HoverKort — trigger (tall) + kort via hover ELLER utvidelsesikon    */
/*  Portal + fixed-posisjon: unngår klipping i pivotens overflow-x-auto */
/* ------------------------------------------------------------------ */

export function HoverKort({
  children,
  kort,
}: {
  /** Trigger-innholdet (tall-knappen som går til detalj ved klikk). */
  children: ReactNode;
  /** Kort-noden. Utelates når cellen ikke er kort-verdig. */
  kort: ReactNode | null;
}) {
  const { t } = useTranslation();
  const ankerRef = useRef<HTMLSpanElement | null>(null);
  const kortRef = useRef<HTMLDivElement | null>(null);
  const lukkeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafId = useRef<number | null>(null);
  const [apen, setApen] = useState(false);
  const [pinnet, setPinnet] = useState(false);
  const [koord, setKoord] = useState<{ top: number; left: number } | null>(null);

  const vis = (apen || pinnet) && !!kort;

  // Posisjonering: horisontal klemming mot viewport + VERTIKAL VENDING oppover
  // når kortet ikke får plass under ankeret (siste rad i tabellen). Bruker
  // kortets målte høyde (etter mount) for vend-beslutningen.
  const posisjoner = useCallback(() => {
    const a = ankerRef.current?.getBoundingClientRect();
    if (!a) return;
    const bredde = 320; // w-80
    const gap = 4;
    const left = Math.max(8, Math.min(a.right - bredde, window.innerWidth - bredde - 8));
    const hoyde = kortRef.current?.offsetHeight ?? 0;
    const plassUnder = window.innerHeight - a.bottom;
    const vendOpp = hoyde > 0 && plassUnder < hoyde + gap && a.top > plassUnder;
    const top = vendOpp
      ? Math.max(8, a.top - hoyde - gap)
      : a.bottom + gap;
    setKoord({ top, left });
  }, []);

  // Posisjoner etter mount (kortet er målbart) — useLayoutEffect => før paint,
  // så vendingen ikke flimrer.
  useLayoutEffect(() => {
    if (vis) posisjoner();
  }, [vis, posisjoner]);

  // Følg ankeret ved scroll/resize (rAF-throttlet) — ellers blir et fixed-
  // posisjonert kort stående mens raden scroller vekk. Reposisjonering fremfor
  // lukking: pin er touch-veien og piloten er mobil-tung, der scroll er konstant.
  useEffect(() => {
    if (!vis) return;
    const oppdater = () => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        posisjoner();
      });
    };
    window.addEventListener("scroll", oppdater, true); // capture → fanger indre scroll-container
    window.addEventListener("resize", oppdater);
    return () => {
      window.removeEventListener("scroll", oppdater, true);
      window.removeEventListener("resize", oppdater);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [vis, posisjoner]);

  // Pinnet kort: Escape + klikk-utenfor lukker. Flere kort kan pinnes samtidig;
  // uten dette blir de liggende. Kun aktivt når pinnet (ingen globale lyttere ellers).
  useEffect(() => {
    if (!pinnet) return;
    const paTast = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinnet(false);
    };
    const paKlikk = (e: MouseEvent) => {
      const mal = e.target as Node;
      if (ankerRef.current?.contains(mal) || kortRef.current?.contains(mal)) return;
      setPinnet(false);
    };
    document.addEventListener("keydown", paTast);
    document.addEventListener("mousedown", paKlikk);
    return () => {
      document.removeEventListener("keydown", paTast);
      document.removeEventListener("mousedown", paKlikk);
    };
  }, [pinnet]);

  // Rydd lukke-timer ved unmount.
  useEffect(() => {
    return () => {
      if (lukkeTimer.current) clearTimeout(lukkeTimer.current);
    };
  }, []);

  const aapneHover = useCallback(() => {
    if (lukkeTimer.current) clearTimeout(lukkeTimer.current);
    setApen(true);
  }, []);
  // Kort lukke-forsinkelse: bygger bro over gapet mellom anker og kort, så
  // onMouseLeave ikke lukker portalen før musen når kortet (hover-dødsone).
  const planleggLukk = useCallback(() => {
    if (lukkeTimer.current) clearTimeout(lukkeTimer.current);
    lukkeTimer.current = setTimeout(() => setApen(false), 120);
  }, []);

  if (!kort) return <>{children}</>;

  return (
    <span
      ref={ankerRef}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={aapneHover}
      onMouseLeave={planleggLukk}
    >
      {children}
      <button
        type="button"
        onClick={(e) => {
          // Stopp bobling: i SeddelKort ligger ikonet inni en klikkbar header
          // (toggle expand) — pin-klikket skal ikke også utløse den.
          e.stopPropagation();
          setPinnet((p) => !p);
        }}
        aria-label={t("timer.attestering.dagskort.visDetaljer")}
        aria-expanded={vis}
        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-blue-600"
      >
        <Info className="h-3 w-3" />
      </button>
      {vis &&
        createPortal(
          <div
            ref={kortRef}
            style={{
              position: "fixed",
              top: koord?.top ?? -9999,
              left: koord?.left ?? -9999,
              zIndex: 50,
            }}
            onMouseEnter={aapneHover}
            onMouseLeave={planleggLukk}
          >
            {kort}
          </div>,
          document.body,
        )}
    </span>
  );
}
