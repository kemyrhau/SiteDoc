"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import {
  SIGNERT_LENKE_MAKS_FORSOK,
  erUtloptSignatur,
  lagInvalideringsDebounce,
} from "@sitedoc/shared";

/**
 * SignertLenke — åpner en server-signert `/uploads/`-fil (nedlasting / ny fane / PDF-visning
 * med `#page=N`). Lenke-klassen av S1-selvfornyelsen (jf. SignertBilde for `<img>`).
 *
 * 🔴 INGEN signeringslogikk her, og INGEN `fil.signer({ sti })`-prosedyre (den måtte
 * autorisert stien → kryssfirma-orakel). `url` er den RÅ `fileUrl`-en fra en tRPC-query,
 * ALT signert ved emisjon. Komponenten legger bare `/api`-proxyen på og håndterer fornyelse.
 *
 * 🔴 MEKANISME — sjekk FØR navigering, ikke etter: en `<a href>`/`window.open` kan ikke fange
 * et 401 (nettleseren navigerer og får feilen; ingen `onError`). Derfor ved klikk:
 *   - GYLDIG signatur → åpne DIREKTE (ingen ekstra rundtur).
 *   - UTLØPT (eller rå, uten `?exp=`) → invalidér tRPC-queriene DEBOUNCET (samme vei
 *     SignertBilde bruker — serveren re-emitterer ferske signaturer gjennom en ALT autorisert
 *     vei), VENT på fersk `fileUrl`, åpne DEN. Maks ETT forsøk (aldri løkke mot 401).
 *
 * 🔴 IKKE `fetch→blob→a.download`: (1) `window.open(...#page=N)` brukes for PDF-visning — et
 * blob-URL bærer ikke sidefragmentet pålitelig; (2) punktsky-/E57-filer er titalls MB — en
 * blob holder hele fila i minnet på en mobilnettleser.
 *
 * Ny fane åpnes med et PLACEHOLDER-vindu synkront i klikk-gesten (unngår popup-blokkering);
 * når den ferske signaturen kommer, navigeres placeholderen dit.
 */

const planleggInvalidering = lagInvalideringsDebounce();

/** Bygg `<a href>`/åpne-verdien: `/api`-proxyprefiks på `/uploads/`-stier + fragment bakerst. */
export function byggLenkeHref(url: string, fragment?: string): string {
  const base =
    /^https?:\/\//.test(url) || url.startsWith("/api/")
      ? url
      : `/api${url.startsWith("/") ? url : `/${url}`}`;
  return fragment ? `${base}${fragment}` : base;
}

/** Reduser til den RÅ `/uploads/`-stien for fornyelses-vurderingen (strip et ledende `/api`). */
export function raaForLenkeFornyelse(url: string): string {
  return url.startsWith("/api/") ? url.slice(4) : url;
}

/** Den rene `/uploads/`-stien uten query — nøkkelen som matcher en utløpt url mot en fersk. */
function stiUtenQuery(url: string): string {
  const raa = raaForLenkeFornyelse(url);
  return raa.split("?")[0] ?? raa;
}

export type LenkeAapneOpts = {
  fragment?: string;
  nyFane?: boolean;
  download?: boolean | string;
};

type Ventende = LenkeAapneOpts & {
  sti: string;
  vindu: Window | null; // placeholder åpnet i gesten for ny-fane-tilfellet
};

/** Utfør selve åpningen av en FERSK (gyldig) url. */
function aapneFersk(url: string, opts: LenkeAapneOpts, placeholder: Window | null): void {
  const href = byggLenkeHref(url, opts.fragment);
  if (placeholder) {
    placeholder.location.href = href; // navigér det synkront åpnede vinduet
    return;
  }
  if (opts.nyFane) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
  if (opts.download) {
    const a = document.createElement("a");
    a.href = href;
    a.download = typeof opts.download === "string" ? opts.download : "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  window.location.href = href;
}

/**
 * Delt åpner (KJERNEN) — brukes av `SignertLenke` OG av de imperative `window.open`-stedene
 * (mappe-/treff-dobbeltklikk). `kildeUrls` er forelderens gjeldende `fileUrl`-liste; når en
 * fornyelse er utestående og en fersk (ikke-utløpt) url med samme sti dukker opp der, åpnes den.
 */
export function useSignertLenkeApner(kildeUrls: Array<string | null | undefined> = []) {
  const utils = trpc.useUtils();
  const ventendeRef = useRef<Ventende[]>([]);
  const forsokRef = useRef(0);

  // Flush: en fersk, gyldig url for en utestående sti → åpne den (fragment bevart).
  useEffect(() => {
    if (ventendeRef.current.length === 0) return;
    const fortsatt: Ventende[] = [];
    for (const v of ventendeRef.current) {
      const treff = kildeUrls.find(
        (u): u is string =>
          typeof u === "string" &&
          stiUtenQuery(u) === v.sti &&
          !erUtloptSignatur(raaForLenkeFornyelse(u)),
      );
      if (treff) aapneFersk(treff, v, v.vindu);
      else fortsatt.push(v);
    }
    ventendeRef.current = fortsatt;
  }, [kildeUrls]);

  return useCallback(
    (url: string | null | undefined, opts: LenkeAapneOpts = {}) => {
      if (!url) return;
      const raa = raaForLenkeFornyelse(url);
      // Gyldig → åpne direkte, synkront i klikk-gesten (ingen popup-blokk, ingen rundtur).
      if (!erUtloptSignatur(raa)) {
        aapneFersk(url, opts, null);
        return;
      }
      // Utløpt/rå, og taket nådd → åpne som den er (best-effort; server 401-er, men aldri løkke).
      if (forsokRef.current >= SIGNERT_LENKE_MAKS_FORSOK) {
        aapneFersk(url, opts, null);
        return;
      }
      forsokRef.current += 1;
      // Ny fane: åpne placeholder-vinduet NÅ (i gesten) så det ikke popup-blokkeres senere.
      const vindu = opts.nyFane ? window.open("", "_blank", "noopener,noreferrer") : null;
      const sti = stiUtenQuery(url);
      if (!ventendeRef.current.some((v) => v.sti === sti)) {
        ventendeRef.current.push({ ...opts, sti, vindu });
      }
      planleggInvalidering(() => {
        void utils.invalidate();
      });
    },
    [utils],
  );
}

export type SignertLenkeProps = {
  /** Rå `fileUrl` (`/uploads/...`, signert ved emisjon) eller `/api`-prefikset variant. */
  url: string | null | undefined;
  /** F.eks. `#page=5` — bevares gjennom en fornyelse. */
  fragment?: string;
  /** Åpne i ny fane (target=_blank / erstatter `window.open`). */
  nyFane?: boolean;
  /** `download`-attributt (boolean eller filnavn). */
  download?: boolean | string;
  className?: string;
  title?: string;
  children: ReactNode;
  /** Vises når `url` mangler. */
  fallback?: ReactNode;
};

/**
 * Anker-varianten. Renderer en ekte `<a href>` (for hover/kopier-lenke/tilgjengelighet), men
 * fanger klikket for å gjøre selvfornyelses-sjekken FØR navigering.
 */
export function SignertLenke({
  url,
  fragment,
  nyFane,
  download,
  className,
  title,
  children,
  fallback = null,
}: SignertLenkeProps) {
  const apne = useSignertLenkeApner(url ? [url] : []);

  const håndterKlikk = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (!url) return;
      // La nettleserens egne modifikatorer (ny fane via Ctrl/Cmd/midtklikk) styre selv når
      // signaturen er gyldig; ellers overtar vi for å kunne fornye før åpning.
      if ((e.metaKey || e.ctrlKey || e.button === 1) && !erUtloptSignatur(raaForLenkeFornyelse(url))) {
        return;
      }
      e.preventDefault();
      apne(url, { fragment, nyFane, download });
    },
    [apne, url, fragment, nyFane, download],
  );

  if (!url) return <>{fallback}</>;

  return (
    <a
      href={byggLenkeHref(url, fragment)}
      target={nyFane ? "_blank" : undefined}
      rel={nyFane ? "noopener noreferrer" : undefined}
      download={download}
      className={className}
      title={title}
      onClick={håndterKlikk}
    >
      {children}
    </a>
  );
}
