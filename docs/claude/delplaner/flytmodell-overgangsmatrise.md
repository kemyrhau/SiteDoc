---
name: flytmodell-overgangsmatrise
status: 🟡 ARBEIDSDOKUMENT — målt fra kode 2026-07-22, fasit for admin-UI-matrisen. Sprik flagget for fabel/Kenneth
eier: cowork (måling) · fabel (design av admin-UI) · Kenneth (vedtak)
sist_verifisert_mot_kode: 2026-07-22
---

# Flytmodell — overgangsmatrise (målt fra kode)

> Kenneth 2026-07-22: *«jeg trenger en matrise som viser gyldig overgang — mot høyre og mot venstre, samt opp/ned for prosjektadministrator».* Dette er den, målt fra `validTransitions` (`index.ts:88`) + `ROLLE_HANDLINGER` (`statusHandlinger.ts:131`). **Grunnlag for admin-UI-matrisen** (flytmodell-vedtak § 1).

## To lag — hold dem fra hverandre

- **Statusmaskin (fast kode):** *hvilke overganger som ER mulige.* En overgang som ikke står her kan ingen matrise skape (vedtak 1).
- **Rollematrise (config, kommer):** *hvem som får lov* til en overgang som allerede finnes.

## Retnings-legende (linjemodellen)

| Symbol | Retning | Betydning |
|---|---|---|
| ▶ | Framover (mot høyre) | Dokumentet avanserer mot fullført |
| ◀ | Tilbake (mot venstre) | Send tilbake for retting — **kommentar obligatorisk** (P2) |
| ↻ | Arbeidstilstand | Start/gjenoppta arbeid, samme boks |
| ⇅ | Kryssflyt (opp/ned) | `forwarded` — **admin-verktøy**, bytter dokumentflyt, kan målrettes person |
| ■ | Avslutt | Terminal (`cancelled`/`closed`) |
| ↺ | Gjenåpne | Fra terminal tilbake til kladd |

## Matrisen — per status: gyldig overgang · retning · hvem kan i dag

| Fra status | → Til | Retn. | Hvem kan (i dag, kode-målt) |
|---|---|---|---|
| **draft** | sent | ▶ | registrator · bestiller |
| draft | deleted | ■ | registrator · bestiller *(slett egen kladd)* |
| draft | cancelled | ■ | ⚠️ **ingen rolle** — kun admin (`erAdmin`) |
| **sent** | received | ▶ | ⚠️ **ingen rolle** — antatt automatisk ved mottak (verifiser) |
| sent | cancelled | ■ | bestiller |
| **received** | responded | ▶ | utfører |
| received | in_progress | ↻ | ⚠️ **ingen rolle** i ROLLE_HANDLINGER — hvordan startes arbeid? (verifiser) |
| received | cancelled | ■ | ⚠️ **ingen rolle** — kun admin |
| received | forwarded | ⇅ | utfører *(→ skal bli admin-only, vedtak 3)* |
| **in_progress** | responded | ▶ | utfører |
| in_progress | sent | ◀ | utfører *(send tilbake til avsender)* |
| in_progress | cancelled | ■ | ⚠️ **ingen rolle** — kun admin |
| in_progress | forwarded | ⇅ | utfører *(→ admin-only, vedtak 3)* |
| **responded** | approved | ▶ | godkjenner |
| responded | rejected | ◀ | godkjenner *(send tilbake)* |
| responded | forwarded | ⇅ | godkjenner *(→ admin-only, vedtak 3)* |
| **approved** | closed | ▶ | ⚠️ **ingen rolle** — kun admin (matrisen sier «administrator lukker») |
| **rejected** | in_progress | ↻ | utfører *(gjenoppta)* |
| rejected | **sent** | ▶ | **registrator · bestiller** *(«Send på nytt» — vedtak 2, IKKE landet ennå)* |
| rejected | closed | ■ | ⚠️ **ingen rolle** — kun admin |
| **cancelled** | draft | ↺ | ⚠️ **ingen rolle** — kun admin *(gjenåpne)* |
| **closed** | — | | terminal, ingen utgang |

## 🔴 Sprik funnet — må avgjøres i admin-UI-designet

Statusmaskinen tillater **11 overganger som ingen rolle har i `ROLLE_HANDLINGER`** — de fungerer i dag kun fordi admin (`erAdmin`) omgår tabellen. Når matrisen blir config, må hver av disse få en eksplisitt eier, ellers blir de utilgjengelige for ikke-admin:

1. **`sent → received`** — antatt automatisk (systemet, ikke en rolle). Bekreft at det ikke går via `endreStatus`/rollegate.
2. **`received → in_progress`** («start arbeid») — ingen rolle eier den. Hvordan blir et mottatt dokument «under arbeid» i dag? Egen mekanisme eller hull?
3. **`* → cancelled`** (draft/received/in_progress) — kun bestiller på `sent→cancelled`. Hvem kan avbryte fra de andre? *(«trekk tilbake» = cancelled — mål hvem som har den handlingen.)*
4. **`approved → closed`** — «administrator lukker» (matrisen § 2 sier admin). Bekreft at det ER admin-only med vilje.
5. **`rejected → closed`** — gi opp en avvist sak. Admin-only?
6. **`cancelled → draft`** (gjenåpne) — admin-only?

**Ingenting av dette er en bug å fikse nå** — det er kartleggingen admin-UI-matrisen trenger for å ha en default-eier per celle. Fakta-først: dette er dagens tilstand, ikke en anbefaling.

## Prosjektadministrator (opp/ned)

`forwarded` (⇅) er den eneste «opp/ned»-bevegelsen — kryssflyt til en annen dokumentflyt. **Vedtak 3:** flyttes fra utfører/godkjenner til administrator via matrise-defaults. I matrisen over har utfører/godkjenner den i dag; admin-UI-defaulten setter den til kun PROSJ.ADMIN/ADMINISTRATOR.

**Prosjektadministrator har i tillegg alle ▶◀↻■↺-overganger** (via `erAdmin` → full tilgang), men det er *overstyring*, ikke linjebevegelse. I admin-UI-matrisen er PROSJ.ADMIN-kolonnen tom default (vedtak 1) — admin arver alt uten eksplisitte celler.

## Åpne spørsmål til fabel/Kenneth

1. **De 11 eierløse overgangene** (§ Sprik) — hver trenger en default-eier i admin-UI-matrisen. Skal cowork måle «trekk tilbake»/«start arbeid»-mekanismene så vi vet om de går utenom rollegaten, før matrisen designes?
2. **`rejected → sent`** (vedtak 2) er ikke landet ennå — registrator-fiksens komplettering (ordre § 0b) legger den inn. Matrisen over antar den kommer.
3. **`received → in_progress`** uten rolle-eier er det mest mistenkelige — hvis «start arbeid» ikke finnes som handling, mangler flyten et steg. Verdt en dedikert måling.
