---
name: omrader-retning
description: Kenneth-retning 2026-08-26 — områder som felles akse mellom fremdriftsplan, kontrollplan, tegninger og 3D. Ikke designet, ikke bygget.
status: 🟡 RETNING — venter fabel-design
sist_verifisert_mot_kode: 2026-08-26
---

# Områder som felles akse — retning, ikke design

**Kilde:** Kenneth 2026-08-26, som svar på coworks spørsmål om `room_property` og
`zone_property` brukes i praksis.

## Målingen som utløste spørsmålet

`report_objects` mot `sitedoc_test`, 2026-08-26:

| Prosjekt | drawing_position | location | room_property | zone_property |
|---|---|---|---|---|
| Agent-testprosjekt | 1 (repeater) | 1 (repeater) | 1 (repeater) | 1 (repeater) |
| Test prosjekt SiteDoc Røstbakken | 3 (repeater) | 5 | — | — |
| Sitedoc Boligfelt B12 | — | 3 | — | — |

**`room_property` og `zone_property` finnes ikke i én eneste ekte mal** — kun der
kontrollplan seedet dem 2026-08-25 for å verifisere `prosjektId`-prop-fiksen.

## Kenneths svar — retningen

> *«dette er feature som ikke er i bruk nå, men svært ønskelig å bruke — spesielt i
> sammenheng med 3d og plantegninger, der plantegninger deles inn i rom eller områder —
> gjerne områder. Disse må også knyttes opp mot kontrollplan. Områder deles helst opp
> etter fremdriftsplanens oppbygging/referanser. Fremdriftsplanen benytter vi som
> grunnlag for å bygge kontrollplan.»*

## Kjeden det innebærer

```
Fremdriftsplan  →  Områder  →  Kontrollplan
   (struktur)      (arver        (bygges på
                    referansene)   områdene)
                        ↓
              Tegninger + 3D
           (deles inn etter samme områder)
```

**Områder er ikke et felt i en mal — det er en akse fire moduler deler.** Det skiller
denne saken fra `drawing_position`, som er et punkt på en tegning og ikke en struktur.

«Gjerne områder» framfor rom: rom er bygningsgeometri, områder følger arbeidets
inndeling. Fremdriftsplanen tenker i det siste.

## Hva dette IKKE er

- **Ikke en seed-sak.** Å fylle velgerne med dummy-rom for å verifisere at de fylles
  beviser ingenting om en funksjon som ikke er designet. Prop-fiksen er allerede
  verifisert gjennom H8 (samme kode).
- **Ikke et pilot-tema.** Piloten er ~sept 2026; dette er arkitektur som binder
  planlegger, kontrollplan, tegninger og 3D.

## Neste steg

Fabel eier designet. Spørsmål som må besvares før noe bygges:

- Hvor bor et område i datamodellen — egen entitet, eller avledet av fremdriftsplanen?
- Hvordan arves fremdriftsplanens referanser, og hva skjer når planen endres?
- Én områdeinndeling per prosjekt, eller flere parallelle (bygg vs. fag)?
- Forholdet til **byggeplass**, som allerede er en stedsakse
  ([byggeplass-strategi.md](byggeplass-strategi.md))
- Forholdet til `zone_property`/`room_property` som felttyper — blir de inngangen til
  denne aksen, eller erstattes de?

Relatert: [kontrollplan.md](kontrollplan.md) · [planlegger.md](planlegger.md) ·
[byggeplass-strategi.md](byggeplass-strategi.md)
