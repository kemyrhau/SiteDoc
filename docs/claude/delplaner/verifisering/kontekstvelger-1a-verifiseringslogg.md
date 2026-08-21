---
name: kontekstvelger-1a-verifiseringslogg
status: 🟢 DESIGNGATE ÅPEN — bygget på branch feat/kontekstvelger-1a; venter test-redeploy for klikktelling + skjermbilder
eier: Kenneth (test-redeploy) · kontrollplan-Opus (bygg + Chrome-måling) · cowork (merge/reconcile) · fabel (design-call)
sist_verifisert_mot_kode: 2026-08-21
---

# Kontekstvelger v2 (retning 1a) — verifiseringslogg

Verifiserer leveransen på branch `feat/kontekstvelger-1a` mot
[ordre-kontekstvelger-1a-fabel-2026-08-21.md](../../../redesign/ordre-kontekstvelger-1a-fabel-2026-08-21.md).
Grunnlag: [kontekstvelger-regresjonsjakt-2026-08-21.md](../../kontekstvelger-regresjonsjakt-2026-08-21.md).

**Commits:** A1+E `1fbd9524` · B+C `567e05f5` · D7 `9421cb91` · doc-sync `5c8daf4c`.

> ⚠️ **Kode-trasert, IKKE målt.** Alle «forventet»-tall under er trasert gjennom
> den bygde flyten. «Målt (test)» fylles FØRST etter test-redeploy, via
> Chrome-automatisering logget inn, så tellingene er etterprøvbare. Ikke skriv
> «✅» i en klikk-rad før den er talt på flate (lærdommen fra de falske ✅ i
> k3-verifiseringsloggen).

## Klikk-budsjett (effektivitets-gate pkt 1)

| Scenario | Budsjett | Forventet sti (bygget flyt, kode-trasert) | Målt (test) | Status |
|---|---|---|---|---|
| Bytte byggeplass innen prosjekt | **2** | chip **(1)** → `åpne()` lander rett på byggeplass-nivå (B1, prosjekt alt avklart) → byggeplassrad **(2)** | TBD | ⏳ |
| Bytte prosjekt + byggeplass | **3** (var 5) | chip **(1)** → «Endre» prosjekt **(2)** → prosjektrad **(3)**; B2 blir i popoveren + A1 autovelger byggeplass. **+1 (=4) hvis en _annen_ byggeplass enn den autovalgte velges** | TBD | ⏳ |
| Lang liste >6 | **2 + tasting** (var 3 + klikk i felt) | chip **(1)** → søk autofokusert (B4), tast → filtrert rad **(2)** | TBD | ⏳ |

Baseline (før): se [k3-verifiseringslogg § Klikktelling](k3-verifiseringslogg.md).

## 🟡 Spenningsfunn (sendt fabel 2026-08-21) — B1 vs scenario 2

**Scenario 2 treffer budsjett 3 KUN hvis den A1-autovalgte byggeplassen aksepteres.**
Fordi `åpne()` lander på byggeplass-nivå (B1, rask byggeplass-bytte), må «bytte
prosjekt» gå via «Endre»-steget: chip → Endre prosjekt → prosjektrad = 3, og A1
har da alt autovalgt byggeplassen. **Vil brukeren ha en _annen_ byggeplass, blir
det 4** (+ byggeplassrad).

Reell spenning mellom **B1** (åpne på byggeplass) og **scenario 2s 3-klikk-budsjett**
(rask prosjektbytte): B1 optimaliserer scenario 1, prisen er +1 klikk for
spesifikk byggeplass i scenario 2. Den vanlige stien (aksepter autovalgt) holder
budsjettet; edge-casen er 4. **Fabel avgjør:** akseptabelt, eller skal `åpne()`
lande på prosjekt-nivå ved prosjektbytte-intensjon (men det finnes ikke noe
intensjons-signal — det ville koste scenario 1 et klikk). Måles begge veier.

## Skjermbilde-sjekkliste (fabel designgate — TBD etter test-redeploy)

Logget inn på test, `nyNavigasjon` på (funksjonaliteten er flagg-nøytral, men
KontekstChip vises i ny nav):

- [ ] **C6 flytende bredde** — chip vokser med navnelengden (~460px maks), knappene følger; ikke lenger fast 240px.
- [ ] **C5 snudd trunkering** — langt byggeplassnavn spiser IKKE prosjektnavnet lenger; prosjektnavn prioritert (maks ~280px), byggeplass-suffiks dempet + trunkerer. `title` = full tekst.
- [ ] **B3 favoritter** — stjerne per prosjektrad (eget klikkmål); «Favoritter»-seksjon øverst → «Sist brukt» → «Alle prosjekter» (lang liste >6). Stjerne toggler + persisterer (localStorage).
- [ ] **B4 autofokus** — søkefeltet er fokusert idet et nivå med synlig søk åpnes (tast umiddelbart).
- [ ] **B2 ikke-lukk** — prosjektvalg lukker ikke popoveren; avanserer til byggeplass-steget med A1-autovalgt byggeplass markert valgt.
- [ ] **B1** — chip åpner på dypeste avklarte steg (byggeplass når prosjektet har byggeplasser).
- [ ] **A1 datakvalitet** — opprett sjekkliste UTEN å åpne trakten → `byggeplassId` er satt (ikke undefined) når prosjektet har byggeplasser.
- [ ] **E** — `/dashbord/maskin` viser FIRMA-kontekst i chip OG sidebar (ikke PROSJEKT-sone) — funn 6.
- [ ] **D7 (design-gated)** — sjekklisteoversikten filtreres på aktiv byggeplass, kontekstlinje + «Hele prosjektet»-veksling. **Kenneth bekrefter premisset her.**

## Måle-plan (Chrome-automatisering, etter test-redeploy)

1. Logg inn på test.sitedoc.no, åpne et prosjekt med >6 byggeplasser og >6 prosjekter (eller seed).
2. Tell hvert scenario ved faktiske klikk (GIF-opptak per scenario for etterprøvbarhet), fyll «Målt (test)».
3. Ta skjermbildene over.
4. Marker klikk-rader ✅/⚠️ mot budsjett; oppdater `status` i frontmatter når gaten lukkes av fabel.

## Kode-referanser (bygget)

- A1: `apps/web/src/kontekst/byggeplass-kontekst.tsx` (query + autovalg-effekt + guard)
- E: `apps/web/src/lib/ruteKontekst.ts` + KontekstChip/Toppbar/NavSidebar
- B1–B4 + C5/C6: `apps/web/src/components/layout/KontekstChip.tsx` + `components/kontekst-chip/trakt-primitiver.tsx`
- D7: `apps/web/src/app/dashbord/[prosjektId]/sjekklister/page.tsx`

## Gjenstår
- [ ] Designgate: skjermbilder + task-walkthrough + klikktall → fabel-godkjenning
- [ ] Kenneth-bekreftelse D7
- [ ] Backlog-rad om klientside-filterets skaleringsforbehold (eier: cowork, via exit-gate)
- [ ] Gitignore-hullet i `docs/claude/delplaner/verifisering/`: cowork-målt 2026-08-21 — regelen (.gitignore:69) finnes for 21 MB bevis-bilder; md-loggene er bifangst, 46 filer allerede i git, ingenting tapt på disk (kun tilfeldig sporing). Vedtatt fiks: ignorer filtype (`**/*.png`, `**/*.jpg`) i stedet for mappen — logger spores automatisk, bilder holdes ute. Eier: cowork.
