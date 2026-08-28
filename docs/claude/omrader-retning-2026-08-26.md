---
name: omrader-retning
description: Kenneth-retning 2026-08-26 — områder som felles akse mellom fremdriftsplan, kontrollplan, tegninger og 3D. Ikke designet, ikke bygget.
status: 🟡 RETNING — venter fabel-design
sist_verifisert_mot_kode: 2026-08-26
---

# Områder som felles akse — retning, ikke design

> ⚠️ **PREMISSET HER VAR FEIL. Les
> [omrader-akse-naastatus-fabel-2026-08-27.md](omrader-akse-naastatus-fabel-2026-08-27.md)
> først.** Cowork skrev dette som om områder skulle designes fra bunnen. Fabel
> kodeverifiserte dagen etter og fant at **`Omrade` har stått i prod hele tiden**
> (`schema.prisma:897` — byggeplass-forankret, polygon, type sone/rom/etasje, koblet til
> kontrollplanpunkter), og at fremdriftsplan-importen finnes med etablert
> re-import-identitet (`importTaskUid`/`importWbs`).
>
> Cowork har bekreftet alle fire funnene mot koden 2026-08-27. **Det reelle gapet er
> smalere:** koblingen `KontrollplanPunkt.omradeId` finnes med `SetNull`, indeks og
> unik-constraint — men **ingen importkode setter den**, og `Omrade` har null
> import-avstamning. Kenneths retning står; kartet under gjorde det ikke.

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

## 🔴 Fremdriftsplanen IMPORTERES — SiteDoc eier den ikke

Kenneth 2026-08-26: *«fremdriftsplanen importerer vi fra f.eks. import fra xml — vi har
ikke bygget en egen fremdriftsplan.»*

Det er premisset hele kjeden hviler på, og det endrer designspørsmålene:

- Områdene arver referanser fra et **eksternt** dokument, ikke fra noe SiteDoc kontrollerer.
- **Hva skjer ved ny import?** Endres planens struktur, endres referansene områdene arvet
  — og kontrollpunkter, tegningsinndelinger og 3D-soner henger i dem. Dette er det
  vanskeligste spørsmålet i hele saken, og det må besvares før noe bygges.
- Ingen import-kilde er låst. XML nevnt som eksempel; MS Project står som eget spor
  (masterplan del 6b fase 3).

## Åpent, bevisst utsatt: skal planen VISES og REDIGERES?

Kenneth: *«er det verdt å lage en ui som viser en importert fremdriftsplan? Ikke nå —
senere, etter at systemet er tatt i bruk av kunde. Kan vi lage fremdriftsplanen
redigerbar?»*

Utsatt til etter kundebruk. Men spørsmålet bærer en spenning som bør noteres nå:

**Blir en importert plan redigerbar i SiteDoc, har prosjektet to sannheter** — planen i
det eksterne verktøyet og planen i SiteDoc. Uten en eksplisitt eierskapsregel drifter de
fra hverandre, og da vet ingen hvilken kontrollplanen egentlig bygger på.

Mulige utganger, ikke vurdert: kun visning (SiteDoc leser, eier aldri) · redigerbar med
SiteDoc som eier etter import · redigerbar med tilbakeskriving til kilden. De tre gir helt
ulike datamodeller, så valget hører hjemme før områdene bygges, ikke etter.

## Hva dette IKKE er

- **Ikke en seed-sak.** Å fylle velgerne med dummy-rom for å verifisere at de fylles
  beviser ingenting om en funksjon som ikke er designet. Prop-fiksen er allerede
  verifisert gjennom H8 (samme kode).
- **Ikke et pilot-tema.** Piloten er ~sept 2026; dette er arkitektur som binder
  planlegger, kontrollplan, tegninger og 3D.

## Neste steg

Fabel eier designet. Spørsmål som må besvares før noe bygges:

- Hvor bor et område i datamodellen — egen entitet, eller avledet av den importerte planen?
- 🔴 **Hva skjer ved RE-IMPORT?** Områdene arver referanser fra et eksternt dokument.
  Endres planen, henger kontrollpunkter, tegningsinndelinger og 3D-soner i referanser som
  kan ha flyttet seg. Dette er sakens vanskeligste spørsmål.
- Én områdeinndeling per prosjekt, eller flere parallelle (bygg vs. fag)?
- Forholdet til **byggeplass**, som allerede er en stedsakse
  ([byggeplass-strategi.md](byggeplass-strategi.md))
- Forholdet til `zone_property`/`room_property` som felttyper — blir de inngangen til
  denne aksen, eller erstattes de?

Relatert: [kontrollplan.md](kontrollplan.md) · [planlegger.md](planlegger.md) ·
[byggeplass-strategi.md](byggeplass-strategi.md)
