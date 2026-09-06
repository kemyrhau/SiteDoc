# 🔴 Til fabel — SJA kan ikke dokumentere hvem som har signert

**Fra cowork 2026-09-05. Kenneth-funn samme kveld, målt av cowork.**
Kopi i repoet; meldingen ble relayet.

## Funnet, med Kenneths ord

> **Kenneth 2026-09-05:** *«Hvordan vurderer du en SJA som skal signeres av forskjellige
> mennesker → hver av dem på sin egen app → skal de se hvem som har signert? Det er for en
> leder/SHA-KU viktig å sjekke ute på byggeplassen.»*
>
> *«Jeg trodde vi hadde kontroll → Opus sa tidligere at alle 7 arbeiderne kunne signere → jeg tok
> det for gitt at vi også dokumenterte at alle 7 hadde signert → jeg synes det er merkelig at vi i
> databasen ikke lagrer signaturene.»*

## Målt tilstand — tre mekanismer, ingen løser det

**1. `signature`-rapportobjektet** — ett felt, én signatur.
`packages/pdf/src/felt.ts:131` rendrer **kun bildet**:

```html
<img src="data:..." style="max-height:60px" />
```

🔴 **Ingen navn, ingen tidspunkt, ingen identitet.** En signatur midt i et skjema er i praksis
anonym — signerer en underentreprenør der, står det en strek uten hvem.

**2. Signaturseksjonen nederst i arkiv-PDF** (`arkivmal/signatur.ts`) — **maks to navngitte**,
og de er dokumentflyt-roller med faste etiketter (`sammenstilling.ts:221`):

```
Utført av — Kenneth Myrhaug, HE-Ansatte · signert i SiteDoc 29.08.2026 09:00
Godkjent av — ikke signert
```

**3. `persons`-felttypen** — kan holde syv navn (`felt.ts:112`, `join(", ")`). **Dette er
sannsynligvis det Opus mente.** Men det er en *deltakerliste*, ikke signaturer: ingen bekreftelse
per person, intet tidspunkt, ingen manko-visning.
⚠️ Og den har et åpent funn fra før: skriver ut **rå bruker-UUID-er** i dokumenter som går til
byggherre (masterplanens backlog, `felt.ts:101`).

🔴 **Kun ÉN signatur-modell finnes i hele schemaet: `PsiSignatur`.** Ingen deltaker-modell.

## Hva SHA-koordinatoren ser på en utskrevet SJA

| Ser | Trenger |
|---|---|
| Hvem som fylte ut | ✅ |
| Hvem som godkjente | ✅ |
| Én anonym signaturstrek | — |
| **Hvem av deltakerne som har signert** | ❌ |
| **Hvem som MANGLER** | ❌ |

**Tar han med utskriften ut på plassen for å kontrollere, finner han ikke svaret der.**

## 🟢 Mønsteret finnes allerede — `PsiSignatur`

Bygget og i drift for PSI (`schema.prisma:1942`, dashboard `psi.ts:409`):

| Felt | Gir |
|---|---|
| `userId` **eller** `guestName`/`guestCompany`/`guestPhone` | Innlogget ansatt **eller gjest** — underentreprenør uten konto |
| `hmsKortNr` + `harIkkeHmsKort` | HMS-kort ved signering |
| `psiVersion` | **Hvilken versjon** personen signerte |
| `completedAt` | Når |
| `@@unique([psiId, userId])` | Én signatur per person |

🔴 **Og dashbordet har feltet som betyr mest:**

```ts
gjeldende: s.psiVersion === psi.version
```

**Signaturen vises som utdatert hvis dokumentet er endret etterpå.**

## Hvorfor versjonssporing er avgjørende for SJA spesielt

En SJA endres når forholdene endres — nytt utstyr, ny risiko, vær. **Har fem signert og
risikovurderingen endres, er de fem signaturene på et dokument som ikke lenger gjelder.**

Uten versjonssporing dokumenterer systemet at folk godkjente noe de aldri så. Det er verre enn
ingen signatur.

## To behov som ikke bør blandes

| Hvem | Trenger | Hvorfor |
|---|---|---|
| **Den som signerer** | Se at jeg har signert, gjerne hvem flere | Bekreftelse, tilhørighet til jobben |
| **Leder / SHA-KU** | **Hvem som MANGLER**, i felt | Kontrolloppgave — skal stoppe arbeid |

Det andre er ikke en visning av signaturer. **Det er en manko-liste.** «Fire av seks har signert»
sier mer enn seks signaturbilder gjør.

*(Beslektet: seksjonsstatus-telleren merget samme dag følger samme prinsipp — status er mer
verdt enn innhold når man skal se hva som gjenstår.)*

## Spørsmål til deg — ingen ordre skrevet

1. **Gjenbruk eller generaliser?** Skal SJA bruke `PsiSignatur`-mønsteret direkte, eller trengs en
   generell «flere signaturer på ett dokument»-modell som både PSI og HMS bruker?
   *(Cowork har ikke målt hva en generalisering ville koste.)*
2. **Gjestesignering på SJA?** PSI støtter det. En SJA signeres typisk av innleide og
   underentreprenører — uten gjestevei må alle ha SiteDoc-bruker, og det skjer ikke.
3. **Hvordan ser manko-listen ut i felt?** På mobil, av en SHA-KU som skal sjekke raskt.
4. **Skal `signature`-feltet bære navn og tidspunkt uansett?** Det er anonymt i dag — også utenfor
   SJA. Egen sak, men samme rot.
5. **Hva skjer i arkiv-PDF?** HMS fikk PDF 04.09. En SJA-PDF uten signaturliste er halv
   dokumentasjon.

## Kontekst

Dette henger sammen med tre saker du allerede har: **arkiv-PDF for HMS** (levert 04.09),
**ansvarsgrensen AG** (hva SiteDoc leverer vs. hva bedriften eier), og at **RUH/avvik nå kan
dokumenteres**.

⚠️ **Pilotrelevans:** SJA er lovpålagt HMS-dokumentasjon, og A.Markussen er anleggsgartnere med
innleid mannskap. Cowork vurderer dette som **høyere prioritet enn resten av malarbeidet** — men
rekkefølgen er din.
