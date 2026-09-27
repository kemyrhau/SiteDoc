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
