# Designkall — mykt byggeplassfilter: behold, men merk og snakk sant — fabel 2026-09-06

Svar på `docs/redesign/til-fabel/BESTILLING-mykt-byggeplassfilter-2026-09-06.md`.
Mockup: `Byggeplassfilter Mockup.dc.html` (designprosjektet) — i dag / A / B side om side,
til Kenneths blikk.

## Vedtak (fabel — Kenneth bekrefter mot mockupen)

1. **Mykt filter beholdes** — coworks lesning tiltres: et dokument uten byggeplass er et
   prosjekt-dokument og GJELDER der du står; å skjule det gjør det uoppdagbart (C avvises).
2. **Form A — tilhørighet på raden:** prosjekt-dokumenter får badge «Hele prosjektet»
   (grå outline-pille, høyre på raden). Byggeplass-egne rader er umerket — flertallet skal
   ikke bære støy. Dato-sortering uendret. Null nye interaksjoner (effektivitets-gaten).
3. **B (gruppering) avvises som standard:** bryter dato-sorteringen og koster to
   seksjonshoder på mobil. Kan gjenåpnes som sorteringsvalg om A viser seg utilstrekkelig
   i pilot — det er en reversibel beslutning.
4. **Chip-teksten slutter å love noe koden ikke holder:** «Viser kun denne byggeplassen»
   → «Viser denne byggeplassen + dokumenter for hele prosjektet». Samme tekstfiks begge
   flater. Dette er kjernefiksen — badgen uten ærlig chip løser ikke «usikkerhet hvor jeg
   egentlig er innlogget».
5. **Vedtaket som manglet, formuleres som ÉN regel:** *et objekt vises der det gjelder* —
   byggeplass-objekt vises på sin byggeplass, prosjekt-objekt vises overalt i prosjektet,
   MERKET. Føres i masterplanen så «ikke vedtatt noe sted» lukkes.

## Tegninger — samme prinsipp, betinget måling

Samme REGEL, ikke nødvendigvis samme filter: tegninger er stedbundne av natur, så hardt
filter er sannsynligvis riktig KONSEKVENS av regelen (en tegning «gjelder» sin byggeplass).
Men: **cowork måler om tegninger med `byggeplassId: null` finnes i prod.** Finnes de, er de
usynlige under hardt filter i dag — samme uoppdagbarhets-feil med motsatt fortegn, og de
skal ha A-behandlingen (vises + merket). Finnes de ikke, står tegninger uendret og regelen
forklarer begge flater. ⚠️ Enkeltmålt premiss: «tegninger er alltid stedbundne» er antatt,
ikke målt.

## De tre småfunnene

Enig i at de er ordre, ikke design. Én mening om nr. 3 (dokumentflyt mobil vs web): flatere
mobilliste KAN være riktig etter feltarbeid-skillet, men mål før bestilling — hvis mobil
mangler INFORMASJON (roller/flyt-tilstand) og ikke bare struktur, er det en mangel, ikke en
forenkling.

## Neste

Kenneths blikk på mockupen (A er anbefalingen) → cowork skriver ordre: badge + chip-tekst
web + mobil, én delt regel-formulering i koden der filteret bor (kommentar ved
sjekkliste.ts:186 peker på vedtaket) + tegnings-målingen.

## TIL MASTERPLAN (tillegg — cowork fletter)

- Saken «mykt byggeplassfilter — ikke vedtatt noe sted» (04.09) → «Vedtatt 06.09: objektet
  vises der det gjelder; prosjekt-dokumenter vises overalt MERKET ‘Hele prosjektet’, ærlig
  chip-tekst. Designkall: `docs/redesign/designkall-byggeplassfilter-fabel-2026-09-06.md`.
  Venter Kenneth-blikk på mockup → cowork-ordre. Tegninger: måling av byggeplass-løse
  tegninger før konklusjon.»

— fabel
