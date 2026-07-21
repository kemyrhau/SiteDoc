---
name: deploy-separasjon
status: 🟡 FREMTIDIG ENDRING — reist 2026-07-20 etter prod-deploy-runde. Ikke startet
eier: fabel (prioritering) · Kenneth (infrastruktur-beslutning) · cowork (måling gjort)
sist_verifisert_mot_kode: 2026-07-20
---

# Deploy-separasjon — prod og test deler byggekontekst, beskyttet kun av disiplin

> Reist under prod-deployen 2026-07-20. Alle enkeltproblemene er dokumentert hver for seg; denne saken samler dem, fordi de har **samme rot**: test og prod er ikke strukturelt adskilt, bare adskilt av regler mennesker må huske.

## Problemet

**`deploy.sh` (prod) og `deploy-test.sh` (test) rsyncer til samme katalog:** `server-ny:~/stack/sitedoc`. Begge compose-filene bygger fra den. Konteksten holder koden fra **siste rsync** — så etter en test-deploy ligger develop-kode der prod ville bygget fra.

Beskyttelsen er i dag en **disiplinregel** ([DOCKER-NOTES § Deploy-mekanikk](../../docker/DOCKER-NOTES.md), lærdom 2026-07-04): «re-rsync alltid riktig branch før build — `main` for prod, `develop` for test», med markør-grep som bekreftelse.

**Regelen er god, men den er det eneste som står mellom oss og at develop bygges inn i prod.** Den ble omgått 2026-07-20: cowork resonnerte at «serveren har allerede riktig kode» etter test-deployen og hoppet over prod-rsyncen. Det var ufarlig **kun fordi** `main` og `develop` var identiske etter mergen. Resonnementet var feil uansett utfall.

## Tre relaterte svakheter (samme rot)

1. **Delt byggekontekst** — `~/stack/sitedoc` brukes av begge. En glemt rsync bygger feil branch.
2. **`deploy.sh` mangler branch-guard.** `deploy-test.sh` har en (`if [ "$BRANCH" != "develop" ]` → avbryt). Prod-scriptet har ingen — og rsyncer **hardkodet fra `~/Documents/Programmering/SiteDoc`**, som i et worktree-oppsett kan stå på hvilken som helst branch. 2026-07-20 sto det treet på `feat/a3b-perspektiv`.
3. **Compose-prosjektnavn spredt over tre prosjekter** — `sitedoc-api`/`sitedoc-web` → `sitedoc`, `embed`/`oversettelse` → `docker`, `postgres` → `postgres`. Ingen enkelt `-p` adopterer alle; hver deploy krever å huske hvilken kombinasjon som gjelder. Allerede i [BACKLOG](../BACKLOG.md) som «Compose-prosjektnavn-reconcile».

## Foreslått fiks

1. **Egne kataloger:** `~/stack/sitedoc` (prod) og `~/stack/sitedoc-test` (test). Hver rsync-kilde skriver kun til sin egen. Da er «feil branch bygget inn i prod» **strukturelt umulig**, ikke bare regelstridig. Kostnad: ~2× diskplass for kildetreet (ikke images).
2. **Branch-guard i `deploy.sh`** — speil `deploy-test.sh`: avbryt hvis treet ikke står på `main`. Og les kilden fra `git rev-parse --show-toplevel` i stedet for hardkodet sti, så worktrees virker.
3. **Compose-prosjektnavn-reconcile** — ett navn permanent. Kan tas i samme runde siden containerne uansett gjenskapes.

## Hvorfor det haster moderat

Ingen produksjonsfeil har oppstått av dette ennå. Men nesten-hendelsen 2026-07-20 kom fra en økt som **hadde lest dokumentasjonen** og likevel resonnerte seg forbi regelen. Regler som krever at hver deltaker husker dem, feiler til slutt — særlig når deploys skjer sjelden og under tidspress.

**Beslutningen er Kenneths:** dette er infrastruktur, ikke funksjonalitet, og det konkurrerer med produktarbeid. Men kostnaden er lav (to script-endringer + én katalog) og gevinsten er at en hel klasse feil forsvinner.
