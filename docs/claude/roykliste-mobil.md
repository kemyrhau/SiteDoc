---
name: roykliste-mobil
description: Kjørbar røykliste for mobil-appen (iOS-simulator, test-API) — femten flyter som fanger atferdsregresjoner typer og tester ikke ser. Kjøres FØR hvert EAS-bygg. Lag 2 i kvalitetssikring-plan.md.
status: aktiv
sist_verifisert_mot_kode: 2026-09-02
---

# Røykliste — mobil (iOS-simulator, test-API)

> **Hva dette er:** en **kjørbar** liste, ikke en beskrivelse. Femten flyter drives med `idb`
> mot appen i iOS-simulatoren (test-API via tunnel `3301`). Formålet er å fange
> **atferds**regresjoner som kompilerer grønt og passerer tester — de tre som slapp gjennom
> 30. aug. (tegningsmodal kunne ikke lukkes, tekstfelt låst, timer kastet på manglende
> lønnsart) var alle atferd. `apps/mobile` har **null testfiler**; denne lista er nettet.
>
> **Kjør den før hvert EAS-bygg.** Finner den en regresjon → bygget utsettes.
> Grunnlag: [kvalitetssikring-plan.md](kvalitetssikring-plan.md) (Kenneth 2026-08-31).

## Hva som er UTENFOR lista (les dette først)

- **Femten flyter av flere hundre.** Grønn liste betyr **ikke** grønn app — den betyr at de
  mest brukte hovedveiene i utfyllings-appen sto oppreist på den testede hashen.
- **Innlogging testes ikke reelt.** Sesjonen ligger i iOS-nøkkelringen og overlever
  app-drap/reinstall, så appen lander rett på dashbordet. Flyt 1 verifiserer at
  **dashbordet laster** for en allerede innlogget bruker — ikke selve Google/Microsoft-
  eller dev-login-veien. Vil du teste innlogging: **Mer → Logg ut** først (kjent s3-bug:
  utlogging navigerer ikke automatisk — kaldstart appen, se runbook § 3).
- **Kun ett prosjekt, én bruker.** «Egen bruker (kemyrhau)» på `Test prosjekt SiteDoc
  Røstbakken`. Andre roller (arbeider uten `manage_field`, firma-admin), offline-sync,
  ekte kamera, GPS, push og betalte moduler er ikke dekket.
- **Ikke ytelse, ikke pikselgeometri.** Lista sjekker at kontroller er **truffbare**
  (idb-tap treffer), ikke at de ser riktige ut. En knapp kan være truffbar og likevel
  stygg.
- **Ingen destruktiv verifisering.** Flyt 7 (send oppgave) og flyt 9 (timer-rad) muterer
  test-data bevisst; alt annet redigerer utkast. Se «Tilstand etterlatt».

---

## Oppsett (én gang pr. økt — ~30 s hvis simulatoren allerede kjører)

Full teori i [simulator-runbook.md](simulator-runbook.md) og
[simulator-opus-oppkobling.md](simulator-opus-oppkobling.md). Kort løype:

```bash
# 1) SSH-tunnel til test-API (må stå hele økta)
lsof -nP -iTCP:3301 -sTCP:LISTEN >/dev/null || ssh -f -N -L 3301:localhost:3301 server-ny
# 2) UDID til booted simulator
export IDB_UDID=$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)
# 3) Metro må kjøre (eget vindu): cd apps/mobile && npx expo run:ios  → tast «i»
# 4) Appen installert + kjører?
idb list-apps --udid $IDB_UDID | grep -i sitedoc
```

**Ren start:** `xcrun simctl terminate booted com.kemyrhau.sitedoc && xcrun simctl launch
booted com.kemyrhau.sitedoc` → vent ~6 s → appen lander på dashbordet «Test prosjekt
SiteDoc Røstbakken».

### idb-mekanikk denne lista er bygget på (avviker fra runbook — les)

1. **Alle tap trenger `--duration 0.12`.** Momentant `idb ui tap X Y` registreres ofte
   ikke i denne appen (RN-gesture-lag) — hverken på tab-bånd, knapper eller listerader.
   Bruk **alltid** `idb ui tap --udid $IDB_UDID X Y --duration 0.12`.
2. **Koordinater er dynamiske — les dem på nytt hver gang.** Dashbord-kortene flytter seg
   når teller-badges endrer seg (Innboks/Oppgaver). Aldri gjenbruk en y-verdi mellom
   steg. Hjelper: dump a11y-treet og finn elementet på **etikett**, tap koordinaten den
   rapporterer:
   ```bash
   idb ui describe-all --udid $IDB_UDID   # AXLabel + frame (senter = x+w/2, y+h/2)
   ```
3. **Skjermbilde kun ved visuelt spørsmål** (er knappen grå? kom markøren?). A11y-treet
   sier ikke om en knapp er *disabled* — da må du se. Ett skjermbilde-tungt løp brukte
   46 % av ukebudsjettet; hold deg til `describe-all`.
4. **Tekst:** `idb ui text --udid $IDB_UDID "..."`. iOS-autokorrektur slår inn (skrev om
   «Roykliste» → «Royalist») — verifiser mot faktisk verdi, ikke mot det du tastet.

### Navigasjonsmodell (avgjørende — feilnavigering var største tidssluk)

- **Bunn-tabs finnes KUN på tab-røttene** (dashbord/Hjem, Tegninger, Dokumenter, Timer,
  Mer). Fem synlige tabs på x = **43, 129, 215, 301, 387**, alle y = **874**.
  (A11y sier «X of 6» — tab 3 = `lokasjoner`, skjult bak `nyNavigasjon`-flagget som er PÅ.)
- **Modul-lister og dokument-detaljer er pushet OVER tab-båndet** → **ingen tabs synlig**.
  Ut av dem: **tilbake-pil øverst til venstre (≈ x 25, y 80–84)**, ikke tab-tap.
- **Moduler nås fra dashbordet** (Hjem-tab): kort for Innboks, Oppgaver, Sjekklister,
  Kontrollplaner, HMS. For å bytte modul: tilbake til dashbord, tap nytt kort.
- **«+»/Nytt dokument er PR. MODUL**, ikke en tab — ikon øverst til høyre (≈ x 404, y 82)
  på hver modul-liste. Det finnes ingen global plussknapp.

---

## De femten flytene

Hver flyt: **start → trykk → forventet**. Svar på de tre spørsmålene pr. flyt i tabellen:
**mål nådd? · antall trykk · kontroller truffbare?** «Truffbar» = `idb ui tap` på hver
kontroll i topp- og bunn-bånd traff (ikke øyemål — det var øyemål som ikke fanget at X-en
lå død på y=43 i bygg 46).

### Flyt 1 — Logg inn → dashbord laster
- **Start:** kaldstart appen (`terminate` + `launch`).
- **Forventet:** lander på dashbordet med «Start dag», «Innboks», «Oppgaver, N»,
  «Sjekklister, N», «Kontrollplaner», «HMS», og bunn-tab-båndet (5 tabs).
- **Truffbar-sjekk (bunn-bånd, delt av alle tab-rot-skjermer):** tap hver av 43/129/215/
  301/387 @ 874 med duration → Hjem/Tegninger/Dokumenter/Timer/Mer skal bytte skjerm.
- *Merk:* dette tester **ikke** selve innloggingen (sesjon i nøkkelring) — se «Utenfor lista».

### Flyt 2 — Sjekkliste → tekstfelt → skriv → verdien består
- **Start:** dashbord → «Sjekklister» → åpne et **Utkast** (f.eks. BEF_8) → i en repeater-rad,
  feltet «Trykk for å skrive...».
- **Trykk:** tap feltet → `idb ui text "..."` → tap **«Ferdig»** (øverst til høyre, ≈ x 383, y 84).
- **Forventet:** feltet viser den skrevne verdien; «Lagret automatisk HH:MM» oppdateres.
  Les feltet på nytt med `describe-all` — verdien skal stå der etter Ferdig.

### Flyt 3 — Repeater → ny rad → tegningsposisjon → bekreft → UT uten app-drap
- **Start:** i en Befaringsnotat-sjekkliste → «Legg til rad».
- **Trykk:** i den nye raden → **«Velg tegning og marker posisjon»** → **«Velg tegning»** →
  velg kategori (f.eks. «utomhus») → velg en tegning → vent til «Laster tegning…» forsvinner
  → **tap på selve tegningen** (se felle under) → **«Bekreft»** (øverst til høyre).
- **Forventet:** tilbake i dokumentet; raden viser «Posisjon: NN%, NN%» + «Endre posisjon».
  **App-pid uendret** (ingen krasj/restart): `idb list-apps | grep sitedoc`.
- 🔴 **Felle (prod-felle, dok. i 1a1844e8):** **«Bekreft» er grået ut (disabled) til en
  markør er plassert.** Lerretet dekker **kun øvre del** av skjermen (≈ y 185–365 i punkter);
  tapper du under det (det svarte feltet) skjer ingenting og Bekreft forblir disabled **uten
  feilmelding**. Tap midt på selve tegningen, ikke midt på skjermen. Verifiser at Bekreft
  ble aktiv (skjermbilde: grå → blå) før du taper den.

### Flyt 4 — Kommentar + bilde på et felt
- **Start:** i en repeater-rad (kommentar = tekstfeltet fra flyt 2).
- **Trykk:** «Galleri» → (første gang: rettighetsdialog → «Gi full tilgang») → velg et foto.
- **Forventet:** «Laster opp fil...» → en 72×72 thumbnail dukker opp under bilde-knappene.
- **Simulator-forberedelse:** legg et foto i biblioteket hvis tomt:
  `xcrun simctl addmedia booted <sti-til-png>` og
  `xcrun simctl privacy booted grant photos com.kemyrhau.sitedoc`.
- ⚠️ **Kjent transient:** **aller første** gang fototilgang gis, kan DEV-clienten falle til
  iOS-hjemskjermen (appen backgrounded/terminert) i overgangen rettighet→picker. `launch`
  appen på nytt og gjenta «Galleri» — andre forsøk åpner pickeren normalt. Ikke reprodusert
  når tilgang allerede er gitt; ingen native krasjlogg. **Overvåk om dette forverres** — blir
  det reproduserbart uten førstegangs-rettighet, er det en regresjon.

### Flyt 5 — Forstørr bilde → lukk
- **Start:** en rad med festet bilde (fra flyt 4).
- **Trykk:** tap thumbnailen én gang (viser «Slett»/«Annoter») → **«Annoter»** → **«Avbryt»**.
- **Forventet:** «Annoter bilde» åpner fullskjerm (verktøy Pil/Sirkel/Firkant/Frihånd/Tekst);
  Avbryt lukker tilbake til dokumentet, app-pid uendret.
- *Merk:* rad-thumbnailen har **ingen ren «lightbox»** — tap veksler kun handlingsknappene;
  «Annoter» er den fullskjerms bildevisningen i denne konteksten.

### Flyt 6 — Nytt dokument fra plussknappen
- **Start:** en modul-liste (f.eks. Sjekklister).
- **Trykk:** **«+»** øverst til høyre (≈ x 404, y 82) → velg mal (f.eks. «Befaringsnotat»)
  → **Mottaker-faggruppe: «Velg dokumentflyt»** → velg en flyt → **«Opprett»** (øverst til høyre).
- **Forventet:** nytt dokument (f.eks. BEF_9) åpner som Utkast, «Lagret automatisk».
- 🔴 **Felle:** **«Opprett» er grået ut til en dokumentflyt er valgt** (Mottaker-faggruppe),
  selv om feltet ikke er merket med `*`. Uten flyt-valg gjør Opprett ingenting — det er
  validering, ikke en bug.

### Flyt 7 — Oppgave → send til neste ledd
- **Start:** dashbord → «Oppgaver» → åpne et **Utkast** der «Du har ballen».
- **Trykk:** **«Send»** (bunn-bånd, ≈ x 194, y 901) → i arket «Ønsker du å sende og bytte
  til …?» → **«Bekreft»**.
- **Forventet:** status-chip går fra **Utkast → Mottatt** (sendt til neste ledd).
  ⚠️ Muterer test-data (advanserer oppgaven) — noter hvilken.

### Flyt 8 — HMS-registrering → opprett og lagre
- **Start:** dashbord → «HMS» (fanene Avvik/SJA/RUH).
- **Trykk:** **Ny** øverst til høyre → velg type (f.eks. «RUH») → fyll påkrevde:
  **Type observasjon** (Nestenulykke/Farlig forhold) + **Innmelder** («Velg person…» → deg selv).
- **Forventet:** «Opprettet som utkast — ikke sendt». Gå tilbake → RUH-fanen viser
  «RUHn RUH, Utkast» (utkastet består). *Ikke* nødvendig å trykke «Send inn» (det ville
  varsle andre) — «opprett og lagre» er dekket av utkastet.

### Flyt 9 — Timer → dagsseddel → ny rad → lagre
- **Start:** Timer-tab → åpne en **Utkast**-dagsseddel (eller «Start dag» for ny).
- **Trykk:** **«Legg til timer-rad»** → fyll **«Antall timer»** (Til kl. auto-beregnes fra
  Fra kl.) → **lukk tastaturet** (tap en label, f.eks. «Aktivitet») → **«Lagre»**.
- **Forventet:** arket lukker; dagsseddelens sumtimer øker (f.eks. 7.50t → 9.50t) og en ny
  aktivitetsrad vises.
- 🔴 **Felle:** **«Lagre» ligger nederst og dekkes av tastaturet** — et tap treffer da
  tastaturet, ikke knappen, og skjemaet står stille uten feilmelding. Lukk tastaturet
  (tap en ikke-felt-label) **før** du taper Lagre. (Lønnsart er forhåndsvalgt «Timelønn» —
  regresjonen «timer kastet ved manglende lønnsart» ville vist seg som krasj/feil her.)

### Flyt 10 — Drep appen midt i utfylling → start → utkastet består
- **Start:** åpne et utkast-dokument med innhold (posisjon/tekst/bilde).
- **Trykk:** tap et tekstfelt, skriv litt (fill-modus) → **uten** å trykke Ferdig:
  `xcrun simctl terminate booted com.kemyrhau.sitedoc` → `... launch ...` → naviger tilbake
  til dokumentet.
- **Forventet:** alt **committet** innhold (posisjon, bilde, tidligere Ferdig-lagret tekst)
  består. Den **siste ikke-committede** tasten (skrevet mens feltet var i fokus, aldri
  blur/Ferdig) går tapt — forventet, auto-lagring skjer ved blur, ikke pr. tastetrykk.
  «Utkastet består» = det lagrede utkastet, ikke siste keystroke.

### Flyt 11 — Byggeplass-filter → «Hele prosjektet» (måling + negativ kontroll)
- **Start:** et prosjekt med sjekklister spredt på flere byggeplasser (test: `Test prosjekt
  SiteDoc Røstbakken`, byggeplass-chip aktiv).
- **Trykk:** les sjekkliste-antall i filtrert tilstand (byggeplass valgt) → tap chip → **«Hele
  prosjektet»** → les antall på nytt.
- **Forventet:** settet **utvides** når byggeplass-filteret fjernes, og chip-en sier **«Viser
  kun denne byggeplassen — trykk for hele prosjektet»** når en byggeplass er valgt (skjermen
  erkjenner at den er filtrert). **Tell begge tall.**
- 🔴 **Negativ kontroll:** velg byggeplass igjen → settet skal **smalne på nytt**. Viser lista
  det samme uansett valg, er filteret koblet fra i stedet for å ha en av-tilstand.

### Flyt 12 — Modulgating av Timer (krever Kenneth-toggle)
- **Start:** Timer-modulen **PÅ** for firmaet (baseline). Krever at Kenneth slår av/på på
  `/dashbord/firma/moduler` i web — **be om det, ikke gjør det selv.**
- **Trykk:** noter baseline (Timer-tab, «Start dag»-chip, Timer/Mine timer i Mer) → be Kenneth
  slå **av** → refresh (pull-to-refresh; navigasjon alene refetcher ikke config) → mål → be
  Kenneth slå **på** → refresh → mål.
- **Forventet (av):** Timer-fanen borte fra tab-baren, «Start dag»-chipen borte fra dashbord,
  Timer-radene borte fra «Mer». **(på):** alt tilbake.
- 🔴 **Familieskillet:** Sjekklister, Oppgaver, HMS og Tegninger skal være **upåvirket** hele
  veien — det er prøven som avslører om gating-en lekker.
- 🔴 **Fail-open:** flymodus (kutt tunnel) med Timer **PÅ** → fanen skal fortsatt virke (lokal
  cache).

### Flyt 13 — Språk (polsk)
- **Start:** Mer → Språk → **🇵🇱 Polski** (A.Markussen har flest fra Polen/Litauen/Albania).
- **Trykk:** åpne dashbord, en sjekkliste, tegningsvelgeren; sett en tegningsposisjon.
- **Forventet:** flyten virker på polsk uten krasj. **Se etter to ting og rapportér hver
  ordrett:** (1) norsk tekst som står igjen, (2) rå i18n-nøkler (`felt.bekreft`-typen — en
  manglende nøkkel vises som selve nøkkelen; hverken typecheck eller bygg fanger det).
- *Rydd opp:* bytt språk tilbake til 🇳🇴 etter testen (clean state).

### Flyt 14 — Repeater arver tegning fra forrige rad (negativ kontroll)
- **Start:** en sjekkliste med repeater som har `drawing_position`, på en byggeplass med **to
  distinkte tegninger** A og B (test-mål: `Sitedoc Boligfelt B12 → Bygg B12`).
- **Trykk:** Rad 1 → velg tegning **A**, sett punkt, bekreft. Rad 2 → åpne (skal foreslå A) →
  bytt til **B**, sett punkt, bekreft. Rad 3 → åpne.
- **Forventet:** 🔴 **Rad 3 skal foreslå B, ikke A.** Arver den A, leser koden rad 1 i stedet
  for forrige rad — regelen er feil bygget. **Tell trykk for rad 2 og 3** mot rad 1 (gevinsten).
- ⚠️ **Datakrav:** dokumentet må ha BÅDE repeater-med-`drawing_position` OG en byggeplass med
  2 valgbare tegninger. Finnes ikke den kombinasjonen → **BLOKKERT**, meld hvem som må seede.

### Flyt 15 — Tegning uten punkt (paritetsregel + fikset krasj)
- **Start:** et `drawing_position`-felt.
- **Trykk:** velg en tegning men **sett IKKE punkt** → lukk uten å bekrefte.
- **Forventet:** i **redigering** vises mellomtilstanden («tegning valgt, punkt mangler») eller
  feltet forblir tomt (ingen halv visning); i **lesevisning** ser feltet ut som **ingen
  lokasjon**. 🔴 **Appen skal ikke krasje** — fram til `81225a93` kalte lesevisningen
  `positionX.toFixed(1)` på `null` her. Krasjer den, er fiksen ikke i bygget.

---

## Negativ kontroll (obligatorisk)

Går alle femten grønt på første forsøk: **sjekk at du faktisk testet det du tror.** En liste som
aldri feiler måler ingenting. Konkret:
- Traff idb-tappene ekte kontroller, eller falt de på tomt lerret / bak tastatur? (Fellene i
  flyt 3/9 gir «grønt» om du ikke leser tilbake — verifiser **effekten**, ikke bare at du taper.)
- Endret status/verdi seg faktisk (`describe-all` før/etter), eller leste du en cache?
- Er hashen i tabellen den simulatoren **faktisk kjørte** (simulator-worktreet), ikke
  develop-tippen i hovedtreet? De kan avvike.

---

## Kjøringer

> Én rad pr. flyt pr. kjøring. Utfall: ✅ mål nådd · ⚠️ nådd med anmerkning · ❌ feilet.
> «Trykk» = minste antall trykk fra flytens startpunkt til målet på denne kjøringen.

### Kjøring 1 — 2026-08-31 · develop `1a1844e8` (simulator-worktree) · iPhone 16 Plus, iOS 18.4 · DEV-client

| # | Flyt | Mål nådd? | Trykk | Kontroller truffbare? | Anmerkning |
|---|------|-----------|-------|-----------------------|------------|
| 1 | Innlogging → dashbord | ✅ | 0 (kaldstart) | ✅ 5/5 tabs (m/ duration) | Innlogging ikke reelt testet — sesjon i nøkkelring |
| 2 | Sjekkliste tekstfelt består | ✅ | 2 | ✅ | Autokorrektur endret ordet — verdi bestod |
| 3 | Repeater → tegningsposisjon → Bekreft | ✅ | 7 | ✅ (Bekreft, Velg tegning, X) | 1 bortkastet tap på dødt lerret-område; Bekreft disabled til markør satt |
| 4 | Kommentar + bilde | ⚠️ | 2 (+rettighet) | ✅ | Førstegangs-rettighet droppet appen til hjemskjerm 1×; 2. forsøk OK |
| 5 | Forstørr bilde → lukk | ✅ | 3 | ✅ (Avbryt/Ferdig) | Forstørring kun via «Annoter», ikke lightbox |
| 6 | Nytt dokument fra «+» | ✅ | 6 | ✅ (Avbryt/Opprett) | Opprett disabled til dokumentflyt valgt (+2 trykk) |
| 7 | Oppgave → send til neste ledd | ✅ | 4 | ✅ (Send/Bekreft) | BHO6: Utkast → Mottatt (mutert) |
| 8 | HMS → opprett og lagre | ✅ | 6 | ✅ (Ny/tilbake) | RUH1 utkast opprettet + består i lista |
| 9 | Timer → dagsseddel → ny rad → lagre | ✅ | 5 | ✅ (Lagre) | Lagre krevde tastatur lukket først; 7.50t → 9.50t |
| 10 | Drep app midt i utfylling → utkast består | ✅ | — | — | Committet innhold bestod; siste ikke-committede tast tapt (forventet) |

**Sum:** 10/10 mål nådd (2 med anmerkning). **Ingen regresjon som utsetter bygg.** Tre
anmerkninger er kjente/forventede validerings- eller UX-forhold (flyt 3/6/9-feller), ikke
atferdsbrudd. Flyt 4-transienten overvåkes.

### Kjøring 2 — 2026-09-02 · develop `63109cf7` (simulator-worktree) · iPhone 16 Plus, iOS 18.4 · lokalt Debug-bygg (dev-client)

> Lag-2-røyk FØR EAS-bygg (7 mobil-runder ventet). Alle 15 flyter. Dev-login «Egen bruker
> (kemyrhau)», firma `SITEDOC MYRHAUG`, prosjekter Røstbakken + Boligfelt B12.

| # | Flyt | Mål nådd? | Trykk | Kontroller truffbare? | Anmerkning |
|---|------|-----------|-------|-----------------------|------------|
| 1 | Innlogging → dashbord | ✅ | 0 (dev-login) | ✅ 5/5 tabs | Sesjon var tømt → logget inn via dev-login |
| 2 | Sjekkliste tekstfelt består | ✅ | 2 | ✅ | «Flyt2 tekst 1547» bestod etter Ferdig |
| 3 | Repeater → tegningsposisjon → Bekreft | ✅ | **4** | ✅ | 🔽 **7→4**: tegningsminnet åpnet direkte på Z-20-01 (sparte Velg tegning+kategori+tegning). Felle bekreftet |
| 4 | Kommentar + bilde | ⚠️ | 2 (+rettighet) | ✅ | Kjent transient: 1. Galleri-tap droppet til hjemskjerm (førstegangs-rettighet, ferskt install); 2. forsøk OK. Opplasting 357670 B |
| 5 | Forstørr bilde → lukk | ✅ | 3 | ✅ | Annoter (Pil/Sirkel/…) → Avbryt, pid uendret |
| 6 | Nytt dokument fra «+» | ✅ | 5 | ✅ | BEF_10 opprettet; Opprett disabled til dokumentflyt valgt (felle bekreftet) |
| 7 | Oppgave → send til neste ledd | ✅ | 4 | ✅ | BHO4: Utkast → Mottatt (mutert). ⚠️ arktekst «…bytte til Send?» ser rar ut |
| 8 | HMS → opprett og lagre | ✅ | ~2 (+innmelder) | ✅ | RUH2 utkast består. ⚠️ innmelder-valg festet seg ikke i felt |
| 9 | Timer → dagsseddel → ny rad → lagre | ✅ | 4 | ✅ | 15. juli 7.50→9.50 t; lønnsart forhåndsvalgt; Til kl. auto 15:00→17:00; lukket tastatur før Lagre |
| 10 | Drep app midt i utfylling → utkast består | ✅ | — | — | Committet (tekst+posisjon) bestod; ukommittert felt tomt |
| 11 | Byggeplass-filter → «Hele prosjektet» | ✅ | 2 | ✅ | **Filtrert 8 / hele 9** (BEF1 på NRK legges til). Neg.kontroll: re-valg → 8 igjen. «Godkjent»-fane kun i hele-visning |
| 12 | Modulgating av Timer | ✅ | — | ✅ | Round-trip: AV → tab/chip/Mer-rader borte, familie upåvirket; PÅ → alt tilbake. Fail-open (flymodus) OK. ⚠️ krevde pull-to-refresh |
| 13 | Språk (polsk) | ✅ | — | ✅ | **Ingen rå nøkler.** Rest-norsk: «Dato og tid», «Medium prioritet»; måneder ikke lokalisert («aug.»/«september»); «In progress» (spinner). 🔴 prioritet-label henger ett språk bak språkbytte |
| 14 | Repeater arver tegning fra forrige rad | ✅ | rad3: 0 (tegning) | ✅ | Seed OK 2026-09-02 (mal «Beraringsrapport» BEF_ på Bygg B12, 2 tegninger). BEF_1: rad 1→A «Bygg B12 - Plantegning», rad 2 åpnet→**foreslo A** (arv), byttet manuelt→B «Skjermbilde 2026-09-02», rad 3 åpnet→**foreslo B, ikke A**. Arven leser **forrige rad (n−1)**, ikke rad 1. Tegningsvalg: 5 trykk (rad 1) → 0 (rad 3, beholdt arv). «Posisjon i tegning»-feltet rendret i repeater-raden (kritisk port bestått) |
| 15 | Tegning uten punkt (paritet + krasj) | ✅ | — | ✅ | **Ingen krasj** i noen drawing-uten-punkt-vei (pid stabil). Dangling-tilstand ikke skapbar via UI (Lukk/X diskarder, Bekreft disabled) → krasjklassen forhindret ved kilden. BEF_2 lesevisning rendret 3 posisjoner uten krasj |

**Sum:** **15/15 mål nådd** (flyt 14 låst opp av Kenneths seed 2026-09-02 og bestått —
repeater-arven leser forrige rad, ikke rad 1). **Ingen atferdsregresjon som utsetter bygg.**
Nye anmerkninger til cowork: (a) prioritet-label henger ett språk bak språkbytte, (b) rest-norsk
«Dato og tid»/«Medium prioritet» + ulokaliserte måneder på polsk, (c) modulendring krever manuell
refresh, (d) send-arktekst «…bytte til Send?», (e) innmelder-valg fester seg ikke, (f)
prosjektvelger tom til firma valgt etter relaunch. Flyt 3 trykk-mål **7→4** (tegningsminnet
virker). **Klar for EAS-bygg** mht. atferd.

---

## Tilstand etterlatt (neste kjøring starter på sekunder) — oppdatert Kjøring 2 (2026-09-02)

- **Tunnel:** `3301` oppe (`ssh -f -N -L 3301:localhost:3301 server-ny`). 🔴 **Krever Tailscale
  oppe** — var stoppet ved øktstart (`sudo tailscale up`), ellers timer SSH til `server-ny` ut.
- **Simulator:** iPhone 16 Plus (iOS 18.4) booted. **Appen er nå et lokalt Debug dev-bygg fra
  `63109cf7`** (ikke Release, ikke `1a1844e8`). 🔴 Et Release-bygg (`.env.production` → **prod**)
  ble startet ved en feil og terminert før interaksjon — installert app er nå Debug/test.
- **Metro:** 8081 kjører (bakgrunn, dev-client). ⚠️ Krasjet 2× på `ws`-WebSocket-feil under
  Node v25 og måtte restartes; appen overlever i minnet uten Metro (kun reload trenger den).
  Reconnect: `xcrun simctl openurl booted "com.kemyrhau.sitedoc://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- **Språk:** tilbakestilt til 🇳🇴 Norsk bokmål (var innom polsk i flyt 13).
- **Firma/prosjekt:** aktiv firma `SITEDOC MYRHAUG`, sist på prosjekt `Sitedoc Boligfelt B12`
  (byggeplass Bygg B12), åpent dokument **BEF_1 Beraringsrapport (Utkast)** fra flyt 14.
  **Timer-modulen: PÅ** (slått av/på under flyt 12, endte PÅ).
- **Fotobibliotek:** ett test-foto lagt til; SiteDoc har full fototilgang.
- **Testdata skapt/endret denne kjøringen** (test-DB `sitedoc_test`, greit å beholde):
  - **BEF_8** (Røstbakken) — tekst «Flyt2 tekst 1547» + ett bilde på rad 1; rad 2 fikk
    tegningsposisjon Z-20-01 (50.0/26.3 %); rad 3 lagt til (tom).
  - **BEF_10** (Befaringsnotat, Utkast) — ny (flyt 6), flyt BL→BH.
  - **RUH2** (RUH, Utkast) — ny (flyt 8).
  - **BHO4** (Oppgave, Røstbakken) — status endret **Utkast → Mottatt** (sendt).
  - **Dagsseddel ons. 15. juli 2026** — én ekstra Anleggsarbeid-rad (2 t), sum 7.50 → 9.50 t.
  - **BEF_1 Beraringsrapport** (Bygg B12, Utkast) — ny (flyt 14). 3 repeater-rader:
    rad 1 tegning A (Bygg B12 - Plantegning, 50.0/44.1 %), rad 2+3 tegning B
    (Skjermbilde 2026-09-02, 50.0/35.9 %). Beskrivelsesfelt tomme.
- ✅ **Flyt 14 seedet av Kenneth 2026-09-02:** mal «Beraringsrapport» (BEF_) på Bygg B12 med
  repeater «Observasjon/kontroll/objekt» + `drawing_position`-felt «Posisjon i tegning», og 2
  tegninger på byggeplassen. Kritisk port (feltet rendrer i raden) bestått — feltene var merket
  «Betinget» i malbyggeren, men rendret uten betingelse-blokkering.
