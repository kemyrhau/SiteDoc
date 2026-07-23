# Rettighetsmatrise — config-modell + admin-UI-design (rev. 6, 2026-07-24 — kant 4 firma-styrt; Kloss 2b respec)

TIL REPO: docs/claude/delplaner/rettighetsmatrise-config-design.md (erstatter a7e69d20; cowork plasserer; fabel etterleser).
Grunnlag: `flytmodell-overgangsmatrise.md` (§ FUNDAMENT-GAP) · flytmodell-vedtak § 1–6 + restvedtak · UI-fasit `P1 Nivåsignal Beslutningskart.dc.html` § 5a + cellespec `Flyt-rettigheter Cellespec.dc.html`. Kloss 1+2 LANDET (se B-klosser nederst).

## 0. Formål — REFRAMET (Kenneth-vedtak 2026-07-24)

Matrisen er et **sentralisert operatør-verktøy**: sitedoc-admin justerer flyt-regler uten omkoding. Den er IKKE kunde-selvbetjening — Kenneth vil ikke ha ti firmaer med ti divergerende flyter (feilsøkings-mareritt). Per-firma-override finnes i modellen (vedtak 4), men styres sentralt av sitedoc-admin.

## 1. Config-modell: DELTA, ikke materialisert kopi (fabels innstilling — realisert i Kloss 1)

Vedtak 4 sier «per-firma config, seedet fra defaults». To måter å realisere «seedet» på:

**(a) Materialisert:** kopiér hele default-matrisen inn som rader per firma ved opprettelse/migrering.
**(b) Delta (valgt, bygget):** defaults forblir kode (`ROLLE_HANDLINGER_DEFAULTS` i `@sitedoc/shared`); DB lagrer KUN firmaets avvik. Effektiv rettighet = default ⊕ override.

Hvorfor (b): (1) default-forbedringer (som vedtak 2/3 selv!) når alle firmaer uten migrering av N kopier — med (a) fryses hvert firma på seed-øyeblikkets defaults og drifter; (2) «Tilbakestill til standard» = slett override-raden, trivielt; (3) endringsloggen blir semantisk ren — hver rad ER en admin-beslutning, ikke seed-støy; (4) dagens Sets-fallback (sikkerhetsrammen) er identisk med default-laget — ett substrat, ingen duplisert logikk. Avvik fra vedtakets ordlyd «seedet» flagget eksplisitt; intensjonen (firma starter på defaults, admin overstyrer) er oppfylt.

### Datamodell (bygget i Kloss 1, migrering `20260723120000`)
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

### Runtime-lesing (delt kilde, server håndhever — bygget i Kloss 1)
`hentRolleFiltrertHandlinger` / `erTillattForRolle` med valgfri `overrides`-param (loader `hentFlytRettighetOverrides(orgId)`, trådd via `verifiserFlytRolle`). Oppslagsrekkefølge per celle: override → default. **Deretter statusmaskin-snittet:** override-only-snitt mot `validTransitions` — en override kan aldri skape en overgang (vedtak 1); håndhevet i delt funksjon, ikke UI. Tom map = bit-identisk med i dag (bevist av uendrede tester + invariant-tester). Web + mobil + server konsulterer samme funksjon (A-3a-mønsteret).

### Ikke-konfigurerbart (låst i kode, vises låst i UI)
- P2-kommentarkrav (◀ og Lukk·trukket) — lov, ikke config.
- «Oppretter ser alltid sitt eget dokument»-invarianten.
- Auto-overganger: `sent→received` (kollaps ved send, sjekkliste.ts:924) og `received→in_progress` (lesekvittering, restvedtak 2) — ingen rolle-celler; rendres som «Auto»-merke.

## 1b. Admin-nivå-modellen (rev. 4 — synket mot Kloss 2 som landet + Kenneth-vedtak 2026-07-24)

**Fakta (cowork-målt):** to erAdmin-beregninger — **flyt-erAdmin** (`hentMinFlytInfo`) = `sitedoc_admin` ELLER prosjektadmin; **general-erAdmin** (`verifiserAdminEllerFirmaansvarlig`) inkluderer firma-admin. `erAdmin` = 272 forekomster i 61 filer → `adminNiva`-enum ble containet til flyt-funksjonene (Kloss 2, boolean-shim holder Kloss 1-testene bit-identiske). Firma-admin bor i `OrganizationMember.firmaRoller="firma_admin"`.

**Nivåene slik de faktisk står etter Kloss 2 (a3e2cc66):**

| Nivå | Kilde | Status i koden | I matrisen |
|---|---|---|---|
| **SITEDOC-ADMIN** | `sitedoc_admin` | `adminNiva="sitedoc"` — full, kode | IKKE en kolonne; fotnote/header-merke |
| **PROSJ.ADMIN** | `ProjectMember.role=admin` | `adminNiva="prosjekt"` — **full innenfor statusmaskinen (isValid-arv)**, Kenneth-vedtak underveis i Kloss 2 (ikke «tom» — tom=nektet ville regressert) | Egen redigerbar kolonne |
| **FIRMA-ADMIN** | `firmaRoller="firma_admin"` | **`adminNiva=null` — DROPPET som flyt-nivå i Kloss 2**; `verifiserFlytRolle` kaster «Ikke medlem» | Ingen kolonne i dag → **Kloss 2b** |

**Hierarki-invariant — KENNETH-VEDTAK 2026-07-24: løses ved MEDLEMSKAP, ikke nytt flyt-nivå.** Firma-admin må kunne det samme som egen prosjektleder — men ikke via `adminNiva="firma"`/arv-union. I stedet: **ny firma-innstilling «firma-admin settes automatisk som prosjektadmin ved prosjektoppretting»** (opt-in per firma, `OrganizationSetting`). Når på: prosjektoppretting legger firmaets firma-admin(er) til som `ProjectMember.role=admin`. Da flyter ALT eksisterende maskineri uendret — `adminNiva="prosjekt"` gjelder, `verifiserFlytRolle` røres ikke, ingen `rolle="firmaadmin"` i matrisen, ingen arv-celletilstand. Cowork-verifisert grunnlag står: firma-admin kan alt selv-tildele seg prosjektadmin (medlem.leggTil → verifiserAdmin → O-3a firma-fallback) — innstillingen automatiserer bare omveien.

**Kanter Opus må håndtere i Kloss 2b (Kenneth-presisert 2026-07-24: gjelder KUN nye prosjekter):** (1) eksisterende prosjekter berøres IKKE — ingen backfill, ingen engangs-handling; der brukes omveien (manuell tildeling, som i dag); (2) firma-admin utnevnt ETTER prosjektoppretting — dekkes ikke av auto-regelen; omveien finnes, dokumenteres; (3) fjernet firma-admin — medlemskapet består (vanlig medlemsforvaltning), fjernes manuelt; (4) hvem auto-legges — **KENNETH-KORREKSJON 2026-07-24: firma-styrt, ikke hardkodet «alle».** Firmaet velger selv i firma-UI-innstillingene hvem som auto-legges som prosjektadmin ved nytt prosjekt. Første konkrete skive av ett-klikks-prosjektoppsett-visjonen (BACKLOG: faste prosjektledere/-admin per kontorsted/avdeling).

**Respec Kloss 2b — fabels innstilling: (a) minimal v1, fremtidssikret datamodell.** V1 = opt-in med to verdier synlige i UI, men lagret som utvidbar enum, IKKE boolean: `autoProsjektAdmin: "av" | "alle_firma_admins"` (senere: `"utvalg"` + relasjonstabell for per-person/per-avdeling — ny enum-verdi + tabell, ingen semantikk-migrering). Per-person/kontorsted/avdeling-utvalget hører hjemme i umbrella-UI-en for ett-klikks-prosjektoppsett (egen delplan) — å bygge utvalgs-UI nå er å designe umbrella-en stykkevis uten helheten (målestokk 1: enklest mulig; pilotfrist). Alternativ (b) står beskrevet hvis Kenneth vil ha utvalget straks.

**(b) Hvem redigerer matrisen — KENNETH-VEDTAK 2026-07-24: KUN sitedoc-admin, PERMANENT** (ikke «fase 2 for firma-admin»). Følger av § 0-reframingen: verktøyet er sentralisert drift, ikke selvbetjening. `kanRedigereFlytMatrise` = sitedoc_admin only (som bygget i Kloss 2 — står). Prosjektadmin/firma-admin: aldri config-rett; deres makt er cellene, ikke matrisen.

**(c) Låst per nivå:** SITEDOC-ADMIN helt (kode, ikke vist). PROSJ.ADMIN-celler: frie innenfor statusmaskin-snittet + lov-cellene. Redigeringsretten selv er låst kode.

~~**Datamodell-konsekvens (2b):** `rolle`-feltet utvides med `"firmaadmin"`~~ — UTGÅR (rev. 5): ingen firmaadmin-rolle i matrisen; firma-admin får rettigheter som prosjektadmin-medlem.

## 1c. Plassering — KENNETH-VEDTAK 2026-07-24: Admin-flaten

Siden flyttes fra FIRMA-sidemenyen (`dashbord/firma/flyt-rettigheter`, brøt K5: sidebar = arbeidsflater, konfig ikke der) til **Admin-flaten** (topbar Admin-shield). Fabels hub-innstilling var betinget av firma-admin-eierskap; med config-rett permanent sitedoc-only er Admin-flaten riktig hjem (fabels egen betingelse). Firma-velger i Admin-konteksten avgjør hvilket firmas matrise som vises.

## 2. UI (fasit § 5a + cellespec — deltaer)
Matrise rolle × status per § 5a-mockupen. **Celle-tilstander (visuell spec: `Flyt-rettigheter Cellespec.dc.html`, fabel 2026-07-23 — svar på Kenneths kontrast-funn):**
1. **Standard på** — fylt #059669, hvit hake (hvit-på-#10b981 ga ~2,3:1 — for svakt; #10b981 forblir semantisk success ellers) · 2. **Standard av** — tom ramme #a8a49b (ikke strek) · 3. **Overstyrt** — amber-prikk #d97706 øverst til høyre + tooltip (hvem/når/«Tilbakestill») · 4. **Auto** — grå fylt boks «A», ikke klikkbar, tooltip · 5. **Låst** — hengelås på #f1efe9, tooltip m/ begrunnelse. Regel: **fylt = på, ramme = av** — form skiller, ikke bare farge. Hover på redigerbar celle: blå ramme.
- Endringslogg-fane: flat liste fra `FlytRettighetLogg` (celle · fra→til · hvem · når). ✅ Levert i Kloss 2.
- Les/rediger-fane: VISER `task_edit`/`checklist_edit` per kategori + `DokumentflytMedlem.kanRedigere` (flytRolle.ts:155–199) — ren visning, ingen ny modell (vedtak 5). ✅ Levert i Kloss 2. Forbeholdet står: oppgave-redigering = append, måles ved utvidelse.
- HMS-synlighet: eget UI, ikke i denne flaten (vedtak 6).
- Lagring: per celle-klikk med umiddelbar server-validering (statusmaskin-snittet), ikke skjema-batch — matcher endringslogg-granulariteten. ✅ Levert i Kloss 2.

## 3. Gjenåpne fra `closed` — VEDTATT (Kenneth 2026-07-23)

**`closed → draft` = JA, som konfigurerbar matrise-celle** — default kun-admin + «Farlig sone» (kommentar + bekreftelsesdialog); IKKE låst — matrisen kan slå den på for andre roller. Går inn i A-laget sammen med `rejected→sent`.

Historikk (drøftingen): restvedtakets kø-linje nevnte `closed→draft` uten vedtaksparagraf (dok-drift). Begrunnelse for JA: uten den er `closed` irreversibel — feillukking (inkl. `rejected→closed`) kan bare repareres ved duplisering, som knekker sporbarhet; men gjenåpning reverserer en godkjenningskjede → strengere default enn `cancelled→draft` (bestiller+admin).

## Sekvens (rev. 4)
Gjenstår: **Kloss 2c** — plassering til Admin-flaten (§ 1c) + cellespec-kontrasten (§ 2) — liten, isolert runde, cowork gater. **Kloss 2b (omdefinert)** — firma-innstilling auto-prosjektadmin (§ 1b). A-lag-resten (rejected→sent, closed→draft, ROLLE_HANDLINGER-endringer per FUNDAMENT-GAP § A.3) der de ikke alt er landet. Deretter A-3b perspektiv-visning oppå komplett fundament.

### B-klosser — status (2026-07-24)

- **✅ Kloss 1 — config-plumbing (LANDET, merge `33c32f1f`, develop).** Delta-substratet fra § 1: tabellene, `ROLLE_HANDLINGER_DEFAULTS`, `celleTillatt()` m/ override-only-snitt, `overrides?`-param, loader trådd via `verifiserFlytRolle`. Bit-identisk bevist (uendrede tester grønne + invariant-tester). Migrering `20260723120000` idempotent, additiv. 🔴 **Migrerings-avhengighet:** neste test-deploy av develop MÅ kjøre `migrate deploy` mot `sitedoc_test` — ellers krasjer flyt-rettighets-sjekken.
- **✅ Kloss 2 — adminNiva + matrise-UI (LANDET, merge `a3e2cc66`, develop, PR #3).** `adminNiva: "sitedoc"|"prosjekt"|null` containet til flyt-funksjonene (boolean-shim). Prosjektadmin = redigerbar kolonne, full innenfor statusmaskinen (isValid-arv). Matrise-UI (sitedoc-gatet), 5 celle-tilstander, logg-skriving, `kanRedigereFlytMatrise = sitedoc_admin only`. Fase A-korreksjon: «mobil prosjektadmin under-servert» var feil hypotese; eneste reelle divergens var firma-admin-fantomet — fjernet. Non-regresjon bevist (mutasjonene validerer `isValidStatusTransition` uavhengig).
- **🟡 Kloss 2b (respec rev. 6) — firma-innstilling «auto-prosjektadmin»** (§ 1b): opt-in `OrganizationSetting`, enum `autoProsjektAdmin: "av"|"alle_firma_admins"` (utvidbar til utvalg i umbrella-delplanen); prosjektoppretting (prosjekt.opprett + de to andre stiene — cowork-målt hook-punkt) legger valgte til som `ProjectMember.role=admin`. Ingen adminNiva-endring, ingen firmaadmin-rolle, verifiserFlytRolle røres ikke. Kanter 1–4 i § 1b.
- **🟡 Kloss 2c — plassering (Admin-flaten, § 1c) + cellespec-kontrast (§ 2)** — liten, isolert; cowork gater.
- **✅ Kloss 3 — endringslogg-fane + les/rediger-fane:** levert i Kloss 2; egen runde kun ved utvidelse.
