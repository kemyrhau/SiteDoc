"use client";

// Delte deler for attesteringens ukeoversikt (ordre d2b-2/d2b-3): katalognavnene (lønnsart,
// aktivitet, maskin, tillegg) for det viste firmaet, og HoverKort — trigger + kort via hover
// eller utvidelsesikon. Selve dagskortet er `DagKort` i Ukeoversikt.tsx (leser tabellens
// modell, T35). Pivotene, SeddelKort og det gamle DagsKort er slettet i d2b-3.

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
import { merkeModell } from "./utstyr-navn";

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
    | Array<{ id: string; merke: string | null; modell: string | null; internNavn: string | null }>
    | undefined;

  const ukjent = t("timer.attestering.dagskort.ukjent");
  return {
    lonnsartNavn: (id) => lonnsarter?.find((l) => l.id === id)?.navn ?? ukjent,
    aktivitetNavn: (id) => aktiviteter?.find((a) => a.id === id)?.navn ?? ukjent,
    tilleggNavn: (id) => tilleggKatalog?.find((x) => x.id === id)?.navn ?? ukjent,
    maskinNavn: (id) => {
      const e = equipment?.find((x) => x.id === id);
      if (!e) return ukjent;
      const base = merkeModell(e);
      return base || e.internNavn || ukjent;
    },
  };
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
