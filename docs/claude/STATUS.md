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

**Sist oppdatert:** 2026-07-06 (**STATUS-AKTUELT slanke-runde (docs-only)** — arkivert ~887 linjer ferdig-deployet mai-2026-hale fra `STATUS-AKTUELT.md` § Pågående arbeid → `historikk-2026-05.md` (verbatim, under dagert «Flyttet»-header). Flyttet: «Samlet/Dagens samlede aktivitet» 05-27→05-30, T.5, T4-a→e, T9-a→c, T7-2/T7-3-bunkene + deploy-test-cron + attestering-hint, topbar, ansattrolle, O-5b/c. Beholdt aktivt: a2, PSI Fase A, maskin-dagsseddel Del 1+2, lønnsart ③, mobil-MS/EAS-bunt #37, B2+B6. **TestFlight #24 (superseded) + «Gjenstående PRs (åpne)» bevisst IKKE flyttet** (utenfor DEPLOYET-TIL-PROD-kriteriet — venter cowork-avklaring). Homeless-sjekk: T9d fanget i Kundeønsker §, audit-log-payload levert i T7-2b3 — ingen løft nødvendig. **Ingen ny/slettet fil → fil-telling uendret (58); ingen ✅/🔄-endring.** STATUS-AKTUELT 1156→269 linjer, historikk-2026-05 3908→4801) · 2026-07-06 (**Redesign-øktavslutning — docs/kode-synk + chat-beslutninger.** Ny fil `dev-login-agent.md` (agent-/simulator-testinnlogging Nivå A+B; status ✅ nyskrevet mot kode). `parallell-arbeid-lock.md` kjøreregler → **11** (merge kombinerte kontroll-øktas regel 8 konflikt-redigering + 9/10 `--no-ff` med redesign-øktas 9 i18n-generate-only + 11 build-gate). `redesign-paritetssjekkliste.md` status-blokk (steg ii/iii/iv ✅ + c4 ✅ lukket; steg v venter re-test; B3/B6 godkjente avvik; søke-gating testbar via `test-arbeider`; T9/FM5-restanser). `redesign-handoff.md` § Pilot + test/deploy-strategi. BACKLOG 3 nye 🟡 (Metro blockList, dev-login secrets-oppsett, CLAUDE.md 40373>40k). DOC-MAP dev-login-rad. **Antall filer 57→58, ✅ +1** — dev-login-agent.md på topp av SAMARBEIDSREGLER.md (jf. lærdom (c): to nye filer fra hver sin økt = +2 samlet, ikke to «57»). CLAUDE.md-indeksrad utelatt (40k) → DOC-MAP.) · 2026-07-06 (**Ny styrende fil `SAMARBEIDSREGLER.md` + regel 9 (`--no-ff`) — cowork-styringsverk (docs-only)** — Ny fil `SAMARBEIDSREGLER.md`: rollekart (Kenneth/cowork/fabel/redesign-Opus/develop-Opus/Opus web) + meldingsflyt (alt via Kenneth, ingen agent instruerer en annen direkte) + commit-orden med cowork som eneste eier (regel 9/10 + worktree per spor + prod-gate) + statustavle + **design-godkjennings-akseptkriterium** (flagg-på-endring ikke lukket før fabel designgodkjenner mot skjermbilder; build-gate ≠ designgodkjenning). Indeksert i CLAUDE.md doc-tabell + DOC-MAP («tvil om hvem gjør hva / meldingsflyt»). `parallell-arbeid-lock.md`: «De 8»→«De 9 kjørereglene» + regel 9 (`redesign/navigasjon → develop` alltid `--no-ff`, fra og med neste merge; FF-mergen `b13797f8` ikke omskrevet) — commit `c613fb86`. **Antall filer 56→57 (ny styrende fil, ingen ✅/🔄-tally).** Commits: `c613fb86` (regel 9) + `ebab808a` (samarbeidsregler opprettet) + denne (design-akseptkriterium + STATUS-register-reconciliering — STATUS.md ble oversett i `ebab808a`)) · 2026-07-05 (**Kontroll-økt-reconciliering (docs-only)** — `parallell-arbeid-lock.md`: regel 7→8 (løs merge-konflikt ved å REDIGERE fila, ikke blind `git add`) + lærdom (c) (committet konflikt-markører i `STATUS.md` under redesign-merge `fd9bbfc0`, rettet i `b13797f8`; 55+55→56-reconciliering). BACKLOG § 1: server-ny OS-vedlikehold + restart før redesign-stack. DOCKER-NOTES: rsync overskriver `docker-compose*`/`Dockerfile*` bevisst (kun `docker/env` ekskluderes). **Ingen fil-telling-endring — telling står korrekt på 56, kun innhold**) · 2026-07-05 (**Ny fil `redesign-paritetssjekkliste.md`** — funksjonsparitets-sjekkliste for navigasjonsredesignet (`redesign/navigasjon`, feature-flag `nyNavigasjon`). 130 rader / 109 funksjoner mot ny nav (1a hub, 1b sidebar+søk, 2a–2c mobil), verifisert mot faktiske ruter i `apps/web/src/app/` + `apps/mobile/app/` (14 ruter kom etter 2026-05-03-ankeret). K1–K11 innarbeidet: K1/K2/K4/K5/K6/K10 vedtatt, K3/K7/K8/K11 utsatt, K9-rapport levert (legacy `/dashbord/prosjekter/[id]/*`-tre foreldreløst, `Toppmeny.tsx` død kode). Indeksert i DOC-MAP («Navigasjonsredesign — paritet»). Status 🔄. **Antall filer 54→55, 🔄 +1.** Ny rad-standard 0/130 verifisert-under-flagg) · 2026-07-05 (**Parallell-arbeid-disiplin + BACKLOG-saker (docs-only, develop-worktree)** — Ny fil `parallell-arbeid-lock.md` (7 kjøreregler + frossen sone + /mannskap-kollisjon + 2 lærdommer) + `deploy-detaljer.md` § Worktree-deploy + `DOC-MAP.md`-rad. BACKLOG: 3 nye saker (dagsseddel dobbel-timeføring, modul-onboarding-wizard, `timer.glemtDag.tittel`-i18n-duplikat verifisert). Antall filer 54→55 (ny styrende fil). CLAUDE.md-indeksrad utelatt bevisst (39887/40000 → 40k-grense; fila alt lenket i kontroll-claude-veileder-raden + DOC-MAP). PSI-redirect-sak IKKE ført (ingen verifiserbar bug — `psi/page.tsx:51` er tilsiktet malbygger-åpning; venter symptom). Del 3 (arkivering PSI Fase A/②③) tatt ut — gates på web-verifisering) · 2026-07-05 (**PSI Mannskap Fase A IMPLEMENTERT PÅ DEVELOP (web klar for prod, mobil i EAS-batch-kø)** — første Fase 4-inkrement, vy i PSI-modulen. Ny tabell `PsiTilstedevarelse` (`packages/db`, additiv migrering `20260705120000`, verifisert mot Prismas kanoniske SQL) + router `mannskap.ts` (⭐ feltnivå-isolasjon av klokkeslett mot byggherre-org + 12t lazy-close) + web §15-vy `/dashbord/[prosjektId]/mannskap` + mobil `MannskapInnsjekkKort` (online-only). Sannhetskilde `mannskap.md` § Fase A oppdatert (frontmatter+datamodell «designes»→implementert). i18n 24 nøkler × 15 språk. **Ingen ny/slettet docs-fil → Antall filer 54, ✅/🔄 uendret** (`mannskap.md` forblir 🔄 — kun Fase A av B–E). DB-migrering til `sitedoc_test` gjenstår (gate)) · 2026-07-05 (**②+③ IMPLEMENTERT PÅ DEVELOP (web klar for prod, mobil i EAS-batch-kø)** — ② maskin-velger søk/filter/sortering + maskin≤arbeid proaktiv disable (`731770da`); ③ strukturert overtid `Lonnsart.overtidsnivaa` + garantert standard-lønnsart (`c9cc40ef`, migrasjons-bærende). Sannhetskilder oppdatert med nye seksjoner: `timer.md` (§ Maskin-velger, § Maskin ≤ arbeidstimer, § Overtid-klassifisering), `maskin.md` (Equipment-velger-UX + kapasitet-regel). Delt regel-lag: `packages/shared/src/utils/maskinKapasitet.ts` + `lonnsregel.ts` (ikke docs/claude — utenfor fil-tellingen). BACKLOG: 4 UX/payroll-poster → ✅ + ny 🟢 Lønnsregel-konfig-idé; `eas-build-veileder.md` bygg-logg «Neste batch»-linje. **Innholds-tilføyelser (§ K-konvensjon) — verifikasjons-status uendret; ingen ny/slettet docs-fil → Antall filer 54, ✅/🔄 uendret.** STATUS.md-oppdatering ble oversett i ②/③-commitene, reconciliert her) · 2026-07-04 (**Prod-deploy `0801af38` (kveld)** — PR 1-4 bunt DEPLOYET TIL PROD: org-isolasjon `SheetMachine.vehicleId` §2.D (`90469dc7`) + Leaflet geofence invalidateSize (`6178034f`) + sak #5 firma-ansatt-innsyn dobbel-kilde (`6dbc884a`) + maskin opprett/import-gating (`179b86f9`). De fire flyttet fra BACKLOG «Gjenstår: prod-deploy» → `historikk-2026-07.md` (bunt-sammendrag). Antall filer 54, ✅ uendret (ingen ny/slettet fil). BACKLOG: tre deployet-poster kollapset til historikk-pekere + 2 nye 🟡-poster (maskin-velger søk/filter + maskin≤arbeidstimer proaktiv). Sak #5 lukket) · 2026-07-04 (**Prod-deploy `bb5aec05`** — split-identitet MS-login (Fix A + gate-innstramming web+mobil) + erKunde-fiks + geofence-oppdagbarhet arkivert fra STATUS-AKTUELT → **ny fil `historikk-2026-07.md`**; indeksert i CLAUDE.md doc-tabell. Antall filer 53→54, ✅ uendret. BACKLOG: split-identitet-post slanket til deployet + sak #3 utført, åpne sak #4/#5 beholdt; ny 🟢 kosmetisk-UX-post «Brukere-lista viser ikke arvet firma_admin». Sak #3 (KMY-duplikat B→A) utført manuelt mot prod) · 2026-06-22 (Ny fil `mobil-dagsseddel-ui-spec.md` — mål-spec for mobil dagsseddel-UI v2-overhaul, fasiten A.Markussen verifiserer mot; konsoliderer T.7-layout + Slice 1–4 + T.11/T.12 + R4 + device-funn. U-serie: U1–U3 visuelle + U-flyt (multi-økt-append + glemt-dag-robusthet, flyt-endring; rotårsaker verifisert: `opprettDagsseddelForSegment:589` append-gap, `splittVedMidnatt:61` fler-døgns-uten-cap). Indeksert i CLAUDE.md doc-tabell. Status 🔄. Antall filer 52→53, 🔄 +1. Samtidig: GPS-privacy-by-design-note i `timer-gps-prosjekt-utredning.md` (kun inn/ut-event, aldri spor; §15-mapping; juridisk sign-off gjenstår) + BACKLOG `organizationId:""`-undersøk-note (`StartSluttDagKort.tsx:614`)) · 2026-06-21 (Doc-hygiene-batch: DRIFT-1..5 reconciliert i `timer.md` (PR 2C-status 🔴→🟡 splittet, UX-skisse pre-T.1 → T.7 per-rad, ny «Fritekstsøk på velgere»-subseksjon, auto-fordeling-ordlyd rettet mot T.9-droppet-fasit). **Slettet:** `redesign-dagsseddel-funn-2026-06-20.md` (midlertidig arbeidsdok, ikke talt — alle beslutninger Explore-verifisert fanget i fase-0/timer-gps-utredning/timer.md) + `timer-input-katalog.md` (DRIFT-4, tom plassholder; 2 lenker repointet til `timer.md`; spec bor kanonisk i timer.md § Datamodell). Antall filer 53→52, ✅ uendret. BACKLOG § Doc-drift + Følgesaker markert løst. **CLAUDE.md trimmet 39844→39105** (Server-deploy-mekanikk-blokk kollapset til 2 styrende regler + peker til DOCKER-NOTES; ingen overordnet regel fjernet)) · 2026-06-20 (Beslutnings-folding: `timer-gps-prosjekt-utredning.md` BESLUTNING 1 vedtatt **B (auto-utkast)** — agenda fortsatt åpen for beslutning 2–6. Foldet til `fase-0-beslutninger.md`: T.8 vedtatt B (separasjons-prinsipp markert «dagens atferd» til Del 3) + nye T.11 (maskin-registrering gated på kompetansematrise) + T.12 (fritekst-produksjonsbeskrivelse per timer-rad). Tellinger uendret (innholds-statusendring, ikke ny/slettet fil). `timer.md :416/:688 «aldri auto-rad» bevisst IKKE flippet — korrekt til Del 3 bygges) · 2026-06-13 (Ny fil `timer-gps-prosjekt-utredning.md` — session-klar agenda, 6 avhengighets-ordnede beslutninger rundt timer/GPS/prosjekt-tilknytning/dag-flyt (T.8 først); samlet fra R4 + EAS-test 2026-06-13. Indeksert: CLAUDE.md doc-tabell + DOC-MAP-rute. Status 🔄 Under arbeid. Antall filer 52→53, 🔄 11→12. Relatert: BACKLOG § Timer-relatert T.8-utredning + fase-0 T.8 «under revurdering») · 2026-06-12 (Ny fil `eas-build-veileder.md` — EAS iOS-bygg/credentials/app-variants, opprettet fersk under R4 mobil-enhet-verifisering; indeksert i CLAUDE.md doc-tabell + DOC-MAP-rute «EAS-bygg/credentials-endring». Status ✅ Verifisert mot kode (prosessen utført + verifisert 2026-06-12). Antall filer 51→52, ✅ 6→7. **Del B app-variants implementert:** ny `apps/mobile/app.config.js` (betinget `name` + `ios.bundleIdentifier` på `APP_VARIANT=test`) + `APP_VARIANT` i eas.json test-env; veileder § App variants planlagt→implementert; scheme/android.package holdt delt pga hardkodet `auth.ts:84` → full scheme-separasjon fanget i BACKLOG. **Build-automatisering:** `apps/mobile/eas-build.sh` wrapper (sourcer `.env.eas.local` → `eas build`) + `apps/mobile/.gitignore` (`.env.eas.local`, credential-fil committes aldri); veileder § Automatisert bygg) · 2026-06-11 (Reisetid-matrise R1–R4 på develop — R1 grunnmur schema `ReisetidMatrise`+rute-service `562fd707`, R2 kontor-geokoding+kart `876ad9ca`, R3 recompute-motor+triggere `7d98b80a`, R4 oppslag+mobil-cache `39912f4b`; sannhetskilde `timer.md` § Reise og oppmøtested; STATUS-AKTUELT R1–R4-entry; referanse-rens `api.md`/`mobil.md`/`arkitektur.md`; BACKLOG-entries: IA/UX-restrukturering, 2 funn (impersonering/onboarding), matrise-trigger-luke, GPS-logging-nedgradering, HMS §15, matrise-viewer, typecheck-gjeld; 2 scratch-rapporter slettet) · 2026-06-10 (`FASE-1-PLAN-oppmotested-gps.md` slettet — SPOR 3 prod-deployet, innhold rutet; ref fjernet fra fil-tellingen. OPPSUMMERING beholdt (egen lenke-reconciliering)) · 2026-06-10 (**SPOR 3 DEPLOYET TIL PROD** — Fase 1+1b+1c-server+2+3, prod-merge `aed86d0f`, 5 migrasjoner verifisert via `_prisma_migrations`; arkivert fra STATUS-AKTUELT → `historikk-2026-06.md`, STATUS-AKTUELT trimmet til aktivt arbeid) · 2026-06-09 (BACKLOG § Timer-relatert: ny entry «Reise (Fase 3) — forbedringer etter MVP» — 3 idéer: Google-kjøretid-matrise kontor×byggeplass [ANBEFALT, erstatter estimat-MVP avvik C] + per-prosjekt reisetid-berettigelse-flagg + kontinuerlig GPS-logging [🔴 personvern-gate]; distinkt fra §G3 policy-bekreftelse `:554`) · 2026-06-09 (SPOR 3 Fase 1c-server byggeplass-geofence implementert — schema/migrasjon + shared-beregning + API-triggere + web override; BACKLOG § Teknisk gjeld: legacy eide prosjekter mangler `ProjectOrganization`-rad (1b-funn, backfill foreslått); SPOR 3 Fase 1b firma-isolasjon på develop/test, commit `eea004cb`; Gap B til BACKLOG (Fase 1c byggeplass-georef + Leaflet-kartvelger + EAS-verifisering)) · 2026-06-08 (timer-arkitektur-beslutningssett rutet til sannhetskilder — SPOR 2: ankerbatch (to-produkt-isolasjon i terminologi/arkitektur/arkitektur-syntese + CLAUDE.md regel/veiledere/40k-trim + SPOR 1 til BACKLOG) + modul-spec-batch (timer.md § Planlagte utvidelser, maskin.md vedlikehold≠drift, mannskap.md § E fra/til-isolasjon, planlegger.md premiss, fase-0 § T.10). Grunnlag: arbeidsdokument `OPPSUMMERING-timer-arkitektur.md`, IKKE i registeret)
**Antall filer dekket:** 58 (52 i `docs/claude/` + 6 i `docs/arkiv/`) — `dev-login-agent.md` (agent-testinnlogging, status ✅) tilføyd 2026-07-06. `SAMARBEIDSREGLER.md` (styrende, rollekart + meldingsflyt + commit-orden + design-godkjennings-akseptkriterium) tilføyd 2026-07-06. `redesign-paritetssjekkliste.md` (navigasjonsredesign-paritet, status 🔄) + `parallell-arbeid-lock.md` (styrende, parallell-arbeid-disiplin) begge tilføyd 2026-07-05. `historikk-2026-07.md` tilføyd 2026-07-04 (arkiv juli-prod-deploys, status ✅). `mobil-dagsseddel-ui-spec.md` tilføyd 2026-06-22 (mål-spec, status 🔄 — forankrer U-overhaulen). `timer-input-katalog.md` slettet 2026-06-21 (DRIFT-4; spec konsolidert i `timer.md`). `timer-gps-prosjekt-utredning.md` tilføyd 2026-06-13; `eas-build-veileder.md` tilføyd 2026-06-12; `kontroll-claude-veileder.md` tilføyd 2026-06-08. `OPPSUMMERING-timer-arkitektur.md` er midlertidig arbeidsdokument (banner: IKKE i DOC-MAP), ikke talt — lenke-reconciliering (BACKLOG §G peker hit) i egen runde. `FASE-1-PLAN-oppmotested-gps.md` slettet 2026-06-10 (SPOR 3 prod-deployet; innhold rutet til `timer.md` + BACKLOG)

> **SPOR 3 DEPLOYET TIL PROD 2026-06-10 (prod-merge `aed86d0f`):** Hele timer-arkitektur-sekvensen — Fase 1 (oppmøtested `ea511e3c`) + 1b (firma-isolasjon `eea004cb`) + 1c-server (byggeplass-geofence `ee45ead3`) + 2 (Alt C / ikke-prosjekt-tid `12678577`) + 3 (reise-regelsett `162ef59e`). 5 migrasjoner anvendt på prod (`@sitedoc/db` ×4 + `@sitedoc/db-timer` ×1), verifisert via `_prisma_migrations` (alle finished, 0 blokkerende), prod-DB-LÅS satt/sluppet. Detaljer + per-fase-sammendrag arkivert i `historikk-2026-06.md`. Sannhetskilder uendret i `timer.md` (§ Reise og oppmøtested / § Byggeplass-geofence / § Ikke-prosjekt-tid / § Firma-isolasjon). **Utestående:** mobil-deler via EAS + innlogget prod-verifisering.
>
> **Docs-/commit-/push-rutine forankret 2026-06-08:** roller + dual-review-gate i `kontroll-claude-veileder.md` § 10; CLAUDE.md auto-commit/auto-deploy reconciliert (commit+push etter dual-review, ikke auto) + peker til § 10. Mobil-auth-funn til BACKLOG (logout-frys nær-fiks + dev-login IPv6 + rå-fetch-timeout-utvidelse). Fase 1-oppfølgere (Leaflet-kartvelger / EAS-verifisering / Fase 1c byggeplass-georef) fanget i BACKLOG før `FASE-1-PLAN`-arbeidsdokumentet fjernes.

---

## Prod-deploys 2026-05-03 → 2026-06-05

**2026-06-05 — OAuth account-linking + signIn-guard mot orphan-kontoer:**
- `e12355d9` (prod-merge) — `allowDangerousEmailAccountLinking: true` på Google + Microsoft (`apps/web/src/auth.ts`): logg inn med enten tilbyder på samme e-post → samme konto. Reverserer H3-audit (trygt: begge IdP-er verifiserer e-post-eierskap).
- `f6522a94` (prod-merge, commit `ef5906bb`) — Blokkerende web `signIn`-guard: uinviterte OAuth-pålogginger avvises (`auth.feil.AccessDenied`, 14 språk) og oppretter IKKE tom orphan-konto. Regler a/b/c/d. Verifisert på test at `return false` hindrer User-opprettelse. Duplikat-/orphan-opprydding i prod-DB (Mathias-typo, Malin/kmy gmail-orphans). Ingen migrasjon.
- `f3a16cef` (prod-merge, commit `91fa7867`) — Mobil orphan-guard i `mobilAuth.byttToken` (samme a/b/c/d → `TRPCError FORBIDDEN`). Både web- og mobil-OAuth nå dekket. Detaljer i [historikk-2026-06.md](historikk-2026-06.md).

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
| ✅ Verifisert mot kode | 7 |
| ⚠️ Drift identifisert | 4 |
| 🔄 Under arbeid | 12 |
| ❌ Ikke screenet | 21 |
| ✔️ Ferdig brukt (lukket) | 3 |
| 📦 Arkivert | 6 |
| **Totalt** | **53** |

---

## ✅ Verifisert mot kode

| Fil | Sist verifisert | Kommentar |
|---|---|---|
| arkitektur.md | 2026-04-27 | **Sannhetskilde:** Fundament. + YAML-header + K(2026-06-08): firmamodul-isolasjon (org vs prosjekt) + planlagte timer-entiteter (Oppmotested, Project.type, vehicleId) |
| arkitektur-syntese.md | 2026-05-01 | **Sannhetskilde:** Anker for Fase 0-koding (sammen med fase-0-beslutninger.md). 3A komplett. § 5 Fase 0.5: A.30 byggeplassId-NULL = A1 vedtatt. § 6.1.1 Cross-modul-tilgang via service-lag. K(2026-06-08): § 2.6 firma-isolasjon + § 3.4 fra/til-isolasjon (reconciling) |
| dokumentflyt.md | 2026-04-27 | **Sannhetskilde:** Fundament. § 2.3 HMS-tabell utvidet med firma-HMS-ansvarlig-lese-tilgang (per A.27) |
| fase-0-beslutninger.md | 2026-05-12 | **Sannhetskilde:** Anker for Fase 0/0.5-koding. § E KOMPLETT på prod (alle 13 § E-steg). A.4-overstyring oppdatert 2026-05-05 (peker til Steg 1e). **§ T (T.1–T.6) tilføyd 2026-05-11 (`1d819ff4`)** — Timer-modul arkitektur-redesign, deployet prod 2026-05-12 (PR 1A–2C). **§ T.10 (2026-06-08):** Ikke-prosjekt-tid (Alt C) + oppmøtested + reise-regelsett — T.2 IKKE gjenåpnet |
| terminologi.md | 2026-04-27 | **Sannhetskilde:** Fundament. K(2026-06-08): to-produkt-isolasjonsmodell (§ 0) — prosjektmodul=projectId / firmamodul=organizationId |
| SITEDOC-CLAUDE-VEILEDER.md | 2026-05-03 | **Meta-fil:** Sesjonsoppstart-veileder for Opus |
| kontroll-claude-veileder.md | 2026-06-08 | **Meta-fil:** Arbeidsmåte for kontroll-Claude (verifiseringslaget over Opus). Indeksert i CLAUDE.md. Se `parallell-arbeid-lock.md` (repo-rot). K(2026-06-08): § 10 Docs-/commit-/push-rutine (dual-review-gate; CLAUDE.md auto-commit reconciliert + peker hit) |
| eas-build-veileder.md | 2026-06-12 | **Meta-fil:** EAS iOS-bygg-veileder — credentials (App Store Connect API-nøkkel + 2FA-felle), profiler (`test` → api-test), enhet-registrering, app variants. Skrevet fersk under R4 mobil-enhet-verifisering; prosessen utført + verifisert samme dag. Indeksert i CLAUDE.md + DOC-MAP |

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
| redesign-paritetssjekkliste.md | 2026-07-05 | **Arbeidsanker:** Akseptkriterium for `redesign/navigasjon` (flag `nyNavigasjon`). 130 rader / 109 funksjoner, verifisert mot faktiske ruter. K1–K11 innarbeidet (6 vedtatt / 4 utsatt / K9-rapport levert). Fylles i «Verifisert»-kolonnen under flagg-testing. Godkjent av Kenneth 2026-07-05 |
| docs/redesign/redesign-handoff.md | 2026-07-05 | **Redesignreferanse (branch `redesign/navigasjon`):** Designspec + strategi (develop-bak-flagg, main-ren, eget stack senere) + følgefiler (HTML-prototyper 1a–2c, 6 designscreenshots, K-BESLUTNINGER). Reiser med redesign-mergen — indeksrad + DOC-MAP lagt på branchen |
| timer-gps-prosjekt-utredning.md | 2026-06-20 | **Arbeidsanker:** Session-klar agenda — 6 avhengighets-ordnede beslutninger (timer/GPS/prosjekt/dag-flyt). **BESLUTNING 1 vedtatt B (auto-utkast) 2026-06-20**, foldet til fase-0 T.8 + T.11 + T.12; beslutning 2–6 fortsatt åpne. Ingen kode før resterende beslutninger. Relatert: BACKLOG § Timer-relatert + fase-0 T.8/T.11/T.12 |
| mannskap.md | 2026-07-05 | **Vy-beskrivelse i PSI-konteksten** etter 1D-presisering. **Fase A implementert på develop 2026-07-05:** datamodell `PsiTilstedevarelse` + `mannskap.ts`-router + web §15-vy + mobil manuell innsjekk; feltnivå-isolasjon av klokkeslett (byggherre ser §15-aggregat). Fase B–E parkert. K(2026-06-08): fra/til feltnivå-isolasjon (§ E — byggherre/SHA-KU ser §15-aggregat, ikke klokkeslett) |
| oppryddings-plan-2026-04-28.md | 2026-04-30 | **Arbeidsanker:** Aktiv anker. P1.1+P1.2+P1.3+P1.4+P1.5+P1.6+P1.7+P4.3+P4.4+C.15+SCREENING-29-1+SCREENING-29-3 lukket. N2.2.3+N2.2.4 omformulert (avventer ekstern API-tilgang). 3A komplett |
| parallell-arbeid-lock.md | 2026-07-06 | **Styrende:** Parallell-arbeid mellom worktrees/økter — 9 kjøreregler (regel 9: `redesign→develop` alltid `--no-ff`, fra og med neste merge), frossen sone, /mannskap-kollisjon, 2 lærdommer (index.lock-diagnostikk + ukommittert-blokkerer-checkout→worktrees). Ny 2026-07-05. Indeksert i DOC-MAP (ikke CLAUDE.md-tabell pga 40k-grense — allerede lenket i kontroll-claude-veileder-raden) |
| SAMARBEIDSREGLER.md | 2026-07-06 | **Styrende:** Rollekart (Kenneth/cowork/fabel/redesign-Opus/develop-Opus/Opus web) + meldingsflyt (alt via Kenneth) + commit-orden med cowork som eneste eier (regel 9/10, worktree per spor, prod-gate) + statustavle. **Design-godkjennings-akseptkriterium:** flagg-på-endring ikke lukket før fabel har designgodkjent mot skjermbilder (build-gate ≠ designgodkjenning). Ny 2026-07-06. Indeksert i CLAUDE.md doc-tabell + DOC-MAP |
| timer-funn-fra-screening-2026-04-27.md | 2026-04-28 | **Arbeidsanker:** Midlertidig, slettes etter Timer/Maskin-revurdering |
| dagsseddel-design.md | 2026-05-02 | **Arbeidsanker:** Aktivitet flyttet til `SheetTimer.aktivitetId` (NOT NULL) per rad — implementert i Runde 2.5/C9 deployet til prod 2026-05-02 |
| mobil-dagsseddel-ui-spec.md | 2026-06-22 | **Arbeidsanker:** Mål-spec for mobil dagsseddel-UI (v2-overhaul) — fasiten A.Markussen verifiserer mot. Konsoliderer T.7-layout + Slice 1–4 + T.11/T.12 + R4 + device-funn. U-serie: U1–U3 visuelle (topp-sum/v2-layout/affordance/polish) + U-flyt (multi-økt-append + glemt-dag-robusthet — flyt-endring). Sekvensering: U1–U3 først, U-flyt før aug/sept reell test. **Spec bekreftet, U1 plan-først neste.** |
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
| deploy-detaljer.md | — | Operasjonell deploy-info. Lærdom om SITEDOC_INTEGRATION_KEY må stå i BÅDE web- og api-ecosystem-blokker tilføyd 2026-05-07. K(2026-06-08): pgvector-gotcha — lokal `migrate dev` feiler på shadow-DB, håndskriv migrasjon i idempotent stil |
| hjelpetekster.md | — | Konvensjon for ?-ikon + sidestatus-tabell |
| infrastruktur.md | — | — |
| kontrollplan.md | — | — |
| maskin.md | 2026-05-01 | Blokk A+B+C+C1+C2 + parser-verifikasjon. Prod-deploy 2026-05-01. **Steg 3 deployet 2026-05-03** (`33a2b9b4`) — sitedoc_admin med firma-kontekst kan importere SmartDok-Excel. **U6-fix 2026-05-06** (`3dd4371b`) — equipment-router gates trygt på sitedoc_admin firma-kontekst. **Equipment-utleie-utvidelse 2026-05-06** (`b7127475`) — `erUtleieobjekt`/`utleieprisPerDogn`/`utleieprisPerTime`/`utleieEnhet`. K(2026-06-08): vedlikehold≠drift-skille (`SheetTimer.vehicleId` vs `SheetMachine.vehicleId`). **② (2026-07-05, develop):** Equipment-velger-UX (søk/kategori/sortering) + maskin≤arbeid kapasitet-regel notert (`731770da`) |
| migrering-reporttemplate.md | — | Ikke implementert |
| planlegger.md | — | Planlagt fase. K(2026-06-08): forhåndsfyll-aldri-lås-premiss + YAML-header tilføyd |
| shared-pakker.md | — | — |
| smartdok-undersokelse-2026-04-25.md | — | Arkivert v1 |
| timer.md | 2026-05-12 | Runde 1A+1B+1C (`c1122c2e`) + Runde 2 C1-C8 (`1cce62f3`) + Runde 2.5/C9 + 2.6 + 2.7 (`de33aefc`/`03d8c63a`/`05b3bddb`) + attestering-rename (`8aa792b2`) deployet til prod 2026-05-02. **Steg 4a** (ECO-flytt på attestering, `da6b34a5`) deployet 2026-05-03. **U1** (leder-timer-rapport, `c551063f`) + **U2** (CSV/Excel-eksport, `31cff7da`) deployet 2026-05-06. **T.1–T.6 arkitektur-redesign** (PR 1A `862c70c3` + PR 1B `bba971ba` + PR 2A `6431873c` + PR 2B `8478d4a7` + PR 2C min `0700b8ed`) deployet prod 2026-05-12: `DailySheet.projectId` droppet, projectId/byggeplassId/fraTid/tilTid/attestert*-felter på rad-nivå, `OrganizationSetting.tidsrundingMinutter` (T.5). Schema-tabeller og indekser oppdatert. Åpen oppgave: PR 2C full (mobil Drizzle-omskriving). K(2026-06-08): § Planlagte arkitektur-utvidelser (reise/oppmøtested/Alt C/firma-isolasjon — rapport-lekkasje notert som kjent issue). **Fase 1b (2026-06-08):** § Firma-isolasjon (sikkerhetslag) lagt til — helper + 4 skrive-stier + rapport-org-filter implementert, lekkasje lukket. **Reisetid-matrise R1–R4 (2026-06-11, develop):** § Reise og oppmøtested utvidet — R1 grunnmur (`562fd707`) + R2 geokoding/kart (`876ad9ca`) + R3 recompute-motor/triggere (`7d98b80a`) + R4 oppslag/mobil-cache (`39912f4b`). **②+③ (2026-07-05, develop):** § Maskin-velger + § Maskin ≤ arbeidstimer + § Overtid-klassifisering (`Lonnsart.overtidsnivaa` + delt `lonnsregel.ts`/`maskinKapasitet.ts`); `731770da`+`c9cc40ef` |
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
