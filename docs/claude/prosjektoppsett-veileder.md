# Prosjektoppsett-veileder

**Status:** Plan (ikke implementert som in-app veileder) — 2026-05-02
**Bakgrunn:** Observert under manuell test at ny bruker ikke finner frem
uten å kjenne URL-strukturen. Blokkerer selvstendig A.Markussen-onboarding.

---

## Konseptuell forståelse — viktig å lese først

### Hva er en faggruppe?
En faggruppe er en **part i prosjektets dokumentflyt** — typisk et firma
eller en avdeling som sender eller mottar dokumenter. Eksempel:
- «A.Markussen AS» — entreprenøren
- «Byggherre Boligfelt B12» — byggherren

Faggruppen er **ikke** en gruppe ansatte. Det er en dokumentflyt-part.

### Hva er en brukergruppe?
En brukergruppe er en **samling ansatte** med samme faglige rolle i prosjektet.
Eksempel:
- «A.Markussen Ansatte» — arbeidere som registrerer sjekklister
- «A.Markussen Ledelse» — ledere som godkjenner
- «Byggherre» — byggherre-representanter

Brukergrupper knyttes til roller i dokumentflyten (Registrator, Bestiller,
Utfører, Godkjenner). En enkeltperson uten gruppe kan også knyttes direkte
til en rolle.

### Hva er en dokumentflyt?
En dokumentflyt definerer **hvem sender hva til hvem**. Den har:
- Et navn (f.eks. «A.Markussen Ansatte», «Endringmelding»)
- Roller i rekkefølge: Registrator → [Bestiller] → [Utfører] → Godkjenner
- Maler knyttet til flyten (sjekklister, oppgaver)

Dokumentflyten er **firma-uavhengig** — tilgang styres av gruppe-tilknytning,
ikke av hvem som er arbeidsgiver.

### Prosjekttype avgjør struktur
- **Byggeprosjekt:** Lokasjon = Bygg (med etasjer) + Utomhus
- **Veiprosjekt:** Lokasjon = Parseller eller strekninger
- Alle bygg har vanligvis en utomhusdel

---

## Rekkefølge for prosjektoppsett (låst — hvert steg avhenger av forrige)

### Steg 1 — Opprett prosjekt
- URL: `/dashbord/nytt-prosjekt` (knapp øverst høyre på dashbord)
- Felter: Navn, beskrivelse, adresse
- Resultat: Prosjektnummer genereres automatisk (SD-YYYYMMDD-XXXX)

### Steg 2 — Opprett faggrupper
- URL: `/dashbord/prosjekter/[id]/faggrupper` → «Ny faggruppe»
- ⚠️ IKKE `/dashbord/[prosjektId]/faggrupper` — den er read-only
- Felter: Firmanavn, organisasjonsnummer (valgfritt)
- Typisk: «A.Markussen AS» + «Byggherre [Prosjektnavn]»

### Steg 3 — Sett opp dokumentflyt og roller
- URL: Innstillinger → Produksjon → Dokumentflyt
  (`/dashbord/oppsett/produksjon/kontakter`)
- Per faggruppe: opprett dokumentflyt(er) med navn
- Per dokumentflyt: legg til roller (Registrator, Bestiller, Utfører, Godkjenner)
- Roller fylles med grupper eller enkeltpersoner — gjøres i steg 6
- Eksempel A.Markussen:
  - Faggruppe «A.Markussen AS» → flyt «A.Markussen Ansatte»
    (Registrator → Godkjenner)
  - Faggruppe «Byggherre» → flyt «Endringmelding»
    (Registrator → Bestiller → Godkjenner)

### Steg 4 — Importer sjekkliste- og oppgavemaler
- URL: Innstillinger → Produksjon → Sjekklisemaler
  (`/dashbord/oppsett/produksjon/sjekklistemaler`)
- Knapp: «Legg til» → pil ned → «Hent fra bibliotek»
- Bibliotek inneholder NS 3420-K:2024 Anleggsgartnerarbeider:
  - KA: Innledende arbeider (KA7 – Gjenbruk av materialer)
  - KB: Jord og vegetasjon (KB2 – Jordarbeider, KB4 – Grasdekke,
    KB6 – Planting)
  - KC: Vanningsanlegg (KC3.1 – Oppstøtting av trær)
  - KD: Utendørsbelegg (KD1 – Utendørsbelegg)
- Allerede importerte maler vises med grønt hake
- Andre alternativer: «Opprett ny», «Importer fra annet prosjekt»,
  «Importer fra firma», «Opprett fra PDF»

### Steg 5 — Opprett brukergrupper
- URL: Innstillinger → Brukere (`/dashbord/oppsett/brukere`)
- Knapp: «+ Ny gruppe» øverst høyre
- Typisk: «A.Markussen Ansatte», «A.Markussen Ledelse», «Byggherre»
- Merk: Brukergrupper ≠ faggrupper. Faggruppe = dokumentflyt-part.
  Brukergruppe = ansatte med samme rolle.

### Steg 6 — Legg til brukere og knytt til grupper
- Samme side: Innstillinger → Brukere
- Eksisterende brukere: hover over gruppe → klikk «+»-ikon → velg fra liste
- Nye brukere: knapp «Inviter ny bruker» (sender e-post-invitasjon)
- Merk: Firma-kolonnen viser User.organizationId (global arbeidsgiver),
  ikke prosjektrolle. Les-only — kan ikke endres av prosjektadmin.

### Steg 7 — Koble brukergrupper til dokumentflyt-roller
- URL: Innstillinger → Produksjon → Dokumentflyt
- Ekspander faggruppe → ekspander dokumentflyt → klikk «+ Legg til»
  på hver rolle
- Dropdown viser: GRUPPER (brukergrupper) + PERSONER (enkeltbrukere)
  + «Inviter ny person»
- Eksempel:
  - Registrator → gruppe «A.Markussen Ansatte»
  - Godkjenner → gruppe «A.Markussen Ledelse»

### Steg 8 — Koble maler til dokumentflyt
- Samme side: under dokumentflyten → «+ Legg til mal»
- Dropdown viser: SJEKKLISTER / OPPGAVER (kun maler fra steg 4)
- Velg de malene som passer flyten
- Eksempel: KB2 + KB4 + KB6 koblet til «A.Markussen Ansatte»-flyten

### Steg 9 — Opprett lokasjoner og last opp tegninger
- URL: Innstillinger → Lokasjoner (`/dashbord/oppsett/lokasjoner`)
- Knapp: «+ Legg til»
- Typisk struktur:
  - Bygg [navn] → undertegninger per etasje
  - Utomhus → situasjonsplan / utomhustegning
- Støttede formater: IFC, DWG, PDF, bilde (PNG/JPG)
- Etter opplasting: fyll inn Tegningsnummer, Fagdisiplin, Tegningstype,
  Etasje, Revisjon, Målestokk, Opphav
- Tegningen organiseres automatisk under etasje-gruppen

### Steg 10 — Georeferér tegninger
- Klikk tegning → «Georeferanse»-knapp øverst
- Koordinatsystem: ETRS89 UTM-33 (default, korrekt for Norge)
- Sett 2 referansepunkter: klikk «Plasser» → klikk punkt på tegning →
  klikk tilsvarende punkt på kartet
- Valgfritt: legg til referansepunkt 3+ for bedre nøyaktighet
- Avslutt med «Lagre kalibrering»
- Tegningen vises merket «Georeferert» i sidepanelet

---

## Kjente UX-problemer og løsninger (observert 2026-05-02)

| Problem | Konsekvens | Foreslått fix |
|---|---|---|
| `/dashbord/[prosjektId]/faggrupper` er read-only uten lenke til CRUD | Bruker får 404 ved intuitiv navigering | Legg til lenke i tom-state |
| CRUD for faggrupper ligger på `/dashbord/prosjekter/[id]/faggrupper` | Inkonsistent URL-struktur | Konsolider til én rute |
| Ingen tom-state veiledning på prosjekt-dashbord | Bruker vet ikke hva neste steg er | Progress-banner med neste steg |
| Redigeringsmodus i Kontakter trigger ved klikk på navn (ikke synlig) | Ny bruker finner ikke redigeringen | Blyant-ikon alltid synlig |
| Esc lukket ikke redigeringsmodus (fikset 0c6f7091) | — | Løst |

---

## Ønsket in-app veileder (planlagt — ikke bygget)

Etter prosjektopprettelse vises en steg-for-steg fremdriftsindikator:

```
● Faggrupper          (0/2 opprettet)
○ Dokumentflyt        (venter)
○ Maler               (venter)
○ Brukergrupper       (venter)
○ Brukere             (venter)
○ Lokasjoner          (venter)
```

Hvert steg lenker direkte til riktig side. Steget markeres fullført
automatisk basert på DB-tilstand. Veilederen kan minimeres.

Implementasjonsalternativer:
- Modal/wizard ved første besøk på nytt prosjekt
- Persistent progress-banner på prosjekt-dashbord til alle steg er fullført
- Tom-state med «Kom i gang»-knapp per seksjon

---

## Notater for A.Markussen-onboarding

Basert på observert oppsett på prod (sitedoc.no):

**Faggrupper:** 00 A.Markussen → BH, 01 A.markussen, Byggeledelse, Grunnarbeid

**Dokumentflyter:**
- Endringmelding: Reg (A.Markussen Ledelse) → Best (Byggherre) →
  Utf (A.Markussen Ledelse) → Godk (Byggherre)
- A.Markussen Ansatte: Reg (A.Markussen Ansatte) → Godk (A.Markussen Ledelse)
- BL til BH: Best (Byggherre) → Utf (Byggherre)

**Maler koblet til flyter:**
- A.Markussen Ansatte: Befaringsrapport (BEF), HMS-avvik (HMS)
- Byggeledelse: Byggelederens dagbok/kontroll

**Brukergrupper:** BYGGHERRE, A.MARKUSSEN ANSATTE, A.MARKUSSEN LEDELSE

---

## Referanser
- Dokumentflyt-arkitektur: `docs/claude/dokumentflyt.md`
- NS 3420-bibliotek: `docs/claude/kontrollplan.md`
- UX-observasjoner: `docs/claude/STATUS-AKTUELT.md` § Planlagte oppgaver
- Fase 0-beslutninger: `docs/claude/fase-0-beslutninger.md`
