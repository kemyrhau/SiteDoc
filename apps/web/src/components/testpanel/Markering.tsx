"use client";
/* eslint-disable i18next/no-literal-string -- utviklerverktøy som aldri bygges inn i prod (ordre 2026-11-27 pkt 5) */

import { useEffect, useState } from "react";
import type { Markering as MarkeringData } from "./schema";
import { øversteVindu } from "./Vert";

/**
 * Markerer elementet agenten skal klikke neste gang (RETUR 2, Kenneth 2026-11-27:
 * «fint om knappen som agenten skal trykke neste gang markeres før trykk»).
 * Tegner et eget overlegg (`position: fixed`, `pointer-events: none`) over elementets
 * rektangel — siden under test endres ikke, verken stil eller klikk.
 */

const OPPDATER_MS = 250;
const KANDIDATER =
  'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], label, input[type="submit"], input[type="button"]';

function synligTekst(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Finner elementet. Panelet og overlegget selv hoppes over; skjulte elementer hoppes over. */
export function finnMarkert(m: MarkeringData, rot: ParentNode = document): Element | null {
  const utenfor = (el: Element) =>
    !el.closest('[data-testid="testpanel"], [hidden], [aria-hidden="true"]');
  // Åpent SiteDoc-vindu: alt bak er inert og kan ikke klikkes — treff inni vinduet går først.
  const vindu = øversteVindu(rot);
  const iVinduFørst = (liste: Element[]) =>
    vindu ? [...liste.filter((el) => vindu.contains(el)), ...liste.filter((el) => !vindu.contains(el))] : liste;
  if ("selektor" in m) {
    try {
      return iVinduFørst(Array.from(rot.querySelectorAll(m.selektor))).find(utenfor) ?? null;
    } catch {
      return null; // ugyldig selektor
    }
  }
  const mål = m.tekst.replace(/\s+/g, " ").trim();
  return (
    iVinduFørst(Array.from(rot.querySelectorAll(KANDIDATER))).find(
      (el) =>
        utenfor(el) &&
        (synligTekst(el) === mål ||
          el.getAttribute("aria-label")?.trim() === mål ||
          (el instanceof HTMLInputElement && el.value.trim() === mål)),
    ) ?? null
  );
}

interface Rekt {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Markering({ markering }: { markering: MarkeringData | null }) {
  const nøkkel = markering ? JSON.stringify(markering) : null;
  const [rekt, setRekt] = useState<Rekt | null>(null);
  const [funnet, setFunnet] = useState(true);

  useEffect(() => {
    if (!markering) {
      setRekt(null);
      setFunnet(true);
      return;
    }
    let første = true;
    const oppdater = () => {
      const el = finnMarkert(markering);
      setFunnet(!!el);
      if (!el) {
        setRekt(null);
        return;
      }
      if (første) {
        første = false;
        (el as HTMLElement).scrollIntoView?.({ block: "center", behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      setRekt({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    oppdater();
    const id = window.setInterval(oppdater, OPPDATER_MS);
    return () => window.clearInterval(id);
    // nøkkel dekker innholdet i markering; objektet selv er nytt for hver polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nøkkel]);

  if (!markering) return null;
  if (!funnet) {
    const navn = "tekst" in markering ? markering.tekst : markering.selektor;
    return (
      <div
        data-testid="testpanel-markering-mangler"
        className="fixed right-3 top-3 z-[9999] rounded bg-red-600 px-2 py-1 text-sm text-white shadow"
      >
        Fant ikke «{navn}»
      </div>
    );
  }
  if (!rekt) return null;
  const luft = 4;
  return (
    <>
      <style>{"@keyframes testpanel-puls{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.7)}50%{box-shadow:0 0 0 8px rgba(245,158,11,0)}}"}</style>
      <div
        data-testid="testpanel-markering"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: rekt.top - luft,
          left: rekt.left - luft,
          width: rekt.width + luft * 2,
          height: rekt.height + luft * 2,
          border: "3px solid #f59e0b",
          borderRadius: 6,
          pointerEvents: "none",
          zIndex: 9998,
          animation: "testpanel-puls 1s ease-in-out 3",
        }}
      />
    </>
  );
}
