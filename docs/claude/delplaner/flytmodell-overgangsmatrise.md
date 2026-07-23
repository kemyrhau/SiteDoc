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
| **received** | responded | ▶ | utfører *(«besvar»)* |
| received | ~~in_progress~~ | ↻ | 💀 **DØD** — ingen handler setter `in_progress` fra received. Vestigiell overgang i statusmaskinen |
| received | cancelled | ■ | ⚠️ kun admin *(«avvis» i menyen, men ingen rolle i ROLLE_HANDLINGER)* |
| received | forwarded | ⇅ | utfører *(→ skal bli admin-only, vedtak 3)* |
| **in_progress** | responded | ▶ | utfører |
| in_progress | sent | ◀ | utfører *(send tilbake til avsender)* |
| in_progress | cancelled | ■ | ⚠️ kun admin |
| in_progress | forwarded | ⇅ | utfører *(→ admin-only, vedtak 3)* |
| **responded** | approved | ▶ | godkjenner |
| responded | rejected | ◀ | godkjenner *(send tilbake)* |
| responded | forwarded | ⇅ | godkjenner *(→ admin-only, vedtak 3)* |
| **approved** | closed | ▶ | **bestiller** *(+ admin)* — matrisen § 2 «administrator lukker», men bestiller eier den også i dag |
| **rejected** | in_progress | ↻ | utfører *(gjenoppta)* |
| rejected | **sent** | ▶ | **registrator · bestiller** *(«Send på nytt» — vedtak 2, IKKE landet ennå)* |
| rejected | closed | ■ | ⚠️ kun admin |
| **cancelled** | draft | ↺ | **bestiller** *(+ admin)* — gjenåpne |
| **closed** | — | | terminal, ingen utgang |

## Sprik funnet — dybdemåling 2026-07-22 (mye mindre enn først antatt)

Første utkast sa «11 eierløse overganger». **Feil — bestiller eier flere enn jeg fanget.** Rettet bilde:

**Automatisk / systemet (ikke en rolle, korrekt):**
- **`sent → received`** — kollapser automatisk ved send (`sjekkliste.ts:924`: `nyStatus === "sent" ? "received"`). «sent» er momentan. Ikke et hull.

**💀 Død overgang (verdt å rydde, ikke nå):**
- **`received → in_progress`** — i statusmaskinen, men **ingen handler setter `in_progress` fra received**, og menyen tilbyr ingen «start arbeid». `in_progress` nås kun via `rejected→in_progress`. Vestigiell. Egen opprydnings-sak (samme død-kode-mønster som resten av dagen).

**Genuint kun-admin i dag (4 celler — trenger default-eier i admin-UI):**
- `draft → cancelled` · `received → cancelled` · `in_progress → cancelled` — mid-flow avbryt. «Avvis»/«trekk tilbake» vises i menyen, men ingen ikke-admin-rolle har dem i `ROLLE_HANDLINGER`. **Klient/server-divergens:** menyen tilbyr, serveren avviser for ikke-admin.
- `rejected → closed` — gi opp en avvist sak.

**Eid av bestiller (IKKE admin-only — første utkast tok feil):**
- `approved → closed` (lukk) · `cancelled → draft` (gjenåpne) · `sent → cancelled` (trekk tilbake) — alle på bestiller.

**Konklusjon:** ikke 11 hull, men **4 kun-admin-celler + 1 død overgang.** Det er kartet admin-UI-matrisen trenger. Fakta-først: dagens tilstand, ikke anbefaling.

## Prosjektadministrator (opp/ned)

`forwarded` (⇅) er den eneste «opp/ned»-bevegelsen — kryssflyt til en annen dokumentflyt. **Vedtak 3:** flyttes fra utfører/godkjenner til administrator via matrise-defaults. I matrisen over har utfører/godkjenner den i dag; admin-UI-defaulten setter den til kun PROSJ.ADMIN/ADMINISTRATOR.

**Prosjektadministrator har i tillegg alle ▶◀↻■↺-overganger** (via `erAdmin` → full tilgang), men det er *overstyring*, ikke linjebevegelse. I admin-UI-matrisen er PROSJ.ADMIN-kolonnen tom default (vedtak 1) — admin arver alt uten eksplisitte celler.

## ✅ Alle tre spørsmål BESVART (Kenneth-vedtak 2026-07-22 kveld)

Se [flytmodell-vedtak-2026-07-22.md § Restvedtak](flytmodell-vedtak-2026-07-22.md) + [terminologi.md § Flytspråket](../terminologi.md).

1. **Kun-admin-cellene:** `draft/received/in_progress → cancelled` = **bestiller + admin**, alltid med kommentar + bekreftelsesdialog («Farlig sone»). `rejected → closed` forblir **kun admin**. Verbet er **«Lukk»** (badge bærer årsak «Lukket · trukket»), ikke «avbryt».
2. **Klient/server-divergensen:** løses av matrise-kilden + ordboken samlet. Menytekstene «avvis»/«trekk tilbake» var dobbelt feil (server avviser + ordene reservert til annet). Ordboken låser verbene.
3. **Død overgang `received → in_progress`:** **GJENOPPLIVES som automatikk** — «Pågår» settes automatisk når utfører først åpner dokumentet, drevet av lesekvittering-mekanismen. Ingen «Start arbeid»-knapp. Overgangen beholdes, ingen manuell rolle-oppføring.

**Ny overgang vedtatt i tillegg:** `closed → draft` («Gjenåpne» fra fullført-lukket) — landes sammen med `rejected → sent`.

## Historikk — spørsmålene (relayet til fabel 2026-07-22, nå besvart)

1. **4 kun-admin-celler** (draft/received/in_progress → cancelled, rejected → closed): skal noen ikke-admin-rolle eie dem i admin-UI-defaulten, eller er «kun admin avbryter/lukker mid-flow» det ønskede? Cowork-anbefaling: bestiller bør eie `* → cancelled` (hun kan alt trekke tilbake fra `sent`) — men det er et designvalg.
2. **Klient/server-divergensen** på «avvis»/«trekk tilbake»: menyen viser handlingene på received/in_progress, men serveren avviser for ikke-admin. Skal menyen skjule dem (matche serveren), eller skal rollene få dem? Løses av admin-UI-matrisen uansett.
3. **`received → in_progress` (død):** rydd bort fra statusmaskinen, eller gjenoppliv med en «start arbeid»-handling? Hvis flyten skal ha et eksplisitt «utfører har begynt»-steg, mangler det i dag.
4. **`rejected → sent`** (vedtak 2): ikke landet — registrator-fiksens komplettering (ordre § 0b) legger den inn. Matrisen antar den kommer.
