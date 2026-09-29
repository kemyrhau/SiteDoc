---
name: FUNKSJONSENDRINGER
description: Register over merger som endret INTENSJONEN — det brukeren skal kunne, ikke bare det koden gjorde. Kenneths kontrollflate. Føres av cowork ved merge, aldri i ettertid.
sist_verifisert_mot_kode: 2026-09-28
sources: cowork
---

# Funksjonsendringer — Kenneths kontrollflate

🔴 **HVA DENNE FILA ER FOR** (Kenneth 2026-09-27):

> «jeg trenger å fange opp det som endrer funksjoner → jeg trenger ikke bruke tid på hull og
> forbedringer uten funksjonsendring»

**Definisjonen, løypa og smutthullet står i
[SAMARBEIDSREGLER § LUKKER HULL vs ENDRER FUNKSJON](SAMARBEIDSREGLER.md).** Kort:

- 🔴 **FUNKSJONSENDRING** = intensjonen byttes. **Krever hjemmel fra Kenneth før ordren sendes.**
- 🟢 **REPARASJON** = koden kommer tilbake til noe som var ment. **Ingen godkjenning** — men føres
  her hvis virkningen er synlig, så Kenneth ikke blir overrasket.
- 🔴 **Intensjon teller bare hvis den er SKREVET NED før endringen.** Finnes ingen: funksjonsendring
  som standard. **«Produktvalget er tatt» i en designordre er ikke en hjemmel.**

---

## 🔴 FUNKSJONSENDRINGER — krevde hjemmel

### 2026-09-29

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `1b7fc87b` | Bildevedlegg i sjekklister og oppgaver — **web** | **Ingen annotering i web.** Bildet kunne vises og slettes, ikke merkes. Nå: pil, sirkel, firkant, frihånd og tekst — og **Velg/Flytt**, så en pil kan dras i stedet for å tegnes på nytt | 🟢 Kenneth 2026-09-29, valgte «paritetsmåling + annotering i web i samme runde» |
| `1b7fc87b` | Samme | Annoteringen lagres som et **redigerbart lag**, ikke brent inn i bildet. Tre artefakter: **originalen røres aldri** · Fabric-laget som data · utflatet JPEG for visning, PDF og mottaker | 🟢 Kenneth 2026-09-29: *«hvorfor kan vi ikke legge et eget lag på bildet → slik at anotering er redigerbart?»* |

#### 🔴 KONSEKVENS DU SKAL KJENNE: flatene har nå ULIK ANGRERETT på samme handling

**Web:** annoter → originalen består → åpne igjen → flytt pilen → angre helt.
**Mobil:** annoter → **originalen erstattes permanent** (`FeltDokumentasjon.tsx:532`, siden 2026-08).

⚠️ **Ingen ny skade — mobil har oppført seg slik siden annoteringen ble bygget, og web bryter ikke på
mobil-annoterte bilder** (KRAV(c) test 4: de blir ikke-redigerbare, ikke ødelagte). 🔴 **Men fra og med
denne mergen avhenger det av hvilken skjerm brukeren holder i hånda om han kan angre.** **Og piloten er
mobil-først — altså den flaten som IKKE kan.**

🟢 **Mobil-runden er avgrenset bevisst, ikke utsatt:** den endrer lagringsmodellen og rører
**offline-køen**, som er den skjøreste flaten vi har («Mobil-appen MÅ fungere offline»). Den får egen
gate. 🔴 **Og den er blokkert til simulatoren peker mot `api-test` i stedet for produksjon**
([BACKLOG](BACKLOG.md)) — den runden trenger den innloggede in-app-flyten.

#### 🟢 Sidefunn fra samme runde: annoteringen var aldri borte

**Kenneth trodde funksjonen var forsvunnet fra sjekklister.** Målt: `FeltDokumentasjon.tsx` i web har
**null treff på annotering i hele git-historikken.** Den har alltid vært mobil-only. 🟢 **Paritetsmålingen
som fulgte:** 33 rapportobjekt-komponenter finnes i BEGGE trær — **24 i full paritet, 9 divergerer, 1 ren
mangel.** ⚠️ **De ni er divergens fra parallell utvikling, ikke tap** — men listen bør vedlikeholdes, ikke
lages én gang.

### 2026-09-27

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `a2a4083c` | `/uploads/` fil-URL-er (alle flater) | Signaturlevetid **24 t → 15 min** | 🟢 Kenneth valgte 15 min, **betinget** av at selvfornyelsen gjør utløp usynlig ([BACKLOG](BACKLOG.md)). Betingelsen ble oppfylt 27.09 da lenke-klassen fikk selvfornyelse ⚠️ **Kenneth fikk betingelsen, ikke brukeropplevelsen — se merknad under** |
| `e1b0f61b` | Sjekklister (web + mobil) | **KA7** «Dokumentasjon på opprinnelse», **KB2** «Varedeklarasjon kontrollert», **KB4** «Klippet jevnlig frem til overtakelse» var trafikklys. Nå nedtrekk med navngitte valg | 🟢 Kenneth bestilte MK C-revisjonen |
| `e6e20804` | Malbygger, prefiks-felt | Tom prefiks ble godtatt. **Nå avvises den.** Auto-suffiks `SJA2` → `SJA-2` | 🔴 **INGEN.** Designordren skriver «Produktvalget er tatt», men `grunnlag` er coworks kartlegging + SQL-målinger |
| `83ee6bb6` | Firmamal, prefiks-felt | Lagret man med tomt prefiks-felt, ble prefikset **fjernet**. Nå betyr tomt felt «ikke endre» | 🔴 **INGEN.** Residual av samme ordre |
| `1c537726` | Sjekklistebibliotek, malkode | Malen het **`UM1.1`**. Heter nå **`UM1S`** | 🔴 **INGEN.** Designs ordre |
| `1ebfb693` | Eksport-flaten, 15 språk | 12 tekstnøkler het `arkiv.*` og brukte ordet «arkiv» mot brukeren. Nå `eksport.*` og «eksport» | 🟡 Commit heter «navnevedtak» og peker på et vedtak — **sporet er ikke funnet. Bekreft eller korriger** |

#### 🔴 De fire radene som mangler hjemmel — til avklaring

**Alle fire er små, og alle fire er sannsynligvis riktige.** ⚠️ **Men de står i develop uten at
Kenneth har sett dem, og det er tilstanden registeret finnes for å hindre.** 🔴 **Ikke rull noe
tilbake før Kenneth har svart.**

#### ⚠️ Merknad til signaturlevetiden — hjemmelen holder, informasjonen holdt ikke

**Det som ble skrevet ned var betingelsen** («selvfornyelsen gjør utløp usynlig») — en teknisk
påstand. **Ingen skrev hva en bruker faktisk merker.** 🔴 **Og målt 2026-09-28: gaten har ALDRI kjørt
i prod** (siste prod-deploy `eb9071f2` 24.09; `/uploads/`-gaten kom 26.09, 15 min 27.09). **Så det
finnes ingen erfaring med tallet ennå.**

**Kenneth vurderte 8 timer og valgte å beholde 15 min** til test har gitt data — *å bytte bort
sikkerhet på grunnlag av en observasjon som ikke kunne ha skjedd, er å gjette med tall.*
🟢 **Den reelle brukerkostnaden er en annen og rettes separat:** `SIGNERT_BILDE_MAKS_FORSOK = 1`
betyr at ett dropp i dekningen ødelegger bildet, og med 15 min fornyes en åpen fane ~96 ganger i
døgnet. **Piloten er 50 anleggsgartnere på dårlig 4G — det er deres normaltilstand.**

---

## 🟢 REPARASJONER MED SYNLIG VIRKNING — til orientering, ingen godkjenning

### 2026-09-28

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `38567b33` | Trafikklys i sjekklister/oppgaver — web, mobil og arkiv-PDF | **Rendreren leste aldri `objekt.config.options`.** En mal som erklærte sitt eget lyssett ble ignorert, og feltet viste standardsettet Godkjent/Anmerkning/Avvik/Ikke relevant. **Nå vises malens eget sett, i malens rekkefølge, med malens etiketter** | 🔴 **Malene har erklært lyssettene hele tiden.** `TrafikklysObjekt.tsx:14` destrukturerte `{ verdi, onEndreVerdi, leseModus }` og leste aldri `objekt` — `config.options` var uleselig for skjermen |
| `38567b33` | Malbyggeren | Én trafikklys-oppføring i paletten | **To:** ett tre-lys og ett fire-lys. Begge oppretter `traffic_light`; tresettet er en delmengde (firesettet minus `gray`), ikke en andre liste |
| `38567b33` | Malbyggeren, lagring | Et lyssett kunne lagres med duplikater, ukjente verdier eller ett lys | **Avvises nå** med `BAD_REQUEST`. 🟢 **Antallet er IKKE låst til 3/4** — en hardkodet grense ville gjentatt feilen i [`bruk-er-ikke-behov.md`](retningslinjer/bruk-er-ikke-behov.md). Mangler `options` → kanonisk firelys-fallback, som verner de 27 dagens felt |

🔴 **KUNDESYNLIG NÅR DET DEPLOYES:** målt at **6 av 6 `traffic_light`-felt i PROD har egne `options`** —
altså viser samtlige feil etiketter i dag. **Fire av de seks tilhører A.Markussen.** 🟢 **Ingen er besvart
ennå**, så ingen lagret verdi skifter betydning. ⚠️ **Ligger på develop; prod er ikke rørt.**

🟡 **Én konsekvens å kjenne til, ikke en mangel:** seedede etiketter oversettes (`oversettStandardtekst`),
**firmaets egne etiketter vises rått på alle 15 språk.** 🔴 **Det er et bevisst valg, og grunnen er ikke at
vi ikke KAN oversette — det er at vi ikke SKAL:** en maskinoversatt etikett på et kontrollpunkt er en
påstand om hva som ble kontrollert mot, og tar oversettelsen feil, **lyver et signert dokument.** Samme
grunn som malreglene forbyr ordrett normtekst. 🟢 **Rammer bare den som aktivt overstyrer teksten — da er
det hans tekst, på hans språk.**

### 2026-09-27

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `c98791a4` | PSI-opprettelse (web) | PSI nr. to ga **stille feil** — spinneren stoppet, ingenting skjedde. Nå inline melding om hvilken PSI som finnes og hva brukeren kan gjøre | Det var meningen at opprettelsen skulle gi tilbakemelding |
| `0f8eccdf` | Trafikklys (web + mobil + arkiv-PDF) | En lagret verdi utenfor verdisettet fikk feltet til å se **ubesvart** ut. Nå vises den rå verdien med teksten «ikke et gyldig valg» | Et lagret svar skal aldri forsvinne stille |
| `e1b0f61b` | Sjekkliste KB4, hjelpetekst | «… sett «Ikke relevant».» → «… sett «Ikke relevant (grasbakke/eng)».» | Hjelpeteksten skal sitere opsjonen som finnes |
| `24b598bf` | PSI-opprettelse (DB-garanti) | Prod håndhevet **én PSI per prosjekt**. Nå: én per byggeplass, og høyst én på prosjektnivå | 🟢 Kenneths egen beskjed: «et prosjekt kan ha ti forskjellige psi» — indeksen avvek fra den |

### 🔴 Venter på prod, og skal verifiseres FØR deploy

| Hash | Hva som skjer | Hvorfor det må ses i felt |
|---|---|---|
| `8db99f8e` + `a2a4083c` | `/uploads/` er **default-deny for hele treet**. Hver bilde- og vedlegg-URL må være signert | **Har aldri kjørt i prod.** Er én konsument glemt, viser den et tomt bilde hos en kunde. Coworks negative kontroll fant 0 gjenstående rå lenker i `apps/web/src`, og mobil dekkes av resolveren — **men det er målt i kode, ikke i felt.** 🔴 **Verifiser som innlogget på test: sjekkliste med bilder · oppgave med vedlegg · en tegning · last ned ett vedlegg.** `curl` med 200 beviser ingenting her |

---

## Ikke ført — ingen synlig virkning i noe tilfelle

**29 docs-merger 26.–27.09** · `fix/psi-prosjektniva-unik` DROP-vakt (testfil) · snubletråder,
paritetstester, `psiWhere`-opprydding, `ukjentTrafikklysVerdi` flyttet til `shared`.
