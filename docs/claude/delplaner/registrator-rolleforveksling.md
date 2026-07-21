---
name: registrator-rolleforveksling
status: 🔴 MODELLFEIL — sikkerhetsnær. Kenneth-presisert 2026-07-21. Ikke rettet, krever fabel-gate
eier: Kenneth (domenesannhet) · fabel (modell + A-3b-konsekvens) · cowork (måling)
sist_verifisert_mot_kode: 2026-07-21
---

# `registrator` — rettigheten går motsatt vei av domenemodellen

> **Kenneth 2026-07-21:** *«registrator: den som registrerer en oppgave ute på byggeplass. Admin på kontoret er noe annet — han må også kunne være registrator i den forstand at han oppretter et dokument i en dokumentflyt slik at ansatte kan utføre oppgaven.»*
>
> **Kenneths presisering av defektets retning:** *«"Admin har alltid registrator-rolle" — men dette er ok, dette er ikke feil. Registrator er ikke en administrator.»*

## Defektet, presist

Implikasjonen skal gå **én vei**. I dag går den begge:

| Implikasjon | Vurdering |
|---|---|
| admin → har registrator-rolle | ✅ **Riktig.** Admin oppretter dokumenter. Ikke rør denne |
| registrator → får admin-rettigheter | ❌ **Feil.** Feltarbeideren som registrerer er ikke administrator |

## Kodemåling (cowork 2026-07-21)

**Rollen er tildelbar i vanlig UI** — `apps/web/src/app/dashbord/oppsett/produksjon/dokumentflyt/page.tsx:460` lister `registrator` først i rollerekkefølgen. Den er altså ikke en intern markør; den settes på ekte flytmedlemmer. (Bekreftet i prod-data: kmy hadde rolle `registrator` i «A.Markussen Ansatte».)

**Fire steder gir registrator admin-makt:**

| Sted | Kode | Virkning |
|---|---|---|
| `flytRolle.ts:179` | `if (erAdmin \|\| minRolle === "registrator") return "admin"` | Full dokumentrettighet — forbi ballinnehav, terminale statuser og gruppetillatelser |
| `statusHandlinger.ts:85` | `if (rolle === "registrator") return alle` | Ser alle statushandlinger i menyen |
| `statusHandlinger.ts:105` | `if (rolle === "registrator") return true` | **Serverens rollevalidering** — passerer alle statusoverganger |
| `flytRolle.ts:37` | `ROLLE_PRIORITET.registrator = 4` | Høyeste prioritet ved flertreff — over `godkjenner` (3) |

**Alvorlighet:** `erTillattForRolle` (`:105`) er dokumentert som *«brukes av backend for API-rollevalidering»*. En ikke-admin med `registrator`-rolle passerer derfor **alle** statusoverganger server-side. Det er ikke et visningsproblem.

**Personvern-konsekvens:** kombinert med [hms-domenemodell.md](../hms-domenemodell.md) betyr det at en registrator på HMS-flyten får full tilgang til private RUH-er — stikk i strid med vernet Kenneth låste samme dag.

## Den tekniske knuten — hvorfor dette ikke er en enkel sletting

`utledMinRolle` (`flytRolle.ts:62`) mapper **admin → "registrator"**. Begge statushandling-funksjonene tar **kun** `rolle` som inndata:

```
hentRolleFiltrertHandlinger(status, rolle)          ← ingen erAdmin
erTillattForRolle(rolle, gjeldendStatus, nyStatus)  ← ingen erAdmin
```

«registrator» er altså i dag **admins eneste kanal** inn i disse funksjonene. Strykes registrator-grenen uten videre, **mister admin sine rettigheter**.

**Rekkefølgen er derfor gitt:** gi admin en egen kanal FØR registrators makt fjernes. Ikke omvendt, og ikke samtidig uten at begge deler er dekket av tester.

## Fikse-skisse (ikke vedtatt — fabel gater)

1. `hentRolleFiltrertHandlinger` og `erTillattForRolle` tar `erAdmin: boolean` som eksplisitt parameter.
2. `rolle === "registrator"`-grenene byttes til `erAdmin`.
3. `flytRolle.ts:179` blir `if (erAdmin) return "admin"` — registrator-disjunktet strykes.
4. `ROLLE_PRIORITET.registrator` revurderes: skal en oppretter ha høyere prioritet enn `godkjenner` ved flertreff? Sannsynligvis ikke.
5. `utledMinRolle:62` (admin → registrator) kan **beholdes** — den er per Kenneth ikke feil, og blir harmløs når makten kommer fra `erAdmin`.

**Testkrav:** matrisen i `tilgangsmatrise.test.ts` utvides med rader for ikke-admin registrator på hver relevante status. Kollisjonen skal være umulig å gjeninnføre.

## Omtolkning av et tidligere funn

**A-3a Del E** (2026-07-18) så ut til å feile fordi testbrukeren var `registrator` og oppførte seg som superbruker. Det ble avskrevet som forventet oppførsel, og saken lukket.

**Det var ikke forventet oppførsel — det var dette defektet.** Symptomet ble forklart bort i stedet for at årsaken ble sett. Del E bør regnes som **ikke reelt verifisert** for registrator-tilfellet.

## Konsekvens for A-3b (pågående)

A-3bs perspektivmatrise har en egen **REGISTRATOR-kolonne** bygget på premisset at registrator er superbruker (`perspektivEtikett.ts`, `utledPerspektiv` — registrator dominerer ballinnehav). Matrisen er fabel-gatet.

**Endres rollemodellen, må matrisen revideres.** Rekkefølge må avklares: enten lukkes A-3b først på dagens modell og revideres etterpå, eller så stanses A-3b til rollemodellen er avgjort. **Fabel eier den avveiningen.**

## Åpne spørsmål til fabel

1. Hva **skal** en registrator kunne gjøre? Kun opprette, eller også følge dokumentet videre?
2. Hvor plasseres registrator i `ROLLE_PRIORITET` når den ikke lenger er superbruker?
3. A-3b: lukk først eller stans nå?
