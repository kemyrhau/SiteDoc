---
name: f1-f5-arbeidstre-manifest
description: Klassifisering av 49 skitne filer i redesign/navigasjon-arbeidstreet i fire bøtter (F1–F5+F2-batch / K13-rester / pause-etter-timer / skrot) + blandingsfiler + sesjons-docs. Coworks arbeidsgrunnlag for isolering + re-base. Fabel-godkjent 2026-07-12.
status: 🟢 GODKJENT (fabels gate 2026-07-12) — coworks arbeidsgrunnlag for isolering/re-base. Status bor i fabels verifiseringslogg.
sist_verifisert_mot_kode: 2026-07-12
branch: redesign/navigasjon
eier: cowork (utfører isolering + re-base); redesign-Opus (klassifisering); fabel (gate)
---

# F1–F5+F2-arbeidstre-manifest

Rekonstruksjon av `redesign/navigasjon`-arbeidstreet (49 skitne filer, verifisert
2026-07-12) klassifisert i fire bøtter med per-fil-begrunnelse. Rå klassifisering —
git-operasjonene (isolering, hunk-split, re-base mot develop) eies av cowork.

## Utgangspunkt (git-fakta 2026-07-12)

- `HEAD` = `90dfb8a4` (redesign/navigasjon). F1–F5+F2 er **committet** her.
- `ffc703df` (K13 — full sidedekning i globalt søk) ligger på **develop**, IKKE i
  redesign-historikken. K13-arbeidet finnes derfor som **ucommittert** i redesign-treet.
- Arbeidstre-deltaet (`git diff HEAD`) = K13-rester + pause-etter-timer + docs + skrot.

## ⚠️ Hovedkorreksjon — bøtte (a) er TOM i arbeidstreet

F1–F5+F2-batchen («34 filer» cowork refererte til som staget) er **allerede committet**:

| Commit | Innhold |
|--------|---------|
| `17ba8bb0` feat | F1–F5+F2 (34 filer): F1 mapper-inngang (`[pid]/mapper/page.tsx`, `useKanManageField.ts`) · F3 søk-hub (`useSokRegistry.ts`-base) · F4 prosjektbytte (`prosjekt-kontekst.tsx`) · F5 moduler-hub (`innstillinger-kort.tsx`-base) · **F2 mobil dokumentflyt** (`apps/mobile/app/dokumentflyt.tsx` +388, `mer.tsx`, `kontakter.tsx`, `MiniToast.tsx`, `apnLenke.ts`, `skjermbilder-f2/`, i18n) |
| `5ace3e3f` fix | F1 «Administrer mapper»-inngang i Mapper tomt-state (`mapper/page.tsx`) |
| `90dfb8a4` docs | F1/F3/F4/F5 web-skjermbilder (port b) |

Coworks «34 filer staget» var ett steg stale (staget → committet). Merge-gaten gjelder
**disse commitene**, ikke en skitten arbeidstre-batch.

---

## (b) K13-rester — supersedert av `ffc703df` på develop

**Fabel-avgjørelse:** forkastes mot develop ved reconciliation (kommer via merge fra
develop). **Unntak:** statuslinje-rettelsen i `k13-sokdekning-rapport.md` skal **overleve**
i en docs-commit.

| Fil | Bevis for supersede | Merknad |
|-----|--------------------|---------|
| `apps/web/src/hooks/useSokRegistry.ts` | **byte-identisk** m/ ffc703df (0 diff) | ⚠️ F3/K13-overlapp |
| `apps/web/src/lib/innstillinger-kort.tsx` | 17 l fra ffc703df; ucommittert hunk = ren K13 | ⚠️ F5/K13-overlapp |
| `apps/web/src/components/layout/dype-sider.tsx` (untracked) | 0 diff mot ffc703df | ny K13-kilde |
| `apps/web/src/lib/hub-ruter.ts` (untracked) | 2 l (≈identisk) | ny K13-kilde |
| `apps/web/vitest.config.ts` (untracked) | 0 diff | K13-testoppsett |
| `apps/web/src/hooks/__tests__/sok-dekning.test.ts` (untracked) | 0 diff | K13 dekningstest |
| `apps/web/package.json` | 0 diff mot ffc703df | vitest/@vitejs-deps |
| `pnpm-lock.yaml` | følger vitest-deps | låsefil |
| `docs/claude/redesign-paritetssjekkliste.md` | ucommittert delta = «Seksjon SØK (K13)» | K13-doc |
| `docs/claude/BACKLOG.md` | K13 i18n-QA + `dokumentleser`-ryddesjekk (K13-d) | K13-doc |
| `docs/claude/k13-sokdekning-rapport.md` (untracked) | 14 diff = statuslinje-rettelse oppå K13-doc | **UNNTAK — overlever i docs-commit** |
| `docs/claude/skjermbilder-k13/` (untracked) | K13-bevis | K13-skjermbilder |

## (c) pause-etter-timer — Kenneths separate innsats → RØRES IKKE

| Fil | Innhold |
|-----|---------|
| `packages/db/prisma/schema.prisma` | `standardPauseEtterTimer Float @default(4.0)` + deprecation `standardPauseFra` (to-stegs) |
| `packages/db/prisma/migrations/20260708120000_organization_setting_pause_etter_timer/` (untracked) | migreringen |
| `apps/api/src/routes/organisasjon.ts` | Zod + select for `standardPauseEtterTimer` |
| `apps/web/src/app/dashbord/firma/innstillinger/page.tsx` | pauseEtter-UI |
| `apps/web/src/components/attestering/RedigerRadModal.tsx` | pause i radredigering |
| `apps/mobile/src/components/timer-detalj/TimerSeksjon.tsx` | pauseberegning-UI (120 l) |
| `apps/mobile/src/utils/pauseBeregning.ts` (untracked) | beregningsutil |
| `apps/mobile/src/db/migreringer.ts`, `db/schema.ts`, `services/organizationSettingKatalog.ts` | mobil-felt |

## (d) Skrot — rot-nivå, feilplassert

**Fabel-avgjørelse:** zip/PNG/JSON slettes; de tre rot-`.md`-ene sjekkes for hjemløshet
og flyttes ev. til `docs/claude/`.

| Fil | Handling |
|-----|----------|
| `Sitedoc redesign tips.zip` | slett/gitignore |
| `D5-maskin-rad.png`, `D8-mine-timer.png` | slett/gitignore (løs-PNG i rot) |
| `hentMedId-480bf202.json` | slett (debug-dump) |
| `COWORK-KONTROLL-VEILEDER.md` | sjekk hjemløshet → ev. flytt til `docs/claude/` |
| `a-markussen-verifiseringsrapport-2026-07-10.md` | sjekk hjemløshet → ev. flytt |
| `plan-testflight-38.md` | sjekk hjemløshet → ev. flytt |

## ⚠️ Blandingsfiler — MÅ hunk-splittes (cowork eier)

**15 i18n-filer** (`nb`,`en` + 13 auto): hvert ucommittert delta = **K13-nøkler**
(`innstillinger.lenke.timerOnboarding`/`maskinImport`/`eierFirma` → bøtte b, supersedert)
**+ pause-nøkler** (`firma.innstillinger.standardArbeidstid.pauseEtter`/`pauseEtterHjelp`
→ bøtte c, Kenneth). Wholesale-discard mister pause-nøklene; wholesale-commit duplikerer
K13. **Del per hunk:** behold pause-nøkler, forkast K13-nøkler (kommer fra develop).

## (e) Sesjons-/infra-docs — behold, inn i valgfri docs-commit

**Fabel-avgjørelse:** behold; `skjermbilder-timer-nynav/` beholdes som underlag, men
**T1–T3 er fortsatt parkert** (frossen sone, F4-reconciliation).

- `docs/claude/mcp-playwright-simulator-oppsett.md` · `docs/claude/mobil.md` ·
  `docs/claude/simulator-opus-oppkobling.md` (verktøy/infra-docs)
- `docs/claude/skjermbilder-f1-f5/` (F1–F5-verifisering, økt 2026-07-12)
- `docs/claude/skjermbilder-timer-nynav/` (T1–T3-timerundersøkelse — underlag, parkert)

---

## 🚩 F3/K13-overlapp i søkeregisteret (flagget)

`useSokRegistry.ts` + `innstillinger-kort.tsx` bærer **committet F3/F5-base** (i `17ba8bb0`)
OG **ucommittert K13-lag** oppå. De ucommitterte hunkene er rent K13:
- `useSokRegistry.ts`: `useDypeSider`-import + `dypeSider`-loop
- `innstillinger-kort.tsx`: `HUB_LENKER`-import + href-refaktor + 3 hub-underlenker
  (timerOnboarding/maskinImport/eierFirma) + `harFirmaTilgang`-gating (pålegg 1)

Arbeidstre-`useSokRegistry.ts` er **byte-identisk med ffc703df**; `innstillinger-kort.tsx`
innen 17 linjer.

**Reconciliation-vei for cowork:** develop har allerede K13 (`ffc703df`). Ved rebase/merge
redesign→develop kommer disse to filenes K13-innhold fra develop. De ucommitterte K13-hunkene
i redesign-treet er redundante → **ikke commit på branchen** (dupliserer/konflikter mot
ffc703df). Base på develop, så `git checkout` disse to filene + de rene K13-untracked-filene
(matcher develop). i18n-filene er unntaket: hunk-split (behold pause, forkast K13-nøkler).
