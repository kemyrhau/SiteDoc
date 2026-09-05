# Nå-rapport: SJA-signaturmodell — målt kostnad og ett funn som endrer schemaet

**Fra cowork 2026-09-05, natt. Svar på fabels bestilling i `sja-signaturer-laasutloser-fabel-2026-09-05.md`.**
Alle tall er målt i `develop`, ikke anslått.

---

## 🔴 Funn 1: «ingen migrering på dokumenttabellen» går ikke opp — SJA er `Checklist`, RUH er `Task`

Modellen forutsetter at `SignaturRunde` peker på «dokumentet». Men det finnes ikke ett dokument-bord:

| Dokumenttype | Tabell | Målt |
|---|---|---|
| SJA | `Checklist` | `hms.ts:246` — `template.domain="hms", subdomain="sja"` |
| Avvik | `Task` | `hms.ts:411` |
| RUH | `Task` | `hms.ts:265` — malen har `category="oppgave"` |

En Prisma-relasjon kan ikke peke på to tabeller. Det gir to veier:

### Vei 1 — svakt `dokumentId` + `dokumentType` (uten `@relation`)

Etablert mønster i `db-maskin` for kryss-pakke-FK. **Men her er begge tabellene i samme
schema**, så mønsteret brukes utenfor sin begrunnelse.

🔴 **Konsekvens som ikke er teoretisk: ingen cascade.** Slettes en SJA, blir runder,
signaturer og deltakere liggende igjen som foreldreløse rader. Papirkurv-logikken
(`papirkurv.ts:37`) rører dem ikke. Sletting må da håndteres manuelt i koden — og
sletteregelen for HMS er allerede vedtatt (kun som utkast), så feilen ville vært stille.

### Vei 2 — to nullbare FK-er: `checklistId?` + `taskId?` ✅ coworks anbefaling

```prisma
checklistId String?  @map("checklist_id")
taskId      String?  @map("task_id")
checklist   Checklist? @relation(fields: [checklistId], references: [id], onDelete: Cascade)
task        Task?      @relation(fields: [taskId], references: [id], onDelete: Cascade)
```

- Cascade gratis — sletting rydder seg selv
- Referanseintegritet i databasen, ikke i koden
- Koster: én `@relation`-linje på `Checklist` og på `Task` — **altså en migrering på
  dokumenttabellene likevel, men kun som bakover-relasjon.** Ingen kolonne legges til der.

**Cowork anbefaler vei 2.** Prisen er en tilbake-relasjon; gevinsten er at ingen fremtidig
sletteregel kan etterlate signaturdata i limbo. På et HMS-dokument er det forskjellen på
sporbar og rotete.

⚠️ **DB-endring krever Kenneths godkjenning uansett vei.** Meldes med ordren.

---

## 🟢 Funn 2: manko-chippen i lista er ÉN spørring — min N+1-bekymring holder ikke

Jeg flagget 04.09 at `4/6` per rad i SJA-lista ville kreve per-rad-aggregering. **Målt: den
gjør ikke det.** Prisma 6.3 støtter nøstet `take: 1` med `orderBy` og filtrerte
relasjonstellinger i samme `select`:

```ts
signaturRunder: { take: 1, orderBy: { rundeNr: "desc" },
                  select: { rundeNr: true, avsluttetAt: true,
                            _count: { select: { signaturer: true } } } },
_count: { select: { deltakere: { where: { fjernet: null } } } },
```

Én spørring, ingen løkke. Legges inn i `CHECKLIST_SELECT` som `hms.ts` allerede bruker.

🔴 **Én presisjon:** telleren over er *deltakere aktive nå*, ikke *deltakere aktive da runden
gikk*. For en åpen runde er det riktig. For en avsluttet runde vil den drifte hvis noen
fjernes etterpå. **Anbefaling: frys `antallDeltakere` på `SignaturRunde` ved «Avslutt runde».**
Samme prinsipp som PSI allerede bruker med `psiVersion` — snapshot ved signering, ikke
live-oppslag.

---

## 🟢 Funn 3: `PsiSignatur` er et bedre forbilde enn antatt — én linje bærer hele versjonssaken

```ts
gjeldende: s.psiVersion === psi.version    // psi.ts:423
utdatert:  signatur.psiVersion < psi.version // psi.ts:449
```

Runde-modellen får dette gratis: en signatur i runde 3 er per definisjon gjeldende når
gjeldende runde er 3. **Ingen versjonskolonne trengs** — rundenummeret ER versjonen.

Det er en forenkling mot PSI, ikke en kopi.

---

## Kostnad: Signaturliste-objektet (`signature_list`)

Målt antall berøringspunkter for én ny felttype:

| # | Fil | Hva |
|---|---|---|
| 1 | `packages/shared/src/types/index.ts:40` | typeunionen |
| 2 | `packages/shared/src/standardtekster.ts:79` | navnekonvensjon (`signature` ligger der) |
| 3 | `packages/pdf/src/felt.ts:131` | PDF-rendring |
| 4 | `apps/web/.../RapportObjektVisning.tsx:375` | lesevisning |
| 5 | ny `apps/web/.../rapportobjekter/SignaturListeObjekt.tsx` + rendererens switch | web utfylling |
| 6 | ny mobil-komponent + `index.ts` + renderer-switch | mobil utfylling |
| 7 | `MalBygger.tsx:1228` + `FeltPalett.tsx:34` | malbygger + PSI-palett |
| 8 | `sjekklister/page.tsx:97,169` + `oppgaver/page.tsx:110,183` | kolonne-sett, 2 filer × 2 steder |
| 9 | `TILBEHOR_REN_FJERNING` × 2 renderere | tilbehør av |

**≈12 filer.** Sammenlignbart med hva `weather` og `quiz` kostet. **Ikke en stor endring** —
felttype-arkitekturen tåler dette.

⚠️ **Drift målt underveis, utenfor din bestilling:** `TILBEHOR_REN_FJERNING` har **fire**
typer i web og **fem** i mobil (`weather` ekstra). Dokgen skal akkurat legge `signature` inn i
begge. Meldes som eget funn — ikke ordre-blokkerende.

---

## API-flate som følger

Nye prosedyrer i `hms.ts` eller egen `signatur.ts`: `startRunde` · `avsluttRunde` · `signer`
(bruker+gjest) · `hentRunder` · `deltakerLeggTil`/`deltakerFjern` · `hentManko`.
Speiler `psi.ts:hentSignaturer`/`hentMinStatus` — mønsteret finnes.

---

## Coworks kall til ordren

1. **Vei 2 (to nullbare FK-er)** — anbefalt, krever Kenneth-godkjenning på migreringen
2. **`antallDeltakere` fryses ved «Avslutt runde»** — ellers drifter historiske runder
3. **Ingen versjonskolonne** — rundenummeret bærer den
4. **Manko-chippen er billig** — min tidligere bekymring er avkreftet, bygg den

Ordre kan skrives på dette.

— cowork
