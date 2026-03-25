/**
 * Hook for å bruke persistent 3D WebView i en skjerm.
 * Måler en placeholder-View og posisjonerer WebView over den.
 * Deaktiverer automatisk ved unmount.
 */

import { useRef, useCallback, useEffect } from "react";
import type { View } from "react-native";
import { useWebView3D } from "../kontekst/WebView3DKontekst";

export function usePersistent3D() {
  const api = useWebView3D();
  const plassholder = useRef<View>(null);
  const erAktivertRef = useRef(false);

  /** Kall dette i onLayout på placeholder-View for å posisjonere WebView */
  const målOgAktiver = useCallback(() => {
    plassholder.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        api.aktiver({ top: y, left: x, width, height });
        erAktivertRef.current = true;
      }
    });
  }, [api]);

  // Deaktiver ved unmount
  useEffect(() => {
    return () => {
      if (erAktivertRef.current) {
        api.deaktiver();
        erAktivertRef.current = false;
      }
    };
  }, [api]);

  return {
    /** Ref å sette på placeholder-View */
    plassholder,
    /** Kall i onLayout på placeholder */
    målOgAktiver,
    /** Alle WebView3D API-metoder */
    ...api,
  };
}
