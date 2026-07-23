# Rettighetsmatrise — config-modell + admin-UI-design (fabel-vurdering 2026-07-23)

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
- ADMINISTRATOR-kolonnen: **forslag** — vises fullt hukket men LÅST (admins fulltilgang er kode via `erAdmin`, ikke config). Å gjøre den redigerbar åpner for at et firma låser ute sin egen admin. PROSJ.ADMIN-kolonnen er den redigerbare admin-aksen (tom default, vedtak 1). Kenneth-bekreftelse ønskes (liten).

## 2. UI (fasit § 5a — kun deltaer her)
Matrise rolle × status per § 5a-mockupen. Nytt fra config-modellen — **celle-tilstander:**
1. **Standard på** (hake, nøytral) · 2. **Standard av** (tom) · 3. **Overstyrt** (hake/tom + prikk-markør «endret fra standard», tooltip: hvem/når, handling «tilbakestill») · 4. **Auto** (grå «A», ikke klikkbar) · 5. **Låst** (ADMINISTRATOR-kolonnen + lov-celler, hengelås-hint).
- Endringslogg-fane: flat liste fra `FlytRettighetLogg` (celle · fra→til · hvem · når).
- Les/rediger-fane: VISER `task_edit`/`checklist_edit` per kategori + `DokumentflytMedlem.kanRedigere` (flytRolle.ts:155–199) — ren visning, ingen ny modell (vedtak 5). Forbeholdet står: oppgave-redigering = append, måles ved bygging.
- HMS-synlighet: eget UI, ikke i denne flaten (vedtak 6).
- Lagring: per celle-klikk med umiddelbar server-validering (statusmaskin-snittet), ikke skjema-batch — matcher endringslogg-granulariteten.

## 3. Åpen overgang: gjenåpne fra `closed`? (Kenneth-vedtak kreves)

**Fakta:** restvedtakets kø-linje nevner `closed→draft` som forutsetning for matrise-ordren, og overgangsmatrisen fører den som «vedtatt i tillegg» — men **ingen vedtaksparagraf beslutter den**; restvedtak § 1–3 omtaler kun `cancelled→draft` (finnes i kode, bestiller+admin) og `rejected→closed` (kun admin). Kø-linjen er drift, ikke vedtak — spørsmålet er reelt åpent.

**Fabels innstilling: JA til `closed→draft`, men kun-admin default + «Farlig sone»** (kommentar obligatorisk + bekreftelsesdialog, samme mønster som Lukk·trukket):
- Uten den er `closed` irreversibel — en feillukking (inkl. admins egen `rejected→closed`) kan bare repareres ved å duplisere dokumentet, som knekker historikk/sporbarhet.
- Men `closed` er happy-path-terminalen ETTER godkjenning — gjenåpning reverserer en godkjenningskjede. Derfor strengere enn `cancelled→draft` (bestiller+admin): kun admin, aldri utvidbar under admin-nivå i matrisen? — nei, matrisen kan slå den på for andre (vedtak 1-rammen), men DEFAULTEN er kun admin.
- Alternativet (kun `cancelled→draft`) er konsistent, men gjør `rejected→closed` til en felle.

Kenneth bekrefter/avviser → cowork lander A-laget (rejected→sent + ev. closed→draft + ROLLE_HANDLINGER-endringene fra FUNDAMENT-GAP § A.3) → B-ordre skrives på dette designet.
