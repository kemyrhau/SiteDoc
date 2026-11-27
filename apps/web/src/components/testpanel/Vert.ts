"use client";

import { useEffect, useState } from "react";

/**
 * Flyttbar vert for testpanelet (retur 2026-11-27, Kenneth: «modalen deaktiverte testpanelet»).
 *
 * SiteDocs `Modal` åpner med native `dialog.showModal()`: nettleseren legger dialogen i top
 * layer og gjør ALT utenfor den inert — et klikk på panelet traff dialog-backdropen (målt i
 * Chromium). Også `popover` åpnet etter dialogen er inert. Det eneste som virker er å ligge
 * INNI dialogen. Panelet rendres derfor via portal inn i én fast vert, og verten flyttes inn i
 * det øverste åpne vinduet og tilbake til `body`. Verten flyttes, portalen byttes ikke, så
 * React-tilstanden (merknad, vurdering, tegning) står.
 */

/** Øverste åpne modal-vindu. Nestede vinduer ligger nestet i DOM, så siste treff er innerst. */
export function øversteVindu(rot: ParentNode = document, unntatt?: Element | null): HTMLDialogElement | null {
  let treff: HTMLDialogElement[];
  try {
    treff = Array.from(rot.querySelectorAll<HTMLDialogElement>("dialog:modal"));
  } catch {
    treff = [];
  }
  // jsdom (og eldre nettlesere) kjenner ikke `:modal` — fall tilbake til `dialog[open]`.
  if (treff.length === 0) treff = Array.from(rot.querySelectorAll<HTMLDialogElement>("dialog[open]"));
  const aktuelle = unntatt ? treff.filter((d) => !unntatt.contains(d)) : treff;
  return aktuelle[aktuelle.length - 1] ?? null;
}

export function useVert(): HTMLDivElement | null {
  const [vert, setVert] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-testpanel-vert", "");

    const plasser = () => {
      const mål: Element = øversteVindu(document, el) ?? document.body;
      if (el.parentNode !== mål) mål.appendChild(el);
    };

    // Esc i panelet skal ikke lukke SiteDoc-vinduet (nettleserens cancel). Tegn slås fortsatt
    // av, for den lytteren ligger på window og ser ikke på defaultPrevented.
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.closest("dialog")) e.preventDefault();
    };
    el.addEventListener("keydown", esc);

    plasser();
    const observatør = new MutationObserver(plasser);
    observatør.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    setVert(el);
    return () => {
      observatør.disconnect();
      el.removeEventListener("keydown", esc);
      el.remove();
    };
  }, []);

  return vert;
}
