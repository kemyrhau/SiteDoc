---
name: parallell-arbeid-lock
status: styrende
sist_verifisert_mot_kode: 2026-07-09
sist_endret: 2026-07-09
---

# Parallell-arbeid — lås og kjøreregler

> **Les denne FØR du rører delte filer.** Flere Cowork-økter (f.eks. redesign-økta + en develop-doc/feature-økt) jobber samtidig mot samme repo via **separate git-worktrees**. Denne fila er koordineringspunktet: kjøreregler + frossen sone + kjente kollisjoner. Arbeidsmåten ellers ligger i [kontroll-claude-veileder.md](kontroll-claude-veileder.md).

## Worktrees (én rolle per tre)

| Worktree | Branch | Rolle |
|----------|--------|-------|
| `…/SiteDoc` | **`develop`** | **Kenneths dev-tre.** Hovedklonen (eier `.git`). Kjører appen, eier `develop`-branchen, og er **deploy-kilden** — `deploy-test.sh` krever `git branch --show-current` = `develop`, som kun et tre som *eier* branchen kan svare på. Docs-commits skjer her. |
| `…/SiteDoc-develop` | **detached, parkeres på `origin/develop`** | **Økt-treet.** Én Opus om gangen, via tavle-rad. Kan bære u-gatede lokale commits → **aldri merge-kilde**. |
| `…/SiteDoc-merge` | **detached på `origin/develop`** | **Merger utføres KUN her.** Hard-resettes til `origin/develop` før hver bruk → bærer aldri egne commits (regel 1 + 13). Pusher med `git push origin HEAD:develop` — den skal **ikke** eie `develop`-branchen; `SiteDoc` gjør det. |
| `…/SiteDoc-deploy` | `main` | Prod-deploy (rsync-kilde). |

**Fire trær. Et femte krever en tavle-rad for å eksistere** ([SAMARBEIDSREGLER § Statustavle](SAMARBEIDSREGLER.md)) — raden bærer tre-stien.

> ⚠️ **Rolle-omskriving 2026-07-17 (Kenneth-vedtak K-a/K-b).** `SiteDoc` sto som *«redesign-økta eier dette treet»* fra da redesign og develop gikk parallelt. **Redesignet ble fullmerget 2026-07-09** (regel 3) — rollen døde da, men fila ble ikke oppdatert, og treet ble stående detached 39 commits bak develop. `sitedoc-server`-raden er fjernet: `ny-server` har 0 commits utenfor develop siden 2026-06-10, Docker-cutoveren er ferdig, og treet er fjernet.
>
> **Bakgrunn verdt å beholde:** 2026-07-17 hadde åtte SiteDoc-mapper vokst fram. Tre (`-del6`, `-fratil`, `-oppfolgere`) sto ikke i denne fila i det hele tatt — de var rester fra døde økter. En oppryddingsplan foreslo først å slette **merge-treet** (sikkerhetsnettet i lærdom (e)), fordi verken fabel eller cowork hadde lest dette dokumentet. **Kenneth spurte «hvor skal vi lete etter filer for å koordinere» — svaret var denne fila, som `CLAUDE.md` sier at kontroll-laget skal lese først.**

## De 13 kjørereglene (ufravikelige i parallell modus)

1. **Ett worktree per rolle — aldri kryss-skriv.**

   *Omskrevet 2026-07-17 — redesign-rollen er død, se rolle-tabellen.* `…/SiteDoc` eier `develop`: Kenneths dev-tre, docs-commits, deploy-kilde. Opus-arbeid skjer i `…/SiteDoc-develop` på egen feature-branch. Merger KUN i `…/SiteDoc-merge`.

   **Bruk ALLTID eksplisitt `git -C <tre> …`** + absolutte stier. **Stol aldri på gjeldende arbeidskatalog** — worktrees deler samme `.git`, så et bart `git commit` treffer det treet cwd tilfeldigvis står i, og committer på feil branch uten at det er synlig. Verifiser `git -C <tre> rev-parse --abbrev-ref HEAD` FØR du rører noe. Se lærdom (d).

   **Historikken under gjaldt redesign-perioden, men lærdommene (b)/(d)/(e) er beholdt:** de handler om delte worktrees, ikke om redesign. De gjelder like fullt for én Opus + én cowork.
   **Redesign→develop-merger skjer ALDRI i `…/SiteDoc-develop`** — det treet eies eksklusivt av develop-sporet og kan bære u-gatede lokale commits, som en merge-push da drar med ut til origin (se lærdom (e) + regel 13). Merger utføres i et **dedikert merge-tre (`…/SiteDoc-merge`) som hard-resettes til `origin/develop` FØR hver bruk** (`git -C ~/Documents/Programmering/SiteDoc-merge fetch origin && git -C ~/Documents/Programmering/SiteDoc-merge reset --hard origin/develop`) — da kan merge-treet aldri bære fremmede lokale commits ut via merge-push.
2. **Verifiser branch før hver commit:** `git rev-parse --abbrev-ref HEAD` = forventet branch. Worktrees deler samme `.git` → feil tre committer på feil branch uten at det er åpenbart.
3. **Frossen sone koordineres via denne fila** (liste under). Filene redigeres ALDRI blindt fra to økter samtidig. ~~`generate.ts` (i18n) kjøres KUN på redesign-branchen mens redesignet pågår.~~ **i18n-frysen løftet 2026-07-09:** redesignet er fullt merget i develop (`origin/redesign/navigasjon` er ancestor av develop), så `generate.ts` kjøres nå på develop som normalt — ingen kryss-branch-kollisjon lenger.
4. **/mannskap-kollisjonen (PSI ↔ redesign):** PSI Fase A (`6882aa02`) la til `/dashbord/[prosjektId]/mannskap` + **enkel** nav-registrering i `HovedSidebar.tsx`. Avtale: **PSI legger til siden + minimal nav-entry; redesignet eier nav-strukturen** og re-homer entryen. To økter redigerer aldri `HovedSidebar.tsx`/rutestrukturen blindt samtidig.
5. **Commit eller stash før du forlater et tre.** Ukommittert arbeid i ett worktree blokkerer `git checkout` av samme branch i et annet — se lærdom (b). Ikke la ukommittert arbeid ligge og blokkere en annen økt.
6. **`index.lock` — foreldreløs lås: diagnostisér før fjerning.** En `.git/index.lock` fra en krasjet/avbrutt git-prosess blokkerer alle git-operasjoner. Sjekk (a) om en git-prosess faktisk kjører, (b) låsens alder, (c) størrelse (0 byte = trygt foreldreløs) FØR du fjerner. Aldri blind-slett — se lærdom (a).
7. **Dual-review-gate + kode+docs i samme commit gjelder uendret i parallell modus.** Hver økt gate-verifiserer eget arbeid mot koden før develop-commit; aldri push til `develop` uten diff + verifisering.
8. **Løs merge-konflikter ved å REDIGERE fila, ikke bare `git add`.** `git add` på en fil med konflikt-markører stager `<<<<<<<`/`=======`/`>>>>>>>` rått → de havner i commiten. Rediger fila (behold begge sider der begge er gyldige), fjern alle markører, verifiser `grep -c '^<<<<<<<\|^=======\|^>>>>>>>' <fil>` = 0, DERETTER `git add` + commit. Ved parallell-arbeid oppstår konflikter i delte indeks-/status-filer (`STATUS.md`, `DOC-MAP.md`, `CLAUDE.md`) ved merge develop↔redesign — se lærdom (c).
9. **i18n `generate.ts` — frysen LØFTET 2026-07-09** (utdyper regel 3). Mens redesignet pågikk ble generate kjørt KUN på redesign-branchen for å unngå kollisjon i de 15 språkfilene. Nå som redesignet er fullt merget i develop kjøres `generate.ts` på develop som normalt: en økt som legger i18n-nøkler committer nb+en og kjører deretter generate selv. (Regelen reaktiveres kun hvis en ny langlevd branch igjen redigerer i18n parallelt.)
10. **`redesign/navigasjon → develop` merges med `--no-ff`** + melding `merge(redesign): <steg> → develop` (fra og med neste merge, aldri fast-forward). Hver redesign-inkrement får en grense-commit → redesignet er synlig som enhet i develop-historikken OG revertbar som enhet (`git revert -m 1 <merge>`). Gjelder **kun fremover** — den allerede innflettede FF-mergen (`b13797f8`) skrives IKKE om; ingen rebase/rewrite av develop for å «fikse» historikk. Hold `(redesign)`-commit-scope strengt; utført fra det dedikerte merge-treet `…/SiteDoc-merge` (regel 1) — **aldri fra `SiteDoc-develop`**, som kan bære u-gatede lokale commits. Ansvar: kontroll-Claude eier regelen (develop-doc); redesign-Opus følger den ved merge.
11. **Build-gate — full lokal build FØR merge.** `pnpm --filter @sitedoc/web build` (eller berørt app: api/mobil-typecheck) skal være grønn før develop-merge. Fanger prerender-/typefeil før de treffer test (jf. `useNyNavigasjon`-Suspense-regresjonen 2026-07-05).
12. **Pre-push u-gatet-commit-sjekk.** Før push til `develop` fra et delt worktre: kjør `git log origin/develop..HEAD --oneline` og bekreft at ALLE commits i deltaet er dine egne OG gate-verifiserte. Finnes en commit fra en annen økt/agent som ikke er gate-godkjent → **IKKE push**; koordiner med Kenneth/eier-økta først. En push drar ALLE lokale commits under HEAD ut, ikke bare dine. Bakgrunn: 2026-07-06 dro redesign-Opus' merge-push (`5e16987b`) develop-Opus' u-gatede slanke-commit (`e8347671`) ut til origin fordi begge delte `SiteDoc-develop`-worktreet — utfallet var rent, men en u-verifisert commit kan shippe utilsiktet slik. Primærprinsipp uendret (regel 1: helst én økt per worktre) — dette er sikkerhetsnettet når det brytes.
13. **Pre-push-abort ved fremmed commit (gjelder ENHVER økt som pusher `develop`).** Regel 12 er den *positive* sjekken (bekreft at deltaet er ditt); **dette er abort-kravet ved brudd.** Før hver push: `git log origin/develop..HEAD --oneline` skal inneholde KUN dine egne, gate-verifiserte commits. Finnes én fremmed commit (annen økt/agent, ikke re-gate-godkjent) → **ABORT, IKKE push**, eskalér til Kenneth — push ALDRI «som autorisert» når deltaet er urent. En push drar HELE deltaet under HEAD ut til origin, ikke bare dine commits. Bakgrunn: 2026-07-07 dro tre `redesign→develop`-merger i det delte `SiteDoc-develop`-treet develop-Opus' u-gatede onboarding-commits (`97a2912f`/`34ae939f`) ut til origin FØR re-gate; task-2-piggybacken bar dessuten et Suspense-bygg-brudd ut (fanget + fikset i `1730263b`). Alle tre ville stoppet av merge-tre-guarden (regel 1) + denne abort-regelen.

## ~~Frossen sone~~ — LØFTET 2026-07-17 (samme form som i18n-frysen)

> **Nav-frysen er løftet.** Målt 2026-07-17: `origin/redesign/navigasjon` er **0 commits foran develop** (fullt merget, siste aktivitet 15. juli = en docs-commit). Det som gjenstår av redesignet er **steg viii** (kunderunde mot prod-kopi) og **pilot** (flagg → `company_admin`) — ingen av dem redigerer disse filene.
>
> **Sonen var de facto død før den ble løftet:** develop har **9 commits inn i den siden 2026-07-09** — `oppsett/` ×5, `firma/` ×2, `Toppbar.tsx` ×1, `(tabs)/` ×1. Null kollisjoner, fordi økta sonen beskyttet mot ikke lenger redigerer kode. Frysen ble glemt i samme omgang som i18n-frysen ble løftet (regel 3/9) — samme begrunnelse gjaldt begge.
>
> **Reaktiveres kun hvis en ny langlevd branch igjen redigerer nav-strukturen parallelt** — da føres sonen inn her på nytt, med eier navngitt og en tavle-rad.

**Sonen som var frossen (historikk):** `Toppbar.tsx` · `HovedSidebar.tsx` · `SekundaertPanel.tsx` · `dashbord/oppsett/**` · `dashbord/firma/**` · `apps/mobile/app/(tabs)/**`

<details><summary>Original tekst (redesign-perioden)</summary>

- `apps/web/src/components/layout/Toppbar.tsx`
- `apps/web/src/components/layout/HovedSidebar.tsx`
- `apps/web/src/components/layout/SekundaertPanel.tsx`
- `apps/web/src/app/dashbord/oppsett/**`
- `apps/web/src/app/dashbord/firma/**`
- `apps/mobile/app/(tabs)/**`
- ~~i18n-filene (`packages/shared/src/i18n/*.json`) — `generate.ts` kjøres KUN på redesign-branchen mens redesignet pågår.~~ **Frysen løftet 2026-07-09** (redesign fullt merget) — i18n er ikke lenger frossen sone; `generate.ts` kjøres på develop (jf. regel 3/9).

Trenger en annen økt en endring i frossen sone: koordinér via Kenneth + denne fila FØR redigering (jf. regel 3–4).

</details>

## Lærdommer (2026-07-05, 2026-07-07, 2026-07-08) — hvorfor reglene finnes

- **(a) Foreldreløs `index.lock`.** En `.git/index.lock` ble stående etter en avbrutt prosess og blokkerte git i et worktree. Rett håndtering: sjekk kjørende git-prosess + låsens alder + størrelse (0 byte = ingen aktiv skriver) FØR fjerning — ikke blind-slett, en aktiv prosess kan eie den. → regel 6.
- **(b) Ukommittert arbeid blokkerte checkout på tvers.** Ukommittert i18n-arbeid i én økt blokkerte `git checkout` av samme branch i en annen økt (worktrees deler branch-tilstand). → dette er selve grunnen til worktree-oppdelingen + regel 1/5: hver økt har eget tre, og du committer/stasher før du forlater det.
- **(c) `git add` på konflikt-fil committet markørene.** Under merge `develop → redesign/navigasjon` konfliktet `STATUS.md` (begge grener la til «Sist oppdatert»-entry + bumpet fil-tellingen). `git add` + commit ble kjørt UTEN å redigere bort markørene → markørene havnet i merge-commiten (`fd9bbfc0`). Rettet med redigering (behold begge entries + reconciliér 55+55→**56**) + `git commit --amend`. → regel 8. Semantisk merk: to «55»-tellinger fra hver sin nye fil er egentlig 56 samlet — konflikt-resolusjon krever forståelse, ikke blind «behold begge».
- **(d) Worktree-forveksling — develop-docs committet på redesign-branchen (2026-07-07).** Rydde-runden (S3-tech-stack + `glemtDag`/`sok.placeholder`-docs, ment for `develop`) ble committet i `…/SiteDoc`-treet på `redesign/navigasjon` (`e31b2043`) i stedet for i `…/SiteDoc-develop` på `develop` — fordi et bart `git commit` traff primær-cwd (redesign-treet). Fanget da branch-/delta-sjekken viste commiten på feil branch. Rettet ved å rebase commiten på `origin/develop` (landet som ren develop-commit via FF) + rydde redesign-treet tilbake (`git reset --mixed` / `stash` for å ta branch-pekeren + indeksen av den fremmede commiten). → skjerpet regel 1: develop-spor bruker ALLTID eksplisitt `git -C ~/Documents/Programmering/SiteDoc-develop …` + branch-verifisering FØR commit.
- **(e) Redesign→develop-merger i delt develop-tre dro u-gatede commits ut (2026-07-07).** Tre `redesign→develop`-merger ble utført i `…/SiteDoc-develop` mens develop-Opus hadde u-gatede onboarding-commits liggende der (`97a2912f` TASK 2, `34ae939f` TASK 3) → merge-commitene (`c1af1ea6`/`8431c827` m.fl.) pushet dem til `origin/develop` FØR re-gate. Én av dem (`97a2912f`) bar et Suspense-`useSearchParams`-bygg-brudd ut på develop (fanget av build-gaten + fikset i `1730263b`). I tillegg endte en `--amend` mot en fremmed merge-commit i en kortvarig divergerende omskriving (ryddet via `reset --soft origin/develop` + ren fix-commit). → to guardrails: merger utføres KUN i et dedikert merge-tre (`…/SiteDoc-merge`) hard-resatt til `origin/develop` (regel 1), og hver push aborteres ved fremmed commit i deltaet (regel 13).

## Kjente kollisjoner (aktive)

- **PSI Fase A ↔ redesign/navigasjon:** se regel 4. PSI la `/mannskap` + minimal nav-entry på develop (`6882aa02`); redesignet re-homer nav-entryen. Status: PSI-siden levert, nav-eierskap hos redesign.
- **🔀 TRE PARALLELLE ØKTER (fabel-vedtak 2026-07-20) — fil-disjunkte:**
  - **Spor 2** (`refactor/tilgang-ren-funksjon`, tre: `SiteDoc-develop`): `apps/api/src/trpc/tilgangskontroll.ts` + `packages/shared/src/utils/`. Gate godkjent, startet.
  - **A-3b Fase A** (ingen branch, ingen tre): perspektiv-tabellen er **ikke-kode** — leses fra hovedtreet, leveres som tekst til fabels designgate. Fase B (koding) starter først etter spor 2-merge, fordi begge rører `packages/shared`.
  - **TegningsCapture-bug** (`fix/tegningscapture-hooks`, eget tre): kun `apps/mobile/src/components/TegningsCapture.tsx`. Pilot-kritisk, krever simulator.
  - **Kollisjonspunkt å vokte:** spor 2 og A-3b Fase B rører begge `packages/shared` → **må ikke kjøre samtidig**. Derfor er A-3b delt i to faser.
- **🔀 SPOR 1 ↔ SPOR 2 (historikk — spor 1 fullført 2026-07-20, PR #1 + #2 merget):**
  - **Spor 1 — CI trinn 1** (`chore/ci-trinn1`): rører **kun** `.github/workflows/` + evt. `test`-script. Ordre: [delplaner/spor1-ci-ordre.md](delplaner/spor1-ci-ordre.md). **Merges FØRST**, så spor 2 får CI fra første PR.
  - **Spor 2 — matrise-test → ekstraksjon** (`refactor/tilgang-ren-funksjon`): rører `apps/api/src/trpc/tilgangskontroll.ts` + `packages/shared/src/utils/`. Ordre: [delplaner/spor2-matrise-ekstraksjon-ordre.md](delplaner/spor2-matrise-ekstraksjon-ordre.md). **Venter fabel-gate før start.**
  - **⚠️ Fil-disjunkte, men IKKE worktree-disjunkte.** `SiteDoc-develop` tar én Opus om gangen (se worktree-tabellen). To parallelle kode-Opuser krever **to trær** — spor 2 blir i `SiteDoc-develop`, spor 1 trenger et eget (`SiteDoc-ci`). Uten det kolliderer de på arbeidstreet uansett hvor disjunkte filene er.
  - **Merge-rekkefølge (cowork eier):** sak 1 → spor 1 (CI) → spor 2 (matrise+ekstraksjon) → sak 2. Sak 2 rører samme fil som spor 2 og må vente på den.
- **⚠️ SCHEMA-VARSEL (redesign → develop, Plan 2 bruker-lagret nyNavigasjon-flagg, 2026-07-07):** redesign-branchen bærer en **additiv schema-endring** på vei gjennom develop: `User.nyNavigasjon Boolean?` (`packages/db`, migrering `20260707120000_user_ny_navigasjon`). **Rent additiv, én nullable kolonne, ingen backfill** — bryter unntaksvis «ingen schema på redesign-branch» (Kenneth-godkjent, vilkår a/b/c). Migrerings-gaten sjekker `$DATABASE_URL` som alltid. Andre økter som rører `packages/db`/`User` eller kjører migreringer bør vite at denne kolonnen kommer. Merge-rekkefølge koordineres via Kenneth.
