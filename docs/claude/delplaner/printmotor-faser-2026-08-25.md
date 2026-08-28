---
name: printmotor-faser
description: Faseinndeling av fabels printmotor-design (eksportvalg + lagrede utskriftsmaler). Cowork eier inndelingen; fabel eier designet.
status: FASE 4 LEVERT (branch feat/eksport-fase4-byggherredokument)
sist_verifisert_mot_kode: 2026-08-27
---

# Printmotor — faseinndeling

**Designet:** [designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md](../../redesign/designnotat-eksportvalg-fakturagrunnlag-fabel-2026-08-25.md) (rev 3)
· mockup i `docs/redesign/eksportvalg-mockup/`.

Notatet er komplett og ufaset — **faseinndeling er coworks ansvar, ikke fabels.**
Fabel designer; cowork setter leveransegrenser. (Cowork formulerte dette som en
mangel hos fabel 2026-08-25; det var feil og er rettet.)

## Rekkefølgen — verdi først, datamodell sist

| Fase | Innhold | Hvorfor her |
|---|---|---|
| **1** | **PDF av rapporten.** Tredje valg i Eksporter-menyen. Samme innhold som dagens Excel, formatert som dokument. Ny mal på `arkiv.rendr`-motoren — `packages/pdf` er dokumentorientert og har ingen tabellrenderer, men HTML→PDF-rørledningen står | Hullet Kenneth pekte på: «det fins enda ingen print av rapporter». Motoren finnes, ingen ny datamodell |
| **2** ✅ | **Radvalg.** Type-kolonne (Timer · Maskin · Tillegg · Utlegg) i ett kronologisk ark + avhuking av radtyper i Tilpasset-modalen. Ingen lagring. **Levert 2026-08-27** (`feat/eksport-fase2-radvalg`): delt `byggDetaljRader` i `@sitedoc/shared` (én sannhet, Excel+PDF), fire SUBTOTAL-summer, PDF dropper tomme kolonner. Detaljer i [timer.md § Fase 2](../timer.md) | Gjør eksporten svar på «hva trenger jeg» uten et malsystem |
| **3** ✅ | **Lagrede maler.** `EksportOppsett` (firma + personlig via nullable `eierId`, `basertPaId` som bindeledd), «Lagre som», redigering. **Levert 2026-08-27** (`feat/eksport-fase3-lagrede-maler`): ny tabell i `db-timer` (migrering `20260827120000_eksport_oppsett`, additiv), `eksportOppsett`-router (list/lagre/oppdater/slett), modalen fra fase 2 fikk navnefelt + «Lagre som min/firma» + «Slett»; eksport-menyen fikk maler-velger (Mine · Firmaets · Innebygd «Full eksport» · Ny). Detaljer i [timer.md § Fase 3](../timer.md) | Modalen fra fase 2 ER redigereren — den får bare lagringsknapper |
| **4** ✅ | **Byggherredokumentet.** config v2 (fire akser: `mottaker`/`gruppering`/`orientering`/`topptekst`, ingen migrering) + innebygde `Lønnsgrunnlag`/`Fakturagrunnlag`. **Levert 2026-08-27** (`feat/eksport-fase4-byggherredokument`): delt `grupperDetaljRader` i `@sitedoc/shared` (pakker `byggDetaljRader`, enhetstestet), `mottaker=ekstern` fjerner status+ID strukturelt (Excel Detaljer+Sammendrag, PDF), `orientering=auto/liggende` via ny valgfri `landscape`-param i pdf-render-containeren (🔴 eget deploy-steg — delt med prod), topptekst flettes server-side. Detaljer i [timer.md § Fase 4](../timer.md) | Et filter kalt «Fakturagrunnlag» uten per-prosjekt-gruppering + fakturatopptekst lover et dokument innholdet ikke holder — og mottakeren (byggherren, ut av huset) er den som oppdager det. Samme feilklasse som `skalEksporteres` som ikke filtrerte og PDF-knappen for noe serveren ikke støttet. `configVersion` lar formen vokse uten å migrere radene |

**Hvorfor datamodellen kommer sist:** den designes da mot en funksjon som virker,
i stedet for i det abstrakte. Viser fase 2 at radvalget har en annen form enn
antatt, endrer fase 3 seg gratis — før noe er persistert i en tabell.

**Hvorfor Lønnsgrunnlag/Fakturagrunnlag ikke ble levert i fase 3:** de to
navngitte formålene fabel designet (rev 1–3) er grupperings-formål, ikke
radvalg-formål. Uten grupperings-dimensjonen (fase 4) ville de vært to filtre som
bare skiller seg på hvilke radtyper som er huket av — et falskt inntrykk av at de
designede formålene er ferdige. Kenneth-vedtak 2026-08-27: fase 3 leverer én ærlig
innebygd (`Full eksport`); de to formålene venter på fase 4.

## Avklart underveis — ikke bygg dette på nytt

- **`skalEksporteres` er FERDIG** (2026-08-25, i develop og main). Filtrerer både
  lønnsarter (`rapport.ts:161`, kode-nivå i eksport-veien) og tillegg (`:74`/`:308`,
  Prisma relasjons-where i `detaljEksport`). Eksport-only: skjermen viser fortsatt
  alt, fordi attestering må se timer som ikke skal eksporteres. Maskinrader på en
  ekskludert timerad får egen linje i stedet for å forurense «Maskin uten timerad»,
  som er et anomali-signal. Fabel foreslo den til fase 2 på utdatert grunnlag.
- **ID-kolonner:** blir i Excel som koblingsnøkkel for en senere
  underprosjekt-dimensjon, men skal ALDRI i PDF-en. Kenneth: «den id raden er bare
  tull — den er kun for verifisering mot databasen».
- **Underprosjekt-dimensjonen** (dokumentflyt, avhenger av proadm-API) og
  **kostnad/enhetspris per rad** (henger sammen med maskin- og varelagerprising) er
  bevisst utsatt. Eksportkoden skal skrives datadrevet så dimensjonen kan legges til
  som én kolonne + ett filter uten ombygging.

## Arkitektur-vakter for fase 3

- **Ikke et tredje mal-begrep.** `ReportTemplate` (schema:920) og
  `OrganizationTemplate` (:993) finnes allerede, med en ufullført migrering mellom
  seg (`migrering-reporttemplate.md`). `EksportOppsett` lagrer VISNINGER, ikke
  dokumentstruktur, og berører ingen av dem. MALBYGGER-sporet er en annen sak.
- **Firma-vakten er `erFirmaAdmin`/`autoriserAdminForFirma`**, som leser
  `OrganizationMember.firmaRoller`. IKKE `User.role === "company_admin"` — den er
  den gamle kilden, og begge lever side om side i serveren midt i en ufullført
  konsolidering (`tilgangskontroll.ts:73` mot `:177`).

## Åpent etter fase 4-gaten (2026-08-27) — fabel eier

**Sammendraget følger ikke grupperingen.** Velger man «Etter prosjekt» grupperes
Detaljer på prosjekt, mens Sammendrag fortsatt lister ansatte. Slik er fase 4
designet (gruppering treffer kun detaljtabellen), men for et fakturagrunnlag er
det underlig at dokumentet er organisert på prosjekt mens oppsummeringen er
organisert på person. Spørsmålet er om Sammendrag skal arve `gruppering` når
`mottaker=ekstern`. **Ikke bygget på en slutning — venter fabel-svar.**

**Lukket i samme gate:** ansattnr og «MASKIN UTEN TIMERAD»-merket skal ut av
eksterne dokumenter (Kenneth-vedtak 2026-08-27 — ansattnr er
pseudonymiseringsnøkkelen; merket er et internt anomali-signal). Ordre:
`relay/inbox-eksport-fase4-oppfolger.md`. Ansattnavn BLIR — det er
dokumentasjonen av hvem som utførte arbeidet.

**Ikke en defekt:** klokkeslett manglet i gate-PDF-en fordi `timer-demo`-seeden
ikke har fra/til-tider. Kolonnene finnes og er gatet på datainnhold
(`timer-rapport.ts:301-308`).

## 🔴 Retningsrettelse 2026-08-27 — malen styrer skjermen, ikke bare dokumentet

**Kenneth:** *«jeg etterlyste tidligere at det er ønskelig å kunne dynamisk vise på
web → for så å skrive ut det vi ser.»*

Han ba om dette **før** printmotoren ble faset. Cowork fanget det ikke inn i denne
planen, og fase 1–4 ble derfor bygget dokument-først: malen former dokumentet ved
eksport, mens web-rapporten forble et aggregat per ansatt. Brukeren bygger et
dokument han ikke kan se før det er laget.

Migreringskommentaren i `20260827120000_eksport_oppsett` sa det hele tiden:
*«EksportOppsett lagrer en VISNING … IKKE dokumentstruktur.»* Ordet var riktig fra
starten; implementasjonen ble en eksportinnstilling.

**Rettelsen:** `radTyper`, `gruppering` og `mottaker` styrer **skjermen**; «Eksporter»
skriver ut det som vises. `format`, `orientering` og `topptekst` er egenskaper ved
utskriften og påvirker ikke flaten. Bieffekt som er verdt mye: setter man
`mottaker=ekstern`, ser man dokumentet slik byggherren vil se det — uten status og
ansattnr — **før** det sendes.

Ordre: `relay/inbox-timer-rapport-detaljvisning.md`.

**Hvorfor dette haster mer enn det ser ut:** prosjektfilter-feilen (rader fra andre
prosjekter lakk inn i både rapport og eksport, `rapport.ts:148`/`:343`) sto i et
ferdig dokument før noen så den. Skjermen sa 129 og dokumentet sa 129 — de var
enige, og begge tok feil. Enighet mellom to visninger av samme spørring beskytter
ikke mot at spørringen er gal. Sto radene på skjermen, ville feilen vært synlig der
den kan fanges.

## ⚠️ Mal-klikket har hatt TRE posisjoner på to dager — les alle før du endrer

Dette er den saken i sporet med størst risiko for at noen «retter tilbake» til noe som
allerede er forkastet. Alle tre posisjonene er ekte vedtak, tatt i rekkefølge:

| # | Posisjon | Dato | Hvorfor forlatt |
|---|---|---|---|
| 1 | **Klikk på mal = eksporter direkte** (fase 3-oppførsel) | 27.08 | Dokumentet forlot huset uten at noen hadde sett det. Prosjektfilter-feilen sto i en ferdig PDF før den ble oppdaget |
| 2 | **Klikk = anvend malen på skjermen**, eksporter separat | 27.08 | Kenneth i praksis: *«når jeg trykket fakturagrunnlag → skjedde ingen ting»*. Nettlesere laster ned uten fanfare; uten synlig bekreftelse er «anvendt» og «ingenting skjedde» umulig å skille |
| 3 | **Klikk = anvend PÅ SKJERMEN og last ned** — 🟢 gjeldende | 27.08 | Coworks premiss i #2 var galt: **nedlasting er ikke sending.** Dokumentet forlater huset når e-posten sendes, ikke når fila havner i Downloads. «Se før du sender» holder derfor selv med nedlasting |

🔵 **Neste retning er allerede kjent: arkivering framfor nedlasting.**
**Kenneth 27.08:** *«ingen ønsker et dokument i nedlastinger for så å flytte/arkivere det
senere → det må umiddelbart arkiveres, huske hvilken mappe.»*

Fabel eier designet (`relay/fabel-eksport-arkivering.md`, usendt per 28.08). Det harde
premisset: **`Folder.projectId` er påkrevd** mens timer-rapporten er en **firma**-flate
der prosjekt bare er et filter — et ufiltrert dokument har ingen mappe å ligge i.

🔴 **Nedlastingsveien (#3) er MIDLERTIDIG, men skal ikke fjernes uten erstatning.** Noen
trenger fila lokalt — for å legge ved i Outlook, eller laste opp i en kundeportal. Blir
arkivering bygget, blir «last ned» sannsynligvis «last ned fra arkivet», ikke borte.
**Eksport-utløseren er derfor bygget samlet ett sted** nettopp for at #3 kan bli
arkivering uten at flyten rives opp.
