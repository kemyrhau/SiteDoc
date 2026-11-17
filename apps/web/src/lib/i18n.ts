import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { nb, STANDARD_SPRAAK, SPRAAK_KODER } from "@sitedoc/shared";
import type { SpraakKode } from "@sitedoc/shared";

/**
 * Språk på web (ORDRE 3D-mobil 6, 2026-11-17).
 *
 * `nb` er fallback og ligger statisk (via barrelen). De 14 andre språkfilene lastes med
 * dynamisk `import()` — hver blir sin egen chunk, og bare det valgte språket hentes: det
 * lagrede ved oppstart (`spraakKlart`) og et nytt ved `byttSpraak`. Før lå alle 15 statisk
 * i root layout (~1,5 MB gzip på hver side, også /mobil-viewer i WebView).
 *
 * i18next starter alltid på `nb`, så klientens første render er lik server-HTML-en
 * (serveren kjenner ikke localStorage). Brukere med annet lagret språk ser ikke norsk:
 * `providers.tsx` skjuler siden til `spraakKlart` er ferdig (`SPRAAK_VENTER_SKRIPT`).
 */
const lastere: Record<Exclude<SpraakKode, "nb">, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("@sitedoc/shared/src/i18n/en.json"),
  sv: () => import("@sitedoc/shared/src/i18n/sv.json"),
  lt: () => import("@sitedoc/shared/src/i18n/lt.json"),
  pl: () => import("@sitedoc/shared/src/i18n/pl.json"),
  uk: () => import("@sitedoc/shared/src/i18n/uk.json"),
  ro: () => import("@sitedoc/shared/src/i18n/ro.json"),
  et: () => import("@sitedoc/shared/src/i18n/et.json"),
  fi: () => import("@sitedoc/shared/src/i18n/fi.json"),
  cs: () => import("@sitedoc/shared/src/i18n/cs.json"),
  de: () => import("@sitedoc/shared/src/i18n/de.json"),
  ru: () => import("@sitedoc/shared/src/i18n/ru.json"),
  lv: () => import("@sitedoc/shared/src/i18n/lv.json"),
  fr: () => import("@sitedoc/shared/src/i18n/fr.json"),
  sq: () => import("@sitedoc/shared/src/i18n/sq.json"),
};

export const STORAGE_KEY = "sitedoc-language";

function erSpraakKode(kode: string | null): kode is SpraakKode {
  return kode != null && (SPRAAK_KODER as string[]).includes(kode);
}

export function hentLagretSpraak(): SpraakKode {
  if (typeof window === "undefined") return STANDARD_SPRAAK;
  try {
    const lagret = localStorage.getItem(STORAGE_KEY);
    return erSpraakKode(lagret) ? lagret : STANDARD_SPRAAK;
  } catch {
    return STANDARD_SPRAAK;
  }
}

export function lagreSpraak(kode: SpraakKode) {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, kode); } catch { /* privat modus o.l. */ }
  }
}

/** Hent språkfila hvis den ikke alt er lastet. `nb` ligger alltid statisk. */
export async function lastSpraak(kode: SpraakKode): Promise<void> {
  if (kode === STANDARD_SPRAAK || i18next.hasResourceBundle(kode, "translation")) return;
  const laster = lastere[kode as Exclude<SpraakKode, "nb">];
  if (!laster) return;
  const data = (await laster()).default;
  i18next.addResourceBundle(kode, "translation", data, true, true);
}

// Initialiser i18next med bare nb — andre språk legges til når de lastes
i18next.use(initReactI18next).init({
  resources: { nb: { translation: nb } },
  lng: STANDARD_SPRAAK,
  fallbackLng: "nb",
  interpolation: {
    escapeValue: false,
  },
});

async function aktiver(kode: SpraakKode) {
  await lastSpraak(kode);
  await i18next.changeLanguage(kode);
  if (typeof document !== "undefined") {
    document.documentElement.lang = kode;
  }
}

/**
 * Lagret språk ved oppstart (klient). Løses alltid — feiler lastingen, blir siden
 * stående på nb (fallback) i stedet for å forbli skjult.
 */
export const spraakKlart: Promise<void> = (async () => {
  if (typeof window === "undefined") return;
  const lagret = hentLagretSpraak();
  if (lagret === STANDARD_SPRAAK) return;
  try { await aktiver(lagret); } catch { /* fallback nb */ }
})();

/**
 * Bytt språk: hent fila, aktiver og husk valget. Feiler hentingen (f.eks. uten nett),
 * beholdes gjeldende språk og valget lagres ikke.
 */
export async function byttSpraak(kode: SpraakKode) {
  try { await aktiver(kode); } catch { return; }
  lagreSpraak(kode);
}

/**
 * Inline-skript som kjøres før siden males (rendres øverst i `Providers`, inne i `<body>`,
 * som har `suppressHydrationWarning` i root layout): skjuler `<body>`
 * bare når lagret språk ikke er nb, så ingen ser norsk tekst før språket er lastet.
 * Vises igjen av `Providers` når `spraakKlart` er ferdig, og senest etter 4 s uansett.
 */
export const SPRAAK_VENTER_SKRIPT =
  `(function(){try{var k=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});` +
  `if(k&&k!==${JSON.stringify(STANDARD_SPRAAK)}&&${JSON.stringify(SPRAAK_KODER)}.indexOf(k)>=0){` +
  `var s=document.body.style;s.visibility="hidden";` +
  `setTimeout(function(){s.visibility="";},4000);}}catch(e){}})();`;

/** Vis siden igjen (motstykket til `SPRAAK_VENTER_SKRIPT`). */
export function visSiden() {
  if (typeof document !== "undefined" && document.body) document.body.style.visibility = "";
}

export default i18next;
