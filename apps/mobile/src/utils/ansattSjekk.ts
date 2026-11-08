import { Alert } from "react-native";
import type { TFunction } from "i18next";
import { hentLagretAnsattStatus } from "../kontekst/FirmaKontekst";

/**
 * Ikke ansatt i valgt firma → serveren ville nektet sedelen; si fra før noe
 * åpnes. Fersk kontekst først, ellers sist lagrede svar. Ukjent (null) slipper
 * gjennom som før. Delt av «+» i begge timer-modusene (ORDRE 17 / 36c).
 */
export async function sjekkAnsattForNyRegistrering(p: {
  erAnsattIValgtFirma: boolean | null | undefined;
  orgId: string | null;
  firmaNavn: string;
  t: TFunction;
}): Promise<boolean> {
  const erAnsatt =
    p.erAnsattIValgtFirma ?? (p.orgId ? await hentLagretAnsattStatus(p.orgId) : null);
  if (erAnsatt === false) {
    Alert.alert(p.t("timer.kildeManglet.tittel"), p.t("timer.ikkeAnsatt", { firma: p.firmaNavn }));
    return false;
  }
  return true;
}
