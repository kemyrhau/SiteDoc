---
tittel: Fase 3 — før-baseline for utskriftssidene (3b før/etter-DoD)
status: 🟢 LÅST BASELINE
opprettet: 2026-08-12
eier: Opus dokgen
gjelder: fabels fire vilkår (inbox-opus-dokgen 2026-08-11), vilkår 4 — navngitt baseline-sett
---

# Fase 3 — før-baseline for utskriftssidene

Formål: låse `før`-tilstanden til `apps/web/src/app/utskrift/*` **før** fase 3b konverterer dem til arkivmodulen (Vei A, trinn 2). Fase 3 rører **ikke** disse sidene, så den visuelle `før` er fortsatt renderbar ved 3b-start — men dokument-ID-ene og det strukturelle fingeravtrykket låses her (test-data kan endres).

Per fabels **vilkår 4**: dette er 3b-ordrens navngitte baseline-sett — konkrete ID-er, ikke «en sjekkliste og en oppgave».

## Baseline-sett (navngitt)

| Type | Tittel | Dokument-ID | Prosjekt | Print-URL (test) |
|---|---|---|---|---|
| Sjekkliste | Befaringsrapport | `8da14a6b-2221-4c7f-951b-b00675478f59` | Test prosjekt SiteDoc Røstbakken (`2bd15f09-8fbc-4de9-a826-3d2e5462bb23`) | `/utskrift/sjekkliste/8da14a6b-2221-4c7f-951b-b00675478f59` |
| Oppgave | Befaringsnotat | `8373d338-f644-45d9-92b3-28dfdda52836` | Sitedoc Boligfelt B12 (`f6dcb81f-802c-415b-a6c6-a8fdf7f9710f`) | `/utskrift/oppgave/8373d338-f644-45d9-92b3-28dfdda52836` |

Valgt for substans: sjekklisten har utfylte felt + **10 vedlegg-bilder** + tegning + kommentar; oppgaven har **tegningsutsnitt (Oversikt+Utsnitt)** — som er risiko-pkt 4 (JSX-only render-vei). Ingen oppgave i test har vedlegg (målt på tvers av alle 3 prosjekter), så vedlegg-veien dekkes av sjekklisten.

## Strukturelt fingeravtrykk — SJEKKLISTE (før)

Header (skrubbet): `SD-20260310-0007 · Test prosjekt SiteDoc Røstbakken 900512 Røstbakken · Z-20-01 19.03.2026 12:01 · Befaringsrapport · Kenneth Myrhaug (Byggherre) → HE-Ansatte · BEF-002 · 7.7°C, Klart, Vind 0.45 m/s, Nedbør 0 mm`

Felt: Befaringsdato · Vær · Avvik/anmerkninger (m/ kommentar)

```
status_badge:        0     ← MANGLER (§4 sporbarhetsminimum-gap → blir rettelse ved 3b)
logo_img:            true
tegning_blokk:       true
vedlegg_bilder:      10
felt_blokker:        9
kommentar_linjer:    1
sidenummer_footer:   true
a4-ark outerHTML:    3 052 458 tegn (inline-bilder)
```

## Strukturelt fingeravtrykk — OPPGAVE (før)

Header (skrubbet): `SD-20260502-0002 · Sitedoc Boligfelt B12 · sommerfeldtsgt 65 · 24.07.2026 11:55 · Befaringsnotat · Kenneth Myrhaug (Sitedoc Bygger Boligfelt B12) → Sitedoc Bygger Boligfelt B12 · BEF-001 · Medium`

Felt: Overskrift · Antall gravemaskiner (1 stk.) · Antall ansatte (2 stk.)

```
status_badge:                     0      ← MANGLER (§4-gap → rettelse ved 3b)
logo_img:                         false  (dette prosjektet har ingen logo)
prioritet_tekst:                  true   (Medium)
tegningsutsnitt Oversikt+Utsnitt: true   ← risiko-pkt 4 (finnes kun i JSX)
tegning_bilder:                   2
felt_blokker:                     6
```

## Bekreftede (c)-funn mot ekte data

- **`status_badge = 0` på BEGGE** — web-print-sidene mangler statusblokken som `packages/pdf/header.ts` (HTML-tolkeren, mobil) rendrer. Per ordrens §4 er statusblokk sporbarhetsminimum → når arkivmodulen tas i bruk ved 3b **dukker statusblokken opp**; det dokumenteres som en **rettelse**, ikke en regresjon.
- **Tegningsutsnittet (Oversikt+Utsnitt)** finnes kun i JSX-veien (oppgave-page:243-292). Arkivmodulen må gjenskape det ellers tapes det → egen paritetssjekk ved 3b.
- **Vedlegg-veien** (10 bilder på sjekklisten) må matches pixel-for-pixel av modulen.

## Metode + begrensning (ærlig)

- Fanget via `javascript_tool` (fetch mot tRPC-GET med Kenneths session-cookie + DOM-avlesning på de rendrede print-sidene). **Kun lesing** — ingen dokumenter endret, ingen statuser rørt, ingenting sendt.
- **Skjermbilde (PNG/PDF) kunne IKKE fanges:** injection-baserte skjermbilder time-outer konsekvent på `test.sitedoc.no` (origin har vedvarende bakgrunnsaktivitet → `document_idle` fyrer aldri). `javascript_tool` fungerer fordi den ikke venter på idle. Den visuelle `før` fanges derfor ved **3b-start** (fortsatt pre-konvertering, siden fase 3 ikke rører `utskrift/*`) — eller manuelt av Kenneth (Skriv ut → forhåndsvisning). Det strukturelle fingeravtrykket over er den **låste maskin-baselinen** for før/etter-diffen.

## Sammenligning ved 3b (oppskrift)

Kjør samme fingeravtrykk-JS på de konverterte print-sidene (samme to ID-er) og diff mot tabellene over. Forventet eneste **tilsiktede** avvik: `status_badge` går 0 → 1 (rettelse). Alt annet skal være uendret — felt, vedlegg-bilder, tegning/tegningsutsnitt, sidenummer-footer, header-tekst.
