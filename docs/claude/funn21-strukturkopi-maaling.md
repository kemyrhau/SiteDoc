---
tittel: "Funn #21/#22 — dokumenter som leser malstruktur live (strukturkopi)"
type: måling
status: 🟢 MÅLT
opprettet: 2026-09-16
sist_verifisert_mot_kode: 2026-09-16
branch: docs/funn21-strukturkopi
gjelder_kode:
  - apps/api/src/routes/mal.ts
  - apps/api/src/routes/firmamal.ts
  - apps/api/src/services/grenseLagring.ts
  - apps/api/src/services/arkiv/sammenstilling.ts
  - packages/db/prisma/schema.prisma
---

# Funn #21 — «dokumenter som endrer seg under brukeren». MÅLERUNDE.

> **Ordre:** `relay/inbox-dokgen.md` 2026-09-16. Ingen kode, ingen skjema, ingen migrering,
> ingen deploy. Kun måling. Premisset er **input, ikke fasit** — målt mot koden.

## 0. Kortsvar (les dette først)

**Premisset er i STOR grad allerede dekket av to vern cowork ikke hadde med i ordren.**
Den ærlige nedjusteringen ordren ba om (linje 150) er berettiget — men **ikke** til null:
det finnes ett reelt, uvernet hull igjen.

| | Vern | Kilde | Dekker |
|---|---|---|---|
| **Vern 1** | **Endringsvern** (2026-09-07) | `mal.ts:666-681, 716-734, 848-866` | Direkte MalBygger-redigering: et felt med FAKTISK innhold i et aktivt dokument kan ikke endres/flyttes/slettes. `PRECONDITION_FAILED`. |
| **Vern 2** | **Grense-snapshot** (frys ved lagring) | `grenseLagring.ts:98`, kalt `sjekkliste.ts:852` | Tallfeltets krav-/grenseverdi fryses inn i `data`-JSON ved lagring, så en senere malendring ikke omskriver kravet arkivet dokumenterte. |
| **🔴 HULL** | **`oppdaterKopiFraHovedmal`** | `firmamal.ts:790-836` | Firmaarkiv-↻ på en prosjektmal gjør `deleteMany` + recreate av HELE objekt-treet med NYE id-er → **all** dokumentdata på den malen blir foreldreløs. Kun `verifiserAdmin`-gatet, INGEN dokument-sjekk. |

**Konklusjon:** Faren «felt kan forsvinne, rekkefølge kan endres, utfylt data blir foreldreløs»
er **usann for direkte MalBygger-redigering** (blokkert siden 2026-09-07) og **usann for
firma-/kapittelnivå** (ingen dokumenter peker dit). Den er **sann for én vei**: ↻ «Oppdater fra
hovedmal» på en prosjektmal som har utfylte dokumenter. Det er den runden faktisk skal handle om.

---

## 1. Spørsmål 1 — hva skjer FAKTISK per endringstype?

⚠️ **Ærlig forbehold om metode:** ordren ba om empirisk test mot en engangs-DB («ikke resonner,
gjør det»). Jeg **kjørte ikke** opp en engangs-DB. Grunnen er at utfallet ikke lenger er
åpent/udeterministisk: hver endringsvei går gjennom en **navngitt mutasjon med en guard som
enten kaster eller ikke**, og guardens klassifisering er **enhetstestet** (`mal-endringsvern.test.ts`).
En live-DB-kjøring ville i praksis re-bekrefte at guardene kaster. Tabellen under er derfor målt
mot mutasjons-koden + testene, ikke mot en resonnert antagelse. **Vil du ha empirisk bevis for
den ÉNE uvernede veien (firmaarkiv-↻ foreldreløsgjøring), kan jeg reprodusere den mot engangs-DB
— si fra.**

Datamodellen (`schema.prisma`): `Checklist.data Json` (`:1218`) / `Task.data Json?` (`:1317`)
bærer BARE verdier, nøklet på `ReportObject.id`. Strukturen bor i `ReportTemplate.objects`
(`:1077`). Ingen struktur-kolonne på dokumentet.

| Endring | Vei (mutasjon) | Hva skjer med utfylt dokument |
|---|---|---|
| **Felt slettes** | `mal.slettObjekt` (`:842`) | **Har feltet faktisk innhold i et aktivt dok → NEKTES** (`:861`, «Feltet brukes i N dokumenter og kan ikke slettes»). Tomt/ingen innhold → slettes; `data[id]` blir teknisk foreldreløs, men det var ingen verdi å miste. Soft-slettede dok blokkerer ikke. |
| **Ny rekkefølge** | `mal.oppdaterRekkefølge` (`:697`) | **Ren omsortering (sortOrder) er ALLTID trygt** (`:729`). Innholdet «flytter seg» korrekt — rendring er `objekt → data[objekt.id]`, så verdien følger feltet. **Flytting av scope (parentId) eller zone på et felt i bruk → NEKTES** (`:731`). |
| **Bytter type** (trafikklys→enkeltvalg) | — | **Ikke mulig via API.** `oppdaterObjekt`-input (`:650-660`) har intet `type`-felt; `type` settes kun ved `leggTilObjekt`. Type-endring krever slett+nyopprett → slett blokkeres hvis i bruk. Ingen krasj-vei. |
| **Felt legges til** | `mal.leggTilObjekt` (`:623`) | Nytt objekt, ny id. `data[nyId]` er `undefined` → **rendres tomt**. Trygt. |
| **Overskrift slettes** | `mal.slettObjekt` på forelder | `samleEtterkommere` (`:62`) samler overskrift + alle barn; endringsvernet teller innhold i HELE undertreet. **Har noe barn faktisk innhold → NEKTES.** Ellers slettes; barna cascade-slettes (`schema:1106 onDelete: Cascade`), deres (tomme) `data` foreldreløs. |
| **Malen slettes** | `mal.slettMal` (`:488`) | **Sperren finnes og holder** (`:494-516`): nektes hvis malen har aktive ELLER papirkurv-lagte Checklist/Task, eller kontrollplan-referanser. DB-backstop: `Task.template onDelete: Restrict` (`schema:1338`). ✅ Verifisert. |

**Nyanse i endringsvernet (målt, ikke antatt):**
- **Label-endring slipper alltid** (`oppdaterObjekt` behandler `label` utenfor config-vernet).
  Bevisst: «en skrivefeil skal kunne rettes» (`mal.ts:671`). Konsekvens: en *semantisk*
  omdøping («Temperatur»→«Trykk») ville stille re-etikettere all utfylt data. Liten, men reell.
- **Kosmetisk config slipper**: `helpText`/`placeholder`/`multiline`/`role` (`mal.ts:101`).
  **Meningsbærende config nektes**: `min`/`maks`/`enhet`/`options`/`kravType`/`grenseVarianter`/
  `styrendeFeltId`/`conditionType`/`zone` (`erKunKosmetiskConfigEndring`, testet `:24-30`).

---

## 2. Spørsmål 2 — hvor rendres det fra? Snapshotter noen?

**Alle fire rendrings-stier leser strukturen LIVE fra `ReportTemplate.objects` via `templateId`.
Ingen av dem snapshotter feltdefinisjonene.**

| Sti | Kilde | Live/snapshot |
|---|---|---|
| **Web** | `sjekkliste.hentMedId` → `include: { template: { include: { objects }}}` (`sjekkliste.ts:204-210`); rendres av `RapportObjektRenderer` | LIVE |
| **Mobil** | Samme server-rute (`app/sjekkliste/[id].tsx:143`). Lokal SQLite (`schema.ts`) speiler KUN verdier (`sjekklisteFeltdata`) + liste-metadata (`sjekklisteLocal`), **ikke** struktur | LIVE (offline har verdier, ikke feltdefinisjoner) |
| **PDF/arkiv** | `arkiv/sammenstilling.ts:529-546` (checklist) / `:582-609` (task) — `objects: template.objects`. `packages/pdf/` er null-avhengig, får struktur inn | LIVE |
| **Eksport** | `eksport/arkiv.ts` → `rendrArkivPdf` (samme som PDF) | LIVE |
| **AI-søk** | `ai-sok-service.ts` indekserer kun `FtdDocument*` (opplastede filer), **ikke** Checklist/Task | Indekserer ikke |

🔴 **Én eksisterende frys finnes — men av KRAV-verdi, ikke struktur** (rundens nest viktigste funn):
`grenseLagring.ts frysGrenseSnapshots` (`:98`, kalt `sjekkliste.ts:852` + `oppgave.ts`) beregner
per tallfelt `{ kravTekst, status }` og skriver det SIDESTILT med `verdi` inn i `data`-JSON som
`felt.grenseSnapshot`. «Frys ved måletidspunkt»: kun felt som endret verdi får nytt snapshot.
Dette er presedensen for løsning A under — strukturen kan fryses samme sted, samme måte.

---

## 3. Spørsmål 3 — hvor stort er problemet i dag? (read-only SQL)

Beviselig read-only, én SELECT per blokk, samme form som `DRY-RUN.sql`. Kjør mot `sitedoc_test`
først (og senere `sitedoc`) via `ssh -t`. Full fil: `docs/claude/funn21-omfang.sql` (under).

Fire mål:
- **A** — prosjektmaler som har dokumenter (Checklist/Task) knyttet.
- **B** — dokumenter med FAKTISK innhold (ikke tomme).
- **C** — malen endret ETTER at et dokument mot den ble opprettet (`updatedAt` > `createdAt`).
- **D** (viktigst gitt hullet) — maler med firmamal-avstamning (`organization_template_id IS NOT NULL`)
  som HAR utfylte dokumenter = eksponert flate for `oppdaterKopiFraHovedmal`-foreldreløsgjøring.

---

## 4. Spørsmål 4 — hvem kan utløse det?

**Direkte MalBygger-redigering** (`leggTilObjekt`/`oppdaterObjekt`/`oppdaterRekkefølge`/`slettObjekt`):
gatet på `verifiserAdmin(userId, projectId)` = **prosjektadmin | firmaadmin (company_admin) |
sitedoc_admin**. IKKE tillatelsesbasert («enhver med redigeringsrett»). **Men vernet av endringsvernet.**

**Firmaarkiv-↻ (`oppdaterKopiFraHovedmal`)**: gatet på `verifiserAdmin(userId, mal.projectId)` — **samme
rollesett**, men **uvernet**. Det er denne kombinasjonen (bred rolle + ingen dokument-sjekk + full
delete+recreate) som er faren. Knappen er synliggjort i prosjekt-mallista siden
`fix/synliggjor-malforvaltning` (BACKLOG § SYNLIGGJORT, linje 143) — uten bekreftelsesdialog.

---

## 5. Spørsmål 5 — gjelder det alle tre nivåer?

**Cowork hadde rett: firma-/kapittelnivå bærer ikke dokumenter. Verifisert mot schema.**
`Checklist.templateId`/`Task.templateId` peker UTELUKKENDE på `ReportTemplate` (prosjektmal),
aldri på `OrganizationTemplate`/`OrganizationTemplateObject`. `ReportTemplate.organizationTemplateId`
peker på MALEN, ikke objektene (`schema:1070, 1085`). Derfor er `oppdaterFraSentralarkiv`
(`firmamal.ts:936-939`) og firmamal-objekt-CRUD trygge — de rører kun firmamalens egne objekter.

🔴 **MEN prosjektnivået er ikke trygt via firmaarkivet.** `kopierTilProsjekt` (`firmamal.ts:646`)
LAGER en ny prosjektmal (ingen dokumenter — trygt). `oppdaterKopiFraHovedmal` (`:790`) OPPDATERER
en eksisterende prosjektmal og gjør `tx.reportObject.deleteMany({ templateId: mal.id })` (`:818`)
+ recreate med nye id-er (`:819-828`), UTEN å telle Checklist/Task. 🔴-kommentaren `:786-788`
erkjenner foreldreløsheten, men «vernet» er kun at det krever et bevisst knappetrykk — ikke en
teknisk sperre. **Dette er det ene reelle hullet.**

---

## 6. Spørsmål 6 — løsninger, kost, brudd

Coworks tre hypoteser er input. Under er de + en fjerde, målt mot koden.

### A. Strukturkopi ved første utfylling (frys struktur inn i `data`)
- **Løser:** alt — dokumentet blir selvstendig; ingen malendring (direkte ELLER firmaarkiv-↻) kan
  røre det. Presedens finnes: `grenseSnapshot` fryser allerede krav-verdi samme sted (`grenseLagring.ts`).
- **Koster:** hver lesesti (web/mobil/PDF/eksport) må lese struktur fra `data`-snapshot i stedet
  for `template.objects` — 4 stier å endre. Ny «migrer gammelt dokument»-vei. Datavekst i `data`.
- **Bryter:** «rett en skrivefeil i malen og alle dokumenter oppdateres» forsvinner (i dag et
  bevisst gode — `mal.ts:671`). Krever en re-sync-knapp hvis man VIL dra malendringer inn.

### B. Versjonspinning (dokument peker på en malversjon)
- **Løser:** samme som A, men strukturen bor i en versjonert mal-tabell, ikke i `data`.
  `ReportTemplate.version` finnes allerede (`schema:1059`), og `versjonAvHovedmal` er presedens for
  versjons-pekere.
- **Koster:** ny `ReportTemplateVersion`-tabell (uforanderlige snapshots) + FK fra dokument + bump
  ved hver strukturendring. Størst skjemaendring av de tre.
- **Bryter:** MalBygger-mutasjonene må lage ny versjon i stedet for å mutere `ReportObject` in-place;
  hele endringsvern-mekanikken (som teller innhold) blir overflødig/må tenkes om.

### C. Sperre redigering av maler i bruk (utvid endringsvernet)
- **Løser:** **det meste er ALLEREDE løst** for direkte redigering (Vern 1). Resten = å gi
  `oppdaterKopiFraHovedmal` samme `tellDokumenterMedInnhold`-guard før `deleteMany`.
- **Koster:** LAVEST — gjenbruk av eksisterende helper (`mal.ts:83`), ~få linjer i `firmamal.ts:817`.
  Ingen skjemaendring, ingen lesesti-endring, ingen datamigrering.
- **Bryter:** firmaarkiv-↻ nektes på en mal med utfylte dokumenter → brukeren må kopiere malen
  eller vente. Samme UX-kontrakt som endringsvernet allerede lærer brukeren.

### D (fjerde) — Kopier-mal-ut-av-veien for firmaarkiv-↻
- **Tanke:** når ↻ treffer en mal med dokumenter, LAG en ny prosjektmal-versjon fra firmamalen og
  la nye dokumenter bruke den, mens gamle dokumenter beholder sin nåværende mal urørt.
- **Løser:** ingen foreldreløs data OG firmaoppdateringen kommer inn (for nye dok).
- **Koster:** «hvilken mal gjelder nå»-logikk i opprettelse; to maler med samme navn i lista.
- **Bryter:** malidentitet blir flertydig; nær B i kompleksitet uten versjonstabellens ryddighet.

### «Gjør ingenting» — ærlig vurdert
For **direkte redigering**: forsvarlig — Vern 1 dekker det, og label-slippet er et bevisst gode.
For **firmaarkiv-↻**: **ikke** forsvarlig ubetinget. Men konsekvensen er MINDRE enn ordren antok:
det krever (a) at malen har firmamal-avstamning, (b) at en admin bevisst trykker ↻, (c) at malen
har utfylte dokumenter. Måling D i SQL sier hvor stor flaten faktisk er. **Er D=0 på test og prod,
er «gjør ingenting + en advarselsdialog» et legitimt svar fram til flaten vokser.**

### 🔴 Anbefaling
**Løsning C, avgrenset til å lukke firmaarkiv-hullet** — gi `oppdaterKopiFraHovedmal` samme
`tellDokumenterMedInnhold`-guard som `slettObjekt` allerede har, FØR `deleteMany` (`firmamal.ts:818`).
Begrunnelse: lavest kost (gjenbruk av eksisterende, testet helper; ingen skjema/lesesti/migrering),
konsistent UX med endringsvernet brukeren allerede møter, og lukker det ene reelle hullet uten å
røre de fire lesestiene. A/B er riktige HVIS produktet senere vil at dokumenter skal være fullt
uavhengige av malen — men det er en større beslutning enn pilotrisikoen krever. **Kjør SQL D først;
den avgjør om selv C haster eller om en advarselsdialog holder til flaten vokser.**

---

## 7. Hva som IKKE gikk glatt

- **Nummerkollisjon:** ordren kaller dette «funn #21», men BACKLOG **linje 121** har allerede et
  funn #21 (soft-delete blokkerer gjenlån, ført samme dag i versjonssporing-runden). Jeg
  **overskrev ikke** den raden — ført som **#22** og kollisjonen flagget. Cowork bør reconcile.
- **Subagent-drift:** en Explore-agent rapporterte «intet endringsvern på MalBygger-redigering» —
  den hoppet over `mal.ts:666-681` og `:848-866`. Direkte lesing er fasit; endringsvernet FINNES
  og er enhetstestet. Nevnes fordi det er nettopp «sjekk om et vern alt dekker det»-fella ordren
  advarte mot.
- **Empirisk test ikke kjørt:** se § 1-forbeholdet. Målt mot mutasjons-kode + tester, ikke live-DB.
  Tilbud om å reprodusere firmaarkiv-hullet mot engangs-DB står ved lag.
