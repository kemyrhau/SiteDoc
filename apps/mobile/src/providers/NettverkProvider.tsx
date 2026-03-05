import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import NetInfo from "@react-native-community/netinfo";
import type { NetInfoStateType } from "@react-native-community/netinfo";

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

export function NettverkProvider({ children }: { children: ReactNode }) {
  const [erPaaNettet, setErPaaNettet] = useState(true);
  const [tilkoblingstype, setTilkoblingstype] =
    useState<NetInfoStateType | null>(null);

  useEffect(() => {
    const avmeld = NetInfo.addEventListener((state) => {
      const tilkoblet = state.isConnected ?? true;
      console.log("[NETT] Nettverkstilstand:", tilkoblet ? "ONLINE" : "OFFLINE", "type:", state.type);
      setErPaaNettet(tilkoblet);
      setTilkoblingstype(state.type);
    });

    return () => avmeld();
  }, []);

  return (
    <NettverkContext.Provider value={{ erPaaNettet, tilkoblingstype }}>
      {children}
    </NettverkContext.Provider>
  );
}
