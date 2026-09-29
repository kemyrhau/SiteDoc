/**
 * Delte sti-prefikser for server-serverte opplastede filer (S1 Fase 1b).
 *
 * 🔴 ÉN kilde, delt av tre lag som ellers ville driftet fra hverandre:
 *  - api-gaten + emisjonssigneringen (`apps/api/src/utils/hmac.ts`)
 *  - mobil-resolveren (`apps/mobile/src/utils/signerteUrler.ts`)
 * `apps/api` er ikke importerbar fra mobil, så konstanten MÅTTE hit — ikke en
 * tredje kopi av strengen «/uploads/».
 */

/** Rot-prefiks for alle server-serverte opplastede filer. Hele treet er gatet. */
export const UPLOADS_PREFIKS = "/uploads/";

/** Sensitive filer (signatur-KUN, `Cache-Control: no-store`). Undertre av UPLOADS_PREFIKS. */
export const UPLOADS_PRIVAT_PREFIKS = "/uploads/privat/";

/**
 * Er dette en RÅ (usignert) `/uploads/`-URL som trenger emisjonssignatur for å
 * vises? Delt regel så api og mobil-resolveren aldri svarer ulikt. En URL som alt
 * bærer `sig=` er ferdig signert; `file://`/`http(s)`/`data:` er ikke /uploads/.
 */
export function erRaaUploadsUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(UPLOADS_PREFIKS) && !url.includes("sig=");
}

/**
 * Er dette en FORGIFTET `/uploads/`-URL — en som alt bærer en signatur (`sig=`)?
 * Det motsatte predikatet av `erRaaUploadsUrl`, bygget av SAMME konstant (ingen
 * femte kopi av «/uploads/»-regelen). En slik URL skal ALDRI skrives til lagret
 * `Checklist.data`/`Task.data`: signaturen har et innebygd utløp, så den dør i
 * databasen («forgiftet URL», se `apps/api/src/utils/vedleggSignering.ts`). Kun
 * en vakt på skrive-veien — visnings-veien tåler forgiftning via emisjons-
 * re-signeringen (hmac.ts). Ekstern `https://…/uploads/`/`file://` er ikke
 * `/uploads/` og rammes ikke.
 */
export function erForgiftetUploadsUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(UPLOADS_PREFIKS) && url.includes("sig=");
}

/**
 * Reduser en forgiftet (`sig=`-bærende) `/uploads/`-URL til den RÅ stien (dropp hele
 * query-strengen — for `/uploads/` er den kun `?exp=&sig=`). Motsatt av emisjons-
 * signeringen. Alt annet (rå `/uploads/`, ekstern, `data:`, `file://`) slipper uendret
 * gjennom. Brukes på SKRIVE-veien: web seeder `feltVerdier` fra den signerte queryen,
 * så en URL kan være signert i lokal state — den skal ALLTID strippes før persistering
 * (mobil holder `feltVerdier` rå med vilje; web stripper i stedet ved utsendelse).
 */
export function raaUploadsSti(url: unknown): unknown {
  if (!erForgiftetUploadsUrl(url)) return url;
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/**
 * Dyp kopi der hvert `url`-strengfelt (på ethvert nivå — repeater-nesting, attachments-
 * felt) er redusert til rå `/uploads/`-sti via `raaUploadsSti`. Speiler serverens
 * emisjons-signerings-rekursjon, motsatt vei. Muterer aldri input. Skrive-vei-vaksinen
 * som garanterer at ingen signert URL persisteres (serveren avviser dem ellers).
 */
export function raaVedleggIData(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(raaVedleggIData);
  if (node !== null && typeof node === "object") {
    const kopi: Record<string, unknown> = {};
    for (const [nokkel, verdi] of Object.entries(node as Record<string, unknown>)) {
      kopi[nokkel] =
        nokkel === "url" && typeof verdi === "string" ? raaUploadsSti(verdi) : raaVedleggIData(verdi);
    }
    return kopi;
  }
  return node;
}
