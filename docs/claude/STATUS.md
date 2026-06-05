# STATUS — docs/claude/-filer

> **Vedlikeholdsregel:** STATUS.md oppdateres av Opus i samme commit som endrer fil-status. Aldri separat commit.
>
> **Status oppdateres ved:** (1) ny verifikasjon/screening fullført, (2) drift rettet, (3) fil opprettet/slettet/arkivert, (4) ny prod-deploy som rammer fil-status.
>
> **Konsolidering ≠ verifikasjon:** Når en fil får tilført en ny seksjon med besluttede regler/policy (markert med `K{n}.x YYYY-MM-DD`), endrer det IKKE filens verifikasjons-status. Eksisterende innhold er ikke re-verifisert mot kode. Status forblir som var.
>
> **Kommentar-kolonne-tagger:**
> - `Sannhetskilde:` — innholds-aktiv (peker-mål for andre filer)
> - `Arbeidsanker:` — bruks-aktiv (pågående arbeid, endres ofte)
> - Hvis ingen av delene: kort fri beskrivelse (eller tom)

**Sist oppdatert:** 2026-06-05 (OAuth account-linking + signIn-guard mot orphan-kontoer deployet til prod — arkivert i historikk-2026-06.md)
**Antall filer dekket:** 50 (44 i `docs/claude/` + 6 i `docs/arkiv/`) — `neste-oppgave.md` slettet 2026-05-14, innholdet konsolidert til [STATUS-AKTUELT.md § Neste oppgaver](STATUS-AKTUELT.md)

---

## Prod-deploys 2026-05-03 → 2026-06-05

**2026-06-05 — OAuth account-linking + signIn-guard mot orphan-kontoer:**
- `e12355d9` (prod-merge) — `allowDangerousEmailAccountLinking: true` på Google + Microsoft (`apps/web/src/auth.ts`): logg inn med enten tilbyder på samme e-post → samme konto. Reverserer H3-audit (trygt: begge IdP-er verifiserer e-post-eierskap).
- `f6522a94` (prod-merge, commit `ef5906bb`) — Blokkerende `signIn`-guard: uinviterte OAuth-pålogginger avvises (`auth.feil.AccessDenied`, 14 språk) og oppretter IKKE tom orphan-konto. Regler a/b/c/d. Verifisert på test at `return false` hindrer User-opprettelse. Duplikat-/orphan-opprydding i prod-DB (Mathias-typo, Malin/kmy gmail-orphans). Gjelder kun web-OAuth; mobil-flyt gjenstår. Ingen migrasjon. Detaljer i [historikk-2026-06.md](historikk-2026-06.md).

**2026-06-02 — mobil hentMineMedlemskap-bug fikset (prosjektadmin/standalone-brukere uten firma):**
- `21555a5c` (prod-merge) — Server-fallback i `hentMineMedlemskap` (utleder firma fra `ProjectMember → Project.primaryOrganizationId`) + klient-fiks (`9e1bbf02`: fjernet firma-gating på prosjekt-query i `hjem.tsx` + `ProsjektVelger.tsx`) + diagnose-logging fjernet (`d9d90322`). I EAS build #29 (iOS), verifisert i TestFlight av Kenneth. **Ny fil `historikk-2026-06.md` opprettet 2026-06-02** (1 sak arkivert: mobil hentMineMedlemskap-bug). Ingen migrasjon.

**2026-05-23 — opprettTestprosjekt firma påkrevd + i18n-batch + relikvi-slett:**
- `49171634` — Siste konsistens-rest fra firma-påkrevd-bunken 2026-05-20. `opprettTestprosjekt` (`apps/api/src/routes/prosjekt.ts:246`) gjort required: `organizationId: z.string().uuid()`, valgtOrgId alltid string, `if (valgtOrgId)`-wrap fjernet. Admin-UI «Opprett malprosjekt»-knapp + kom-i-gang «Start gratis prøveperiode»-knapp disabled uten valgt firma. Amber-banner på `kom-i-gang`-siden gjenbruker `t("nyttProsjekt.ingenFirma")`. TS2589 håndtert med `_data: unknown`-mønster i `kom-i-gang/page.tsx` + utvidet stub-signatur i `admin/prosjekter/page.tsx`. Speiler nå `prosjekt.opprett`-mønsteret eksakt. Merget inkluderte også i18n auto-oversetting 30 nøkler × 13 språk (`072eb64f`, alle 15 språk har nå 2 328 nøkler), `hjelp.flyt.*`-relikvier slettet fra en.json (`47c55faf`, ubrukt HjelpModal-rest fra commit `781a5e5e` 2026-04-07), to i18n-kvalitetsoppgaver logget i backlog (`da870181`: fr `pause`→`saut`, klønete `maskinAvArbeid`-kildetekst). Ingen migrasjon.

**2026-05-23 — T7-5f dirty-tracking grønn Lagre-knapp:**
- `c2792f28` — Lagre-knappen grå/disabled inntil endring, grønn ved endring. Implementert på begge edit-flater: `AttesteringDetalj_Edit.tsx:481` (impl `e7ac0f83`) og `RedigerRadModal.tsx:401` (impl `f0e1a740`). `harUlagredeEndringer`/`harEndringer`-memoer fantes allerede — kun koblet til `disabled`-prop + grønn `className` (`!bg-green-600 hover:!bg-green-700 focus:!ring-green-500`). Tailwind `!`-prefix sikrer override mot `Button.varianter.primary.bg-sitedoc-primary` (CLAUDE.md § Tailwind className-spesifisitet). Ingen migrasjon.

**2026-05-20 — Firma påkrevd ved prosjektopprettelse + admin.opprettProsjekt-bugfix:**
- `a5bea017` — Adresserer at PC-admin og mobil viste ulike prosjekt-lister: 5 av 8 prosjekter i prod-DB var orphaned (`primaryOrganizationId = null`). Beslutning: alle kunder skal være registrert som firma. 5 orphans slettet fra prod-DB samme dag (alle Kenneths «Testside Kenneth Myrhaug» fra 2026-05-05). `createProjectSchema.organizationId` gjort required (Zod), admin-UI «Ingen firma»-option fjernet + required-select + disabled-knapp, nytt-prosjekt-side fikk amber-banner + submit-blokk + `_data: unknown` for TS2589. Bugfix `admin.opprettProsjekt` (`apps/api/src/routes/admin.ts:229`): `primaryOrganizationId` settes nå på Project.create (var tidligere utelatt — prosjekter ble orphaned i admin-listens primær-filter selv om admin valgte firma). Ny i18n-nøkkel `nyttProsjekt.ingenFirma` (nb/en). Ingen migrasjon.

**2026-05-20 — T7-5e attestert-filter:**
- `cc8f0067` — Attestering-listen får fane-toggle `[Venter på attestering ●N] [Attestert ●M]`. Server `hentTilAttesteringFirma` (`apps/api/src/routes/timer/dagsseddel.ts:1088`) aksepterer `status: "sent" | "accepted"` (default `"sent"` — bakover-kompat). To parallelle queries på klient for badge-tall. SeddelKort fikk `readOnly`-prop som skjuler ↩/✓/⋯/penn/✂ i attestert-fanen. ProsjektGruppe «Attester gruppe (N)»-knapp gates likeså. 2 nye i18n-nøkler (`timer.attestering.fane.venter` + `.attestert`) i nb/en. Ingen migrasjon.

**2026-05-19 — T7-4g + T7-5d + pause-modell + filter-erstattet + maskin-validering-pause:**
- `f167e72c` — Bunke av 5 attestering-UI- og valideringsforbedringer. **T7-4g** (`5c6347d9`): kompakt kollapset SeddelKort, header redusert til én linje (~48px), default-expanded ved tilleggHarKrav eller mertid, action-rad fjernet. **T7-5d** (`9727c7f9`): RedigerRadModal erstatter RedigerSeddelModal. Penn-klikk åpner KUN prosjekt+ECO-bucken, ikke hele sedelen. Hele-sedel-redigering via ⋯-meny → detaljsiden. AttesteringDetalj renset for modal-spesifikke props. **Pause-modell** (`2e3f23b8`): inline pause på rad i RedigerRadModal. Ny `pause_fra`/`pause_til` TEXT-kolonner på `timer.daily_sheets` (migrasjon `20260517220000_add_pause_fra_til`). pauseMin denormalisert sum, beholdes. **Filter-erstattet** (`d4748b6a`): server-fix `hentTilAttesteringFirma` + `hentForAttestering` filtrerer ut `attestertStatus="erstattet"` — visnings-fix for duplikat-rader etter rediger. **Maskin-validering-pause** (`43307429`): invariant utvidet til `sum(maskin) ≤ sum(timer) + pauseMin/60` for døgn-utleide maskiner (Heatwork-mønster `equipment.utleie_enhet='doegn'`). `validerMaskinUnderArbeid` fikk `pauseMin=0`-parameter, oppdatert i 7 kallesteder.

**2026-05-17 — T7-4f + T7-5b + maskin-fra-til + B-fixes (attestering komplett):**
- `44de2521` — Komplett redesign av `/dashbord/firma/timer/attestering`-listen + modal-arkitektur + maskin-fra/til + QA-fix-runde B1/B2/B6. Migrasjon `20260517120000_organization_setting_rediger_default_true` applied. Sammenheng-prinsipp låst i fase-0-beslutninger.md § T7-5. **Sub-PR-er:** T7-4f-bunken (`bd70392e`) server-beriking + ekstraher attestering-buckets + redesign attestering-liste + SeddelKort kompakt tabell. T7-4f-splitt-1-klikk (`7ee31fa3`) ✂-ikon per rad åpner SplittRadModal direkte. T7-5b-1 (`2a47dceb`) DB-default `tillattRedigerVedAttestering=true` for nye firma. T7-5b-2/3/4 (`30c20df9`, `b1ae1516`, `7063cb36`) — modal-wrapper-iterasjon (senere ryddet i T7-5d). Maskin-fra-til (`ac7fa72e`) MaskinRadDialog fra/til-felter. B1/B2/B6-fixes (`92774103`, `141fc1ab`, `b117cb75`).

**2026-05-16 — T7-2c/2d/2e/2f + T7-4a–e (splittRad + prosjekt+ECO-gruppering):**
- `86fdb5a3` — Hele bunken i ett prod-deploy. T.7-vedtak låst 2026-05-16: maskin er utstyrsbidrag av samme tidsperiode som arbeidstimer; server håndhever `sum(maskin) ≤ sum(timer)` per (`projectId`, `externalCostObjectId`)-gruppe. Migrasjon `20260516140000_t7_4a_machine_eco` applied 19:27:50 (T7-4a `SheetMachine.externalCostObjectId String?` + indeks). Server: ny `validerMaskinUnderArbeid` + `hentRaderForValidering` + `feilMeldingMaskinOverstiger` wired inn i 7 mutasjoner (`tilfoyTimerRad`, `oppdaterTimerRad`, `maskin.tilfoy`, `maskin.oppdater`, `redigerSedelRader`, `splittRad`, `syncBatch`). `splittRad`-mutation (T7-2c1) med discriminated-union Zod + audit-snapshot. Web: SplittRadModal (T7-2c2, +6xl bredde i T7-2f) + integrasjon i AttesteringDetalj_Edit (T7-2c3). Edit-bugfix T7-2e (tidsfelt min-w 120px + step clampet til 1800 + lokal string-state for timer-input). Per-rad prosjekt-join i `hentForAttestering` (T7-2d). Dagsseddel og attestering grupperer per prosjekt+ECO i ny `EcoGruppe`/`EcoBucketAttest`/`EcoBucketEdit`/`EcoBucket` (web arbeider T7-4c, web attestering T7-4d, mobil T7-4e) med maskin som indentert underpost + sum-indikator grønn/rød + indigo-badge «→ Godkjenning byggherre» på ECO-grupper. ECO-velger i web/mobil MaskinRadModal + RedigerMaskinRad. Mobil sync-fix: `timerSync.ts` maskin-mapping i push og pull manglet `externalCostObjectId` — fikset i T7-4e (latent fordi ingen testdata hadde ECO på maskin). 6 nye i18n-nøkler (`timer.gruppe.*` + `timer.detalj.ukjentEco`) × 15 språk fra T7-4c, 13 fra T7-2c2 + 2 fra T7-2c3. Mobil-endringer sovende på enhet til neste EAS-bygg (idempotent Drizzle-migrasjon kjøres ved app-oppstart).

**2026-05-16 — T.5 tidsrunding (web + mobil):**
- `ba6ba243` — Firma-admin konfigurerer tidsrunding (15/30/60 min eller ingen) for fra/til-tid på timer- og maskin-rader. Server: `oppdaterSetting` Zod-validering `z.union([15, 30, 60, null])`, `hentArbeidstidDefaults` select utvidet. Web: ny `lib/tidsrunding.ts` (`rundTilNarmeste`-helper med 23:59-clamp), `StandardArbeidstidSeksjon` dropdown, `RedigerTimerRad`/`RedigerMaskinRad` step+onBlur-fallback. Mobil-cache: idempotent ALTER ADD COLUMN `tidsrunding_minutter`. Mobil-UI: speilet `utils/tidsrunding.ts`, `FraTilTidFelt` runder onChange-verdi før callback, `minuteInterval` hint for 15/30 (60 ignoreres av iOS/Android — JS-runding garanterer konsistens). `TimerSeksjon`/`MaskinSeksjon` henter via `hentOrganizationSettingLokalt`. 6 nye i18n-nøkler → 13 språk (2277 → 2283). Schema-feltet `OrganizationSetting.tidsrundingMinutter` fantes allerede fra T.1–T.6-bunken 2026-05-12.

**2026-05-16 — T.4 fra/til-tid per rad (bunke a–e):**
- `5d36c8b9` — Hele T.4-bunken. **T4-a** (impl `cfe51fc5`, merge `5acd2a5d`): schema + migrasjon `20260516000000_t4_arbeidstid_defaults` — `OrganizationSetting.standardStartTid/SluttTid/PauseMin` (defaults 07:00/15:00/30) + nullable `ArbeidstidsKalender.standardStartTid/SluttTid/pauseMin` (overstyring for sommertid_start/slutt/halvdag). **T4-b** (impl `088a1e37`, merge `9bcfb5b1`): `hentEffektivArbeidstid(orgId, dato)`-helper i `apps/api/src/services/timer/arbeidstid.ts` (sommertid-overstyring → firma-default). Hard sommertid-par-validering i kalender opprett/oppdater. **T4-c** (impl `39c43aa8`, merge `c02df657`): server-Zod-utvidelse for de tre T4-a-feltene + ny `StandardArbeidstidSeksjon` på innstillinger-side + tidsfelter i kalender-modal (sommertid_start/slutt/halvdag) + klokke-badge i månedsliste. 15 nye i18n-nøkler → 13 språk. **T4-d** (impl `2f7bf42d`, merge `7bee1633`): mobil Drizzle `fraTid`/`tilTid` på `sheet_timer_local` + `sheet_machine_local` + nye lokale tabeller `arbeidstidskalender_local` + `organization_setting_local`. Services `kalenderKatalog.ts` (med `hentEffektivArbeidstidLokal`-helper) + `organizationSettingKatalog.ts`. TimerSyncProvider 2-stegs Promise.all (base-pulls → firma-spesifikke pulls per org-id fra prosjekt-cachen). timerSync push/pull med fraTid/tilTid per rad. Server: ny medlems-tilgjengelig `organisasjon.hentArbeidstidDefaults` + fraTid/tilTid i `hentEndringerSiden`-respons. **T4-e** (impl `cea8f99e`, merge `e992aca3`): mobil UI med ny `FraTilTidFelt`-fellekomponent (DateTimePicker mode=time × 2). Montert i TimerRadModal + MaskinRadModal. Forhåndsutfylling: ny rad uten forrige → `hentEffektivArbeidstidLokal`; ny rad med forrige → forrige rads tilTid som fraTid + effektiv sluttTid. Validering `fraErForTil`. SummeringsBanner fallback til kalender-dagsnorm. 0 nye i18n-nøkler (gjenbruker startTid/sluttTid/sluttForStart).



**2026-05-15 — Topbar firma-kontekst + FirmaKontekstVelger + favoritter + søk:**
- `0bd27466` — Topbar tilpasser seg pathname via `usePathname()`. På `/dashbord/firma/*` vises ny `FirmaKontekstVelger` («Firma ▾») istedenfor `ProsjektVelger` + `ByggeplassVelger`. Ny `useFavoritter`-hook med localStorage-nøkkel `sitedoc_favoritter_${userId}` (default) eller `sitedoc_favoritter_byggeplass_${userId}` (via `nokkelPrefix`-parameter). Stjernemerking + favoritt-seksjon i `ProsjektVelger`, `FirmaKontekstVelger` og `ByggeplassVelger`. Søkefelt vises ved >7 elementer (terskel-konstant `SOK_TERSKEL = 7`). 11 nye i18n-nøkler (`topbar.*` + `byggeplassVelger.*`) auto-oversatt til 13 språk (2262 totalt).

**2026-05-15 — T9 firmakalender (a/b/c):**
- `ca71cf48` — Hele T9-bunken. **T9a** (impl `92ee4975`): `ArbeidstidsKalender`-modell i `packages/db` (Variant B, dynamisk per dato per firma), migrasjon `20260515114710_t9_arbeidstidskalender` med unique `(organization_id, dato)` + indekser, `beregnNorskeHelligdager(aar)` i `packages/db/src/seed/helligdager.ts` (Meeus/Jones/Butcher Gauss-påskealgoritme, ingen ekstern avhengighet — `date-fns-tz` var unødvendig siden vi lagrer `date` uten tid). **T9b** (impl `27123f13`): tRPC-router `apps/api/src/routes/firma/kalender.ts` med 6 prosedyrer (hentForAar, importerNorskStandard, opprett, oppdater, slett, hentForMobil). Zod-enum-validering av `type`-feltet (`helligdag | fellesferie | klemdager | sommertid_start | sommertid_slutt | halvdag | firma_fri`). Firma-admin-auth for skriving, organisasjons-medlemskap for lesing. Soft-delete via `aktiv=false`. Sommertid-par-status som myk varsling (`komplett | bare_start | bare_slutt | ingen`). **T9c** (impl `0997e81b`): Web-admin-UI på `/dashbord/firma/kalender` med år-velger (←/→ + årsnummer), «Importer norsk standard {{aar}}»-knapp, sommertid-banner ved ufullstendig par, 12 måneds-kort med fargekodede type-badges, opprett/rediger-modal med locked dato i rediger-modus + soft-delete-knapp. 30 nye i18n-nøkler (`firma.kalender.*`) auto-oversatt til 13 språk. Sidebar-element «Kalender» med `Calendar`-ikon under «Timer-rapport» — tverrgående firma-funksjon, ingen `kreverFirmaModul`-gating.

**2026-05-14 — T7-2b-bunken komplett (per-rad-attestering + edit-modus + settings-toggle):**
- `3234c057` — T7-2b1 per-rad-attestering: AttesteringDetalj-felleskomponent, `attesterRader`/`returnerRader`-mutations (per-rad-validering + auth per unike projectId), per-rad-status-badge + checkboxer, firma-detalj-side (`/dashbord/firma/timer/attestering/[id]`). Schema-kommentar-rensk `godkjent → attestert` (ingen migration). Gamle `attester`/`returner` beholdt som `@deprecated` thin wrappers.
- `755c542a` — T7-2b2 edit-modus ved attestering: `redigerSedelRader`-mutation (firma-admin-auth + flagg-gate + transaksjon erstatt/opprett-nye), `OrganizationSetting.tillatt_rediger_ved_attestering` (default false), `parent_rad_id` på alle tre rad-tabeller, `attestertStatus = "erstattet"`. Ny `AttesteringDetalj_Edit.tsx` + 3 sub-komponenter (RedigerTimerRad/TilleggRad/MaskinRad). Activity-log per rediger.
- `af4a7deb` — T7-2b3 settings-toggle: `RedigerVedAttesteringSeksjon` i `firma/innstillinger/page.tsx`, følger samme mønster som eksisterende TilgangPolicySeksjon. 5 nye i18n-nøkler. Ingen server/schema-endring (klargjort i b2).
- `d194332c` — attestering-hint: diskret blå info-stripe i `AttesteringDetalj.tsx` synlig for firma-admin når `tillattRedigerVedAttestering = false`. Peker mot innstillinger-siden (Progressive Disclosure). 2 nye i18n-nøkler. Ingen server-endring (utnytter eksisterende `kanAttestereFirma`-query).
- **Server-side (test-server)**: `deploy-test-cron.sh` fikset med `rm -rf apps/web/.next`-steg før build for å eliminere stale-cache-bug som trigget 3 ganger denne uken. Backup: `~/programmering/deploy-test-cron.sh.bak`. Skriptet er ikke i repo.

**2026-05-13 — OrganizationMember-refaktor bunke + ansattrolle-UI:**
- `95500003` — PR O-5a: fjern `User.organizationId`-fallbacks i `tilgangskontroll.ts` + 8 routes via `resolverOrgFraInput`/`krevBrukersOrg`-hjelpere (netto −484 linjer)
- `54d917d9` — PR O-5b: fjern `User.organizationId`/`ansattnummer`-lesinger i gruppe/medlem/admin/timer-routes (Kat. B + C)
- `fe1d703d` — Bundle: PR O-5b-fix (11 resterende treff) + PR O-5c schema-drop (`User.organizationId`/`ansattnummer`/`avdelingId` + `OrganizationRole`-tabell). Migration `20260513210000_o5c_drop_user_org_fields` applied 22:36:32. `email @unique` globalt.
- `3fa34c57` — ansattrolle-UI: settFirmaAdmin-mutation erstatter endreRolle, ansattRolle-dropdown + firma_admin-checkbox i invitér/rediger-modal, Stilling/Tilgang-kolonner i firma/ansatte-tabellen. Backfill-script `backfill-firma-admin-roller.ts`.

**2026-05-12 — Timer-modul arkitektur-redesign (T.1–T.6) bunke:**
- `bba971ba` — PR 1B: NOT NULL på rad-tabeller + drop `DailySheet.projectId` + ny unique `(userId, dato)`
- `6431873c` — PR 2A: API timer-routes refaktor (dagsseddel/rapport/vareforbruk, 45 → 0 TS-feil)
- `8478d4a7` — PR 2B: Web timer-modaler sender projectId via `useParams` (46 → 0 TS-feil)
- `0700b8ed` — PR 2C min: Mobil defensiv null-guard mot `serverSedel.projectId` null

**2026-05-11 — Timer-arkitektur-forarbeid:**
- `862c70c3` — PR 1A: Schema-additive + backfill (alle kolonner nullable, T.1–T.6 første steg)
- `c7dee528` — `deploy.sh` inkluderer alle 4 db-pakker (db + db-maskin + db-timer + db-varelager)
- `1d819ff4` — fase-0-beslutninger.md § T (T.1–T.6) tilføyd

**2026-05-07 — 4 deploys:**
- `9e264bfa` — Rolle-dropdown outside-click-fix (mousedown→click)
- `f27a63dc` — «Velg fra firma»-flyt for prosjektmedlemmer
- `620a85c7` — Modul-piller i admin/firmaer + Varelager-bug-fix
- `a3765a97` — Admin-impersonering (1t-utløp, audit-banner)

**2026-05-06 — 13 deploys (UX-runde 1+2 + Steg 4b + integrasjoner):**
- `8a184fc8` — HovedSidebar skjult i firma-kontekst + Tilbake-lenke
- `207a223c` — Fakturering-gating + U5 forkastet
- `878e90ec` — Integrasjonsadmin AES-256-GCM + Brreg-autofyll + reginn-rename
- `da00d55d` — B2 onboarding-checkpoint-bar modul-utvidelse
- `2f22c503` — B1 ProsjektVelger Alle/Mine prosjekter scope
- `31cff7da` — U2 CSV/Excel-eksport på timer-rapport
- `e4f594fa` — Mine timer flyttet til HovedSidebar + global scrollbar-fix
- `c551063f` — U1 Timer-rapport firmanivå + React#310-fix
- `1781a17a` — U7 fritekst utstyrstype med datalist-forslag
- `c2da3135` — U3+B3 sidebar tekst-labels + modul-fargedesign
- `3dd4371b` — Heatwork-seed + U6 maskin firma-kontekst-fix
- `37a1fe89` — Steg 4b Sesjon 3 (Vareforbruk-import-flyt + A.Markussen seed)
- `09b4d1ae` — Steg 4b Sesjon 2 (Vareforbruk-routes + UI + Varelager-toggle)

**2026-05-05 — 6 deploys:**
- `0245b265` — admin/prosjekter respekterer FirmaVelger
- `de044be4` — Steg 1e (OrganizationModule erstatter har_*_modul-flagg)
- `66c2e982` — kom-i-gang redirect for sitedoc_admin + opprettTestprosjekt bug-fix
- `d62ffa6c` — Faggruppe full CRUD (to sider konsolidert til én)
- `2e32b867` — Hvem har ballen-badge på sjekkliste/oppgave-detalj
- `5674df71` — P1 Fase 2 (auto-reset prosjekt ved firma-bytte)

**2026-05-04 — 5 deploys:**
- `e2729849` — Blokk C (admin/firmaer erKunde-filter + Timer-kolonne)
- `12717426` — Blokk A (ProsjektVelger filtreres på valgt firma for sitedoc_admin)
- `dbf78bca` — Blokk B (klikkbare prosjektrader på firma/prosjekter)
- `82b2b4c7` / `e3717a8c` — Header-fix (FirmaVelger først, redirect til firma-admin)

**2026-05-03 — 8 deploys:**
- `da6b34a5` — Steg 4a (ECO-flytt på attestering + leder-detaljside)
- `33a2b9b4` — Steg 3 (maskin-import med firma-kontekst og drag-drop UI)
- `a1463561` — Steg 2 (firma-admin-sider komplett — moduler/innstillinger/nytt-prosjekt)
- `73dcbd1a` — Steg 1d (drop ProjectModule.active)
- `87fb7292` — Steg 1c (OrganizationModule auto-sync)
- `045a49b7` — Steg 1b (firma-kontekst Lag 1+2+3)
- `c91d953c` — Steg 1a (Organization.erKunde)
- `1f2c0da2` — SmartDok maskin-import (test-deploy + dag-3-fix før prod-merge)

---

## Develop-only merges (mobil — venter på Expo Go / EAS Build)

**2026-05-14 — T7-3-bunken (mobil timer-redesign — KOMPLETT på develop):**
T7-3a/b1/b2 er deployet til prod (`223afc17` på main, server-route-endringer aktive). T7-3d er på develop og venter på Kenneth-verifikasjon på enhet før prod-merge. Mobil-endringene rulles ut via Expo Go (utvikler-enhet) eller EAS Build → TestFlight / Play Store (release) — ikke `./deploy.sh`.
- `fc087b65` (merge `22a97402`) — **T7-3a** ✅ prod. Arbeidstid-seksjon + summerings-banner på mobil. Speil av T7-1a (web). JS-only-endring; ingen DB-migrasjon, ingen sync- eller server-endring.
- `65bf48cb` (merge `cd64c51a`) — **T7-3b1** ✅ prod. Prosjekt per rad: lokal SQLite-skjema (ALTER + backfill + nye `prosjekt_local`-tabell), sync push/pull med per-rad projectId, ny `prosjektKatalog.ts`-service. Server-`syncBatch`/`hentEndringerSiden` utvidet med per-rad-projectId + ny auth-sjekk per unike rad-projectId. Ingen UI-endringer. Lokal migrasjon fullt-additiv + idempotent; pre-T7-3b1-mobiler kjører videre via kompat-shim.
- `1717fd79` (merge `3e34ec71`) — **T7-3b2** ✅ prod. Prosjekt-velger per rad i timer/tillegg/maskin-modaler + ProsjektGruppe-visning i [id].tsx + geo-forslag (`expo-location` + Haversine, 500m radius) i ny.tsx. Ny `ProsjektVelger.tsx`. 1 ny i18n-nøkkel (`handling.sok` — rettet pre-eksisterende manglende-nøkkel-bug). Ingen server/skjema-endring.
- `ffebd082` (merge `ae6e5a2d`) — **T7-3d** 🟡 develop. Per-rad-attestering for leder på mobil. Speil av webs `AttesteringDetalj` (forenklet). Nye filer: `AttesteringStatusBadge.tsx`, `RadCheckbox.tsx`, `ReturnerModal.tsx`, `AttesteringDetaljMobil.tsx`, `app/timer/attestering/index.tsx` + `[id].tsx`. Menylenke i `mer.tsx` gated på `kanAttestereFirma`. Server/skjema null endring — gjenbruker T7-2b1-routes. Ingen nye i18n-nøkler. Forenklinger ifht. web: ingen edit-modus, ingen ECO-flytting per rad, ingen rediger-header-modal, kun firma-kontekst. Online-only flyt (mutations krever nett, samme som web).

**T7-3-bunken komplett 2026-05-14.** Gjenstår: Kenneth-verifikasjon av T7-3d på enhet + prod-merge når godkjent + EAS Build for å rulle alle T7-3-endringene ut til alle telefoner.

---

## A.Markussen AS — onboarding-status (prod, verifisert 2026-05-07)

**Org-id:** `4488fe17-7490-409f-9c1c-2827f257c54d`

**Brukere (1):** Florian Aschwanden (`8e3c7f17-...`) — `role=company_admin`, `email=florian@amarkussen.no`. Satt via SQL UPDATE 2026-05-07 (rolle-dropdown var blokkert av `mousedown`-bug — fikset i samme dags deploy `9e264bfa`).

**Prosjekter (1):** «998 Instinniforbotn» (`SD-20260506-0008`)
- Medlemmer: Florian (member) + Kenneth Myrhaug (admin)

**Aktive firmamoduler (3):** `timer`, `maskin`, `varelager` — alle status=`aktiv`

**Datatilstand:**
- 7 vare-kategorier (Grus/pukk/jord 36 varer, Naturstein 8, Diverse 7, Rør 2, Betongstein 2, Forbruk 1, Deponiavgift 1) = 57 varer total
- 2 pris-rader (Matjord m3=100,00, Samfengt grus m3=80,00)
- 127 Equipment-rader (kjøretøy + anleggsmaskin + småutstyr fra SmartDok-import 2026-05-03)
- 5 Heatwork-utleieobjekt (`erUtleieobjekt=true`, `utleieEnhet=doegn`): 7626/7628/7630/7632/7634

**Klar for produksjon:** Florian kan logge inn, se prosjektet, registrere timer + dagsseddel, registrere vareforbruk, og opprette nye prosjekter for A.Markussen som company_admin.

---

## Åpne oppgaver

| Oppgave | Eier | Notat |
|---|---|---|
| Roter eksponert test-nøkkel `1dcd...4fe4` | Kenneth | `SITEDOC_INTEGRATION_KEY` på sitedoc_test ble eksponert i chat-logg under feilsøking 2026-05-07. Generer ny: `openssl rand -hex 32`, oppdater i `~/programmering/sitedoc-test/ecosystem.config.js` (BÅDE web + api), `pm2 reload --update-env` |
| Audit-log-utvidelse for impersonering | Backlog | MVP bruker `console.log` for start/stopp. Per-mutation logging utsatt — krever `Activity`-tabell-utvidelse med `actorId` + `subjectId` |
| Ekstra Heatwork HW-vifte-Equipment | Kenneth | Per Steg 4b § 13: 6 Heatwork-rader skulle opprettes; 5 er ferdig (7626-7634), HW-vifte gjenstår |
| Reginn MREG-integrasjon | Backlog | UI-tile fjernet, type-whitelist `reginn` reservert. API-dokumentasjon mangler — MEF-dialog. Ref. N2.2.3 i oppryddings-plan |
| U5 byggeplass selvstendig flyt | Forkastet 2026-05-06 | Byggeplass-data (geofence, GPS, §15) er prosjekt-bundne. Selvstendig firma-byggeplass = orphan. UX-agenda fullt lukket |
| 7632 + 7634 type-felt rettet manuelt | OK 2026-05-06 | SmartDok-importen ga `type="Anleggsmaskin"` for disse to. Kenneth rettet til `Heatwork 3600/MY35` i UI etter U6-fix-deploy. Beholdes som notat for fremtidig SmartDok-mapping |

---

## Sammendrag

| Status | Antall |
|---|---:|
| ✅ Verifisert mot kode | 6 |
| ⚠️ Drift identifisert | 4 |
| 🔄 Under arbeid | 11 |
| ❌ Ikke screenet | 21 |
| ✔️ Ferdig brukt (lukket) | 3 |
| 📦 Arkivert | 6 |
| **Totalt** | **51** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| arkitektur-syntese.md | 2026-05-01 | **Sannhetskilde:** Anker for Fase 0-koding (sammen med fase-0-beslutninger.md). 3A komplett. § 5 Fase 0.5: A.30 byggeplassId-NULL = A1 vedtatt. § 6.1.1 Cross-modul-tilgang via service-lag |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament. § 2.3 HMS-tabell utvidet med firma-HMS-ansvarlig-lese-tilgang (per A.27) |
| fase-0-beslutninger.md | 2026-05-12 | **Sannhetskilde:** Anker for Fase 0/0.5-koding. § E KOMPLETT på prod (alle 13 § E-steg). A.4-overstyring oppdatert 2026-05-05 (peker til Steg 1e). **§ T (T.1–T.6) tilføyd 2026-05-11 (`1d819ff4`)** — Timer-modul arkitektur-redesign, deployet prod 2026-05-12 (PR 1A–2C) |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament |
| SITEDOC-CLAUDE-VEILEDER.md | 2026-05-03 | **Meta-fil:** Sesjonsoppstart-veileder for Opus |

## ⚠️ Drift identifisert (Bunke 3A.1, 2026-04-28)

| Fil | Sist verifisert | Drift-omfang |
|---|---|---|
| forretningslogikk.md | 2026-04-28 | Byggeplan-rekkefølge motsigelse mot arkitektur-syntese, Godkjenning-status, lestAv-mekanikk for gruppe-mottaker |
| mobil.md | 2026-04-28 | 5 faggruppe-forekomster + 3 ulike Provider-tre-rekkefølger |
| okonomi.md | 2026-04-28 | 4 faggruppe-forekomster + FtdNotaComment mangler i tabell + ECO/Godkjenning-kobling mangler |
| web.md | 2026-04-28 | 21 faggruppe-forekomster + feil ruter (`/entrepriser` → `/faggrupper`) + feil API-navn (`hentMineEntrepriser` → `hentMineFaggrupper`). Drift økt etter UX-runde + Vareforbruk-modul: nye sider `/dashbord/firma/varelager`, `/dashbord/[prosjektId]/vareforbruk`, `/dashbord/firma/timer/rapport`, `/dashbord/firma/innstillinger/integrasjoner`, `/dashbord/admin/integrasjoner` mangler i web.md |

## 🔄 Under arbeid

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| onboarding-veileder.md | ikke aktuelt | Idé-stadium, planlagt ~1 måned frem (post-Fase 0). Etablert 2026-04-28 |
| mannskap.md | 2026-04-28 | **Vy-beskrivelse i PSI-konteksten** etter 1D-presisering. Datamodell forkastet (Mannskapsmedlem dupliserer User per memory). Endelig datamodell designes Fase 4 (PSI-utvidelse) |
| oppryddings-plan-2026-04-28.md | 2026-04-30 | **Arbeidsanker:** Aktiv anker. P1.1+P1.2+P1.3+P1.4+P1.5+P1.6+P1.7+P4.3+P4.4+C.15+SCREENING-29-1+SCREENING-29-3 lukket. N2.2.3+N2.2.4 omformulert (avventer ekstern API-tilgang). 3A komplett |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |
| dagsseddel-design.md | 2026-05-02 | **Arbeidsanker:** Aktivitet flyttet til `SheetTimer.aktivitetId` (NOT NULL) per rad — implementert i Runde 2.5/C9 deployet til prod 2026-05-02 |
| domene-arbeidsflyt.md | 2026-05-03 | **Arbeidsanker:** Styrende dokument. Steg 1a-1e ✅ prod, Steg 2 ✅ prod, Steg 3 ✅ prod, Steg 4a ✅ prod, Steg 4b (Vareforbruk) ✅ prod 2026-05-06. Tre åpne spørsmål gjenstår |
| navigasjon-arkitektur-analyse-2026-05-03.md | 2026-05-03 | **Arbeidsanker:** Tiltak #1-#7 i prioritert rekkefølge fullført. Header-fix + Blokk A/B/C deployet 2026-05-04. Faggruppe-konsolidering 2026-05-05. P1 Fase 1+2 lukket. P2 (admin/firmaer erKunde) lukket. Klikkbare prosjektrader lukket |
| STATUS-AKTUELT.md | 2026-05-12 | **Arbeidsanker:** Aktiv statusrapport. § Timer-modul revisjon (kartlegging 2026-05-11) + § Implementasjonsstatus PR 1A→2C tilført. Hele PR 1A–2C-bunken merket DEPLOYET TIL PROD 2026-05-12 |
| prosjektoppsett-veileder.md | 2026-05-02 | **Arbeidsanker:** UX-funn 2026-05-02 (4 × 404). Faggruppe-side-konsolidering deployet 2026-05-05 lukker første tiltak. Nye UX-fix i UX-runde 1+2 lukker resten. Skal re-verifiseres mot ny prod-tilstand |
| admin-navigasjon-analyse-2026-05-03.md | 2026-05-03 | **Arbeidsanker:** Komplett kartlegging av admin-navigasjon. P1 Fase 1+2 lukket via Blokk A (`12717426`) + auto-reset (`5674df71`). P2 admin/firmaer erKunde-filter lukket via Blokk C (`e2729849`). Klikkbare prosjektrader lukket via Blokk B (`dbf78bca`). 4 åpne beslutninger gjenstår |
| steg-4b-plan.md | 2026-05-05 | **Arbeidsanker:** 5-faset Vareforbruk-plan. Sesjon 1 (Fase 1+2) + Sesjon 2 (Fase 3+4) + Sesjon 3 (Fase 5 import) deployet til prod 2026-05-06. A.Markussen seedet (7 kategorier + 57 varer + 5 Heatwork-Equipment). HW-vifte gjenstår manuelt |

## ✔️ Ferdig brukt (lukket — innhold dekt av prod)

| Fil | Lukket | Kommentar |
|---|---|---|
| ux-arkitektur-agenda.md | 2026-05-06 | KOMPLETT LUKKET. 3 vedtatte beslutninger (B1+B2+B3) deployet. 6 åpne oppgaver løst (U1+U2+U3+U6+U7). U4 erstattet av B3, U5 forkastet 2026-05-06. Beholdes som historikk; ikke aktiv anker |
| smartdok-undersokelse.md | 2026-05-03 | **Sannhetskilde:** SmartDok UI-research 2026-04-26 brukt som basis for SmartDok-import 2026-05-03 (`1f2c0da2`) + Heatwork-utleie-Equipment-utvidelse 2026-05-06. Beholdes som referanse for fremtidig SmartDok-cutover |
| timer-input-katalog.md | 2026-05-02 | Timer-input-spec brukt for Runde 1A (lønnsarter/aktiviteter/tillegg) deployet til prod 2026-05-01. Beholdes som referanse |

## ❌ Ikke screenet

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| adaptiv-sok-plan.md | — | Skal drøftes (per CLAUDE.md) |
| aktivitetsfeed.md | 2026-05-01 | **Planlagt fase** (etter Maskin Fase 1 + Timer Fase 3). Activity-tabell finnes i prod (E.1 `13a746a7`), ingen produsent-kode skrevet ennå |
| ai-integrasjon.md | — | — |
| ai-sok.md | — | — |
| api.md | — | Drift mtp UX-runde + Vareforbruk-modul: nye routere `vareKategori`/`vare`/`vareforbruk`/`vareImport`/`firmaIntegrasjon`/`timer.rapport` ikke dokumentert |
| bibliotek.md | — | Peker til kontrollplan.md (konsolidert) |
| byggeplass-strategi.md | — | Planlagt fase. Fase 0.5 §§ 1-3 + § 5 implementert 2026-05-01. ByggeplassMedlemskap utsatt til Fase 4 (Mannskap) |
| db-naming-audit-2026-04-25.md | — | Datert audit 2026-04-25 |
| db-opprydning.md | — | **Arbeidsanker:** Markert AKTIV |
| deploy-detaljer.md | — | Operasjonell deploy-info. Lærdom om SITEDOC_INTEGRATION_KEY må stå i BÅDE web- og api-ecosystem-blokker tilføyd 2026-05-07 |
| hjelpetekster.md | — | Konvensjon for ?-ikon + sidestatus-tabell |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| maskin.md | 2026-05-01 | Blokk A+B+C+C1+C2 + parser-verifikasjon. Prod-deploy 2026-05-01. **Steg 3 deployet 2026-05-03** (`33a2b9b4`) — sitedoc_admin med firma-kontekst kan importere SmartDok-Excel. **U6-fix 2026-05-06** (`3dd4371b`) — equipment-router gates trygt på sitedoc_admin firma-kontekst. **Equipment-utleie-utvidelse 2026-05-06** (`b7127475`) — `erUtleieobjekt`/`utleieprisPerDogn`/`utleieprisPerTime`/`utleieEnhet` |
| migrering-reporttemplate.md | — | Ikke implementert |
| planlegger.md | — | Planlagt fase |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 |
| timer.md | 2026-05-12 | Runde 1A+1B+1C (`c1122c2e`) + Runde 2 C1-C8 (`1cce62f3`) + Runde 2.5/C9 + 2.6 + 2.7 (`de33aefc`/`03d8c63a`/`05b3bddb`) + attestering-rename (`8aa792b2`) deployet til prod 2026-05-02. **Steg 4a** (ECO-flytt på attestering, `da6b34a5`) deployet 2026-05-03. **U1** (leder-timer-rapport, `c551063f`) + **U2** (CSV/Excel-eksport, `31cff7da`) deployet 2026-05-06. **T.1–T.6 arkitektur-redesign** (PR 1A `862c70c3` + PR 1B `bba971ba` + PR 2A `6431873c` + PR 2B `8478d4a7` + PR 2C min `0700b8ed`) deployet prod 2026-05-12: `DailySheet.projectId` droppet, projectId/byggeplassId/fraTid/tilTid/attestert*-felter på rad-nivå, `OrganizationSetting.tidsrundingMinutter` (T.5). Schema-tabeller og indekser oppdatert. Åpen oppgave: PR 2C full (mobil Drizzle-omskriving) |
| varsling.md | — | — |

## 📦 Arkivert

| Fil | Arkivert | Kommentar |
|---|---|---|
| arkitektur-oppsummering-2026-04-25.md | 2026-04-28 | Datert arkitektur-snapshot → [docs/arkiv/](../arkiv/). Innhold dekt av arkitektur-syntese.md |
| arkitektur-qa-runde-2-2026-04-25.md | 2026-04-28 | Opus QA-runde 2 → [docs/arkiv/](../arkiv/). Beslutninger konsolidert til fase-0-beslutninger.md |
| audit-data-2026-04-25.md | 2026-04-28 | Read-only audit av dev-DB → [docs/arkiv/](../arkiv/). Åpne audit-spørsmål til db-opprydning.md |
| entreprise-faggruppe-rapport.md | (eldre) | Faggruppe-rename-rapport → [docs/arkiv/](../arkiv/). Faggruppe-rename ferdig på prod (kun alias-rydding gjenstår) |
| faggruppe-rename-plan.md | (eldre) | Faggruppe-rename-plan → [docs/arkiv/](../arkiv/). Plan utført; faggruppe-CRUD-konsolidering deployet 2026-05-05 |
| infrastruktur-moduler.md | (eldre) | Modul-infrastruktur-spec → [docs/arkiv/](../arkiv/). Innhold dekt av arkitektur-syntese.md § 6 + service-lag-mønster |

---

## Forklaring av status-koder

- **✅ Verifisert mot kode** — Innhold sammenlignet mot Prisma-schema/API-routere/UI på datert kjøring. Drift rettet eller ikke funnet. + Kode-kvalitet vurdert. Behandles som pålitelig.
- **⚠️ Drift identifisert** — Innhold sammenlignet mot kode på datert kjøring. Avvik funnet og dokumentert, men ennå ikke rettet. Behandles som upålitelig på drift-punktene; resten kan brukes med varsomhet.
- **🔄 Under arbeid** — Aktiv arbeidsfil hvor innholdet endres aktivt og status-spørsmålet ikke er meningsfylt før arbeidet er ferdig. Skal slettes eller flyttes til ✅/⚠️/✔️/📦 når arbeidet er ferdig.
- **✔️ Ferdig brukt** — Plan/spec som er fullført og innhold dekt av prod-kode. Beholdes som referanse, ikke aktiv anker. Hvis filen ikke har historisk verdi → arkiver.
- **❌ Ikke screenet** — Aldri verifisert mot kode i en planlagt screening-runde. Innhold kan stemme — eller ikke. Behandles som upålitelig inntil det motsatte er bevist.
- **📦 Arkivert** — Filen er flyttet til `docs/arkiv/` etter at innholdet er overført til aktive sannhetskilder. Hjemløse beslutninger fanget før arkivering. Beholdes for historikk, ikke aktiv referanse.
