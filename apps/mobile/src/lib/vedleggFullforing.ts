// Rekkefølgen når et opplastet vedlegg får sin server-URL (OpplastingsKoProvider, sjekkliste/oppgave).
//
// 🔴 Oppfølger RETUR svart gjenåpning (Kontrollør 2026-10-28): `publiserFullfort` gjorde skjemaet RÅTT
// (`/uploads/…` uten signatur) FØR `patchVedleggUrl` hadde skrevet stien i serverens JSON. Åpnet
// brukeren annoteringen i det vinduet, kunne refetchen svare før serveren hadde stien → ingen signert
// URL å fornye til. Nå publiseres det først ETTER at server-patchen er ferdig (lyktes eller ikke) —
// til da viser skjemaet fortsatt lokalfila, som ikke slettes før URL-en er persistert et sted.
export interface VedleggFullforingSteg {
  /** Har vi et dokument å patche på serveren? (tom id → bare SQLite) */
  harDokument: boolean;
  /** SQLite-feltdata (samme-install-kilde). Sann når raden ble oppdatert. */
  oppdaterSqlite: () => boolean;
  /** Server-JSON (reinstall-sikker). Best-effort: sann ved suksess. */
  patchServer: () => Promise<boolean>;
  /** Live-oppdatering til monterte skjema-hooks. */
  publiser: () => void;
  slettLokal: () => Promise<void>;
  /** Kalles når verken SQLite eller server fikk URL-en — lokalfila beholdes. */
  beholdLokal: () => void;
}

export async function fullforVedleggUrl(s: VedleggFullforingSteg): Promise<{ sqliteOk: boolean; serverOk: boolean }> {
  const sqliteOk = s.oppdaterSqlite();
  let serverOk = false;
  if (s.harDokument) {
    try {
      serverOk = await s.patchServer();
    } catch {
      serverOk = false;
    }
  }
  // ETTER patchen: nå har serveren stien, så en refetch kan signere den rå URL-en skjemaet får.
  s.publiser();
  // 🔴 Slett aldri lokalfila før erstatningen er persistert et sted som overlever behovet.
  if (sqliteOk || serverOk) await s.slettLokal();
  else s.beholdLokal();
  return { sqliteOk, serverOk };
}
