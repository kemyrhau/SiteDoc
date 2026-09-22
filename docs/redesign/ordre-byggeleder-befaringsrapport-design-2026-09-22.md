# Ordre: byggelederens befaring og avvik — fire maler i ny standard BYGGELEDELSE

**Til:** cowork fordeler — **Del A og Del A-TILLEGG** til app-sporet, **Del B** til mal-Opus · **Fra:** design ·
**Dato:** 2026-09-22
**Branch-forslag:** `feat/befaringsrapport` (Del A), `feat/tegning-bildelag` (Del A-TILLEGG) og `feat/mal-befaring`
(Del B) fra `origin/develop`. **Tillegget kan bygges uavhengig av Del A** — den henger ikke på identitetsmodellen.
**Gatet av Kenneth 2026-09-22:** «vei → 100 m, VA → kumgruppe-spenn. skriv ordren.» · «ja, egen standard
BYGGELEDELSE» · «sjekklistemal for selve befaringen med telling · oppgavemal for veg/VA og Bygg».
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

## A2. Identitetsmodellen — én modell, tre prosjekttyper

**Utvidet 2026-09-22 etter Kenneth:**

> «jeg mener som byggeleder → sjekkliste for å dokumentere hele byggeplassen → gjøres ved å opprette oppgaver
> pr punkt eller pr etasje, kanskje kombinasjon av begge deler ved behov 1 etasje for generelle bilder, egen
> rapport for en feil/mangel som oppdages»

**Det viser at modellen må bære to ting samtidig, og at de har ulik granularitet:**

| Rapporttype | Dekker | Posisjon | Dokument |
|---|---|---|---|
| **Områderapport** — generell | et område: etasje, pel-intervall, kumspenn | **ingen** | befaringsrapporten (sjekkliste) |
| **Punktrapport** — feil eller mangel | ett punkt | **eksakt på tegningen** | **oppgave** |

🔴 **Punktrapporten trenger ingen ny dokumenttype.** `Task` har alt `drawingId` + `positionX/Y`
(`schema.prisma:1316`) — en oppgave **er** punktdokumentet. Design foreslår ingen ny modell for avvik.

🔴 **Og punktrapporten skal opprettes FRA befaringen**, slik at lenken finnes. Da kan sluttoppgjøret vise
kjeden: «befaring 12. mai, gul, årsak *venter på leveranse*, og disse fire avvikene ble registrert samme dag.»
Uten lenken er de to bunker som ingen kan knytte sammen.

### Områdeenheten pr. prosjekttype

**Nivå 1 er påkrevd, nivå 2 er valgfritt** — det er den samme formen i alle tre tilfeller:

| Prosjekttype | Nivå 1 (påkrevd) | Nivå 2 (valgfritt) | Emne-eksempel |
|---|---|---|---|
| **Vei** | trasé | 100 m pel fra–til | `Austadvegen P 50–150` |
| **VA** | trasé | **kumgruppe-spenn** | `SP-04 til SP-05` |
| **Bygg** | **byggeplass + etasje** | sone, hvis noen trenger det | `Bygg B12, 1. etasje` |

**Tomt nivå 2 er gyldig.** Kenneth: «Dersom det ikke pågår arbeid i austadvegen kan rapporten bli kun
austadvegen, en oppgave for den delen.» For bygg er «1. etasje for generelle bilder» nøyaktig det samme —
områderapporten dekker etasjen, uten å peke på et punkt.

**Grunnen til at VA ikke bruker 100 m:** kumgrupper står 60–80 m fra hverandre, satt av hvor langt
rørinspeksjonstraktoren rekker å filme (Kenneth 2026-09-22). Den naturlige strekningen i et VA-prosjekt er
kum til kum, og **emnet for den er alt låst**: `SP-04 til SP-05` (se UM1 v2-ordren). Da kobler
befaringsrapporten seg rett på kum- og strekningsdokumentene uten oversetting.

🔴 **Emnekonvensjonen er koblingsnøkkelen for hele fremdriftssporet** (designnotatet § 4d). Bruk den; ikke
innfør en parallell stedsnøkkel.

🔴 **Ikke bygg soner for bygg i denne runden.** Nivå 2 for bygg står som «hvis noen trenger det» fordi ingen har
bedt om det. En stor etasje kan kreve inndeling, men det er en måling som kommer av bruk — **ikke en modell som
skal finnes opp nå.** Et etasjenivå som virker, er bedre enn et sonenivå ingen fyller ut.

### 🔴 Gatet 2026-09-22: egen malversjon for bygg, men samme mekanisme

Kenneth: **«vi kan lage en tilpasset versjon for bygg».**

**Design leser det som: del malen, del ikke mekanismen.**

| Lag | Deles eller deles opp |
|---|---|
| **Mekanismen** (område + valgfri avgrensning, overlappsøk, dekningsvisning, punktrapport via oppgave) | **deles** — én implementasjon |
| **Malinnholdet** | **deles opp** — «Befaring anlegg» og «Befaring bygg» |

**Hvorfor mekanismen deles:** formen er identisk. Et område som er påkrevd, en avgrensning som er valgfri, og
et overlappsøk. Bare **kilden** til nivå 1 er ulik — en trasé for anlegg, `Drawing.floor` for bygg. To
implementasjoner av samme form ville driftet fra hverandre, og dekningsvisningen måtte bygges to ganger.

**Hvorfor malen deles opp:** innholdet er genuint ulikt. Feltet «arbeid som pågår» har ingen felles verdier —
graving, ledningslegging og kum mot råbygg, tett hus og innvendig komplettering. En felles mal med forgrening
på prosjekttype ville gitt et førstefelt hvis eneste jobb er å skjule halve malen, og to korte maler er
ærligere enn én lang med en bryter øverst.

**Følgen for § A5 pkt 1:** målingen skal ikke lenger lete etter én modell som passer begge. Den skal svare på
**om nivå 1 for bygg kan utledes av valgt tegnings `floor`** uten nytt felt, og hva trasé for anlegg krever.

### Konsekvens for etasjeregelen i tillegget

Områderapporten for en etasje peker på **etasjens tegning**. Dermed faller bildene fra den i **nivå 2** i
etasjeregelen (Del A-TILLEGG § AT.2b): riktig etasje, ingen eksakt posisjon — og de skal listes ved siden av
tegningen, ikke plasseres. **Punktrapportene** faller i nivå 1: eksakt markør, fordi oppgaven har posisjon.
**Det er den kombinasjonen Kenneth beskriver, og de to nivåene i etasjeregelen er nettopp de to
rapporttypene.**

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

1. **Hvor bor nivå 1 og nivå 2?** To spørsmål, ikke ett — Kenneth har gatet at bygg får egen malversjon, så
   målingen skal ikke lete etter én modell som passer begge:
   **(a)** Kan nivå 1 for **bygg** utledes av valgt tegnings `Drawing.floor` uten noe nytt felt?
   **(b)** Hva krever **trasé** for anlegg? Byggeplass, område (`KontrollplanPunkt.omradeId`), eller noe nytt?
   **Mål hva som finnes før du innfører en ny modell.** Design heller mot å gjenbruke det som finnes, men vil
   ikke velge uten målingen.
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

# Del A-TILLEGG — «vis bilder» som lag i tegningsvisningen

**Tilføyd 2026-09-22 etter Kenneths spørsmål:** «alle bilder logges og kan vises i en georeferert tegning.
hvordan fungerer det? Kan vi slå av og på vis bilder i en tegning?» → **«ja, skriv det som tillegg til Del A»**.

## AT.1 Målingen — nesten alt finnes, og det er feltverifisert

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

## AT.2 Hva som skal bygges

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

## AT.2b 🔴 RETTING: etasjer — GPS kan ikke skille dem

**Kenneth 2026-09-22:** «hvis en tegning vises i rapporten → la oss si det er et 3 etasjes bygg og rapporten
velger 1.etasje → knytter vi bildene til denne etasjen → eller klarer vi ikke å skille bilder fra 1 og 3 etasje
fra hverandre?»

🔴 **Design spesifiserte AT.2 feil, og Kenneth fanget det.** «Bilder med GPS innenfor tegningen vises» ville
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
ikke bestemmes». Samme mønster som utenfor-tellingen i AT.2 pkt 8, og samme regel som CLAUDE.md § «stille
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

## AT.3 Grenser

- **Ingen ny matematikk.** Alt går gjennom `georeferanse.ts`. Finner du behov for en ny transformasjon, er det
  et funn som skal meldes, ikke løses.
- **Ingen endring i hvordan bilder lagres eller GPS-tagges.**
- **Bilder-siden røres ikke.** Den virker; dette er et lag i en annen flate. Ser du duplisert logikk mellom
  dem, **meld det** — design vurderer om noe skal løftes til en delt komponent, men ikke i denne runden.
- Ingen migrering, med mulig unntak for brukerminnet i pkt 3: **mål om det finnes en lagringsvei før du lager
  en.**

## AT.4 DoD (Del A-TILLEGG)

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

## AT.5 Hva Kenneth skal ta stilling til

1. **Er 30 dager riktig standardperiode** for laget, eller vil du se hele prosjektet med gruppering i stedet?
2. **Skal laget vise alle prosjektets bilder, eller bare bilder fra befaringsrapporter?** Design heller mot
   **alle** — et bilde fra en kumsjekkliste er like nyttig på tegningen — men da blir det flere markører, og
   valget er ditt.

---

# Del B — befaringsmalen (mal-Opus)

## B1. Plasseringen — GATET av Kenneth 2026-09-22

**Dette er ikke en NS 3420-mal.** Den beskriver byggelederens egen befaring, ikke en post i en
mengdebeskrivelse.

**Målt av design 2026-09-22:** `BibliotekStandard.kode` er en **fri unik streng** (`schema.prisma:2283`) —
biblioteket kan bære en ikke-NS-standard.

✅ **Kenneth 2026-09-22: «ja, egen standard BYGGELEDELSE».** Vedtaket er tatt.

```
standardkode: "BYGGELEDELSE"
```

**Det legger en ny node øverst i bibliotektreet ved siden av de fire NS-standardene.** Bekreft i leveransen at
malvelgeren på web og mobil tåler det uten endringer — den grupperer i dag faggruppe → dokumentflyt → mal, og
standarden er et nivå over. **Finner du at den ikke tåler det, stopp og meld** — det er en app-endring, ikke en
malendring, og den skal ikke gjøres i denne branchen.

✅ **GATET 2026-09-22 — maltypene:** «sjekklistemal for selve befaringen med telling · oppgavemal for veg/VA og
Bygg».

**Standarden `BYGGELEDELSE` får fire maler:**

| Mal | Type | Dekker |
|---|---|---|
| `BEFARING-A` | **sjekkliste** | befaring anlegg — område, trafikklys, årsak, eksakt telling |
| `BEFARING-B` | **sjekkliste** | befaring bygg — etasje, trafikklys, årsak, fag + omtrentlig antall |
| `AVVIK-A` | **oppgave** | feil eller mangel, veg og VA — ett punkt med posisjon |
| `AVVIK-B` | **oppgave** | feil eller mangel, bygg — ett punkt med posisjon |
*(Referansene er designs forslag.)*

**Områderapporten er en sjekkliste** — den dekker et område og har ingen posisjon. **Punktrapporten er en
oppgave** — `Task` har `drawingId` + `positionX/Y` innebygd (`schema.prisma:1316`), og det er nettopp derfor
avviket hører der. Ingen ny dokumenttype skal bygges.

🔴 **Malinnholdet for de fire står i § B2 (befaring) og § B5 (avvik).**

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

**3. Arbeid som pågår** — `valg` · **den ENE forskjellen mellom de to malene, se § B2b**

*Befaring anlegg:*
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

### Bemanning og maskiner — ULIKT i de to malene

Kenneth 2026-09-22: «Antall mannskaper, antall gravemaskiner, antall hjullastere» — og deretter, om bygg:

> «på et bygg så teller mann opp i en etasje → i en annen etasje er det andre → noen går mellom etasjer mens
> befaringen pågår → det er vanskelig å holde telling med antall → tallene blir aldri helt rett. man kan telle
> pr fag»

🔴 **Det endrer hva feltet måler for bygg: kan tallet aldri bli riktig, skal malen ikke spørre om et riktig
tall.** Det som **er** pålitelig observerbart, er **hvilke fag som var der**. Ser byggelederen en elektriker
jobbe, er det et faktum uansett om han gikk ned en etasje fem minutter senere. Tilstedeværelsen er presis,
mengden er omtrentlig — og malen skal si det.

**Og det er tilstedeværelsen som veier i et sluttoppgjør:** «ingen tømrere på bygget i tre uker» er tungt. Om
det var fire eller fem den tirsdagen, endrer ingenting.

#### Befaring anlegg — eksakt telling, `heltall`

Ett lag på én arbeidsstuff. Da er en eksakt telling både mulig og meningsfull.

**4a. Antall mannskaper** — `heltall`

> Hvor mange arbeidere som var på stedet da du var der. Null er et gyldig og viktig svar.

**4b. Antall gravemaskiner** — `heltall`

**4c. Antall hjullastere** — `heltall`

> Annet utstyr skriver du i kommentaren. Tellingen skal gå fort — poenget er utviklingen over tid, ikke et komplett maskinregister.

#### Befaring bygg — fag eksakt, antall omtrentlig

**4a. Fag til stede i etasjen** — `list_multi`
- Tømrer
- Elektro
- Ventilasjon
- Rørlegger
- Grunn- og utomhusarbeid
- Annet fag – se kommentaren

> Kryss av for fagene du faktisk så arbeide i denne etasjen. Ingen avkryssing betyr at ingen arbeidet her da du var innom — og det er et gyldig og viktig svar.

**4b. Omtrentlig antall personer i etasjen** — `heltall`

> Anslå. Folk går mellom etasjer mens befaringen pågår, så tallet blir aldri helt presist — det er derfor det heter omtrentlig. Fagene over er den presise delen.

🔴 **Ordet «omtrentlig» skal stå i etiketten, ikke bare i hjelpeteksten.** Da er upresisheten en del av
dokumentet i stedet for en skjult svakhet, og tallet kan ikke angripes som en usann eksakt påstand.

**Ingen maskinfelt for bygg.** Kran og lift står der hele byggetiden — å telle dem ved hver befaring gir ingen
informasjon. Maskiner i bruk skrives i kommentaren når det er verdt å nevne.

#### Regelen som følger av dobbelttellingen

🔴 **Månedsrapporten skal ALDRI summere bemanning på tvers av etasjer.** Én mann som gikk mellom to etasjer,
ville blitt to. Visningen er **pr. fag pr. etasje over tid** — aldri en totalsum for bygget. Ført inn i
BACKLOG-posten.

**Områderapporten er pr. etasje, og det er det som redder tellingen:** tallet er «observert i 1. etasje, denne
dagen» — en ærlig påstand, ikke en påstand om hele bygget.

#### Forkastet i denne runden, og hvorfor

Kenneth foreslo «bruke foreldre, barn, flervalg» — altså `list_multi` som forelder med et `heltall`-barn pr.
valgt fag. **Design anbefalte mot det nå, av to grunner, og Kenneth gatet anbefalingen:**

1. **Frekvensen avgjør.** 2–3 befaringer i uken. Et felt som tar tjue sekunder blir fylt ut; et som tar to
   minutter blir det ikke — og et tomt felt bryter den ubrutte serien, som er hele poenget med sporet.
2. 🔴 **Det er umålt om `list_multi` kan være forelder.** Alle forgreninger i biblioteket bruker `valg`
   (enkeltvalg). Om betingelseslogikken håndterer en verdi som er en **liste**, vet ingen.
   **Mål det og meld det** — ikke som del av denne malen, men som et funn. Er svaret ja, er antall-pr-fag en
   ren revisjon senere, ikke en omskriving.

🔴 **Disse tre er unntaket fra MAL-METODE §1 «ingen tallfelt», og unntaket skal begrunnes i seed-kommentaren.**
§1 finnes for at normkrav skal besvares som **samsvar** og ikke som en måleverdi som hører i en protokoll.
**Her finnes ingen protokoll og ingen norm:** tellingen er selve observasjonen, den har ingen annen plass å bo,
og et `valg` med intervaller («1–3», «4–6») ville gjort summering over en måned meningsløs. **Heltall er
riktig.** Bygg dem som `heltall`, ikke som `valg`.

🔴 **Hvorfor feltet er viktigere enn det ser ut — og det skal stå i seed-kommentaren:** byggherren har **ingen
tilgang til entreprenørens dagsseddel**. Entreprenøren kan måle timene sine; byggherren har bare øynene sine.
**Bemanningstellingen er byggherrens eneste måling av innsats** — hans motstykke til dagsseddelen. Den gjør også
årsaken «ingen mannskap på anlegget» (felt 2) til et tall i stedet for en påstand: «0 mannskaper, 12. mai» er
dokumentasjon.

**Sammenhengen med månedsrapporten** (BACKLOG § 3, Kenneth: «Månedsrapport er backlogg jobb»): tre målinger mot
entreprenørens plan — **posisjon** mot planens dato, **bemanning** mot planens forutsatte lag, og
**fargefordeling med årsaker**. Antok planen seks mann og to maskiner, og tellingene i mai viser to mann og null
maskiner, er forsinkelsen forklart med tall og ikke med en formulering som kan bestrides.

**5. Sikring og orden på stedet** — `valg` · **ordlyd varierer, se § B2b**
- I orden
- Avvik – varslet
- Ikke aktuelt her

*Befaring anlegg:*
> Gjelder byggelederens observasjon av at skilting, gjerder og grøftesikring er på plass. Dette er en observasjon, ikke en HMS-behandling — avvik meldes i HMS-sporet.

**6. Befaringen er ført og sendt** — `trafikklys`

> Rapporten er datert, ført og sendt til motparten. En rapport som ikke er sendt, finnes ikke i et sluttoppgjør.

## B2b. To maler — «Befaring anlegg» og «Befaring bygg»

**Gatet av Kenneth 2026-09-22:** «vi kan lage en tilpasset versjon for bygg.» Begrunnelsen for å dele malen og
ikke mekanismen står i § A2.

```
referanse: "BEFARING-A"   navn: "Befaring anlegg – byggelederens rapport"
referanse: "BEFARING-B"   navn: "Befaring bygg – byggelederens rapport"
```
*(Referansene er designs forslag og henger på vedtaket i § B4 pkt 1.)*

**Hva som deles og hva som varierer:**

| Felt | Deles ordrett | Varierer |
|---|---|---|
| 1 fremdrift — alternativer | ✅ | hjelpetekstens emne-eksempel |
| 2 årsak | ✅ | — |
| 3 arbeid som pågår | — | **hele feltet** |
| 4 bilde | ✅ | — |
| **4a–4c bemanning** | — | **hele blokken** (§ B2) |
| 5 sikring — alternativer | ✅ | hjelpeteksten |
| 6 ført og sendt | ✅ | — |

🔴 **Felt 1, 2, 4 og 6 skal være ord for ord de samme, og svaralternativene i 1, 2 og 5 likeså. Fasiten skal
låse det** — drifter de to fra hverandre, blir rapportene usammenlignbare, og hele poenget med å telle farger
og årsaker over tid faller. Det er samme regel som gjorde at fasitfilen ble innført.

🔴 **Bemanningsblokken deles IKKE**, og det er bevisst: anlegg teller eksakt, bygg teller fag eksakt og antall
omtrentlig (§ B2). Delt-tekst-testen skal derfor **ikke** kreve likhet i 4a–4c — men den skal kreve at
**fargefeltet og årsakslisten er identiske**, siden det er de som skal telles på tvers av prosjekttyper.

**Det som varierer:**

**Felt 3, «Arbeid som pågår» — Befaring bygg:**
- Grunn og fundament
- Råbygg
- Tett hus – tak, vinduer og fasade
- Tekniske fag
- Innvendig komplettering
- Utvendig komplettering og utomhus
- Ingen aktivitet
- Annet – se kommentaren

> Hva som faktisk foregikk da du var der. Feltet gjør rapportene sammenlignbare over tid, og det er det som viser når en aktivitet står stille fra uke til uke.

**Felt 5, hjelpetekst — Befaring bygg:**

> Gjelder byggelederens observasjon av at rekkverk, dekkeåpninger, stillas og adkomst er sikret, og at det er ryddet. Dette er en observasjon, ikke en HMS-behandling — avvik meldes i HMS-sporet.

**Felt 1, hjelpetekst — Befaring bygg** (emne-eksempelet byttes):

> Skriv byggeplass og etasje i emnefeltet, slik de står på tegningen: Bygg B12, 1. etasje. Grønn krever ingen forklaring. Gul og rød krever at du sier hva som ikke fungerer.

🔴 **Ikke lag en felles mal med forgrening på prosjekttype.** Det ville gitt et førstefelt hvis eneste jobb er å
skjule halve malen. To korte maler er ærligere enn én lang med en bryter øverst — og det er den ene gangen i dag
forgrening **ikke** er svaret.

## B3. Rammer og DoD (Del B)

- Vedtaket i § B4 må være gatet **før** standarden eller malene opprettes.
- **Strukturtest:** årsaksfeltet er barn av fremdriftsfeltet, med **to** utløsere (Gul, Rød), og er ikke
  alltid synlig — **i begge maler**. Rød først. Bruk `forgrening` og `BETINGELSE_EGEN_NOKKEL`, aldri
  `conditionValues`.
- 🔴 **Delt-tekst-test:** en test som låser at felt 1, 2, 4 og 6 og svaralternativene i felt 1, 2 og 5 er **ord
  for ord identiske** mellom `BEFARING-A` og `BEFARING-B`. Rød først. **Bemanningsblokken (4a–4c) er unntatt** —
  den skal være ulik, se § B2b. Uten testen drifter fargefeltet og årsakslisten fra hverandre, og statistikken
  blir usammenlignbar på tvers av prosjekttyper.
- 🔴 **Tallfelt-unntaket** (§ B2) skal begrunnes i seed-kommentaren, med Kenneths ord og med hvorfor §1 ikke
  gjelder her. Ellers blir feltene fjernet av neste runde som «brudd på §1».
- 🔴 **Meld målingen:** kan `list_multi` være forelder i en `forgrening`? Alle forgreninger i biblioteket bruker
  `valg`. Svaret bestemmer om antall-pr-fag kan bygges som revisjon senere (§ B2). **Bygg det ikke nå — bare
  mål og meld.**
- §7b: ingen `NS 3420`, `NS-EN`, `Matrise`. Ingen i18n-nøkler.
- Fasit (§8) og `skriv-mal` viser treet. Gate-tall via `pnpm exec turbo run test --force`.
- SQL: **ikke kjør mot test selv.** Parse-test mot engangsdatabase, slett den, lever de tre enlinjerne.
- Leveranse nederst i hovedtreets `relay/inbox-design.md` + «design har post».

## B5. Oppgavemalene for avvik — `AVVIK-A` og `AVVIK-B`

**Gatet 2026-09-22:** «oppgavemal for veg/VA og Bygg». Dette er punktrapporten Kenneth beskrev: «egen rapport for
en feil/mangel som oppdages».

🔴 **MÅL FØRST, og meld: hvilke felt har `Task` allerede innebygd?** Tittel, beskrivelse, frist, ansvarlig og
posisjon er sannsynligvis native på oppgaven. **Malens felter skal bare legge til det som IKKE finnes.** Dupliserer
malen frist eller ansvarlig, får byggelederen to steder å skrive samme ting, og de kan bli ulike. **Finner du at
et felt finnes native, ta det ut av malen og meld det.**

### Felles i begge avviksmaler — ordrett

**1. Hva er avviket** — `valg` · **den ENE forskjellen, se under**

**2. Må rettes før** — `valg`
- Før arbeidet går videre på dette punktet
- Før overtakelse
- Ingen frist – registreres for oppfølging

> Sier hvor mye det haster, ikke en dato. Dato settes på oppgaven.

**3. Avviket er dokumentert med bilde** — `trafikklys`

> Ta bilde av avviket, og av omfanget hvis det er større enn ett punkt. Oppgaven bærer posisjonen på tegningen, så bildet trenger ikke vise hvor du står.

**4. Motparten er varslet** — `valg`
- Varslet på stedet
- Varslet ved oversending av oppgaven
- Avvik – ikke varslet ennå

> Et avvik motparten ikke er varslet om, har liten verdi i et oppgjør. Sier du det på stedet, skriv hvem du snakket med i kommentaren.

### Felt 1 — `AVVIK-A`, veg og VA

- Grøft, fundament eller komprimering
- Ledning, kum eller skjøt
- Dekke, kantstein eller asfalt
- Grøftesikring eller trafikkavvikling
- Skade på eksisterende anlegg eller kabel
- Rydding og orden
- Annet – se kommentaren

### Felt 1 — `AVVIK-B`, bygg

- Utførelse eller håndverk
- Manglende arbeid
- Avvik fra tegning eller beskrivelse
- Skade
- Fukt eller tetthet
- Sikring, adkomst eller rydding
- Annet – se kommentaren

🔴 **Felt 2, 3 og 4 skal være ord for ord identiske i de to avviksmalene**, av samme grunn som fargefeltet i
befaringsmalene: de skal kunne telles på tvers av prosjekttyper. Delt-tekst-testen dekker begge par.

🔴 **Avviket skal kunne opprettes FRA befaringen** (§ A2), slik at kjeden finnes: befaring 12. mai, gul, årsak
*venter på leveranse*, og disse fire avvikene. **Om det krever en app-endring, er det et funn som skal meldes —
ikke løses i malbranchen.**

## B4. Hva Kenneth skal ta stilling til før SQL

1. ~~**Hvor bor malen?**~~ ✅ **GATET 2026-09-22: «ja, egen standard BYGGELEDELSE».** Se § B1.
1b. ~~**Oppgave-mal eller sjekkliste-mal?**~~ ✅ **GATET 2026-09-22:** sjekklistemal for befaringen, oppgavemal for
   avvik — fire maler i alt, se § B1 og § B5.
2. **Årsakslisten** i felt 2 — åtte valg, designs forslag. Mangler noen? Er noen overflødige? Listen skal
   være kort nok å velge fra på telefon i en grøft.
3. ✅ **Felt 5, sikring og orden: GATET 2026-09-22 — «ta det med».** Feltet blir stående i begge maler, som
   byggelederens **observasjon** og ikke som HMS-behandling. Avvik meldes fortsatt i HMS-sporet (MAL-METODE §1d) —
   den grensen står.
4. **Ansvarsside pr. årsak** (designnotatet § 4c) er **ikke** i denne malen. Den hører i rapporten og
   uttrekket, ikke i utfyllingen — byggelederen skal registrere hva som skjedde, ikke hvem som skal betale.
   Bekreft at det er riktig.
5. **Bemanning — gatet 2026-09-22**, se § B2. Anlegg: eksakt telling av mannskaper, gravemaskiner, hjullastere.
   Bygg: `list_multi` fag + omtrentlig antall, fordi «tallene blir aldri helt rett». Design har bevisst **ikke**
   lagt inn dumper, valse, borerigg eller lastebil på anlegg, og ingen maskinfelt på bygg. **Ett åpent punkt:**
   er **fagliste for bygg** riktig — tømrer, elektro, ventilasjon, rørlegger, grunn- og utomhusarbeid, annet?
   Du nevnte de tre første. Hvert valg koster tid ved hver befaring, 2–3 ganger i uken, så listen skal være kort
   nok å krysse av på telefon.
