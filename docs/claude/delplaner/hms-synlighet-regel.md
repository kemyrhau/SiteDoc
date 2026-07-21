---
name: hms-synlighet-regel
status: 🟡 IDÉ/PLAN (Kenneth 2026-07-19) — egen sak, IKKE del av N3-fiks del 2. Ikke startet
eier: fabel (design) · cowork (gate) · kode-Opus (bygg)
sist_verifisert_mot_kode: 2026-07-19
---

# HMS-synlighet-regel — firma-default-tabell (subdomain-drevet)

> Kenneth-idé 2026-07-19, sprunget ut av N3-fiks del 2 F1-funnet. **Egen sak — påvirker IKKE del-2/F1-A** (F1-A respekterer den oppløste synligheten uansett hvordan den settes). Denne saken bestemmer *hvordan* synligheten settes.

## Problem (dagens tilstand, verifisert)
`hmsSynlighet` (`"privat" | "apen"`) ligger på malen (`ReportTemplate:819`), settes fritt per HMS-mal i oppsett → produksjon (`MalListe.tsx`). Ingen firma-nivå default, ingen regel — hvem som helst kan sette hvilken som helst HMS-mal privat eller åpen. Malen har alt `subdomain` (`"avvik" | "sja" | "ruh"`, :818).

## Kenneths design
Default-tabell i **firmainnstillinger**, koblet til prosjektopprettelse:
1. Per HMS-subdomain velges default-tilstand i firma-config.
2. Ved prosjektopprettelse arver prosjektets HMS-maler firma-defaultene.
3. Tilstand kan **endres senere** per mal (som `MalListe.tsx` i dag).

**Tre lag:** firma-default → prosjektets maler ved opprettelse → per-mal-override.

## HMS-avvik ≠ KS-avvik (Kenneth 2026-07-19, verifisert)
Regelen gjelder KUN `domain="hms"`. «Avvik» er tvetydig og må alltid kvalifiseres:
- **HMS-avvik** = `domain="hms"`, `subdomain="avvik"` — har `hmsSynlighet`, kan være privat. **Dette er «avvik» i tabellen under.**
- **KS-avvik** = `domain="kvalitet"` — bruker IKKE `subdomain` (HMS-only per schema:818), har IKKE `hmsSynlighet`. Følger normal dokumentflyt, kan aldri bli «privat» via denne regelen. Uberørt.

## Foreslåtte defaults (Kenneth-vedtatt 2026-07-19) — kun domain="hms"
| Subdomain (domain=hms) | Default synlighet | Betydning |
|---|---|---|
| `sja` | **åpen** | Alle prosjektmedlemmer ser |
| `ruh` | **privat** | Kun innsender/mottaker/HMS-ansvarlig |
| `avvik` (HMS-avvik) | **privat** | Kun innsender/mottaker/HMS-ansvarlig |
| andre HMS-typer | **normal dokumentflyt** | Ingen HMS-overlay — synlig via vanlig flyt/faggruppe |

**KS-avvik (`domain="kvalitet"`) og bygg-dokumenter:** utenfor regelen — normal dokumentflyt alltid.

## Prinsippet bak defaultene (Kenneth 2026-07-21) — les dette før du bygger

> Tabellen over er ikke en vilkårlig liste. **Synligheten følger av hvem saken angår.** Kjenner du prinsippet, kan du avgjøre nye HMS-typer selv; kjenner du bare tabellen, må du spørre hver gang.

| Type | Hvem saken angår | Derfor |
|---|---|---|
| **SJA** | **Alle på plassen.** En SJA er tverrgående av natur — Kenneths eksempel: *«en kranbil utfører løft over en hovedinngang til byggeplass»* samler folk fra flere faggrupper og flere dokumentflyter samtidig | **Åpen.** Alle som kan bli berørt må kunne se den |
| **RUH** | **Melderen og administrasjonen.** Terskelen for å melde en uønsket hendelse skal være lav, og den blir ikke lav hvis hele prosjektet leser den | **Privat** — men [ikke privat for administrasjonen](../hms-domenemodell.md), ellers dør saken og ingen beslutter et tiltak |
| **HMS-avvik** | Samme som RUH | **Privat**, samme begrunnelse |

**Konsekvens for design:** åpenheten på SJA er ikke en bekvemmelighet som kan slås av. Den er **forutsetningen for at SJA fungerer** — en tverrgående gjennomgang der halve laget ikke ser dokumentet, er ikke en gjennomgang. Firma-defaulten for `sja` kan derfor være konfigurerbar i teorien, men å sette den privat bryter modellen.

**Sammenhengen med flytvalget:** SJA hører i **HMS-flyten**, ikke standard dokumentflyt, av nøyaktig samme grunn — standard flyt er bundet til faggruppe- og flytmedlemskap og kan ikke romme en tverrgående gruppe. Se [sja-deltakersignatur.md](sja-deltakersignatur.md). **Åpen synlighet og HMS-flyt er to sider av samme egenskap**, ikke to uavhengige valg.

## Åpne design-punkter (for fabel)
1. **Tredje kategori:** i dag er `hmsSynlighet` 2-verdi (`privat`|`apen`). «Normal dokumentflyt» krever en tredje tilstand — sannsynligvis `hmsSynlighet = null` (ingen overlay), men schema/enum-valg tas i design.
   - **🔴 UFRAVIKELIG (fabel-vedtak 2026-07-20) — F1-A-endringen skal i SAMME COMMIT som `null = normal flyt`:** flyt-grenen i `verifiserDokumentTilgang` bruker i dag `!(domain==="hms" && synlighet !== "apen")` (fail-safe: HMS privat med mindre åpen). Innføres null=normal-flyt uten at betingelsen samtidig endres til `synlighet === "privat"`, blir hver null-HMS feilaktig behandlet som privat — og flyt-medlemmer mister tilgang de skal ha. **De to endringene er én endring; splittes de over to commits finnes det et vindu der modellen er intern-inkonsistent.**
2. **Hvor bor firma-config-tabellen:** firmamodul/company-settings — samordnes med `migrering-reporttemplate.md` (ReportTemplate → OrganizationTemplate, firma-nivå-maler).
3. **Arv vs live-kobling:** kopieres defaultene ved opprettelse (snapshot) eller leses live fra firma? (Kenneth: «kan endres senere» tilsier per-mal-override etter kopi.)

## Forhold til N3-fiks del 2
Uavhengig. Del-2s F1-A respekterer den oppløste synligheten uansett verdi. Denne saken kan tas før eller etter del-2 — men påvirker *hvilke* HMS-dok som faktisk er private når del-2 testes (ledd 5), så rekkefølgen er en bevisst beslutning (se under).
