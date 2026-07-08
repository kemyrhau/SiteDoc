# F1/F3/F4/F5 — skjermbilder for designgodkjenning (web)

Miljø: **redesign.sitedoc.no** (redesign-stack, `nyNavigasjon` default-på), innlogget
som Kenneth (sitedoc_admin). Firma **A.Markussen AS**. Fanget via Playwright MCP
(desktop-viewport 1440×900) mot Kenneths innloggede Chrome.

Commit-opphav: **F3/F4/F5 = `17ba8bb0`** (generalprøve-batch), **F1 = `5ace3e3f`**
(F1-oppfølger: «Administrer mapper» også i Mapper tomt-state).

| Funn | Fil | Viser | Paritet |
|---|-----|-------|---------|
| **F1** | `F1-mapper-tomt-state-administrer-mapper.png` | Mapper-siden uten valgt mappe («Ingen mapper funnet» / «Velg en mappe»): **«Administrer mapper»**-knappen (FolderPlus) vises nå i tomt-state → `/dashbord/oppsett/produksjon/box` (Mappeoppsett). Tidligere kun i header ved valgt mappe → uoppdagbar på prosjekt uten mapper. | O9, G7 (`kanManageField`), P14 |
| **F3** | `F3-sok-innstillinger-hub-treff.png` | Ctrl+K-søk «innstillinger» → alltid-synlig hub-treff **«Innstillinger»** (→ `/dashbord/innstillinger`). Gammel firma-innstillinger-rot droppet under flagg-på. | 1b søk, F21 |
| **F4** (før) | `F4-for-innstillinger-prosjekt-999.png` | På `/dashbord/innstillinger` med prosjekt **999 ytterstifjorn** (chip + PROSJEKT-seksjon «Gjelder kun 999 ytterstifjorn»). | T3 |
| **F4** (etter) | `F4-etter-innstillinger-prosjekt-998-rute-bevart.png` | Etter prosjektbytte via kontekst-chip til **998 Instinniforbotn**: URL fortsatt `/dashbord/innstillinger` (IKKE `/dashbord/998…`), chip + PROSJEKT-seksjon + byggeplass oppdatert. Global rute bevart, kun kontekst byttet. | T3, F4-atferd |
| **F5** | `F5-hub-kalender-varelager.png` | Innstillings-hubens FIRMA-seksjon med de nye kortene **Kalender** («Sommer-/vintertid og arbeidskalender») og **Varelager** («Varekatalog og import» → Katalog + Import, gated firmamodul aktiv). | F17, F18/F19 |

Berørte filer: `apps/web/src/app/dashbord/[prosjektId]/mapper/page.tsx` (F1),
`apps/web/src/hooks/useSokRegistry.ts` (F3), `apps/web/src/kontekst/prosjekt-kontekst.tsx` (F4),
`apps/web/src/lib/innstillinger-kort.tsx` (F5).
