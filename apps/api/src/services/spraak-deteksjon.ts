/**
 * Språkdeteksjon basert på ordfrekvens.
 * Dekker alle 14 støttede språk i SiteDoc.
 */

// Vanlige ord per språk — unike funksjonsord som sjelden overlapper
const SPRAAK_ORD: Record<string, Set<string>> = {
  nb: new Set(["og", "er", "det", "som", "til", "for", "av", "på", "med", "den", "har", "fra", "skal", "kan", "vil", "ble", "ved", "etter", "mellom", "være", "ikke", "eller", "denne", "også", "under", "alle", "bare", "etter", "hvor", "hadde"]),
  en: new Set(["the", "and", "is", "are", "was", "were", "have", "has", "been", "will", "shall", "with", "from", "this", "that", "which", "their", "they", "would", "should", "could", "into", "about", "than", "other", "been", "some", "these", "more", "between"]),
  sv: new Set(["och", "att", "det", "som", "för", "med", "den", "har", "kan", "ska", "vid", "från", "efter", "mellan", "vara", "blir", "inte", "eller", "hade", "skulle", "också", "denna", "dessa", "alla", "under", "utan", "genom", "enligt", "inom", "redan"]),
  de: new Set(["und", "der", "die", "das", "ist", "sind", "wurde", "werden", "haben", "nach", "durch", "über", "zwischen", "unter", "nicht", "oder", "auch", "aber", "wenn", "kann", "diese", "einer", "einem", "einen", "keine", "mehr", "sehr", "noch", "schon", "alle"]),
  pl: new Set(["jest", "nie", "się", "że", "lub", "dla", "przez", "przy", "przed", "między", "także", "oraz", "jako", "jego", "ich", "być", "został", "będzie", "może", "bardzo", "tego", "jest", "tylko", "które", "były", "które", "wszystkie", "jako", "jednak", "już"]),
  fi: new Set(["ja", "oli", "että", "sekä", "tai", "myös", "mukaan", "kanssa", "välillä", "jälkeen", "ennen", "kuin", "tämä", "sitä", "ovat", "ollut", "voidaan", "tulee", "pitää", "kaikki", "tässä", "niiden", "joiden", "siitä", "muita", "heidän", "sillä", "täytyy", "mutta", "koska"]),
  // Nye språk:
  cs: new Set(["jsou", "bylo", "není", "které", "nebo", "také", "jako", "jeho", "jejich", "byla", "může", "pokud", "podle", "však", "pouze", "tento", "toho", "musí", "bude", "která", "tato", "mezi", "všech", "jiné", "nelze", "více", "každý", "před", "přes", "těchto"]),
  ro: new Set(["sunt", "este", "care", "pentru", "unui", "unei", "acest", "această", "cele", "prin", "fost", "poate", "după", "între", "toate", "doar", "foarte", "trebui", "fără", "dacă", "unde", "când", "aceste", "fiind", "încă", "asupra", "oricare", "orice", "precum", "astfel"]),
  lt: new Set(["yra", "buvo", "arba", "kuris", "turi", "pagal", "gali", "taip", "tarp", "kurie", "būti", "visų", "šios", "šiuo", "kuri", "dėl", "nuo", "kad", "tik", "iki", "jei", "apie", "tada", "kaip", "labai", "dabar", "taigi", "visas", "kitas", "tokio"]),
  et: new Set(["ning", "kui", "mis", "see", "oli", "võib", "oma", "mis", "kõik", "peab", "tuleb", "selle", "olla", "nende", "mitte", "ainult", "kohta", "vahel", "pärast", "enne", "kuid", "samuti", "väga", "juba", "mõne", "siis", "alati", "kuigi", "muud", "seda"]),
  lv: new Set(["kas", "vai", "tika", "būtu", "visiem", "kurš", "šajā", "visi", "bija", "tiek", "kuru", "līdz", "starp", "pēc", "pirms", "tikai", "arī", "jau", "gan", "nav", "bet", "par", "kur", "kad", "kopš", "katrs", "nekā", "viņu", "vēl", "kāds"]),
  uk: new Set(["що", "які", "або", "для", "від", "між", "після", "перед", "всіх", "може", "має", "були", "яких", "також", "лише", "дуже", "тому", "якщо", "вже", "без", "при", "цей", "його", "інші", "тільки", "буде", "було", "цього", "проте", "через"]),
  ru: new Set(["что", "или", "для", "это", "как", "был", "все", "его", "она", "они", "при", "уже", "без", "тоже", "было", "были", "будет", "между", "после", "перед", "может", "только", "также", "очень", "более", "этого", "если", "должен", "через", "однако"]),
  fr: new Set(["les", "des", "une", "est", "que", "dans", "pour", "sur", "par", "avec", "sont", "pas", "qui", "ont", "été", "plus", "mais", "comme", "tout", "peut", "cette", "entre", "après", "avant", "aussi", "très", "leur", "sans", "même", "autre"]),
};

/**
 * Detekter kildespråk fra tekst.
 * Returnerer ISO 639-1 kode.
 * Returnerer "nb" ved usikkerhet eller for lite tekst.
 */
export function detekterSpraak(tekst: string): string {
  const ord = tekst.toLowerCase().split(/\s+/).filter((o) => o.length > 1);
  if (ord.length < 20) return "nb";

  const score: Record<string, number> = {};

  for (const [spraak, ordSet] of Object.entries(SPRAAK_ORD)) {
    let treff = 0;
    for (const o of ord) {
      if (ordSet.has(o)) treff++;
    }
    score[spraak] = treff / ord.length;
  }

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
