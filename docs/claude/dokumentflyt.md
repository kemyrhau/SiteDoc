# DOKUMENTFLYT — SiteDoc

## 1. Kjernekonsepter

### Bestiller
Den som opprettet dokumentet. Endres aldri.

### Eier
Den som har overordnet ansvar for at dokumentet blir ferdig. Kan byttes av en med rett rettighet (se Rettigheter).

**Teknisk:** Eier er en User-FK (`Checklist.eierUserId` / `Task.eierUserId`). Eier-feltet peker direkte til en User, ikke til en Faggruppe. Logikken sikrer at User tilhører riktig faggruppe ved mottak — eieren er ikke direkte koblet til faggruppe-tabellen.

Eier settes automatisk ved mottak:
- Ballen sendes til en person → den personen blir eier
- Ballen sendes til en gruppe → gruppens leder (`ProjectMember.erFirmaansvarlig = true`, vises som blå prikk i UI) blir eier

### Nåværende mottaker
Den som har ballen akkurat nå. Endres for hvert steg i flyten.

### Faggruppe
Prosjektdeltaker innen et fag (Elektro, Tømrer, Rør osv.). Definerer hvilke parter som kan motta et dokument innen denne flyten.

### Prosjekteier
HE-Leder eller BH. Avhenger av hvem som eier prosjektet.

### Status
Uavhengig av hvem som eier eller har ballen akkurat nå. Settes manuelt av nåværende mottaker.

### Flytboks
Representerer nåværende mottaker visuelt. Er dynamisk — viser dokumentets bevegelse gjennom flyten. Trenger ikke navn, ettersom faggruppenavnet er selve boksen. Leder i gruppen markeres med blå prikk og mottar ballen automatisk når dokumentet sendes til gruppen.

---

## 2. Dokumenttyper

### Sjekkliste

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle med redigeringsrettigheter |
| Redigerbar | Den som har ballen + admin/registrator alltid |
| Sletting | Kun i kladd av bruker, alltid av admin/registrator |
| Låses | Etter godkjenning — kan gjenåpnes |
| Flyt | Toveis |
| På tvers av faggrupper | Kun admin/registrator/prosjekteier |
| Fremtidig | Per-ledd konfigurasjon, per-medlem rettighet |

### Oppgave

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle med redigeringsrettigheter |
| Redigerbar | Aldri — append-only fra opprettelse |
| Legg til info | Den som har ballen + admin/registrator |
| Sletting | Kun i kladd av bruker |
| Godkjenning/lukk | Admin/registrator i alle flyter kan sette `closed`. Ikke-admin kan kun gå til `responded` (se § 6 Statusoverganger) |
| Flyt | Toveis |
| På tvers av faggrupper | Kun admin/registrator/prosjekteier |
| Fremtidig | Per-ledd konfigurasjon, per-medlem rettighet |

Oppgave skilles fra sjekkliste ved opprettelse — de to konverteres ikke til hverandre.

### HMS

| Regel | Verdi |
|-------|-------|
| Oppretter | Alle brukere |
| Flyt | Enveis med automatisk retur: Innsender → HMS-gruppe → (Godkjent) → Innsender |
| Behandling | Kun HMS-gruppen (uendret) |
| Godkjenning | HMS-gruppe godkjenner. ❌ **IKKE IMPLEMENTERT:** «rapport returneres automatisk til innsender» finnes ikke i koden (målt av A-3b-Opus 2026-07-21: `erHms` opptrer kun i opprett-mutasjonene `oppgave.ts:329` / `sjekkliste.ts:164`; `endreStatus` har ingen HMS-gren, og ingen auto-retur-logikk finnes noe sted). Modellen er fabel-bekreftet som *intensjon* ([a3b-perspektiv-tabell.md § 7 pkt 3](delplaner/a3b-perspektiv-tabell.md)), ikke som kodefaktum. **Bygges ikke på eget initiativ** — krever egen sak |
| Redigerbar | Innsender i kladd/sendt, HMS-gruppe når de har ballen |
| Sletting | Kun i kladd av innsender |
| Lese | HMS-gruppe + admin/registrator + **firma-HMS-ansvarlig** (kontrolloppgave — per fase-0-beslutninger A.27) |
| Admin/registrator | Kan lese alltid, kan legge seg til i HMS-gruppen |
| Fremtidig | Per-ledd konfigurasjon, flere HMS-grupper per prosjekt |

Retursteget til innsender ved godkjenning er automatisk — ikke en manuell sending.

**Firma-HMS-ansvarlig-tilgang (vedtatt 2026-04-29 per A.27):** En person med `OrganizationRole.role = "hms_ansvarlig"` får automatisk lese-tilgang til alle HMS-flyter i firmaets prosjekter — uten å være registrert som DokumentflytMedlem. Behandling (godkjenne, kommentere, redigere) forblir begrenset til HMS-gruppen på prosjektet. Kontrolloppgave: firma-HMS-ansvarlig skal kunne kontrollere at HMS-rapporter på prosjektnivå ivaretas og besvares.

### Godkjenning

| Regel | Verdi |
|-------|-------|
| Oppretter | Kun første flytboks (lengst til venstre) |
| Flyt | Enveis — låst til sin egen dokumentflyt |
| Avvis/send tilbake | Konfigurerbart per mal |
| Synlighet | Kun de i flyten |
| Redigerbar | Per-ledd konfigurasjon (se seksjon 5) |
| Sletting | Kun i kladd av oppretter |
| På tvers av faggrupper | Aldri |
| Fremtidig | Full per-ledd låsbarhet, konfigurerbare godkjenningsregler per mal |

Godkjenning kan aldri:
- Flyttes til en annen faggruppe
- Flyttes til en sjekklisteflyt eller oppgaveflyt
- Slås sammen med en annen godkjenningsflyt

Dokumenter kan refereres som vedlegg på tvers (f.eks. en ferdig Teknisk avklaring kan legges ved et Krav), men selve flyten forblir alltid separat.

---

## 3. Rettigheter

### Synlighetsaksen (N3, 2026-07-18)

**Å være medlem av en dokumentflyt gir synlighet til flytens dokumenter** — uavhengig av bindingsform. `DokumentflytMedlem` binder et medlem på én av tre måter: `faggruppe_id`, `group_id` eller `project_member_id` (person-direkte). Alle tre er gyldige tilgangsveier.

- **Server:** `byggTilgangsFilter` (`apps/api/src/trpc/tilgangskontroll.ts`) legger til `{ dokumentflytId: { in: <flyter brukeren er medlem av> } }` via `hentBrukersFlytMedlemskap` (alle tre bindinger, kun aktive medlemskap `periodeSlutt = null`). Tidligere fanget filteret kun faggruppe-/gruppe-veiene → person-direkte medlemmer (`project_member_id`) så ingenting. Fire lesere: `oppgave.ts` · `sjekkliste.ts` · `hms.ts` · `bilde.ts` (nested på checklist/task).
- **Detalj + øvrige lese-stier (del 2, 2026-07-19):** `verifiserDokumentTilgang` (samme fil) har en flyt-gren aktivert av trailing-parameteren `tillatFlytMedlemskap` (default `false`). **Kun de seks lese-stiene sender `true`:** `sjekkliste.hentMedId`/`hentTilgjengeligeFlyter` · `oppgave.hentMedId`/`hentKommentarer`/`hentForSjekkliste`/`hentTilgjengeligeFlyter`. Uten dette så et person-direkte medlem dokumentet i lista, men fikk «ikke funnet» på detalj.
  - **F1-A (HMS-personvern):** grenen fyrer **ikke** for private HMS-dok (`domain="hms" && hmsSynlighet !== "apen"`). Flyt-medlemskap overstyrer ikke HMS-synlighet. Se [hms-synlighet-regel.md](delplaner/hms-synlighet-regel.md) for planlagt regel + betingelsens forward-avhengighet.
- **Skrive (mutasjoner) — IKKE åpnet:** de 11 mutasjons-guardene kaller `verifiserDokumentTilgang` **uten** flagget og beholder streng faggruppe/gruppe-gate. Et person-direkte flyt-medlem kan derfor **lese, men ikke endre**. Egen sak: «G1-mutere» (krever flytrolle-håndheving per mutasjon først).
- **Opprett:** de fire opprett-flatene (sjekklister/oppgaver/tegninger/`OpprettOppgaveModal`) utleder bestiller/utfører-faggruppe fra `tRPC medlem.hentMineFlyter`; person-/gruppe-direkte medlem uten egen faggruppe bruker flytens eier-faggruppe (`Dokumentflyt.faggruppeId`) som fallback. Server-siden: `verifiserFaggruppeTilhorighet` godtar flyt-medlemskap som alternativ til `FaggruppeKobling` når faggruppen er eier-faggruppe i en flyt brukeren er medlem av. Feilmeldingene skiller de to årsakene: `dokumentflyt.feil.ingenFlytMedMal` (ingen av dine flyter har malen) vs. `dokumentflyt.feil.flytManglerFaggruppe` (flyten mangler eier-faggruppe). **`dokumentflytId` bindes ved send, ikke ved opprett** (uendret).
  - ⚠️ **Konsekvens (verifisert 2026-07-19):** et dokument opprettet av et person-direkte medlem får ingen `dokumentflytId` før det sendes → det vises **ikke i lista** (matcher ingen filter-gren), men **åpnes via direkte URL** (bestiller-grenen i `verifiserDokumentTilgang`). Åpen sak.

Flyt-medlemskap gir i dag **synlighet (lese) + opprett + mutasjoner på lik linje med faggruppe-medlemskap** (sak 1, paritetsvedtak 2026-07-19) — ikke admin, ikke redigering utover § 2. Status-vaktene styrer fortsatt *når*, og `verifiserFlytRolle` styrer *hvilken statusovergang*.

### Beslutningslaget (spor 2, 2026-07-20)

Dokument-tilgang avgjøres nå av en **ren funksjon**, adskilt fra datahentingen:

- **`avgjorDokumentTilgang(fakta) → { tillat, grunn }`** (`packages/shared/src/utils/avgjorDokumentTilgang.ts`) — all beslutningslogikk, ingen avhengigheter, ingen Prisma.
- **`verifiserDokumentTilgang`** (`apps/api/src/trpc/tilgangskontroll.ts`) beholder alle Prisma-oppslag, bygger `TilgangsFakta` og kaller den rene funksjonen.

**Grenene i fast rekkefølge:** admin → ikke-medlem → prosjektadmin → firmaansvarlig → bestiller/mottaker → faggruppe-direkte → gruppe-domain → HMS-åpen → flyt-medlemskap → avvis.

**Håndhevet av `packages/shared/src/utils/tilgangsmatrise.test.ts`** — tabelldrevet matrise (bindingstype × status × dokument-attributter → forventet utfall), kjørt mot både en **frossen referanse** (dagens oppførsel, endres aldri) og produksjonsfunksjonen. Divergens = test-feil. **Nye tilgangsregler legges til som RADER i matrisen, ikke som nye testfiler.**

**Prinsipp ved ytelsespress (fabel 2026-07-20):** blir oppslagene dyre, er riktig fiks **caching bak samme kilde** — ikke å gjeninnføre kortslutninger som duplisererer beslutningslogikk inn i datalaget. Duplikatet gir feil avvisning den dagen lagene glir fra hverandre.

### Rettighetsbasert UI

| | Leser | Redigerer | Admin/Registrator |
|---|---|---|---|
| Ny sjekkliste | – | Redigeringsmodus | Redigeringsmodus |
| Eksisterende sjekkliste | Forhåndsvisning | Redigeringsmodus | Redigeringsmodus |
| Ny oppgave | – | Redigeringsmodus | Redigeringsmodus |
| Eksisterende oppgave | Forhåndsvisning | Forhåndsvisning + legg til nederst | Redigeringsmodus |
| HMS | Forhåndsvisning | Opprett + fyll ut | Lese alltid |
| Godkjenning | Forhåndsvisning (hvis i flyten) | Per-ledd | Per-ledd + overstyr |

### Hvem kan sende på tvers av faggrupper

| Rolle | Sjekkliste/Oppgave | Godkjenning | HMS |
|---|---|---|---|
| Prosjekteier (HE/BH) | ✓ | ✗ | ✗ |
| Registrator / Admin | ✓ | ✗ | ✗ |
| Fag (Elektro, Tømrer osv.) | ✗ | ✗ | ✗ |

### Hvem kan bytte eier

| Rolle | Kan bytte eier |
|---|---|
| Prosjekteier (HE/BH) | ✓ |
| Registrator / Admin | ✓ |
| Fag | ✗ |

### Handlingsknapper basert på posisjon i flyten

**Første/midtre flytboks:**
```
[Send ▾]
  → Faggruppe A (neste i flyten)
  → Send tilbake (hvis ikke første boks)
  → Andre faggrupper (hvis tilgang)
```
Kun én mottaker → send direkte uten dropdown.

**Siste flytboks (godkjenner):**
```
[Godkjenn]  [Avvis]  [Send ▾]
                       → Svar avsender
                       → Andre faggrupper (hvis tilgang)
```

**Admin-seksjon i dropdown:**
Registrator/admin ser alltid en egen seksjon med flytbokser og manuelle statusendringer. **Manuelle statusendringer er innenfor statusmaskinen** — ikke frie hopp. (A-3a 2026-07-17: web-menyen `DokumentHandlingsmeny.tsx` utleder handlingssettet fra `statusHandlinger.ts` (`hentRolleFiltrertHandlinger` + `ADMIN_NY`-splitt), samme kilde som mobil. De tidligere frie hoppene — `approved`/`closed`/`cancelled`/`draft` fra enhver status — som serveren avviste, er fjernet.)

**«Hva sier den når nei»** (A-3a): handlinger som finnes i statusen men ikke er tilgjengelige for brukerens rolle vises **deaktivert med begrunnelse** utledet fra kilden («Kun avsender/utfører/godkjenner», «Kun administrator», «Dokumentet er lukket», «Ugyldig fra denne statusen») — ikke skjult, ikke feilende mot `BAD_REQUEST`. Primærhandlingen (`StatusHandling.erPrimaer`) rendres som knapp; resten i nedtrekk. Bekreftelse kreves kun for irreversible overganger (`closed`/`deleted`); alt annet er 1 klikk (`DocumentTransfer` logger uansett). Kommentar er en valgfri utvider.

**Implementert: kanRedigere per flytledd**
- `DokumentflytMedlem.kanRedigere` (boolean, default `true`) styrer om et flytmedlem kan redigere dokumenter
- Toggle i dokumentflyt-oppsettet: "Redigerer" (default) / "Leser" (amber badge)
- `utledDokumentRettighet()` sjekker `kanRedigere` — `false` → bruker får kun lesevisning selv med ballen
- Admin/registrator upåvirket (alltid full tilgang)

**Fremtidig:**
- Per-person overstyring innad i en gruppe (nå gjelder hele gruppen)

---

## 4. Flytregler

### Grunnprinsipp
Ett dokument reiser mellom mennesker. Én eier av gangen. Prosjekteier/admin er koblingspunktet når et dokument må involvere flere faggrupper (kun for sjekklister/oppgaver).

### Send-modal
Viser kun faggruppenavn — ikke roller eller tekniske termer. Kun faggrupper brukeren har tilgang til vises. Systemet vet selv at lederen (blå prikk) hos den valgte faggruppen mottar dokumentet.

### Eksempel — dokument på tvers av faggrupper

```
Faggruppe 1 (HE ↔ Elektro):
[Elektro] → [HE-Leder]

Faggruppe 2 (HE ↔ Tømrer):
[HE-Leder] → [Tømrer] → [HE-Leder]

Faggruppe 1 (fortsetter):
[HE-Leder] → [Elektro] → [HE-Leder] → lukkes
```

---

## 5. Redigerbarhet (Godkjenning)

Redigerbarhet er ikke en fast egenskap ved dokumenttypen, men en konfigurerbar regel per flytledd i malen.

### Per ledd defineres
- **Kan redigere**: ja / nei
- **Låses etter**: X antall passeringer forbi dette leddet
- **Tillat avvis**: ja / nei (konfigurerbart per mal)
- **Tillat send tilbake**: ja / nei (konfigurerbart per mal)

### Eksempel

| Ledd | Kan redigere | Låses etter |
|---|---|---|
| 1 | ✓ | 2 passeringer |
| 2 | ✓ | aldri |
| 3 | ✓ | 1 passering |
| 4 | ✗ | – |

### Viktig for datamodellen
Flytmal-strukturen må støtte per-ledd-konfigurasjon fra start for alle dokumenttyper, selv om feltene ikke er aktive ennå.

---

## 6. Statusoverganger og sporbarhet

### Status-overgangstabell

Validert via `isValidStatusTransition()` i `packages/shared/src/utils/index.ts`. Server (tRPC) og klient (knapp-visning) bruker samme funksjon — hold synkronisert. **A-3a 2026-07-17: web-menyen validerer nå mot tabellen** (utleder fra `hentRolleFiltrertHandlinger`, deaktiverer det statusmaskinen avviser) — tidligere fant den opp egne overganger.

**A-i 2026-07-17 (`rejected`-desync lukket):** `ROLLE_HANDLINGER.utforer.rejected` og `hentStatusHandlinger("rejected")` ga tidligere `rejected → responded`, som er **ulovlig** i tabellen under (→ server-`BAD_REQUEST`). Rettet til `rejected → in_progress` (i18n `statushandling.gjenoppta` = «Gjenoppta»). Veien er nå `rejected → in_progress → responded`, i tråd med tabellen. Merk: `in_progress` har to lovlige innganger — `received → in_progress` og `rejected → in_progress` — og førstnevnte tilbys fortsatt ikke i UI (åpent exit-funn, ikke bygget i A-3a).

| Fra | Lovlige overganger til |
|---|---|
| `draft` | `sent`, `cancelled` |
| `sent` | `received`, `cancelled` |
| `received` | `in_progress`, `responded`, `cancelled` |
| `in_progress` | `responded`, `sent`, `cancelled` |
| `responded` | `approved`, `rejected` |
| `approved` | `closed` |
| `rejected` | `in_progress`, `closed` |
| `closed` | (terminal — ingen overganger) |
| `cancelled` | `draft` |

**Note om `cancelled`:** Selv om kansellering historisk ble omtalt som «irreversibel», tillater koden `cancelled → draft`. Et kansellert dokument kan altså gjenåpnes som kladd hvis brukeren ombestemmer seg. Closed er den eneste virkelig terminale statusen.

### Status-terminologi i UI

UI-labels bruker norske ord uavhengig av dokumenttype. Verifisert 2026-04-27:

| Status-verdi | UI-label (nb) | i18n-nøkkel |
|---|---|---|
| `draft` | Kladd | `status.kladd` |
| `sent` | Sendt | `status.sendt` |
| `received` | Mottatt | `status.mottatt` |
| `in_progress` | Pågår | `status.paagaar` |
| `responded` | **Besvart** | `status.besvart` |
| `approved` | Godkjent | `status.godkjent` |
| `rejected` | Avvist | `status.avvist` |
| `closed` | Lukket | `status.lukket` |
| `cancelled` | Avbrutt | `status.avbrutt` |

**Status-label er felles for alle dokumenttyper** — sjekkliste, oppgave og godkjenning bruker samme label «Besvart» for `responded`. Eventuelle separate ord per type («utbedret» for sjekkliste, «besvart» for godkjenning) er ikke implementert i koden.

### Snapshot-felter på `document_transfers`

Hver overgang lagres som en rad i `document_transfers` med snapshot-felter som fanger kontekst på tidspunktet:

| Felt | Type | Beskrivelse |
|---|---|---|
| `senderEnterpriseName` | `String?` | Navn på avsendende faggruppe ved overlevering |
| `recipientEnterpriseName` | `String?` | Navn på mottakende faggruppe ved overlevering |
| `dokumentflytName` | `String?` | Navn på dokumentflyten dokumentet var i |
| `senderRolle` | `String?` | `bestiller` \| `utforer` \| `godkjenner` \| `registrator` |

**Viktig:** Snapshot-feltene `senderEnterpriseName` og `recipientEnterpriseName` ble **bevisst ikke renamet** av faggruppe-rename-migrasjonen (2026-04-16). De representerer en historisk verdi på overleveringstidspunktet — renaming ville gi tap av historisk sannhet og bryte sporbarheten. Dette er den **eneste** plassen i koden hvor `enterprise`-navngivning fortsatt er gyldig og forbudt-regelen ikke gjelder.

---

## 7. Tekniske felter

Sentrale modell-felter som styrer flyt-mekanikken. Full feltliste i [arkitektur.md](arkitektur.md).

### `Dokumentflyt.roller` — JSONB-konfigurerbare labels

Per dokumentflyt kan rolle-labels overstyres for prosjekt-spesifikk terminologi. Standard-rollene er `registrator` / `bestiller` / `utforer` / `godkjenner`, men UI viser kunde-spesifikke labels.

Feltet er et **array** av rolle-objekter (`{ rolle, label? }`) — ikke et objekt nøklet på rolle-navn. Se `schema.prisma:1192` (typen) og bruken i `dokumentflyt.ts:120`. Hver rolle er valgfri; mangler `label`, brukes default-rolle-navnet.

### `DokumentflytMedlem` — flytsteg-medlemskap

| Felt | Type | Beskrivelse |
|---|---|---|
| `rolle` | `String` | `registrator` \| `bestiller` \| `utforer` \| `godkjenner` |
| `steg` | `Int` | Hvilket steg i flyten (rekkefølge) |
| `kanRedigere` | `Boolean default true` | Toggle i dokumentflyt-oppsett — false gir kun lesetilgang selv med ballen |
| `låsesEtterPasseringer` | `Int?` | Per-ledd låsbarhet — feltet finnes, logikken er ikke implementert ennå |
| `erHovedansvarlig` | `Boolean` | Markerer hovedansvarlig på flytsteget |
| `hovedansvarligPersonId` | `String?` | FK til spesifikk User som hovedansvarlig |
| `faggruppeId` / `projectMemberId` / `groupId` | `String?` | Ett av disse settes per medlem (faggruppe ELLER konkret person ELLER prosjektgruppe) |

`kanRedigere`-toggelen sjekkes av `utledDokumentRettighet()` i `packages/shared/src/utils/flytRolle.ts`. Admin/registrator er upåvirket (alltid full tilgang).

---

## 8. Validering ved opprettelse av faggrupper

Systemet skal advare brukeren når dokumentflyt-oppsett er ugyldig:
- Ingen leder (blå prikk) definert i en gruppe
- Samme gruppe på begge sider av flyten
- Flyt uten mottaker
- Godkjenningsflyt som går på tvers av faggrupper

---

## 9. Fremtidige utvidelser

- **Per-ledd låsbarhet** — `låsesEtterPasseringer` finnes i schema, ikke implementert ennå
- **Per-person rettighet innad i gruppe** — overstyring av kanRedigere per gruppeperson (nå gjelder hele gruppen)
- **Lenking mellom dokumenter** — referanser/vedlegg på tvers av flyter uten at dokumentet reiser
- **Tildeling til person** — leder tildeler dokument til spesifikk ansatt innen faggruppen
- **Varsling** — tildelt person varsles når de får ballen
- **Flytvisualisering i dokumentlisten** — kompakt visuell indikator per rad: `[Elektro] →●→ [HE] → [Tømrer]`
- **Konfigurerbare godkjenningsregler per mal** — avvis, send tilbake, antall nivåer
- **Flere HMS-grupper per prosjekt**
- **Mobilapp handlingsmeny** — portering av ny Send-dropdown og flytindikator til React Native

---

## 10. Relaterte dokumenter

- [terminologi.md](terminologi.md) — definisjoner av Faggruppe, Bestiller, Utfører, Snapshot-pattern og status-handlinger
- [arkitektur.md](arkitektur.md) — full datamodell for `Dokumentflyt`, `DokumentflytMedlem`, `Checklist`, `Task`, `DocumentTransfer` og tilgangskontroll-funksjoner
- [forretningslogikk.md](forretningslogikk.md) — handlingsknapper, rollefiltrering og operative regler
- [fase-0-beslutninger.md](fase-0-beslutninger.md) — A.2 Godkjenning som utvidet dokumentflyt-type, A.7 hybrid logg + snapshot ved attestering
