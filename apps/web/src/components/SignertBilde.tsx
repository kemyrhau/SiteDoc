"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import {
  SIGNERT_BILDE_MAKS_FORSOK,
  erUtloptSignatur,
  lagInvalideringsDebounce,
} from "@sitedoc/shared";

/**
 * SignertBilde — viser en server-signert `/uploads/`-fil (S1 Fase 1b, del G1+G2).
 *
 * 🔴 INGEN signeringslogikk her. `url` er den RÅ `fileUrl`-en fra en tRPC-query —
 * ALLEREDE signert ved emisjon av output-middleware på serveren (signaturen rir i
 * URL-en). Komponenten legger bare `/api`-proxy-prefikset på og håndterer
 * selvfornyelse. Å legge signering i klienten er feil lag (ordre § UFRAVIKELIG).
 *
 * Selvfornyelse (G2): feiler bildet fordi HMAC-signaturen er UTLØPT, invalideres
 * tRPC-queriene DEBOUNCET (femti utløpte bilder = én invalidering), så serveren
 * re-emitterer ferske signaturer gjennom veien som ALT er autorisert. Vi bygger
 * IKKE en `fil.signer({ sti })`-prosedyre — den måtte autorisert stien, ellers er
 * den et kryssfirma-orakel. Maks ETT gjenforsøk pr. bilde; feiler det igjen, eller
 * er feilen en 404 (slettet fil, gyldig signatur), vises en tydelig tilstand —
 * aldri en løkke mot 401.
 */

const planleggInvalidering = lagInvalideringsDebounce();

/**
 * Bygg den faktiske `<img src>`-verdien fra en `fileUrl`. `/uploads/`-stier går via
 * `/api`-proxyen (next.config: `/api/uploads/:path*` → api-serverens `/uploads/`);
 * eksterne/inline-URL-er og alt `/api`-prefiksede sendes uendret.
 */
export function byggBildeSrc(url: string): string {
  if (/^https?:\/\//.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  if (url.startsWith("/api/")) return url;
  return `/api${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * Reduser til den RÅ `/uploads/`-stien for fornyelses-vurderingen. Kallere kan sende
 * enten den rå `fileUrl` (`/uploads/…?exp=…`) eller en alt `/api`-prefikset variant
 * (`/api/uploads/…?exp=…`); `erUtloptSignatur` forventer `/uploads/`-formen, så vi
 * stripper et ledende `/api` her. Uten dette ville en `/api`-prefikset URL aldri
 * regnes som «utløpt» → ingen selvfornyelse.
 */
function raaForFornyelse(url: string): string {
  return url.startsWith("/api/") ? url.slice(4) : url;
}

export type SignertBildeProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Rå `fileUrl` (`/uploads/...`, signert ved emisjon) eller ekstern URL. */
  url: string | null | undefined;
  /** Vises når `url` mangler eller bildet endelig feiler (etter ett gjenforsøk). */
  fallback?: ReactNode;
};

export const SignertBilde = forwardRef<HTMLImageElement, SignertBildeProps>(
  function SignertBilde({ url, fallback = null, onError, alt = "", ...rest }, ref) {
    const utils = trpc.useUtils();
    const forsokRef = useRef(0);
    const [feilet, setFeilet] = useState(false);

    // Ny `url` (typisk en fersk signatur fra en refetch) = nytt forsøk fra bunnen.
    useEffect(() => {
      forsokRef.current = 0;
      setFeilet(false);
    }, [url]);

    if (!url || feilet) return <>{fallback}</>;

    return (
      <img
        ref={ref}
        src={byggBildeSrc(url)}
        alt={alt}
        onError={(e) => {
          onError?.(e);
          // Taket nådd, eller feilen er IKKE en utløpt signatur (404/ekte feil):
          // vis tydelig tilstand, ingen fornyelse — ellers evig løkke / selvpåført DoS.
          if (forsokRef.current >= SIGNERT_BILDE_MAKS_FORSOK || !erUtloptSignatur(raaForFornyelse(url))) {
            setFeilet(true);
            return;
          }
          forsokRef.current += 1;
          planleggInvalidering(() => {
            void utils.invalidate();
          });
        }}
        {...rest}
      />
    );
  },
);
