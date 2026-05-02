# Prosjektoppsett-veileder

**Status:** Plan (ikke implementert som in-app veileder) — 2026-05-02
**Bakgrunn:** Observert under manuell test at ny bruker ikke finner frem
uten å kjenne URL-strukturen. Blokkerer selvstendig A.Markussen-onboarding.

---

## Konseptuell forståelse — viktig å lese først

### Hva er en faggruppe?
En faggruppe er en **part i prosjektets dokumentflyt** — typisk et firma
eller en avdeling. Eksempel: «A.Markussen AS», «Byggherre Boligfelt B12».
Faggruppen er **ikke** en gruppe ansatte.

### Hva er en brukergruppe?
En brukergruppe er en **samling ansatte** med samme faglige rolle.
Eksempel: «A.Markussen Ansatte», «A.Markussen Ledelse», «Byggherre».
Brukergrupper knyttes til roller i dokumentflyten.
En enkeltperson uten gruppe kan også knyttes direkte til en rolle.

### Hva er en dokumentflyt?
Definerer hvem som sender hva til hvem, i hvilken rekkefølge.
Roller: Registrator → [Bestiller] → [Utfører] → Godkjenner.
**Firma-uavhengig** — tilgang styres av gruppe-tilknytning.

### Dokumentstatus
Status settes av brukerhandlinger («Send», «Besvar», «Godkjenn», «Avvis»).
Server validerer at overgangen er gyldig.
Overgangsrekkefølge: draft → sent → received → in_progress →
responded → approved | rejected → closed | cancelled.
Ingen tidsbasert automatikk. Ingen automatisk eskalering.

### Maltyper
To kategorier: **sjekkliste** og **oppgave**.
HMS-avvik = oppgavemal med HMS-domene (ingen egen malbygger).
Godkjenning = egen dokumenttype, DB-klar, ingen malbygger ennå.
Domener: bygg | hms | kvalitet.

### Prosjekttype avgjør lokasjon-struktur
- **Byggeprosjekt:** Bygg (med etasjer) + Utomhus
- **Veiprosjekt:** Parseller eller strekninger
- Alle bygg har vanligvis en utomhusdel

---

## Rekkefølge for prosjektoppsett

### Steg 1 — Registrer prosjekt
- URL: `/dashbord/nytt-prosjekt`
- Felter: Navn, beskrivelse, adresse
- Prosjektnummer genereres automatisk (SD-YYYYMMDD-XXXX)

### Steg 2 — Sett opp dokumentflyt
- URL: Innstillinger → Produksjon → Dokumentflyt
  (`/dashbord/oppsett/produksjon/kontakter`)

**2a. Opprett faggrupper**
- Knapp: «+ Legg til faggruppe» nederst på siden
- Alternativt via `/dashbord/prosjekter/[id]/faggrupper` → «Ny faggruppe»
- ⚠️ `/dashbord/[prosjektId]/faggrupper` er read-only — bruk ikke denne
- Typisk: «A.Markussen AS» + «Byggherre [Prosjektnavn]»

**2b. Opprett dokumentflyter per faggruppe**
- Ekspander faggruppe → «+ Ny dokumentflyt» → gi navn
- Legg til roller: Registrator → [Bestiller] → [Utfører] → Godkjenner
- Roller er tomme nå — fylles i steg 4

### Steg 3 — Opprett brukergrupper
- URL: Innstillinger → Brukere (`/dashbord/oppsett/brukere`)
- Knapp: «+ Ny gruppe» øverst høyre
- Typisk: «A.Markussen Ansatte», «A.Markussen Ledelse», «Byggherre»

Legg deretter til brukere i gruppene:
- Eksisterende brukere: hover over gruppe → «+»-ikon → velg fra liste
- Nye brukere: «Inviter ny bruker» (sender e-post-invitasjon)

### Steg 4 — Gå tilbake til dokumentflyt og sett inn brukergrupper
- URL: Innstillinger → Produksjon → Dokumentflyt
- Ekspander faggruppe → ekspander dokumentflyt → klikk «+ Legg til» på rolle
- Dropdown: GRUPPER (brukergrupper) + PERSONER + «Inviter ny person»
- Eksempel:
  - Registrator → «A.Markussen Ansatte»
  - Godkjenner → «A.Markussen Ledelse»

### Steg 5 — Tilordne maler til dokumentflyt
Under dokumentflyten → «+ Legg til mal».

**Hvis malene mangler — bygg dem først:**

**5a. Sjekkliste-malbygger**
- URL: Innstillinger → Produksjon → Sjekklisemaler
  (`/dashbord/oppsett/produksjon/sjekklistemaler`)
- «Legg til» → pil ned → alternativer:
  - «Hent fra bibliotek» — NS 3420-K:2024 (KA/KB/KC/KD)
  - «Opprett ny» — bygg fra scratch
  - «Importer fra annet prosjekt» / «Importer fra firma»
  - «Opprett fra PDF»

**5b. Oppgave-malbygger** (inkluderer HMS-avvik)
- URL: Innstillinger → Produksjon → Oppgavemaler
  (`/dashbord/oppsett/produksjon/oppgavemaler`)
- HMS-avvik = oppgavemal med domain="hms" — ingen egen HMS-malbygger
- Godkjenning som dokumenttype er DB-klar men har ikke malbygger ennå

**5c. Koble maler til flyten**
- Tilbake til Dokumentflyt → «+ Legg til mal» under dokumentflyten
- Velg fra SJEKKLISTER / OPPGAVER

### Steg 6 — Legg inn byggeplass under lokasjon
- URL: Innstillinger → Lokasjoner (`/dashbord/oppsett/lokasjoner`)
- «+ Legg til» → gi navn (f.eks. «Bygg B12», «Utomhus»)

### Steg 7 — Last opp tegning og georeferér
- Klikk lokasjon → «Last opp» → velg fil (IFC, DWG, PDF, bilde)
- Fyll inn: Tegningsnummer, Fagdisiplin, Tegningstype, Etasje, Revisjon
- Klikk «Georeferanse» → sett 2 referansepunkter mot kartlag
  (koordinatsystem: ETRS89 UTM-33)
- «Lagre kalibrering» → tegning vises merket «Georeferert»

---

**Prosjektet er nå klart til bruk.**

---

## Kjente UX-problemer (observert 2026-05-02)

| Problem | Konsekvens | Status |
|---|---|---|
| `/dashbord/[prosjektId]/faggrupper` er read-only uten lenke | 404 ved intuitiv navigering | Åpen |
| Ingen veiledning på prosjekt-dashbord etter opprettelse | Ny bruker vet ikke neste steg | Åpen |
| Redigeringsmodus trigger ved klikk på navn (ikke synlig) | Ikke oppdagbar for ny bruker | Åpen |
| Esc lukket ikke redigeringsmodus | — | Fikset (0c6f7091) |

---

## Ønsket in-app veileder (planlagt)

```
● Dokumentflyt + faggrupper    ○ Brukergrupper
○ Maler                        ○ Lokasjoner + tegninger
```

Hvert steg lenker til riktig side. Markeres fullført basert på DB-tilstand.

---

## A.Markussen-referanseoppsett (observert på prod)

**Faggrupper og flyter:**
- «A.Markussen AS» → «A.Markussen Ansatte»
  (Reg: A.Markussen Ledelse → Godk: Byggherre)
- «A.Markussen AS» → «Endringmelding»
  (Reg: A.Markussen Ledelse → Best: Byggherre → Utf: A.Markussen Ledelse
   → Godk: Byggherre)
- «Byggeledelse» → «BL til BH» (Best: Byggherre → Utf: Byggherre)

**Maler koblet:**
- A.Markussen Ansatte: Befaringsrapport (BEF), HMS-avvik (HMS)
- Byggeledelse: Byggelederens dagbok/kontroll

**Brukergrupper:** BYGGHERRE, A.MARKUSSEN ANSATTE, A.MARKUSSEN LEDELSE

---

## Referanser
- Dokumentflyt-arkitektur: `docs/claude/dokumentflyt.md`
- NS 3420-bibliotek: `docs/claude/kontrollplan.md`
- UX-observasjoner: `docs/claude/STATUS-AKTUELT.md`
- Fase 0-beslutninger: `docs/claude/fase-0-beslutninger.md`
