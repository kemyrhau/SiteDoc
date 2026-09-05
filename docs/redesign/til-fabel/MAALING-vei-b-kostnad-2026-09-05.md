# Kostnadsmåling: Vei B — betinget konfigurasjon

**Fra cowork 2026-09-05.** Svar på fabels bestilling i
[`kp-malkvalitet-svar-fabel-2026-09-05.md` § C](../kp-malkvalitet-svar-fabel-2026-09-05.md).
Alt målt mot `origin/develop`.

## Sammendrag

**Kjernen er mindre enn ventet. Én av dine fem premisser er større.**

| Del | Omfang | Merknad |
|---|---|---|
| Delt resolver i `@sitedoc/shared` | **Liten** | `grenseSjekk.ts` er 104 linjer med seks eksporter — riktig form allerede |
| Web-lesere | **Liten** | Kun 2 komponenter |
| Mobil-lesere | **Liten** | Kun 2, speiler web |
| MalBygger-UI for varianter | **Middels** | Ny redigeringsflate — din designsak først |
| **PDF viser kravet som gjaldt** | 🔴 **NY FUNKSJONALITET** | Se under |

## 🔴 Premiss 3 er ikke en tilpasning — PDF viser ikke grenser i det hele tatt

Ditt premiss 3: *«PDF viser kravet som gjaldt: rekonstrueres fra lagret forelder-verdi + malens
varianter via samme resolver.»*

**Målt: `packages/pdf` bruker hverken `formaterGrense`, `normaliserGrense` eller `grenseStatus`.**
Null treff. De eneste `maks`-treffene er `maksbildeHoyde` (bildeskalering) og en `Math.max` i
diff-logikken — urelatert.

**Konsekvens:** en arkiv-PDF viser i dag *målt verdi*, aldri *kravet den ble målt mot*. Å vise
«15 cm (krav: min 15)» er altså ny funksjonalitet, ikke en utvidelse av noe som finnes.

⚠️ **Det er et funn uavhengig av Vei B.** Selv med dagens faste grenser står kravet ingen steder i
det arkiverte dokumentet. En byggherre ser at det ble målt 14 cm, men ikke at kravet var 15.

**Cowork foreslår å skille premiss 3 ut som egen sak** — den har verdi alene, og den binder ikke
Vei B. Ditt kall.

## Målt omfang per del

**Delt kjerne — `packages/shared/src/utils/grenseSjekk.ts` (104 linjer)**

```
Grense (interface) · GrenseStatus (type) · normaliserGrense() · harGrense()
grenseStatus() · formaterGrense()
```

Ditt premiss 2 (én delt resolver ved siden av `normaliserGrense`) passer rett inn. Filen er
liten nok til å utvides uten risiko.

**Lesere — kun FEM steder, og bare TO felttyper**

```
web:   HeltallObjekt.tsx · DesimaltallObjekt.tsx · malbygger/FeltKonfigurasjon.tsx
mobil: HeltallObjekt.tsx · DesimaltallObjekt.tsx
```

🔴 **Grenser gjelder altså kun `integer` og `decimal`.** Det avgrenser Vei B kraftig — vi rører
ikke `list_single`, `traffic_light` eller `text_field`. Alle fem leser allerede
`normaliserGrense(config)`, så inngangspunktet er identisk i hver.

**MalBygger — `FeltKonfigurasjon.tsx`**

Redigerer grenser i dag via `normaliserGrense` + felt for enhet/min/maks, med norsk kanonisk
nøkkelskriving (linje 58: *«Skriv norsk kanonisk grense-nøkkel, fjern engelsk alias»*). Variant-UI
må inn her. **Din designsak før byggeordre** (ditt premiss 5).

## Coworks lesning

**Vei B er mindre enn den så ut**, fordi grenser bare finnes på to felttyper og alle fem leserne
går gjennom samme funksjon. Kjernen + de fire objektkomponentene er én runde.

**Det som gjør den stor er premiss 5 (MalBygger-UI) og premiss 3 (PDF).** Skilles premiss 3 ut,
står Vei B igjen som: delt resolver, fire komponenter, én ny redigeringsflate.

⚠️ **Ikke målt:** hva variant-redigering *bør* se ut som i MalBygger — det er din sak. Og
snapshot-spørsmålet i ditt premiss 3 (malendring etter utfylling) er ikke vurdert her, fordi det
faller bort hvis premiss 3 skilles ut.
