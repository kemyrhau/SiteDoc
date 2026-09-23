# Ordre: opprettelse uten modal på mobil, og emnet inn i dokumentet

**Til:** cowork velger agent · **Fra:** design · **Dato:** 2026-09-22
**Branch-forslag:** `feat/opprett-uten-modal` fra `origin/develop`.
**Grunnlag:** `docs/redesign/designnotat-opprett-uten-modal-design-2026-09-22.md`.
**Gatet av Kenneth 2026-09-22:** hele notatet, inkludert alle tre spørsmålene i § 5 — likt for web og mobil,
web-gruppering også på mobil, og emnefeltet synlig alltid.

**Coworks innspill tas:** kontrollplan bygget begge emne-rundene i august og kjenner `leseModus` og server-vakten.

---

## 1. Måling først — meld resultatet før du bygger

1. **Hvem lener seg på at klienten sender `bestillerFaggruppeId`?** Zod har den valgfri (`sjekkliste.ts:287`), og
   serveren utleder den alt på kontrollplan-veien (`:329–353`). Finn alle kall som sender den i dag — web, mobil,
   offline-kø, tester. **Meld lista.** Finner du et kall som ikke kan utlede den, **stopp og meld**.
2. **Offline.** Oppretting uten nett må virke som før. Tåler køen at feltet er tomt når serveren utleder det?
3. **«Opprett fra tegning»** og kontekstkjeden (forhåndssatt posisjon): uendret oppførsel, målt før og etter.
4. **Sist-brukt-minnet på mobil** (default byggeplass, og siste tegning per byggeplass) — hvor hører det hjemme når
   modalen forsvinner? Forslag: kontekstvelgeren i toppen, som på web. **Meld hva du finner før du flytter noe.**

## 2. Mobil: bort med opprett-modalen

**Mønsteret finnes på web og skal kopieres, ikke gjenoppfinnes** (`OpprettMalVelger.tsx`,
`sjekklister/page.tsx:352`).

- Trykk **+** → mal-velger gruppert **faggruppe → dokumentflyt → mal** → **klikk oppretter dokumentet** → brukeren
  lander i utfyllingen.
- `bestillerFaggruppeId` og `utforerFaggruppeId` settes **fra flyten**, som på web. Feltet forsvinner fra skjermen.
- **Ingen flyt-velger.** En mal i flere flyter står under hver; klikket er dermed entydig.
- **Lokasjon velges ikke ved opprettelse.** Byggeplass og tegning arves fra konteksten (som web), og justeres i
  lokasjonslinja inne i dokumentet.
- **GPS-forslaget beholdes der det allerede er** — i listeskjermens kontekstkort («GPS foreslår: …»).
- 🔴 **«Opprett fra tegning» beholdes urørt.** Den veien setter posisjonen på forhånd og skal virke som før.

**`OpprettDokumentModal` fjernes bare hvis ingen annen vei bruker den.** Gjør den det, behold den for den veien og meld
hvilken.

## 3. Begge flater: emnet inn i dokumentet

I dag kan emne bare settes i mobilens opprett-modal, og i dokumentet viser `EmneVelger.tsx:117` i lesemodus bare blek
grå kursiv «ingen emne» — uten etikett og uten ramme.

- **Emnefeltet står synlig øverst i dokumentet**, på begge flater, også når det er tomt.
- **Redigerbart for den som kan redigere dokumentet**, i tråd med vedtaket 2026-08-29 (emne er en merkelapp, ikke
  dokumentasjon, og skal kunne endres etter sending). Server-vakten som finnes, skal ikke svekkes.
- **Synlig også i lesemodus for andre** (Kenneth 2026-09-22). Tomt emne vises som «Ingen emne» med etikett, ikke som
  grå kursiv uten kontekst.
- **Malens forhåndsdefinerte emner tilbys som forslag** — de finnes allerede i mobilkoden.

## 4. Rammer

- Ingen endring i hvem som har lov til hva. Utledning erstatter et klientfelt; den flytter ikke en rettighet.
- Ingen migrering, ingen SQL.
- Nye synlige strenger gjennom `t()` i `nb.json` + `en.json`, deretter `generate.ts --only <nøklene>`. Endrer du en
  eksisterende verdi: slett den fra de 13 målspråkene først.
- Rører ikke malbyggeren, betingede felt eller arkivfilteret.

## 5. Definition of Done

1. Målingene i § 1 meldt, med lista over kall.
2. Mobil: opprettelse i ett klikk, samme gruppering som web. Web uendret i opprettelsen.
3. Emnefeltet synlig og redigerbart på begge flater, også tomt, også i lesemodus.
4. **Rød først:** en test som viser at opprettelse uten `bestillerFaggruppeId` fra klienten får riktig faggruppe fra
   flyten, og en som viser at emne kan settes og endres **etter** at dokumentet er opprettet.
5. Regresjon: «opprett fra tegning» uendret, og offline-oppretting virker.
6. Gate-tall via `pnpm exec turbo run test --force`, web build, mobil typecheck.
7. **Tekstbevis:** feltlista i opprettelsen før og etter, og emnefeltet i dokumentet i begge tilstander (tomt og
   utfylt), gjengitt som tekst. Skjermbilder er Kenneths verifisering, ikke agentens bevis.
8. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

**Etter merge:** Kenneth verifiserer innlogget på test — opprette en sjekkliste i ett klikk på telefon, sette emne
etterpå, og se at «opprett fra tegning» fortsatt virker.
