# Ordre: FB4 og FD3 inn i fasiten (ren flytting, ingen tekstendring)

**Til:** mal-Opus · **Fra:** design · **Dato:** 2026-09-20
**Metode:** MAL-METODE §1b og §8.
**Branch:** `feat/mal-fasit-fb4-fd3` fra `origin/develop` **etter at malfasit-runden (`feat/mal-fasit`) er merget.**
**Gatet av Kenneth 2026-09-20.**

Funn fra fasit-gaten: `FB4` og `FD3` ligger som inline-blokker i F-arrayet, ikke som eksporterte `*_MAL`-konstanter.
Fasiten dekker bare eksporterte konstanter, så disse to malenes tekst er fortsatt ulåst. Begge er parkerte maler med
gamle normkoder i hjelpetekstene. Hullet var i designs ordre, ikke i forrige leveranse.

---

## 1. Hva som skal gjøres

1. Løft FB4-blokken ut som `export const FB4_MAL` og FD3-blokken ut som `export const FD3_MAL`, samme mønster som de
   13 andre. Bruk dem i F-arrayet på samme plass som blokkene står i dag.
2. Regenerer fasiten i samme branch, så den dekker alle 15 maler.

## 2. Ufravikelig: ingen tekstendring

**Ikke rett noe i innholdet** — ikke normkoder i hjelpetekstene, ikke tallfelt, ikke navn. Malene er parkert og
revideres senere med egen designgatet ordre. Denne runden flytter kode, ingenting annet.

Dette skal derfor gjelde:
- Diffen i seed viser bare `export const` + bruk i arrayet, ingen endrede strenger.
- Fasit-diffen viser bare **to nye blokker** (FB4, FD3). Endres én eneste linje under en annen mal, er det et avvik:
  stopp og meld.
- §7b-vakten røres ikke. FB4 og FD3 har normkoder i hjelpetekstene i dag; det er kjent og skal stå til revisjonen.
  Må en vakt utvides for å slippe dem gjennom, stopp og meld før du endrer den.

## 3. Rammer

Ingen generatorendring. Ingen SQL (verken generator eller malinnhold er endret — §8b). Prod-gaten røres ikke.

## 4. Definition of Done

1. `FB4_MAL` og `FD3_MAL` eksportert og brukt i F-arrayet.
2. Fasiten regenerert med den dokumenterte kommandoen; diffen = to nye blokker.
3. Gate-bygg med gate-tall `unit-mock · unit-ren · integrasjon · e2e`.
4. Diff mot develop: `seed-bibliotek.ts` og `mal-fasit.snap.md`. Rører du noe annet, meld hvorfor.
5. Leveranse nederst i `relay/inbox-design.md` + «design har post».

Design gater på diffen. Deretter runde B (UM1 + UU1).
