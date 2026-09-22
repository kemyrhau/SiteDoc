# Ordre: byggelederens befaringsrapport — trasé og pel som identitet, dekning som visning

**Til:** cowork fordeler — **Del A og A2** til app-sporet, **Del B** til mal-Opus · **Fra:** design ·
**Dato:** 2026-09-22
**Branch-forslag:** `feat/befaringsrapport` (Del A), `feat/tegning-bildelag` (Del A2) og `feat/mal-befaring`
(Del B) fra `origin/develop`. **A2 kan bygges uavhengig av A** — den henger ikke på identitetsmodellen.
**Gatet av Kenneth 2026-09-22:** «vei → 100 m, VA → kumgruppe-spenn. skriv ordren.»
**Bakgrunn:** `docs/redesign/designnotat-utled-kontrollplan-og-fremdrift-fra-mengdebeskrivelse-design-2026-09-22.md`
§ 4c–4e. Les den først — den bærer formålet, fargedefinisjonen og prinsippet.

---

## 1. Hvorfor

Kenneth 2026-09-22:

> «jeg har nettopp besluttet at jeg trenger å lage en sjekkliste som byggeleder til vei eller VA prosjekter.
> Sjekklisten startes → den lager en rapport som oppgave pr 100 pel meter og fordeles pr trase/vei … hvorfor
> ikke bare en sjekkliste som dekker hele prosjektet → fordi det blir kanskje vanskelig å finne rapportene som
> gjelder et strekk»

**Formålet er ikke et dashbord — det er bevis til sluttoppgjøret** (designnotatet § 4c). Kenneth:
«når sluttoppgjøret kommer → ta frem alle rapporter med gul og rød fremdrift → det kan være med å forklare
hvorfor et prosjekt er forsinket → men det krever gode rapporter».

**Frekvens, gatet:** 2–3 ganger ukentlig, med månedlig oppsummering (egen BACKLOG-post).

---

# Del A — identitet og dekning (app-sporet)

## A1. Problemet Kenneth stilte, og svaret

> «hva gjør jeg dersom jeg er på pel 100, da trenger jeg å dokumentere P 50-150 → hvordan løser jeg det?»

**Faste 100-metersbolker som *beholdere* løser det ikke:** arbeidsstuffen ligger sjelden pent inne i en bolk, og
da må byggelederen enten skrive to rapporter eller velge en bolk vilkårlig. Begge er feil.

🔴 **Løsningen er å skille hvor rapporten gjelder fra hvordan den finnes igjen:**

- **Intervallet ligger på rapporten.** Én rapport: `Austadvegen P 50–150`.
- **Inndelingen er en indeks, ikke en beholder.** Rapporten treffer **hver** bolk den overlapper — både
  0–100 og 100–200. Søk på pel 120 finner den; søk på pel 60 finner den samme.

**Overlapp, ikke innhold.** Da trenger ikke arbeidet passe til rutenettet.

## A2. Identitetsmodellen

| Nivå | Påkrevd | Eksempel |
|---|---|---|
| Trasé eller vei | **ja** | Austadvegen |
| Strekning fra–til | nei | P 50–150 |

**Tomt intervall er gyldig.** Kenneth: «Dersom det ikke pågår arbeid i austadvegen kan rapporten bli kun
austadvegen, en oppgave for den delen.» En trasé-rapport uten pel er like gyldig som en med.

**Indeksen følger arbeidets egen enhet — gatet av Kenneth 2026-09-22:**

| Prosjekttype | Indeks |
|---|---|
| **Vei** | 100 m pel |
| **VA** | **kumgruppe-spenn** |

**Grunnen til at VA ikke bruker 100 m:** kumgrupper står 60–80 m fra hverandre, satt av hvor langt
rørinspeksjonstraktoren rekker å filme (Kenneth 2026-09-22). Den naturlige strekningen i et VA-prosjekt er
kum til kum, og **emnet for den er alt låst**: `SP-04 til SP-05` (se UM1 v2-ordren). Da kobler
befaringsrapporten seg rett på kum- og strekningsdokumentene uten oversetting.

🔴 **Emnekonvensjonen er koblingsnøkkelen for hele fremdriftssporet** (designnotatet § 4d). Bruk den; ikke
innfør en parallell stedsnøkkel.

## A3. Dekning er en VISNING, ikke forhåndslagde oppgaver

Kenneths skisse sier at sjekklisten «lager en rapport som oppgave pr 100 pel meter». **Design anbefaler å ikke
opprette dem på forhånd**, og begrunnelsen skal stå i leveransen så Kenneth kan overprøve den:

- Et 1100-metersprosjekt gir 11 bolker **pr. trasé**. Med 2–3 rapporter i uken fyller tomme oppgaver listen
  på en måned.
- **En tom oppgave lyver om status** — den ser ut som uferdig arbeid, og den forsvinner ikke av seg selv.

**I stedet:** rapporten opprettes når byggelederen er der, og **rutenettet regnes ut fra rapportene** som en
dekningsvisning.

🔴 **Dekningsvisningen er der sluttoppgjørsverdien ligger: den viser hullene.** «Austadvegen P 300–400, ingen
rapporter i mai» er et hull som kan lukkes mens noen husker hvorfor — eller forklares. Det er Kenneths eget
krav om **ubrutt serie** (designnotatet § 4c), gjort synlig.

## A4. Utfylling på stedet

GPS vet omtrent hvor byggelederen står. Skjermen **foreslår** `Austadvegen P 50–150` ferdig utfylt, og han
justerer. Ett trykk.

🔴 **Prinsippet for hele sporet (designnotatet § 4e): SiteDoc foreslår, mennesket forplikter seg.** Forslaget
skal aldri lagres uten at han har bekreftet det.

## A5. Dette skal måles, ikke antas — meld i leveransen

1. **Hvor bor trasé og strekning?** Dokumentet har i dag lokasjon via byggeplass og tegning, og emnefeltet
   bærer identiteten for kum og strekning. Skal trasé være en **byggeplass**, et **område**
   (`KontrollplanPunkt.omradeId`), eller noe nytt? **Mål hva som finnes før du innfører en ny modell.** Design
   heller mot å gjenbruke det som finnes, men vil ikke velge uten målingen.
2. **Er pel et tall eller en streng?** `P 50–150` må kunne sorteres og overlappsøkes numerisk. Lagres det som
   tekst i emnet, virker ikke overlappsøket. Meld hva som kreves.
3. **Offline.** Byggelederen står i en grøft. Oppretting og utfylling må virke uten nett, som for
   sjekklistene.
4. **Kan et dokument ha to indekstreff** uten at noe i arkivet eller utskriften teller det dobbelt? Sjekk
   sammenstillingen.

## A6. Rammer og DoD (Del A)

- Ingen endring i `packages/db/prisma` uten at § A5 pkt 1 er målt og meldt først.
- **Rød først** på overlappsøket: en rapport `P 50–150` skal treffe bolk 0–100 **og** 100–200, og **ikke**
  200–300.
- **Rød først** på dekningsvisningen: et hull skal vises som hull, og en trasé-rapport uten pel skal ikke
  fylle noen bolk.
- Prod-gaten røres ikke. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
- **Tekstbevis:** overlappstabellen gjengitt fra en test. Ingen skjermbilder.
- Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

---

# Del A2 — TILLEGG: «vis bilder» som lag i tegningsvisningen

**Tilføyd 2026-09-22 etter Kenneths spørsmål:** «alle bilder logges og kan vises i en georeferert tegning.
hvordan fungerer det? Kan vi slå av og på vis bilder i en tegning?» → **«ja, skriv det som tillegg til Del A»**.

## A2.1 Målingen — nesten alt finnes, og det er feltverifisert

Design har lest koden 2026-09-22. **Ingenting av matematikken skal bygges på nytt.**

| Del | Hvor |
|---|---|
| Georeferanse på tegningen | `Drawing.geoReference` (Json, 2+ referansepunkter) + `coordinateSystem` (utm33, ntm6 …) |
| Transformasjon | `packages/shared/src/utils/georeferanse.ts:191` `beregnTransformasjon` — 2 punkter gir similaritet (skalering, rotasjon, speiling), 3+ gir affin |
| GPS → tegningskoordinat | `georeferanse.ts:305` `gpsTilTegning` |
| Innenfor tegningen? | `georeferanse.ts:363` `erInnenforTegning` |
| Kalibreringsfeil i meter | `georeferanse.ts:376` `beregnKalibreringsFeil` |
| Bilder utenfor alle tegninger | `bilder/page.tsx:109` `harGpsUtenforTegninger` |
| Kalibrerings-UI | `apps/web/src/components/GeoReferanseEditor.tsx` |
| GPS på bildet | `latitude` / `longitude` |

**Det som mangler er bare laget i den ordinære tegningsvisningen.** Bilder-siden har visningen; tegningsvisningen
har georeferansen men ingen bildemarkører man kan slå av og på.

🔴 **Feltverifisert lærdom som skal stå i hjelpeteksten:** to-punktskalibrering speilet alle andre posisjoner
om linjen mellom kalibreringspunktene, selv om den traff de to punktene eksakt (funnet Lakselv lufthavn
2026-08-13, rettet i `georeferanse.ts`). **Tre punkter gir affin transformasjon og er tryggere enn to.**
Kalibrerings-UI-et bør si det.

## A2.2 Hva som skal bygges

1. **Bryter «Vis bilder»** i tegningsvisningen (web og mobil), som slår bildemarkørene av og på.
2. **Standard AV.** En tegning skal ikke åpne seg dekket av nåler (CLAUDE.md § renest mulig UI).
3. **Tilstanden huskes** pr. bruker pr. tegning, slik at den som jobber med bilder ikke må slå på hver gang.
4. **Periodefilter på laget.** Gjenbruk `PeriodeFilter`, som bilder-siden alt bruker. **Standard: siste 30
   dager**, ikke «alle» — et prosjekt med 2–3 befaringer i uken gir hundrevis av bilder på et år, og «alle»
   gjør tegningen ubrukelig første gang den åpnes.
5. **Gruppering ved tett plassering.** Flere bilder på samme sted vises som én markør med antall, som åpnes ved
   klikk. Uten dette er en 340-metersgrøft en vegg av markører.
6. **Klikk på markør** åpner bildet, og viser **hvilket dokument det kom fra** — det er lenken tilbake til
   befaringsrapporten, og den er hele grunnen til at laget er verdt noe for byggelederen.
7. **Kalibreringsfeilen vises én gang** i laget, f.eks. «kalibrering ±2,4 m», fra `beregnKalibreringsFeil`. Da
   vet den som ser på det hvor mye presisjon han kan stole på, i stedet for å tro at en markør er meterpresis.
8. **Bilder utenfor tegningen skjules, men telles og meldes** — «12 bilder har posisjon utenfor denne
   tegningen». `harGpsUtenforTegninger` finnes alt. Bilder **uten** GPS telles for seg.

🔴 **Tegning uten georeferanse:** bryteren skal være **slått av og deaktivert, med begrunnelsen synlig** og en
vei til kalibreringen — ikke en bryter som ser aktiv ut og ikke gjør noe. Det er CLAUDE.md § «stille tomhet er
forbudt» anvendt på UI.

## A2.2b 🔴 RETTING: etasjer — GPS kan ikke skille dem

**Kenneth 2026-09-22:** «hvis en tegning vises i rapporten → la oss si det er et 3 etasjes bygg og rapporten
velger 1.etasje → knytter vi bildene til denne etasjen → eller klarer vi ikke å skille bilder fra 1 og 3 etasje
fra hverandre?»

🔴 **Design spesifiserte A2.2 feil, og Kenneth fanget det.** «Bilder med GPS innenfor tegningen vises» ville
lagt bilder fra 3. etasje oppå 1.-etasjeplanen. **GPS-høyde er ±15–30 m ute og ubrukelig inne** — et bilde fra
3. etasje har praktisk talt samme lat/lon som ett fra 1.

**Målt 2026-09-22:** bildemodellen har `gpsLat`, `gpsLng`, `gpsEnabled` og **ingen `drawingId`, ingen etasje**
(`schema.prisma:1478`). Skillet finnes ett nivå opp: **`Checklist` og `Task` har `drawingId` + `positionX/Y`**
(`schema.prisma:1232`, `:1316`), og **`Drawing` har `floor`** (`:893` — U2, U1, 01, 02, 03, Tak).

**En sjekkliste som peker på 3.-etasjetegningen, plasserer bildene sine i 3. etasje uten at GPS er involvert.**

### Regelen — tre nivåer, i denne rekkefølgen

| Nivå | Kilde | Etasje | Posisjon | Vises |
|---|---|---|---|---|
| **1** | dokumentets `drawingId` + `positionX/Y` | riktig | eksakt | markør på tegningen |
| **2** | dokumentets `drawingId`, ingen posisjon | riktig | **ukjent** | **liste ved siden av tegningen** |
| **3** | bildets GPS, dokument uten `drawingId` | **ubestemt** | omtrentlig | markør, **kun når etasjen ikke er tvetydig** |

🔴 **Nivå 1 og 2 er autoritative. GPS er bare fallback, og den er etasjeblind.** Er dokumentets tegning satt,
skal GPS **ikke** brukes til plassering — dokumentet er mer pålitelig enn koordinaten.

🔴 **Nivå 3 skal ikke plassere noe når etasjen er tvetydig.** Tvetydighet er beregnelig: tegningen har `floor`
satt, **og** det finnes en annen georeferert tegning på samme byggeplass med annen `floor` og overlappende
utstrekning. Da skal bildet **ikke** vises — det skal **telles og begrunnes**: «7 bilder har GPS, men etasje kan
ikke bestemmes». Samme mønster som utenfor-tellingen i A2.2 pkt 8, og samme regel som CLAUDE.md § «stille
tomhet er forbudt».

🔴 **Nivå 2: finn ikke opp en posisjon.** Dokumentet vet etasjen, men ingen har plassert markøren. Bildene
listes ved siden av tegningen — «4 bilder i denne etasjen uten plassering» — og kan plasseres manuelt derfra
(`plasseringsmodus` finnes alt på bilder-siden). **En markør i et hjørne som ser målt ut, er verre enn ingen
markør.**

**Regelen degraderer pent for vei og VA:** der har tegningene sjelden `floor` satt, tvetydigheten oppstår ikke,
og GPS-fallbacken virker som tenkt. **Ingen særregel for anleggsprosjekter skal bygges.**

**Ærlig avgrensning:** nivå 1 og 2 er **tilskrevet**, ikke målt. Er et bilde fra 3. etasje lastet opp i en
sjekkliste for 1. etasje, havner det i 1. etasje. Det er menneskelig feil, ikke systemfeil, og skal ikke
forsøkes korrigert automatisk.

### DoD-tillegg for etasjeregelen

- **Rød først:** to bilder med samme GPS, ett i et dokument som peker på 1.-etasjetegningen og ett på
  3.-etasjetegningen, skal havne på **hver sin** tegning — ikke begge på begge.
- **Rød først:** et GPS-bilde uten dokumenttegning, i et bygg med to georefererte etasjeplaner, skal **ikke**
  plasseres, og skal telles med begrunnelse.
- **Rød først:** samme bilde i et vei-prosjekt der tegningen ikke har `floor`, **skal** plasseres.

## A2.3 Grenser

- **Ingen ny matematikk.** Alt går gjennom `georeferanse.ts`. Finner du behov for en ny transformasjon, er det
  et funn som skal meldes, ikke løses.
- **Ingen endring i hvordan bilder lagres eller GPS-tagges.**
- **Bilder-siden røres ikke.** Den virker; dette er et lag i en annen flate. Ser du duplisert logikk mellom
  dem, **meld det** — design vurderer om noe skal løftes til en delt komponent, men ikke i denne runden.
- Ingen migrering, med mulig unntak for brukerminnet i pkt 3: **mål om det finnes en lagringsvei før du lager
  en.**

## A2.4 DoD (Del A2)

1. **Rød først:** et bilde med GPS innenfor en georeferert tegning får riktig tegningskoordinat via
   `gpsTilTegning`; et bilde utenfor havner i utenfor-tellingen og ikke på tegningen.
2. Bryter med standard av, tilstand husket, periodefilter med 30-dagers standard, gruppering, klikk til bilde
   med dokumentlenke, kalibreringsfeil synlig, deaktivert bryter med begrunnelse på ukalibrert tegning.
3. Regresjon: bilder-siden er uendret. Vis det.
4. **Tekstbevis:** en tabell fra test som viser bilde-GPS → tegningskoordinat for tre bilder, inkludert ett
   utenfor. Ingen skjermbilder.
5. i18n: nye nøkler i `nb.json` og `en.json`, deretter `--only`-generering fra `packages/shared`. Husk fella
   ved endring av eksisterende nøkkel.
6. Gate-tall via `pnpm exec turbo run test --force`, web build og mobil typecheck.
7. Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## A2.5 Hva Kenneth skal ta stilling til

1. **Er 30 dager riktig standardperiode** for laget, eller vil du se hele prosjektet med gruppering i stedet?
2. **Skal laget vise alle prosjektets bilder, eller bare bilder fra befaringsrapporter?** Design heller mot
   **alle** — et bilde fra en kumsjekkliste er like nyttig på tegningen — men da blir det flere markører, og
   valget er ditt.

---

# Del B — befaringsmalen (mal-Opus)

## B1. Plasseringen er et vedtak, ikke en begrensning

**Dette er ikke en NS 3420-mal.** Den beskriver byggelederens egen befaring, ikke en post i en
mengdebeskrivelse.

**Målt av design 2026-09-22:** `BibliotekStandard.kode` er en **fri unik streng**
(`schema.prisma:2283`) — biblioteket kan altså bære en ikke-NS-standard. Det er teknisk mulig.

🔴 **Men det legger en ny node øverst i bibliotektreet, og det er Kenneths vedtak.** Se § B4. **Ikke opprett
noen standard før vedtaket er gatet.**

## B2. Malen

Fasene FØR/UNDER/ETTER passer dårlig på en befaring — den er én tilstandsvurdering på ett tidspunkt. Bruk
dem likevel som i alle andre maler (strukturen er delt), med hoveddelen i **UNDER**.

**1. Fremdrift** — `valg` · **forelder for felt 2**
- Grønn – normal fremdrift
- Gul – manglende fremdrift
- Rød – ingen eller svært svak fremdrift

> Skriv trasé og strekning i emnefeltet, slik de står på tegningen: Austadvegen P 50–150 for vei, SP-04 til SP-05 for VA-strekning. Står det ikke arbeid i traseen, skriv bare traseen. Grønn krever ingen forklaring. Gul og rød krever at du sier hva som ikke fungerer.

🔴 **Fargedefinisjonen er Kenneths og skal stå ordrett** (designnotatet § 4c): grønn = normal fremdrift · gul =
manglende fremdrift, **forklar hva som ikke fungerer optimalt** · rød = ingen eller svært svak fremdrift,
**forklar** — er det ingen arbeidere på anlegget?

**2. Årsak** — `valg` · **vises for «Gul» og «Rød»**
- Ingen mannskap på anlegget
- Venter på leveranse
- Venter på godkjenning eller befaring
- Fjell eller grunnforhold
- Vær
- Maskinstans
- Omdisponert til annet arbeid
- Annet – forklar i kommentaren

> Velg årsaken som veier tyngst. Er det flere, skriv de øvrige i kommentaren. Årsakene telles over tid, og da svarer de på om det er leveranser eller bemanning som er det egentlige problemet — det gjør de ikke hvis alt havner i fritekst.

🔴 **Årsakslisten er designs forslag, ikke Kenneths ord**, med unntak av «ingen mannskap på anlegget», som er
hans eget eksempel. Den gates før SQL — se § B4.

**3. Arbeid som pågår på strekningen** — `valg`
- Graving og grøft
- Ledningslegging
- Kum eller kumgruppe
- Gjenfylling og komprimering
- Dekke, kantstein eller asfalt
- Ingen aktivitet
- Annet – se kommentaren

> Hva som faktisk foregikk da du var der. Feltet gjør rapportene sammenlignbare over tid, og det er det som viser når en aktivitet står stille fra uke til uke.

**4. Posisjon dokumentert med bilde** — `trafikklys`

> Ta bilde med posisjon slått på. Bildene knyttes til strekningen og kan vises på tegningen etterpå.

**5. Trafikkavvikling og sikring av grøft** — `valg`
- I orden
- Avvik – varslet
- Ikke aktuelt her

> Gjelder byggelederens observasjon av at skilting, gjerder og grøftesikring er på plass. Dette er en observasjon, ikke en HMS-behandling — avvik meldes i HMS-sporet.

**6. Befaringen er ført og sendt** — `trafikklys`

> Rapporten er datert, ført og sendt til motparten. En rapport som ikke er sendt, finnes ikke i et sluttoppgjør.

## B3. Rammer og DoD (Del B)

- Vedtaket i § B4 må være gatet **før** standarden eller malen opprettes.
- **Strukturtest:** årsaksfeltet er barn av fremdriftsfeltet, med **to** utløsere (Gul, Rød), og er ikke
  alltid synlig. Rød først. Bruk `forgrening` og `BETINGELSE_EGEN_NOKKEL`, aldri `conditionValues`.
- §7b: ingen `NS 3420`, `NS-EN`, `Matrise`. Ingen i18n-nøkler.
- Fasit (§8) og `skriv-mal` viser treet. Gate-tall via `pnpm exec turbo run test --force`.
- SQL: **ikke kjør mot test selv.** Parse-test mot engangsdatabase, slett den, lever de tre enlinjerne.
- Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## B4. Hva Kenneth skal ta stilling til før SQL

1. 🔴 **Hvor bor malen?** Den er ikke en NS 3420-post. Designs forslag: **ny standard `BYGGELEDELSE`** med
   kapittel for befaring — teknisk mulig (§ B1), men det legger en ny node øverst i bibliotektreet. Alternativ:
   den bor som firmamal utenfor biblioteket. **Design anbefaler egen standard**, fordi befaringsrapporten skal
   kunne lånes og revideres på samme måte som de andre malene — men konsekvensen for malvelgeren er Kenneths
   å veie.
2. **Årsakslisten** i felt 2 — åtte valg, designs forslag. Mangler noen? Er noen overflødige? Listen skal
   være kort nok å velge fra på telefon i en grøft.
3. **Felt 5, trafikkavvikling** — hører den i en byggelederrapport, eller er den ren HMS og skal ut? Design har
   tatt den inn som byggelederens **observasjon**, ikke som HMS-behandling, men grensen er din (MAL-METODE
   §1d).
4. **Ansvarsside pr. årsak** (designnotatet § 4c) er **ikke** i denne malen. Den hører i rapporten og
   uttrekket, ikke i utfyllingen — byggelederen skal registrere hva som skjedde, ikke hvem som skal betale.
   Bekreft at det er riktig.
