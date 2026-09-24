import { createHmac, timingSafeEqual } from "crypto";
import { posix } from "node:path";

/**
 * HMAC-signerte fil-URL-er (S1 autorisert filserving).
 *
 * 🔴 Fase 1b (2026-09-24): gaten dekker HELE `/uploads/` — default-deny. Alle
 * filer er signatur-KUN (ingen sesjons-fallback). API signerer stien ved emisjon
 * (etter authz i tRPC-laget) og legger `?exp=&sig=` på; `/uploads/`-hooken i
 * server.ts verifiserer signaturen uten ny DB-authz. Fase 1 gatet kun
 * `/uploads/privat/*` — resten ble servert rått (S1-hullet fra 2026-08-15).
 *
 * Signaturen dekker path-delen + utløps-tidspunkt (millis). Query-strengen med
 * signaturen selv er ikke en del av signert innhold — kun `path\nexp`.
 *
 * Prefiks-signering (for Potree-tiles i Fase 2) bygges på samme util senere via
 * en `prefiks`-variant; Fase 1 signerer eksakt path.
 */

// 🔴 Standard-levetid for fil-URL-er = 15 min (E, Kenneth-vedtak 2026-09-24).
// Kort nok til at en lekket URL dør raskt; poenget er å kreve autentisering ved
// UTSTEDELSE, ikke å gjøre lenker flyktige. Utløp er GJORT USYNLIG av G2: en
// `<img>`/`<Image>` som får 401 på en utløpt signatur trigger debouncet
// query-invalidering → re-emisjon gjennom den AUTORISERTE veien (aldri et
// generisk «signer denne stien»-orakel). Derfor 15 min for ALT, ikke differensiert.
const STANDARD_LEVETID_MS = 15 * 60 * 1000;

// Dev-fallback så lokal utvikling/test uten satt secret ikke bryter. I produksjon
// KREVES FIL_SIGNING_SECRET (kastes ved bruk) — flagget som deploy-forutsetning.
const DEV_FALLBACK_SECRET =
  "dev-usikret-fil-signering-sett-FIL_SIGNING_SECRET-i-prod";

function hentSecret(): string {
  const secret = process.env.FIL_SIGNING_SECRET;
  if (secret && secret.length > 0) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FIL_SIGNING_SECRET mangler — kreves i produksjon for signert filserving",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function beregnSignatur(path: string, exp: number): string {
  return createHmac("sha256", hentSecret())
    .update(`${path}\n${exp}`)
    .digest("base64url");
}

/**
 * Signer en `/uploads/...`-sti → returnerer stien med `?exp=&sig=` påhengt.
 * Eventuell eksisterende query strippes før signering (idempotent ved re-signering).
 */
export function signerFilSti(sti: string, levetidMs = STANDARD_LEVETID_MS): string {
  const path = sti.split("?")[0] ?? sti;
  const exp = Date.now() + levetidMs;
  const sig = beregnSignatur(path, exp);
  return `${path}?exp=${exp}&sig=${sig}`;
}

const UPLOADS_PREFIKS = "/uploads/";

/** Bærer URL-en alt en `sig=`-parameter? → alt signert (idempotens-vakt). */
function erAlleredeSignert(url: string): boolean {
  const q = url.indexOf("?");
  if (q === -1) return false;
  return new URLSearchParams(url.slice(q + 1)).has("sig");
}

/**
 * Signer en fil-URL hvis den peker inn i `/uploads/` (S1 Fase 1b: HELE treet,
 * ikke bare `/uploads/privat/`). Andre URL-er (tomme, eksterne, absolutte)
 * returneres uendret. Målrettet signering ved EMISJON — dette er den ENE
 * delegerings-funksjonen: de eksplisitte kallstedene OG den sentrale
 * output-middleware (`signerUploadsOutput`) går alle hit.
 *
 * 🔴 Idempotens (KRAV): bærer URL-en alt `sig=`, returneres den uendret. Uten
 * dette dobbeltsigneres alt som passerer to lag (eksplisitt kall + middleware),
 * og den ytre signaturen ville dekket en path som alt inneholdt en query.
 */
export function signerHvisPrivat(url: string | null | undefined): string | null | undefined {
  if (typeof url !== "string" || !url.startsWith(UPLOADS_PREFIKS)) return url;
  if (erAlleredeSignert(url)) return url; // idempotens: ikke dobbeltsigner
  try {
    return signerFilSti(url);
  } catch (err) {
    // Kontrollert degradering: en signeringsfeil (f.eks. manglende secret) skal
    // ALDRI kaste midt i et tRPC-svar og velte urelaterte prosedyrer i en batch.
    // Returnér usignert URL (fail-closed: `/uploads/`-gaten avviser den uten
    // gyldig signatur → 401, fila blir utilgjengelig, ikke lekket).
    // Oppstart-sjekken i server.ts fanger den egentlige årsaken i produksjon.
    console.error("[hmac] signering feilet — returnerer usignert URL:", err);
    return url;
  }
}

/**
 * Er signerings-secreten satt? Brukes av oppstart-sjekk (fail-fast i produksjon)
 * så en manglende deploy-forutsetning aldri viser seg som en tilfeldig
 * prosedyre-feil («dagsseddelen finnes ikke») midt i drift.
 */
export function harSigneringsSecret(): boolean {
  return Boolean(process.env.FIL_SIGNING_SECRET && process.env.FIL_SIGNING_SECRET.length > 0);
}

/**
 * Delt oppstart-guard (fail-fast) for BEGGE prosessene som signerer/verifiserer:
 * api (Fastify, server.ts) OG web (Next-instrumentation) — fordi tRPC-serveren
 * (som signerer) kjører i WEB-containeren via route-handleren som importerer
 * appRouter (rotårsak 2026-08-07). I NODE_ENV=production KREVES secreten; mangler
 * den skal prosessen IKKE komme opp — med melding som navngir variabelen + fila.
 * En boot-guard hjelper også den som ikke leser dokumentasjonen.
 */
export function assertFilSigneringEnv(kontekst: "api" | "web"): void {
  if (process.env.NODE_ENV !== "production") return; // dev/test: usikret fallback (kun signerFilSti-advarsel)
  if (harSigneringsSecret()) return;
  const fil = kontekst === "api" ? "docker/env/api*.env" : "docker/env/web*.env";
  // eslint-disable-next-line no-console
  console.error(
    `[${kontekst}] FATAL: FIL_SIGNING_SECRET mangler i produksjon. ` +
      `Sett samme verdi i docker/env/felles.env (delt av api+web), ev. ${fil}, ` +
      `FØR containerstart. Avslutter.`,
  );
  process.exit(1);
}

/**
 * Verifiser signatur for en gitt path + exp + sig (fra query-parametere).
 * Returnerer false ved manglende/ugyldig/utløpt signatur. Konstant-tids-
 * sammenligning mot timing-angrep.
 */
export function verifiserFilSignatur(
  path: string,
  exp: string | undefined | null,
  sig: string | undefined | null,
): boolean {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;

  const forventet = beregnSignatur(path, expNum);
  const a = Buffer.from(forventet);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Normaliser request-stien til den KANONISKE formen før gate + signatursjekk.
 *
 * 🔴 Sikkerhetskritisk: `fastifyStatic` normaliserer stien før den serverer
 * filen, men gate-hooken gjorde det ikke — så `/uploads/./privat/x`,
 * `/uploads//privat/x` og `/uploads/a/../privat/x` slapp forbi `startsWith`-
 * sjekken og ble likevel servert (utløps-/signatur-gaten omgått). Vi må
 * normalisere med SAMME regler som statisk-serveren, og bruke den normaliserte
 * stien til BÅDE gate og signaturverifisering, ellers ser de to forskjellige
 * strenger.
 *
 * `decodeURIComponent` dekker prosentkodede segmenter (`%2e` → `.`); den kaster
 * på ugyldig koding, derav try/catch i kalleren. `posix.normalize` kollapser
 * `.`/`..`/doble slashes; `replace(/\/+/)` er belte-og-seler for doble slashes.
 *
 * Kanonisk-kompatibilitet: `signerFilSti` signerer en ren `/uploads/privat/<uuid>`
 * -sti. `normaliserFilSti` av samme rene sti er en no-op, så eksisterende signerte
 * lenker verifiserer uendret (bevist i hmac.test.ts).
 */
export function normaliserFilSti(pathname: string): string {
  const dekodet = decodeURIComponent(pathname);
  return posix.normalize(dekodet).replace(/\/+/g, "/");
}

/**
 * Kanonisér en klient-oppgitt fil-URL til den formen som er LAGRET i DB, før
 * eksakt-streng-match (D2-invarianten, `bilde.slettMedUrl`). Klienten kan sende
 * en URL som har passert emisjonssignering (`?exp=&sig=`) eller en sti-variant
 * (`/./`, `//`, `..`); begge må reduseres til `/uploads/<...>` uten query, ellers
 * feiler slettingen stille (deleteMany finner ingen rad). Ugyldig prosentkoding
 * → behold rå (matcher da ikke, ingen sletting).
 */
export function kanoniserForSletting(fileUrl: string): string {
  const utenQuery = fileUrl.split("?")[0] ?? fileUrl;
  try {
    return normaliserFilSti(utenQuery);
  } catch {
    return utenQuery;
  }
}

export type UploadsFilVurdering =
  | { type: "slipp" } // ikke en /uploads/-fil — la passere uendret
  | { type: "ok" } // gyldig signatur
  | { type: "avvist"; kode: 400 | 401 };

/**
 * Full gate-beslutning for en innkommende request mot `/uploads/*`.
 *
 * 🔴 S1 Fase 1b — DEFAULT-DENY på HELE treet (Kenneth-krav 2026-09-24: «sjekk om
 * den som henter ut bilder er innlogget, ikke bare ved pålogging»). Enhver
 * `/uploads/`-sti KREVER en gyldig HMAC-signatur — manglende/ugyldig/utløpt → 401.
 * Ingen sesjons-fallback (samme signatur-KUN-modell som `privat/` hadde i Fase 1).
 * Ren funksjon (ingen Fastify-avhengighet) så den kan enhets-testes mot alle
 * omgåelsesformene. server.ts-hooken bare oversetter resultatet til et svar.
 */
export function vurderUploadsFilForesporsel(rawUrl: string): UploadsFilVurdering {
  const u = new URL(rawUrl, "http://localhost");
  let sti: string;
  try {
    sti = normaliserFilSti(u.pathname);
  } catch {
    return { type: "avvist", kode: 400 }; // ugyldig prosentkoding
  }
  if (!sti.startsWith(UPLOADS_PREFIKS)) return { type: "slipp" };
  const gyldig = verifiserFilSignatur(sti, u.searchParams.get("exp"), u.searchParams.get("sig"));
  return gyldig ? { type: "ok" } : { type: "avvist", kode: 401 };
}
