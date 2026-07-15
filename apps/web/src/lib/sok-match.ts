/**
 * Søkematch for den globale søkemodalen (finnbarhets-revisjon).
 *
 * Erstatter bar substring (`norm.includes`) med skrivefeil-tolerant,
 * synonym-utvidet matching. REN modul — ingen React/tRPC/dependency — så både
 * index-siden (`useSokRegistry`) og query-siden (`SokModal`) leser samme kilde,
 * og logikken er enhet-testbar uten klient-modulgrafen.
 *
 * `normaliserSok` bor her (ÉN kilde) og re-eksporteres fra `useSokRegistry`
 * for bakoverkompatibilitet.
 */

/** Normaliserer for diakritikk-tolerant match: «lonnsart» treffer «Lønnsarter». */
export function normaliserSok(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fjern kombinasjonstegn: å→a, ü→u, é→e …
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae");
}

/**
 * Sentralt synonymsett for kjernebegreper. Triggere + synonymer er NORMALISERTE
 * (ø→o, æ→ae) fordi de sammenlignes/appendes mot `norm`. `synonymerFor` samler
 * synonymene til hver regel hvis norm inneholder et av triggerordene (hel-token).
 * Bygger på per-kort `sokeordKey`; denne tabellen dekker det tverrgående.
 */
interface SynonymRegel {
  triggere: string[];
  synonymer: string;
}

export const KJERNE_SYNONYMER: SynonymRegel[] = [
  { triggere: ["innstillinger", "oppsett"], synonymer: "oppsett admin administrer konfig konfigurasjon instillinger" },
  { triggere: ["byggeplasser", "byggeplass"], synonymer: "lokasjon plass kart geofence omrade tegning georeferanse georeferer kartfeste" },
  { triggere: ["mapper", "mappeoppsett"], synonymer: "mappe dokument arkiv box" },
  { triggere: ["ansatte", "medlemmer"], synonymer: "bruker folk roller admin medarbeider" },
  { triggere: ["dokumentflyt", "faggrupper", "faggruppe", "medlemmer"], synonymer: "dokumentflyt faggruppe medlemmer flyt" },
  { triggere: ["firmaprofil", "firmainfo"], synonymer: "admin administrer firmainnstillinger firmaoppsett" },
  { triggere: ["dokumentsok", "sok"], synonymer: "sok ai-sok finn" },
  { triggere: ["timer", "attestering"], synonymer: "time dagsseddel lonn arbeidstid" },
  { triggere: ["maskin"], synonymer: "utstyr kjoretoy" },
];

/**
 * Synonymer for en (allerede normalisert) norm-streng: sammenslåtte synonymer
 * for hver regel hvis et triggerord finnes som hel-token i norm. Returnerer en
 * normalisert, mellomrom-separert streng klar til å appendes til norm.
 */
export function synonymerFor(norm: string): string {
  const tokens = new Set(norm.split(/\s+/).filter(Boolean));
  const ut: string[] = [];
  for (const regel of KJERNE_SYNONYMER) {
    if (regel.triggere.some((tr) => tokens.has(tr))) ut.push(regel.synonymer);
  }
  return ut.join(" ");
}

/**
 * Damerau-Levenshtein begrenset til `tak` (med tidlig-exit når hele raden
 * overstiger taket). Returnerer `tak + 1` som «for langt unna»-sentinel.
 */
export function boundedLev(a: string, b: string, tak: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > tak) return tak + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let forrige2: number[] = [];
  let forrige: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const naa: number[] = new Array(lb + 1);
    naa[0] = i;
    let radMin = naa[0];
    for (let j = 1; j <= lb; j++) {
      const kost = a[i - 1] === b[j - 1] ? 0 : 1;
      // ! er trygt: alle indekser er beviselig i-bounds (0..lb / 0..la).
      let v = Math.min(
        forrige[j]! + 1, // sletting
        naa[j - 1]! + 1, // innsetting
        forrige[j - 1]! + kost, // erstatning
      );
      // Damerau-transposisjon (ombytte av to nabotegn)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, forrige2[j - 2]! + 1);
      }
      naa[j] = v;
      if (v < radMin) radMin = v;
    }
    if (radMin > tak) return tak + 1; // tidlig-exit
    forrige2 = forrige;
    forrige = naa;
  }
  return forrige[lb]!;
}

/**
 * Match-score mellom et treffs `norm` og en (normalisert) `query`. 0 = ingen
 * treff. Alle query-tokens MÅ matche noe (AND) — ellers 0. Sum av del-scorer
 * gir rangering (eksakt > prefiks > substring > fuzzy).
 *
 * Begge argumenter forventes normalisert (`normaliserSok`).
 */
export function matchScore(norm: string, query: string): number {
  const qTokens = query.split(/\s+/).filter(Boolean);
  if (qTokens.length === 0) return 0;
  const nTokens = norm.split(/\s+/).filter(Boolean);

  let sum = 0;
  for (const qt of qTokens) {
    let best = 0;
    for (const nt of nTokens) {
      let s = 0;
      if (nt === qt) s = 1.0;
      else if (nt.startsWith(qt)) s = 0.85;
      else if (nt.includes(qt)) s = 0.8;
      else if (qt.length >= 4) {
        // Fuzzy kun for ≥4 tegn (korte tokens dekkes av prefiks/substring/synonym
        // — hindrer at «adm» fuzzy-matcher urelaterte ord). Sammenlign mot
        // norm-tokenets ledende del av samme lengde: «instill» ↔ «innstil» = 1.
        const tak = qt.length <= 6 ? 1 : 2;
        const d = boundedLev(qt, nt.slice(0, qt.length), tak);
        if (d <= tak) s = 0.5 - 0.1 * d;
      }
      if (s > best) best = s;
      if (best === 1.0) break;
    }
    if (best === 0) return 0; // AND-krav: hvert query-token må treffe noe
    sum += best;
  }
  return sum;
}
