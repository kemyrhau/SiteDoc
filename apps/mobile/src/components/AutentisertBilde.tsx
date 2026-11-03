import { Image, type ImageProps } from "react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { hentSessionToken } from "../services/auth";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  byggBildeKilde,
  bildeRenderTilstand,
  erServerUpload,
  fornyelseLogg,
  fornyelsesStier,
  vurderBildeFornyelse,
  type BildeKilde,
  type FornyKilde,
} from "../lib/bildeKilde";
import { lagNokkelDebounce } from "@sitedoc/shared";

/**
 * Modul-nivå debounce, delt av ALLE AutentisertBilde-instanser. En skjerm full av
 * utløpte bilder koalescerer til ÉN invalidering pr. forsøksnivå — og den invaliderer
 * KUN stiene bildenes kilde gir (`fornyelsesStier`), aldri alle queries (Hjem-frys
 * 2026-10-29). Klienten settes av den sist monterte instansen (det finnes én).
 */
let queryKlient: QueryClient | null = null;
const fornyelse = lagNokkelDebounce((stier) => {
  if (__DEV__) console.warn(fornyelseLogg("bilde", stier));
  for (const sti of stier) {
    // tRPC v11-nøkkel er `[sti[], {input, type}]` — `[sti]` prefiks-matcher alle inputs.
    void queryKlient?.invalidateQueries({ queryKey: [[...sti]] });
  }
});

/**
 * AutentisertBilde — native <Image> som bærer Bearer-token når URI-en er en
 * server-/uploads/-fil. Mobilens motstykke til webs `SignertBilde`: der arver <img>
 * sesjonen via cookie, her må headeren legges eksplisitt på (den native bildelasteren
 * gjør ellers en naken GET). Se `lib/bildeKilde.ts` for regelen om HVILKE URI-er som
 * får headeren.
 *
 * Bruk: bytt `<Image source={{ uri }} … />` → `<AutentisertBilde uri={uri} … />`.
 * Alle øvrige <Image>-props (className/style/resizeMode/onError …) sendes uendret
 * videre.
 *
 * Token hentes fra SecureStore (async). For en server-URI venter vi med å montere
 * <Image> til token er hentet, slik at den ALLERSTE forespørselen bærer headeren —
 * ingen naken GET som 401-er før et gjenforsøk. Lokale/tredjeparts-URI-er trenger
 * ikke token og monteres umiddelbart (ingen venting, samme opplevelse som før).
 *
 * Selvfornyelse (krav 3b): feiler bildet fordi den signerte URL-en er UTLØPT (401),
 * invalideres kallstedets tRPC-queries (`fornyKilde` → `fornyelsesStier`) DEBOUNCET, så
 * kallstedets query refetcher og gir en fersk signert URI — samme mekanisme som webs `SignertBilde`, samme delte regel i
 * `@sitedoc/shared`. Maks TRE forsøk med backoff; en 404 (slettet fil, gyldig
 * signatur) gjenforsøkes ALDRI — ellers evig løkke / selvpåført DoS. Beslutningen bor
 * i `vurderBildeFornyelse`; her holdes kun tellingen, timerne og terminaltilstanden.
 *
 * Synlig sluttilstand: er alle forsøk brukt opp (eller feilen en 404), rendres
 * `fallback` — ikke `null`. 🔴 Fallbacken hører KUN til den terminale tilstanden, ALDRI
 * til token-lastingen: uten `fallback`-prop er oppførselen uendret (`null`), som før.
 * Se `bildeRenderTilstand` for laster-vs-terminal-skillet.
 */
export type AutentisertBildeProps = Omit<ImageProps, "source"> & {
  /** Full URI: server-/uploads/-URL (får Bearer) eller lokal `file://`/asset (uendret). */
  uri: string;
  /**
   * Vises når tilstanden er TERMINAL (alle forsøk brukt, eller 404). Utelates den,
   * rendres `null` som før — bakoverkompatibelt. Rendres ALDRI mens token hentes.
   */
  fallback?: ReactNode;
  /**
   * Hvilken query bildets signerte URL kommer fra — påkrevd, så fornyelsen aldri faller
   * tilbake til å invalidere alt. Se `fornyelsesStier`.
   */
  fornyKilde: FornyKilde;
};

export function AutentisertBilde({ uri, fallback, fornyKilde, onError, ...rest }: AutentisertBildeProps) {
  const queryClient = useQueryClient();
  // Monterte bilder holder fornyelsen i live. Forlates skjermen (siste avmonteres), ryddes
  // en ventende invalidering — den ville bare hentet andre skjermers data på nytt.
  useEffect(() => {
    queryKlient = queryClient;
    return fornyelse.abonner();
  }, [queryClient]);
  // Lokale/tredjeparts-URI-er kan monteres synkront; kun server-URI-er venter på token.
  const [kilde, setKilde] = useState<BildeKilde | null>(() =>
    erServerUpload(uri) ? null : { uri },
  );
  // Terminal feiltilstand: taket nådd eller feilen er ikke fornybar (404). Da vises
  // ingenting framfor en evig 401-løkke. Nullstilles når `uri` endrer seg (fersk signatur).
  const [feilet, setFeilet] = useState(false);
  const forsokRef = useRef(0);
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Ny `uri` (typisk en fersk signatur fra en refetch) = nytt forsøk fra bunnen.
    // Rydd også en ventende backoff-timer — den hørte til forrige uri.
    forsokRef.current = 0;
    setFeilet(false);

    if (!erServerUpload(uri)) {
      setKilde({ uri });
      return () => {
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
      };
    }
    let aktiv = true;
    setKilde(null);
    hentSessionToken()
      .then((token) => {
        if (aktiv) setKilde(byggBildeKilde(uri, token));
      })
      .catch((feil) => {
        // Feiler SecureStore-lesingen: monter bildet nakent (som før denne
        // branchen) i stedet for å la `kilde` stå null — da vises <Image> aldri,
        // uten feilmelding. Stille tomhet er forbudt (CLAUDE.md). Når /uploads/-
        // gaten kommer, gir den nakne GET-en en ekte 401, ikke en tom ramme.
        // console.warn (IKKE toast — ikke brukerens feil å handle på): uten den blir
        // «SecureStore feilet» og «lokalt bilde» samme kodevei og samme utfall, og
        // 401-en senere kommer uten spor av hvorfor.
        console.warn("[AutentisertBilde] token-henting feilet, viser bildet uten Bearer:", feil);
        if (aktiv) setKilde({ uri });
      });
    return () => {
      aktiv = false;
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
    };
  }, [uri]);

  const tilstand = bildeRenderTilstand(kilde !== null, feilet);
  if (tilstand === "terminal") return <>{fallback}</>;
  if (tilstand === "laster" || !kilde) return null;

  return (
    <Image
      source={kilde}
      onError={(e) => {
        onError?.(e);
        const beslutning = vurderBildeFornyelse(uri, forsokRef.current);
        if (beslutning.type === "gi-opp") {
          setFeilet(true);
          return;
        }
        forsokRef.current = beslutning.nyttForsok;
        // Debouncet invalidering: femti samtidige feil på samme forsøksnivå gir ÉN
        // refetch. Forsøk 1 umiddelbart (kun koalescering), forsøk 2/3 etter backoff
        // så ett dekningsdropp på dårlig 4G får tid til å løse seg. Kun kildens stier.
        const planlegg = () => fornyelse.planlegg(fornyelsesStier(fornyKilde));
        if (beslutning.ventMs === 0) {
          planlegg();
        } else {
          if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current);
          backoffTimerRef.current = setTimeout(planlegg, beslutning.ventMs);
        }
      }}
      {...rest}
    />
  );
}
