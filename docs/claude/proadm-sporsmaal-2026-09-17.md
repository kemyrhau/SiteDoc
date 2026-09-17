---
tittel: Spørsmålsliste til Proadm — integrasjon endringsmelding
opprettet: 2026-09-17
status: 🟡 UNDERLAG — til bruk i dialog med Proadm. Ingen svar innhentet ennå
eier: Kenneth
sist_verifisert_mot_kode: 2026-09-17 (mot develop feddad76)
---

# Spørsmål til Proadm

**Formål med møtet:** finne ut hva som teknisk er mulig mellom Proadm og SiteDoc for
**endringsmeldinger**, slik at vi kan bestemme hva som skal bygges.

**Hva vi ønsker å oppnå, i én setning:** *en endringsmelding fra Proadm leses inn i SiteDoc,
behandles der av entreprenør og byggherre i én låst flyt, og det godkjente svaret går tilbake
til Proadm.*

🔴 **Ingenting bygges før disse er besvart.** Fire av spørsmålene har stått åpne i SiteDocs
egen spesifikasjon siden 2026-04-29 nettopp fordi de ikke kan besvares uten Proadm.

---

## A — Hva kan Proadm sende UT?

**A1.** Finnes det et API, en eksportfil eller en webhook som gir ut endringsmeldinger?
Hvis flere: hvilken anbefaler dere?

**A2.** Hvilke felter følger med en endringsmelding? Vi er særlig ute etter:
identifikator, type, beskrivelse, beløp, dato, hvem som opprettet den, status, og hvilket
prosjekt eller kontrakt den hører til.

**A3.** Kan vi hente kun endringer siden sist, eller må vi hente alt hver gang?

**A4.** Hvordan autentiserer vi oss? API-nøkkel, OAuth, noe annet?

**A5.** Er det begrensninger på hvor ofte vi kan spørre?

---

## B — Kan Proadm ta imot?

🔴 **Dette er spørsmålet som avgjør om returveien i det hele tatt er mulig.**

**B1.** Kan en ekstern part sette status på en endringsmelding i Proadm — for eksempel
«godkjent» eller «avvist»?

**B2.** Hvis ja: kan vi også sende med hvem som godkjente, når, og en begrunnelse?

**B3.** Hvis nei: finnes det noe annet vi kan skrive tilbake — en kommentar, et vedlegg,
et fritekstfelt?

**B4.** Hvis ingenting kan skrives tilbake: hva er den vanlige måten kunder løser dette på
i dag? Manuell overføring?

---

## C — Identitet og endringer over tid

**C1.** Har hver endringsmelding en identifikator som er stabil over tid, og som ikke
gjenbrukes? *(SiteDoc trenger den for å koble vår kopi til deres original.)*

**C2.** Når en endringsmelding endres hos dere — er det samme melding med ny versjon, eller
en ny melding?

**C3.** Kan en endringsmelding slettes eller trekkes tilbake? Hva ser vi da?

**C4.** Hvis vi har hentet en melding og den endres hos dere etterpå — hvordan får vi vite det?

---

## D — Eierskap og ansvar

**D1.** Skal Proadm fortsatt være fasit for beløp og økonomi, slik at SiteDoc kun viser dem
uten å kunne endre dem? *(Det er vår antakelse — vi vil ha den bekreftet.)*

**D2.** Er det felter som IKKE bør vises utenfor Proadm, for eksempel overfor byggherre?

**D3.** Hvem hos dere er teknisk kontaktpunkt hvis vi støter på noe underveis?

---

## E — Praktisk

**E1.** Finnes det dokumentasjon vi kan få tilsendt?

**E2.** Finnes det et testmiljø vi kan prøve mot, så vi slipper å utvikle mot
produksjonsdata?

**E3.** Koster integrasjonen noe — lisens, oppsett, per kall?

**E4.** Har dere gjort tilsvarende integrasjoner før? Hva gikk galt de gangene?

---

## Hva svarene avgjør hos oss

| Svar på | Avgjør |
|---|---|
| **A2** | Hvordan Proadm-felter oversettes til SiteDocs malfelter |
| **B1–B3** | Om returveien bygges — og i hvilken form |
| **C1** | Om vi trygt kan koble vår kopi til deres original |
| **C2 + C4** | Om en ny endring oppdaterer vår kopi eller lager en ny versjon |
| **D1** | Om økonomifeltene låses for redigering i SiteDoc |
| **E2** | Om vi kan utvikle uten å røre produksjonsdata |

---

## Bakgrunn — for vår side, ikke for møtet

**To skrevne vedtak sier i dag at det IKKE går noen vei tilbake til Proadm:**

- `docs/claude/timer.md:956` — *«Auto-sync SiteDoc → Proadm utsettes til senere»*
- `CLAUDE.md` § Proadm-integrasjon — *«Proadm mottar kun ferdig godkjente timer/tillegg/utlegg
  — ingen godkjenningsflyt eller statusoppdateringer tilbake»*

🔴 **Kenneth 2026-09-17:** *«en endringsmelding fra proadm skal leses og bygges til en låst flyt.
og behandles kun i denne flyten -> godkjent svar skal tilbake til proadm.»*

⚠️ **Intensjon, ikke vedtak.** **Kenneth 2026-09-17: «jeg er ikke i dialog med proadm -> jeg må
gjøre det snart -> da først kan vi finne ut hva vi kan gjøre.»**
🔴 **De to vedtakene over står uendret til svarene foreligger. Ingenting bygges på intensjonen.**

**Det som alt finnes i SiteDoc og venter på dette:**

- **`Godkjenning`-modellen** (`schema.prisma:1387`, migrering `20260501000012_add_godkjenning`) —
  bygget, men har null lesere i `apps/api`. **Den er landingspunktet, ikke død kode**
- **`ExternalCostObject.proAdmType`** — bærer allerede Proadms typebegrep som fri streng
  (*varsel/endring/tilleggsarbeid/regningsarbeid*)
- **Bundet flyt** (`Dokumentflyt.bundet`) — komplett på web og mobil per `feddad76`.
  **Den låste flyten Kenneth beskriver finnes allerede**
- **Spec-en:** `docs/claude/timer.md:943` «Drømmescenario — Proadm → auto-opprett SiteDoc
  Godkjenning», 🟡 BACKLOG siden 2026-04-29
