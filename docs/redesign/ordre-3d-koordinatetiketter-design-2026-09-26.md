---
status: 🟢 ORDRE — liten. Fjerner en aktiv usannhet i UI-et
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-26
grunnlag: simulators git-bevis 2026-09-26 + designs måling av `ifcMetadata.ts`
---

# Ordre: 3D-klikkpanelet skal si hva tallene ER

## [1] HVA SOM ER MÅLT

**Simulator avkreftet premisset om regresjon:** alt 3D-koordinatarbeid er mars–april 2026, serverflyttingen var
2026-06-10. **Ingen commit ligger etter.** `bf665590` (2026-03-22) innførte panelet slik det står:

```
"Øst (X)":   hitResult.point.x
"Nord (Y)":  hitResult.point.y
"Høyde (Z)": hitResult.point.z
```

🔴 **Rått fra Three.js-raycasten, uten mellomledd, fra første commit.** **Ingen transform har noensinne
funnets** — `git log -S 'proj4'` er tomt.

### 🔴 Og designs måling avgjør hvorfor dette ikke kan «fikses» i stedet

**`ifcMetadata.ts` (228 linjer) leser IFCSITE-koordinater til `gpsBreddegrad`/`gpsLengdegrad`** — **ett
ankerpunkt: hvor tomta ligger.**

🔴 **Men den leser INGEN nordretning.** Verifisert: ingen `TrueNorth`, `RefDirection` eller rotasjon i fila.

⚠️ **Uten modellens rotasjon mot geografisk nord kan X og Y ikke bli til øst og nord.** **Et punkt ti meter
«X» fra origo kan ligge ti meter øst, ti meter nord, eller hvor som helst imellom.**

🔴 **Å gjøre etikettene sanne er derfor ikke tyngre arbeid — det er umulig med dagens data.**

## [2] OPPGAVE

### 🔴 A. Etikettene skal si hva tallene er

| I dag | Skal bli |
|---|---|
| `Øst (X)` | `X (modell)` |
| `Nord (Y)` | `Y (modell)` |
| `Høyde (Z)` | `Z over modellens nullpunkt` |

🔴 **Ikke «omtrentlig øst». Ikke «øst (lokal)».** ⚠️ **Enhver formulering som beholder himmelretningen,
beholder løgnen** — leseren fester seg ved «øst», ikke ved forbeholdet.

**i18n:** nøkler i `nb.json` **og** `en.json`, deretter 13-språk-generate med **`--only <dine nøkler>`**.
⚠️ **`nb.json`/`en.json` er høytrafikk — meld til cowork hvis de er tatt.**

### 🟡 B. Én forklarende linje under tallene

**«Koordinater i modellens eget system. Geografisk posisjon krever at modellens nordretning er kjent.»**

🟢 **Den forteller hvorfor, og den forteller hva som mangler** — så neste som lurer, slipper å grave.

### 🟡 C. Rydd debug-loggingen fra `2ab0783b`

**`tegning-3d/page.tsx:165,178,471-479` — «world vs local offset»-logging fra april 2026 ligger fortsatt i
prod-koden.**

⚠️ **Den er restene av et forsøk på å forstå nettopp dette offsetet.** **Forsøket ble aldri ryddet, altså
aldri løst.** **Fjern den — den forvirrer den neste som leser fila.**

🟡 **Valgfritt, men ta det hvis du er i fila.** **Hopper du over, skriv det i rapporten.**

## [3] UFRAVIKELIG

- 🔴 **Ingen koordinattransformasjon skal bygges.** ⚠️ **Dette er en etikett-retting.** **Bygger du en
  omregning, har du løst en annen oppgave enn den bestilte.**
- **Filer:** `tegning-3d/page.tsx` (kun panelet + evt. C) · `packages/shared/src/i18n/*.json`. **Ingen andre.**
- 🔴 **`tegning-3d`s kalibrering og pan/zoom skal IKKE røres.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.**
- **Kald web-bygg. Gate: `pnpm test` fra ROT · web-build · mobil-typecheck · `tsc --noEmit`.**

## [4] FORVENTET OUTPUT

1. **Diffen på etikettene**, og at ingen himmelretning står igjen
2. **i18n-nøklene**, og at generate kjørte med `--only`
3. **C: ryddet eller hoppet over — si hvilket**
4. **Gate-tall**

⚠️ **Skjermbilde bestilles IKKE av deg** — visuell bekreftelse går via verifiserings-agent cowork utpeker.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | Ingen himmelretning i etikettene | Diff |
| 2 | Forklarende linje som sier hva som mangler | Diff |
| 3 | **Ingen transformasjon bygget** | `git diff` |
| 4 | i18n i nb + en + 13 via `--only` | Rapport |

🔴 **Ikke i denne ordren:** nordretning fra IFC · geografiske koordinater · punktsky.
**De hører til [maleverdi-opprinnelse.md](../claude/retningslinjer/maleverdi-opprinnelse.md) § 3 og en egen
beslutning om 3D-koordinatfesting i det hele tatt skal bygges.**
