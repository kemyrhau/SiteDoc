---
name: k3-verifiseringslogg
status: 🟢 K3 VERIFISERT SUNN (2026-07-23) — trakt/topplinje/sidehode/⇄ korrekt. Timer-#310 skilt ut som egen sak (ikke K3-regresjon, ikke på prod)
eier: Kenneth (test) · cowork (måling + triage) · fabel (design-call)
sist_verifisert_mot_kode: 2026-07-23
---

## ✅ Timer-#310 avklart som IKKE-K3 (2026-07-23)

⇄-«krasjen» var ikke ⇄ og ikke K3: React #310 (betinget hook) i timer-**hovedvisningen**, trigget av test-databasens datashape. K3 rørte ingen timer-hooks (kun JSX-wrap); timer-hooks identiske prod↔develop; **prod-timer fungerer** (verifisert sitedoc.no 2026-07-23). Skilt ut → [timer-310-hooks-bug.md](../timer-310-hooks-bug.md). ⇄-hotfixen (`acea2c27`: streng paring + eyebrow + Link) er korrekt og kan merges — den reduserer ⇄-flatene (attestering/rapport mister ⇄) og er bedre enn dagens ungatede ⇄ på test.

# K3 verifiseringslogg

## Kundetelefon-gjennomklikk (Kenneth, test.sitedoc.no, 2026-07-22)

### ✅ Bestod (kjernemekanikk)
- **Autovalg byggeplass** — fungerer på alle testede flater
- **Alle/Mine** — fungerer (og #7: admin *kan* gå inn i «Alle» — korrekt, admin-rett)
- **Firmakontekst** — fungerer (kun firmanavn, amber)
- **Ny/gammel nav** — begge fungerer, gammel nav urørt
- **Selve trakten + kundetelefon-oppslaget** — firma → prosjekt → byggeplass uten gjetting

### 🔴 Funn 1 (ÉN rotårsak: #1 + #2 + #9) — byggeplass trunkeres bort i topplinja
- **#1:** lang prosjekt-id fyller hele topplinja-visningen.
- **#2:** aktiv byggeplass «grået ut» = suffikset ikke synlig.
- **#9:** «Test redigert mal» viser byggeplass «Kenneth Myrhaug», skulle vært Røstbakken.

**Cowork-måling — rotårsak:** `KontekstChip.tsx:281` har `max-w-[220px] truncate` på topplinje-teksten. Teksten er `{projectNumber} {name}{ · byggeplass}`. Prosjektet SD-20260310-0007 **heter** «Test redigert mal Kenneth Myrhaug» → ved 220px kuttes «· Røstbakken» bort, og navnets hale «…Kenneth Myrhaug» blir stående. **#9 er altså ikke feil byggeplass — det er prosjektnavnets hale + trunkering som skjuler den riktige byggeplassen.** Fasitens målform («998 Instinniforbotn · Bygg B12») antok korte numre; reelle numre er «SD-ÅÅÅÅMMDD-NNNN» (16 tegn).

**Konsekvens:** byggeplass-fiksen fabel krevde (kloss 2b) beseires i praksis for lange navn. Reell regresjon.

**✅ LØST (Kenneth-forslag + fabel-gate 2026-07-22) → kloss 2c:** to-linjers topplinje (prosjektkontekst: Firma / Prosjekt · Byggeplass; firmakontekst: kun Firma), SD-nummer droppet. Grammatikk + reverserings-føring i [k3-ordre § Kloss 2c](../k3-ordre.md). Kode-gatet cowork (`fdc4a168`) + designgatet fabel.

**Fabels tre merknader (2c designgate, ufravikelige føringer):**
1. **Toppbar-blå = brand-farge, IKKE sonetone.** Tonen bæres av chip + sidehode, aldri av baren. **Ingen skal senere «rette» firmakontekstens bar til amber** — baren er merkevare-blå i begge kontekster; kun chip/sidehode skifter tone. Ført her så det ikke revideres i vill misforståelse.
2. **Eyebrow godkjent** (dempet lys grå på brand-blå = informasjon uten kontekst-claim). **Test-deploy-sjekk:** 11px-teksten skal holde AA-kontrast (≥4.5:1) mot baren — måles på test.
3. ~~**Chip flyter med navnelengden**~~ **🔄 REVERSERT (Kenneth test-funn + fabel-gate 2026-07-23):** inline-flyten oppleves forstyrrende — chip+⇄ hopper sidevegs ved firma↔prosjekt-bytte, musa må flyttes. Ny regel: **ankre chippen** — navn-området får fast bredde (240px, min-w = max-w), venstrejustert, trunkert m/ ellipsis + `title`-tooltip. Klikk-mål slår inline-estetikk. Fulle navn lever i eyebrow/trakt/sidehode. Egen branch `fix/chip-ankret-bredde`.

### ✅ Korreksjonspass kode-gatet (cowork 2026-07-22, `51e8cc8f`)

Fire ting verifisert mot koden: (1) `PARBARE_SEKSJONER` fjernet — `harMotpart = firmaSeksjoner ∩ prosjektSeksjoner` (begge tilgangs-filtrerte nav). (2) delt kilde `sone-farger.ts` (SONE_MARKOR + SONE_GRADIENT); SonetonetSidehode + Verktoylinje importerer begge; Verktoylinje har `border-l-4 SONE_MARKOR.prosjekt` uten gradient. (3) oppmotesteder urørt. (4) polish: 28 filer, indre marg relokert.

**To flagg til fabels test-gate (ikke blokkerende):**
1. **Chip-ens `soneKlasse` (KontekstChip:162–163) hardkoder fortsatt `#f5c97b`/`#a9c4f5`** — pre-eksisterende P1-B (develop har samme 2), utenfor ordre-scope. Delt kilde forener sidehode+verktøylinje; full forening ville folde chip-border inn også. Chip er en border+bg+text-pill, større konstrukt — egen sak om ønsket.
2. **Polish-tolkning:** redesign fjernet ikke indre `mb-*` rått, men **relokerte margen ut** via ny `className`-prop på SonetonetSidehode (foreldrene mangler ofte `gap`/`space-y` → ren fjerning ville kollapset ytre spacing). Cowork-vurdering: trofast mot intensjonen (ren boks + bevart spacing), riktig kall. Fabel bekrefter det visuelle på test.

### 🟡 Funn (maskin-kontekst) — chip viser PROSJEKT på firma-modul-side (Kenneth 2026-07-23)
`/dashbord/maskin` (firmamodul, «bunnelement» `kreverFirmaModul: "maskin"`) viser PROSJEKT-kontekst i chippen. Rotårsak: `erFirmaKontekst = pathname.startsWith("/dashbord/firma")` (KontekstChip:76) — maskin ligger utenfor prefikset. Pre-eksisterende (gammel Toppbar:50 har samme sjekk), men K3s to-linjers gjør den synlig. **Maskin er eneste firmamodul-avviker** (kompetanse/varelager er under `/dashbord/firma/*`). Fiks: `erFirmaKontekst` gjenkjenner `/dashbord/maskin`. Egen branch `fix/maskin-firmakontekst`, batches med timer-hjem-fiksen.

### 🟡 Funn 2 (#6) — ⇄ hurtigbytte kun på HMS
**Cowork-måling:** `PARBARE_SEKSJONER = new Set(["hms"])`. Mekanismen matcher samme slug på indeks 3. Slugs som finnes som BÅDE firma- og prosjekt-flate med samme navn: **kun `hms` og `timer`.** Timer = triviell utvidelse (én linje). Øvrige seksjoner har ikke samme-slug-motpart (firma/ansatte ↔ prosjekt/mannskap = kryss-konsept, krever eksplisitt mapping + design). → fabel avgjør hvilke kryss-par som fortjener ⇄.

### ✅ Funn 3 (#10) — endre byggeplass krever klikk inn→ut→inn
Bekreftet reell friksjon. Allerede ført i [BACKLOG § Auto-valg sist brukte byggeplass](../BACKLOG.md) (Kenneth 2026-07-22). Ikke ny sak.
