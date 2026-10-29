// Hva autolagringen skriver lokalt og sender til serveren (sjekkliste + oppgave, ORDRE 5 2026-10-29).
//
// `feltVerdier` kan bære SIGNERTE `/uploads/`-URL-er: init fyller dem fra den signerte
// `hentMedId`-responsen, og annoteringen lagret før en signert `originalUrl` fra visningskopien.
// Serveren avviser enhver `?exp=&sig=`-URL i data (BAD_REQUEST, `avvisForgiftetVedleggIData`), og
// klienten regner det som permanent — feltet nådde da aldri serveren (KD11). Her renses dataene med
// den delte skrive-vei-vaksinen `raaVedleggIData` (samme som web), så også rader som alt er forgiftet
// i SQLite leges ved neste lagring. Diffen mot basis normaliseres på begge sider, så en signert
// basis mot rå data ikke gjør et uendret felt «dirty».
import { raaVedleggIData, utelatFeltMedLokaleVedlegg } from "@sitedoc/shared";
import type { FeltVerdi } from "../hooks/useSjekklisteSkjema";

type Felt = Record<string, FeltVerdi>;

function norm(fv: FeltVerdi | undefined): string {
  return JSON.stringify(
    raaVedleggIData({ verdi: fv?.verdi ?? null, kommentar: fv?.kommentar ?? "", vedlegg: fv?.vedlegg ?? [] }),
  );
}

/**
 * `data`: alle felt, rensede — skrives til SQLite og avanserer basis.
 * `sendes`: bare felt som avviker fra basis, uten felt med lokale vedlegg (de skal aldri til serveren).
 */
export function lagreUtvalg(feltVerdier: Felt, basis: Felt): { data: Felt; sendes: Felt } {
  const data = raaVedleggIData(feltVerdier) as Felt;
  const dirty = Object.keys(data).filter((id) => norm(data[id]) !== norm(basis[id]));
  const sendes = utelatFeltMedLokaleVedlegg(Object.fromEntries(dirty.map((id) => [id, data[id]!]))) as Felt;
  return { data, sendes };
}
