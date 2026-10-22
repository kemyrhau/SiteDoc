/**
 * Funn C (bilder i raden): sett `url` på ett vedlegg (matchet på `id`) hvor enn
 * det ligger i et dokuments `data`-JSON — topp-nivå ELLER repeater-/attachments-
 * nestet. Muterer `node` in place (kalleren jobber på en dyp kopi). Returnerer
 * `true` hvis minst ett vedlegg ble truffet.
 *
 * Delt kilde for `sjekkliste.settVedleggUrl` og `oppgave.settVedleggUrl` — lå
 * tidligere som en modul-lokal kopi i `routes/sjekkliste.ts`. Formen er identisk
 * for `Checklist.data` og `Task.data` (samme feltobjekt-tre), så deteksjonen skal
 * ikke kopieres per router.
 */
export function settUrlPaaVedlegg(
  node: unknown,
  vedleggId: string,
  url: string,
  filnavn: string | undefined,
): boolean {
  if (Array.isArray(node)) {
    let endret = false;
    for (const n of node) {
      if (settUrlPaaVedlegg(n, vedleggId, url, filnavn)) endret = true;
    }
    return endret;
  }
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    let endret = false;
    if (o.id === vedleggId && typeof o.url === "string") {
      o.url = url;
      if (filnavn) o.filnavn = filnavn;
      endret = true;
    }
    for (const v of Object.values(o)) {
      if (settUrlPaaVedlegg(v, vedleggId, url, filnavn)) endret = true;
    }
    return endret;
  }
  return false;
}

/**
 * Finn filnavnet til vedlegget med `id === vedleggId` hvor enn det ligger i data-treet
 * (topp-nivå ELLER repeater-/attachments-nestet). `null` når vedlegget ikke finnes; `""`
 * når det finnes uten filnavn.
 *
 * Brukes av godkjent-låsen (Kenneth-vedtak 2026-10-21) i `settVedleggUrl` til å skille et
 * NYTT vedlegg (ikke funnet → forbudt å legge til på godkjent) og en ERSTATNING (endret
 * filnavn → annotering, forbudt) fra en ren URL-fullføring (samme filnavn → en legitim
 * opplasting fra før godkjenning som slippes gjennom).
 */
export function finnVedleggFilnavn(node: unknown, vedleggId: string): string | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = finnVedleggFilnavn(n, vedleggId);
      if (f !== null) return f;
    }
    return null;
  }
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (o.id === vedleggId) return typeof o.filnavn === "string" ? o.filnavn : "";
    for (const v of Object.values(o)) {
      const f = finnVedleggFilnavn(v, vedleggId);
      if (f !== null) return f;
    }
    return null;
  }
  return null;
}
