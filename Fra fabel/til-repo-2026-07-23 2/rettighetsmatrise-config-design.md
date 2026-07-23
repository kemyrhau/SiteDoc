# Rettighetsmatrise — config-modell + admin-UI-design (fabel-vurdering 2026-07-23, rev. 2 etter Kenneth-svar)

TIL REPO: docs/claude/delplaner/rettighetsmatrise-config-design.md (cowork plasserer; fabel etterleser).
Grunnlag: `flytmodell-overgangsmatrise.md` (§ FUNDAMENT-GAP) · flytmodell-vedtak § 1–6 + restvedtak · UI-fasit `P1 Nivåsignal Beslutningskart.dc.html` § 5a. Sekvens: A (statusmaskin-kode, cowork) ∥ dette designet → B build → A-3b oppå.
Alle kodepåstander her er lest av fabel i repoet 2026-07-23 — **cowork verifiserer** før ordre (arbeidsmetoden ledd 2).

## 1. Config-modell: DELTA, ikke materialisert kopi (fabels innstilling)

Vedtak 4 sier «per-firma config, seedet fra defaults». To måter å realisere «seedet» på:

**(a) Materialisert:** kopiér hele default-matrisen inn som rader per firma ved opprettelse/migrering.
**(b) Delta (innstilling):** defaults forblir kode (`ROLLE_HANDLINGER_DEFAULTS` i `@sitedoc/shared` — dagens `statusHandlinger.ts:130` omdøpt/eksportert); DB lagrer KUN firmaets avvik. Effektiv rettighet = default ⊕ override.

Hvorfor (b): (1) default-forbedringer (som vedtak 2/3 selv!) når alle firmaer uten migrering av N kopier — med (a) fryses hvert firma på seed-øyeblikkets defaults og drifter; (2) «Tilbakestill til standard» = slett override-raden, trivielt; (3) endringsloggen blir semantisk ren — hver rad ER en admin-beslutning, ikke seed-støy; (4) dagens Sets-fallback (sikkerhetsrammen) er identisk med default-laget — ett substrat, ingen duplisert logikk. Avvik fra vedtakets ordlyd «seedet» flagges herved eksplisitt; intensjonen (firma starter på defaults, admin overstyrer) er oppfylt.

### Datamodell (forslag — navneform følger repo-konvensjon, cowork justerer)
```
FlytRettighetOverride            # gjeldende tilstand, unik (orgId, rolle, fraStatus, tilStatus)
  orgId · rolle (DokumentflytRolle | "prosjektadmin") · fraStatus ("nytt" | DocumentStatus)
  tilStatus (DocumentStatus | "opprett") · tillatt boolean
  endretAvUserId · endretAt

FlytRettighetLogg                # append-only, vedtak 4
  orgId · rolle · fraStatus · tilStatus · fraVerdi (default/på/av) · tilVerdi
  endretAvUserId · endretAt · kilde ("admin-ui" | "migrering")
```
- **Rad «(nytt)·Opprett»** (vedtak 1): opprett er ingen statusovergang — modelleres som sentinel `fraStatus="nytt"`, `tilStatus="opprett"`. Samme tabell, ingen egen modell.
- **Per firma nå, per flyt senere** (vedtak 4): nullable `dokumentflytId` reserveres IKKE nå — legges til den dagen behovet vedtas (YAGNI; unik-nøkkelen må uansett endres da).
- Presedens: `OrganizationSetting` er 1:1-bred-tabell — feil form for en matrise; egen tabell er riktig her.

### Runtime-lesing (delt kilde, server håndhever)
`hentRolleFiltrertHandlinger` / `erTillattForRolle` (statusHandlinger.ts:76/104) får en valgfri `overrides`-parameter (map slått opp per org, cachet per request). Oppslagsrekkefølge per celle: override → default. **Deretter statusmaskin-snittet:** resultatet skjæres ALLTID mot `validTransitions` (index.ts:88) — en override kan aldri skape en overgang (vedtak 1); invarianten håndheves i den delte funksjonen, ikke i UI. Uten overrides (map tom/utilgjengelig) er atferden bit-identisk med i dag = sikkerhetsrammens fallback. Web + mobil + server konsulterer samme funksjon (A-3a-mønsteret); mobil re-verifiseres i gaten (A3b-regelen).

### Ikke-konfigurerbart (låst i kode, vises låst i UI)
- P2-kommentarkrav (◀ og Lukk·trukket) — lov, ikke config.
- «Oppretter ser alltid sitt eget dokument»-invarianten.
- Auto-overganger: `sent→received` (kollaps ved send, sjekkliste.ts:924) og `received→in_progress` (lesekvittering, restvedtak 2) — ingen rolle-celler; rendres som «Auto»-merke.
- ~~ADMINISTRATOR-kolonnen låst~~ **ERSTATTET av admin-nivå-modellen (§ 1b) — Kenneth 2026-07-23: firma-admin og sitedoc-admin skal skilles.**

## 1b. Admin-nivå-modellen (Kenneth-bestilt 2026-07-23)

**Fakta (cowork-målt, verifiseres videre under design):** dagens `erAdmin` kollapser `sitedoc_admin` + prosjektadmin til ETT flagg; `company_admin` er ikke i beregningen — firma-admin har i dag ingen admin-makt i flyten. Å skille nivåene betyr at delt-kilde-funksjonene bytter `erAdmin: boolean` → `adminNiva: "sitedoc" | "firma" | "prosjekt" | null`. **Cowork måler omfanget:** alle `erAdmin`-kallsteder + hvor `company_admin` faktisk lever i modellen.

Tre nivåer, tre ulike plasser i matrisen (fabels innstilling):

| Nivå | Kilde | I matrisen | Redigerbar? |
|---|---|---|---|
| **SITEDOC-ADMIN** | `sitedoc_admin` (cross-tenant, Kenneth) | **IKKE en kolonne** — fulltilgang er kode, står som fotnote/header-merke i UI-et. Å vise den i hvert firmas matrise er støy og inviterer til å tro den kan endres | Nei (kode) |
| **FIRMA-ADMIN** | `company_admin` | **Egen kolonne**, konfigurerbar celle for celle — **default: full** (alle statusmaskin-lovlige celler på). Kundens org-admin skal eie flyten sin uten Kenneth | Ja |
| **PROSJ.ADMIN** | `ProjectMember.role=admin` | Egen kolonne, **tom default** (vedtak 1, uendret) | Ja |

**(b) Hvem redigerer matrisen** — config-retten er IKKE en matrise-celle (matrisen styrer dokument-handlinger, ikke config; dermed kan ingen låse seg selv ute via egne celler). Egen kapabilitet i kode, `kanRedigereFlytMatrise(user, org)`:
- `sitedoc_admin`: alltid, alle firmaer (vedtak 1) + «tilbakestill firma til standard».
- `company_admin`: eget firmas matrise, under sitedoc-tak (sitedoc_admin ser endringsloggen og kan tilbakestille). **Innstilling: ja fra start** — pilot ~50 ansatte, Kenneth skal ikke være flaskehals for kunde-tilpasning; loggen + tilbakestill er sikkerhetsnettet. Minste-bygg-alternativ (kun sitedoc_admin i fase 1, firma-admin i fase 2) står som nedskalering hvis A-laget vokser.
- prosjektadmin: nei.

**(c) Låst per nivå:** SITEDOC-ADMIN helt (kode, ikke vist). FIRMA-ADMIN/PROSJ.ADMIN: cellene frie innenfor statusmaskin-snittet + lov-cellene (P2, invarianten, Auto) som for alle roller. Redigeringsretten selv er låst kode per over.

**Datamodell-konsekvens:** `rolle`-feltet i `FlytRettighetOverride`/`FlytRettighetLogg` utvides: `DokumentflytRolle | "prosjektadmin" | "firmaadmin"`. Defaults-laget i kode får tilsvarende to nye nøkler (firmaadmin = full, prosjektadmin = tom).

## 2. UI (fasit § 5a — kun deltaer her)
Matrise rolle × status per § 5a-mockupen. Nytt fra config-modellen — **celle-tilstander:**
1. **Standard på** (hake, nøytral) · 2. **Standard av** (tom) · 3. **Overstyrt** (hake/tom + prikk-markør «endret fra standard», tooltip: hvem/når, handling «tilbakestill») · 4. **Auto** (grå «A», ikke klikkbar) · 5. **Låst** (ADMINISTRATOR-kolonnen + lov-celler, hengelås-hint).
- Endringslogg-fane: flat liste fra `FlytRettighetLogg` (celle · fra→til · hvem · når).
- Les/rediger-fane: VISER `task_edit`/`checklist_edit` per kategori + `DokumentflytMedlem.kanRedigere` (flytRolle.ts:155–199) — ren visning, ingen ny modell (vedtak 5). Forbeholdet står: oppgave-redigering = append, måles ved bygging.
- HMS-synlighet: eget UI, ikke i denne flaten (vedtak 6).
- Lagring: per celle-klikk med umiddelbar server-validering (statusmaskin-snittet), ikke skjema-batch — matcher endringslogg-granulariteten.

## 3. Gjenåpne fra `closed` — VEDTATT (Kenneth 2026-07-23)

**`closed → draft` = JA, som konfigurerbar matrise-celle** — default kun-admin + «Farlig sone» (kommentar + bekreftelsesdialog); IKKE låst — matrisen kan slå den på for andre roller. Går inn i A-laget sammen med `rejected→sent`. Opprinnelig drøfting under (historikk):

**Fakta:** restvedtakets kø-linje nevner `closed→draft` som forutsetning for matrise-ordren, og overgangsmatrisen fører den som «vedtatt i tillegg» — men **ingen vedtaksparagraf beslutter den**; restvedtak § 1–3 omtaler kun `cancelled→draft` (finnes i kode, bestiller+admin) og `rejected→closed` (kun admin). Kø-linjen er drift, ikke vedtak — spørsmålet er reelt åpent.

**Fabels innstilling: JA til `closed→draft`, men kun-admin default + «Farlig sone»** (kommentar obligatorisk + bekreftelsesdialog, samme mønster som Lukk·trukket):
- Uten den er `closed` irreversibel — en feillukking (inkl. admins egen `rejected→closed`) kan bare repareres ved å duplisere dokumentet, som knekker historikk/sporbarhet.
- Men `closed` er happy-path-terminalen ETTER godkjenning — gjenåpning reverserer en godkjenningskjede. Derfor strengere enn `cancelled→draft` (bestiller+admin): kun admin, aldri utvidbar under admin-nivå i matrisen? — nei, matrisen kan slå den på for andre (vedtak 1-rammen), men DEFAULTEN er kun admin.
- Alternativet (kun `cancelled→draft`) er konsistent, men gjør `rejected→closed` til en felle.

## Sekvens (oppdatert)
Cowork lander A-laget: `rejected→sent` + `closed→draft` + ROLLE_HANDLINGER-endringene (FUNDAMENT-GAP § A.3) **+ måler erAdmin-splitten (§ 1b) og company_admins flyt-status** → B-ordre skrives på dette designet. Enkeltmålt premiss flagges: «company_admin er ikke i erAdmin-beregningen» er cowork-målt én gang — bekreftes i A-lagets måling.
