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
