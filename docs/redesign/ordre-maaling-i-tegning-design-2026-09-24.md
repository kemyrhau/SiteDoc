---
status: 🟢 ORDRE — steg 1 klar. Steg 2 skissert, ikke bestilt
til: kode-agent (worktree og branch bestemmes av cowork)
fra: design
dato: 2026-09-24
kenneth_krav: 2026-09-24 — «vi trenger også målemuligheter i tegning. vi må da lese av tegningens mål: eller sette denne manuelt for å evt. kallibrere selv»
---

# Ordre: måling i tegning — steg 1

## [1] HVA SOM ER GJORT — halve funksjonen finnes alt, ubrukt

**Alt målt 2026-09-24 på `origin/develop`.**

| Ledd | Tilstand |
|---|---|
| `Drawing.scale` | 🔴 **Finnes** (`schema.prisma`, «Målestokk: 1:50, 1:100, 1:200»), tas imot i Zod (`tegning.ts:142`, `:332`) — **og leses INGEN steder i UI.** Null treff i hele dashbordet |
| `imageWidth` / `imageHeight` | 🟢 Finnes, fylles fra `sharp` |
| PDF-render | 200 DPI (`tegning.ts:284`, `:682`) |
| `pdftotext` / `pdfinfo` | 🟢 **Følger med `poppler-utils`, installert i begge containere.** Brukes ikke i dag |

🔴 **`Drawing.scale` er «stille tomhet»:** et felt som kan skrives, men som ingenting leser.

### 🟢 Målt på en EKTE produksjonstegning (`40ae60ab-…`, UNN Familierom)

```
pdftotext  → «Mål:» / «1:50»          ← tittelfeltet er EKTE TEKST, ikke bilde
pdfinfo    → Page size: 1190.55 x 841.89 pts (A3) = 420,0 × 297,0 mm
pdfinfo    → Custom Metadata: no · Metadata Stream: no
```

🔴 **Målestokken ligger IKKE i PDF-metadata** (Archicad → PDFTron legger ingenting igjen). **Den står som
tekst i tittelfeltet.** 🟢 **Kenneth bekreftet at 1:50 er riktig for den tegningen** — uttrekket er verifisert
mot fasit, ikke antatt.

**BACKLOG-grep (steg 0):** `målestokk`, `måling`, `scale`, `mm pr` — **ingen eksisterende post.**

## [2] HVA SOM GJENSTÅR

En målestokk som er **utledet, bekreftet og synlig**, og et måleverktøy som bruker den.

## [3] OPPGAVE — steg 1

### 🔴 A. Utled mm pr. piksel av MÅLTE fakta — ikke av DPI-konstanten

```
mm_pr_px = papirbredde_mm (fra pdfinfo) ÷ imageWidth_px (fra sharp)
```

🔴 **Ikke hardkod 200 DPI.** Den lever i et kommandolinjeflagg (`tegning.ts:284`). Endres den, eller skaleres
bildet et sted, blir hver måling **stille feil**. ⚠️ **Utledningen over er selvvaliderende og tåler begge deler.**

**Samme prinsipp som georeferanse-notatet:** *utled fra det eksakte, ikke degradér til en antakelse.*

- **Nytt felt:** `Drawing.mmPrPiksel Float?` — 🔴 **krever Kenneths ok til migreringen før den skrives.**
- Fylles ved PDF-konvertering. **Er papirbredden ukjent, skal feltet være NULL — aldri en gjettet verdi.**

### 🔴 B. Les målestokken fra tittelfeltet — foreslå, aldri stol på

`pdftotext -f 1 -l 1 <fil> -` ved konvertering.

🔴 **Søk etter verdien som følger «Mål», «Målestokk» eller «Scale» — IKKE etter `1:\\d+` alene.**
⚠️ **En tegning inneholder flere `1:NN`:** detaljsnitt har egne målestokker, og teksten har koder som
`IV11_EI60/37dB`. **Et løst grep treffer feil og gjør det selvsikkert.**

- Treff → **forhåndsutfyll** `Drawing.scale`. **Ingen treff → la feltet stå tomt.**
- 🔴 **Nytt felt:** `Drawing.scaleKilde String?` — `"tittelfelt"` · `"manuell"` · `"kalibrert"` · `"georeferanse"`.
- ⚠️ **Verdien skal ALDRI brukes til måling før et menneske har bekreftet den.** Uttrukket målestokk er et
  forslag, ikke et faktum.

### 🔴 C. UI: forhåndsutfylt valg, ett klikk

Kenneths prinsipp: *alt som kan utledes skal utledes — som et forhåndsdefinert valg, ikke fritekst.*

- Nedtrekk med **1:20 · 1:50 · 1:100 · 1:200 · 1:500 · Annet**, forhåndsvalgt fra B.
- **Er kilden `"tittelfelt"` og ubekreftet: vis det**, og krev ett klikk for å bekrefte.
- **Kalibrering (fallback):** trekk en linje mellom to kjente punkter, skriv inn virkelig lengde →
  regn ut og lagre `scale` med `scaleKilde="kalibrert"`. 🔴 **Nødvendig for skannede tegninger, der
  papirmålestokken lyver fordi skanneren har strukket bildet.**

### 🔴 D. Måleverktøy

- Klikk to punkter → avstand. Klikk videre → polylinje med sum.
- 🔴 **Resultatet skal ALLTID vise kilden:** «2,87 m *(målestokk 1:50, fra tittelfelt — bekreftet)*».
  ⚠️ **En måleverdi uten sin opprinnelse er en påstand.** Samme regel som `bakkeMetode` i punktsky-ordren.
- **Er `scale` eller `mmPrPiksel` null: verktøyet skal være AVSLÅTT med en lesbar grunn** — ikke vise piksler
  som om de var meter.

### 🟢 E. Georeferanse har FORTRINN når den finnes

Har tegningen **3+ referansepunkter**, gir `beregnTransformasjon` en affin avbildning til virkelige
koordinater. 🔴 **Den måler bakken, ikke papiret — den tåler at tegningen er strukket eller skjev.**

**Finnes den, brukes den, og `scaleKilde="georeferanse"`.** ⚠️ **Kun ved 3+ punkter** — to punkter gir en
similaritet som tvangsroterer, se
[georeferanse-notatet](designnotat-georeferanse-speiling-design-2026-09-23.md).

### 🟡 F. Steg 2 — IKKE bestilt: lagrede målinger

Måling som objekt på tegningen (posisjon, verdi, hvem, når, `scaleKilde`). **Design anbefaler det** — en måling
du ikke kan hente fram igjen er ikke et bevis, og punktsky-overflatene viste akkurat det i dag. **Men det er
en egen runde med egen tabell, og Kenneth tar valget etter å ha brukt steg 1.**

## [4] UFRAVIKELIG

- **Arbeidstre + branch:** cowork bestemmer.
- 🔴 **Migreringen (`mmPrPiksel`, `scaleKilde`) krever Kenneths eksplisitte ok FØR den skrives.**
  Additiv, nullable, ingen DROP.
- **«Stille tomhet»:** feltene er nullable med vilje — **en tegning uten kjent målestokk SKAL ha tom verdi.**
  🔴 **Men da må verktøyet være avslått (D), ellers er tomheten stille.** **Test som feiler hvis verktøyet er
  aktivt med null målestokk.**
- 🔴 **Din ordre er input, ikke fasit — mål premisset selv.**
- 🔴 **Sjekk treets alder før du melder et fravær.** ⚠️ **Tom grep-output betyr «kommandoen døde» like ofte
  som «finnes ikke» — verifiser at stien finnes.**
- **Kald web-bygg** (`apps/web` røres) + `pnpm test` fra ROT + mobil-typecheck.

## [5] FORVENTET OUTPUT — og akseptansetesten ligger i tegningen selv

🟢 **Testtegningen bærer sin egen fasit.** `40ae60ab-…` (UNN Familierom, 1:50, A3) har **påførte mål i
millimeter**: `2 870`, `2 425`, `2 110`, `1 010`.

🔴 **Akseptansetest: mål den linja som er påført «2 870» og treff 2870 mm.** Toleranse **±1 %** for
klikk-basert måling; **±0,5 %** når testen regner fra kjente pikselkoordinater.

⚠️ **Ingen syntetisk fixture. Tegningen svarer selv.**

**Ellers:**
1. At `mmPrPiksel` er utledet, ikke hardkodet — **vis at en endret DPI gir riktig svar likevel.**
2. At B fant `1:50` på testtegningen, og at et løst `1:\\d+`-grep ville truffet noe annet. **Vis begge.**
3. At verktøyet er avslått når målestokken mangler, med lesbar grunn.
4. At kilden vises sammen med målet.
5. Gate-tall som sier hva som kjørte.

⚠️ **Skjermbilde bestilles IKKE av deg** — visuell godkjenning går via en verifiserings-agent cowork utpeker.

## [6] OPPRYDDING

Cowork sletter branchen etter merge.

---

## Akseptkriterier (designgate)

| # | Krav | Bevis |
|---|---|---|
| 1 | `mmPrPiksel` utledet av papirbredde ÷ pikselbredde | DPI-uavhengighet vist |
| 2 | Målestokk foreslått fra «Mål»-nabolaget, ikke løst `1:NN` | Begge vist |
| 3 | Uttrukket verdi krever bekreftelse før bruk | UI + `scaleKilde` |
| 4 | Måling treffer **2870 mm** ±1 % | Akseptansetest |
| 5 | Kilden vises sammen med hvert mål | Skjerm |
| 6 | Verktøy avslått ved manglende målestokk, med test | Rød-først |
| 7 | Georeferanse har fortrinn ved 3+ punkter | Kode |

🔴 **Ikke i steg 1:** lagrede målinger (F) · areal · DWG-avledet målestokk · OCR for skannede tegninger.
