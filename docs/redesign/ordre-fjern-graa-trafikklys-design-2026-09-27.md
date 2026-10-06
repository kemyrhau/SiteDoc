---
status: 🔴 TRUKKET 2026-09-27 av Kenneth. Premisset var feil. Erstatter `9ed6c177`, `b0407fe6`, `f351433e`
forfatter: design
trukket_av: Kenneth
erstattet_av: ordre-trafikklys-foreldreloes-verdi-design-2026-09-27.md
---

# 🔴 TRUKKET — «fjern grå fra trafikklyset»

## § 1 Hvorfor den er trukket

**Kenneth 2026-09-27:**

> «du har besluttet basert på en test på hva som brukes i dag → det er ikke rett → du kan ikke vite hva som
> skal brukes i fremtiden. Det har vært behov for 4 trafikklys i andre prosjekter der tilsvarende lys var
> brukt. det eksisterte bare 3 lys.»

🔴 **Ordren hvilte på at `gray` var ubrukt. Det var en måling av fortiden, brukt som beslutning om
fremtiden.** **Regelen som følger av dette: [`bruk-er-ikke-behov.md`](../claude/retningslinjer/bruk-er-ikke-behov.md).**

## § 2 Tre funn som hver alene gjør ordren ugyldig

### 🔴 Funn 1 — premisset var feil

**Kenneth har feltbevis: behovet for fire lys har oppstått i andre prosjekter der bare tre fantes.**
⚠️ **Koden kan ikke se det behovet. Den ser bare hva som ble bygget under forrige begrensning.**

### 🔴 Funn 2 — design brukte motbeviset som bevis

**Seed-en har 22 steder der en mal bygger «ikke aktuelt/relevant» selv som `valg`-opsjon.** Design
argumenterte at behovet dermed var «løst andre steder». ⚠️ **Det er 22 maler som trengte tilstanden og
måtte lage den på nytt. Etterspørsel, ikke fravær.**

### 🔴 Funn 3 — mekanismen var også feil

**Ordren ba om å fjerne `gray` fra META-defaulten i `packages/shared/src/types/index.ts`.**
🔴 **Ingen flate rendrer fra den.** Måling:

| Fil | Rolle |
|---|---|
| `packages/shared/src/standardtekster.ts:141` | `TRAFIKKLYS_VALG` — **den faktiske kilden** |
| `apps/web/.../TrafikklysObjekt.tsx:2` | importerer `TRAFIKKLYS_VALG` |
| `apps/mobile/.../TrafikklysObjekt.tsx` | importerer `TRAFIKKLYS_VALG` |
| `packages/pdf/src/konstanter.ts` | importerer `TRAFIKKLYS_VALG` |
| `packages/db/prisma/seed-bibliotek.ts:163` | `trafikklys()` sender **aldri** `options` |

⚠️ **Alle 79 trafikklys-felt arver fra `TRAFIKKLYS_VALG`. Endringen ordren ba om ville ikke fjernet et
eneste lys fra skjermen.**

## § 3 Hva som overlever

🟢 **Bare del E — fallbacken for foreldreløs verdi.** Den er god uavhengig av `gray`, fordi den gjelder
**enhver** verdi som mister sin opsjon, uansett årsak. **Den er skilt ut som egen ordre:
`ordre-trafikklys-foreldreloes-verdi-design-2026-09-27.md`.**

🔴 **Del A, B og F er døde.** **F var allerede død av annen grunn: endringsvernet i `mal.ts` (2026-09-07)
finnes og dekker `options`.**

## § 4 To åpne spørsmål design IKKE avgjør

### 🟡 4a To kilder for samme sannhet

**`types/index.ts` erklærer trafikklys-opsjoner med literale etiketter. `standardtekster.ts` erklærer dem
med i18n-nøkler.** ⚠️ **Ingen test binder dem sammen** — `pdf-shared-tvilling-paritet.test.ts` dekker
pdf↔shared, ikke types↔standardtekster. **Divergerer de, fanger ingenting det.** 🟡 **Meldt, ikke bestilt.**

### 🟡 4b Kenneths to-trafikklys-idé

**Design frarådet den. Frarådingen hvilte på samme feil som ordren og gjelder ikke lenger.**

🟢 **Målingen peker på en tredje vei som er bedre enn to typer:** **komponenten hardkoder i dag
`TRAFIKKLYS_VALG` og ignorerer `config.options`.** **Leser den `config.options` med `TRAFIKKLYS_VALG` som
fallback, blir «trafikklys med tre lys» bare en mal som lister tre opsjoner** — **én type, fire tilstander
tilgjengelig, hver mal velger sitt utvalg.** ⚠️ **Ingenting fjernes, og ingen ny type oppstår.**

🔴 **Design bestiller ikke dette. Det er Kenneths valg.**
