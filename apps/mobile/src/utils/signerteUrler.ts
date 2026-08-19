/**
 * Display-tid-resolusjon av signerte vedlegg-URL-er (mobil).
 *
 * Bakgrunn: private bilder (`/uploads/privat/…`) serveres signatur-KUN. Serveren
 * signerer URL-ene ved EMISJON (`sjekkliste/oppgave.hentMedId` → `signerVedleggIData`),
 * aldri i lagret data. Rett etter en opplasting bærer `feltVerdier` den RÅ URL-en
 * (fra opplastingssvaret) fram til neste refetch — den 401-er i visning (tom ramme).
 *
 * Vi kan IKKE skrive den signerte URL-en tilbake i `feltVerdier`: da persisteres en
 * URL med utløp til `Checklist.data` («forgiftet URL», se `vedleggSignering.ts`).
 * I stedet resolver vi RÅ private URL-er til den signerte serverversjonen KUN i
 * visningen, via `hentFeltVerdi`. `feltVerdier` (og dermed synk) forblir rå.
 */

/** Rå (usignert) privat URL — trenger signatur for å vises. */
function erRaaPrivatUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    url.startsWith("/uploads/privat/") &&
    !url.includes("sig=")
  );
}

/**
 * Samle `vedleggId → URL` fra server-emittert data (`sjekkliste.data`), som ER
 * signert. Går rekursivt (topp-nivå-vedlegg + repeater-nestede vedlegg).
 */
export function samleSignerteVedleggUrler(node: unknown, ut: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const n of node) samleSignerteVedleggUrler(n, ut);
    return;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (
      typeof o.id === "string" &&
      typeof o.url === "string" &&
      o.url.startsWith("/uploads/privat/")
    ) {
      ut.set(o.id, o.url);
    }
    for (const v of Object.values(o)) samleSignerteVedleggUrler(v, ut);
  }
}

/**
 * Returnér en kopi av `node` der hvert RÅ private `url`-felt på et vedlegg (matchet
 * på `id`) er byttet til den signerte serverversjonen. Immutabel: samme referanse
 * hvis ingenting endres (unngår unødvendige re-renders). Lokale `file://`-URL-er og
 * allerede signerte URL-er røres ikke.
 */
export function resolveSignerteUrler<T>(node: T, map: Map<string, string>): T {
  if (map.size === 0) return node;
  if (Array.isArray(node)) {
    let endret = false;
    const ny = node.map((n) => {
      const r = resolveSignerteUrler(n, map);
      if (r !== n) endret = true;
      return r;
    });
    return (endret ? ny : node) as T;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    let endret = false;
    const ny: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      const r = resolveSignerteUrler(v, map);
      if (r !== v) endret = true;
      ny[k] = r;
    }
    if (typeof o.id === "string" && erRaaPrivatUrl(ny.url) && map.has(o.id)) {
      ny.url = map.get(o.id);
      endret = true;
    }
    return (endret ? ny : node) as T;
  }
  return node;
}
