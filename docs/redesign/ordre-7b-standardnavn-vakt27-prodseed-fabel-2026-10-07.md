# Ordre: §7b før prod-seed — nøytrale standardnavn, vakt over alle 27 maler, no-op-bevis mot test

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** fabel (design) · **Dato:** 2026-10-07
**Metode:** MAL-METODE §7b, §7c, §6a, §8 (fasit), §6b (tellinger).
**Branch:** `feat/mal-7b-standardnavn-vakt27` fra `origin/develop`. Én ordre, tre punkter, ingen nye maler.
**Hjemmel:** Kenneth 2026-10-06/07: SiteDoc-arkivet i **prod** er tomt (`/dashbord/firma/innstillinger/malforvaltning`,
fane SiteDoc-arkiv: «Velg en mal i treet»). Før seeden kjøres mot prod: *«bør ikke henvisninger til NS 3420
fjernes/filtreres først?»* Svar (målt av fabel, godkjent av Kenneth): referansen i **beskrivelsen** beholdes (§7b pkt 2 —
ditt eget vedtak, lovlig henvisning, driftsvarsel med utgave); men **(1)** de fire standardnodene heter i dag
«NS 3420-K:2024 Anleggsgartnerarbeider» osv. og gjør at arkivet *fremstår som standarden*; **(2)** §7b-vakten
dekker bare de åtte K-malene; **(3)** idempotens mot en fylt base er aldri bevist mot test.

---

## 0. Mål før du bygger (meld tallene i leveransen, §6b: si hvilken telling)

1. Test-arkivet nå: `SELECT count(*) FROM bibliotek_standarder; … bibliotek_kapitler; … bibliotek_maler; …
   bibliotek_mal_objekter;` (via tunnel mot `sitedoc_test`, runbok § 7).
2. Hvor `standard.navn` og `standard.kode` **vises**: malforvaltnings-treet (`FirmaarkivFane.tsx` + SiteDoc-arkiv-fanen),
   `OpprettPunktDialog.tsx:124-143, :278, :554`, `ImportMalFaggruppeTilordning.tsx:77`, `bibliotek.ts:34-44`. Si om
   **koden** («NS3420-K») rendres noe sted for brukeren, eller bare navnet. Koden endres IKKE i denne ordren (den er
   nøkkel i `generer-mal-sql.ts`/`standardForMal`); vises den, meld det — fabel tar stilling.
3. Om `mal-fasit.snap.md` inneholder standardnavnene (25 treff på `NS 3420-[KFUJ]:20` i snapshoten i dag — er det
   beskrivelsenes «Faglig grunnlag» (tillatt, låst tekst) eller standardnavn?). Avgjør om punkt 1 krever fasit-regen (§8).

## 1. Standardnodene får nøytrale fagnavn — koden beholdes

`STANDARD_DATA` (`seed-bibliotek.ts:2289-2294`):

| kode (uendret) | navn i dag | **nytt navn** |
|---|---|---|
| `NS3420-K` | NS 3420-K:2024 Anleggsgartnerarbeider | **Anleggsgartnerarbeider** |
| `NS3420-F` | NS 3420-F:2024 Grunnarbeider | **Grunnarbeider** |
| `NS3420-U` | NS 3420-U:2019 Rørinstallasjoner | **Rørinstallasjoner** |
| `NS3420-J` | NS 3420-J:2008 Dekke- og banearbeider | **Dekke- og banearbeider** |

- Kapittelnavnene (`KAPITTEL_DATA_*`) er alt våre egne ord — urørt.
- **Beskrivelsene** («Faglig grunnlag: NS 3420-X:ÅÅÅÅ, post …») — urørt (§7b pkt 2, §8 låst tekst).
- **Test-arkivet:** seeden er kun-opprett (`update: {}`) og retter ikke eksisterende navn → lag `standardnavn-test.sql`
  (gitignorert, som `<ref>-test.sql`): fire `UPDATE bibliotek_standarder SET navn = … WHERE kode = …` i én transaksjon,
  guard `RAISE EXCEPTION` hvis ikke nøyaktig 4 rader treffes, ingen `version`-bump (standard har ingen versjon).
  Kenneth kjører den én gang mot `sitedoc_test` (runbok § 7). **Prod trenger ingen UPDATE** — prod er tomt og får
  navnene fra seeden.
- Kommentaren over `STANDARD_DATA` får én linje: «§7b: standardens navn bærer ikke NS-nummeret i UI (Kenneth
  2026-09-18/2026-10-06); NS-henvisningen står i hver mals beskrivelse.»

## 2. §7b-vakten dekker alle 27 maler

`packages/db/prisma/mal-7b.test.ts` i dag: register over åtte K-maler, K-spesifikke mønstre (`Tabell K`, `K[A-M]\d…`).

- **Register = alle eksporterte `*_MAL`** i `seed-bibliotek.ts` (27 pr. 2026-10-06; tell dem, ikke hardkod åtte). En
  test som FEILER hvis en eksportert `*_MAL` mangler i registeret (grep på `export const \w+_MAL`).
- **Generaliserte mønstre**, fortsatt kun på hjelpetekst + alternativer (`testbareTekster`, ikke `navn`, ikke
  `beskrivelse`):
  - normpunktkode pr. standard: `/\b[KFUJ][A-Z]\d[\d.]*(?:\s[a-z]\d[\d.]*)?/` (fanger «FD1.2», «UM1 c3», «JH2.11»);
  - `Tabell [KFUJ]`, `Matrise [KFUJ]`;
  - betalte kilder (§7c pkt 2): `NS ?3420`, `NS-EN`, `NS ?3458`, `NS ?2890`, `NS ?4400`, `VA/Miljø-blad`, `Norsk Vann`;
  - **tillatt** (§7c pkt 1): `N200` og andre vegvesen-håndbøker — ikke i FORBUDT.
- Unntak (`utenUnntak`) utvides kun med **dokumenterte** mønstre: «sjekklisten FD2» (egen-dokument-henvisning), KM2s
  «300 mm». Hvert nytt unntak får én kommentarlinje med hvorfor.
- 🔴 **Rød først, så meld.** Kjør den utvidede testen mot dagens tekster FØR du endrer noe, og lever treffene ordrett
  (mal, felt, tekst, mønster). **Tekstendringer i hjelpetekster er §8-fasit-tekst** og gates av fabel på tekstbevis: foreslå
  omskrivingen pr. treff i leveransen («fra → til», egne ord, uten kode), **ikke** commit omskrivinger før fabel har sagt
  ja. Null treff → si det, med tallet på testede strenger.

## 3. No-op-bevis mot test (idempotens mot en FYLT base)

- Kjør `seed-bibliotek.ts` mot `sitedoc_test` via tunnel (som før; `.ts`-seeds går ikke på verten, runbok § 7).
  Tell de fire tabellene **før og etter** — identiske tall. Loggen skal vise «finnes» (eller tilsvarende) for alle 27
  maler og 4 standarder, **0 opprettet**. Lever begge tellingene og de siste 10 logglinjene.
- `seed-bibliotek.test.ts` (idempotens-låsen) grønn.
- Dette er beviset Kenneth trenger for å kjøre samme seed mot `sitedoc` (prod). Selve prod-kjøringen er **Kenneths**,
  etter at fabel har skrevet runbok § 8 — ikke del av denne ordren. 🔴 Aldri `-d sitedoc`/prod-URL i noe du kjører.

## 4. DoD

- [ ] § 0-målingene meldt med tall og fil:linje
- [ ] `STANDARD_DATA` m/ nye navn + kommentarlinje; `standardnavn-test.sql` generert, guardet, lagt frem (ikke kjørt av deg)
- [ ] `mal-7b.test.ts`: register = alle `*_MAL` (test feiler ved mangel), generaliserte mønstre, §7c-tillatt, dokumenterte unntak
- [ ] rød-først-treff levert ordrett + foreslått omskriving pr. treff (ingen tekstcommit før fabel-ja) — eller «0 treff av N strenger»
- [ ] fasit: regen kun hvis § 0.3 viser standardnavn i snapshoten; ellers urørt (§8)
- [ ] no-op-bevis: tellinger før/etter identiske, 0 opprettet, idempotens-test grønn
- [ ] regel 10 fra rot: `turbo run typecheck --force`, `pnpm exec turbo run test --force` (7/7) — meld tall
- [ ] leveranse + tekstbevis i **hovedtreets** `relay/inbox-design.md`, hash meldt; branch pushet med `-u`

**Etter merge:** fabel skriver DEPLOY-RUNBOK § 8 «Seeding av SiteDoc-arkivet mot prod» (tunnel, `DATABASE_URL`-form,
tellings-SQL, «les databasenavnet»-sjekk — vakten er blind gjennom tunnel, `seed-bibliotek.ts:39-48`). Kenneth kjører.
