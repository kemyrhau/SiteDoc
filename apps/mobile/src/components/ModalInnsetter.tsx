import { createContext, useContext } from "react";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

/**
 * Rå safe-area-innsetter for innhold i en RN-`<Modal>` (ota-varsel RETUR 1).
 * `MedOtaLinje` setter `bottom: 0` i `SafeAreaInsetsContext` mens «Ny versjon er
 * klar»-linja vises; konteksten går gjennom `<Modal>`, men modalen dekker hele
 * skjermen — også linja. Modalinnhold leser derfor herfra og får full bunnmarg.
 * Utenfor `MedOtaLinje` (ingen kontekst) faller den tilbake til `useSafeAreaInsets()`.
 */
export const ModalInnsetterKontekst = createContext<EdgeInsets | null>(null);

export function useModalInnsetter(): EdgeInsets {
  const kontekst = useSafeAreaInsets();
  return useContext(ModalInnsetterKontekst) ?? kontekst;
}
