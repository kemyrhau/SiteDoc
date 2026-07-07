---
name: parallell-arbeid-lock
status: styrende
sist_verifisert_mot_kode: 2026-07-07
sist_endret: 2026-07-07
---

# Parallell-arbeid — lås og kjøreregler

> **Les denne FØR du rører delte filer.** Flere Cowork-økter (f.eks. redesign-økta + en develop-doc/feature-økt) jobber samtidig mot samme repo via **separate git-worktrees**. Denne fila er koordineringspunktet: kjøreregler + frossen sone + kjente kollisjoner. Arbeidsmåten ellers ligger i [kontroll-claude-veileder.md](kontroll-claude-veileder.md).

## Worktrees (én rolle per tre)

| Worktree | Branch | Rolle |
|----------|--------|-------|
| `…/SiteDoc` | `redesign/navigasjon` | **Redesign-økta eier dette treet.** Nav-/UX-omlegging. |
| `…/SiteDoc-develop` | `develop` | Develop-docs + feature-arbeid (ikke-redesign). |
| `…/SiteDoc-deploy` | `main` | Prod-deploy (rsync-kilde). |
| `…/sitedoc-server` | `ny-server` | Server-side arbeid. |

## De 12 kjørereglene (ufravikelige i parallell modus)

1. **Ett worktree per rolle — aldri kryss-skriv.** Redesign-økta eier hovedtreet (`…/SiteDoc`, `redesign/navigasjon`). Develop-docs/feature skrives i `…/SiteDoc-develop`. Skriv ALDRI develop-arbeid i det delte/redesign-treet. **Develop-spor bruker ALLTID eksplisitt `git -C ~/Documents/Programmering/SiteDoc-develop …`** (+ absolutte stier under samme tre) — stol ALDRI på gjeldende arbeidskatalog: primær-cwd er redesign-treet (`…/SiteDoc`), så et bart `git`-kall committer på `redesign/navigasjon` uten at det er åpenbart. Verifiser `git -C ~/Documents/Programmering/SiteDoc-develop rev-parse --abbrev-ref HEAD` = `develop` FØR du rører noe. Se lærdom (d).
2. **Verifiser branch før hver commit:** `git rev-parse --abbrev-ref HEAD` = forventet branch. Worktrees deler samme `.git` → feil tre committer på feil branch uten at det er åpenbart.
3. **Frossen sone koordineres via denne fila** (liste under). Filene redigeres ALDRI blindt fra to økter samtidig. `generate.ts` (i18n) kjøres KUN på redesign-branchen mens redesignet pågår.
4. **/mannskap-kollisjonen (PSI ↔ redesign):** PSI Fase A (`6882aa02`) la til `/dashbord/[prosjektId]/mannskap` + **enkel** nav-registrering i `HovedSidebar.tsx`. Avtale: **PSI legger til siden + minimal nav-entry; redesignet eier nav-strukturen** og re-homer entryen. To økter redigerer aldri `HovedSidebar.tsx`/rutestrukturen blindt samtidig.
5. **Commit eller stash før du forlater et tre.** Ukommittert arbeid i ett worktree blokkerer `git checkout` av samme branch i et annet — se lærdom (b). Ikke la ukommittert arbeid ligge og blokkere en annen økt.
6. **`index.lock` — foreldreløs lås: diagnostisér før fjerning.** En `.git/index.lock` fra en krasjet/avbrutt git-prosess blokkerer alle git-operasjoner. Sjekk (a) om en git-prosess faktisk kjører, (b) låsens alder, (c) størrelse (0 byte = trygt foreldreløs) FØR du fjerner. Aldri blind-slett — se lærdom (a).
7. **Dual-review-gate + kode+docs i samme commit gjelder uendret i parallell modus.** Hver økt gate-verifiserer eget arbeid mot koden før develop-commit; aldri push til `develop` uten diff + verifisering.
8. **Løs merge-konflikter ved å REDIGERE fila, ikke bare `git add`.** `git add` på en fil med konflikt-markører stager `<<<<<<<`/`=======`/`>>>>>>>` rått → de havner i commiten. Rediger fila (behold begge sider der begge er gyldige), fjern alle markører, verifiser `grep -c '^<<<<<<<\|^=======\|^>>>>>>>' <fil>` = 0, DERETTER `git add` + commit. Ved parallell-arbeid oppstår konflikter i delte indeks-/status-filer (`STATUS.md`, `DOC-MAP.md`, `CLAUDE.md`) ved merge develop↔redesign — se lærdom (c).
9. **i18n `generate.ts` kjøres KUN på redesign-branchen** mens redesignet pågår (utdyper regel 3). En annen økt som legger i18n-nøkler committer nb+en og lar redesign-økta kjøre generate — ellers kolliderer de 15 språkfilene.
10. **`redesign/navigasjon → develop` merges med `--no-ff`** + melding `merge(redesign): <steg> → develop` (fra og med neste merge, aldri fast-forward). Hver redesign-inkrement får en grense-commit → redesignet er synlig som enhet i develop-historikken OG revertbar som enhet (`git revert -m 1 <merge>`). Gjelder **kun fremover** — den allerede innflettede FF-mergen (`b13797f8`) skrives IKKE om; ingen rebase/rewrite av develop for å «fikse» historikk. Hold `(redesign)`-commit-scope strengt; utført fra `SiteDoc-develop`-treet (regel 1). Ansvar: kontroll-Claude eier regelen (develop-doc); redesign-Opus følger den ved merge.
11. **Build-gate — full lokal build FØR merge.** `pnpm --filter @sitedoc/web build` (eller berørt app: api/mobil-typecheck) skal være grønn før develop-merge. Fanger prerender-/typefeil før de treffer test (jf. `useNyNavigasjon`-Suspense-regresjonen 2026-07-05).
12. **Pre-push u-gatet-commit-sjekk.** Før push til `develop` fra et delt worktre: kjør `git log origin/develop..HEAD --oneline` og bekreft at ALLE commits i deltaet er dine egne OG gate-verifiserte. Finnes en commit fra en annen økt/agent som ikke er gate-godkjent → **IKKE push**; koordiner med Kenneth/eier-økta først. En push drar ALLE lokale commits under HEAD ut, ikke bare dine. Bakgrunn: 2026-07-06 dro redesign-Opus' merge-push (`5e16987b`) develop-Opus' u-gatede slanke-commit (`e8347671`) ut til origin fordi begge delte `SiteDoc-develop`-worktreet — utfallet var rent, men en u-verifisert commit kan shippe utilsiktet slik. Primærprinsipp uendret (regel 1: helst én økt per worktre) — dette er sikkerhetsnettet når det brytes.

## Frossen sone (redesign-økta eier — ikke rør fra andre økter)

- `apps/web/src/components/layout/Toppbar.tsx`
- `apps/web/src/components/layout/HovedSidebar.tsx`
- `apps/web/src/components/layout/SekundaertPanel.tsx`
- `apps/web/src/app/dashbord/oppsett/**`
- `apps/web/src/app/dashbord/firma/**`
- `apps/mobile/app/(tabs)/**`
- i18n-filene (`packages/shared/src/i18n/*.json`) — `generate.ts` kjøres KUN på redesign-branchen mens redesignet pågår.

Trenger en annen økt en endring i frossen sone: koordinér via Kenneth + denne fila FØR redigering (jf. regel 3–4).

## Lærdommer (2026-07-05, 2026-07-07) — hvorfor reglene finnes

- **(a) Foreldreløs `index.lock`.** En `.git/index.lock` ble stående etter en avbrutt prosess og blokkerte git i et worktree. Rett håndtering: sjekk kjørende git-prosess + låsens alder + størrelse (0 byte = ingen aktiv skriver) FØR fjerning — ikke blind-slett, en aktiv prosess kan eie den. → regel 6.
- **(b) Ukommittert arbeid blokkerte checkout på tvers.** Ukommittert i18n-arbeid i én økt blokkerte `git checkout` av samme branch i en annen økt (worktrees deler branch-tilstand). → dette er selve grunnen til worktree-oppdelingen + regel 1/5: hver økt har eget tre, og du committer/stasher før du forlater det.
- **(c) `git add` på konflikt-fil committet markørene.** Under merge `develop → redesign/navigasjon` konfliktet `STATUS.md` (begge grener la til «Sist oppdatert»-entry + bumpet fil-tellingen). `git add` + commit ble kjørt UTEN å redigere bort markørene → markørene havnet i merge-commiten (`fd9bbfc0`). Rettet med redigering (behold begge entries + reconciliér 55+55→**56**) + `git commit --amend`. → regel 8. Semantisk merk: to «55»-tellinger fra hver sin nye fil er egentlig 56 samlet — konflikt-resolusjon krever forståelse, ikke blind «behold begge».
- **(d) Worktree-forveksling — develop-docs committet på redesign-branchen (2026-07-07).** Rydde-runden (S3-tech-stack + `glemtDag`/`sok.placeholder`-docs, ment for `develop`) ble committet i `…/SiteDoc`-treet på `redesign/navigasjon` (`e31b2043`) i stedet for i `…/SiteDoc-develop` på `develop` — fordi et bart `git commit` traff primær-cwd (redesign-treet). Fanget da branch-/delta-sjekken viste commiten på feil branch. Rettet ved å rebase commiten på `origin/develop` (landet som ren develop-commit via FF) + rydde redesign-treet tilbake (`git reset --mixed` / `stash` for å ta branch-pekeren + indeksen av den fremmede commiten). → skjerpet regel 1: develop-spor bruker ALLTID eksplisitt `git -C ~/Documents/Programmering/SiteDoc-develop …` + branch-verifisering FØR commit.

## Kjente kollisjoner (aktive)

- **PSI Fase A ↔ redesign/navigasjon:** se regel 4. PSI la `/mannskap` + minimal nav-entry på develop (`6882aa02`); redesignet re-homer nav-entryen. Status: PSI-siden levert, nav-eierskap hos redesign.
