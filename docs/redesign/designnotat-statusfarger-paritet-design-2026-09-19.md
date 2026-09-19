# Designnotat: én fargetabell for dokumentstatus — web og mobil

**Fra:** design · **Til:** Kenneth-gate · **Dato:** 2026-09-19
**Status:** 🟡 TIL KENNETH-GATE — to spørsmål i § 5
**Grunnlag:** DESIGNSYSTEM-AUDIT-2026-09-17 § 4 og § 6 pkt 1 · `ui-standarder.md § Feltstatus` (gul = «noen må ta stilling»)

---

## 1. Problemet, målt på develop 2026-09-19

Status-merkelappene finnes i **fire kilder** som ikke er enige:

| Status | Web liste (`packages/ui/status-badge.tsx`) | Web detalj, nøytral (`perspektivEtikett` NOEYTRAL) | Web detalj, «din tur» (BASE_AKTIV) | Mobil overalt (`StatusMerkelapp` STATUS_MAP) |
|---|---|---|---|---|
| draft | grå · Utkast | grå · Utkast | grå | grå · Utkast |
| sent | blå · Sendt | blå · Sendt | – | blå · Sendt |
| received | blå · Mottatt | blå · Mottatt | **gul** · Til behandling | **indigo** · Mottatt |
| in_progress | blå · **Mottatt** | blå · **Under arbeid** | **gul** · Under arbeid | **indigo** · Mottatt |
| responded | **gul** · Besvart | blå · Besvart | **gul** · Til godkjenning | **lilla** · Besvart |
| approved | grønn | grønn | grønn | grønn |
| rejected / dismissed | rød | rød | – | rød |
| closed | grå | grå | grå | grå (mørkere) |
| cancelled | rød | rød | rød | rød |

**Tre brudd:**
1. **Mobil har egne farger** (indigo, lilla) som ikke finnes på web, og bruker ikke `perspektivEtikett` i det hele tatt.
   Pilotens mobilbrukere ser aldri «din tur»-markeringen som web viser. `perspektivEtikett` er skrevet som delt kilde
   for web **og mobil** («mobil importerer shared») — mobil tok den bare aldri i bruk.
2. **Web er uenig med seg selv om `responded`:** gul i lista, blå i detaljen (nøytral).
3. **Web er uenig med seg selv om navnet på `in_progress`:** «Mottatt» i lista, «Under arbeid» i detaljen. Se § 5.

## 2. Fargespråket — fem familier, én betydning hver

| Farge | Betyr | Statuser |
|---|---|---|
| **Grå** | Ikke i gang, eller avsluttet | Utkast, Lukket |
| **Blå** | I flyt — ballen er hos noen andre | Sendt, Mottatt, Besvart, Under arbeid (når du venter eller ser nøytralt) |
| **Gul** | **Din tur** — du må ta stilling | Til behandling, Under arbeid, Til godkjenning (når ballen er din) |
| **Grønn** | Godkjent / ferdig | Godkjent |
| **Rød** | Avvist eller avbrutt | Avvist, Avbrutt |

**Gul betyr bare «din tur».** Det er samme betydning som feltstatus-standarden gir gult (noen må ta stilling). En status
som er gul for alle — slik `responded` er i weblista i dag — bryter det, fordi den sier «din tur» til folk som bare venter.

**Indigo og lilla utgår.** De sier ingenting de fem familiene ikke allerede sier.

## 3. Én kilde, to visninger

| Visning | Hvor | Kilde |
|---|---|---|
| **Nøytral** — samme for alle | Lister, filterknapper, tidslinjer | `perspektivEtikett`s nøytrale kolonne (NOEYTRAL) |
| **Personlig** — din tur gul | Dokumentets detaljside | `perspektivEtikett` med seerens rolle (som web gjør i dag) |

**Regel:** den flate tabellen i web-`StatusBadge` og mobil-`STATUS_MAP` skal **utledes** fra NOEYTRAL, ikke være egne
kopier. Da kan de ikke drifte igjen. Mobil får en liten oversettelse fra variant (`default/primary/success/warning/
danger`) til NativeWind-klasser — samme fem farger som web-`Badge`.

**Mobil detaljside** (`app/oppgave/[id].tsx`, `app/sjekkliste/[id].tsx`) tar i bruk `perspektivEtikett` med seerens
rolle, slik web-detaljsidene gjør. Da ser feltarbeideren «din tur» i gult på telefonen.

**Timer-statusene** (`TimerStatusMerkelapp`, web `timer/StatusBadge`) er egne statuser og holdes utenfor. De bruker
allerede gul for «sendt tilbake til deg», som stemmer med språket over.

## 4. Paritetsmatrise

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| Liste (nøytral) | ✅ utledet fra NOEYTRAL | ✅ utledet fra NOEYTRAL | ❌ gjelder ikke — PDF viser status som tekst |
| Detalj (personlig) | ✅ uendret | ✅ nytt: `perspektivEtikett` | ❌ gjelder ikke — PDF er ikke seer-relativ |

## 5. To spørsmål til Kenneth

**Spørsmål 1 — `responded` i lista: blå, ikke gul?** Anbefaling: **blå.** Gult i en liste alle ser, sier «din tur» til
alle. Godkjenneren ser fortsatt gult på detaljsiden («Til godkjenning»).

**Spørsmål 2 — hva heter `in_progress` for dem som ikke har ballen: «Mottatt» eller «Under arbeid»?**
To vedtak står mot hverandre i koden:
- **F3, 2026-07-25:** `rejected` og `in_progress` slått sammen til «Under arbeid» — står i `perspektivEtikett`.
- **Runde-2, 2026-08-02 (Q1=A):** `in_progress` vises som «Mottatt», «ingen Under arbeid noe sted» — står i
  web-`StatusBadge` og mobil.

**Anbefaling: «Mottatt» i den nøytrale visningen** (det nyeste vedtaket), **«Under arbeid» bare for den som har
ballen** (på detaljsiden, gul). Da ser utenforstående at dokumentet er tatt imot, mens den som skal jobbe, ser at det er
hans tur. NOEYTRAL-cellen for `in_progress` endres fra «Under arbeid» til «Mottatt»; de personlige cellene står.

## 6. Utenfor

Nye statuser · endring av statusoverganger · timer-statuser · PDF · «Lest»-varianten (den bruker i dag `title=`, som
standarden forbyr — egen liten oppfølger) · selve fargeverdiene i `Badge` (gul er Tailwind yellow i dag; tokenryddingen
er audit § 6 pkt 3).

## 7. Etter gaten

Design skriver ordren (redesign er ledig). Omfang: `perspektivEtikett` (NOEYTRAL-cellen, eksport av nøytral oppslag),
web-`StatusBadge` (utled fra NOEYTRAL), mobil `StatusMerkelapp`/`STATUS_MAP` (utled fra NOEYTRAL), mobil detaljsider
(`perspektivEtikett`). Frosne rader i `perspektivEtikett.test.ts` oppdateres etter vedtaket i § 5.
