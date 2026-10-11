/**
 * Konverteringsmarkør (2026-10-11): `{ kodeversjon, konvertertTid, motor }` som api
 * lagrer under `markor` i `drawings.konvertering_rapport` (ved siden av DWG-
 * fullstendighetsrapporten). BEVISER hvilken kode/motor som sist konverterte tegningen.
 *
 * Flyttet til @sitedoc/shared (RETUR 2, 2026-10-12): både web-viseren og mobil-viseren
 * må kjenne motoren for å avgjøre om en tegning skal vises som ezdxf (behold stil) eller
 * egen (strip + inject). Web-UI-helperne (`formaterKonvertertTid`, `kortKodeversjon`)
 * bor fortsatt i web-laget.
 *
 * Rent lesende + defensivt: feltet er `Json?` og kan være null, en ren
 * fullstendighetsrapport uten `markor` (eldre tegning), eller ukjent form.
 */
export interface KonverteringMarkor {
  kodeversjon: string;
  konvertertTid: string;
  /** Motoren som FAKTISK tegnet (egen/ezdxf/pdf) — ikke env-valget. */
  motor: string;
  /** Motoren som ble valgt men feilet (kun ved fallback). Avslører at DWG_MOTOR=ezdxf
   * i praksis ga en egen-tegning — så en som verifiserer på test ikke tror ezdxf kjørte. */
  fallbackFra?: string;
  /** Kort årsak til fallbacken. */
  fallbackAarsak?: string;
}

/** Hent markøren fra `konverteringRapport`, eller null om den mangler/har feil form. */
export function lesKonverteringMarkor(rapport: unknown): KonverteringMarkor | null {
  if (!rapport || typeof rapport !== "object") return null;
  const markor = (rapport as { markor?: unknown }).markor;
  if (!markor || typeof markor !== "object") return null;
  const { kodeversjon, konvertertTid, motor, fallbackFra, fallbackAarsak } = markor as Record<string, unknown>;
  if (
    typeof kodeversjon !== "string" ||
    typeof konvertertTid !== "string" ||
    typeof motor !== "string"
  ) {
    return null;
  }
  const resultat: KonverteringMarkor = { kodeversjon, konvertertTid, motor };
  if (typeof fallbackFra === "string") resultat.fallbackFra = fallbackFra;
  if (typeof fallbackAarsak === "string") resultat.fallbackAarsak = fallbackAarsak;
  return resultat;
}
