"use client";

import { useEffect } from "react";
import {
  useNavigasjon,
  type VerktoylinjeHandling,
} from "@/kontekst/navigasjon-kontekst";

export function useVerktoylinje(handlinger: VerktoylinjeHandling[]) {
  const { settVerktoylinjeHandlinger } = useNavigasjon();

  useEffect(() => {
    settVerktoylinjeHandlinger(handlinger);
    return () => {
      settVerktoylinjeHandlinger([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settVerktoylinjeHandlinger]);
}
