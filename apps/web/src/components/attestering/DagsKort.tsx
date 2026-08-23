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

/* ------------------------------------------------------------------ */
/*  Katalog-navn — org-scopet oppslag (ett kall, delt via query-cache) */
/* ------------------------------------------------------------------ */

export type KatalogNavn = {
  lonnsartNavn: (id: string) => string;
  aktivitetNavn: (id: string) => string;
  maskinNavn: (id: string) => string;
};

/** Henter lønnsart-/aktivitet-/maskin-katalogene for det VISTE firmaet og gir
 *  navn-resolvere. Samme org-scope-krav som SeddelKort (uten organizationId
 *  avleder serveren feil firma for en cross-org admin). */
export function useKatalogNavn(orgId: string | undefined): KatalogNavn {
  const { t } = useTranslation();
  const enabled = !!orgId;
  const input = { organizationId: orgId ?? "" };
  const { data: lonnsarter } = trpc.timer.lonnsart.list.useQuery(input, { enabled });
  const { data: aktiviteter } = trpc.timer.aktivitet.list.useQuery(input, { enabled });
  const { data: equipmentRaw } = trpc.maskin.equipment.list.useQuery(input, { enabled });
  const equipment = equipmentRaw as unknown as
    | Array<{ id: string; merke: string; modell: string; internNavn: string | null }>
    | undefined;

  const ukjent = t("timer.attestering.dagskort.ukjent");
  return {
    lonnsartNavn: (id) => lonnsarter?.find((l) => l.id === id)?.navn ?? ukjent,
    aktivitetNavn: (id) => aktiviteter?.find((a) => a.id === id)?.navn ?? ukjent,
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
    seddel.maskiner.length > 0
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
  const [apen, setApen] = useState(false);
  const [pinnet, setPinnet] = useState(false);
  const [koord, setKoord] = useState<{ top: number; left: number } | null>(null);

  const oppdaterKoord = useCallback(() => {
    const r = ankerRef.current?.getBoundingClientRect();
    if (!r) return;
    // Under ankeret, høyrekant på linje med cellen; klemmes mot venstre kant.
    const bredde = 320; // w-80
    const left = Math.max(8, Math.min(r.right - bredde, window.innerWidth - bredde - 8));
    setKoord({ top: r.bottom + 4, left });
  }, []);

  const vis = (apen || pinnet) && !!kort;

  useLayoutEffect(() => {
    if (vis) oppdaterKoord();
  }, [vis, oppdaterKoord]);

  if (!kort) return <>{children}</>;

  return (
    <span
      ref={ankerRef}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setApen(true)}
      onMouseLeave={() => setApen(false)}
    >
      {children}
      <button
        type="button"
        onClick={() => setPinnet((p) => !p)}
        aria-label={t("timer.attestering.dagskort.visDetaljer")}
        aria-expanded={vis}
        className="shrink-0 rounded p-0.5 text-gray-300 hover:text-blue-600"
      >
        <Info className="h-3 w-3" />
      </button>
      {vis &&
        koord &&
        createPortal(
          <div
            style={{ position: "fixed", top: koord.top, left: koord.left, zIndex: 50 }}
            onMouseEnter={() => setApen(true)}
            onMouseLeave={() => setApen(false)}
          >
            {kort}
          </div>,
          document.body,
        )}
    </span>
  );
}
