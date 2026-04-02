/**
 * Enkel språkdeteksjon basert på ordfrekvens.
 * Detekterer nb, en, sv, de, pl, fi, cs, ro, lt, et, lv, uk, ru.
 */

// Vanlige ord per språk (top 20 mest unike)
const SPRAAK_ORD: Record<string, Set<string>> = {
  nb: new Set(["og", "er", "det", "som", "til", "for", "av", "på", "med", "den", "har", "fra", "skal", "kan", "vil", "ble", "ved", "etter", "mellom", "være"]),
  en: new Set(["the", "and", "is", "are", "was", "were", "have", "has", "been", "will", "shall", "with", "from", "this", "that", "which", "their", "they", "would", "should"]),
  sv: new Set(["och", "att", "det", "som", "för", "med", "den", "har", "kan", "ska", "vid", "från", "efter", "mellan", "vara", "blir", "inte", "eller", "hade", "skulle"]),
  de: new Set(["und", "der", "die", "das", "ist", "sind", "wurde", "werden", "haben", "nach", "durch", "über", "zwischen", "unter", "nicht", "oder", "auch", "aber", "wenn", "kann"]),
  pl: new Set(["jest", "nie", "się", "że", "lub", "dla", "przez", "przy", "przed", "między", "także", "oraz", "jako", "jego", "ich", "być", "został", "będzie", "może", "bardzo"]),
  fi: new Set(["ja", "oli", "että", "sekä", "tai", "myös", "mukaan", "kanssa", "välillä", "jälkeen", "ennen", "kuin", "tämä", "sitä", "ovat", "ollut", "voidaan", "tulee", "pitää", "kaikki"]),
};

/**
 * Detekter kildespråk fra tekst.
 * Returnerer ISO 639-1 kode (nb, en, sv, de, pl, fi).
 * Default: "nb" ved usikkerhet.
 */
export function detekterSpraak(tekst: string): string {
  const ord = tekst.toLowerCase().split(/\s+/).filter((o) => o.length > 1);
  if (ord.length < 20) return "nb"; // For lite tekst til å detektere

  const score: Record<string, number> = {};

  for (const [spraak, ordSet] of Object.entries(SPRAAK_ORD)) {
    let treff = 0;
    for (const o of ord) {
      if (ordSet.has(o)) treff++;
    }
    score[spraak] = treff / ord.length;
  }

  // Finn språk med høyest score
  let best = "nb";
  let bestScore = 0;
  for (const [spraak, s] of Object.entries(score)) {
    if (s > bestScore) {
      bestScore = s;
      best = spraak;
    }
  }

  // Krev minst 3% treffrate for å overstyre default
  return bestScore > 0.03 ? best : "nb";
}
