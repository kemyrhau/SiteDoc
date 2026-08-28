# Designnotat — printmotor fase 4: byggherredokumentet

**Fra:** fabel · **Dato:** 2026-08-27 · **Status:** til Kenneths valg → deretter ordre
**Grunnlag:** rev 3 (`designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md`) + coworks fase 4-relay 27.08 (fakta akseptert, ingenting feilmålt) + Kenneths gate ordrett.

## Svar 1 — ett formål bygget av frie akser (begge, i hvert sitt lag)

Coworks diagnose er riktig: Kenneth beskrev et annet DOKUMENT, ikke et radfilter.
Men vi trenger ikke velge mellom formål og akser — arkitekturen fra rev 2/3 har
allerede svaret:

- **I modellen: frie akser.** Dimensjonene bor i `EksportOppsett.config` (JSONB,
  bekreftet at formen kan vokse uten DDL): `mottaker`, `gruppering`, `format`,
  `topptekst`, kolonnevalg. `configVersion` → 2.
- **I UI: ett formål.** Den innebygde malen rev 1 bevisst holdt tilbake aktiveres
  nå som **«Fakturagrunnlag»** (innebygd = kode, ikke DB-rad, som «Full eksport») —
  den bundler de fire dimensjonene ferdig. Grunnen til tilbakeholdelsen var at
  navnet ville lovet et dokument innholdet ikke holdt; fase 4 leverer innholdet,
  så løftet kan gis.

Normalbrukeren møter aldri aksene — han velger «Fakturagrunnlag» og får riktig
dokument. Den som fakturerer annerledes åpner redigereren og justerer aksene,
«Lagre som min/firma» som i fase 3. Ett formål å forstå, frie akser å eie.

## Svar 2 — status er strukturelt umulig ut av huset (regel, ikke avhuking)

Nytt config-felt **`mottaker: "intern" | "ekstern"`** på malen. `ekstern` betyr:

- **Status utelates strukturelt** — kolonnen finnes ikke i kolonnevelgeren for
  eksterne maler, kan ikke glemmes på. Kenneth sa «status kun for internbruk»,
  ikke «status av som standard» — det er en regel, og en regel som kan avhukes
  er et avhukingsfelt.
- ID-kolonnene utelates også i Excel (i dag kun PDF-håndhevet via `DetaljRad.id`)
  — Kenneths Excel-innvending lukkes av samme flagg.
- Redigereren viser merket **«Ekstern — interne kolonner utelatt»** der kolonnene
  ellers ville stått, så regelen er synlig, ikke stille.

Presedens: samme beslutning som `skalEksporteres`-semantikken («én regel, ingen
formål-matrise») og ID-i-PDF. Én forskjell fra skalEksporteres: der tillot vi
eksplisitt overstyring i redigereren — her IKKE. skalEksporteres beskytter mot
eget oppsett; mottaker=ekstern beskytter mot mottakeren. Vil noen ha status i et
dokument, er malen per definisjon intern.

Innebygde maler: Fakturagrunnlag = ekstern; Full eksport og Lønnsgrunnlag = intern.

## Svar 3 — sideformat er konsekvens med synlig overstyring

Formatet FØLGER kolonnesettet: bred beskrivelseskolonne ⇒ liggende. Men avledningen
skal være synlig og overstyrbar, ikke magisk:

- `config.format: "auto" | "staaende" | "liggende"`, default **auto**.
- Auto-regelen: liggende når beskrivelse-kolonnen er med i PDF, ellers stående.
  Redigereren viser resultatet («Liggende (automatisk)»), brukeren kan låse.
- **Skriftstørrelse er rendererens ansvar, aldri et brukervalg.** Liggende gir
  beskrivelsen bredden; rendereren har ett typografisk minimum og kutter heller
  kolonnebredde-fordeling enn å krympe under det. «Mindre skrift»-forslaget
  løses altså av format + kolonnevekting, ikke av en skrift-knott.

Innebygd Fakturagrunnlag: liggende (auto gir det uansett — beskrivelse er med).

## Svar 4 — topptekst lagres på malen, med flettefelt for det variable

`config.topptekst: { linjer: string[] }` med flettefelt `{firma}`, `{periode}`,
`{prosjekt}` — det faste skrives én gang på malen, det variable flettes fra
rapportfilteret ved eksport. Kontekst-default-prinsippet: appen spør aldri om
noe den vet, og periode/prosjekt står allerede i filteret. Ingen per-eksport-
dialog — den ville skattlagt hver faktura med et steg for å betjene unntaket.
Trengs et engangsavvik, er «Tilpasset»/«Eksporter uten å lagre» allerede veien.

Innebygd Fakturagrunnlag-topptekst: `{firma}` · «Fakturagrunnlag» · `{periode}` ·
`{prosjekt}` — det rev 2 kalte firmatopp.

## Svar 5 — gruppering endrer aldri radsettet

Radsettet defineres av radvalg + `skalEksporteres` (server-side, kan bare trekke
fra) — ferdig bygget. Gruppering (`config.gruppering: "ingen" | "ansatt" |
"prosjekt"`) er sortering + subtotal-innskudd + ev. sideskift per gruppe i PDF —
ren presentasjon. **`byggDetaljRader` røres ikke**; grupperingen er en innpakning
rundt den («én sannhet for Excel og PDF» består). I Excel: sortering + subtotal-
rader i samme ark — IKKE ark-splitting per gruppe (Excel er arbeidsflaten,
filtrering er dens styrke).

## Samlet config-tillegg (configVersion 2)

```
config += {
  mottaker:   "intern" | "ekstern",          // ekstern ⇒ status+ID strukturelt ute
  gruppering: "ingen" | "ansatt" | "prosjekt",
  format:     "auto" | "staaende" | "liggende",
  topptekst:  { linjer: string[] } | null     // flettefelt {firma} {periode} {prosjekt}
}
```

Rader med configVersion 1 leses som `{mottaker: "intern", gruppering: "ingen",
format: "auto", topptekst: null}` — ingen migrering, ingen atferdsendring for
eksisterende maler.

## Rammer kvittert

- ReportTemplate/OrganizationTemplate urørt — alt over er visning i én JSON.
- Kostnad/enhetspris og underprosjekt fortsatt ute (Kenneth-utsatt); kolonne-
  rekkefølgen i Fakturagrunnlag legger pris-kolonner sist når de en gang kommer
  (rev 1-føring står).
- Normaltilfellet uendret: bruker uten maler ser innebygde + firmaets; ett klikk
  eksporterer sist brukte. Klikk-budsjett: 0 nye interaksjoner for standardflyt.

## Designlås-kandidater (til ordren)

1. mottaker=ekstern fjerner status (begge flater) og ID (Excel) strukturelt — ingen overstyring.
2. Gruppering pakker `byggDetaljRader`, endrer den aldri.
3. format=auto avledes av beskrivelse-kolonnen; skrift er renderer-eid.
4. Topptekst flettes fra filteret; ingen per-eksport-dialog.
5. Fakturagrunnlag innebygd som kode (ekstern, liggende, prosjektgruppert, firmatopp).

**Åpent for Kenneth:** navnet på den innebygde eksterne malen — «Fakturagrunnlag»
(rev 1-navnet) eller «Byggherrerapport» (gatens ord). Alt annet er anbefaling
klar for ordre.
