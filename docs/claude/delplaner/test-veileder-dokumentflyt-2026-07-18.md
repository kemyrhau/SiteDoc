---
name: test-veileder-dokumentflyt-2026-07-18
status: 🟢 TEST-VEILEDER — utføres av web-Opus, analyseres av cowork
sist_verifisert_mot_kode: 2026-07-18
kilde: isValidStatusTransition + ROLLE_HANDLINGER + handlingsmatrise-maalt-2026-07-17.md
---

# Test-veileder — dokumentflyt-statuser (strukturell)

> **Formål:** flytstatusene har aldri vært testet strukturelt. Denne veilederen kjører hver statusovergang minst én gang med **forventet utfall** utledet fra statusmaskinen, så cowork kan lete etter **avvik** (faktisk ≠ forventet), ikke gjette.
>
> **Arbeidsdeling:** web-Opus klikker nøyaktig per steg + kaptrer skjermbilder. Cowork analyserer skjermbilder + tidslinje mot forventet-kolonnen. **Forutsetning: cowork vet hva som ble klikket** — derfor er hvert steg eksakt.
>
> **Miljø:** test.sitedoc.no, innlogget som Kenneth (admin/registrator — ser ALLE handlinger, så rollefiltrering testes separat i del B).

## Fasit — statusmaskinen (forventet)

| Fra | Lovlige overganger | Badge |
|---|---|---|
| `draft` | `sent`, `cancelled` | Utkast |
| `sent` | `received`, `cancelled` | Sendt |
| `received` | `in_progress`, `responded`, `cancelled` | Mottatt |
| `in_progress` | `responded`, `sent`, `cancelled` | Under arbeid |
| `responded` | `approved`, `rejected` | Besvart |
| `approved` | `closed` | Godkjent |
| `rejected` | `in_progress`, `closed` | Avvist |
| `cancelled` | `draft` | Avbrutt |
| `closed` | — (terminal) | Lukket |

`forwarded` og `deleted` er **ikke statuser** — `forwarded` bytter mottaker og beholder status; `deleted` sletter.

## Per steg kaptreres

1. **Menyen FØR klikk** (hele handlingsraden — hvilke knapper/nedtrekk finnes).
2. **Klikk** (veilederen sier eksakt hva).
3. **Statusbadgen ETTER** (øverst ved tittelen).
4. **«Venter på: X»** hvis synlig.
5. **Øverste tidslinje-rad** (fra→til, hvem→hvem, kommentar).

Rapporter per steg: «Steg N: klikket [X], badge ble [Y], venter på [Z]» + skjermbilde. Cowork sammenligner med forventet.

---

## Del A — happy path (draft → closed)

Opprett en **ny sjekkliste** på en mal med dokumentflyt (f.eks. KB2). Start i `draft`.

| Steg | Start | Klikk | Forventet status | Forventet mottaker |
|---|---|---|---|---|
| A1 | draft | primærknapp **Send** → velg faggruppe | **Sendt** | valgt faggruppe |
| A2 | sent | (bytt til mottaker-rolle / admin ser alt) **Besvar** | **Besvart** | avsender |
| A3 | responded | **Godkjenn** | **Godkjent** | — |
| A4 | approved | **Lukk** (2-klikk, bekreft) | **Lukket** | — |
| A5 | closed | *ingen handlinger* — verifiser at meny er tom/terminal | — | — |

**Forventet avvik-flagg:** A4 skal kreve 2 klikk (bekreftelse) — closed er irreversibel. A1–A3 skal være 1 klikk.

## Del B — send-tilbake-loop (den Kenneth fant)

Ny sjekkliste, bring til `responded` (A1→A2).

| Steg | Start | Klikk | Forventet status | Merk |
|---|---|---|---|---|
| B1 | responded | **Send tilbake** | **Avvist** (`rejected`) | ⚠️ KJENT: badge «Avvist» leser hardt for en transient tilbakesending. Ikke nytt avvik — bekreft at det fortsatt skjer |
| B2 | rejected | **Gjenoppta** | **Under arbeid** (`in_progress`) | A-i: veien rejected→in_progress |
| B3 | in_progress | **Besvar** | **Besvart** | tilbake i løkka |
| B4 | responded | **Godkjenn** | **Godkjent** | løkka lukkes |

**Se spesielt etter:** går B1→B2→B3 uten at noe henger? Oppdateres badgen ved hvert steg? (Kenneth så badge-treghet ved videresend — sjekk om det gjelder her også.)

## Del C — avbryt + gjenåpne

| Steg | Start | Klikk | Forventet status |
|---|---|---|---|
| C1 | sent (ny, send fra draft) | **Trekk tilbake** | **Avbrutt** (`cancelled`) |
| C2 | cancelled | **Gjenåpne** | **Utkast** (`draft`) |
| C3 | cancelled | **Slett** (2-klikk) | dokument slettet |

**Forventet avvik-flagg:** «Trekk tilbake» skal være **knapp** på `sent` (Kenneths opprinnelige funn), ikke begravd. C3 skal kreve 2 klikk.

## Del D — videresend (status uendret, mottaker endres)

Ny sjekkliste i `received` (send fra draft, la admin motta).

| Steg | Start | Klikk | Forventet status | Forventet mottaker |
|---|---|---|---|---|
| D1 | received | **Send ▾** → faggruppe A | **Mottatt** (uendret!) | faggruppe A |
| D2 | received | **Send ▾** → faggruppe B | **Mottatt** (uendret!) | faggruppe B |

**⚠️ KJENT BUG å bekrefte:** status skal IKKE endres (forwarded er ikke en status). Men «Venter på: X» skal oppdateres fra A til B — **Kenneth så at den ikke gjorde det.** Bekreft: endrer «Venter på» seg mellom D1 og D2, eller står den fast? Tidslinjen skal vise begge videresendingene uansett.

## Del E — deaktiverte handlinger (rollefiltrering)

Krever en **ikke-admin-bruker** i en spesifikk rolle (utfører/godkjenner). Hvis bare admin er tilgjengelig, hopp over E og noter det.

| Steg | Status | Rolle | Forventet: hva er deaktivert + begrunnelse |
|---|---|---|---|
| E1 | received | utfører | «Avvis» deaktivert → «Kun administrator» (eierløs handling) |
| E2 | responded | bestiller | «Godkjenn»/«Send tilbake» deaktivert → «Kun godkjenner» |
| E3 | closed | enhver | alt deaktivert → «Dokumentet er lukket» |

**Se etter:** at begrunnelsen navngir riktig rolle (ikke «Du er ikke avsender» der det egentlig er «Kun godkjenner»).

---

## Kjente saker — IKKE flagg som nye

1. **Videresend endrer ikke status** (by-design) + «Venter på»-refresh henger (A-3b-funn).
2. **«Send tilbake» → «Avvist»** — statusmodell-navnekollisjon (fabel-beslutning).
3. **`received → in_progress`** («start arbeid») tilbys ikke i UI — bevisst ubygget.

## Forventet output

Web-Opus: én rapport med skjermbilde + observasjon per steg (A1–E3). Cowork committer den til `docs/claude/delplaner/` og analyserer mot forventet-kolonnene. **Nye avvik** = faktisk ≠ forventet som IKKE står i «Kjente saker». Mates til fabels A-3b/statusmodell-beslutning.
