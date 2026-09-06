# Nå-rapport: grense-resolveren — begge premisser målt, ett funn blokkerer

**Fra cowork 2026-09-06. Svar på kost-sjekken i
`designnotat-malbygger-grensevarianter-fabel-2026-09-06.md § Enkeltmålt`.**

## 🟢 Premiss 1 — repeater-rader: HOLDER, ingen ny plumbing

> *«Resolveren må få RADENS verdisett, ikke dokumentets — verifiser at utfyllingslaget kan gi
> forelder-verdi per rad på begge flater.»*

**Målt:** `apps/web/src/components/rapportobjekter/RepeaterObjekt.tsx:17` og `:31`:

```ts
const pos = posBarn ? (rad.felter[posBarn.id]?.verdi as …
```

Radens verdisett er **allerede tilgjengelig der barna rendres**. Radformen er
`{ _radId, felter }` (rad-id-vedtaket 2026-08-22), og `felter` er et
`Record<barnId, FeltVerdi>`.

🟢 **Resolveren kan få `rad.felter` som kontekst uten å endre noe i utfyllingslaget.**
Kandidatregelen din — «samme forelder, lavere sortOrder» — kan evalueres innenfor raden ved å
slå opp det styrende barnets id i samme `felter`-map.

⚠️ **Én presisering til ordren:** signaturen `løsGrense(objekt, forelderVerdi)` tar **verdien**,
ikke konteksten. Det er riktig og holder for begge tilfeller — kallstedet henter verdien fra
`rad.felter[styrendeId].verdi` i repeater, og fra `hentFeltVerdi(styrendeId).verdi` på rot.
**Resolveren trenger ikke vite om den står i en rad.**

---

## 🔴 Premiss 2 — variant-matching: BLOKKERER. Fire kopier av `normaliserOpsjon`

> *«Variant-matching når options er `{label, value}`-objekter (normaliserOpsjon begge sider).»*

**Resolverkontrakten din krever `normaliserOpsjon` fra `@sitedoc/shared`.** Den finnes ikke der.
Målt — **fire uavhengige implementasjoner:**

| # | Sted | Form |
|---|---|---|
| 1 | `apps/web/src/components/rapportobjekter/typer.ts:142` | eksportert |
| 2 | `packages/pdf/src/hjelpere.ts:63` | eksportert (bevisst tvilling — null-avhengigheter) |
| 3 | `apps/mobile/.../EnkeltvalgObjekt.tsx:7` | **lokal funksjon i komponentfila** |
| 4 | `apps/mobile/.../FlervalgObjekt.tsx:8` | **lokal funksjon i komponentfila** |

🔴 **Resolveren kan ikke bygges over dette.** Den skal være «eneste inngang for web-utfylling,
mobil-utfylling og PDF-oppslagsbyggeren» — men en delt resolver i `@sitedoc/shared` kan ikke
importere fra `apps/web`, og de fire kopiene kan drive fra hverandre i morgen.

**Verre: matcher resolveren med én normalisering mens en flate viser opsjonene med en annen,
løses grensen mot en verdi brukeren ikke ser.** Det er stille feil i et dokument byggherren
mottar.

### Coworks anbefaling — trinn 0 i ordren, før resolveren

**Trekk `normaliserOpsjon` til `@sitedoc/shared`.** Web og mobil importerer den. PDF beholder
sin tvilling (null-avhengighetsregelen) — **men den skal ha paritetstest**, akkurat som
`signaturVerdi`-tvillingen fikk i `85c8ecd5`.

**Kostnaden er liten:** én flytting, fire kallsteder, én paritetstest. **Gevinsten er at
resolveren har ett sannhetsbegrep om hva en opsjon er** — som er hele forutsetningen for at
variant-matching kan stoles på.

⚠️ **Dette er fjerde gang på ett døgn samme klasse dukker opp:** tre kopier av
endringslogg-generatoren (`315f2515`), to TILBEHOR-sett (`85c8ecd5`), PDF-tvillingen uten vakt
(`53890c1b`) — og nå fire opsjons-normaliseringer. **Klassen er ikke tilfeldig:** delt logikk
som ble skrevet i en komponent først, og kopiert da neste flate trengte den.

---

## Konsekvens for ordren

Cowork skriver ordren med **fire trinn**, ikke tre:

| Trinn | Hva |
|---|---|
| **0** | `normaliserOpsjon` → `@sitedoc/shared` + paritetstest mot PDF-tvillingen |
| **1** | Resolveren `løsGrense` i `@sitedoc/shared` + `kravType` i config |
| **2** | MalBygger-UI: kravtype-nedtrekk, kvitteringslinje, varianttabell (mockupen er fasit) |
| **3** | DG — PDF viser grensekrav via `grenseOppslag` + avviksfelt ved brudd |

**Ingenting av dette endrer designlåsen din.** Trinn 0 er en forutsetning designet ditt allerede
antok var på plass.

— cowork
