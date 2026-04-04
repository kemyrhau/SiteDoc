/**
 * Språkdeteksjon basert på ordfrekvens.
 * Dekker alle 14 støttede språk i SiteDoc.
 * ~60 funksjonsord per språk for robust deteksjon.
 */

// Vanlige funksjonsord per språk — artikler, preposisjoner, konjunksjoner, pronomen, hjelpeverb.
// Valgt for å minimere overlapping mellom språk.
const SPRAAK_ORD: Record<string, Set<string>> = {
  nb: new Set([
    // Konjunksjoner/preposisjoner
    "og", "eller", "men", "som", "at", "til", "for", "av", "på", "med", "fra", "om", "ved", "etter", "mellom", "under", "over", "mot", "uten", "gjennom",
    // Pronomen/artikler
    "det", "den", "de", "en", "et", "vi", "han", "hun", "dem", "seg", "dette", "denne", "disse",
    // Hjelpeverb
    "er", "har", "var", "ble", "skal", "kan", "vil", "må", "blir", "hadde", "skulle", "kunne", "ville",
    // Vanlige adverb/adjektiv
    "ikke", "også", "bare", "hvor", "når", "alle", "noen", "hver", "mange", "flere", "svært", "meget",
  ]),
  en: new Set([
    "the", "and", "is", "are", "was", "were", "have", "has", "been", "will", "shall", "with", "from", "this", "that", "which", "their", "they", "would", "should",
    "could", "into", "about", "than", "other", "some", "these", "more", "between", "through",
    "must", "does", "did", "being", "having", "each", "every", "both", "such", "only",
    "very", "also", "just", "because", "before", "after", "where", "when", "while", "during",
    "above", "below", "under", "over", "against", "without", "within", "among", "whether", "although",
  ]),
  sv: new Set([
    "och", "att", "det", "som", "för", "med", "den", "har", "kan", "ska", "vid", "från", "efter", "mellan", "vara", "blir", "inte", "eller", "hade", "skulle",
    "också", "denna", "dessa", "alla", "under", "utan", "genom", "enligt", "inom", "redan",
    "sina", "sitt", "deras", "hans", "hennes", "vilka", "något", "varje", "flera", "mycket",
    "bara", "sedan", "medan", "både", "dock", "alltid", "aldrig", "ännu", "ganska", "sådana",
    "vilken", "vilkas", "inga", "inget", "därför", "eftersom", "innan", "ovan", "nedan", "emot",
  ]),
  de: new Set([
    "und", "der", "die", "das", "ist", "sind", "wurde", "werden", "haben", "nach", "durch", "über", "zwischen", "unter", "nicht", "oder", "auch", "aber", "wenn", "kann",
    "diese", "einer", "einem", "einen", "keine", "mehr", "sehr", "noch", "schon", "alle",
    "sein", "wird", "waren", "hatte", "müssen", "sollen", "dürfen", "wollen", "könnte", "würde",
    "jeder", "jede", "jedes", "viele", "einige", "andere", "welche", "solche", "beide", "damit",
    "weil", "obwohl", "während", "bevor", "nachdem", "damit", "gegen", "außer", "trotz", "gemäß",
  ]),
  pl: new Set([
    "jest", "nie", "się", "że", "lub", "dla", "przez", "przy", "przed", "między", "także", "oraz", "jako", "jego", "ich", "być", "został", "będzie", "może", "bardzo",
    "tego", "tylko", "które", "były", "wszystkie", "jednak", "już", "został", "została", "zostały",
    "każdy", "każda", "więcej", "kilka", "inne", "innych", "mogą", "muszą", "powinny", "według",
    "ponieważ", "kiedy", "gdzie", "chociaż", "podczas", "zawsze", "nigdy", "jeszcze", "tutaj", "teraz",
    "takie", "taki", "takiego", "swoich", "swoje", "naszych", "waszych", "których", "czego", "komu",
  ]),
  fi: new Set([
    "ja", "oli", "että", "sekä", "tai", "myös", "mukaan", "kanssa", "välillä", "jälkeen", "ennen", "kuin", "tämä", "sitä", "ovat", "ollut", "voidaan", "tulee", "pitää", "kaikki",
    "tässä", "niiden", "joiden", "siitä", "muita", "heidän", "sillä", "täytyy", "mutta", "koska",
    "hänen", "meillä", "heillä", "teidän", "jokainen", "usein", "harvoin", "aina", "koskaan", "vielä",
    "paljon", "monia", "muut", "joka", "jotka", "joita", "jonka", "mikä", "missä", "milloin",
    "kuitenkin", "lisäksi", "vastaava", "ainakin", "melko", "erittäin", "hyvin", "niin", "sitten", "ehkä",
  ]),
  cs: new Set([
    "jsou", "bylo", "není", "které", "nebo", "také", "jako", "jeho", "jejich", "byla", "může", "pokud", "podle", "však", "pouze", "tento", "toho", "musí", "bude", "která",
    "tato", "mezi", "všech", "jiné", "nelze", "více", "každý", "před", "přes", "těchto",
    "tyto", "byla", "byli", "budou", "mohly", "mohla", "měla", "měly", "proto", "jelikož",
    "během", "kvůli", "kromě", "včetně", "právě", "většina", "některé", "nikdy", "vždy", "stále",
    "takový", "taková", "takové", "vlastní", "jiných", "dalších", "několik", "mnoho", "málo", "příliš",
  ]),
  ro: new Set([
    "sunt", "este", "care", "pentru", "unui", "unei", "acest", "această", "cele", "prin", "fost", "poate", "după", "între", "toate", "doar", "foarte", "trebui", "fără", "dacă",
    "unde", "când", "aceste", "fiind", "încă", "asupra", "oricare", "orice", "precum", "astfel",
    "avea", "avea", "aveau", "putea", "trebuie", "conform", "deoarece", "totuși", "niciodată", "întotdeauna",
    "fiecare", "multe", "puține", "alte", "altele", "dintre", "către", "despre", "contra", "împotriva",
    "aceasta", "acesta", "acestea", "aceștia", "noastre", "voastre", "nimeni", "nimic", "cineva", "ceva",
  ]),
  lt: new Set([
    "yra", "buvo", "arba", "kuris", "turi", "pagal", "gali", "taip", "tarp", "kurie", "būti", "visų", "šios", "šiuo", "kuri", "dėl", "nuo", "kad", "tik", "iki",
    "jei", "apie", "tada", "kaip", "labai", "dabar", "taigi", "visas", "kitas", "tokio",
    "mūsų", "jūsų", "savo", "kiekvienas", "daugelis", "keletas", "keli", "daug", "mažai", "visada",
    "niekada", "kartais", "dažnai", "retai", "todėl", "kadangi", "nors", "prieš", "prie", "virš",
    "šalia", "kuriuo", "kurių", "kurios", "kuriems", "kokia", "kokiu", "kokius", "kokios", "kokie",
  ]),
  et: new Set([
    "ning", "kui", "mis", "see", "oli", "võib", "oma", "kõik", "peab", "tuleb", "selle", "olla", "nende", "mitte", "ainult", "kohta", "vahel", "pärast", "enne", "kuid",
    "samuti", "väga", "juba", "mõne", "siis", "alati", "kuigi", "muud", "seda", "neid",
    "meie", "teie", "nende", "enda", "iga", "palju", "vähe", "mõni", "keegi", "miski",
    "kunagi", "alati", "sageli", "harva", "sest", "kuna", "ehkki", "enne", "pärast", "üle",
    "alla", "kõrval", "vastu", "ilma", "koos", "läbi", "mille", "kelle", "millal", "kuidas",
  ]),
  lv: new Set([
    "kas", "vai", "tika", "būtu", "visiem", "kurš", "šajā", "visi", "bija", "tiek", "kuru", "līdz", "starp", "pēc", "pirms", "tikai", "arī", "jau", "gan", "nav",
    "bet", "par", "kur", "kad", "kopš", "katrs", "nekā", "viņu", "vēl", "kāds",
    "mūsu", "jūsu", "savu", "katrs", "daudz", "maz", "daži", "vairāki", "cits", "cita",
    "nekad", "vienmēr", "bieži", "reti", "tāpēc", "tādēļ", "kaut", "lai", "kamēr", "pret",
    "blakus", "virs", "zem", "gar", "caur", "bez", "kura", "kuras", "kuriem", "kurām",
  ]),
  uk: new Set([
    // Preposisjoner/konjunksjoner
    "що", "які", "або", "для", "від", "між", "після", "перед", "всіх", "може", "має", "були", "яких", "також", "лише", "дуже", "тому", "якщо", "вже", "без",
    "при", "цей", "його", "інші", "тільки", "буде", "було", "цього", "проте", "через",
    // Pronomen/hjelpeverb
    "наш", "ваш", "свій", "кожен", "багато", "мало", "деякі", "кілька", "інший", "інша",
    "ніколи", "завжди", "часто", "рідко", "тому", "оскільки", "хоча", "поки", "проти", "біля",
    "поряд", "понад", "нижче", "крізь", "щодо", "згідно", "замість", "попри", "серед", "навколо",
  ]),
  ru: new Set([
    "что", "или", "для", "это", "как", "был", "все", "его", "она", "они", "при", "уже", "без", "тоже", "было", "были", "будет", "между", "после", "перед",
    "может", "только", "также", "очень", "более", "этого", "если", "должен", "через", "однако",
    // Pronomen/partikler
    "наш", "ваш", "свой", "каждый", "много", "мало", "некоторые", "несколько", "другой", "другая",
    "никогда", "всегда", "часто", "редко", "потому", "поэтому", "хотя", "пока", "против", "около",
    "рядом", "сверху", "снизу", "сквозь", "согласно", "вместо", "несмотря", "среди", "вокруг", "кроме",
  ]),
  fr: new Set([
    "les", "des", "une", "est", "que", "dans", "pour", "sur", "par", "avec", "sont", "pas", "qui", "ont", "été", "plus", "mais", "comme", "tout", "peut",
    "cette", "entre", "après", "avant", "aussi", "très", "leur", "sans", "même", "autre",
    "nous", "vous", "ils", "elles", "leurs", "notre", "votre", "chaque", "beaucoup", "peu",
    "quelques", "plusieurs", "jamais", "toujours", "souvent", "rarement", "parce", "puisque", "quoique", "pendant",
    "contre", "depuis", "vers", "chez", "sous", "dessus", "dessous", "auprès", "environ", "malgré",
  ]),
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
