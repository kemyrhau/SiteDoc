# Ordre: tre små rettinger — «dismissed», kapittelsortering og «Dokumenttype»

**Til:** cowork velger agent (redesign er nærmest) · **Fra:** design · **Dato:** 2026-09-21
**Branch-forslag:** `fix/tre-smaa-rettinger` fra `origin/develop`.
**Gatet av Kenneth 2026-09-21.** Tre saker som har ligget i BACKLOG mens malarbeidet gikk. Alle tre er målt av design
mot develop, med fil og linje.

Tre uavhengige rettinger i én branch. De rører ulike lag (web-komponent, api-rute, i18n), så de kan ikke kollidere med
hverandre — men **meld hver for seg** i leveransen, så gaten kan gjøres per sak.

---

## 1. Statusmenyen viser råstrengen «dismissed»

**Hvor:** `apps/web/src/components/hms/firma-hurtig-modal.tsx:11` — `STATUS_I18N` har ni statuser, men ikke
`dismissed`. Linje 109 faller derfor tilbake til råverdien: `{t(STATUS_I18N[s] ?? s)}`.

**Hvorfor det treffer kunden:** `dismissed` er den terminale avvist-statusen i firmaflyten. Brukeren ser ordet
«dismissed» i en nedtrekksmeny på norsk.

**Retting:** legg til `dismissed: "status.avvist"` i `STATUS_I18N`. Nøkkelen finnes i begge språkfiler
(`packages/shared/src/i18n/nb.json:795`). **Ingen ny i18n-nøkkel.**

**Sjekk samtidig, og meld hva du finner:** `rejected` er allerede mappet til samme nøkkel. Er `rejected` død i denne
flyten (jf. migreringen som flyttet avvis til `dismissed`), **la den stå** — inerte rader ryddes i en egen runde, ikke
her.

## 2. Kapittel-lista mangler tiebreaker i sorteringen

**Hvor:** `apps/api/src/routes/bibliotek.ts`, `hentStandarder` — både standarder og kapitler sorteres på `sortering`
alene.

**Hvorfor:** to kapitler med samme sorteringstall gir en rekkefølge databasen velger fritt, og den kan endre seg mellom
to kall. Vi traff det konkret i malrunde C (UP og UU hadde begge 2). Det ble løst i data den gangen, men koden kan
fortsatt vise vilkårlig rekkefølge.

**Retting:** gi begge nivåene et andre kriterium:
- kapitler: `orderBy: [{ sortering: "asc" }, { kode: "asc" }]`
- standarder: samme mønster
- maler sorteres allerede på `navn` og røres ikke.

**Test:** en test som gir to kapitler samme `sortering` og viser at rekkefølgen blir den samme ved gjentatte kall.
Rød først om det lar seg gjøre i harnessen — klarer den det ikke, meld hvorfor og lever testen uten rød-fase.

## 3. Skjermleseren sier «Dokumenttype», dialogen sier «Dokumentklasse»

**Hvor:** `packages/shared/src/i18n/nb.json:2234` — `"dokumentklasse.segmentTittel": "Dokumenttype"`.

**Hvorfor:** maldialogen kaller det «Dokumentklasse» på skjermen. Den som bruker skjermleser, hører et annet ord enn
den som ser skjermen. «Dokumentklasse» er det nyeste og synlige begrepet, så teksten rettes der.

**Retting:** sett verdien til «Dokumentklasse» i `nb.json`, og til motsvarende i `en.json`. Kjør deretter
13-språk-generatoren **kun for denne nøkkelen**:

```
pnpm dlx tsx src/i18n/generate.ts --only dokumentklasse.segmentTittel
```

(fra `packages/shared`). Uten `--only` drar du med deg annen drift inn i diffen.

## 4. Rammer

- Ingen andre endringer. Ser du noe annet som burde rettes, meld det — ikke ta det her.
- Prod-gaten røres ikke. Ingen SQL, ingen migrering.
- Gate-tall i formatet `unit-mock · unit-ren · integrasjon · e2e`, målt med `pnpm exec turbo run test --force`
  (`pnpm test --force` cacher — coworks funn 2026-09-20).

## 5. Definition of Done

1. De tre rettingene, meldt hver for seg med fil og linje.
2. Testen i sak 2.
3. Gate-bygg med gate-tall. Web build og mobil typecheck.
4. **Tekstbevis for sak 1 og 3:** vis den nye verdien fra koden eller språkfila — ikke skjermbilde.
5. Diff mot develop: `firma-hurtig-modal.tsx`, `bibliotek.ts`, `nb.json`, `en.json` og de genererte språkfilene for den
   ene nøkkelen. Rører du noe annet, meld hvorfor.
6. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post» til Kenneth.

Design gater per sak. Cowork gater teknisk og merger.
