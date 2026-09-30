import { Image, type ImageProps } from "react-native";
import { useEffect, useState } from "react";
import { hentSessionToken } from "../services/auth";
import { byggBildeKilde, erServerUpload, type BildeKilde } from "../lib/bildeKilde";

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
 */
export type AutentisertBildeProps = Omit<ImageProps, "source"> & {
  /** Full URI: server-/uploads/-URL (får Bearer) eller lokal `file://`/asset (uendret). */
  uri: string;
};

export function AutentisertBilde({ uri, ...rest }: AutentisertBildeProps) {
  // Lokale/tredjeparts-URI-er kan monteres synkront; kun server-URI-er venter på token.
  const [kilde, setKilde] = useState<BildeKilde | null>(() =>
    erServerUpload(uri) ? null : { uri },
  );

  useEffect(() => {
    if (!erServerUpload(uri)) {
      setKilde({ uri });
      return;
    }
    let aktiv = true;
    setKilde(null);
    hentSessionToken()
      .then((token) => {
        if (aktiv) setKilde(byggBildeKilde(uri, token));
      })
      .catch(() => {
        // Feiler SecureStore-lesingen: monter bildet nakent (som før denne
        // branchen) i stedet for å la `kilde` stå null — da vises <Image> aldri,
        // uten feilmelding. Stille tomhet er forbudt (CLAUDE.md). Når /uploads/-
        // gaten kommer, gir den nakne GET-en en ekte 401, ikke en tom ramme.
        if (aktiv) setKilde({ uri });
      });
    return () => {
      aktiv = false;
    };
  }, [uri]);

  if (!kilde) return null;
  return <Image source={kilde} {...rest} />;
}
