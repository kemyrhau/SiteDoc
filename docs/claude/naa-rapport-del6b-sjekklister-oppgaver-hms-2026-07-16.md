# NÅ-RAPPORT del 6b — Sjekklister / Oppgaver / HMS / Kontrollplan

> Kodeverifisert nå-rapport til fabels delplan. **Kun lesing** — ingen kode/branch/commit rørt. Fabels ordre 2026-07-16, levert av redesign-Opus.
> **Ingen løsningsforslag** (det er fabels delplan-steg). Kun tilstand + hvordan målt.

## Metode og gyldighet

- Arbeidstre: `feat/georef-panel-v2` @ `e91f10c4`. **Verifisert:** `git merge-base --is-ancestor e91f10c4 origin/develop` → sann; `git diff --name-only origin/develop...HEAD` treffer **ingen** sjekkliste-/oppgave-/HMS-/kontrollplan-/maler-fil → **treet == develop for hele klyngen**. `origin/develop`-tupp = `fb25d514` (docs).
- Alle premisser målt mot kode (grep/git/schema), ikke docs. `[MÅLT]` = verifisert med fil:linje/grep. `[MISTANKE]` = ikke kjøre-/repro-verifisert. Fravær ført med ❌ + hva som ble sjekket.
- **Negativ kontroll kjørt** der fravær hevdes (f.eks. HMS-mobil: `find` + tre uavhengige grep ga tomt → reelt fravær, ikke død sjekk).
- Grunnlag: 3 dyp-lesings-agenter (Sjekklister / Oppgaver / HMS+Kontrollplan) + egne målinger på datamodell, søkeregister, mal-dualitet, offline-tabeller, i18n-tellinger, git-alder.

---

## 0. TVERRGÅENDE FUNN — én datamodell-ryggrad (det viktigste)

**Sjekklister, Oppgaver og HMS er IKKE tre moduler — de er tre visninger av ÉN mal-modell.** [MÅLT, `schema.prisma:810`]

`ReportTemplate` er felles mal, diskriminert av tre felt:
- `category` — `"sjekkliste" | "oppgave"` (default sjekkliste), `schema.prisma:816`
- `domain` — `"bygg" | "hms" | "kvalitet"` (default bygg), `:817`
- `subdomain` — `"avvik" | "sja" | "ruh"` (kun `domain="hms"`), `:818`
- `hmsSynlighet` — `"privat" | "apen"` (kun `domain="hms"`), `:819`

Utfylte instanser er to nesten-tvillingmodeller:
- **`Checklist`** (`schema.prisma:932`) — `templateId → ReportTemplate`, svar i **`data Json`** (ikke relasjonelt)
- **`Task`** (`schema.prisma:981`) — `templateId → ReportTemplate`, svar i **`data Json`**, pluss `subject/priority/dueDate/drawingId/positionX,Y/checklistId/checklistFieldId`

HMS eier ingen egen tabell — den ruter til de samme to: [MÅLT `hms.ts:182–246`]
- HMS-**avvik** → `Task` (`domain=hms, subdomain=avvik`)
- HMS-**SJA** → `Checklist` (`subdomain=sja`)
- HMS-**RUH** → `Task` (`subdomain=ruh`, oppgave-flyt, vedtatt 2026-05-29)

Felles infrastruktur på tvers: én polymorf `DocumentTransfer` (`taskId?/checklistId?/godkjenningId?`) for all status-/flyt-historikk; **én** status-maskin `isValidStatusTransition` (`packages/shared/src/utils/index.ts:72`) uten dokumenttype-parameter — samme graf for oppgave, sjekkliste OG godkjenning; `ChecklistChangeLog` (`:1292`) og `TaskChangeLog` (`:1309`) er felt-for-felt identiske.

**Konsekvens for delplan:** enhver endring i «utfylling» (felt-rendering, svartyper, flyt, endringslogg, offline) treffer alle tre samtidig via `RapportObjektRenderer` + de to skjema-hookene. Dette er både en risiko (én endring, tre flater) og en mulighet (én god abstraksjon løfter alt).

**Svar lagres som JSON-blob, ikke rader** [MÅLT — ❌ ingen `ChecklistItem`/`TaskItem`-modell finnes; `grep "^model .*Item"` tomt]. `Checklist.data`/`Task.data` er `Record<objektId, {verdi, kommentar, vedlegg}>`. Følge: **ingen DB-spørring/aggregering/indeksering på feltverdier er mulig** — all filtrering på svar skjer klientside i minnet (`sjekklister/page.tsx:448–498`, `oppgaver/page.tsx` verdikolonner). Skalerer dårlig ved mange dokumenter/felt.

---

## a. RUTEINVENTAR

Linjer = `wc -l`. Sist endret = `git log -1 --date=short` på fila. Cluster-alder = siste commit som rørte mappa.

### Web (alle `"use client"`, App Router)

| Rute | Fil | Linjer | Sist endret | Rolle |
|---|---|---:|---|---|
| Sjekkliste-liste | `[prosjektId]/sjekklister/page.tsx` | 673 | 2026-05-27 | Tabell, kolonnevelger, dyn. filter, bulk slett/print, opprett-fra-mal |
| Sjekkliste-utfylling | `[prosjektId]/sjekklister/[sjekklisteId]/page.tsx` | 742 | 2026-05-05 | Utfylling + flyt + endringslogg + tidslinje + oppgave-fra-felt |
| Sjekkliste-print | `[prosjektId]/sjekklister/skriv-ut/page.tsx` | 236 | 2026-05-30 | Batch-print, **hardkodet maks 10** (q0–q9) |
| Oppgave-liste | `[prosjektId]/oppgaver/page.tsx` | 850 | 2026-05-27 | Dalux-stil tabell, verdikolonner fra mal-JSON, ny-fra-mal |
| Oppgave-utfylling | `[prosjektId]/oppgaver/[oppgaveId]/page.tsx` | 641 | 2026-05-30 | Detalj/utfylling + kommentarer + flyt + tidslinje |
| Prosjekt-HMS | `[prosjektId]/hms/page.tsx` | 357 | 2026-05-29 | 3 faner (avvik/sja/ruh) + statistikk, «Ny»-dropdown → oppretter Task/Checklist |
| Firma-HMS | `firma/hms/page.tsx` | 434 | 2026-05-29 | Tverr-prosjekt oversikt, filter, hurtigbehandling-modal |
| Kontrollplan | `[prosjektId]/kontrollplan/page.tsx` | 439 | **2026-04-23** | Matrise/liste, milepæler, import fremdriftsplan, sluttrapport-PDF |
| Maler (prosjekt) | `[prosjektId]/maler/page.tsx` | 162 | 2026-05-30 | Enkel prosjekt-mal-liste (`manage_field`), «arbeidsflate» |
| Sjekklistemaler | `oppsett/produksjon/sjekklistemaler/page.tsx` (+`[id]`) | 33 (+74) | 2026-05-30 | Tynn wrapper → `MalListe kategori="sjekkliste"` |
| Oppgavemaler | `oppsett/produksjon/oppgavemaler/page.tsx` (+`[id]`) | 33 (+70) | 2026-05-30 | Tynn wrapper → `MalListe kategori="oppgave"` |
| Malbygger | `components/malbygger/MalBygger.tsx` | — | **2026-04-17** | Felles mal-editor (stalest kode i klyngen) |
| Legacy-redirects | `prosjekter/[id]/{sjekklister,oppgaver,maler,...}` | 6 hver | 2026-07-05 | K9 `redirect()` → kanonisk `[prosjektId]/...`. Ingen logikk. |

Print-enkeltdokument ligger utenfor klyngemappene: `/utskrift/sjekkliste/[id]` og `/utskrift/oppgave/[oppgaveId]`, åpnes via `window.open(...?print=true)` ([sjekklisteId]:528, [oppgaveId]:520). Ikke lest i detalj.

### Mobil (Expo Router)

| Skjerm | Fil | Linjer | Sist endret | Rolle |
|---|---|---:|---|---|
| Sjekkliste-liste | `app/sjekkliste/index.tsx` | 169 | 2026-06-24 | Flat FlatList, byggeplass-chip, mal→opprett. **Ingen filter.** |
| Sjekkliste-utfylling | `app/sjekkliste/[id].tsx` | 1154 | 2026-05-25 | Utfylling + flyt + lokasjonsmodal + PDF-deling + logg |
| Oppgave-liste | `app/oppgave/index.tsx` | 151 | 2026-04-16 | Flat FlatList. **Ingen filter, ingen «ny»-knapp.** |
| Oppgave-utfylling | `app/oppgave/[id].tsx` | 907 | 2026-05-28 | Detalj/utfylling + kommentarer + flyt |
| Oppgave-fra-tegning | `src/components/OppgaveModal.tsx` | 367 | 2026-05-02 | Opprett oppgave FRA tegning (X/Y). Eneste opprett-vei på mobil. |
| Skjema-hook (sjekk) | `src/hooks/useSjekklisteSkjema.ts` | 607 | 2026-04-16 | Offline SQLite-lag |
| Skjema-hook (oppg) | `src/hooks/useOppgaveSkjema.ts` | 628 | 2026-04-16 | Offline SQLite-lag |

**HMS på mobil: ❌ FINNES IKKE.** [MÅLT] `find apps/mobile -path "*hms*"` + `-path "*kontrollplan*"` → tomt. Grep `hms|subdomain|avvik|ruh` i `app/`+`src/` gir kun (1) timer-kommentar «stille avvik-bug», (2) «språkavvik»-kommentar i boks.tsx, (3) `hmsKortNr` i PSI (7-sifret sikkerhets**kort**, ikke HMS-avvik). HMS/SJA/RUH og kontrollplan finnes **ikke** i mobil-appen i det hele tatt.

### API-routere (montert i `trpc/router.ts`)

| Router | Fil | Linjer | Antall prosedyrer |
|---|---|---:|---:|
| sjekkliste | `apps/api/src/routes/sjekkliste.ts` | 1195 | 11 (+ `flytt` @deprecated) |
| oppgave | `apps/api/src/routes/oppgave.ts` | 1372 | 15 (+ `flytt` @deprecated) |
| hms | `apps/api/src/routes/hms.ts` | 588 | 3 (`hentDokumenter`, `hentFirmaOversikt`, `firmaBehandleAvvik`) |
| kontrollplan | `apps/api/src/routes/kontrollplan.ts` | 584 | 16 |
| mal | `apps/api/src/routes/mal.ts` | — | CRUD på `ReportTemplate` + `ReportObject` |

---

## b. DATAMODELL

Se § 0 for ryggraden. Detaljer:

- **`ReportTemplate`** (`:810`) + **`ReportObject`** (`:852`, felt: `type String`, `translations Json` (i18n bygget inn i feltet), `sortOrder`, `required`, `parentId` for nesting/betinget synlighet). Mal-router bruker `ctx.prisma.reportTemplate.*` [MÅLT `mal.ts:44,58,116,179`]. Både `[prosjektId]/maler` OG `oppsett/produksjon/*maler` kaller **samme** `trpc.mal.hentForProsjekt` [MÅLT] — se § g mal-dualitet.
- **`Checklist`** (`:932`): `templateId`, `status default "draft"`, `data Json`, `dokumentflytId`, `bestiller/utforer/eier/recipient`-felter. HMS-sjekklister filtreres UT av vanlig liste via `domain: { not: "hms" }` (`sjekkliste.ts:41–42`).
- **`Task`** (`:981`): som Checklist + oppgave-spesifikke felt. Sletting blokkeres hvis `_count.tasks > 0` (oppgave født fra sjekklistefelt via `checklistId`+`checklistFieldId`).
- **`DocumentTransfer`** (`:1086`): polymorf status-/flyt-historikk (`taskId?/checklistId?/godkjenningId?`).
- **Kontrollplan — EGNE modeller** (`schema.prisma`, 4 stk): `Kontrollplan` (`:1819`, én per projectId+byggeplassId, status utkast→aktiv→godkjent→arkivert), `Milepel` (`:1856`), `KontrollplanPunkt` (`:1891`, → `ReportTemplate` via `sjekklisteMalId`, → `Checklist` via `sjekklisteId @unique`, egen status + `avhengerAvId`), `KontrollplanHistorikk` (`:1968`, audit). Se § g for at `sjekklisteId`-broen aldri populeres.

**Delte modeller:** `ReportTemplate` (sjekkliste/oppgave/HMS + kontrollplan-referanse), `Checklist` (sjekkliste + HMS-SJA + kontrollplan-punkt), `Faggruppe`/`Omrade`/`Byggeplass`/`Drawing`/`Dokumentflyt` bredt.

---

## c. KOMPONENTGJENBRUK OG DUPLISERING

**God gjenbruk [MÅLT]:**
- `@sitedoc/ui`: `Button, Modal, Spinner, EmptyState, StatusBadge, Badge, Table, SearchInput` på tvers.
- Svar-widgetene (OK/IkkeOK/trafikklys/felttyper) er **ikke** duplisert — de bor i delt `RapportObjektRenderer`/`FeltWrapper`, gjenbrukt av sjekkliste+oppgave+HMS.
- HMS-tabeller/visning (`components/hms/tabeller.tsx`, `visning.tsx`) deles av prosjekt- og firma-HMS.

**Duplisert logikk [MÅLT] — betydelig:**
1. **Fire parallelle skjema-hooks:** `useSjekklisteSkjema` og `useOppgaveSkjema`, hver i web- OG mobil-versjon. `hooks/CLAUDE.md` sier eksplisitt «Endringer i useSjekklisteSkjema bør ALLTID speiles i useOppgaveSkjema». Delt kjerne finnes i `@sitedoc/shared` (`erSynlig`, `valider`, rettighet), men innpakningen er kopiert per (dokumenttype × plattform).
2. **Status-utledning** (`minRolle`/`harBallen`/`flytRettighet`) kopiert nesten ordrett web↔mobil: `oppgaver/[oppgaveId]/page.tsx:194–256` == mobil `oppgave/[id].tsx:154–228` (tre `useMemo`-blokker). Samme mønster i sjekkliste.
3. **`FlytIndikator`, `DokumentHandlingsmeny`, `DokumentTidslinje`** finnes som separate web- og mobil-implementasjoner — **ikke** i `@sitedoc/ui`.
4. **Endringslogg-generering** i `oppgave.oppdaterData` er kommentert i koden som «speil av sjekkliste.oppdaterData:374–407» — bekreftet server-side duplisering. `EndringsloggRad`+`formaterVerdi` kopiert web-detalj↔mobil.
5. `sjekkliste.hentTilgjengeligeFlyter` kommentert «Speil av oppgave.hentTilgjengeligeFlyter — samme shape, samme regler».

**Divergens som er BUG, ikke bare duplikat [MÅLT]:**
- **Append-only felt-låsing finnes på web, IKKE på mobil (oppgave).** Web `useOppgaveSkjema` har `låsteFelterRef`/`erFeltLåst`/blokkering i `settVerdi` (web-hook:74,113,183–195). Mobil-hooken har **ingen** slik låsing (søkt hele fila). → Et utfylt/sendt felt kan i prinsippet endres fra mobil, men ikke fra web. Ikke-speilet divergens av nettopp den typen `hooks/CLAUDE.md` advarer mot.

**Filter-standard (vedtatt 2026-05-29) — fem flater, ~fire paradigmer [MÅLT]:**
| Flate | Filter-mekanikk | Følger standard? |
|---|---|---|
| Firma-HMS | `MultiComboks` + `SearchInput` + «Tøm filter» | ✅ (er referanse-impl) |
| Prosjekt-HMS | Én checkbox «Vis alle» (`hms/page.tsx:311–322`) | ❌ |
| Kontrollplan | Tre native `<select>` (`:247–281`) | ❌ |
| Sjekkliste-liste | Egen `KolonneVelger` + inline `dynamiskFilter` (`page.tsx:174–240`) | ❌ (eget system) |
| Oppgave-liste | Samme egne kolonne/filter-system | ❌ |

---

## d. TILSTAND / OFFLINE

**Web — ingen offline, ingen dirty-vakt:**
- Begge skjema-hooks (web) holder `feltVerdier` i React-state, autosave **2s debounce** → `oppdaterData`. `lagreStatus: idle→lagrer→lagret→feil`.
- **Ingen «ulagrede endringer»-vakt** ved navigasjon bort [MÅLT fravær — ingen `beforeunload`/route-guard; web-hook eksporterer ikke `harEndringer`]. Mobil-hooken har `harEndringer` + lagrer i `håndterTilbake`; web har ikke. → Navigasjon under 2s-debounce kan tape siste tastetrykk. [MISTANKE — ikke kjøretestet.]

**Mobil — ekte offline-first [MÅLT]:**
- Drizzle/SQLite: `sjekkliste_feltdata` + `oppgave_feltdata` (`db/schema.ts:13,30`), kolonner: `feltVerdier` (JSON-streng), **`erSynkronisert` boolean**, `sistEndretLokalt`, `sistSynkronisert`.
- Flyt: skriv SQLite umiddelbart (`erSynkronisert=false`) → hvis online, `oppdaterData` → sett `true`. Init leser SQLite først; usynkronisert lokal data prioriteres over server. Auto-synk når nett kommer tilbake.
- Vedlegg i egen kø `opplastings_ko` (`:39–60`, GPS-felter, `status`, `forsok`, `serverUrl`) delt av sjekkliste+oppgave; callback bytter lokal→server-URL i minnet og re-lagrer.
- Server `oppdaterData` gjør **feltvis shallow merge** mot fersk DB (`{...eksisterende, ...input.data}`) — samtidige klienter overskriver ikke hverandres felt, men «siste skriver vinner per felt».

**Målt robusthet-divergens mot timer:** sjekkliste/oppgave-offline bruker en enkel `erSynkronisert` boolean (last-write-wins, **ingen konflikt-tilstand**), mens timer-tabellene bruker 4-tilstands `syncStatus`-enum `pending/synced/conflict/avvist` (`db/schema.ts:116–122`). Felt-relevant siden piloten er mobil-først.

**Kommentar-optimisme: ingen** [MÅLT] — både web og mobil `invalidate` etter server-svar, ingen optimistisk innsetting.

**HMS/Kontrollplan:** ingen dirty-state. Prosjekt-HMS «Ny» oppretter umiddelbart via mutation og navigerer bort til oppgave-/sjekkliste-detalj — selve utfyllingen skjer i den andre modulen. Kontrollplan auto-oppretter plan i `useEffect`, persisterer per dialog-handling (ingen «lagre utkast»-knapp).

---

## e. i18n (TALL — MÅLT via `grep -oE '\bt\('` + manuell JSX-lesning)

| Fil | `t()`-kall | Hardkodet norsk i JSX |
|---|---:|---|
| Sjekkliste-liste `page.tsx` | 45 | 1 (slett-modal-tekst, `:648`) |
| Sjekkliste-utfylling `[sjekklisteId]/page.tsx` | **1** | Mange: «Lagrer…/Lagret/Lagring feilet» (36/44/51), «Sjekklisten ble ikke funnet» (405), «Endringslogg» (713), `title="Skriv ut"` (530) |
| Sjekkliste-print `skriv-ut/page.tsx` | **0** | Alt hardkodet |
| `SjekklisterPanel.tsx` | 5 | «Standard tegning» (79) |
| Oppgave-liste `page.tsx` | 68 | 3 (`alert(...)` :342, «HMS-avvik»-fallback :365, «Ny oppgave» :392) |
| Oppgave-utfylling `[oppgaveId]/page.tsx` | 28 | 1 (status-feil-fallback :299) |
| `OppgaverPanel.tsx` | 9 | 0 |
| Mobil sjekkliste `[id].tsx` | 19 | Flere (lokasjonsmodal 989–1101, «Velg lokasjon» 720) |
| Mobil sjekkliste `index.tsx` | **0** | Alt hardkodet |
| Mobil oppgave `[id].tsx` | 47 | Få |
| Mobil oppgave `index.tsx` | **2** | Prioritet-labels 18–23, «Oppgaver/Henter/Ingen» |
| `OppgaveModal.tsx` | **4** | Mange (prioritet, «Ny oppgave», «Opprett», «Tegning», «Faggruppe», «Fra/Til», Alert-tekster) |
| Prosjekt-HMS `page.tsx` | ~god | `alert(...)` :160, «Ukjent feil» :159 |
| Kontrollplan `page.tsx` | 24 | Flere: KopierDialog delvis (223/231/391/397/409/421), **6 hardkodede kontrollområder** (Fukt/Brann/Konstruksjon/Geoteknikk/Grunnarbeid/SHA, :274–279) |

i18n-nøkler i `nb.json`: `sjekklister.*`=12, `sjekkliste.*`=3, `oppgaver.*`=11, `oppgave.*`=19, `hms.*`=37, `kontrollplan.*`=79–83, `maler.*`=38. `ruh.*`/`sja.*`/`mal.*` = 0 (❌ egne seksjoner finnes ikke — bruker `hms.*`/`maler.*`).

**Mønster:** i18n-dekning er sterkest på liste-visninger (nyeste kode) og svakest på (1) print-sider, (2) mobil-liste-skjermer, (3) mobil `OppgaveModal`, (4) kontrollplan-dialoger og utfyllings-detaljens statusstrenger. Bryter CLAUDE.md § i18n-krav.

---

## f. UX-SVAKHETER

**MÅLT:**
1. **Død søkeboks × 2:** `SjekklisterPanel.tsx:34` og `OppgaverPanel.tsx:33` binder `const [sok,setSok]` til `SearchInput`, men `sok` brukes ALDRI i filtrering. Begge søkefeltene gjør ingenting.
2. **Ikke-klikkbar prioritet i OppgaverPanel** (`:112–126`): status-rader er `<button onClick>`, prioritet-rader er rene `<div>` uten handler — ser like ut, filtrerer ikke. Inkonsistent affordance.
3. **Print hardkodet maks 10** (`skriv-ut:57–66`, q0–q9): velger man >10, printes stille kun de 10 første.
4. **Død «dokumentflyt»-kolonne** i oppgave-liste (`page.tsx:652–655`): valgbar i kolonnevelger, rendrer alltid `—` (reell flyt vises i `flyt`-kolonnen).
5. **Mobil-liste-asymmetri:** mobil sjekkliste + oppgave har flate lister uten status-/prioritet-/byggeplass-filter (web har rikt filter). Mobil oppgave har **ingen opprett-vei fra listen** — kun via tegning (`OppgaveModal`). Web oppretter fra mal-modal, ikke fra tegning. To speilvendte opprettingsmodeller.
6. **HMS-klikkdybde inkonsistens:** prosjekt-HMS «Ny» oppretter og **hopper til en annen modul** (oppgave/sjekkliste-detalj) for utfylling; firma-HMS behandler **inline** i modal. To interaksjonsmønstre for beslektet arbeid.
7. **Filter-fragmentering:** se § c-tabell — fem beslektede flater, ~fire filter-paradigmer.
8. **Glemt terminologi-rename i OppgaveModal** (`:96–125`): bruker fortsatt `arbeidsforlop`/`alleArbeidsforlop` med kode-kommentar som innrømmer glemt callsite fra april-2026-renamen. Faggruppe-utledning divergerer fra web-flyten.
9. **Død kode firma-HMS** (`:427–430`): `{antallAvvik === 0 ? "" : ""}` — begge grener tomme.
10. **Søkeregister-dekning kun på sidenivå [MÅLT]:** alle fire flatene ER søkbare i F-søkemotoren — arvet via `useSokRegistry` → `useSidebarElementer` (`sidebar-elementer.tsx:74/81/88/130`, HMS gated `kreverModul:"hms-avvik"`, kontrollplan `kreverModul:"kontrollplan"`). **Sub-innhold (enkelt-avvik, enkelt-kontrollpunkt, enkelt-sjekkliste) er IKKE indeksert** — kun ruten.
11. **Redesign urørt [MÅLT]:** hele klyngen er 6–12 uker gammel (kontrollplan 23. apr, malbygger 17. apr — stalest). Ingen hub-mønster, ingen sidebar-sone-styling, ingen redesign-tokens i disse sidene. Bekrefter premisset «flatene er urørte».

**MISTANKE (ikke kjøre-/repro-verifisert):**
- Web-utfylling mangler dirty-vakt (§ d) → tap av siste tastetrykk ved rask navigasjon. [MISTANKE]
- Sjekkliste `oppdater` tillater faggruppe-endring kun i `draft` (`sjekkliste.ts:317`), men klient kan sende lokasjon samtidig — kombinert endring post-draft kan avvises helt. [MISTANKE]
- `OppgaveModal` svarer-synk via `useEffect`-kjede (`:128–139`) kan race mot brukervalg; `matchendeArbeidsforlop` i deps men ikke i opprett-body. [MISTANKE]
- Gjennomgående `as unknown as {...}`-casting (TS2589-workaround) i utfyllings-sidene kan skjule feltnavn-feil ved schema-endring. [MISTANKE]
- Kontrollplan slett-punkt/-milepæl: ikke verifisert om ekte modal eller `confirm()`. [MISTANKE]

---

## g. MALER ↔ UTFYLLING, og KONTROLLPLAN vs SJEKKLISTE

**Mal → utfylling [MÅLT]:**
- En sjekkliste/oppgave er en **instans av `ReportTemplate`** (`templateId` FK). Malfeltene (`ReportObject[]`) hentes alltid via `template.include.objects` — de bor aldri på instansen.
- Utfylte verdier lagres i `Checklist.data`/`Task.data` (JSON), nøklet på `objektId`. Koblingen malfelt→svar er «objektId som JSON-nøkkel», **ikke** en FK.
- Opprettelse: velg mal → auto-løpenummer per mal-`prefix` (`aggregate _max.number+1`) → tittel = `input.title || mal.name`. `domain="hms"` → auto-rutes til HMS-gruppe uten faggruppe. `enableChangeLog` på malen slår på endringslogg. Betinget synlighet/nesting/repeatere utledes fra `ReportObject.parentId`+`config` ved rendering, **ikke lagret**.
- Gratisgrense (10 dok/prosjekt) håndheves server-side ved `opprett`, ikke synlig i UI før feilmelding.

**Mal-DUALITET [MÅLT — reell inkonsistens]:** To ulike UI-er/ruter mot **samme** `trpc.mal.*`/`ReportTemplate`:
- `[prosjektId]/maler/page.tsx` (162 l, gated `manage_field`) — enkel «prosjekt-bibliotekvalg», i `dype-sider.tsx:39` merket «arbeidsflate, ikke konfig».
- `oppsett/produksjon/{sjekkliste,oppgave}maler` (via `MalListe`, ~500 l) — rik mal-CRUD, lenker til `MalBygger`, filtrert på `category`.
Begge finnes i søkeregisteret (dype-sider hhv. hub-ruter). Ett datagrunnlag, to innganger, ulik funksjonsrikdom.

**Kontrollplan = eget orkestreringslag OVER sjekklister, IKKE en sjekkliste-variant [MÅLT]:**
1. Egne modeller + egen status-maskin + egen router (16 prosedyrer). Ikke en `domain`-diskriminator slik HMS er.
2. `KontrollplanPunkt.sjekklisteMalId → ReportTemplate` (`:1918`): et punkt = «denne sjekkliste-**malen** skal utføres for dette området, innen denne fristen, av denne faggruppen, avhengig av dette punktet».
3. **Broen punkt→utført sjekkliste er UIMPLEMENTERT [MÅLT fravær]:** FK-en `KontrollplanPunkt.sjekklisteId @unique` (`:1902`) settes **aldri** i noen mutation. `grep sjekklisteId apps/api/src` treffer kun urelatert `mal.ts`. Klienten leser `p.sjekkliste` og routeren selecter den, men ingenting kobler et punkt til en generert sjekkliste. `opprettEllerHent`/`opprettPunkter` lager kun punkt-rader — **ingen `checklist.create`** i routeren (grep tomt). Kontrollplan genererer altså ikke sjekklister; «utfør sjekkliste fra kontrollpunkt» er udefinert i koden jeg leste.

---

## De fire spørsmålene (ordrett)

**1. Hva så du som ikke passet i noen kategori?**
- Den **uimplementerte broen** i kontrollplan (`KontrollplanPunkt.sjekklisteId` finnes i schema + leses i klient/router-select, men skrives aldri). Det er verken en UX-svakhet eller ren datamodell — det er en halvbygd flyt der schemaet lover mer enn koden leverer. Passer i «g» men er egentlig en egen kategori: *død FK / arkitektonisk løfte uten innfrielse*.
- **Mal-dualiteten** (to ruter mot samme `trpc.mal.*`) er verken duplisert kode (samme backend) eller ren rute-redundans (ulik funksjonsrikdom) — en mellomting.
- `ReportObject.translations Json` — i18n er bygget inn i **datamodellen** for mal-felt, parallelt med react-i18next for UI-chrome. To i18n-systemer side om side; passet ikke i «e» (som gjelder UI-strenger).

**2. Hva forkastet du som støy?**
- Alle `prosjekter/[id]/*`-rutene (6-linjers K9-redirects) — reell kode, men null flate-innhold.
- `ios/Pods/**`-treff på «avvik/slist» (boost-bibliotek) — falske grep-treff, filtrert bort.
- `hmsKortNr` i PSI (sikkerhetskort-nummer) — samme bokstaver som HMS-modulen, urelatert; forkastet etter verifisering.
- Server-side hardkodet norsk i `TRPCError`-meldinger — systematisk, men forventet (ikke UI-i18n), ikke ført som i18n-brudd.
- Timer-/PSI-kommentarer som nevner «avvik» — ikke HMS.

**3. Hvilke filer/flater føltes feil uten at du kunne bevise det? (mistanke)**
- **`components/malbygger/MalBygger.tsx`** — stalest kode i klyngen (17. apr), sentral for alle tre flatene, ikke dyp-lest denne runden. Mistanke om at den bærer teknisk gjeld som forplanter seg. Ikke bevist.
- **Mobil `OppgaveModal.tsx`** — `useEffect`-kjeden for svarer-synk + glemt `arbeidsforlop`-navngiving lukter race/glemt-vedlikehold. Mistanke, ikke reprodusert.
- **Utfyllings-sidenes `as unknown as`-casting** — føles som skjult typerisiko rundt `recipient/bestiller`-felt. Kan ikke bevises uten schema-endring-test.
- **`Checklist.data`/`Task.data` JSON-blob-modellen** — føles som fremtidig skalering-/spørrings-vegg (ingen per-felt-indeks), men fungerer i dag; «feil» er en påstand om fremtid, ikke nåtilstand.

**4. Hvilke funn mistenker du har søsken du ikke rakk?**
- **Døde søkebokser** (SjekklisterPanel + OppgaverPanel) — mønsteret «SearchInput bundet, `sok` ubrukt» har trolig flere forekomster i andre paneler/sider jeg ikke gikk gjennom.
- **Web↔mobil append-only-divergensen** (låsing finnes web, ikke mobil) — sannsynlig at samme klasse ikke-speilet divergens finnes for andre regler (validering, flyt-rettighet, prefill) mellom de fire skjema-hookene.
- **Hardkodet norsk i print-/detalj-/mobil-liste-sider** — jeg talte de sentrale filene; utskrifts-rutene (`/utskrift/*`) og øvrige mobil-modaler har trolig søsken jeg ikke talte.
- **Native `<select>` / ikke-standard filter** — kontrollplan + prosjekt-HMS bryter filter-standarden; sannsynlig at flere ikke-migrerte sider utenfor denne klyngen gjør det samme.
- **Uimplementerte/døde FK-er** som kontrollplan-broen — schema har flere `@unique`-koblinger (f.eks. andre kryssmodell-referanser) jeg ikke sjekket for om de faktisk populeres.

---

*Rapport slutt. Kun lesing utført; ingen kode/branch/commit endret. Denne fila er deliverable — ikke committet.*
