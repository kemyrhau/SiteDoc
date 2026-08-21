---
name: kontekstvelger-1a-verifiseringslogg
status: 🟢 DESIGNGATE ÅPEN — klikktall målt på test 2026-08-21 (Chrome); D7 Kenneth-bekreftet; popover-ankerfeil funnet + fikset (branch fix/kontekstchip-popover-anker). Venter fabel design-call + skjermbilder (verktøy blokkert — se § Skjermbilder)
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
| Bytte byggeplass innen prosjekt | **2** | chip **(1)** → `åpne()` lander rett på byggeplass-nivå (B1, prosjekt alt avklart) → byggeplassrad **(2)** | **2** — åpnet på byggeplass-nivå (5 rader + «Hele prosjektet»), byggeplassrad byttet + lukket | ✅ |
| Bytte prosjekt + byggeplass | **3** (var 5) | chip **(1)** → «Endre» prosjekt **(2)** → prosjektrad **(3)**; B2 blir i popoveren + A1 autovelger byggeplass. **+1 (=4) hvis en _annen_ byggeplass enn den autovalgte velges** | **3** m/ autovalgt byggeplass (B2 holdt popoveren + avanserte til byggeplass-nivå, A1 satte byggeplass); **4** for spesifikk byggeplass | ✅ (spenningsfunn under) |
| Lang liste >6 | **2 + tasting** (var 3 + klikk i felt) | chip **(1)** → søk autofokusert (B4), tast → filtrert rad **(2)** | **Ikke eksponert** — testorg (SITEDOC MYRHAUG) har 2 prosjekter + ≤6 byggeplasser overalt → >6-søk vises aldri. B4-autofokus verifisert i bygg, ikke på flate her | ⚠️ |

Baseline (før): se [k3-verifiseringslogg § Klikktelling](k3-verifiseringslogg.md).

## Måleresultater (Chrome, test.sitedoc.no, 2026-08-21, innlogget Kenneth Myrhaug, `nyNavigasjon=1`)

Målt JS-drevet mot den bygde flaten (skjermbilde-/find-injeksjon blokkert — se § Skjermbilder).
Klikktallet = antall reelle onClick-handler-invokasjoner mot de rendrede komponentene;
DOM-tilstand inspisert etter hvert klikk.

- **B1 ✅** — 1 klikk på chip åpnet popoveren rett på **byggeplass-nivå** (5 byggeplassrader + «Hele prosjektet» + «Alle på …»; firma/prosjekt kollapset til «Endre»). Prosjektet var avklart.
- **Scenario 1 ✅ = 2 klikk** — klikk 2 (byggeplassrad «Ålesund test») → `aktivByggeplass` byttet, chip viste «· Ålesund test», popover lukket.
- **B2 ✅ + Scenario 2 = 3 klikk** — klikk 1 (åpne) → klikk 2 («Endre» prosjekt → prosjekt-nivå) → klikk 3 (prosjektrad «Sitedoc Boligfelt B12»): **popoveren forble åpen og avanserte til byggeplass-nivå** («VELG BYGGEPLASS · 4 ÅPNE …»), URL byttet prosjekt. **A1 ✅** satte byggeplass automatisk (persistert «sommerfeldtsgt 65» respektert). Spesifikk annen byggeplass = klikk 4.
- **A1 ✅ (datakvalitet)** — chip viste byggeplass-suffiks uten at trakten var åpnet (autovalg fra kilden); per-prosjekt persistering i `sitedoc-aktiv-bygning`.
- **B3 stjerner ✅** — stjerne-knapp på hver prosjektrad (aria-label «Legg til/Fjern favoritt»). Toggle verifisert: `["f6dcb81f"]` → `["f6dcb81f","2bd15f09"]` (append), URL uendret + popover åpen (stopPropagation). Persistert per bruker `sitedoc_favoritter_<userId>`.
- **B3 «Favoritter»-seksjon + B4 autofokus ⚠️ ikke eksponert** — testorg har 2 prosjekter (≤6) og ≤6 byggeplasser per prosjekt → seksjonering + søk (>6) vises aldri på denne flaten. Koden er verifisert i bygg; trenger org/seed med >6 for flate-bevis.
- **E ✅ (indirekte)** — D7-kontekstlinja + chip fungerer; `/dashbord/maskin`-konsistens ikke re-målt denne runden (Kenneth bekreftet velgeren virker). Anbefalt eksplisitt sjekk ved fabel-gaten.
- **D7 ✅** — kontekstlinje-knappen «Vis hele prosjektet» rendret i sjekkliste­oversikten; **Kenneth bekreftet filteret virker** → fabels siste premiss lukket.

### 🟢 Bifunn 1 — `useFavoritter` mount-race (delt hook) — FUNNET + FIKSET (`19ad87b5`)
`useFavoritter` (`apps/web/src/hooks/useFavoritter.ts:25`) init-er `useState<string[]>([])` og laster
localStorage i en `useEffect` (linje 29). Chip-en remonteres per prosjekt (prosjekt-scopet layout),
så en favoritt-toggle i vinduet mellom mount (favoritter=[]) og load-effekten **overskriver hele den
persisterte lista**. Observert én gang rett etter et B2-prosjektbytte: `["2bd15f09"]` → `["f6dcb81f"]`
(2bd15f09 forsvant). Ikke reprodusert i satt tilstand (append virker da). Lav sannsynlighet i menneskelig
tempo, men = «fiks forsvinner stille»-mønsteret Kenneth jakter. **Fikset (cowork-anvist, `19ad87b5`):**
lazy-init løser det IKKE (effekten returnerer tidlig når `userId`/`nokkel` ennå er undefined) — i stedet
leser `toggleFavoritt` nå gjeldende liste fra localStorage FØR mutasjon, så storage er sannhetskilden ved
skriving og en tidlig toggle kan aldri nulle lista. Load-effekten beholdt for lese-synk. Test dekker racen
(`src/hooks/__tests__/useFavoritter.test.ts`, 5/5): tom state + storage m/ innhold → innholdet overlever.

### 🟡 Bifunn 2 — popover-anker (C6-bivirkning) — FUNNET + FIKSET
`KontekstChip.tsx` popover lå `absolute left-0` mot chip-containeren, som etter C6 flyter til ~460px.
Målt på test: popover-left **197** vs PROSJEKT-knapp-left **480** (283px for langt til venstre).
Fabel-fiks levert på branch `fix/kontekstchip-popover-anker` (`c13a8e87`): `relative` flyttet til
knappe-wrapperen, popover `right-0` + `top-[calc(100%+6px)]`. «Etter»-posisjon verifiseres ved
neste test-redeploy (forventet popover-right = knapp-right ≈ 607).

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

## Skjermbilder

> ⚠️ **Automatisk skjermbilde ikke mulig på denne appen (2026-08-21):** `computer screenshot`,
> `find` og `read_page` bruker script-injeksjon som venter på `document_idle` — SiteDoc-siden når
> aldri idle (vedvarende RAF/websocket), så alle tre timer ut. `javascript_tool` (uten idle-vent)
> virket, og all atferd over er verifisert JS-drevet mot de rendrede komponentene. **Visuelle
> skjermbilder for gaten tas manuelt av Kenneth/fabel** (eller på nytt hvis idle-problemet løses).
> `[x]` = atferd JS-verifisert; visuell bekreftelse for de rent kosmetiske (C5/C6) gjenstår.

Logget inn på test, `nyNavigasjon` på (funksjonaliteten er flagg-nøytral, men
KontekstChip vises i ny nav):

- [ ] **C6 flytende bredde** — chip vokser med navnelengden (~460px maks), knappene følger; ikke lenger fast 240px. (Målt: chip-container-bredde 410px, navn flyter — men se popover-ankerfeil, fikset på egen branch; visuell bekreftelse etter redeploy.)
- [ ] **C5 snudd trunkering** — langt byggeplassnavn spiser IKKE prosjektnavnet lenger; prosjektnavn prioritert (maks ~280px), byggeplass-suffiks dempet + trunkerer. `title` = full tekst. (Rent kosmetisk — visuell bekreftelse gjenstår.)
- [x] **B3 favoritter** — stjerne per prosjektrad JS-verifisert (aria-label + toggle append/remove + persistering + stopPropagation). «Favoritter»-seksjon (>6) ikke eksponert i testorg (2 prosjekter).
- [ ] **B4 autofokus** — ikke eksponert (ingen liste >6 i testorg); kode verifisert i bygg. Trenger org/seed med >6.
- [x] **B2 ikke-lukk** — JS-verifisert: prosjektvalg holdt popoveren åpen + avanserte til byggeplass-steget, A1-autovalgt byggeplass markert.
- [x] **B1** — JS-verifisert: chip åpnet på byggeplass-nivå (prosjekt avklart + har byggeplasser).
- [x] **A1 datakvalitet** — JS-verifisert: chip viste byggeplass uten at trakten var åpnet; per-prosjekt persistering + guard.
- [ ] **E** — `/dashbord/maskin` FIRMA-konsistens ikke re-målt denne runden; Kenneth bekreftet velgeren virker. Anbefalt eksplisitt sjekk ved gaten.
- [x] **D7** — kontekstlinje-knapp «Vis hele prosjektet» rendret; **Kenneth bekreftet filteret virker** → premiss lukket.

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
- [ ] Designgate: **visuelle** skjermbilder (verktøy blokkert — Kenneth/fabel tar manuelt) + fabel-godkjenning. Klikktall + atferd er målt (over).
- [x] Kenneth-bekreftelse D7 (bekreftet 2026-08-21)
- [ ] Merge `fix/kontekstchip-popover-anker` (`c13a8e87`) → redeploy → «etter»-posisjon for popover + visuell C5/C6-bekreftelse
- [x] Bifunn 1: `useFavoritter` mount-race — fikset (`19ad87b5`, les-storage-før-mutasjon + test)
- [ ] B4 autofokus + B3 Favoritter-seksjon: flate-bevis krever org/seed med >6 prosjekter/byggeplasser
- [ ] Backlog-rad om klientside-filterets skaleringsforbehold (eier: cowork, via exit-gate)
- [ ] Gitignore-hullet i `docs/claude/delplaner/verifisering/`: cowork-målt 2026-08-21 — regelen (.gitignore:69) finnes for 21 MB bevis-bilder; md-loggene er bifangst, 46 filer allerede i git, ingenting tapt på disk (kun tilfeldig sporing). Vedtatt fiks: ignorer filtype (`**/*.png`, `**/*.jpg`) i stedet for mappen — logger spores automatisk, bilder holdes ute. Eier: cowork.
