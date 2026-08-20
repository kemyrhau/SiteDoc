---
name: designnotat-flytmodell-fjerning-fabel-2026-08-21
description: Fjerningsdesign F1–F5 for ledd-typer i dokumentflyt. Omforent akseptert 2026-08-21 etter tre målte presiseringer fra cowork.
sist_endret: 2026-08-21
---

# Designnotat: fjerning av ledd-typer (F1–F5)

**Fabel 2026-08-21.** Grunnlag: [na-rapport-flytmodell-2026-08-21.md](../claude/na-rapport-flytmodell-2026-08-21.md).
Vedtak: [vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md](vedtak-flytmodell-rekkefolge-fabel-2026-08-21.md)
og [domene-arbeidsflyt.md](../claude/domene-arbeidsflyt.md) § rekkefølgen styrer.

> **Kildemerknad:** leveransemappen `til-repo-2026-08-21-1100` ble aldri lastet ned.
> Innholdet her er fabels **autoritative innlimte ordlyd** — nivå 1 i
> [informasjonsflyt-fabel-cowork.md](../claude/informasjonsflyt-fabel-cowork.md) § 3 —
> med de tre presiseringene innarbeidet.

## F1 · Klient-UI slutter å konsumere typematrisen

`erTillattForRolle` / `ROLLE_HANDLINGER_DEFAULTS` brukes ikke av serveren (nå-rapportens
hovedfunn: `verifiserRetningsrett` er posisjonsbasert). UI-gating skal speile serverens
posisjonsregler. Flytbyggerens typevelger fjernes; boksene nummereres. Matrisen
deprecates til null konsumenter.

## F2 · Ny entydighet på posisjon

`@@unique([flytId, posisjon, bemanningskilde])` — men bemanningskilde er **tre nullable
kolonner**, ikke én.

🔴 **Presisering (cowork, målt 2026-08-21): NULL-fellen.** Postgres håndhever ikke unique
når en kolonne er NULL. To rader `(flyt, posisjon 2, NULL, NULL, NULL)` — to åpne ledd på
samme posisjon — ville begge vært lovlige. I dag maskeres dette av at `rolle` inngår i de
tre nøklene (`[dokumentflytId, faggruppeId, rolle, steg]` m.fl.); fjernes rolle, kollapser
skillet.

**Fabels avgjørelse:** samme posisjon **kan ikke** ha to åpne ledd. To åpne ledd på samme
posisjon er semantisk samme ledd to ganger — duplikatet er alltid en feil, aldri et
uttrykk.

**Løsning — partial unique index:**

- `@@unique([flytId, posisjon, faggruppeId])` m.fl. som i dag, for **bemannede** ledd.
- Pluss rå SQL i migreringen for **åpne** ledd:
  ```sql
  CREATE UNIQUE INDEX ... ON dokumentflyt_medlemmer (dokumentflyt_id, posisjon)
  WHERE faggruppe_id IS NULL AND project_member_id IS NULL AND group_id IS NULL;
  ```

Partial index fremfor generert diskriminatorkolonne: ingen ny kolonne å vedlikeholde, og
vernet står i databasen der bruddet ville oppstått. Prisma støtter ikke partial index i
schema — rå SQL i migreringen med kommentar i schemafilen aksepteres.

**Migrering** mapper rolle → posisjon via flytens rekkefølge. **Dokgen leverer
kollisjonstelling fra prod FØR migrering** — den kjøres ikke blind.

## F3 · Lagret historikk fryses, migreres ikke

`senderRolle`-kolonnen består. Gamle rader beholder enum-verdien; nye overføringer skriver
**posisjonsetikett** i samme felt («Ledd 2 av 4»). PDF-loggen leser feltet uansett form.

**PDF-enum-buggen rettes FØRST, som egen liten ordre:** `loggseksjon.ts:46` viser i dag rå
`utforer` i dokumenthistorikken.

🔴 **Presisering (cowork, målt): tom verdi er normaltilfelle, ikke vern.** 20 av 58
`document_transfers` i prod har allerede `sender_rolle = null` — en tredjedel. Fiksen må
håndtere **tre former**:

| Form | Behandling |
|---|---|
| Kjent enum (`utforer` …) | i18n-oversettelse |
| Posisjonsetikett («Ledd 2 av 4») | vis som-det-er, allerede visningsklar |
| Tom / ukjent | «—» — **forventet tilfelle** |

`Dokumentflyt.roller` (JSON): bekreft at kun admin-UI leser, deretter frys.

## F4 · Registrator som ett flagg

`erRegistrator` boolsk på leddet. Minst ett per flyt (validering). «Kan starte» leser
**kun** flagget. Transfer-snapshotets `create_*` avledes av flagget ved snapshot.
Lukker KP-start a/b/c.

⚠️ **Fra nå-rapporten:** registrator er i dag **to uavhengige kilder** — rolle-type-verdi
(gater oppretting, `sjekkliste.ts:407-410`, `oppgave.ts:499`) **og** tillatelsen
`create_checklists/tasks` (gater flytt/eierbytte + `senderRolle`). Begge må reconciles, ikke
bare den ene.

## F5 · Kunde-overrides — ren kodeopprydding

🔴 **Presisering (cowork, målt): `flyt_rettighet_overrides` har 0 rader i prod.**
Ingen kunde har lagret overstyringer. Opprinnelig plan om «migreres kun der entydig,
tvetydige forelegges per firma» har ingen data å virke på.

**Omskrevet:** ren kodeopprydding — tabell og lese-/skrivesti fjernes. Ingen kundedialog,
ingen datamigrering.

## Rekkefølge

1. **PDF-enum-bug** (egen liten ordre)
2. **F1** — UI slutter å lese matrisen → **fabel-gate**
3. **F2 kollisjonstelling** fra prod → **fabel-gate**
4. **F2 + F3**
5. **F4**
6. **F5**

## Måltall fra prod (2026-08-21)

`dokumentflyt_medlemmer`: 28 rader (10 utforer · 8 bestiller · 6 registrator · 4 godkjenner).
`document_transfers`: 58 rader (18 utforer · 18 bestiller · 2 godkjenner · **20 null**).
`flyt_rettighet_overrides`: **0 rader**.
