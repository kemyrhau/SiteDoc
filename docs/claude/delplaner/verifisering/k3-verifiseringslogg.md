---
name: k3-verifiseringslogg
status: 🟡 KLOSS 1+2 TESTET (Kenneth, test 2026-07-22) — kjerne bestod, én reell regresjon (trunkering) + to oppfølgere
eier: Kenneth (test) · cowork (måling + triage) · fabel (design-call)
sist_verifisert_mot_kode: 2026-07-22
---

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

**✅ LØST (Kenneth-forslag + fabel-gate 2026-07-22) → kloss 2c:** to-linjers topplinje (prosjektkontekst: Firma / Prosjekt · Byggeplass; firmakontekst: kun Firma), SD-nummer droppet. Grammatikk + reverserings-føring i [k3-ordre § Kloss 2c](../k3-ordre.md). Lander med kloss 3.

### 🟡 Funn 2 (#6) — ⇄ hurtigbytte kun på HMS
**Cowork-måling:** `PARBARE_SEKSJONER = new Set(["hms"])`. Mekanismen matcher samme slug på indeks 3. Slugs som finnes som BÅDE firma- og prosjekt-flate med samme navn: **kun `hms` og `timer`.** Timer = triviell utvidelse (én linje). Øvrige seksjoner har ikke samme-slug-motpart (firma/ansatte ↔ prosjekt/mannskap = kryss-konsept, krever eksplisitt mapping + design). → fabel avgjør hvilke kryss-par som fortjener ⇄.

### ✅ Funn 3 (#10) — endre byggeplass krever klikk inn→ut→inn
Bekreftet reell friksjon. Allerede ført i [BACKLOG § Auto-valg sist brukte byggeplass](../BACKLOG.md) (Kenneth 2026-07-22). Ikke ny sak.
