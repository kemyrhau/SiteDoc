// ESLint-konfig for @sitedoc/web (ESLint v8 — IKKE oppgrader til v9/v10).
// Konvertert fra .eslintrc.json til .js 2026-09-25 fordi G3-regelen under KREVER en
// forklarende kommentar (JSON kan ikke bære kommentarer). Resten er uendret.

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 G3 — «gjør feilklassen ulovlig» (S1 Fase 1b, lag 1 i kvalitetssikring-plan).
//
// Regelen under FEILER på en rå `/uploads/`-sti eller en `/api${…}`-inline-bygging i
// `src` på et `<img>`-element. Den finnes fordi mønsteret som forårsaket S1-hullet
// («bygg en /uploads/-URL for hånd i en klient») ble husket i bare TRE DAGER sist
// (Fase 1b 12.08 → S1-hullet 15.08). Uten håndhevelse vokser de inline-byggingene
// tilbake. Riktig vei er <SignertBilde url={fileUrl} /> — den legger /api-prefikset på
// og håndterer selvfornyelse; signaturen lages på serveren, aldri i klienten.
//
// 🔴 HVA REGELEN DEKKER — og hva den BEVISST IKKE gjør (les før du stoler på en grønn lint):
//
//   DEKKER:  <img> med en `/uploads/`- eller `/api${…}`-verdi i `src`. Dette er
//            renderklassen <SignertBilde> eier. Full web-img-migrering er gjort
//            2026-09-25 (19 filer), så denne skal stå på null treff.
//
//   DEKKER IKKE — og det er RIKTIG, ikke en mangel:
//     • <iframe> (PDF), <video>, <a href download>, fetch(), window.open() mot
//       /uploads/. De er IKKE bilder og har INGEN komponent å bli til. De er
//       ALLEREDE server-signert (output-middleware, Runde 1), så sikkerheten holder.
//       🔴 MEN de SELVFORNYER ikke: med 15 min levetid gir en utløpt signatur 401
//       ved klikk (målt 2026-09-25). Meldt cowork/design som egen avgjørelse — IKKE
//       dekket her fordi en per-linje eslint-disable ville vært nettopp unntakslista
//       ordren forbyr.
//     • <img> skrevet som HTML-STRENG (Leaflet-markør, print-vindu via window.open).
//       Ikke JSX → ingen React-komponent mulig → utenfor AST-regelens rekkevidde.
//     • data:-URL-bilder (signatur, canvas-utsnitt). Ikke /uploads/, ikke berørt.
//     • Hjelpere som bygger `/api${…}` og returneres til `src={hjelper(x)}`.
//       Selve byggingen skjer i hjelperen, ikke i src-attributtet, så den fanges
//       ikke her. Etter migreringen 2026-09-25 finnes ingen slik hjelper igjen.
//     • MOBIL <Image>. `<Image>`-varianten av denne regelen ligger IKKE her ennå —
//       den følger MOBIL-migreringen (egen ordre, splittet ut 2026-09-25 fordi de
//       offline-sammenvevde sitene og WebView-tegningene er en annen renderklasse).
//       Å slå den på nå, før mobil er migrert, ville gjort mobil-lint rød eller krevd
//       disables (= unntakslista). Regelen slås på i apps/mobile/.eslintrc når den
//       migreringen leverer.
// ─────────────────────────────────────────────────────────────────────────────

const G3_MELDING =
  "Rå /uploads/- eller /api${…}-URL i <img src>. Bruk <SignertBilde url={fileUrl} /> " +
  "(apps/web/src/components/SignertBilde.tsx) — den legger /api-prefikset på og fornyer " +
  "en utløpt signatur. Signering skjer på serveren, aldri i klienten (S1 Fase 1b / G3).";

module.exports = {
  extends: ["next/core-web-vitals"],
  plugins: ["i18next"],
  rules: {
    "i18next/no-literal-string": [
      "warn",
      {
        markupOnly: true,
        ignoreAttribute: [
          "className", "style", "type", "href", "src", "alt", "key", "id",
          "name", "value", "htmlFor", "target", "rel", "method", "action",
          "autoComplete", "inputMode", "pattern", "role", "aria-label",
          "data-testid", "strokeLinecap", "strokeLinejoin", "strokeWidth",
          "viewBox", "fill", "stroke", "d", "cx", "cy", "r", "rx", "ry",
          "x1", "x2", "y1", "y2", "transform", "gradientUnits",
          "variant", "size", "align", "side", "asChild",
        ],
        ignore: ["^[A-Z0-9_\\-\\.\\s/:@#]+$", "^\\d", "^[^a-zA-ZæøåÆØÅа-яА-Я]"],
      },
    ],
    // 🔴 G3 — se kommentarblokken over for dekning/avgrensning.
    "no-restricted-syntax": [
      "error",
      {
        // <img src={`/api${x}`}> / <img src={`…/uploads/${x}`}> — inline-bygging.
        selector:
          "JSXOpeningElement[name.name='img'] JSXAttribute[name.name='src'] TemplateElement[value.raw=/\\/(api|uploads)/]",
        message: G3_MELDING,
      },
      {
        // <img src="/uploads/…"> / <img src="/api/uploads/…"> — rå strengsti.
        selector:
          "JSXOpeningElement[name.name='img'] JSXAttribute[name.name='src'] Literal[value=/\\/uploads\\//]",
        message: G3_MELDING,
      },
    ],
  },
  overrides: [
    {
      files: ["**/lib/**", "**/hooks/**", "**/kontekst/**", "**/api/**"],
      rules: {
        "i18next/no-literal-string": "off",
      },
    },
  ],
};
