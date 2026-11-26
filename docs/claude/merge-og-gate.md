# Merge og gate — regel 9/10, merge-kjeden, rydding

> Utskilt ordrett fra [SAMARBEIDSREGLER.md](SAMARBEIDSREGLER.md) § 6 (2026-11-26). Hvem som gater hva og
> klarsignalene står i kjernen: [SAMARBEIDSREGLER § 6 Hvem gater hva](SAMARBEIDSREGLER.md). Kollisjonssjekk og
> kjøreregler: [ordre-og-agent.md](ordre-og-agent.md) § 6b.

## § 6 — Gate og merge (fortsettelse)

### Regel 9 og regel 10

- **Regel 9:** merge til `develop` alltid `--no-ff`.
- **Regel 10 — ingen merge uten grønt på alle ledd, kjørt i merge-treet etter mergen:**
  1. **Forsteg:** `pnpm install` + `prisma generate` for `db`, `db-timer`, `db-maskin`, `db-varelager`. Uten det gir
     `Module not found` (node_modules bak lockfila) og `does not exist in type '<Modell>Select'` (klient bak schema)
     falske røde.
  2. `npx turbo run typecheck --force` fra rot — **«N successful, N total» med like tall.** Lavt N betyr at turbo
     stoppet på første røde pakke.
  3. `pnpm --filter @sitedoc/web exec tsc --noEmit` **eksplisitt** — `next build` typesjekker ikke testfiler, og
     mobilens typecheck dekker ikke web. Falske `TS2307` i `.next/types/` skilles ut (`grep -v '^\.next/'`); er alle
     feilene der, kjør byggeleddet og mål på nytt.
  4. `pnpm --filter @sitedoc/web build` — **kaldt** når web-filer er rørt
     (`rm -f apps/web/tsconfig.tsbuildinfo && rm -rf apps/web/.next`): inkrementell build kan skjule TS2589 som
     Docker-bygget avviser. `tsc` stopper på første TS2589 — kjør til grønt. Web build dekker `apps/api` transitivt
     (målt 2026-09-02); eget api-typecheck er hastighet, ikke dekning.
  5. `pnpm exec turbo run test --force` fra **rot** — «N successful, N total» like tall. «FULL TURBO» eller urimelig
     kort kjøretid = cache, ikke kjøring. **Og** `test:integration` for pakkene diffen rører, mot sandkasse-DB (i dag
     har bare `@sitedoc/api` det, `apps/api/package.json:12`). Endrer leveransen vedtatt atferd, oppdateres testene
     for den atferden i samme leveranse. Unntak: en vakttest for det Kenneth har sagt «virker» til, endres bare med
     hans ord. Rød stopper merge — også når testen er rød likt på `develop`; da listes testen og rettes eller fjernes
     med Kenneths ord før merge.
- **Rapporten bærer den ordrette siste linja fra hver kommando** og test-fordelingen
  `unit-mock: <n> · unit-ren: <n> · integrasjon: <n> · e2e: <n>`. «Rent» uten app-navn er ikke en kvittering. Krav (c) i
  «stille tomhet er forbudt» kan aldri oppfylles av en mocket test — kvitteres som «delvis — mock».
- ⚠️ **Kjent hull:** `tests/e2e` har intet `typecheck`-script (turbo teller no-op som suksess). Bestilles eget ledd hvis
  e2e-drift skal fanges.

### Gaten skal ligge i kommandoen

- 🔴 **Aldri en pipe som gate.** `cmd | grep | tail` returnerer `tail` sin kode — alltid 0. Bruk eksplisitt
  `> log 2>&1; echo "exit=$?"`, eller `set -o pipefail` først. Sammenlign tall maskinelt
  (`grep -E "Tasks:" | awk '{exit !($2==$4)}'`), ikke bare finn linja.
- **Mål at en ny gate stopper** — kjør den mot noe som feiler før du stoler på den. Et grep-treff på null er ikke bevis
  for fravær (kasus!); kompilatoren og databasen er fasit.

### Merge-kjeden (orkestrator, `SiteDoc-merge`)

`SiteDoc-merge` står detached på `origin/develop` og bærer aldri egne commits ([parallell-arbeid-lock.md](parallell-arbeid-lock.md)
§ Worktrees). Verifiser at treet finnes (`git worktree list`) før merge; gjenoppretting står i samme fil.

```sh
cd ~/Documents/Programmering/SiteDoc-merge && git fetch --prune origin && \
test "$(git rev-parse origin/<branch>)" = "<hash>" && \
! git merge-base --is-ancestor <hash> origin/develop && \
git checkout -q --detach origin/develop && \
git merge --no-ff <hash> -m "merge: <branch> -> develop (<hva>; <gate-kilde>)"
# regel 10 her — så:
git push origin HEAD:develop
```

- Linje 2 stopper hvis hashen ikke er branchens tipp; linje 3 hvis den alt er i develop (duplisert ordre stopper seg selv).
- **Push avvist** (develop flyttet seg): `reset --hard origin/develop`, merg på nytt, kjør regel 10 på nytt, push. Aldri force.
- **Uventet — konflikt, migrering/`schema.prisma` som ordren ikke nevner, rødt ledd: STOPP og meld.** En merge som
  «ble løst underveis» er en merge ingen har gatet.
- **Verifiser mot agentens hash, ikke merge-commitens:** `git merge-base --is-ancestor <agentens-hash> origin/develop`.
- **Merge nr. 2 av brancher fra samme base:** verifiser resultatet mot `origin/develop..HEAD`, ikke `develop..branch`.
  `git diff develop..branch` viser ikke hva branchen gjorde — bruk tre punktum eller diff mot `merge-base`.
- **Docs-commits** (STATUS-AKTUELT, FUNKSJONSENDRINGER, tavla) gjøres i samme tre **etter** mergen, aldri samtidig.
  STATUS-AKTUELT, tavla og FUNKSJONSENDRINGER har én skribent: orkestrator. Agenten fører egne spec-filer, BACKLOG-lukking
  og STATUS.md i sin egen commit; orkestrator sjekker at berørt STATUS/BACKLOG-linje er i commit-settet før merge, og
  leser innholdet på begge sider — en ren merge av to statusfiler kan flette motstridende påstander uten konflikt.
- **Migrering og seed kjøres aldri** i merge-kjeden — det er Kenneths, ved deploy.
- **Hovedtreet `SiteDoc`:** orkestrator kjører bare `git fetch` der, aldri `pull`/merge/commit (stale `ORIG_HEAD.lock`
  fire ganger 09.–10.09). `pull --ff-only` der er Kenneths steg i [DEPLOY-RUNBOK § 1](DEPLOY-RUNBOK.md). Stale
  `.lock`: diagnostiser (prosess? alder?) og meld før den fjernes.
- **Status-påstander har kilde:** «pushet», «deployet», «klar for X» bærer hash eller dato. Berører diffen et område med en ❌-markør, re-verifiseres markøren i samme commit-sett ([dokumentasjons-standard.md § 11b](dokumentasjons-standard.md)).

### Rydding etter merge (Opus-livssyklus fase 4)

```sh
git -C ~/Documents/Programmering/SiteDoc-merge worktree remove <agentens tre>   # nekter ved endringer — da: meld
git -C ~/Documents/Programmering/SiteDoc-merge branch -d <branch>     # -d, aldri -D
git -C ~/Documents/Programmering/SiteDoc-merge push origin --delete <branch>
```

- 🔴 **Treet fjernes når leveransen er merget og agenten ikke har mer i det** (Kenneth-vedtak 2026-11-11; før ble trær
  bare satt detached og hopet seg opp — 34 trær 11.11). Faste rolletrær står: `SiteDoc-merge`, `SiteDoc-gate`,
  `SiteDoc-fabel`. Neste ordre får et nytt tre fra `origin/develop`, ikke et gjenbrukt.
- **App-trær** (`SiteDoc/.claude/worktrees/<navn>-xxxxxx`): arkiver økten først (Kenneth godkjenner) — arkivering
  fjerner IKKE treet (målt 11.11), så kjør `worktree remove` etterpå.
- `worktree remove` kan melde «Directory not empty» når Finder har mappa åpen: git har da meldt ut treet. Slett resten
  først når `.git`-fila i mappa peker til en gitdir som ikke finnes.
- **Plass måles med `df` før/etter, ikke `du` per tre** — pnpm hardlenker `node_modules`, så `du` teller samme fil i
  hvert tre (20 trær «60 GB» frigjorde 9 GB, 11.11).
- 🔴 **Mål `git worktree list` og tavla før rydding; rydd aldri et tre en agent står i** (`lsof -d cwd`), og slett aldri `SiteDoc-merge`.
- Før du berger noe som ser tapt ut: `git log -S` og `merge-base --is-ancestor` — en «tapt» leveranse er oftest merget
  under et annet navn.
- **Inventar ved hver lukking:** `git -C ~/Documents/Programmering/SiteDoc worktree list` + `git status --porcelain` og
  `git stash list` i hvert tre. Et tre, en fil eller en stash ingen vet om, er et funn. Et merget tre uten agent på
  tavla ryddes.
- **Hver økt som produserer en fil, får en git-vei for den i ordren** (docs-branch). En rapport som ikke committes,
  finnes ikke.
