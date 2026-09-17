---
tittel: BESTILLING til fabel — skille kontraktsdokumenter fra vanlige oppgaver
opprettet: 2026-09-17
status: 🟡 BESTILLING — sendt, ikke besvart
utloser: Kenneth 2026-09-17 etter gate av bundet flyt på test
---

# Bestilling: varselet ser ut som en oppgave

## 1. Hva Kenneth så

Han bygget en **bundet flyt «Varsel»** (Registrator → Godkjenner) på test og opprettet
`VAR-001`. Bundet flyt virker som tegnet — ankeret står på flytkortet, dokumentet gikk
Utkast → Sendt → Mottatt.

**Kenneth 2026-09-17, ordrett:**

> *«jeg har laget denne lukkede flyten som en oppgave. jeg ser noen svakheter -> dette skulle
> kanskje vært en godkjenningsflyt for å skille den fra vanlige oppgaver.»*

**Innholdet i dokumentet er kontraktsmateriale etter NS 8405/8407:** «Varsel om endring» ·
«Endringer fra byggherren» (irregulær endringsordre, varslingsplikt «uten ugrunnet opphold»,
NS 8405 § 23 / NS 8407 § 32) · «Svikt i byggherres medvirkning» · «Økonomiske og
fremdriftsmessige forhold — vederlagsjustering».

🔴 **Det ligger i samme liste som et befaringsnotat, med samme vekt.**

## 2. 🔴 MÅLT — fabel har ikke repo-tilgang, så her er fakta

| Måling | Resultat |
|---|---|
| **Dokumenttype finnes ikke** | `VAR-001` er en `Task` — **samme tabell som BEF og K-avv** |
| **Eneste skille** | `ReportTemplate.prefix` — **en tekststreng** |
| **Prefiksene er FRI TEKST per mal** | 🔴 **Kun `BEF`, `PSI`, `RUH`, `SJA` er seedet. `VAR` og `K-avv` lagde Kenneth selv.** **Kunder finner opp sine egne — du kan IKKE designe mot en fast liste** |
| **Typevokabular finnes halvveis** | `perspektivEtikett.ts`: `"sjekkliste" \| "oppgave" \| "godkjenning" \| "hms"`. **«godkjenning» står der, ubrukt** |
| **`Godkjenning`-modell i basen** | **Bygget mai 2026 med `bestillerFaggruppe`, `utforerFaggruppe`, `godkjentVed`, `godkjentAvUserId`, `byggherreRef`, `externalCostObjectId`.** 🔴 **NULL lesere i api-et** |
| **Oppgavelistas kolonner** | Prefix · Nr · Status · Tittel · Emne · Prioritet · Ansvarlig · Opprettet av · Bestiller-faggruppe · Utfører-faggruppe · Tidsfrist · Flyt · Bygning. **Kolonnevelger finnes; de tre første er faste** |
| **Bundet flyt** | 🟢 **Komplett på web og mobil, deployet til test.** **Mekanismen «dokumentet blir i sin flyt» FINNES alt** |

⚠️ **Din egen begrunnelse fra bundet flyt-runden gjelder fortsatt:** **du avviste anker i
dokumentlista fordi «lista er tett».** 🔴 **Den er like tett nå.**

## 3. 🔴 DENNE RUNDEN — kun det visuelle. Kenneth har gatet omfanget.

**Kenneth valgte «begge, i rekkefølge» (alternativ 3):**

| Runde | Innhold | Når |
|---|---|---|
| **1 — DENNE** | **Visuelt skille i dagens Oppgaver-liste.** Ingen skjemaendring | **Nå — piloten starter denne måneden** |
| 2 | Ekte dokumenttype, egen flate, `Godkjenning`-modellen tatt i bruk | **Etter piloten.** **Venter på Proadm-svar** |

🔴 **Design KUN runde 1.** ⚠️ **Men design den så den ikke kastes når runde 2 kommer.**

### Rammen

🔴 **En som åpner Oppgaver skal se at VAR-001 ikke er en vanlig oppgave — uten å lære seg
hva «VAR» betyr.**

**Du foreslår HVORDAN.** **Vårt utgangspunkt er INPUT, ikke fasit:** merkelapp på raden,
egen gruppering, eller et filter. 🔴 **Du velger, og du begrunner.**

**Spørsmål vi ber deg svare på:**

1. 🔴 **Hva utleder «dette er et kontraktsdokument»?** ⚠️ **Prefiks kan det ikke være — de er
   fri tekst.** **Er det at flyten er BUNDET? At malen har et bestemt felt? Noe brukeren
   merker selv?** **Dette er rundens viktigste spørsmål**
2. **Hvor bor skillet — i lista, i raden, i filteret, eller flere steder?**
3. **Tåler den tette lista et signal til?** **Mener du nei: si det, og si hva som må vike**
4. **Skal dokumentvisningen (detaljsiden) også merkes, eller holder lista?**
5. 🔴 **Hva heter det?** ⚠️ **«Godkjenning» er tatt av en ubrukt modell og en fremtidig type.
   «Varsel» er navnet på ÉN mal. Vi trenger ordet for KLASSEN**

### Ord som er opptatt — ikke gjenbruk

| Ord | Hvor det er brukt |
|---|---|
| **«Lukket»** | Dokumentstatus |
| **«Låst»** | Maler |
| **«Bundet»** | Flyt-egenskapen — **kan brukes som KILDE til utledningen, men er ikke navnet på typen** |
| **«Entreprise»/«Enterprise»** | 🔴 **FORBUDT i all ny kode og tekst.** Bruk **faggruppe** |

## 4. 🔴 Hva som IKKE er i denne runden

| Utenfor | Hvorfor |
|---|---|
| **Ny tabell eller kolonne** | 🔴 **Ingen skjemaendring. Piloten starter** |
| **Egen navigasjonsflate** | 🔴 **Runde 2** |
| **`Godkjenning`-modellen** | 🔴 **Runde 2, og den venter på Proadm** |
| **Proadm-integrasjonen** | 🔴 **Kenneth har ikke hatt dialogen ennå. Ingenting designes mot den** |
| **Å endre bundet flyt** | 🔴 **Gatet, bygget, deployet. URØRT** |

## 5. Bakgrunn du bør kjenne — men ikke designe mot

**Kenneth 2026-09-17:** *«en endringsmelding fra proadm skal leses og bygges til en låst flyt.
og behandles kun i denne flyten -> godkjent svar skal tilbake til proadm.»*

⚠️ **INTENSJON, IKKE VEDTAK.** **Kenneth: «jeg er ikke i dialog med proadm -> jeg må gjøre det
snart -> da først kan vi finne ut hva vi kan gjøre.»**

🔴 **To skrevne vedtak sier i dag at ingenting går tilbake til Proadm. De står til dialogen er
tatt.** **Design ikke mot returveien.**

🟢 **Men det forteller deg hvor runde 2 er på vei:** **typen du navngir nå blir sannsynligvis
den som bærer Proadm-endringsmeldingen senere.** **Velg et ord som tåler det.**

## 6. Hva vi trenger tilbake

- **Forslaget ditt, med begrunnelse** — særlig svaret på spørsmål 1
- **Ordet for klassen** (spørsmål 5)
- **Tegning eller beskrivelse** som er presis nok til at en agent kan bygge uten å gjette
- 🔴 **Si fra hvis du mener runde 1 er feil vei** — at det visuelle skillet er plaster og at
  vi heller bør vente på den ekte typen. **Vi vil heller ha uenigheten nå**
