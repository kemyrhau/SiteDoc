---
name: parallell-arbeid-lock
status: styrende
sist_verifisert_mot_kode: 2026-07-05
sist_endret: 2026-07-05
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

## De 7 kjørereglene (ufravikelige i parallell modus)

1. **Ett worktree per rolle — aldri kryss-skriv.** Redesign-økta eier hovedtreet (`…/SiteDoc`, `redesign/navigasjon`). Develop-docs/feature skrives i `…/SiteDoc-develop`. Skriv ALDRI develop-arbeid i det delte/redesign-treet.
2. **Verifiser branch før hver commit:** `git rev-parse --abbrev-ref HEAD` = forventet branch. Worktrees deler samme `.git` → feil tre committer på feil branch uten at det er åpenbart.
3. **Frossen sone koordineres via denne fila** (liste under). Filene redigeres ALDRI blindt fra to økter samtidig. `generate.ts` (i18n) kjøres KUN på redesign-branchen mens redesignet pågår.
4. **/mannskap-kollisjonen (PSI ↔ redesign):** PSI Fase A (`6882aa02`) la til `/dashbord/[prosjektId]/mannskap` + **enkel** nav-registrering i `HovedSidebar.tsx`. Avtale: **PSI legger til siden + minimal nav-entry; redesignet eier nav-strukturen** og re-homer entryen. To økter redigerer aldri `HovedSidebar.tsx`/rutestrukturen blindt samtidig.
5. **Commit eller stash før du forlater et tre.** Ukommittert arbeid i ett worktree blokkerer `git checkout` av samme branch i et annet — se lærdom (b). Ikke la ukommittert arbeid ligge og blokkere en annen økt.
6. **`index.lock` — foreldreløs lås: diagnostisér før fjerning.** En `.git/index.lock` fra en krasjet/avbrutt git-prosess blokkerer alle git-operasjoner. Sjekk (a) om en git-prosess faktisk kjører, (b) låsens alder, (c) størrelse (0 byte = trygt foreldreløs) FØR du fjerner. Aldri blind-slett — se lærdom (a).
7. **Dual-review-gate + kode+docs i samme commit gjelder uendret i parallell modus.** Hver økt gate-verifiserer eget arbeid mot koden før develop-commit; aldri push til `develop` uten diff + verifisering.

## Frossen sone (redesign-økta eier — ikke rør fra andre økter)

- `apps/web/src/components/layout/Toppbar.tsx`
- `apps/web/src/components/layout/HovedSidebar.tsx`
- `apps/web/src/components/layout/SekundaertPanel.tsx`
- `apps/web/src/app/dashbord/oppsett/**`
- `apps/web/src/app/dashbord/firma/**`
- `apps/mobile/app/(tabs)/**`
- i18n-filene (`packages/shared/src/i18n/*.json`) — `generate.ts` kjøres KUN på redesign-branchen mens redesignet pågår.

Trenger en annen økt en endring i frossen sone: koordinér via Kenneth + denne fila FØR redigering (jf. regel 3–4).

## Lærdommer (2026-07-05) — hvorfor reglene finnes

- **(a) Foreldreløs `index.lock`.** En `.git/index.lock` ble stående etter en avbrutt prosess og blokkerte git i et worktree. Rett håndtering: sjekk kjørende git-prosess + låsens alder + størrelse (0 byte = ingen aktiv skriver) FØR fjerning — ikke blind-slett, en aktiv prosess kan eie den. → regel 6.
- **(b) Ukommittert arbeid blokkerte checkout på tvers.** Ukommittert i18n-arbeid i én økt blokkerte `git checkout` av samme branch i en annen økt (worktrees deler branch-tilstand). → dette er selve grunnen til worktree-oppdelingen + regel 1/5: hver økt har eget tre, og du committer/stasher før du forlater det.

## Kjente kollisjoner (aktive)

- **PSI Fase A ↔ redesign/navigasjon:** se regel 4. PSI la `/mannskap` + minimal nav-entry på develop (`6882aa02`); redesignet re-homer nav-entryen. Status: PSI-siden levert, nav-eierskap hos redesign.
