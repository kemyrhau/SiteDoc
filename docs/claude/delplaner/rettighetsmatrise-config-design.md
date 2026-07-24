# Rettighetsmatrise — config-modell + admin-UI-design (rev. 7, 2026-07-24 — Kenneth-vedtak: GLOBAL konfig, ikke per-firma)

TIL REPO: docs/claude/delplaner/rettighetsmatrise-config-design.md (erstatter a7e69d20; cowork plasserer; fabel etterleser).
Grunnlag: `flytmodell-overgangsmatrise.md` (§ FUNDAMENT-GAP) · flytmodell-vedtak § 1–6 + restvedtak · UI-fasit `P1 Nivåsignal Beslutningskart.dc.html` § 5a + cellespec `Flyt-rettigheter Cellespec.dc.html`. Kloss 1+2 LANDET (se B-klosser nederst).

## 0. Formål — REFRAMET (Kenneth-vedtak 2026-07-24)

Matrisen er et **sentralisert operatør-verktøy**: sitedoc-admin justerer flyt-regler uten omkoding. Den er IKKE kunde-selvbetjening — Kenneth vil ikke ha ti firmaer med ti divergerende flyter (feilsøkings-mareritt). **KENNETH-VEDTAK 2026-07-24 (sett på test): ÉN GLOBAL konfig — ikke per-firma.** Per-firma-dimensjonen reverseres: orgId-nøklingen (Kloss 1) og firma-dropdownen (2c) var konsekvensen av vedtak 4s ordlyd; vedtak 4 revideres til: rettighetene er global sitedoc-config (kode-defaults + globale overstyringer), lest i runtime, bundet av statusmaskinen (vedtak 1 står).

## 1. Config-modell: DELTA, global (rev. 7)

Delta-modellen består (fabels opprinnelige begrunnelse — kode-defaults + DB-avvik, «tilbakestill» = slett rad, ren endringslogg, ett substrat med Sets-fallbacken): defaults i `ROLLE_HANDLINGER_DEFAULTS` (`@sitedoc/shared`); DB lagrer KUN avvik. Effektiv rettighet = default ⊕ override. **Rev. 7: overstyringene er GLOBALE.**

### Datamodell (rev. 7 — revisjons-ordre på merget Kloss 1)
```
FlytRettighetOverride            # gjeldende tilstand, unik (rolle, fraStatus, tilStatus) — GLOBAL
  rolle (DokumentflytRolle | "prosjektadmin") · fraStatus ("nytt" | DocumentStatus)
  tilStatus (DocumentStatus | "opprett") · tillatt boolean
  endretAvUserId · endretAt

FlytRettighetLogg                # append-only
  rolle · fraStatus · tilStatus · fraVerdi (default/på/av) · tilVerdi
  endretAvUserId · endretAt · kilde ("admin-ui" | "migrering")
```
- **orgId DROPPES** (fabel tiltrer cowork-anbefalingen): schema-endring framfor sentinel-org — vestigial kolonne er permanent forvirring; ingenting på prod, test-data kastbart. Ny migrering; unik-nøkkel = (rolle, fraStatus, tilStatus). tRPC dropper orgId-param.
- **Rad «(nytt)·Opprett»** (vedtak 1): sentinel `fraStatus="nytt"`, `tilStatus="opprett"`. Samme tabell.
- **Per flyt senere:** `dokumentflytId` reserveres IKKE (YAGNI, som før). Gjenoppstår per-firma-behovet, er det ny nullable kolonne + nøkkelendring — samme kostnad da som nå.

### Runtime-lesing (delt kilde, server håndhever)
`hentRolleFiltrertHandlinger` / `erTillattForRolle` med valgfri `overrides`-param — loader `hentFlytRettighetOverrides()` (uten orgId; returnerer global konfig for alle; cache trivielt global), fortsatt trådd via `verifiserFlytRolle`. Oppslagsrekkefølge per celle: override → default. **Deretter statusmaskin-snittet:** override-only-snitt mot `validTransitions` — en override kan aldri skape en overgang (vedtak 1); håndhevet i delt funksjon, ikke UI. Tom map = bit-identisk med i dag (bevist av uendrede tester + invariant-tester). Web + mobil + server konsulterer samme funksjon (A-3a-mønsteret).

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

Siden flyttes fra FIRMA-sidemenyen (`dashbord/firma/flyt-rettigheter`, brøt K5: sidebar = arbeidsflater, konfig ikke der) til **Admin-flaten** (topbar Admin-shield). Med config-rett permanent sitedoc-only OG global modell er Admin-flaten riktig hjem. ~~Firma-velger i Admin-konteksten~~ — UTGÅR (rev. 7): én global matrise, ingen dropdown.

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

## Sekvens (rev. 7)
Gjenstår: **Revisjons-ordre global modell** (§ 0/§ 1 — berører merget Kloss 1/2/2c: orgId-dropp, loader/tRPC uten orgId, UI uten firma-dropdown; cowork skriver ordren på denne respec-en). **Kloss 2b** — firma-innstilling auto-prosjektadmin (§ 1b; UBERØRT av rev. 7 — medlemskaps-løsningen er per-firma per design og har ingenting med matrisens orgId å gjøre). A-lag-resten (rejected→sent, closed→draft, ROLLE_HANDLINGER-endringer per FUNDAMENT-GAP § A.3) der de ikke alt er landet. Deretter A-3b perspektiv-visning oppå komplett fundament.

### B-klosser — status (2026-07-24)

- **✅ Kloss 1 — config-plumbing (LANDET, merge `33c32f1f`, develop).** Delta-substratet: tabellene, `ROLLE_HANDLINGER_DEFAULTS`, `celleTillatt()` m/ override-only-snitt, `overrides?`-param, loader trådd via `verifiserFlytRolle`. Bit-identisk bevist. 🔴 Rev. 7-revisjon: orgId droppes (ny migrering), loader/tRPC uten orgId.
- **✅ Kloss 2 — adminNiva + matrise-UI (LANDET, merge `a3e2cc66`, develop, PR #3).** `adminNiva: "sitedoc"|"prosjekt"|null` containet til flyt-funksjonene (boolean-shim). Prosjektadmin = redigerbar kolonne, full innenfor statusmaskinen (isValid-arv). Matrise-UI (sitedoc-gatet), 5 celle-tilstander, logg-skriving, `kanRedigereFlytMatrise = sitedoc_admin only`. Fase A-korreksjon: «mobil prosjektadmin under-servert» var feil hypotese; eneste reelle divergens var firma-admin-fantomet — fjernet. Non-regresjon bevist (mutasjonene validerer `isValidStatusTransition` uavhengig).
- **🟡 Kloss 2b (respec rev. 6) — firma-innstilling «auto-prosjektadmin»** (§ 1b): opt-in `OrganizationSetting`, enum `autoProsjektAdmin: "av"|"alle_firma_admins"` (utvidbar til utvalg i umbrella-delplanen); prosjektoppretting (prosjekt.opprett + de to andre stiene — cowork-målt hook-punkt) legger valgte til som `ProjectMember.role=admin`. Ingen adminNiva-endring, ingen firmaadmin-rolle, verifiserFlytRolle røres ikke. Kanter 1–4 i § 1b.
- **🟡 Kloss 2c — plassering (Admin-flaten, § 1c) + cellespec-kontrast (§ 2):** rev. 7: firma-dropdownen UTGÅR (global matrise). Slås sammen med revisjons-ordren om cowork vil.
- **✅ Kloss 3 — endringslogg-fane + les/rediger-fane:** levert i Kloss 2; egen runde kun ved utvidelse.
