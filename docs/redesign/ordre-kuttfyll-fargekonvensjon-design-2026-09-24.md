---
status: 🟢 ORDRE — klar til utførelse
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
grunnlag: designnotat-3d-koordinatfesting-design-2026-09-23.md § 8 trinn 2, V1b
kenneth_vedtak: 2026-09-24 — «noe fjernet → rød farge»
---

# Ordre: rett fargekonvensjonen i kutt/fyll — og gi kartet en legende

## [1] HVA SOM ER GJORT

**Funksjonen finnes og er koblet.** Målt 2026-09-24:

| Ledd | Hvor |
|---|---|
| Fane i UI | `3d-visning/typer.ts:5`, `page.tsx:54,90-91` |
| Komponent | `FaneKuttFyll` — `3d-visning/page.tsx:451` |
| Beregning | `beregnKuttFyll(topp, bunn, celleStr)` — `kutt-fyll.ts:34`, kalt `page.tsx:502-503` |
| Volum | `kuttVolum` / `fyllVolum` / `netto` i m³ — `kutt-fyll.ts:13-15` |
| Fargelagt differanse | `genererDiffMesh` — `kutt-fyll.ts:185` |

**Volumtallene er riktig merket** (`:13-14`: `kuttVolum` = «terreng fjernet», `fyllVolum` = «masse tilført»).
**Ingenting er galt med regnestykket.**

**🔴 BACKLOG-grep (steg 0):** `kutt` 7 · `fyll` 34 · `volum` 8 · `masse` 2 treff, men **null treff** på
`kutt.?fyll` / `volumbereg` / `masseregn` / `masseuttak` som sak. **Ingen eksisterende BACKLOG-post dekker
dette.** Denne ordren lukker ingen post og skal ikke opprette en.

## [2] HVA SOM GJENSTÅR

🔴 **Fargene er invertert mot byggherrens konvensjon**, og konvensjonen er nå vedtatt.

| Tilstand | Koden i dag | **Skal være** |
|---|---|---|
| Masse **fjernet** — kutt, ΔZ < 0 | 🔵 blå (`kutt-fyll.ts:32,208,217-219`) | 🔴 **rød** |
| Masse **tilført** — fyll, ΔZ > 0 | 🔴 rød | 🔵 **blå** |
| Uendret — ΔZ = 0 | grå | grå (uendret) |

> **Kenneth 2026-09-24, ordrett:** *«jeg står på min siste påstand → noe fjernet → rød farge»*
>
> Bakgrunn (2026-09-24): *«rød betyr at masser er fjernet/gravd bort, blå overflate betyr fyll/tilfylt …
> Dette er viktig for å dokumentere uttak og transport av masser.»*

⚠️ **Begge konvensjoner finnes i bransjen — dette er ikke en regnefeil, det er et vedtatt valg.** Skriv det
som et vedtak i koden, ikke som en preferanse.

🔴 **Og kartet har ingen legende i dag.** Målt: `FaneKuttFyll` (`page.tsx:451-560`) har ingen tekst som sier
hva rødt og blått betyr — kun «Toppflate (nyeste)» / «Bunnflate (eldste)». **Et volumdokument uten legende er
ikke dokumentasjon**; den som leser det i et sluttoppgjør om to år kan ikke vite hvilken vei fargene gikk.

## [3] OPPGAVE

### 🔴 A. Obligatorisk — inverter fargene

`apps/web/src/lib/kutt-fyll.ts`:

1. **`genererDiffMesh` (`:185-225`):** bytt de to fargeblokkene slik at `dz < 0` gir rød og `dz > 0` gir blå.
   Grå-grenen (`dz === 0`) er uendret. **Intensitetsskalaen er uendret** — kun kanalene bytter plass.
2. **Doc-kommentaren `:32`** og inline-kommentarene `:208,210,217` skal si det nye, og **si HVORFOR**:
   `// Vedtak Kenneth 2026-09-24: fjernet masse = RØD (kutt, ΔZ < 0), tilført = BLÅ (fyll, ΔZ > 0).`
3. **Ikke rør** `KuttFyllResultat`-feltene (`:12-27`). `kuttVolum`/`fyllVolum`/`netto` er riktige og leses av
   UI-et.

### 🔴 B. Obligatorisk — test som feiler hvis noen inverterer tilbake

`apps/web/src/lib/__tests__/kutt-fyll.test.ts` (ny fil — `vitest`, samme mønster som de ti andre i mappa).

**Minst to tester, og de skal treffe fargekanalene direkte:**

- **Kutt gir rød:** bygg to TIN der toppflaten ligger LAVERE enn bunnflaten (ΔZ < 0), kall `genererDiffMesh`,
  og assertér at **rød kanal > blå kanal** for en celle i overlappet.
- **Fyll gir blå:** omvendt — toppflate HØYERE (ΔZ > 0), assertér **blå kanal > rød kanal**.

🔴 **Rød-først-kontroll er påkrevd i rapporten:** inverter fiksen midlertidig og vis at BEGGE testene faller.
**Faller bare én, treffer testene bare halve grenen.**

⚠️ **Assertér på kanalforholdet, ikke på eksakte flyttall.** En test som låser `0.3 + 0.7 * intensitet` knekker
neste gang noen justerer intensitetskurven, og da blir den slettet i stedet for lest.

### 🔴 C. Obligatorisk — legende i `FaneKuttFyll`

I sidepanelet (`3d-visning/page.tsx`, i `FaneKuttFyll` ved volumtallene): to fargeprikker med tekst.

- 🔴 rød → «Fjernet (kutt)» · 🔵 blå → «Tilfylt (fyll)»
- **i18n:** nye nøkler i **både** `nb.json` og `en.json` (`3d.kuttFyllLegendeKutt`, `3d.kuttFyllLegendeFyll`
  eller tilsvarende), deretter 13-språk-generate **med `--only <dine nøkler>`** per CLAUDE.md § i18n.
- **Fargene i legenden skal komme fra samme sannhet som meshen** — ikke to hardkodede steder som kan drifte
  fra hverandre. Eksporter konstantene fra `kutt-fyll.ts` hvis det er den reneste veien.

### 🟡 D. Valgfritt — to hardkodede norske strenger i samme komponent

`page.tsx:536` «Toppflate (nyeste)» og `:550` «Bunnflate (eldste)» er hardkodet norsk i JSX, som CLAUDE.md
forbyr. **Ta dem med hvis du er i fila likevel** — men de er ikke denne ordrens formål, og de skal ikke gjøre
diffen uleselig. **Hopper du over dem, skriv det i rapporten** så neste leser vet at det var et valg.

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** bestemmes av cowork. Design rører ikke git-koreografi.
- **Filer denne ordren eier:** `apps/web/src/lib/kutt-fyll.ts` ·
  `apps/web/src/lib/__tests__/kutt-fyll.test.ts` (ny) ·
  `apps/web/src/app/dashbord/[prosjektId]/3d-visning/page.tsx` (kun `FaneKuttFyll`) ·
  `packages/shared/src/i18n/*.json`. **Ingen andre.**
- ⚠️ **`nb.json`/`en.json` er høytrafikk-filer** — cowork holder kollisjonskartet. Meld hvis de er tatt.
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.** Linjenumrene over er målt 2026-09-24 på
  `origin/develop` `4d9fc788`. **Stemmer de ikke, er treet ditt en annen alder — mål før du melder avvik.**
- 🔴 **Sjekk treets alder før du melder et fravær.**
- **Kald web-bygg** — ordren rører `apps/web`:
  `rm -f apps/web/tsconfig.tsbuildinfo apps/web/.next/cache/.tsbuildinfo && rm -rf apps/web/.next`
- **Gate før push:** `pnpm test` fra ROT (`--force`) + `pnpm --filter @sitedoc/web build` kaldt.
  **`apps/web` sin testtelling skal STIGE** med dine nye tester — meld før/etter.
- **Push egen branch. Aldri `develop`.**

## [5] FORVENTET OUTPUT

1. **Fargeinverteringen:** diff på `genererDiffMesh` + hva kommentarene nå sier.
2. **Rød-først:** at **begge** testene faller når fiksen inverteres tilbake. **Faller bare én, si det** — da
   mangler halve dekningen.
3. **Gate-tall som sier hva som kjørte:** db · api · pdf · shared · web (før → etter) · mobil · X/Y.
4. **Legenden:** hvilke i18n-nøkler, at de er i nb + en, og at generate kjørte med `--only`.
5. **D:** tatt eller hoppet over — og hvilket.

⚠️ **Skjermbilde bestilles IKKE av deg.** Legenden er en visuell endring; design-godkjenning mot skjermbilde
går via en verifiserings-agent cowork utpeker. **Meld at den gjenstår, ikke at den er gjort.**

## [6] OPPRYDDING

Cowork sletter branchen etter merge. Agenten gjør ingenting.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Kutt (ΔZ < 0) er **rød**, fyll (ΔZ > 0) er **blå** | Diff + test |
| 2 | Begge retninger dekkes av test som faller ved reversering | Rød-først-rapport |
| 3 | Kommentaren sier **hvorfor**, med dato og vedtak | Diff |
| 4 | Legenden finnes og henter fargene fra samme kilde som meshen | Diff |
| 5 | i18n i nb + en + 13 via `--only` | Nøkkelnavn i rapport |
| 6 | Volumfeltene urørt | `git diff` viser ingen endring i `:12-27` |

🔴 **Ikke i denne ordren:** `-GLOBAL_SHIFT`, LAS-offset og `PointCloud.coordinateSystem`. De hører til
notatets § 8 trinn 2 pkt 1-2, **krever at DWG/3D-binærene er tilbake**, og er en større sak med egen
Kenneth-beslutning (V1c).
