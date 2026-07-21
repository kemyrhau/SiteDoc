# FASE M FORARBEID — testmaler + NS3420-inventar + MalBygger-kapabilitet

> Fabel-ordre 2026-07-16. **Kun lesing** — ingen skriving i kode/DB/testdata, ingen commits/branch. Levert av redesign-Opus. **Ingen regelforslag** (fabels M-2-steg).
> Rå-vedlegg (maskinlesbart, `docs/claude/` — samme mappe som dette dokumentet): `ns3420-mal-dump-raw.json` (5 fulle NS3420-maler + 17 metadata), `ns3420-dok-inventar.json` (10 dokumenter), `ns3420-dok-inventar-raw.json`.
>
> **Vedleggene versjonert 2026-07-16 (cowork, `d54b8f80`).** Dette dokumentet kom inn med `5146f26c` samme dag; de tre rå-vedleggene var derimot aldri i git — de lå untracked i repo-rota mens både dokumentet og matrisen (`fd0ee7a2`) lå i `develop`. Stien over sa `repo-rot` og er rettet i samme flytt.
>
> **Rettelse (cowork, 2026-07-16):** `d54b8f80` påstod i commit-meldingen at dokumentet «levde fem dager utenfor git». Det er usant — det var i git fra 15:59 samme dag. Feilen: eksistens ble målt på stien fila ble *funnet* på (repo-rot), ikke stien den *bor* på; kandidatmengden var én sti. «Fem dager» tilhørte `plan-testflight-38.md` og ble overført uten måling. Commit-meldingen er historikk og står; denne linjen er korreksjonen.

## Metode og tilgang

- **Tilgang:** Kenneths autentiserte test-økt (company_admin, firma `f1000001-…0002`) via Playwright-browser-token. Kun lesing — all datauthenting via `GET`-tRPC-kall i innlogget sidekontekst (`fetch(..., credentials:"include")`). **Test-DB ikke rørt** (ingen skrive-kall).
- **Testprosjekt:** «Test redigert mal Kenneth Myrhaug» (`2bd15f09-8fbc-4de9-a826-3d2e5462bb23`, SD-20260310-0007). Kenneth hadde det åpent i browseren = «viste vei».
- **Kilder:** `mal.hentForProsjekt` (17 maler, metadata) + `mal.hentMedId` (full mal + objekter per NS3420-mal) + `mappe.hentForProsjekt` (228 mapper) + `mappe.hentDokumenter` (folderId=`3a5b9c2a-…`, 10 dokumenter). Del (c) MalBygger = lokal kodelesing på develop (egen agent).
- `[MÅLT]` = verifisert i data/kode. `[MISTANKE]` = ikke verifisert. Fravær ført med ❌ + hva som ble sjekket.
- **Negativ kontroll kjørt:** `mappe.hentDokumenter` ga først 0 pga. feil respons-nøkkel (`items` vs faktisk `dokumenter`) — fanget og rettet; 0-treffet var død parsing, ikke fravær. NS3420-mappe-id verifisert eksisterende (ikke ❌).

---

## a. DUMP AV TESTMALENE

### Oversiktstabell — alle 17 maler i testprosjektet

| # | Malnavn | category | domain(/sub) | prefix | Objekter | Sjekklister | NS3420? |
|--:|---|---|---|---|--:|--:|:--:|
| 1 | RUH | oppgave | hms/ruh | RUH | 8 | 0 | |
| 2 | SJA | sjekkliste | hms/sja | SJA | 12 | 0 | |
| 3 | HMS-avvik | oppgave | hms/avvik | HMS | 11 | 0 | |
| 4 | **KC3.1 – Oppstøtting av trær** | sjekkliste | **kvalitet** | KC3.1 | 7 | 1 | ✅ Del K |
| 5 | **KD1 – Utendørsbelegg** | sjekkliste | **kvalitet** | KD1 | 10 | 0 | ✅ Del K |
| 6 | **KA7 – Gjenbruk av materialer** | sjekkliste | **kvalitet** | KA7 | 6 | 0 | ✅ Del K |
| 7 | **KB4 – Grasdekke** | sjekkliste | **kvalitet** | KB4 | 10 | 0 | ✅ Del K |
| 8 | **KB2 – Jordarbeider** | sjekkliste | **kvalitet** | KB2 | 13 | 1 | ✅ Del K |
| 9 | Byggelerers dagbok/kontroll | oppgave | bygg | BHO | **0** | 0 | |
| 10–14 | Sikkerhetsinstruks — NRK ×5 | psi | bygg | PSI | 23/23/20/20/20 | 0 | |
| 15 | Sikkerhetsinstruks | psi | **hms/avvik** | PSI | 17 | 0 | |
| 16 | Befaringsrapport | sjekkliste | bygg | BEF | 8 | 4 | |
| 17 | Godkjenning | oppgave | bygg | GM | 14 | 0 | |

**NS3420-testmalene = 5 stk, alle NS3420 Del K (Anleggsgartnerarbeider): KA7, KB2, KB4, KC3.1, KD1.** [MÅLT] Skilt fra resten på `description` som inneholder «NS3420». Alle er `category:"sjekkliste"`, `domain:"kvalitet"`, `subdomain:null`, `version:1`, `enableChangeLog:false`. Ingen har `organizationTemplateId`/`promotedToFirma` satt (alle prosjekt-scopet). Full rå-dump: `ns3420-mal-dump-raw.json`.

### Felttype-fordeling (46 objekter over de 5 NS3420-malene) [MÅLT]

| Felttype | Antall | Bruk |
|---|--:|---|
| `heading` | 14 | Faseinndeling: «Kontroll FØR / UNDER / ETTER utførelse» |
| `traffic_light` | 14 | OK/merknad/avvik-vurdering (standard 3-lys) |
| `list_single` | 9 | Enkeltvalg (type/underlag/materialstatus) med `options` |
| `decimal` | 9 | Måltall m/ `enhet` + `min`/`maks`/`toleranse` mot NS3420-tabeller |

**Kun 4 felttyper i bruk. Null nesting (0/46 `parentId`). Null betinget synlighet. Null `translations` (0/46).** [MÅLT] Alle objekter bærer `config.zone:"datafelter"`.

### Per-mal struktur [MÅLT] (full detalj i rå-JSON)

Alle fem følger samme mønster: **FØR/UNDER/ETTER-utførelse**-overskrifter, valg via `list_single`, vurdering via `traffic_light`, måltall via `decimal` med NS3420-tabellreferanse i `helpText`.

- **KC3.1 (7 obj):** FØR[Støttetype·list] · UNDER[Støtte plassert·lys, Bindmateriale skadefritt·lys] · ETTER[Kontrollert etter 1 sesong·lys]
- **KD1 (10 obj):** FØR[Underlag·list, Belegningstype·list] · UNDER[Fall gang ≥2%·dec, Fall kjøre ≥2,5%·dec, Fuger rette·lys] · ETTER[Planhet ±3mm·dec(toleranse), Vertikalt sprang maks 2mm·dec] — refererer Tabell K11/K12
- **KA7 (6 obj):** FØR[Materialstatus·list, Dokumentasjon opprinnelse·lys, Lagringsplass·lys] · UNDER[Materialer rengjort·lys]
- **KB4 (10 obj):** FØR[Type etablering·list, Jordlag·lys, Fall ≥2%·dec] · UNDER[Kontakt frø/jord·lys, Vannet·lys] · ETTER[Markdekning ≥95%·dec, Klippet·lys]
- **KB2 (13 obj):** FØR[Formål/planteformål·list(8 valg m/ lagtykkelse), Underlag·list, Underlagskontroll·list, Leveringsdok·lys] · UNDER[Lagtykkelse·dec, Maks steinstørrelse·list, Jord ikke komprimert·lys] · ETTER[Planhet ±30mm·dec(toleranse), Fall ≥2%·dec, Overflate jevn·lys] — refererer Tabell K2/K4/Figur K3

Faglig innhold er tett koblet til NS3420 Del K-tabeller (K2, K4, K11, K12) og klausul-referanser (KB2 c2, KD1 c5, KB4 c4) i `helpText`. Høy fidelity mot standarden.

---

## b. NS3420-DOKUMENTINVENTAR

**Mappe «ÅÅ NS 3420»** (`3a5b9c2a-150a-43fe-83b0-addd0ba03e3c`), prosjekt `2bd15f09-…`. Kildespråk `nb`, ingen undermapper. **10 dokumenter, ikke a–z komplett** — 10 av ~26 deler. [MÅLT] Full liste: `ns3420-dok-inventar.json`.

| Filnavn | Del | Filtype | Størrelse | Sider | Ord | Språk | Prosessering | Chunks (embed/tot) |
|---|---|---|--:|--:|--:|---|---|---|
| ns-3420-1_2024_no_002.pdf | **1** (generelt) | pdf | 5,50 MB | 54 | 13 298 | nb | completed | 56/56 |
| ns-3420-a_2024_no_002.pdf | **A** | pdf | 6,46 MB | 76 | 15 949 | nb | completed | 76/76 |
| ns-3420-cd_2024_no_002.pdf | **C+D** | pdf | 4,30 MB | 56 | 9 362 | nb | completed | 55/55 |
| ns-3420-d_2024_no_002.pdf | **D** | pdf | 4,90 MB | 64 | 11 532 | nb | completed | 62/62 |
| ns-3420-f_2024_no_002.pdf | **F** | pdf | 28,67 MB | 328 | 70 208 | nb | completed | 332/332 |
| ns-3420-gu_2024_no_001.pdf | **G+U** | pdf | 4,67 MB | 54 | 11 245 | nb | completed | 57/57 |
| ns-3420-j_2024_no_001.pdf | **J** | pdf | 7,21 MB | 88 | 16 873 | nb | completed | 89/89 |
| NS 3420 Del K Anleggsgartnerarbeider ns-3420-k_2024_no_001.pdf | **K** | pdf | 5,42 MB | 170 | 33 433 | nb | completed | 178/178 |
| ns-3420-l_2024_no_001.pdf | **L** | pdf | 13,44 MB | 168 | 31 180 | nb | completed | 166/166 |
| ns-3420-z_2024_no_002.pdf | **Z** | pdf | 8,35 MB | 98 | 19 785 | nb | completed | 100/100 |

Deler til stede: **1, A, C/D, D, F, G/U, J, K, L, Z** (2024-utgaven). Alle PDF, alle norsk, alle `processingState:"completed"` med `processingError:null`, alle fullt embeddet (chunksEmbedded == chunksTotalt) → **klare for AI-søk/RAG**. `standardNumber`-feltet er `null` på alle (ikke utfylt). [MÅLT]

**Kobling til testmalene:** de 5 sjekklistemalene er alle fra **Del K**, og Del K-PDF-en (170 s, 33 433 ord) ligger i mappa. Testen har altså produsert maler fra ÉN del (K/Anleggsgartner), ikke fra alle 10 indekserte deler. [MÅLT]

---

## c. MALBYGGER-KAPABILITETSNOTAT (kode, develop)

Fra dyplesing av `apps/web/src/components/malbygger/**` + `apps/api/src/routes/mal.ts` (verifisert urørt av georef-branchen). Alt fil:linje-belagt.

| Kapabilitet | Status | Belegg |
|---|---|---|
| Felttyper opprettbare i paletten | **25 av 27** (2 skjult: `zone_property`, `room_property`) | `FeltPalett.tsx:37,45`; `REPORT_OBJECT_TYPES` shared/types:19-47 |
| Felttyper m/ egen konfig-editor | **11 av 25** | `FeltKonfigurasjon.tsx:119-322` |
| Alle felt redigerer | label, required, helpText | `FeltKonfigurasjon.tsx:83,89,101` |
| Nesting / grupper / repeater | ✅ rekursiv via `parentId` (DB-kolonne), dybde-vakt 10 | `MalBygger.tsx:100,139-155` |
| Kontainere som tar barn | `repeater` (alltid), `list_single`/`list_multi` (kun når `conditionActive`) | `MalBygger.tsx:139-142` |
| Betinget synlighet redigerbar | ✅ i `config`-JSON (`conditionActive`+`conditionValues`), kun forelder→direkte barn | `BetingelseBjelke.tsx`, `MalBygger.tsx:293-405` |
| Translations (i18n per felt) redigerbar i MalBygger | ❌ (grep `translations`=0 i malbygger+mal.ts); settes kun av PSI/auto-oversetting | `psi.ts:390`; `mal.ts:199-233` |
| Kopier/dupliser MAL | ❌ **disabled placeholder** i UI | `MalListe.tsx:373` (`DropdownItem disabled`) |
| Kopier/dupliser FELT | ❌ (kun Rediger/Betingelse/Slett) | `TreprikkMeny.tsx:71-122` |
| Firma-scope / bibliotek-mal | ❌ **uimplementert** — `OrganizationTemplate`/`OrganizationTemplateObject` er døde modeller (grep i app-kode=0; kun schema + migrering; kommentar «bygges i Fase 2») | `schema.prisma:862-865,869-931`; `ReportTemplate.organizationTemplateId`/`promotedToFirma` leses/skrives aldri |
| Lån/kopi firma-mal → prosjekt-mal | ❌ finnes ikke i dag | grep=0 |

**Viktig avklaring for fabels regler (bibliotek-spørsmålet):** maler er i dag **utelukkende prosjekt-scopet** (`ReportTemplate.projectId`, `verifiserProsjektmedlem` på alle ruter). Det finnes **ingen firma-bibliotek-mekanikk** — verken UI eller router. `BibliotekMal` (som ER implementert) er en HELT ANNEN funksjon: NS 3420-**kontrollplan**biblioteket (standard→kapittel→mal), koblet til kontrollplan-punkter, ikke til MalBygger. Fabels regelverk må ikke love firma-deling/promotering som funksjon — det er Fase 2-datamodell uten kode.

**Typer som kan rendres men ikke opprettes / ikke fullkonfigureres** [MÅLT]: `calculation.formula`, `traffic_light.options` (lysfarger), `integer/decimal.min/max/decimals`, `attachments.acceptedTypes`, `bim_property.propertyName` har defaultConfig men **ingen UI-input** i FeltKonfigurasjon. PSI-innholdstyper (`info_text/info_image/video/quiz`) kan opprettes men mangler i `RapportObjektRenderer.KOMPONENT_MAP` → vises kun i PSI-forhåndsvisning, ikke i ordinær sjekkliste/oppgave-utfylling.

---

## d. AVVIK — testmalene vs. hva MalBygger kan redigere

**AVVIK 1 — `decimal`-felt bærer config MalBygger ikke kan redigere. [MÅLT]** Testmalenes `decimal`-felt har `min`, `maks` og **`toleranse`** i `config` (f.eks. KD1 «Planhet over 3 m» `{toleranse:3}`, KB2 «Planhet – avvik» `{toleranse:30}`, KD1 «Vertikalt sprang» `{maks:2}`, flere `{min:2}`). Men MalBygger-editoren for `decimal` redigerer **kun `enhet`** (`FeltKonfigurasjon.tsx:140`). `min`/`maks` har ingen UI-input, og **`toleranse` er ikke engang i typens defaultConfig** — det er en helt egen semantisk nøkkel. → Disse feltene er **håndredigert / seed-importert JSON, ikke bygget i MalBygger.** Verktøyet ville ikke kunne reprodusere dem, og en bruker som åpner malen i MalBygger og lagrer, redigerer ikke bort verdiene (de bevares blindt via config-spread) men ser dem heller ikke.

**AVVIK 2 — domenet `kvalitet` har ingen egen UI-flate. [MÅLT/MISTANKE]** De 5 NS3420-malene er `domain:"kvalitet"`. HMS-flaten filtrerer `domain="hms"`; ordinær sjekkliste-liste filtrerer `domain:{not:"hms"}` → kvalitet-maler dukker opp i den ordinære sjekkliste-flaten (MÅLT i schema-diskriminatoren fra del 6b). Men det finnes ingen dedikert «Kvalitet/NS3420»-inngang. Intensjonen (NS3420-kvalitetskontroll) peker mot kontrollplan, men KB2/KC3.1 har bare 1 instansiert sjekkliste hver, resten 0. [MISTANKE: malene er produsert men i liten grad tatt i bruk / koblet til kontrollplan.]

**AVVIK 3 — konsistens mellom testmalene: høy. [MÅLT]** De 5 følger samme FØR/UNDER/ETTER-mønster, samme 4 felttyper, samme `zone:"datafelter"`, samme helpText-stil med NS3420-tabellreferanse. Ingen strukturell drift mellom dem. Dette er en styrke (mønster å kodifisere), ikke et avvik i negativ forstand.

**AVVIK 4 — testdata-støy i totallisten. [MÅLT]** «Byggelerers dagbok/kontroll» har **0 objekter** (tom mal). 5 duplikate «Sikkerhetsinstruks — NRK» (psi/bygg). Én «Sikkerhetsinstruks» er `psi` + `hms/avvik` (uvanlig kombinasjon category=psi med hms-subdomain). Ikke NS3420-relatert, men verdt å vite at testprosjektet inneholder halvferdig/duplikat testmateriale.

---

## De fire spørsmålene (ordrett)

**1. Hva så du som ikke passet i noen kategori?**
`toleranse`-nøkkelen på `decimal`-felt (AVVIK 1) — den er verken en MalBygger-redigerbar config, en defaultConfig-nøkkel, eller noe `RapportObjektRenderer` er dokumentert å bruke. Den er en *ny semantikk innført av testproduksjonen* (avvik-toleranse mot NS3420-tabell) som verktøyet ikke kjenner. Det er verken «felttype», «bibliotek» eller «UX» — det er et regelverk-hint på feltnivå som lever i fri config-JSON. For fabel er dette antakelig kjernen: NS3420-maler trenger et *toleranse/grenseverdi*-konsept som i dag ikke har hjem i datamodellen eller verktøyet.

**2. Hva forkastet du som støy?**
De 5 duplikate «Sikkerhetsinstruks — NRK» + den tomme «Byggelerers dagbok» + PSI-malene generelt — de er ikke NS3420-testen, kun annet testmateriale i samme prosjekt. Tatt med i totallisten (per ordre) men ikke analysert. Forkastet også `standardNumber:null` på dokumentene som ikke-signal (feltet er bare ikke utfylt).

**3. Hvilke filer/flater føltes feil uten at du kunne bevise det? (mistanke)**
At kvalitet-domenet og kontrollplan-koblingen er halvbygd: NS3420-malene finnes, men bare 2 av 5 har én instansiert sjekkliste, og `KontrollplanPunkt.sjekklisteId`-broen er uimplementert (fra del 6b-rapporten). Det *føles* som at testen produserte maler uten at det finnes en ferdig flate å bruke dem i — men jeg har ikke sporet om kontrollplanen i dette prosjektet faktisk refererer disse malene. [MISTANKE]

**4. Hvilke funn mistenker du har søsken du ikke rakk?**
- `toleranse`/`min`/`maks`-avviket (AVVIK 1) har trolig søsken: andre config-nøkler i testmaler (eller Markussen-prosjektet) som MalBygger ikke kan redigere. Jeg sjekket kun de 5 NS3420-malene — de 12 andre + Markussen-prosjektets maler er ikke felt-inspisert.
- Seed/import-veien som *skapte* disse malene (håndredigert JSON?) — jeg fant avviket i data, men sporet ikke skriptet/importen som la dem inn. Der ligger sannsynligvis flere maler + samme toleranse-mønster.
- NS3420-mappa har 10 deler indeksert men bare Del K er blitt til maler — de 9 andre delene (1, A, C/D, D, F, G/U, J, L, Z) er ubrukt råstoff; om andre prosjekter har maler fra dem, rakk jeg ikke sjekke.

---

*Rapport slutt. Kun lesing utført; test-DB ikke rørt; ingen kode/commit/branch endret. Vedlegg: `ns3420-mal-dump-raw.json`, `ns3420-dok-inventar.json` (repo-rot).*
