# Ordre: malfasit — lås hjelpetekster og alternativer

**Til:** mal-Opus (`~/Documents/Programmering/SiteDoc-mal`) · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b og **ny §8** (ligger på `docs/design-malfasit`).
**Branch:** `feat/mal-fasit` fra `origin/develop` (@ `af349b0e` eller nyere). **Før runde B** — da får UM1 og UU1 sin
fasit som en del av sin egen runde.
**Gatet av Kenneth 2026-09-20.** Funnet er coworks: testene låser etiketter, felttyper og faser, men ikke
hjelpetekster og alternativer. De sjekkes bare negativt (§7b). Teksten er i dag sett én gang, i psql-utskriften.

---

## 1. Hva som skal bygges

**Én fasitfil i repoet** som dekker alle eksporterte `*_MAL` (K og F), og **én test** som sammenligner malene mot den.

- **Innhold per mal:** `referanse`, `navn`, `beskrivelse`, og per felt i rekkefølge: `type`, `label`, fase,
  `alternativer`, `hjelpetekst` og øvrig `config` (enhet osv.).
- **Formatet velger du** (snapshot-fil eller en egen `.ts`/`.json`-fasit), men det skal oppfylle:
  1. **Lesbar diff:** en endret hjelpetekst vises som gammel og ny linje i `git diff` — ikke som en hash eller en
     omflyttet blokk.
  2. **Stabil rekkefølge:** malene og feltene sorteres deterministisk, så en urelatert endring ikke flytter linjer.
  3. **Én kilde:** fasiten skrives ut fra de samme konstantene seeden bruker (gjerne via `byggBibliotekRader`), ikke
     skrevet av for hånd.
- **Testen** feiler med tydelig melding: hvilken mal, hvilket felt, hva som sto og hva som står nå.
- **Oppdatering:** det skal finnes én dokumentert kommando for å regenerere fasiten (f.eks. `pnpm … -u` eller et lite
  script). Skriv den i toppen av fasitfilen eller i testens kommentar.
- **Ny mal uten fasit** skal gi rød test, ikke stille forbigåelse.

## 2. Regelen som følger med (MAL-METODE §8)

Fasitendring er bare lov sammen med en designgatet ordre, i samme branch som malendringen. Skriv den som kommentar
øverst i fasitfilen, kort.

## 3. Rammer

- Ingen endring i malinnhold i denne runden. Fasiten skal speile develop nøyaktig som den står.
- Ingen endring i generatoren.
- `mal-7b.test.ts` beholdes som den er — §7b er en egen, negativ sjekk.
- Prod-gaten røres ikke. Ingen SQL, ingen kjøring mot test.

## 4. Definition of Done

1. Fasitfil + test som over, og den dokumenterte regenereringskommandoen.
2. **Rød først:** vis at testen fanger en endring — endre midlertidig ett tegn i en hjelpetekst, kjør testen, vis
   feilmeldingen i leveransen, og tilbakestill.
3. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`. db-tallet skal stige med fasittesten; alt annet
   stille.
4. Diff mot develop: fasitfilen, testfilen og eventuelt et lite script. **Ingen endring i `seed-bibliotek.ts`** — er
   det avvik mellom fasit og seed, er det et funn: stopp og meld, ikke rett teksten.
5. Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth.

Design gater på diffen — ingen SQL i denne runden. Deretter runde B (UM1 + UU1), som legger til sin del av fasiten.
