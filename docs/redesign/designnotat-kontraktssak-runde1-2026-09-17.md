# Designnotat: kontraktssaker skilt fra vanlige oppgaver (runde 1)

**Fra:** design-rollen (overtatt etter Fabel) · **Til:** cowork → Kenneth-gate · **Dato:** 2026-09-17
**Svarer på:** bestillingen «skille kontraktsdokumenter fra vanlige oppgaver» (cowork 2026-09-17)
**Status:** ✅ GATET av Kenneth 2026-09-17: `subdomain = "kontrakt"` godkjent, ordet «Kontraktssak» godkjent. Oppfølgingsspørsmål om Proadm/godkjenning besvart i § 9 (retning, ikke vedtak).
**Mockup:** Design-artefakt «Kontraktssak — runde 1» (https://claude.ai/artifact/ARd4V9oRRmuHr7MGXr9yPV), 4 tavler. HTML-kopi: `docs/redesign/mockups/Kontraktssak Runde1 Mockup/`

---

## Kort svar

- **Kilde:** **malen erklærer det**, ikke flyten og ikke prefikset. Lagres som `ReportTemplate.subdomain = "kontrakt"` (eksisterende kolonne, ingen skjemaendring).
- **Ord for klassen:** **Kontraktssak** (flertall: kontraktssaker).
- **Hvor:** segment over Oppgaver-lista (*Alle · Oppgaver · Kontraktssaker*) + et ikon (⚖ `Scale`) i den faste Prefix-cellen. Dokumentvisning og PDF får én linje. Mobil får det samme.
- **Tåler lista det?** Ja, fordi ingenting får ny kolonne, ny chip eller ny farge. Ikonet bor i en celle som allerede finnes.
- **Er runde 1 plaster?** Nei, **gitt at kilden er malen**. Et rent visuelt skille utledet av prefiks eller flyt ville vært plaster. Erklæringen på malen er det runde 2 bygger på; bare segmentet kastes da.

---

## 1. Hva utleder «dette er en kontraktssak»? (rundens viktigste spørsmål)

### Målt i kode (2026-09-17, develop)

| Kandidat | Målt | Konsekvens |
|---|---|---|
| **Prefiks** | Fri tekst per mal (`ReportTemplate.prefix`) | ❌ Utelukket, som bestillingen sier |
| **Bundet flyt** | `Dokumentflyt.bundet` (schema.prisma:1549). Mal ↔ flyt er **mange-til-mange** (`DokumentflytMal`, `@@unique([dokumentflytId, templateId])`) | ❌ Samme mal kan ligge i én bundet og én fri flyt. Da ville samme dokumenttype vises som kontraktssak i én flyt og ikke i en annen. Bundet er dessuten en **behandlingsregel**, ikke en **innholdsklasse**: et internt kontrollavvik kan være bundet uten å være kontrakt. Å endre en flyt ville stille omklassifisere alle dokumentene i den |
| **`ReportTemplate.domain = "kontrakt"`** | `domain` er runtime-identitet (bygg/hms/kvalitet) | ⚠️ Riktig akse **på sikt**, men to feller i dag: **(a)** gruppetilgang leser `domain` (`tilgangskontroll.ts:1325-1345`, `gruppe.domains`). En gruppe med `["bygg"]` ville **mistet innsyn** i kontraktssakene. Det er en rettighetsendring, ikke et visuelt skille. **(b)** `mal.ts` nekter domain-skifte når malen har dokumenter, så Kenneths VAR-mal med VAR-001 kan ikke flyttes uten datamigrering. Begge hører i runde 2 |
| **Felt i malen** | Ingen felttype bærer klasse | ❌ Ville gjort klassen avhengig av skjemaets innhold |
| **Brukeren merker dokumentet** | Ingen kolonne på Task | ❌ Krever skjemaendring, og klassen hører til typen, ikke enkeltdokumentet |
| **`ReportTemplate.subdomain = "kontrakt"`** | Eksisterende nullable tekstkolonne, ingen CHECK-constraint (migrering `20260526200000`). Brukes i dag kun for HMS (`avvik`/`sja`/`ruh`). **Leses ikke av tilgangskontroll.** Endring er ikke blokkert når dokumenter finnes | ✅ **Anbefalt** |

### Anbefaling: malen erklærer klassen

**Begrunnelse:**
1. **Klassen hører til innholdet, ikke til ruten.** Et varsel om endring er kontraktsmateriale uansett hvilken flyt det går i. Den som bygger malen vet det, og ingen andre kan utlede det sikkert.
2. **Én erklæring, ett sted.** Satt én gang på malen, gjelder alle dokumenter fra den, også de som finnes (VAR-001 blir merket straks).
3. **Ingen tilgangsendring.** `subdomain` leses ikke av `byggDokumentTilgangsFilter`, så ingen mister eller får innsyn.
4. **Veien til runde 2 er en presis migrering:** `UPDATE report_templates SET domain = 'kontrakt' WHERE subdomain = 'kontrakt'`, tatt sammen med en **bevisst** tilgangsbeslutning (skal alle med «bygg»-tilgang se vederlagskrav? antakelig ikke). Det oppfyller migrasjons-backfill-disiplinen: diskriminerende WHERE, ikke en generisk default.
5. **Lån og arkiv:** klassen følger malen når den kopieres, dersom `subdomain` følger med. ⚠️ **Umålt for «Hent fra arkiv»/lån** (`bibliotek.ts:185` kopierer `domene`; `subdomain` ikke sett). Kodeagenten måler og retter i ordren.

**Hva med bundet flyt?** Den brukes ikke som kilde, men som **rimelighetssjekk** senere: en kontraktssak-mal som ligger i en fri flyt er verdt et signal i malbyggeren (feltstatus-standarden, amber kant: «Kontraktssaker går vanligvis i bundet flyt»). **Ikke i runde 1.** Notert for runde 2.

**Semantisk kostnad, sagt rett ut:** `subdomain` har til nå betydd «HMS-undertype», og schema-kommentaren sier «kun ved domain=hms». I runde 1 får den betydningen **«undertype innenfor domenet»**: `kontrakt` under `bygg`. Kommentaren og `valideerSubdomainCategory` (`mal.ts:171`) må oppdateres i samme commit. Det er en ærlig utvidelse av et begrep, ikke en snarvei, men Kenneth bør se den (§ 7).

## 2. Hvor bor skillet?

**To steder i lista, ett i dokumentet, ett i PDF-en.** Hvert har en egen jobb:

| Sted | Jobb | Uten det |
|---|---|---|
| **Segment over lista** | Forklarer ikonet med ord og gir filteret i ett klikk, med antall | Ikonet måtte læres |
| **Ikon i Prefix-cellen** | Skillet synlig i «Alle», der man faktisk står | Kontraktssaker drukner når segmentet står på «Alle» |
| **Linje i dokumentvisningen** | Dokumenter åpnes fra innboks, varsel og lenke, ikke bare fra lista | Den som kommer via varsel ser ikke klassen |
| **Linje i PDF-topp** | Arkivkopien bærer klassen (flateparitet) | PDF-en sier mindre enn skjermen |

**Avvist:** chip/merkelapp med tekst i raden (for bredt for den tette lista), egen farge på raden (amber er nå «noen må ta stilling», jf. `ui-standarder § Feltstatus`; blå/grønn/rød er status), sortering med kontraktssaker øverst (bryter sortering på frist og nummer), eget filter i filterpanelet (skjult bak et klikk, så skillet blir usynlig).

## 3. Tåler den tette lista et signal til?

**Ja, fordi signalet ikke tar plass som ikke allerede finnes:**
- Ikonet står i **den faste Prefix-kolonnen**, foran prefikset. Vanlige rader får et tomt 14 px-felt, så prefiksene står på linje.
- **Ingen farge.** Ikonet er `gray-700`, samme språk som ankeret på flytkortet (`dokumentflyt/page.tsx:369`). Formen bærer signalet, ikke fargen.
- Segmentet står på filterlinja, ved siden av søk.
- **Ingenting må vike.**

**Grense:** segmentet vises **bare når prosjektet har minst én mal med `subdomain = "kontrakt"`**. Prosjekter uten kontraktssaker ser ingen endring. Det er det renest mulige UI-et.

## 4. Skal dokumentvisningen merkes?

**Ja, med én linje over tittelen:** `⚖ Kontraktssak · VAR-001`. Grå tekst, ingen boks, ingen farge (tavle 2). Grunn: halvparten av åpningene kommer ikke via lista. Linja erstatter dagens prefiks-nummer-visning på samme plass, så den ikke tar ny høyde (kodeagenten verifiserer at plassen finnes; ⚠️ umålt).

**PDF:** topplinjen får `Kontraktssak` foran dokumentnummeret. Ingen annen endring.

## 5. Hva heter det?

**Kontraktssak.** Vurderte alternativer:

| Ord | Hvorfor ikke |
|---|---|
| Kontraktsdokument | 🔴 **Kolliderer med NS 8405/8407**: «kontraktsdokumentene» er dokumentene som *utgjør* kontrakten (avtaledokument, beskrivelse, tegninger). En entreprenør leser ordet feil |
| Godkjenning | Opptatt (ubrukt modell, fremtidig type) |
| Varsel | Navnet på én mal; krav og svar er ikke varsler |
| Endringsmelding | Proadms ord, og for smalt: svikt i medvirkning er ikke en endring man melder |
| Krav | For smalt: varselet kommer før kravet |
| **Kontraktssak** | ✅ Paraply for varsel, krav og svar. En *sak* har et forløp (varsel → krav → svar), som er nettopp det runde 2 skal modellere. Tåler at en Proadm-endringsmelding blir én kontraktssak. Ledig i i18n og docs (0 treff) |

Nøkkel i data: `kontrakt`. Kort form på mobil der plassen er trang: **Kontrakt** (chip).

## 6. Spesifikasjon for kodeagent

### Data og API (ingen DB-migrering)
1. `packages/db/prisma/schema.prisma`: oppdater kun **kommentaren** på `subdomain`: `"avvik" | "sja" | "ruh"` ved domain=hms · `"kontrakt"` ved domain=bygg.
2. `apps/api/src/routes/mal.ts:421`: utvid enum med `"kontrakt"`. `valideerSubdomainCategory` (`:171`): `kontrakt → oppgave`, og **avvis `kontrakt` når domain = hms** (klartekst).
3. `firmamal.ts` godtar allerede fri streng (`:299`, `:335`). `bibliotek.ts` / hent-fra-arkiv: **mål** om `subdomain` følger med ved kopi; følger den ikke, rett det.
4. Oppgave-lista (`oppgave.ts`, `hentForProsjekt`): ta med `template.subdomain` i select. **Ikke endre** `domainFilter` (`:157-159`) eller tilgangsfilteret.
5. 🔴 **HMS-lesere må ikke tolke `subdomain != null` som HMS.** Grep alle lesere av `subdomain` i web, mobil og api (i dag bl.a. `hms.ts`, `MalListe.tsx:338`) og bekreft at hver av dem også krever `domain === "hms"`. Meld hver som ikke gjør det.

### Web
6. **Mal-dialogen** (`MalListe.tsx`, opprett + rediger, category = oppgave): radiogruppe «Type» med *Oppgave* (default) / *Kontraktssak*, med forklaringslinje (tavle 3). Ved rediger av mal med dokumenter: linja «Gjelder også de N dokumentene som finnes fra denne malen. Tilgang og flyt endres ikke.» Ingen bekreftelsesmodal; endringen er reversibel.
7. **Oppgave-lista** (`[prosjektId]/oppgaver/page.tsx`): segmentkontroll *Alle (n) · Oppgaver (n) · Kontraktssaker (n)* på filterlinja, vist kun når ≥ 1 kontraktssak-mal finnes i prosjektet. Tallene er antall i gjeldende øvrige filtre. Valget huskes i økten (samme mønster som andre listefiltre; ikke localStorage/DB i runde 1).
8. Prefix-cellen: `Scale` (lucide) 14 px `text-gray-700` foran prefikset for kontraktssaker, `aria-label` = «Kontraktssak», `title`-tooltip samme tekst. Vanlige rader: tom 14 px plassholder.
9. **Dokumentvisningen** (oppgave-detalj): linja `⚖ Kontraktssak · <PREFIKS-NR>` (tavle 2).

### Mobil
10. Oppgavelista: chip-rad *Alle · Oppgaver · Kontrakt* med antall (tavle 4), samme vilkår som web. Ikon foran dokumentnummer i kortet. Detalj: samme linje som web.

### PDF
11. Arkiv-PDF topplinje: «Kontraktssak» foran dokumentnummeret for disse malene.

### i18n
12. Nye nøkler (nb + en, deretter `generate.ts --only`): `dokumentklasse.kontraktssak`, `dokumentklasse.kontraktssaker`, `dokumentklasse.kontraktKort`, `dokumentklasse.alle`, `dokumentklasse.oppgaver`, `mal.type.oppgave.forklaring`, `mal.type.kontraktssak.forklaring`, `mal.type.gjelderEksisterende`.

### Paritetsmatrise (SAMARBEIDSREGLER § flateparitet)

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| **Oppgave** | ✅ segment + ikon + detaljlinje | ✅ chip + ikon + detaljlinje (feltarbeid: bas registrerer varsel på byggeplass) | ✅ topplinje |
| **Sjekkliste** | ❌ gjelder ikke: en kontraktssak har en mottaker som skal svare = oppgave-form. Mal-dialogen tilbyr ikke typen for sjekkliste | ❌ samme grunn | ❌ samme grunn |
| **HMS** | ❌ gjelder ikke: HMS har egen `domain`; API avviser kombinasjonen | ❌ | ❌ |

### Funksjonsinventar (kodeveier som røres)
- `domainFilter` i `oppgave.ts`: **BEVART** uendret.
- `byggDokumentTilgangsFilter` (`tilgangskontroll.ts`): **BEVART**, ikke rørt.
- `valideerSubdomainCategory`: **UTVIDET**, eksisterende avvik/sja/ruh-regler uendret.
- HMS-fanenes `subdomain`-enum (`hms.ts:191, :312`): **BEVART**, ikke utvidet.

### Akseptkriterier
- Kenneths VAR-mal settes til Kontraktssak med ett valg; VAR-001 vises straks med ikon i lista, i detalj og i PDF.
- En bruker med kun gruppetilgang `["bygg"]` ser nøyaktig de samme dokumentene før og etter.
- Prosjekt uten kontraktssak-maler: ingen synlig endring i Oppgaver.
- Segmenttallene summerer: Oppgaver + Kontraktssaker = Alle.
- **Stille tomhet (c):** en test som **feiler** hvis oppgave-lista ikke leverer `template.subdomain` for en kontraktssak-mal. **Integrasjonstest mot DB, ikke mock** (jf. § GATE-TALL 2026-09-15).
- Designgate: skjermbilder av tavle 1–4-tilstandene på test før lukking.

### Utenfor scope
Ny tabell eller kolonne · `domain = "kontrakt"` · egen navigasjonsflate · tilgangsendring · Godkjenning-modellen · Proadm · endring av bundet flyt · rimelighetssjekken bundet/fri i malbyggeren.

## 7. Gate-spørsmål til Kenneth

1. **Godkjenner du `subdomain = "kontrakt"` som kilde i runde 1?** Det er ingen skjemaendring, men det utvider betydningen av en kolonne som i dag bare brukes for HMS. Alternativet er `domain`, som endrer hvem som ser dokumentene. Det mener jeg hører hjemme i runde 2, som en bevisst tilgangsbeslutning.
2. **Godkjenner du ordet «Kontraktssak»?**

## 8. Hva runde 2 arver

| Runde 1 | I runde 2 |
|---|---|
| `subdomain = "kontrakt"` på malen | Migreres til `domain = "kontrakt"` med tilgangsvedtak |
| Ordet «Kontraktssak», ikonet, detaljlinja, PDF-linja | Beholdes |
| Mal-dialogens typevalg | Beholdes |
| Segmentet i Oppgaver | **Fjernes**: kontraktssakene flytter til egen flate (samme mekanisme som HMS, `oppgave.ts:159`) |

## 9. Tillegg: Proadm-endringsmeldinger og «godkjenning» (Kenneth 2026-09-17)

> **Kenneth, ved gaten:** *«hva gjør vi med godkjenning når proadm aksepterer å bygge endringsmelding
> levert fra dem inn i sitedoc → den skal ha samme egenskaper»*

**Status:** retning for runde 2, ikke vedtak. Proadm-dialogen er ikke tatt, og vedtakene om at ingenting
går tilbake til Proadm står (bestillingen 2026-09-17). Ingenting her bygges i runde 1.

### Svar: én klasse, to innganger

En endringsmelding fra Proadm **er en kontraktssak**. Den blir ikke en egen type. Den får samme egenskaper
**fordi egenskapene bor på malen**, ikke på hvordan dokumentet ble opprettet:

| | Opprettet i SiteDoc | Levert fra Proadm |
|---|---|---|
| Mal | Firmaets egen (f.eks. «Varsel») med `subdomain = "kontrakt"` | En systemmal «Endringsmelding (Proadm)» med samme klasse |
| Klasse, ikon, lister, PDF | Kontraktssak | Kontraktssak, likt |
| Flyt | Firmaets valg | Bundet flyt (Kenneths intensjon: «behandles kun i denne flyten») |
| Forskjell | – | **Kilde-linje** i dokumentvisningen: «Fra Proadm · ref. <nr>». Samme proveniens-mønster som Kontakter (`kp-kontakter-ia-svar-fabel-2026-09-08.md`) |

**Hvorfor ikke egen type:** to typer for samme juridiske sak ville gitt to lister, to sett regler og et
valg brukeren ikke kan ta riktig («kom denne fra Proadm, eller skrev bas den?»). Det brukeren trenger å se,
er *at* det er en kontraktssak og *hvor* den kom fra. Det er én klasse og én kilde-linje.

### Hva «godkjenning» da er

**Godkjenning er det som skjer I en kontraktssak, ikke en type ved siden av den.** Det følger ordet slik
CLAUDE.md allerede har låst det: *Godkjenning = entreprenør får byggherre til å godta kostnad →
Dokumentflyt-modul.* Det er nettopp forløpet en kontraktssak har.

| Ord | Betyr | Eksisterer som |
|---|---|---|
| **Kontraktssak** | Typen: varsel, krav eller endringsmelding etter kontrakten | Runde 1: `subdomain`. Runde 2: `domain` |
| **Godkjenner** | Rollen i flyten | `DokumentflytMedlem.rolle = "godkjenner"` (finnes) |
| **Godkjent** | Utfallet | Dokumentstatus `approved` (finnes) |
| **Godkjenning** (modellen) | Ubrukt tabell fra mai | Se under |

**Godkjenning-modellen i runde 2:** feltene er det en kontraktssak mangler for å bære Proadm:
`byggherreRef`, `externalCostObjectId`, `godkjentVed`, `godkjentAvUserId`, `bestillerFaggruppe` og
`utforerFaggruppe`. **Anbefalt retning:** modellen blir *kontraktssakens tilleggsdata* (én rad per
kontraktssak), ikke en parallell dokumenttype med egen liste. Om den omdøpes eller beholder navnet,
avgjøres i runde 2 sammen med tilgangsvedtaket. Navnet «Godkjenning» på en tabell som *ikke* er en
godkjenning er en felle, og den bør ryddes da.

### Hva runde 1 må ta hensyn til nå

**Ingenting ekstra.** Runde 1-designet tåler dette: klassen sitter på malen, ikonet og ordet er
kildeuavhengige, og en systemmal kan få samme `subdomain` uten endring. Det eneste som ville brutt det,
er om runde 1 hadde utledet klassen fra *hvem som skrev* dokumentet eller *hvilken flyt* det gikk i.
Det gjør den ikke.
