/**
 * Display-tid-resolusjon av signerte vedlegg-URL-er (mobil).
 *
 * 🔴 Fase 1b (2026-09-24): gjelder HELE `/uploads/`, ikke bare `privat/`.
 * Serveren gater hele treet default-deny og signerer ALLE `/uploads/`-URL-er ved
 * EMISJON (query-middleware + `sjekkliste/oppgave.hentMedId` → `signerVedleggIData`),
 * aldri i lagret data. Rett etter en opplasting bærer `feltVerdier` den RÅ URL-en
 * (fra opplastingssvaret) fram til neste refetch — den 401-er i visning (tom ramme).
 *
 * Vi kan IKKE skrive den signerte URL-en tilbake i `feltVerdier`: da persisteres en
 * URL med utløp til `Checklist.data` («forgiftet URL», se `vedleggSignering.ts`).
 * I stedet resolver vi til den signerte serverversjonen KUN i visningen, via
 * `hentFeltVerdi`. `feltVerdier` (og dermed synk) forblir rå.
 *
 * 🔴 Herding 2026-09-30 (speiler web-fiksen 29.09, to akser):
 *  1. NØKKEL-AGNOSTISK: enhver `/uploads/`-streng leges, uansett hva nøkkelen heter.
 *     `originalUrl` (annoteringens original) dekkes fordi den ER en `/uploads/`-streng,
 *     ikke fordi den står i en liste. Ingen nøkkelnavn nevnes noe sted.
 *  2. UTLØPT ≠ RÅ: en signert URL med `exp` i fortid er like død som en usignert, og
 *     leges også — den var før stående (init-veien kunne persistere en signert URL med
 *     utløp til SQLite, «Funn C» i måling `maaling-mobil-lagrede-uploads-2026-09-30.md`).
 *     GYLDIG-signerte står urørt (idempotens — ellers bytter URL-en identitet ved hver
 *     visning og koalesceringen fra `4ef039fd` faller). Grensen er `erUtloptSignatur`,
 *     samme delte regel web bruker.
 *
 * Både innsamling og resolusjon nøkler på RÅ STI (`raaUploadsSti` stripper signatur-
 * queryen), så en rå og en utløpt-signert variant av samme fil finner den ferske.
 * `UPLOADS_PREFIKS`/`erUtloptSignatur`/`raaUploadsSti` deles med api-gaten via
 * @sitedoc/shared — ingen tredje kopi av «/uploads/»-regelen.
 */
import { UPLOADS_PREFIKS, erUtloptSignatur, raaUploadsSti } from "@sitedoc/shared";

/**
 * Samle `rå sti → fersk signert URL` fra server-emittert data (`sjekkliste.data`), som
 * ER signert. Nøkkel-agnostisk og rekursiv: enhver `/uploads/`-streng, uansett nøkkelnavn
 * eller nesting (topp-nivå + repeater-rader + annoteringens `originalUrl`), samles nøklet
 * på sin rå sti.
 */
export function samleSignerteVedleggUrler(node: unknown, ut: Map<string, string>): void {
  if (typeof node === "string") {
    if (node.startsWith(UPLOADS_PREFIKS)) ut.set(raaUploadsSti(node) as string, node);
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) samleSignerteVedleggUrler(n, ut);
    return;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) samleSignerteVedleggUrler(v, ut);
  }
}

/**
 * Returnér en kopi av `node` der hver RÅ eller UTLØPT-signert `/uploads/`-streng (på
 * ethvert nivå, uansett nøkkelnavn) er byttet til den ferske server-signerte versjonen,
 * matchet på rå sti. Immutabelt: samme referanse hvis ingenting endres (unngår
 * unødvendige re-renders). GYLDIG-signerte URL-er, lokale `file://`-URL-er og alt utenfor
 * `/uploads/` røres ikke.
 */
export function resolveSignerteUrler<T>(node: T, map: Map<string, string>, naa: number = Date.now()): T {
  if (map.size === 0) return node;
  if (typeof node === "string") {
    // erUtloptSignatur er sann for RÅ /uploads/ OG utløpt-signert, usann for gyldig-signert
    // og alt utenfor /uploads/ — nøyaktig «trenger fornyelse»-grensen.
    if (!erUtloptSignatur(node, naa)) return node;
    const fersk = map.get(raaUploadsSti(node) as string);
    return (fersk !== undefined ? fersk : node) as T;
  }
  if (Array.isArray(node)) {
    let endret = false;
    const ny = node.map((n) => {
      const r = resolveSignerteUrler(n, map, naa);
      if (r !== n) endret = true;
      return r;
    });
    return (endret ? ny : node) as T;
  }
  if (node && typeof node === "object") {
    let endret = false;
    const ny: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const r = resolveSignerteUrler(v, map, naa);
      if (r !== v) endret = true;
      ny[k] = r;
    }
    return (endret ? (ny as T) : node);
  }
  return node;
}
