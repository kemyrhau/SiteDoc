---
name: h3-videresend-rettighet-ordre
status: 🟢 BYGGEORDRE for kode-Opus — H3 videresend-rettighetslekkasje. Ren kode. 2026-07-26
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop (F0–F6 inne)
opphav: flytrettigheter-evaluering H3 (fabel-kryssjekk + cowork-verifisert). Kenneth-vedtak 2026-07-26.
---

# Byggeordre H3 — lukk videresend-rettighetslekkasjen

**Verifisert lekkasje:** `byggVideresendValg` (`apps/web/src/lib/videresend-valg.ts`) bygger mottakerlista av ALLE faggrupper i prosjektet med mal-matchende flyt — **uten filter på avsenderens medlemskap**. Kombinert med at videresend (`→forwarded`) i dag ligger i utførers og godkjenners default-sett, kan enhver utfører/godkjenner flytte dokumenter inn i flyter de ikke har noen rolle i. Kenneth-vedtak: videresend er en admin-handling (kryssflyt ut av flyten).

## Ufravikelig
- **INGEN migrering** — ren kode. **Ikke gjør § 0-refaktoren.** Ikke rør STATUS-AKTUELT/BACKLOG. Ikke merge — push feature-branch.
- Norsk bokmål, `t()`-i18n, ingen `any`.
- **Ikke rør andre handlinger** — kun videresend/`forwarded`-rettigheten og mottakerlista.

## Del 1 — default AV videresend for flyt-roller
1. **`ROLLE_HANDLINGER_DEFAULTS`** (`packages/shared/src/utils/statusHandlinger.ts`): fjern `"forwarded"` fra **utfører**s sett (`received`, `in_progress`) og **godkjenner**s sett (`responded`, og `approved` hvis den finnes der). Prosjektadmin beholder videresend **automatisk** via statusmaskin-snittet — **verifiser** at prosjektadmin fortsatt får `forwarded` på de relevante statusene etter endringen (ikke hardkod den inn i defaults; den skal komme fra admin-bypass/snittet).
2. Matrise-radene for Videresend står igjen som celler (så et firma KAN slå dem PÅ per flytrolle via override) — men default-haken er nå AV for utfører/godkjenner, PÅ for prosjektadmin.

## Del 2 — medlemskaps-filtrer mottakerlista (opt-in-sikring)
3. **`byggVideresendValg`**: når avsenderen **ikke** er prosjektadmin (eller sitedoc-admin), skal mottakerlista begrenses til **flyter avsenderen selv er medlem av**. Admin beholder full prosjektliste.
   - Avsenderens flyt-medlemskap finnes via `hentBrukersFlytMedlemskap`-kilden (eksponert i `medlem.ts` — `hentMineFlyter` e.l.). Tråd inn avsenderens flyt-ID-sett + admin-flagg til `byggVideresendValg` (eller filtrer i kalleren `DokumentHandlingsmeny`). Du velger reneste plassering; flagg til cowork hvis data-tråingen blir større enn en prop.
   - Filter: behold kun `VideresendValg` der `dokumentflytId ∈ avsenderens flyt-medlemskap`. Admin: intet filter.

## DoD
- [ ] `forwarded` fjernet fra utfører/godkjenner-defaults; prosjektadmin får den fortsatt (verifisert via snittet, ikke hardkodet). Koherens: matrise-default for Videresend = kun P-adm PÅ.
- [ ] Ikke-admin avsender ser kun egne-medlemskap-flyter i videresend-mottakerlista; admin ser full liste. Test som dekker begge.
- [ ] `pnpm --filter @sitedoc/shared` typecheck+test + web/api typecheck grønt.
- [ ] Vis diff. Push `feat/h3-videresend-rettighet`. Ikke merge. Ikke rør STATUS/BACKLOG.
