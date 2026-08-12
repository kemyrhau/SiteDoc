# Fabel — TILLEGG til arkivmal-spec: utskriftsinnstillinger fra oppsett — 2026-08-11

Kenneth påpekte at malspesifikasjonen (til-repo-2026-08-11-1800) ikke tok
stilling til de eksisterende utskriftsvalgene i web-oppsettet. Rettes her.
Tillegget er normativt sammen med hovedspecen.

## Prinsipp: samme innstillinger, én kilde, ett unntak

Server-rendreren skal lese **samme `utskriftsinnstillinger` per prosjekt**
som klient-utskriften gjør i dag (prosjektoppsett: `logo`,
`eksternProsjektnummer`, `prosjektnavn`, `fraTil`, `lokasjon`,
`tegningsnummer`, `vaer`, + `visSidenummer` fra `Utskriftsinnstillinger`).
Ingen ny innstillingsflate og ingen duplisert tolkningslogikk: tolkningen
av innstillingene inn i mal-elementer skjer i den felles mal-modulen i
`packages/pdf`, og klient-utskriftssidene konvergerer mot samme modul
(fase 3b-oppryddingen) — i dag tolker `utskrift/sjekkliste` og
`utskrift/oppgave` dem hver for seg.

## Kobling innstilling → mal-element

- `logo` av → topptekstens logofelt utgår, firmanavn + org.nr står igjen.
- `prosjektnavn`, `eksternProsjektnummer`, `lokasjon` → styrer feltene i
  prosjektblokken; blokken komprimeres (kolonner faller bort, ikke tomrom).
- `fraTil`, `tegningsnummer`, `vaer` → styrer tilsvarende innholdsfelter
  der dokumenttypen har dem (fraTil/vaer: dagsseddel; tegningsnummer:
  dokumenter med tegningsreferanse).
- `visSidenummer` → «Side X av Y» i bunnteksten.

## Unntaket: arkivutgaven har et minimum som ikke kan velges bort

Eksportpakken (og dokumenter til byggherre) er arkivdokumenter. Uansett
innstillinger beholdes: **firmanavn + org.nr, dokumentnr., statusblokk,
signaturblokk og bunntekstens «Generert fra SiteDoc {dato} · dokument-id»**.
Innstillingene styrer presentasjon (logo, felter), aldri sporbarhet — et
dokument uten generert-stempel og id kan ikke stå alene i ti år, og da
ville hele arkivverdien avhenge av en avhuking noen gjorde for skjermprint.
Konkret: `visSidenummer` respekteres i løpende utskrift, men i
eksportpakken settes sidetall alltid.

## Nye dokumenttyper

HMS/timer/utlegg-malene fødes med samme kobling — ingen egne
innstillingsnøkler i v1. Nye valg (om de kommer) legges i samme
`utskriftsinnstillinger`-objekt og tolkes ett sted.

— fabel (relayet av Kenneth)
