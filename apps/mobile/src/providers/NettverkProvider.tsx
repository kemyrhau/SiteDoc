import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { NetInfoState, NetInfoStateType } from "@react-native-community/netinfo";

interface NettverkKontekst {
  erPaaNettet: boolean;
  tilkoblingstype: NetInfoStateType | null;
}

const NettverkContext = createContext<NettverkKontekst>({
  erPaaNettet: true,
  tilkoblingstype: null,
});

export function useNettverk() {
  return useContext(NettverkContext);
}

// Selvheling (2026-09-18): hvor ofte vi re-prober NÅR vi tror vi er offline.
// Intervallet kjører KUN mens `erPaaNettet === false` og appen er aktiv — i
// normaltilstand (online) finnes ingen timer, så batterikosten er null. 20s er
// avveiningen: fanger en tapt «tilbake online»-hendelse innen rimelig tid uten
// å polle når alt allerede virker. Eksportert så testen kan holde seg i synk.
export const OFFLINE_REPROBE_MS = 20 * 1000;

export function NettverkProvider({ children }: { children: ReactNode }) {
  const [erPaaNettet, setErPaaNettet] = useState(true);
  const [tilkoblingstype, setTilkoblingstype] =
    useState<NetInfoStateType | null>(null);

  // Én kilde for NetInfo-tilstand → context-mapping. BÅDE `addEventListener` og
  // de selvhelende re-probene (refresh via AppState / offline-intervall) går
  // gjennom denne, så tolkningen finnes ett sted og kan ikke drifte fra hverandre.
  //
  // Kildevalg (målt mot NetInfo v11): vi gater på `isConnected` (finnes det et
  // nett i det hele tatt), IKKE `isInternetReachable`. isInternetReachable er en
  // separat reachability-probe (typisk mot Googles connectivity-endepunkt) som
  // på et anleggsnett kan være blokkert/treg selv når VÅRT API er nåbart — å
  // gate på den ville feilaktig fryse køen, akkurat feilklassen vi retter, bare
  // fra en annen vinkel. Om enheten faktisk når serveren avgjøres av
  // opplastingskøens klassifiserte retry/backoff, ikke her. `?? true` =
  // optimistisk når tilstanden er ukjent (null), som før.
  const anvendTilstand = useCallback((state: NetInfoState) => {
    const tilkoblet = state.isConnected ?? true;
    console.log(
      "[NETT] Nettverkstilstand:",
      tilkoblet ? "ONLINE" : "OFFLINE",
      "type:",
      state.type,
    );
    setErPaaNettet(tilkoblet);
    setTilkoblingstype(state.type);
  }, []);

  // 1) Løpende hendelser fra NetInfo. Denne alene var den gamle implementasjonen
  //    — den fyrer kun ved ENDRING, så en tapt «tilbake online»-hendelse låste
  //    `erPaaNettet=false` for godt. Effektene under gir selvhelingen.
  useEffect(() => {
    const avmeld = NetInfo.addEventListener(anvendTilstand);
    return () => avmeld();
  }, [anvendTilstand]);

  // 2) AppState → active: tving en fersk probe når appen kommer i forgrunn.
  //    Dette er det mest sannsynlige frys-scenariet: telefonen låses/ appen
  //    bakgrunnes MENS nettet skifter, «tilbake online»-hendelsen leveres aldri,
  //    og enheten er reelt online igjen når brukeren låser opp. `refresh()`
  //    tvinger et nytt oppslag; resultatet flyter tilbake både via listeneren
  //    over OG via løftet her (idempotent — samme setState).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (neste) => {
      if (neste === "active") {
        NetInfo.refresh()
          .then(anvendTilstand)
          .catch((f) => console.warn("[NETT] AppState-refresh feilet:", f));
      }
    });
    return () => sub.remove();
  }, [anvendTilstand]);

  // 3) Offline-sikkerhetsnett: mens vi TROR vi er offline (og appen er aktiv),
  //    re-prob periodisk. Dekker restklassen — coalesced/tapt hendelse mens
  //    appen står i forgrunn — som verken mount eller AppState fanger. Kjører
  //    aldri når vi er online: effekten returnerer straks `erPaaNettet` er true,
  //    så det er ingen polling i normaltilstand. Selvhelende: så snart en probe
  //    gir online, river re-renderen ned dette intervallet.
  useEffect(() => {
    if (erPaaNettet) return;
    const intervall = setInterval(() => {
      if (AppState.currentState !== "active") return;
      NetInfo.refresh()
        .then(anvendTilstand)
        .catch((f) => console.warn("[NETT] Offline-reprobe feilet:", f));
    }, OFFLINE_REPROBE_MS);
    return () => clearInterval(intervall);
  }, [erPaaNettet, anvendTilstand]);

  return (
    <NettverkContext.Provider value={{ erPaaNettet, tilkoblingstype }}>
      {children}
    </NettverkContext.Provider>
  );
}
