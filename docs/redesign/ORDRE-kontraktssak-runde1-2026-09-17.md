# Ordre: Kontraktssak runde 1 (visuelt skille i Oppgaver, klassen erklært på malen)

**Til:** kodeagent (redesign-rollen; cowork velger worktree og branch, forslag `feat/kontraktssak-runde1` fra `origin/develop`)
**Fra:** design-rollen (overtatt etter Fabel) · **Skrevet:** 2026-09-17
**Spor:** plan-sporet. Piloten starter denne måneden.
**Status:** FERDIGSKREVET, ikke gitt. Cowork gater mot kode før relay.
**Designgrunnlag (gatet av Kenneth 2026-09-17):** `docs/redesign/designnotat-kontraktssak-runde1-2026-09-17.md`
**Fasit å bygge mot:** `docs/redesign/mockups/Kontraktssak Runde1 Mockup/` (4 tavler; åpne `.dc.html` i nettleser) · Design-artefakt https://claude.ai/artifact/ARd4V9oRRmuHr7MGXr9yPV

🔴 **Cowork:** designnotatet og mockup-mappa må være **committet** før denne ordren gis. Ellers finnes de ikke i agentens worktree.

---

## Bakgrunn

Kenneth bygde en bundet flyt «Varsel» og opprettet VAR-001: kontraktsmateriale etter NS 8405/8407
(varsel om endring, svikt i byggherres medvirkning, vederlagsjustering). I Oppgaver står det med samme
vekt som et befaringsnotat. **Runde 1** skal gjøre skillet synlig uten skjemaendring. **Runde 2**
(egen type, egen flate, Proadm) kommer etter piloten og skal **arve** alt i denne runden, bortsett fra
segmentvalget.

**Klassen heter «Kontraktssak».** Den erklæres **på malen**: `ReportTemplate.subdomain = "kontrakt"`.
Ikke prefiks (fri tekst), ikke bundet flyt (mal ↔ flyt er mange-til-mange), ikke `domain` (styrer
gruppetilgang og er låst når malen har dokumenter). Full begrunnelse i designnotatet § 1.

## Kodeverifisert av design-rollen (2026-09-17, develop). Stikkprøv før du bygger

| Påstand | Kilde |
|---|---|
| `subdomain` er nullable TEXT uten CHECK-constraint | `packages/db/prisma/migrations/20260526200000_report_template_subdomain_hms_synlighet` |
| `mal.ts` validerer `subdomain` med enum `["avvik","sja","ruh"]` | `apps/api/src/routes/mal.ts:421`, `valideerSubdomainCategory` `:171` |
| `mal.ts` blokkerer skifte av **category/domain** når dokumenter finnes, **ikke** subdomain | `mal.ts` rundt `:444-460` |
| `firmamal.ts` godtar fri streng for subdomain | `firmamal.ts:299`, `:335` |
| Tilgangsfilteret leser `template.domain`, ikke `subdomain` | `apps/api/src/trpc/tilgangskontroll.ts:1325-1345` |
| Oppgave-lista ekskluderer HMS på `domain` | `apps/api/src/routes/oppgave.ts:157-159` |
| `hentForProsjekt` inkluderer hele `template` (alle skalarfelt) | `oppgave.ts:179`. ⚠️ Verifiser at `subdomain` faktisk når klienten |
| HMS-rutene har egen subdomain-enum | `apps/api/src/routes/hms.ts:191`, `:312` |
| Web-detalj formaterer nummer med prefiks | `apps/web/src/app/dashbord/[prosjektId]/oppgaver/[oppgaveId]/page.tsx:538` |
| Mobil-liste formaterer nummer | `apps/mobile/app/oppgave/index.tsx:107` |
| i18n-navnerommet `dokumentklasse.*` er ledig | `packages/shared/src/i18n/nb.json` (0 treff) |

**Umålt, du måler i steg 0:** om `subdomain` følger med ved lån og «Hent fra arkiv» (`bibliotek.ts:185`
kopierer `domene`); hvor arkiv-PDF-ens topplinje bygges (`apps/api/src/services/arkiv/`); om
dokumentvisningen på web og mobil har plass til linja uten ny høyde.

---

## Steg 0: mål før du bygger (rapporter i diff-klar-meldingen)

1. **Alle lesere av `subdomain`** i api, web, mobil og shared. For hver: krever den også `domain === "hms"`,
   eller tolker den `subdomain != null` som HMS? **Hver leser som ikke krever domain = funn. Meld dem før
   du retter.** Kjente: `hms.ts`, `MalListe.tsx:338`, `modul.ts:112/401`.
2. **Lån og «Hent fra arkiv»:** følger `subdomain` med når en prosjektmal kopieres fra firma- eller
   SiteDoc-arkivet? Følger den ikke med, er det en del av denne ordren å rette det.
3. **Arkiv-PDF topplinje:** fil og funksjon.

## Endringer

### A. Data og API (ingen DB-migrering, ingen ny kolonne)

1. `schema.prisma`: **kun kommentaren** på `subdomain` →
   `// "avvik" | "sja" | "ruh" ved domain="hms" · "kontrakt" ved domain="bygg"`.
2. `mal.ts:421`: enum utvides med `"kontrakt"`.
3. `valideerSubdomainCategory`: `kontrakt → oppgave`. **Ny regel:** `subdomain = "kontrakt"` sammen med
   `domain = "hms"` eller `category = "hms"` avvises med klartekst («Kontraktssak kan ikke være HMS»).
   Eksisterende avvik/sja/ruh-regler uendret.
   🔴 **Tillegg 2026-09-17** (etter coworks innvending, `svar-kontraktssak-domain-vs-subdomain-fabel-2026-09-17.md`
   § 3): paret `(domain, subdomain)` får **én eier i kode** — en tabell over lovlige kombinasjoner som
   valideringen leser, ikke en kommentar:
   ```ts
   const LOVLIG_SUBDOMAIN: Record<string, readonly string[]> = {
     hms: ["avvik", "sja", "ruh"],
     bygg: ["kontrakt"],
     kvalitet: [],
   };
   ```
   Ugyldig kombinasjon avvises med klartekst. Skjemakommentaren på `subdomain` peker på funksjonen.
   Unit-test per kombinasjon, både lovlige og ulovlige.
4. Oppgave-lista og oppgave-detalj leverer `template.subdomain` til web og mobil (steg 0 viser om det
   allerede skjer).
5. Mobil: den lokale SQLite-malen må bære `subdomain` hvis den ikke gjør det. **Meld før** du legger til en
   lokal kolonne; det er en lokal migrering.
6. Rettelse fra steg 0.2 hvis nødvendig.

### B. Web

7. **Mal-dialogen** (`apps/web/src/app/dashbord/oppsett/produksjon/_components/MalListe.tsx`, opprett og
   rediger, kun `category = "oppgave"`, ikke HMS): radiogruppe **Type** med to valg (tavle 3):
   - *Oppgave* (default): «Arbeid som skal utføres, kontrolleres eller følges opp.»
   - *Kontraktssak* med `Scale`-ikon: «Varsel, krav eller svar etter kontrakten. Vises merket i Oppgaver.»
   - Når valgt på en mal med dokumenter: linja «Gjelder også de N dokumentene som finnes fra denne malen.
     Tilgang og flyt endres ikke.» **Ingen bekreftelsesmodal**; valget er reversibelt.
   - Lagrer `subdomain: "kontrakt"` eller `null`.
8. **Oppgave-lista** (`[prosjektId]/oppgaver/page.tsx`), tavle 1:
   - Segmentkontroll på filterlinja, til venstre for søk: **Alle (n) · Oppgaver (n) · Kontraktssaker (n)**.
     `Scale`-ikon foran «Kontraktssaker». Aktivt segment: `bg-blue-50 text-sitedoc-primary font-medium`.
     `role="group"`, `aria-pressed` på knappene.
   - **Vises kun** når prosjektet har minst én mal med `subdomain = "kontrakt"`. Ellers ingen endring.
   - Tallene er antall etter øvrige aktive filtre. Oppgaver + Kontraktssaker = Alle.
   - Valget lever i komponentens tilstand (økt). Ikke localStorage, ikke DB.
   - **Prefix-cellen** (fast kolonne): lucide `Scale` 14 px `text-gray-700` foran prefikset, `aria-label` og
     `title` = «Kontraktssak». Vanlige rader: tom 14 px plassholder, så prefiksene står på linje.
   - **Ikke:** ny kolonne, chip i raden, farge på raden, endret sortering.
9. **Dokumentvisningen** (`[oppgaveId]/page.tsx`), tavle 2: linja `⚖ Kontraktssak · <prefiks-nr>` over
   tittelen, `text-sm text-gray-700`, «Kontraktssak» `font-medium`. Den skal stå der prefiks-nummeret vises
   i dag. Tar den ny høyde (steg 0.4): meld med skjermbilde før du velger plassering.

### C. Mobil

10. **Oppgavelista** (`apps/mobile/app/oppgave/index.tsx`), tavle 4: chip-rad **Alle · Oppgaver · Kontrakt**
    med antall. Samme vilkår som web (vises kun når en kontraktssak-mal finnes). Min. trykkflate 36 pt høyde.
    `Scale` 14 pt foran dokumentnummeret i kortet.
11. **Detalj** (`apps/mobile/app/oppgave/[id].tsx` eller tilsvarende): samme linje som web.
12. **Leveringsvei:** OTA etter prod-deploy av api-endringen, samme rekkefølge som SJA 06.09.

### D. Arkiv-PDF

13. Topplinjen: «Kontraktssak» foran dokumentnummeret for dokumenter fra en kontraktssak-mal. Ingen annen
    endring i PDF-en.

### E. i18n

14. Nye nøkler i `nb.json` + `en.json`, deretter
    `pnpm dlx tsx src/i18n/generate.ts --only <nøklene>` fra `packages/shared`:
    `dokumentklasse.kontraktssak` · `dokumentklasse.kontraktssaker` · `dokumentklasse.kontraktKort` ·
    `dokumentklasse.alle` · `dokumentklasse.oppgaver` · `mal.type.tittel` · `mal.type.oppgave` ·
    `mal.type.oppgaveForklaring` · `mal.type.kontraktssakForklaring` · `mal.type.gjelderEksisterende` ·
    `mal.type.ikkeHms` (API-feilmeldingen). **Ingen hardkodet norsk tekst**, heller ikke i PDF.

## Paritetsmatrise

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| **Oppgave** | ✅ B.7–9 | ✅ C.10–11 (bas registrerer varsel i felt) | ✅ D.13 |
| **Sjekkliste** | ❌ gjelder ikke: en kontraktssak har en mottaker som skal svare, altså oppgave-form. Typevalget tilbys ikke | ❌ samme | ❌ samme |
| **HMS** | ❌ gjelder ikke: egen `domain`. API avviser kombinasjonen (A.3) | ❌ | ❌ |

## Funksjonsinventar (kodeveier som røres; alle eksisterende funksjoner BEVART)

| Kodevei | Vedtak |
|---|---|
| `oppgave.ts` `domainFilter` (`:157-159`) | **BEVART uendret** |
| `tilgangskontroll.ts` dokumentfilter | **BEVART, ikke rørt** |
| `valideerSubdomainCategory` avvik/sja/ruh | **BEVART**, kun utvidet |
| `hms.ts` subdomain-enum | **BEVART, ikke utvidet** |
| `MalListe.tsx` HMS-valg og synlighet | **BEVART**; typevalget gjelder kun oppgave-maler |
| Bundet flyt (vern, meny-gate, anker) | **BEVART, ikke rørt** |

🔴 Oppdager du en funksjon i disse kodeveiene som ordren ikke nevner: **stopp og meld** (SAMARBEIDSREGLER
§ Koden er aldri frosset, punkt 3).

## Krav og tester

- **Stille tomhet (c):** integrasjonstest **mot DB** (`*.integration.test.ts`, ikke mock) som **feiler** hvis
  oppgave-lista ikke leverer `template.subdomain = "kontrakt"` for et dokument fra en kontraktssak-mal.
- **Tilgang uendret:** integrasjonstest der en bruker med kun gruppetilgang `domains: ["bygg"]` ser
  **samme** dokumentsett før og etter at malen settes til kontraktssak.
- **Validering:** unit-test for `valideerSubdomainCategory` med `kontrakt` + `oppgave` (ok), `kontrakt` +
  `sjekkliste` (avvist), `kontrakt` + `hms` (avvist).
- **Regel 10:** `pnpm install --frozen-lockfile` + `prisma generate` (alle db-pakker) +
  `pnpm --filter @sitedoc/web build` + mobil typecheck + `pnpm test` fra rot **før** diff-klar.
- **Gate-tall** i formatet `unit-mock: n · unit-ren: n · integrasjon: n · e2e: n` (§ GATE-TALL 2026-09-15).

## DoD

1. Kenneths VAR-mal kan settes til Kontraktssak med ett valg i mal-dialogen på test. VAR-001 vises straks med
   ikon i lista, linje i detalj (web og mobil) og «Kontraktssak» i PDF-topplinjen.
2. Prosjekt uten kontraktssak-maler: ingen synlig endring i Oppgaver (web og mobil).
3. Segmenttallene summerer.
4. Begge integrasjonstestene kjører i CI og er grønne.
5. **Designgate:** skjermbilder til design-rollen fra test: tavle 1 (Alle + Kontraktssaker valgt), tavle 2,
   tavle 3 (rediger VAR-malen), tavle 4 (mobil, Alle + Kontrakt), side 1 av PDF-en. **Maks 6 bilder.**
   Ikke lukket før design-rollen har godkjent.
6. Rapport i `/Users/kennethmyrhaug/Documents/Programmering/SiteDoc/relay/inbox-cowork.md` med steg 0-funn,
   gate-tall og skjermbildestier.

## Eksplisitt utenfor scope

- Ny tabell eller kolonne i Postgres · `domain = "kontrakt"` · endring av tilgang
- Egen navigasjonsflate for kontraktssaker
- Godkjenning-modellen · Proadm (kilde-linje, systemmal, import)
- Rimelighetssjekk «kontraktssak i fri flyt» i malbyggeren
- Endringer i bundet flyt
- Typevalg for sjekkliste- og HMS-maler
- Prod-deploy og OTA (cowork og Kenneth eier leveransen)
