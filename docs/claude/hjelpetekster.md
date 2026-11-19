---
name: hjelpetekster
description: Konvensjon for hjelpetekst-ikon (?) på hver side i SiteDoc, inkl. sidestatus-tabell over hvilke sider som har hjelpetekst.
sist_verifisert_mot_kode: 2026-05-02
---

# Hjelpetekster per side

Hver side i SiteDoc skal ha en hjelpetekst tilgjengelig via hjelp-ikonet (?) øverst til høyre. Hjelpeteksten bygges når siden bygges, og oppdateres når siden endres.

**Referanseimplementasjon:** Kontakter-siden (`/oppsett/brukere`) med tre faner.

```tsx
<HjelpKnapp>
  <HjelpFane tittel="Hva er dette?">
    <p>Forklaring av siden...</p>
  </HjelpFane>
</HjelpKnapp>
```

## Når en ny side bygges

1. Lag hjelpetekst i samme PR — ikke i en separat oppgave
2. Minimum: hva siden er til for (én setning), hvem som kan bruke den (rolle-krav), viktigste handlinger
3. Bruk eksempler med norske navn (Ola, Trude, Per) — ikke abstrakte beskrivelser

## Når en eksisterende side endres

1. Oppdater hjelpeteksten i samme PR
2. Sjekk at begreper stemmer med nye navn
3. Hvis siden rename-es: hjelpeteksten rename-es samtidig

## Konsistente begreper

- "Faggruppe" — en deltaker i dokumentflyten på et prosjekt (Byggherre, Tømrer, Elektro). ALDRI "Entreprise"/"Enterprise"/"Part". Engelsk: "Trade group". Prisma: `Faggruppe`, DB: `dokumentflyt_parts`
- "Dokumentflyt" — rute mellom to faggrupper (bestiller → utfører → godkjenner). DB: `Dokumentflyt`
- "Firma" — selskapet som eier SiteDoc-kontoen (A.Markussen AS). DB: `Organization`
- "Firmamodul" — modul som gjelder hele firmaet på tvers av prosjekter (Timer, Maskin, Kompetanse, Planlegging)

## Sidestatus ?-ikon

Hvilke sider som har `?`-hjelp er utledbart fra koden — en håndført tabell råtner
(sto med 7 sider feilmerket ❌ mens de faktisk hadde `HjelpKnapp`). Kjør i stedet:

```bash
# Sider MED ?-hjelp:
grep -rl "HjelpKnapp" apps/web/src/app --include=page.tsx | sort

# Sider UTEN (kandidater for å legge til):
comm -23 \
  <(find apps/web/src/app -name page.tsx | sort) \
  <(grep -rl "HjelpKnapp" apps/web/src/app --include=page.tsx | sort)
```

`HjelpKnapp` (eksportert fra `apps/web/src/components/hjelp/HjelpModal.tsx`) er
kilden — er den importert og rendret på siden, har siden `?`-hjelp.

## Mobil: Søk (`apps/mobile/app/sok/index.tsx`)

Mobil har `HjelpIkon` (`apps/mobile/src/components/HjelpIkon.tsx`, se § Mobil: Tillegg og Utlegg), men søkeskjermen bruker
den ikke ennå; teksten under er vedtatt hjelpetekst for søkeskjermen.

- **Hva er dette?** Søk i hele prosjektet fra ett felt. Skriv minst to tegn og trykk Søk. Åpnes fra søke-ikonet på
  Hjem og i Mapper, eller fra raden «Søk … i hele prosjektet» under søkefeltet i oppgave-, sjekkliste- og HMS-lista
  (da er lista du kom fra valgt, og teksten er tatt med).
- **Alle · Mapper · Sjekklister · Oppgaver · HMS:** «Alle» viser treff fra alle fem, med de ti første i hver gruppe.
  Trykk på en gruppe for å se alle treffene der.
- **Mapper** søker i teksten inni dokumentene. Trykk et treff for å lese stedet i dokumentet; pilene går mellom
  treffene, og «Åpne dokumentet» viser hele fila. Krever nett.
- **Sjekklister og oppgaver** søker på nummer, tittel og mal — ikke på det som er fylt ut. Uten nett søkes den
  lagrede versjonen på telefonen (for eksempel finner Ola oppgave «OPP12» selv i kjelleren uten dekning).
- **HMS** søker i avvik, SJA og RUH samtidig; hvert treff viser hvilken type det er. Også uten nett.

## Mobil: Filter og sortering i sjekkliste-, oppgave-, innboks- og HMS-lista (`FilterOgSorteringSheet.tsx`)

Trakt-arket har ikke `HjelpIkon` ennå; vedtatt tekst, brukes når arket får ikonet.

- **Hva er dette?** Snevre inn og ordne lista. Bare valg som finnes i lista vises.
- Gjelder sjekklister, oppgaver og innboksen (innboksen har ikke prioritet).
- **Ballen hos meg:** viser bare dokumenter der du eller gruppa di har ballen nå. Krever nett og at lista er hentet
  fra serveren — uten dekning, eller mens lista viser den lagrede versjonen, er bryteren skjult.
- **Sortering:** opprettet, sist endret, sendt, frist, nummer, emne eller navn — sendt, frist, nummer og emne vises
  bare når lista har slike verdier. Trykk en brikke for å sortere på den; trykk igjen for å snu retningen, tredje trykk fjerner den.
  Velg opptil tre for å sortere videre innenfor like verdier («Frist ↑, deretter Nummer ↓»). Dokumenter uten verdi
  havner sist. Hjelpelinja i arket: «Trykk igjen for å snu · tredje trykk fjerner». Aktiv sortering vises som egen
  brikke over lista; trykk den for å gå tilbake til nyeste først. Under søk sorteres treffene etter relevans.
- **Hva:** emne (også «Uten emne»), mal og — for oppgaver — prioritet.
- **Når:** frist (har frist, ingen frist, forfalt — avsluttede og avbrutte regnes ikke som forfalt) og periode. Velg
  først hvilken dato perioden gjelder — opprettet, sendt, godkjent eller lukket (bare datoene lista har) — så tidsrom.
  Chipen over lista sier hvilken, f.eks. «Sendt: Siste uke». (M-pakke 2026-11-04)
- **Hvem:** hvem som opprettet det, mottaker/ansvarlig, bestiller- og utførerfaggruppe, og hvem som sendte, godkjente,
  lukket eller fylte ut. «Utfylt av» treffer alle som har fylt ut noe i dokumentet, ikke bare den siste.
- **Hvor:** område, tegning og dokumentflyt. Byggeplass velges med chipen over lista, ikke her.
- Aktive filtre vises som chips over lista; trykk × for å fjerne ett, eller «nullstill filter» for alle.

## Mobil: Prosjektkortet (`app/timer/[id]/kort/[projectId].tsx`, 36c-kort)

Kortskjermen har ikke sidehjelp ennå; overskriftene «Tillegg» og «Utlegg» på kortskjermen har `HjelpIkon` (se § Mobil: Tillegg
og Utlegg). Vedtatt tekst for kortskjermen:

- **Hva er dette?** Ett kort = arbeid, maskiner, varer, tillegg og utlegg på ett prosjekt, én byggeplass og ett underprosjekt den dagen.
- **Endre kort:** flytter hele kortet til et annet prosjekt, en annen byggeplass eller et annet underprosjekt. Finnes
  et kort med det du velger fra før, står de som to kort, hver med sin beskrivelse; overlapper tidene, må de rettes først
  (endret 2026-11-16, Kenneth: «sjekk om tidspunkter kolliderer, hvis ikke registrer hver for seg»). Tillegg og utlegg følger kortet; reise blir liggende på dagen. Får ikke telefonen flyttet
  varene på serveren, blir timene flyttet og varene stående på det gamle kortet — trykk «Endre kort» der en gang til.
- **Slett kort:** sletter arbeid, maskiner, varer, tillegg og utlegg på kortet. Reise beholdes. Er det dagens siste kort, blir dagsseddelen stående som tomt utkast.
- Begge knappene finnes bare mens dagsseddelen er utkast eller returnert. Varer som alt er sendt, må endres på serveren —
  uten dekning er knappene sperret.

## Mobil: Kort-id og fraværskort (kort-id-spec § 8.2, ordre c, 🟡 ikke merget)

Ingen ?-tekst; knappene forklarer seg selv (i18n, 15 språk):
- **«Del til eget kort»** (`timer.bekreftDag.kort.delTilEgetKort`) i Bekreft dag: «Tiden før klokkeslettet blir i dette kortet. Tiden etter blir et nytt kort på samme prosjekt, med egen beskrivelse.» (`delTekst`). −/+ i firmaets tidsrunding, «Del kl. {kl}». «Slå sammen igjen» (`slaaSammen`) angrer før lagring (🟢 Kenneth 2026-11-16).
- **«+ Fravær»** (`timer.fravaerKort.leggTil`) på dagskortet og i Bekreft dag: fraværskort uten prosjekt — fraværsart, timer (forhåndsutfylt med resten av dagsnormen; tomt når normen er ukjent eller brukt opp) og beskrivelse (påkrevd, F4). −/+ går i firmaets tidsrunding, uten runding 0,5 t (🟢 Kenneth 2026-11-16). Sperretekster `timer.fravaerKort.sperret.*`.
- **«Flytt til nytt kort»** (`timer.kortValg.flyttNyttKort`) i «Flytt raden»: raden får et nytt kort, også når prosjekt, byggeplass og underprosjekt er de samme som et kort som finnes. Vises bare for timerrader, og bare når det gir en forskjell.
- **«Endre kort»** til et prosjekt som alt har kort: kortet beholder sin id og står som eget kort med sin egen beskrivelse. Overlapper tidene, vises samme feiltekst som når en rad lagres (`timer.feil.overlapp`). Ingen merknad om sammenslåing (fjernet, Kenneth 2026-11-16).

## Mobil: Tillegg og Utlegg (`HjelpIkon`, Bekreft dag + prosjektkortet)

`HjelpIkon` (`apps/mobile/src/components/HjelpIkon.tsx`) er mobilens ?-ikon: står ved overskriften det forklarer, trykk
åpner et ark med tittel og tekst. Brukt ved «Tillegg» og «Utlegg» i Bekreft dag (`BekreftDagLonnUtlegg.tsx`) og i
kortskjermen (`app/timer/[id]/kort/[projectId].tsx`, spec tillegg-utlegg-prosjektkort, 🟡 `feat/timer-tillegg-utlegg-kort`). Tekstene ligger i i18n (`hjelp.tillegg.*`, `hjelp.utlegg.*`, 15 språk).

- **Tillegg** (`hjelp.tillegg.tekst`, Kenneths tekst): «Tillegg er lønn du har krav på i tillegg til timelønnen, fordi
  arbeidet ble gjort under bestemte forhold. Eksempler: smusstillegg, høydetillegg, kosttillegg, bastillegg. Tillegget føres på prosjektkortet og får kortets byggeplass og underprosjekt.»
- **Utlegg** (`hjelp.utlegg.tekst`, Kenneths tekst): «Utlegg er penger du har lagt ut selv for firmaet, og som du skal ha
  tilbake. Ta bilde av kvitteringen. Eksempler: parkering, bompenger, verktøy kjøpt i butikk, drivstoff til firmabil. Utlegget føres på prosjektkortet og får kortets byggeplass og underprosjekt.»
- I Bekreft dag lagres linjene først ved [Bekreft og lagre], på første dato som ikke er sendt. Er alle datoene sendt,
  får du beskjed, og ingenting lagres.
- I Bekreft dag med flere kort viser hver linje kortvalget «Kort» (`timer.bekreftDag.lonnUtlegg.kortValg`): trykk på
  kortet linja hører til. Forvalgt er kortet med flest timer. Ett kort → ingen valg.

## Mobil: Bekreft dag — utkast (`app/timer/bekreft-dag.tsx`)

`HjelpIkon` i toppen av Bekreft dag (`timer.bekreftDag.utkastHjelpTittel` / `utkastHjelpTekst`, 15 språk):
«Det du fører lagres på telefonen mens du jobber. Går du ut, ligger det klart neste gang du åpner dagen. Ingen andre
ser det før du trykker Bekreft. Forkast sletter det.»

- Sekundærknappen heter «Fortsett senere» med hint «Lagres på telefonen. Lederen ser ingenting før du bekrefter.» når
  noe er ført, ellers «Ikke nå».
- «Fortsetter der du slapp (kl.)» øverst når et utkast er gjenopprettet; «Lagret automatisk» i handlingsfeltet.
- **Reisekjeden (ordre (17)):** ingen ?-tekst — linjene forklarer seg selv. «Reise X → Y 06:30–07:00 · 30 min» /
  «Overføring X → Y …» (`timer.bekreftDag.reiseRute` / `overforingRute` + `kjedeMin`); trykk på tiden for å rette,
  merket «Rettet» (`kjedeRettet`) med Angre. «Ankomst» (`ankomst`) viser «Beregnet {tid}» (`beregnet`) og «Målt {tid}»
  (`maalt`, kilde `maaltKilde.gps_forslag` = «Ankommet»). Konflikt: «Reisen 07:00–07:40 overlapper 07:30–15:00. Rett en
  av tidene før du lagrer.» / «Reisen går over midnatt. Rett tidene før du lagrer.» (`kjedeKonflikt.*`); sperretekst på
  «Bekreft og lagre»: `sperre.kjedeKonflikt`. Prosjektkortet viser overlapp mellom lagrede rader med `timer.feil.overlapp`.
- Merke i Timer-lista (`DagsseddelListe.tsx`): «Ikke bekreftet» (`timer.utkast.ikkeBekreftet`) — ved siden av statusen, eller på egen rad med 0 t når datoen ikke har sedel.

## Web: Mine timer — «+ Registrer timer» (w2 i web-timeføring, 🟡 ikke merget, `feat/web-timer-w2`)

`apps/web/src/app/dashbord/timer/mine/page.tsx` har `HjelpKnapp` (fanen «Mine timer», `timer.mine.tittel`) ved knappen:

- **Registrer** (`timer.mine.hjelp.registrer`): «+ Registrer timer» fører en jobb på prosjektet i toppen; første gang på en dato lages dagen med firmaets arbeidstid og byggeplassen i toppen; uten prosjekt i toppen velges prosjekt først.
- **Dagen** (`timer.mine.hjelp.dagen`): neste jobb legges på samme dag med Fra der forrige jobb sluttet; sendt dag gjenåpnes først; attestert → lederen må returnere; «Send dagen» sender alle jobbene samlet.
- **Dato** (`timer.mine.hjelp.dato`): dd.mm., med år når lista spenner over flere år.

Knappetekster: «Registrer timer» (`timer.registrerTimer`, også tittelen på prosjektvelgeren når dagen åpnes uten prosjekt) og nederst på dagen «+ Registrer timer» · «neste jobb, samme eller annet prosjekt» (`timer.prosjektkort.registrerTimer`, `…registrerTimerHint`). Dagskort-modus viser «Ny dagsseddel» som før.

## Web: Timerad på maskin (`dashbord/timer/[id]/page.tsx`, ordre d2c-1, 🟡 ikke merget)

Dagsseddel-siden på web har ikke ?-ikon. Hjelpen står i skjemaet der valget tas (`timer.felt.timerad`, `timer.maskinTimerad.*`, `timer.fjernTimerRad.*`, 15 språk):
- **Maskinvinduet, «Timerad»:** nedtrekk med kortets timerader («07:00–11:00 · 4 t»), forvalgt når kortet har én. Står «(valgfritt)» når maskinen leies pr. døgn.
- **Uten valgt timerad:** «Velg timeraden maskinen gikk på.»
- **Kortet har ingen arbeidsrad:** «Før timeraden maskinen gikk på først — maskinen står på den.» (også som hint under feltet)
- **Slett timerad med maskin:** tittel «Slette timeraden?», teksten «Raden har 2 maskiner: Volvo EC220E, Dumper. De slettes sammen med raden.» og knappen «Slett rad og maskiner». Døgn-maskiner nevnes ikke; de blir stående uten timerad.

## Web: Maskin høyst jobbens arbeid (web-timeføring w9, 🟡 ikke merget)

Ingen ?-fane; teksten står ved feltet og i attesteringen (`timer.maskin.*`, `timer.attestering.*`, 15 språk):
- **Ved maskinens timer-felt** (registreringen, Rediger sedel, dagssidens maskinvindu og timerad-vindu): «høyst 4,5 t» (`timer.maskin.hoyst`). Rød når tallet er over; Lagre er da sperret med forklaringen «En maskin har flere timer enn høyst-grensen for jobben. Rett maskintimene først.» (`timer.maskin.overHoystSperret`). Døgn-maskiner har ingen grense.
- **Når serveren avviser:** «END-002: maskin 7,5 t, arbeid 4,5 t. En maskin med fører kan ikke ha flere timer enn arbeidet på jobben. Rett maskintimene, eller flytt hele jobben.» (`timer.maskin.overArbeidAvvist`, på brukerens språk).
- **Attestering, jobbraden:** merket «Maskin over arbeid» (`timer.attestering.merkeMaskinOverArbeid`) med hover «Maskin 7,5 t, arbeid 4,5 t» (`timer.attestering.forklaringMaskinOverArbeid`). Jobben kan attesteres.

## Mobil: Timerad på maskin (`MaskinSeksjon.tsx`, `ProsjektkortDagsoversikt.tsx`, ordre d2c-2, 🟡 ikke merget)

Samme tekster som PC (d2c-1). Hjelpen står i skjemaet der valget tas (`timer.felt.timerad`, `timer.maskinTimerad.*`, `timer.fjernTimerRad.*`, 15 språk):
- **Maskinvinduet, «Timerad»:** felt som åpner lista over arbeidsradene («07:00–11:00 · 4 t»), tomt felt viser «— Velg timerad —». Forvalgt når det er én. «(valgfritt)» når maskinen leies pr. døgn, og da kan valget tømmes.
- **Ingen arbeidsrad:** «Før timeraden maskinen gikk på først — maskinen står på den.» under feltet.
- **«Flytt» av maskin til et kort uten arbeidsrad:** «Kortet har ingen timerad maskinen kan stå på. Før timeraden der først, eller velg et annet kort.»
- **Timerad gjøres om til reise:** «Raden bærer maskinen «Volvo EC220E» og kan ikke bli reise. Flytt maskinen til en annen timerad, eller fjern den først.»
- **Slett timerad med maskin (prosjektkort-modus):** som PC — «Slette timeraden?» og «Slett rad og maskiner».

## Web: 3d-visning (`dashbord/[prosjektId]/3d-visning/page.tsx:297-319`, ORDRE 3D-web 5 / gate (85) M3, 🟡 ikke merget)

Siden hadde ikke ?-ikon før. `HjelpKnapp` står sist i verktøylinja, etter Snitt-gruppa (`3d.hjelp.*`, 15 språk):
- **Hva er dette?** Prosjektets IFC-modeller i 3D; klikk på et objekt for egenskaper.
- **Mus:** venstre knapp roterer rundt det som er midt på skjermen (legg det du vil se på midt i bildet først); høyre knapp flytter bildet; hjulet går fram og tilbake mot midten av skjermen — raskt langt unna, sakte nær en flate ([3d-agent-prinsipper.md § 3b](3d-agent-prinsipper.md) punkt 1, 2, 2b).
- **Snitt:** trykk Snitt og dobbeltklikk på en flate; «Fjern alle» tar bort snittene.
- **Objekter langt unna:** skjult som standard; ofte feil i eksporten fra arkitektens tegning (informasjonsfiler lagt et stykke unna). Kryss av «Vis objekter langt unna»; tallet viser hvor mange. Bryteren vises bare når modellen har slike objekter (§ 3b punkt 3).
- Vakt: `apps/web/src/lib/__tests__/tred-hjelpetekst.test.ts`.

## Web: Avstander-fanen (`firma/oppmotesteder/page.tsx` + `AvstanderFane.tsx`, POST 2026-11-14 (10))

?-ikonet på Oppmøtesteder viser egen hjelp når fanen «Avstander» er åpen (`firma.avstander.hjelp.*`):

- **Hva er dette?** Kjøreavstand og kjøretid fra hvert oppmøtested til hver byggeplass med plassering i aktive prosjekter. Beregnes automatisk når byggeplassen får plassering.
- **Måles i:** «Måles i» under Reise-regelsett avgjør hovedverdien — km gjør avstanden redigerbar, minutter gjør kjøretiden redigerbar. Den andre verdien vises grått.
- **Manuell:** en rettet verdi merkes «Manuell», brukes i reiseberegningen og overskrives aldri av ny beregning. Flyttes byggeplassen eller oppmøtestedet, står verdien, men merkes. «Tilbakestill» fjerner den og beregner på nytt.
- **Status:** «Ingen rute» = ingen kjørbar vei; «Ikke beregnet» = paret mangler verdi, trykk «Beregn».
- **Kjøretid** vises som «1 t 35 min» over én time og «45 min» under (`timer.kjoretid.*`, ordre 2026-11-14 (11) B). Redigering skjer i minutter.
- **Mellom oppmøtesteder** (`firma.avstander.hjelp.kontor`, POST 2026-11-15 (13) L2): kjøretid mellom firmaets oppmøtesteder, vist når firmaet har minst to. Brukes til overføringsforslaget i Bekreft dag første og siste dag i en midlertidig periode. Kan rettes («Manuell») og tilbakestilles som byggeplass-avstandene.

## Web: Oppmøtested — adressesøk (`firma/oppmotesteder/OppmotestedModal.tsx`, TILLEGG 2026-11-15 (13) L2 del C)

- «Geokod» søker i Kartverkets adresser (`oppmotested.geokod` → `sokAdresser`), samme søk og treffliste (`components/AdresseTreffliste.tsx`) som byggeplass. Ett treff settes direkte; flere vises som klikkbar liste. Valgt treff setter punktet og adresseteksten.
- Skrivemåter som «sommerfeldtsgate», «Storgt.», «vn» og avsluttende «Norge» prøves automatisk normalisert når første søk gir 0 treff (gjelder også byggeplass).
- 0 treff (`firma.oppmotested.geokodIngen`): «Fant ingen treff på adressen. Du kan likevel lagre stedet: klikk i kartet for å sette punktet.» Lagre sperres ikke av 0 treff — bare av manglende punkt.
- Under lista: «Adressedata © Kartverket» (`georef.attribusjonKartverket`).

## Web og mobil: «Prosjekter i andre firma» i prosjektvelgeren (POST 2026-11-15 (15))

- **Gruppeoverskrift:** «Prosjekter i andre firma» (`prosjektVelger.andreFirma`).
- **Forklaring:** «Du er medlem av disse prosjektene, men de eies av et firma du ikke er ansatt i.» (`prosjektVelger.andreFirmaHjelp`). På web står den som ?-ikon med tooltip ved overskriften (`KontekstChip.tsx`). På mobil står den som grå linje under overskriften (`ProsjektVelger.tsx`).
- **Rad:** prosjektnavn · eierfirma (web på samme linje, mobil på linja under; eierfirma mangler offline).

## Web og mobil: byggeplassfilteret husker siste valg (ORDRE 2026-11-15 (22), 🟡 ikke merget)

Ingen ?-tekst og ingen toast — veiledningen står i lista:
- **Liste uten valg:** «Velg byggeplass» (`byggeplass.velgByggeplass`) · «Velg byggeplassen du jobber på for å se lista.» (`byggeplass.velgForListe`) + én knapp pr. byggeplass. Web: `ByggeplassFilterPort.tsx`; mobil: `VelgByggeplassTom.tsx`.
- **Prosjekt uten byggeplass (web):** «Prosjektet har ingen byggeplass» (`byggeplass.prosjektManglerByggeplass`) + lenke «Legg til byggeplass» (`byggeplass.leggTil`) for den som har rett.
- **Toppvelger uten valg:** web-chip «· Velg byggeplass»; mobil-chip «Velg byggeplass».
- **Filterlinje med valgt byggeplass:** web-sjekklister «Viser denne byggeplassen + dokumenter uten byggeplass» (`byggeplass.viserByggeplassOgUtenByggeplass`); mobil-chip og tegninger «+ dokumenter uten byggeplass» (`byggeplass.viserByggeplassOgUtenByggeplassKort`).
- **Fjernet atferd (TILLEGG (22), Kenneth 2026-11-15 «fjern "hele prosjektet" fra alle referanser»):** «Hele prosjektet» finnes ikke lenger som filtervalg, chip-tekst eller merkelapp på dokumenter. Dokumenter uten byggeplass får ingen merkelapp i lister og «—» i detalj-chipen. Slettede nøkler: `kontekstChip.heleProsjektet`, `mannskap.heleProsjektet`, `byggeplass.filtrererListe`, `byggeplass.filtrererListeKort`, `sjekklister.viser`, `sjekklister.visHeleProsjektet`, `sjekklister.filtrerPaaByggeplass`. PSI («hele prosjektet» som PSI-omfang) og dokumentsøk («Søk … i hele prosjektet») er andre domener og står.

## Web og mobil: «Byggeplass ikke valgt · Velg» på sjekkliste og oppgave (ORDRE 2026-11-15 (20) linja + (20b))

- **Linje:** «Byggeplass ikke valgt» (`kontekstChip.byggeplassIkkeValgt`) · «Velg» (`handling.velg`). Amber linje under lokasjons-/kontekstfeltet, ingen toast eller banner.
- **Forklaring:** «Dokumentet er ikke knyttet til en byggeplass. Velg byggeplassen det hører til.» (`kontekstChip.byggeplassIkkeValgtHjelp`). Web: tooltip på linja. Mobil: `accessibilityHint`.
- **Vises når:** dokumentet mangler byggeplass, prosjektet har minst én og brukeren kan redigere (`visByggeplassIkkeValgt`, `@sitedoc/shared`).
- **«Velg» åpner:** web sjekkliste → byggeplass-chipen (uten tomvalg); web oppgave → lokasjonsvelgeren; mobil sjekkliste og oppgave → velgeren med byggeplassene øverst («Byggeplass», `lokasjonVelger.byggeplassOverskrift`) over tegningene. Ett trykk på en byggeplass setter den; tegning er frivillig.
- **Byggeplassen følger tegningen (ORDRE (21), 🟡 ikke merget):** med tegning er web-chipen deaktivert med tooltip «Byggeplassen følger tegningen. Velg en tegning fra en annen byggeplass for å bytte.» (`kontekstChip.byggeplassFolgerTegning`); mobil viser ikke byggeplassene øverst i lista.
- **Web lokasjonsvelger uten byggeplass:** nedtrekket viser «Velg byggeplass …» (`lokasjonVelger.velgByggeplassPlassholder`). «Gjelder hele byggeplassen» og fritekst er sperret med forklaringen «Velg en byggeplass først» (`sperret.velgByggeplass`).

## Reise: mangler standard lønnsart (ordre 2026-11-14 (11) C, web + mobil)

Ingen ?-tekst — veiledningen står der feilen oppstår, uten toast eller banner:

- **«+ Reise» under terskel** (web-dialogen og mobilens reise-kort `ReiseKort.tsx`, POST 2026-11-15 (13) L2): rød linje «Firmaet mangler standard lønnsart — be firmaadmin sette den» (`timer.reiseTerskel.manglerArt`); lagre er sperret. Firmaadmin på web ser i stedet «Firmaet mangler standard lønnsart» (`timer.reiseTerskel.manglerStandardArt`) med lenken «Sett standard lønnsart» (`timer.reiseTerskel.settStandardArt`) til reise-regelsettet (`/dashbord/firma/innstillinger#reise-regelsett`, fra POST (13) L2 web-reisekortet).
- **«+ Reise» på web før regelsettet er hentet:** Lagre er sperret med forklaring «Henter firmaets reiseregler …» (`sperret.reiseRegelLaster`), eller «Fikk ikke hentet firmaets reiseregler — lukk og prøv igjen» (`sperret.reiseRegelFeilet`) ved feil.
- **Firmainnstillinger → Reise:** gul linje (`firma.innstillinger.reise.manglerStandardArt`) med lenke (`firma.innstillinger.reise.settStandardArt`) når terskelen er i bruk og ingen lønnsart er merket som standard.

## Mobil og web: reise-kortet («+ Reise», `ReiseKort.tsx`, POST 2026-11-15 (13) L2 § 7 C)

Web (`apps/web/src/app/dashbord/timer/[id]/ReiseKort.tsx`) bruker samme nøkler og tekster som mobil; sperreteksten vises som rød linje i kortet og ved hover på den sperrede Lagre-knappen. Mobil viser samme røde linje i kortet.

Ingen ?-tekst — kortet viser én resultatlinje og, når Lagre er sperret, én forklaring under knappen (`KnappMedForklaring`):

- **Valg:** «Til byggeplass» / «Fra byggeplass» (`timer.reiseKort.tur` / `.retur`, ordre (17)); første og siste dag i en midlertidig periode også «Overføring X → Y» (`timer.reiseKort.overforing`), forhåndsvalgt.
- **Oppmøtested** vises som tekst «Fra {navn}» (`timer.reiseKort.fraOppmotested`) bare når firmaet har flere — den ansatte velger det aldri.
- **Resultat:** «08:00–08:45 · 45 min kjøring» (`timer.reiseKort.resultat`) + grå forklaringslinje (arbeid/reise og hvorfor).
- **Sperretekster** (`timer.reiseKort.sperre.*`): «Møter på byggeplass, ingen reise» · «Oppmøtested er ikke valgt — koble til nett for å velge» · «Kjøretid mangler for denne strekningen — be firmaadmin legge den inn under Avstander» · «Før arbeidstid på dagen først — reisen legges før eller etter den» · «Reisen går over midnatt — før den på dagen den hører til» · «Firmaet har ikke satt opp reiseregler — be firmaadmin sette dem». Mangler standard lønnsart: `timer.reiseTerskel.manglerArt` (over).
- **Overføring til annet kontor** (del B, POST (13)): seksjon «Overføring til annet kontor» (`timer.reiseKort.annetKontor`) med knapper «Til {navn}» (`timer.reiseKort.tilKontor`), bare ved ≥ 2 aktive kontorer. Åpen overføring vises som «Midlertidig: {navn} fra {dato}» (`timer.reiseKort.midlertidigLinje`) med «Avslutt» (`timer.reiseKort.avslutt`). Åpen admin-satt periode sperrer: «Firmaadmin har satt et midlertidig oppmøtested — be firmaadmin endre det» (`timer.reiseKort.sperre.adminMidlertidig`). Firmaadmin ser «via overføring» (`firma.ansatte.oppmote.viaOverforing`) på perioden.

## Web: HMS-flytkortet på Dokumentflyt-siden (`HmsFlytKort.tsx`, ordre 2026-11-05 (9))

Siden `oppsett/produksjon/dokumentflyt/page.tsx` har ingen `?`-komponent for kortet ennå; vedtatt tekst, brukes når
det får hjelpe-ikon.

- **Fra firma:** HMS-ansvarlige fra firmaet. Rollen hører til firmaet, ikke prosjektet. Er du firma-admin i firmaet
  som ga rollen, har raden en X: den fjerner rollen i hele firmaet, i alle firmaets prosjekter. Bekreftelsen viser hvor
  mange åpne HMS-saker personen har ballen i. Sakene blir liggende hos HMS-behandlerne i prosjektet, og historikken
  viser hvorfor. Er personen også prosjekt-admin eller i prosjektets HMS-gruppe, beholder personen ballen der. Ellers står det hvor rollen settes («Settes av firma-admin i Firma →
  Ansatte») når du holder musa over merket. En deaktivert ansatt vises ikke.
- **Lagt til i prosjektet:** behandlere som bare gjelder dette prosjektet. X-en står alltid synlig, også på nettbrett,
  og fjerner personen bare fra prosjektets HMS-gruppe.

## Web: Oppmøtested pr. ansatt (`firma/ansatte/_components/OppmotePerioder.tsx`, POST 2026-11-15 (12))

Ansatte-siden har ingen `?`-komponent; teksten står i feltet (`firma.ansatte.oppmote.*`):

- **Fast:** «Gjelder til et nytt fast sted settes. Det forrige faste stedet avsluttes dagen før.»
- **Overlapp:** «Overlapper en eksisterende periode av samme type.» — Lagre er sperret.
- **Slett:** «Datoene i perioden får ansattens øvrige oppmøtested. Sletter du et fast sted, gjelder det forrige faste stedet igjen.»
- **Lukket fast sted** har ingen slettknapp. Avviser serveren likevel: «Et avsluttet fast sted er historikk og kan ikke slettes. Sett et nytt fast sted i stedet.»
- **Spørsmålet til den ansatte (web + mobil, `timer.oppmote.*`):** «Hvor møter du vanligvis?» — «Velg stedet du møter på. Det brukes til å beregne reise. Firmaet kan endre det senere.»

## Web: Deaktiver ansatt (`firma/ansatte/_components/DeaktiverModal.tsx`, ordre 2026-11-05 (11), (12))

Modalen har ingen `?`-komponent; vedtatt tekst, brukes når den får hjelpe-ikon.

- **Deaktiver:** personen mister tilgangen til firmaets prosjekter. Oppsummeringen viser hvilke prosjekter og
  flytledd som berøres, og hvor mange dokumenter som går tilbake til innsenderen. Har personen ballen i åpne
  HMS-saker, blir sakene liggende hos HMS-behandlerne i prosjektet, og historikken viser hvorfor. Aktiveres
  personen igjen, får personen ikke sakene tilbake.
- **Feil:** kan ikke oppsummeringen hentes, står det, og du kan lukke og prøve igjen. «Deaktiver» er sperret så
  lenge du ikke ser hva deaktiveringen avslutter.

## Web: Periode og område i sjekkliste- og oppgavelista, metadata i tegningslista (metadata S-pakke 2026-11-04)

Sidene `sjekklister/page.tsx`, `oppgaver/page.tsx` og `TegningerPanel` har ingen `?`-komponent ennå; vedtatt tekst,
brukes når de får hjelpe-ikon.

- **Periode:** velg om du vil se på når dokumentet ble *opprettet* eller sist *endret*, og velg tidsrom. Knappen viser
  valget, f.eks. «Endret: Siste uke».
- **Område:** kolonnen viser området dokumentet er plassert i på tegningen. Filtrer i kolonnehodet; filteret vises bare
  når lista har områder.
- **Kolonner** (2026-11-04): dra i håndtaket ⋮⋮ til venstre i en kolonneoverskrift for å flytte kolonnen, eller dra
  i lista øverst i «Velg parameter». Rekkefølgen huskes for deg. En kolonne du slår på, havner sist. «Nullstill» gir
  standardkolonnene i standardrekkefølge. Avkrysningsruta står alltid først.
- **Hvem og når** (M-pakke 2026-11-04, slås på i kolonnevelgeren): «Sendt av/Sendt», «Godkjent av/Godkjent»,
  «Lukket av/Lukket», «Sist utfylt av/Sist utfylt» og «Signatur». Gjenåpnes et dokument, vises godkjent og lukket bare
  så lenge dokumentet faktisk står som godkjent eller lukket. Periode-knappen kan også se på sendt-, godkjent- og
  lukket-dato.
- **Sist utfylt av:** viser «—» når endringsloggen er slått av i malen (holde musa over forklarer hvorfor). Filteret
  «Utfylt av» treffer alle som har fylt ut noe, ikke bare den siste.
- **Signatur:** for signaturfelt i malen: «✓» når alle er signert, «2/3» når noen mangler. For SJA vises bare hvor
  mange som har signert, for eksempel «3 signert» — en SJA sier ikke på forhånd hvem som skal signere. Har dokumentet
  begge, står det «2/3 · 3 signert». «—» når ingen har signert eller dokumentet ikke har signaturfelt. Filtrer på
  Signert, Mangler signatur eller Uten signaturfelt (en SJA regnes som signert når minst én har signert); sortering
  gir komplette først.
- **Tegningslista:** hver tegning viser revisjon, status, opprinnelig filformat (DWG, PDF …) og utgivelsesdato når de
  finnes. Under søket kan du snevre inn på status, filformat og georeferanse — bare valg som finnes i lista vises.
  Byggeplasser uten treff skjules mens et filter er satt.

## Firma → Timer → Lønnsarter: «Fravær med tak» (kort-id-spec § 11.10 B10, ordre (30) b3, 🟡 ikke merget)

Avkrysning i lønnsart-skjemaet når typen er Fravær (`apps/web/src/app/dashbord/firma/timer/lonnsarter/page.tsx`, kolonnen `Lonnsart.fravaerNormtak`, standard på):

- **Ledetekst:** «Fraværet kan høyst fylle resten av dagsnormen» (`firma.timer.felt.fravaerNormtak`).
- **Hint under:** «Slå på for fravær arbeidsgiver betaler i stedet for arbeid: egenmelding, sykemelding og barns sykdom. Uten avkrysning — for eksempel ferie og privat ærend — føres fraværet fullt, og arbeid samme dag kommer i tillegg.» (`…fravaerNormtakHint`).
- **Typekolonnen** viser «Fravær · med tak» / «Fravær · uten tak» (`firma.timer.normtak.medTak`/`utenTak`).
- **?-fane «Fravær med tak»:** «Fravær med tak kan høyst fylle det som er igjen av dagsnormen etter arbeid og annet fravær samme dag. Eksempel med norm 7,5 t: 2 t arbeid gir høyst 5,5 t egenmelding. Fravær uten tak — ferie og privat ærend — føres fullt. En dag over taket kan ikke attesteres før fraværet er rettet; attestanten returnerer sedelen eller retter timene.» (`firma.timer.normtak.hjelpTittel`/`hjelpTekst`).

## Attestering: dag over taket (kort-id-spec § 11.10.4, F9 = A, ordre (30) b3, 🟡 ikke merget)

- **Bruddlinje** (amber) i seddelkortet, attesteringsdetaljen og prosjektattesteringen: «Egenmelding 7,5 t + arbeid 2,0 t = 9,5 t — over dagsnormen 7,5 t» (`timer.normtak.leddArt`/`leddArbeid`/`leddAnnet`/`brudd`, tallene fra serverens `fravaerNormtakBrudd`).
- **✓ er sperret** med tooltip «Datoen kan ikke attesteres før fraværet er rettet. Returner sedelen, eller rett timene.» (`timer.normtak.attesterSperret`). Serveren avviser uansett (`krevIngenNormtakBrudd`).

## Firmainnstillinger → Timeføring: «Prosjektleder kan attestere fravær» (kort-id-spec § 11.9 F1, ordre (30) b2, 🟡 ikke merget)

Avkrysning under Timeføring-hjelpeteksten (`apps/web/src/app/dashbord/firma/innstillinger/page.tsx`, kolonnen `Organization.fravaerAttesteresAvProsjektleder`):

- **Ledetekst:** «Prosjektleder kan attestere fravær» (`firma.innstillinger.timeforing.fravaerProsjektleder`).
- **Hint under:** «Uten avkrysning attesterer bare lønnsansvarlig fravær. Med avkrysning kan også prosjektlederen som attesterer resten av dagen, attestere fraværet.» (`…fravaerProsjektlederHint`).
- **?-ikon:** «Gjelder fravær ført uten prosjekt. Valget virker fra neste attestering; attesterte timer endres ikke.» (`…fravaerProsjektlederHjelpIkon`).
- Serveren avgjør (`krevAttesteringsrett` i `apps/api/src/routes/timer/dagsseddel.ts`) og sender `fravaerKanAttesteres` pr. sedel; attesteringslistene viser fraværsraden nedtonet når den er `false`. Fravær uten prosjekt heter «Fravær» (`timer.detalj.fravaerUtenProsjekt`) overalt på web.

## Firma → Timer → Rapport: «Ta med uattesterte» (ordre (31), 🟡 ikke merget)

Avkrysning i eksportmenyen, rett over CSV/Excel/PDF, og i mal-redigereren (`apps/web/src/app/dashbord/firma/timer/rapport/page.tsx`). Av som standard; valget lagres i utskriftsmalen.

- **Ledetekst:** «Ta med uattesterte» (`firma.timer.rapport.eksport.taMedUattesterte`).
- **Hint** (tooltip i menyen, tekst under i redigereren): «Uten avkrysning tar Excel, CSV og PDF bare med attesterte timer, maskiner og tillegg, og utlegg fra attesterte sedler. Med avkrysning kommer også det som venter på attestering.» (`…taMedUattesterteHint`).
- Skjermen viser fortsatt alle rader, med status i egen kolonne; bare eksporten filtreres. Eksempel: Ola har 7,5 t attestert og 2 t som venter — Excel uten avkrysning viser 7,5 t, med avkrysning 9,5 t.
- Rapportsiden har ennå ikke `HjelpKnapp` (?-ikon); teksten over er vedtatt hjelpetekst for eksportvalget når siden får ikonet.

## Firma → Timer → Attestering: Sedler som tabell (kort-id-spec d2b-1, § 12.8.5, 🟡 ikke merget)

`apps/web/src/app/dashbord/firma/timer/attestering/page.tsx` har `HjelpKnapp` med fanen «Attestering» (`timer.attestering.tabell.hjelp.tittel`). Den løse beskrivelsen over fanene er flyttet inn som første avsnitt (`firma.timer.attesteringBeskrivelse`). Øvrige avsnitt:

- **Struktur:** «Hver dag er én dagsseddel. Under den står prosjektsedlene med en oversiktsrad, og linjene under hver prosjektseddel. Nederst på dagen står summen for dagsseddelen.» (`…hjelp.struktur`)
- **Handlinger:** ✓/↩/↺ på linje, oversiktsrad og dag; sperren står i Avvik-kolonnen og stopper ✓ (`…hjelp.handlinger`).
- **Retting:** klikk i cella på en ventende linje når firmaet tillater retting; Enter/Tab lagrer, Esc angrer; «var …» viser gammel verdi (`…hjelp.retting`).
- **Verktøy:** «Velg parameter», sortering og filter i kolonnehodet, «Attester utvalget» = avkryssede linjer, ellers alle synlige ventende; gjelder besøket (`…hjelp.verktoy`).
- **Mikrotekst i tabellen** (`timer.attestering.tabell.*`): «Attester utvalget (n)», «n linjer har sperre og ble stående.», «Dagen: X t av dagsnorm Y t», «Uke N: X t overtid ikke ført (ukenorm Y t)», «var X», «Bare oversiktsrader», «Ukeoversikt».
- **Grupperinger og ukeoversikt** (d2b-2, 🟡 ikke merget): «Sedler», «Etter prosjekt» og «Etter ansatt» viser de samme linjene, bare gruppert ulikt; ukeoversikten viser timene pr. dag, klikk på en dag viser bare den dagen, hold over et tall for dagskortet (`…hjelp.grupperinger`). Grupperaden viser «X t» (`timer.attestering.tabell.gruppeSum`); dagknappen i ukeoversikten har «Vis bare denne dagen i tabellen» (`timer.attestering.uke.filtrerDag`).

Fra w5 i web-timeføring (🟡 ikke merget, `feat/web-timer-w5`), begge sidene:

- **Registreringen** (`…hjelp.registrering`, nytt): «Klikk på en linje for å åpne registreringen slik den ansatte førte den. Hver retting lagres med en gang. Underprosjektet gjelder hele jobben. «Del opp» deler jobben ved et klokkeslett: del A er jobben som var, del B blir et eget kort. Timene regnes fra klokkeslettene, og summen er den samme.»
- **Retting** (`…hjelp.retting`, endret): sier at den som attesterer linjen kan rette, og at verken blyant eller saks vises når retting ikke er tillatt.
- **Verktøy** (`…hjelp.verktoy`, endret, nå også på prosjektsiden): «Tilbakestill til standard» gir standardkolonnene tilbake.
- **Handlinger** (`…hjelp.handlinger`, endret): dagknappen heter «Attester» (full tekst som tooltip), og «Gjenåpne» (`timer.attestering.tabell.gjenaapne`).
- Registreringens mikrotekst: `timer.attestering.registrering.*` (delene, «Uten», «Del opp», «Del ved», «Jobb A»/«Jobb B»).

Fra w5b i web-timeføring (🟡 ikke merget, `feat/web-timer-w5b`, B14 A), begge sidene:

- **Struktur** (`…hjelp.struktur`, endret): «Hver dag står i sin egen ramme. Den blå dagsraden øverst viser dato, ansatt, dagens sum og avvik. Har dagen flere jobber, får hver jobb en egen rad og en egen kantfarge, med linjene under. Med én jobb står jobbens prosjekt og underprosjekt i dagsraden. Et merke som «+0,5 t» betyr at dagen avviker fra dagsnormen; hold pekeren over merket for å se hele setningen.»
- **Handlinger** (`…hjelp.handlinger`, endret): knappene på en jobbrad gjelder hele jobben; «Attester» på dagsraden gjelder hele dagsseddelen.
- Mikrotekst: «N jobb/jobber» (`timer.attestering.tabell.antallJobber_one/_other`), normmerket «+0,5 t» (`timer.attestering.tabell.normMerke`). «Dagen: X t av dagsnorm Y t» står nå bare ved hover på merket. `timer.attestering.tabell.dagsum` er fjernet.

Fra w8 i web-timeføring (🟡 ikke merget, `feat/web-timer-w8`, plan § 8.6 punkt 1), begge sidene:

- **Registreringen** (`…hjelp.registrering`, endret): «Klikk på jobbraden for å åpne registreringen slik den ansatte førte den. Har dagen bare én jobb, er det dagsraden. Pilen ▸ til venstre viser hvilke rader som kan åpnes, og ▾ viser raden som er åpen. Hver retting lagres med en gang. …» (resten som før). Timeradene åpner ikke lenger registreringen.

## Prosjekt → Timer → Attestering (d2b-2, 🟡 ikke merget)

`apps/web/src/app/dashbord/[prosjektId]/timer/attestering/page.tsx` har `HjelpKnapp` (fanen «Attestering»). Første avsnitt: «Her attesterer du timene som er ført på dette prosjektet. Linjer den ansatte har ført på andre prosjekter samme dag, står nedtonet og kan ikke velges. Har du ikke tilgang til det andre prosjektet, står det «Annet prosjekt».» (`timer.attestering.prosjekt.hjelp.laast`); deretter struktur, handlinger og retting som på firmasiden. Dagsumraden har «Attester prosjektets del» (`timer.attestering.tabell.attesterProsjektetsDel`).

Fra d2b-3 (🟡 ikke merget) har firmasiden også «Avvik denne uka»-avsnittet (`timer.attestering.tabell.hjelp.ukeavvik`: «sammenligner hele ukas timer (sendt og attestert) med ukenormen — ikke bare dagen eller linjene du ser») og kvitteringsavsnittet (`…hjelp.kvittering`: «Et utlegg med kvittering viser et miniatyrbilde eller en binders på linjen. Klikk for å åpne kvitteringen og kontrollere den før du attesterer.»); prosjektsiden har kvitteringsavsnittet. Lenken har tittelen «Åpne kvitteringen (filnavn)» (`…tabell.aapneKvittering`).

Fra w1 i web-timeføring (🟡 ikke merget, `feat/web-timer-w1`) har begge sidene avsnittene om dato og avviksmerker, og firmasiden i tillegg om årsvelgeren:

- **Dato** (`…hjelp.dato`): «Datoen står som dd.mm. Har tabellen dager fra flere år, står året med. Eksporten viser alltid hele datoen med år.» Firmasiden legger til (`…hjelp.aar`): «Året står ved ukevalget. Velg et annet år for å gå til samme uke det året.»
- **Merker** (`…hjelp.merker`): avvik står som korte merker; hold pekeren over eller trykk for hele forklaringen. «Uten timerad» (`…merke.utenTimerad`, forklaring `…merke.utenTimeradForklaring`) og «Uten førerbevis» (`…merke.utenForerbevis`, forklaring `timer.maskinforerbevis.leder`). Hele teksten i Avvik-filteret og ukeoversikten er «Maskin uten timerad» (`timer.attestering.tabell.maskinUtenTimerad`, WM22). Årsvelgerens etikett: «År» (`timer.attestering.uke.aar`).

Detaljsiden (`AttesteringDetalj.tsx`) har under tabellen: «Attester, returner eller gjenåpne i tabellen: pr. linje, pr. prosjektseddel eller hele dagen.» (`timer.attestering.detalj.tabellHint`).
