// Fornyelse av en rå/utløpt bilde-URL i annoteringen (oppfølger RETUR svart gjenåpning, Kontrollør
// 2026-10-28): «maks 3 forsøk» skal være 3 faktiske forsøk. Før ble ny henting bare utløst når
// URI-en endret seg; ga første refetch ingen ny URL, ble det aldri et forsøk nr. 2 — bare fristen.
//
// Her: invalider NÅ, deretter hvert `intervallMs` til `maks` forsøk er gjort; ett intervall etter
// siste forsøk gis det opp (`onGiOpp` → synlig feil). `stopp()` når bildet er lastet.
export interface Fornyer {
  start(): void;
  stopp(): void;
  aktiv(): boolean;
}

export const FORNY_MAKS = 3;
export const FORNY_INTERVALL_MS = 2_500;

export function lagFornyer(p: {
  invalider: () => void;
  onGiOpp: () => void;
  maks?: number;
  intervallMs?: number;
}): Fornyer {
  const maks = p.maks ?? FORNY_MAKS;
  const intervall = p.intervallMs ?? FORNY_INTERVALL_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let forsok = 0;
  let erAktiv = false;
  const steg = () => {
    if (forsok >= maks) {
      erAktiv = false;
      timer = null;
      p.onGiOpp();
      return;
    }
    forsok += 1;
    p.invalider();
    timer = setTimeout(steg, intervall);
  };
  return {
    start() {
      if (erAktiv) return;
      erAktiv = true;
      forsok = 0;
      steg();
    },
    stopp() {
      if (timer) clearTimeout(timer);
      timer = null;
      erAktiv = false;
    },
    aktiv: () => erAktiv,
  };
}
