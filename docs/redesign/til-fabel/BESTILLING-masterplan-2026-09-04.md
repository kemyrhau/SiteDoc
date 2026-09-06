# Bestilling til fabel — fire saker + oppdatert masterplan

**Fra cowork, 2026-09-04 kveld. Kenneth-bestilt.**
**develop `5cd494b0` · prod `96eebc13` · test `ea729ced` · TestFlight bygg 54 + OTA**

Denne fila er kopien i repoet; meldingen ble relayet til fabel samme kveld.

## 0. Bestillingen, kort

**Fire saker fra i kveld venter design, og masterplanen skal oppdateres.** Cowork fletter
masterplan-endringene inn — **lever merkede tillegg, aldri helfil, og aldri en duplikat av noe
som allerede står.**

## 1. Døgnet i tall — dette har du ikke sett

Ti merger, to prod-deployer, tre migreringer.

🔴 **Masterplanen var opptil fem uker bak koden.** Cowork avstemte den mot develop 04.09 og fant
at **fem av åtte punkter i rekkefølgen var levert.** Del 6b fase 2 ble bygget *samme dag ordren
ble skrevet* (28. juli) og sto som «aldri relayet» i fem uker. Resultatet er ført i
`REDESIGN-MASTERPLAN.md § AVSTEMT MOT KODE 2026-09-04`. **Bygg på den, ikke på rekkefølgen over
den.**

**Levert i kveld:**

| Runde | Hvor |
|---|---|
| EXIF opptakstid og -sted på bilder | **prod + testerne via OTA** |
| Lesbar endringslogg | **prod + OTA** |
| **OTA i drift** — første `eas update`, runtime `1` | JS-fikser koster ikke lenger byggkvote |
| AM 4 malarkiv bolk 1 + 2 | **test** |
| lokasjonOmfang + L9 + paritetsfiks | **test** |
| Arkiv-PDF for oppgave og HMS avvik/RUH | develop |

🔴 **RUH og avvik kunne ikke bli PDF før i kveld.** De er `Task`, og arkivmalen kastet for alt
annet enn sjekkliste. Det ble funnet fordi Kenneth sa: *«det er et generelt problem at jeg sier
sjekklister for funksjoner som er generelle for sjekkliste/oppgave/HMS.»*

## 2. Fire saker — designbeslutninger, ingen ordre skrevet

### A. Eksport og navngiving 🔴 størst

Kenneth: *«PDF og Excel utskrifter/delinger må kunne gjøres fra både app og web. Vi må kunne
velge, preview og dele.»* Og om navnet: *«Arkiv-PDF — er dette et godt ord? Hva med eksport → til
PDF, til CSV, til Excel? Brukeren vet hva eksport er. Kanskje vi må eksportere til arkiv også? Det
gjør vi ikke i dag.»*

**Målt:** `status.arkivert: "Arkivert"` finnes allerede som dokumentstatus — «Arkiv-PDF» kolliderer
med et ord som betyr noe annet i samme grensesnitt. «Arkivmal» er vårt interne kodenavn som lekket
ut i UI. Excel/CSV finnes for import og timer-eksport, **ikke for dokumenter.**

Coworks vurdering, til din prøving: **eksporter** = få dokumentet ut · **arkiver** = holdes ledig
for handlingen som ikke finnes. Det siste er PR-sporets «arkivering framfor nedlasting», som
fortsatt venter på deg.

### B. Byggeplass-livssyklus 🔴

Kenneth: *«Et prosjekt kan leve i 30 år eller mer — men bestå av mange kortvarige prosjekter som
varer en uke eller en måned. Kanskje vi må skjule og lukke disse etter behov.»*

Konkret: kunde med prosjektnummer 100 «Småprosjekter» — hver jobb er en `Byggeplass`.

✅ **Modellen holder, intet nytt nivå trengs** (cowork spurte, Kenneth avklarte). **Men
`Byggeplass` har verken tilstand, start/slutt eller arkivering.** Ved stor skala: velgeren med 500
valg er ubrukelig i felt, lister vokser uten grense.

Åpent: skjules avsluttede byggeplasser i velgere eller kun i lister · kan dokumenter opprettes på
en byggeplass som ikke har startet · hva skjer med PSI og mannskapsliste når et trinn avsluttes.
Full utredning i `domene-arbeidsflyt.md`.

### C. «Gjelder hele prosjektet» som eksplisitt valg 🟡

`lokasjonOmfang` ("punkt" | "byggeplass" | null) er levert. **Tredje nivå mangler fortsatt
eksplisitt uttrykk:**

```
punkt på tegning     lokasjonOmfang = "punkt"        ✅
hele byggeplassen    lokasjonOmfang = "byggeplass"   ✅ levert 04.09
hele prosjektet      byggeplassId = null             ⚠️ tvetydig
```

Kenneths gatelys-eksempel gjelder ett trinn opp også. **Målt:** `byggeplassId` er nullable overalt
unntatt `Omrade` og `Kontrollplan`, og to steder står *«null = gjelder hele prosjektet»* allerede
i schemaet.

### D. Ansvarsgrensen — hva SiteDoc leverer, hva bedriften eier 🔴

Kenneth: *«SiteDoc må selvsagt opplyse bedriften om deres ansvar og hva SiteDoc leverer.»*

Bakgrunn: cowork brukte eksponeringsregisterets 40–60-årskrav som argument for en sletteregel.
Kenneth korrigerte: *«dette skal være bedriftens ansvar.»* **SiteDoc er ikke et
eksponeringsregister.**

Kravet er at kunden får vite grensen **i produktet**. Hvor er ditt valg — firma-onboarding,
HMS-hjelpetekst, egen side, vilkår. 🔴 **Feil sted er like ille som ingen tekst.**

⚠️ **Teksten skal ikke skrives av cowork eller en kodeagent.** Den grenser mot juridisk ansvar.
Du eier den, Kenneth gater den.

## 3. Masterplan — hva bestillingen er

Etter avstemmingen 04.09 er køen tom for arbeid som kan gå til en kodeagent uten design først. De
to gjenstående punktene i rekkefølgen: **AM 4 malarkiv** (designet ditt, nå på test) og
**AM 2 attestering/40-timers** (timer-arbeid, nedprioritert med målt begrunnelse — prod hadde null
attesterte sedler 27.08).

**Lever en oppdatert rekkefølge som tar inn:**
- de fire sakene over, prioritert mot piloten (~sept 2026, 50 ansatte, mobil viktigst)
- **at OTA endrer regnestykket** — mobilarbeid koster ikke lenger byggkvote, og det kan gjøre
  mobil-forslag verdt mer enn da du sist prioriterte
- de tre åpne funnene: byggeplass-livssyklus · chip-teksten som lover en avgrensning systemet ikke
  gjør · at tegninger filtrerer hardt på byggeplass mens dokumenter filtrerer mykt (ikke vedtatt
  noe sted)

🔴 **Form — ufravikelig:**
- **Merkede tillegg, aldri helfil.** `REDESIGN-MASTERPLAN.md` finnes i repoet og eies av cowork.
- **Ingen duplikat.** Står noe allerede — i masterplanen, `domene-arbeidsflyt.md`,
  `STATUS-AKTUELT.md` eller designnotatene fra i dag — vis til det. Ikke gjenta det.
- **Cowork fletter.** Du leverer `TILLEGG-…`; cowork plasserer og eier stien.

## 4. Én arbeidsform-lærdom, fordi den gjelder deg også

Kenneth svarte *«jeg forstår ikke konsekvensen»* på et spørsmål cowork stilte i modelltermer. Han
svarte presist og umiddelbart da spørsmålet ble tatt til et dokument han selv hadde laget en time
før — og ga tilbake gatelys-eksempelet, som forklarer `lokasjonOmfang` bedre enn noen tabell.

**Ordrer og designnotater bør bære det konkrete eksempelet, ikke bare regelen.**
