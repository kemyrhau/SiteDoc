# Ordre: maler som er utilgjengelige skal vises med begrunnelse, ikke forsvinne

**Til:** cowork velger agent (dokgen målte funnet og kjenner flaten) · **Fra:** design · **Dato:** 2026-09-22
**Branch-forslag:** `fix/utilgjengelige-flyter` fra `origin/develop`.
**Gatet av Kenneth 2026-09-22** etter designs anbefaling.

---

## 1. Funnet

Dokgen målte: Kenneth er **prosjektadmin på Røstbakken**, men ser bare byggherre-flytene i opprett-velgeren, fordi han
er registrator kun på dem. **Elektro har fire maler og Tømrer to — de er usynlige.** Ikke dempet, ikke forklart.
Borte.

## 2. Beslutningen (Kenneth 2026-09-22)

**Gaten beholdes.** Den som oppretter et dokument, skal tilhøre faggruppen. En sjekkliste dokumenterer hvem som
utførte og kontrollerte arbeidet; oppretter byggherren en elektro-sjekkliste, ser dokumentet ut som noe det ikke er.
Det følger vedtaket om at sjekklisten viser utført arbeid.

**«Opprett på vegne av» innføres ikke nå.** Skal det komme, må dokumentet vise både hvem som opprettet og for hvem —
det er en egen runde, ikke en flagg-endring. **BACKLOG.**

**Men den stille forsvinningen er feil uansett.** En mal som finnes og som brukeren ikke får bruke, skal være synlig
med begrunnelse. Ellers vet han ikke om malen mangler, om han mangler tilgang, eller om han leter feil sted.

## 3. Hva som skal bygges

**Mønsteret finnes allerede** — bruk det, ikke lag et nytt:
`malVelger.visUtilgjengelige` («Vis utilgjengelige (n)») med teksten `malVelger.ingenFlytBrukerMal` («Ingen av dine
dokumentflyter bruker denne malen»), i både `OpprettMalVelger.tsx` (web) og `OpprettVelger.tsx` (mobil).

1. **Serveren må si hvorfor.** `mal.ts` setter i dag `opprettbar: boolean` som additiv metadata (`:337–343`).
   Utvid med en **årsak** per mal, slik at klienten kan vise riktig tekst. Minst to årsaker:
   - ingen av brukerens flyter bruker malen (dagens tilfelle), og
   - **malen ligger i en flyt der brukeren ikke er registrator** — med faggruppens navn.
   Finner du flere årsaker i valideringen, ta dem med. **Én kilde:** årsaken skal komme fra samme regel som avgjør
   `opprettbar`, ikke fra en ny vurdering i klienten.
2. **Begge velgere viser dem** i den dempede utilgjengelig-seksjonen, med årsaksteksten under navnet.
3. **Ny i18n-nøkkel** for registrator-årsaken, f.eks. «Du er ikke registrator i {{faggruppe}}». `nb` + `en`, deretter
   `generate.ts --only <nøkkelen>`.

## 4. Grenser

- **Ingen endring i hvem som får opprette.** Dette er synlighet og forklaring, ikke tilgang. Endrer du en eneste
  betingelse i selve gaten, har du gått for langt — **stopp og meld**.
- Ingen migrering, ingen SQL.
- Rører ikke betingede felt, malbyggeren eller arkivfilteret.

## 5. Definition of Done

1. Årsak fra serveren, fra samme kilde som `opprettbar`.
2. Begge flater viser utilgjengelige maler med riktig årsak.
3. **Rød først:** en test der en bruker ikke er registrator i en faggruppe — malen skal være synlig i
   utilgjengelig-seksjonen med registrator-årsaken, og **ikke** opprettbar.
4. Regresjon: en bruker som har tilgang, ser ingen endring; antallet opprettbare maler er uendret.
5. Gate-tall via `pnpm exec turbo run test --force`, web build, mobil typecheck.
6. **Tekstbevis:** for en testbruker, lista over maler med `opprettbar` og årsak, gjengitt som tekst.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

**Etter merge:** Kenneth ser Elektro- og Tømrer-malene på Røstbakken, dempet, med begrunnelsen — i stedet for at de
ikke finnes.
