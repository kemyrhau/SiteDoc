import { useEffect, useState } from "react";
import { hentVerdi, lagreVerdi } from "../services/auth";

// Feature-flagg for navigasjonsredesignet (redesign/navigasjon) — mobil.
//
// Parallell til web-hooken (`apps/web/src/hooks/useNyNavigasjon.ts`) bak SAMME
// boolean-kontrakt. Kilden her er den plattform-aware `lagreVerdi/hentVerdi`
// (SecureStore på native, localStorage på web) — ingen ny AsyncStorage-pakke.
//
// Kontrakt:
// - Flagg AV = eksakt dagens mobil-UI. Ingen synlig endring før flagget er PÅ.
// - Flagget gater KUN synlig navigasjon (tab-struktur/Mer-innganger). Alle
//   gamle skjermer forblir nåbare via router.push uavhengig av flagget.
// - Toggles fra Mer-tab (kun sitedoc_admin) via `settNyNavigasjon`.
//
// Lagringen er async (SecureStore), så vi holder en modul-lokal cache +
// lytter-sett slik at `useNyNavigasjon()` gir en synkron boolean og alle
// forbrukere (tab-layout, Mer) oppdateres umiddelbart når flagget veksles.

const LAGRINGSNOKKEL = "sitedoc-ny-navigasjon";

let cachetVerdi = false;
let erLastet = false;
const lyttere = new Set<() => void>();

function varsleLyttere(): void {
  for (const lytter of lyttere) lytter();
}

async function lastInn(): Promise<void> {
  try {
    const lagret = await hentVerdi(LAGRINGSNOKKEL);
    cachetVerdi = lagret === "1";
  } catch {
    cachetVerdi = false;
  } finally {
    erLastet = true;
    varsleLyttere();
  }
}

/**
 * Eneste skrive-inngang. Oppdaterer cache + persisterer + varsler alle
 * forbrukere synkront (ingen reload trengs på native).
 */
export async function settNyNavigasjon(paa: boolean): Promise<void> {
  cachetVerdi = paa;
  erLastet = true;
  varsleLyttere();
  await lagreVerdi(LAGRINGSNOKKEL, paa ? "1" : "0");
}

export function useNyNavigasjon(): boolean {
  const [verdi, setVerdi] = useState(cachetVerdi);

  useEffect(() => {
    const oppdater = () => setVerdi(cachetVerdi);
    lyttere.add(oppdater);
    if (!erLastet) {
      void lastInn();
    } else {
      oppdater();
    }
    return () => {
      lyttere.delete(oppdater);
    };
  }, []);

  return verdi;
}
