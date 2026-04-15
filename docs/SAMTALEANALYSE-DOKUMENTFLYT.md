# Samtaleanalyse: Dokumentflyt-administrasjon i SiteDoc

## Kontekst for AI-reviewer

SiteDoc er et norsk kvalitetsstyringssystem for byggeprosjekter. Kenneth (brukeren) er produkteier og utvikler. Claude (AI) hjelper med implementering. De har jobbet med å redesigne dokumentflyt-administrasjonen, men kommunikasjonen har ført til flere misforståelser. Kenneth ber en annen AI analysere hvor kommunikasjonen sviktet.

## Hva er en dokumentflyt?

En dokumentflyt definerer hvordan dokumenter (sjekklister, oppgaver, avvik) beveger seg mellom mennesker i et byggeprosjekt. Eksempel: en ansatt registrerer et avvik → sjefen vurderer → sender til riktig underentreprenør → UE retter → godkjenner sjekker.

## Systemets sider (4 stk)

1. **Brukere > Grupper** — Kortvisning av brukergrupper (Prosjektadmin, Byggherre, HMS, etc.) med medlemmer
2. **Brukere > Kontakter** — Tabell med alle prosjektmedlemmer gruppert per brukergruppe. Kolonner: Navn, E-post, Telefon, Firma, Rolle, Entrepriser, Grupper
3. **Produksjon > Entrepriser og dokumentflyt** — Den eksisterende entreprise-siden med fargede headere og dokumentflyter
4. **Produksjon > Kontakter** — NY side: Entrepriser med utvidbar visuell dokumentflyt (rolle-bokser med medlemmer)

## Kronologisk hendelsesforløp

### Fase 1: Roller (Bestiller/Utfører)
Kenneth påpekte at dagens 2-rolle-modell (Bestiller/Utfører) er for rigid:
- Godkjenner er hardkodet til samme personer som Bestiller
- En feltarbeider som registrerer avvik er IKKE bestilleren — sjefen må vurdere
- Godkjenning kan ha flere nivåer (BL 50k, PL 500k, Leder 5M)

Claude foreslo 4 faste roller: Registrator → Bestiller → Utfører → Godkjenner

Kenneth korrigerte: "alle alternativer er for statiske. I noen dokumentflyter trenger jeg en person i hver av to bokser. I andre trenger jeg kompleks vandring mellom entrepriser."

**Enighet:** Rollene er valgfrie byggeklosser. Admin velger hvilke roller en flyt trenger. Ingen bokser er avhengige av hverandre.

### Fase 2: Implementering av dynamiske bokser
Claude implementerte:
- 4 rolleverdier i DB: registrator, bestiller, utforer, godkjenner
- Dynamiske FlytBoks-er: viser kun roller som har medlemmer
- «+ Legg til rolle»-knapp for å legge til nye roller

### Fase 3: Problemer dukket opp

**Problem 1: Fjerne rolle forsvinner**
Kenneth slettet en rolle (bestiller) og ville legge til registrator i stedet. Men da han la til en ny rolle, ble rekkefølgen feil (Godkjenner viste seg før Registrator). Bokser forsvant visuelt.

**Problem 2: Grupper vs dokumentflyt-medlemmer**
Claude hadde implementert X-knapper på individuelle gruppemedlemmer INNE I en FlytBoks. Når Kenneth slettet "Frank HE-leder" fra venstre boks, ble han fjernet fra hele brukergruppen — ikke bare fra den rollen i dokumentflyten.

Kenneth forklarte: "hele meningen med dokumentflyt er at dokumenter skal strukturert flyte mellom mennesker. det er ikke gruppen som styrer dokumentflyten. gruppen er der for å slippe å legge til og slette enkeltmennesker i ulike dokumentflyter. grupper er til for å lette arbeidet i organiseringen av dokumentflytene."

**Problem 3: Brukergrupper på feil side**
Claude la til en "Brukergrupper"-seksjon på kontaktsiden (Produksjon > Kontakter). Kenneth påpekte at brukergrupper hører hjemme i Brukere-siden, ikke i dokumentflyt-administrasjonen. Kontaktsiden er for entrepriser og dokumentflyt.

**Problem 4: Tomme grupper i kontakttabellen**
Kenneth opprettet "HE - Ansatte" som brukergruppe, men den dukket ikke opp i kontakttabellen (Brukere > Kontakter) fordi tabellen skjulte tomme grupper.

## Kjernekonflikten

Kenneth har en tydelig mental modell med tre separate konsepter:
1. **Brukergrupper** — Organisatoriske enheter med mennesker. Administreres under Brukere.
2. **Entrepriser** — Kontraktsparter i prosjektet. Har dokumentflyter tilknyttet.
3. **Dokumentflyter** — Definisjoner av hvordan dokumenter flyter. Bruker grupper/personer som byggeklosser, men EIER dem ikke.

Claude blandet disse konseptene:
- La til gruppemedlem-redigering inne i dokumentflyt-bokser (blandet 1 og 3)
- La til brukergrupper-seksjon på dokumentflyt-siden (blandet 1 og 2/3)
- Fjernet gruppemedlemmer via dokumentflyt-X-knapper (ødela 1 via 3)

## Spørsmål til AI-reviewer

1. **Hvor i samtalen misforstod Claude Kenneths mentale modell?** Identifiser de spesifikke punktene der Claude burde ha stilt oppklarende spørsmål.

2. **Hva er den riktige administrasjonsopplevelsen for dokumentflyt?** Basert på Kenneths beskrivelser, hvordan bør UI-et for å konfigurere en dokumentflyt se ut? Tegn gjerne en wireframe i ASCII.

3. **Hva bør Claude gjøre annerledes fremover?** Hvilke prinsipper bør Claude følge for å unngå å blande konseptene?

4. **Forslag til forbedret UX:** Hva ville vært en god måte å konfigurere dokumentflyter med valgfrie roller, uten forvirring mellom gruppehåndtering og flytkonfigurasjon?

## Teknisk kontekst

- **DokumentflytMedlem** i DB har: rolle (registrator/bestiller/utforer/godkjenner), steg (int), og kan peke på enten en entreprise, en brukergruppe (ProjectGroup), eller en enkeltperson (ProjectMember)
- Når en gruppe legges til i en FlytBoks, opprettes det EN DokumentflytMedlem-rad med groupId — ikke separate rader per gruppemedlem
- Grupper er gjenbrukbare — samme gruppe kan brukes i flere dokumentflyter uten kopiering
