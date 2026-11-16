/**
 * Kort-id (prosjektkort-kortid-spec.md § 2–4, Kenneth 2026-11-16, B1 = A: kolonne på radene).
 *
 * Et prosjektkort er mengden rader på én sedel som deler `kortId`. Id-en er intern og vises
 * aldri i UI (Kenneth: «B1 ok, men vises ikke i ui»). Denne modulen er ÉN kilde for:
 *  - `utledKortId`  — id for et kort utledet fra dagens nøkkel (backfill + regel 3). Samme
 *                     uttrykk som SQL-backfillen i db-timer/db-varelager-migreringen:
 *                     `md5('kort|' || user_id || '|' || dato || '|' || coalesce(project_id,'ingen')
 *                       || '|' || coalesce(effektiv_bp,'ingen') || '|' || coalesce(eco,'ingen'))::uuid`
 *  - `losKortId`    — regel 1–3 i § 2.4 (spec-navn `løsKortId`; ASCII-identifikator som
 *                     resten av repoet, jf. `gjenaapneAttestering`).
 *  - `validerKortInvariant` — K1–K4 og K6 (§ 2.3).
 *
 * Ren TS uten avhengigheter: brukes likt av api (syncBatch og skriveveiene), mobil (lokal
 * backfill og skriveveier) og web.
 */

const INGEN = "ingen";

// ---------------------------------------------------------------------------
// md5 (RFC 1321) over UTF-8 — samme bytes som Postgres `md5(text)` i en UTF-8-database.
// ---------------------------------------------------------------------------

function utf8Bytes(s: string): number[] {
  const ut: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const lav = s.charCodeAt(i + 1);
      if (lav >= 0xdc00 && lav <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (lav - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) ut.push(c);
    else if (c < 0x800) ut.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) ut.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      ut.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63),
      );
  }
  return ut;
}

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
  14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
  21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

/** md5 som 32 små heks-tegn. */
export function md5Hex(tekst: string): string {
  const bytes = utf8Bytes(tekst);
  const bitLengde = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 0; i < 8; i++) bytes.push(i < 4 ? (bitLengde >>> (8 * i)) & 0xff : 0);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const m = new Array<number>(16);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let j = 0; j < 16; j++) {
      const p = off + j * 4;
      m[j] = (bytes[p]! | (bytes[p + 1]! << 8) | (bytes[p + 2]! << 16) | (bytes[p + 3]! << 24)) >>> 0;
    }
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const tmp = d;
      d = c;
      c = b;
      const sum = (a + f + K[i]! + m[g]!) >>> 0;
      b = (b + ((sum << S[i]!) | (sum >>> (32 - S[i]!)))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0]
    .map((v) => {
      let h = "";
      for (let i = 0; i < 4; i++) h += ((v >>> (8 * i)) & 0xff).toString(16).padStart(2, "0");
      return h;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Nøkkel og utledet id
// ---------------------------------------------------------------------------

/** Kortets nøkkel (K2–K4). `projectId` er `null` bare for fraværskortet (§ 11.2). */
export type KortNokkelFelt = {
  projectId: string | null;
  /** EFFEKTIV byggeplass: radens egen, ellers sedelens når den hører til prosjektet (M1). */
  byggeplassId: string | null;
  ecoId: string | null;
};

/** Samme strengform som mobilens `kortNokkel` (`prosjekt|byggeplass|underprosjekt`, «ingen» for null). */
export function kortIdNokkel(k: KortNokkelFelt): string {
  return `${k.projectId ?? INGEN}|${k.byggeplassId ?? INGEN}|${k.ecoId ?? INGEN}`;
}

/** Effektiv byggeplass (M1): radens egen, ellers sedelens når sedelens byggeplass hører til radens prosjekt. */
export function effektivKortByggeplass(
  projectId: string | null,
  radByggeplassId: string | null | undefined,
  sedelByggeplass: { id: string; projectId: string } | null | undefined,
): string | null {
  if (radByggeplassId) return radByggeplassId;
  if (!projectId || !sedelByggeplass) return null;
  return sedelByggeplass.projectId === projectId ? sedelByggeplass.id : null;
}

function somUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Utledet kort-id (§ 3.2). `dato` er sedelens dato som `YYYY-MM-DD` (Postgres `date::text`).
 * Samme input → samme id på server, mobil og i SQL-backfillen (test T3).
 */
export function utledKortId(args: {
  userId: string;
  dato: string;
  nokkel: KortNokkelFelt;
}): string {
  const k = args.nokkel;
  return somUuid(
    md5Hex(
      `kort|${args.userId}|${args.dato}|${k.projectId ?? INGEN}|${k.byggeplassId ?? INGEN}|${k.ecoId ?? INGEN}`,
    ),
  );
}

// ---------------------------------------------------------------------------
// Regel 1–3 (§ 2.4)
// ---------------------------------------------------------------------------

export type KortPaaSedel = { kortId: string; nokkel: string };

/**
 * Hvilken kort-id en rad skal ha.
 *  1. Kalleren oppgir kort-id → brukes.
 *  2. Raden finnes fra før med lagret id og uendret nøkkel → beholder id-en.
 *  3. Ellers: det ELDSTE kortet på sedelen med samme nøkkel (`kortPaaSedel` er sortert eldste
 *     først av kalleren); finnes ingen → `utledet`.
 */
export function losKortId(args: {
  oppgittKortId?: string | null;
  lagret?: { kortId: string | null; nokkel: string } | null;
  nokkel: string;
  kortPaaSedel: readonly KortPaaSedel[];
  utledet: string;
}): string {
  if (args.oppgittKortId) return args.oppgittKortId;
  if (args.lagret?.kortId && args.lagret.nokkel === args.nokkel) return args.lagret.kortId;
  const eldste = args.kortPaaSedel.find((k) => k.nokkel === args.nokkel);
  return eldste ? eldste.kortId : args.utledet;
}

/**
 * Kortene på en sedel i alder-rekkefølge, fra rader med `kortId`, nøkkel og et sorterbart
 * tidspunkt (`opprettet`). Ett kort pr. id; eldste rad avgjør kortets alder.
 */
export function kortPaaSedelFraRader(
  rader: readonly { kortId: string | null; nokkel: string; opprettet: number }[],
): KortPaaSedel[] {
  const eldst = new Map<string, { nokkel: string; opprettet: number }>();
  for (const r of rader) {
    if (!r.kortId) continue;
    const f = eldst.get(r.kortId);
    if (!f || r.opprettet < f.opprettet) eldst.set(r.kortId, { nokkel: r.nokkel, opprettet: r.opprettet });
  }
  return [...eldst.entries()]
    .sort((a, b) => a[1].opprettet - b[1].opprettet || (a[0] < b[0] ? -1 : 1))
    .map(([kortId, v]) => ({ kortId, nokkel: v.nokkel }));
}

// ---------------------------------------------------------------------------
// Invarianter K1–K4, K6 (§ 2.3)
// ---------------------------------------------------------------------------

export type KortInvariantRad = {
  /** Id-en til raden (for feilmelding/K6). */
  id: string;
  type: "timer" | "maskin" | "tillegg" | "utlegg" | "vare";
  kortId: string | null;
  sheetId: string | null;
  nokkel: KortNokkelFelt;
  /** Bare maskin/vare: timerraden den er koblet til. */
  sheetTimerId?: string | null;
};

export type KortInvariantBrudd = {
  kortId: string;
  grunn: "kortUlikeRader" | "kortUlikSedel" | "kobletUlikKort";
  radId: string;
};

/**
 * Validerer K1 (samme sedel), K2–K4 (samme nøkkel) og K6 (koblet maskin/vare = radens kort)
 * over et sett rader — kalleren sender hele sedelens post-tilstand. Rader uten `kortId`
 * (reise, vare uten sedel) hoppes over. Tom liste = gyldig.
 */
export function validerKortInvariant(rader: readonly KortInvariantRad[]): KortInvariantBrudd[] {
  const brudd: KortInvariantBrudd[] = [];
  const forste = new Map<string, KortInvariantRad>();
  const timerKort = new Map<string, string | null>();
  for (const r of rader) if (r.type === "timer") timerKort.set(r.id, r.kortId);
  for (const r of rader) {
    if (r.kortId) {
      const f = forste.get(r.kortId);
      if (!f) forste.set(r.kortId, r);
      else if (f.sheetId !== r.sheetId) brudd.push({ kortId: r.kortId, grunn: "kortUlikSedel", radId: r.id });
      else if (kortIdNokkel(f.nokkel) !== kortIdNokkel(r.nokkel))
        brudd.push({ kortId: r.kortId, grunn: "kortUlikeRader", radId: r.id });
    }
    if ((r.type === "maskin" || r.type === "vare") && r.sheetTimerId && timerKort.has(r.sheetTimerId)) {
      const radensKort = timerKort.get(r.sheetTimerId) ?? null;
      if (radensKort !== r.kortId)
        brudd.push({ kortId: r.kortId ?? "", grunn: "kobletUlikKort", radId: r.id });
    }
  }
  return brudd;
}
