# Prosjektoppsett-veileder

**Status:** Plan (ikke implementert) — 2026-05-02
**Bakgrunn:** Observert under manuell test at ny bruker ikke finner frem til
faggrupper, dokumentflyt eller maler uten å kjenne URL-strukturen på forhånd.
Blokkerer selvstendig A.Markussen-onboarding.

---

## Hva en ny bruker må gjøre for å sette opp et prosjekt

Rekkefølgen er låst — hvert steg er avhengig av forrige:

### Steg 1 — Opprett prosjekt
- URL: `/dashbord/nytt-prosjekt`
- Felter: Prosjektnavn, beskrivelse, adresse
- Resultat: Prosjekt med automatisk prosjektnummer (SD-YYYYMMDD-XXXX)

### Steg 2 — Sett opp dokumentflyt (faggrupper + roller)
- URL: `/dashbord/oppsett/produksjon/kontakter` (Innstillinger → Produksjon → Dokumentflyt)
- Handling: Legg til faggrupper (firma-parter i prosjektet), opprett dokumentflyter per faggruppe, tildel roller (Registrator, Bestiller, Utfører, Godkjenner)
- Eksempel A.Markussen:
  - Faggruppe «A.Markussen → BH»: Endringmelding (Registrator=A.Markussen Ledelse → Bestiller=Byggherre → Utfører=A.Markussen Ledelse → Godkjenner=Byggherre)
  - Faggruppe «A.Markussen intern»: A.Markussen Ansatte (Registrator=A.Markussen Ansatte → Godkjenner=A.Markussen Ledelse)
- Merk: Faggruppe = firma-part i prosjektet, ikke ansatt-gruppe

### Steg 3 — Legg til brukere og knytt til faggrupper
- URL: `/dashbord/oppsett/brukere` (Innstillinger → Brukere)
- Handling: Inviter brukere, klikk navn for å redigere, knytt til faggruppe via «Legg til gruppe»
- kanAttestere-toggle vises per bruker for Timer-modul

### Steg 4 — Opprett brukergrupper
- URL: `/dashbord/oppsett/brukere` → «+ Ny gruppe»
- Hensikt: Grupperer brukere etter faggruppe/rolle i prosjektet
- Eksempel: A.Markussen Ledelse, A.Markussen Ansatte, Byggherre
- Merk: Brukergrupper er IKKE det samme som faggrupper (dokumentflyt-parter).
  Faggrupper = firmaer i dokumentflyten. Brukergrupper = ansatte organisert per fag.
- Kobling: Brukere knyttes til faggrupper VIA brukergrupper

### Steg 5 — Opprett lokasjoner og last opp tegninger
- URL: `/dashbord/oppsett/lokasjoner` → «+ Legg til»
- Hensikt: Strukturerer prosjektet geografisk — tegninger knyttes til lokasjoner
- Typisk struktur for byggeprosjekt:
  - Bygg (hovedbygg med etasjer som underlokasjoner)
  - Utomhus (adkomst, grøntarealer, parkering)
- Typisk struktur for veiprosjekt: parseller/strekninger
- Merk: Lokasjon er forutsetning for å laste opp tegninger
- Tegningsformat: PDF eller bilde — lastes opp per lokasjon
- NS3420 KA/KB/KC/KD-maler (utomhus) kobles naturlig til Utomhus-lokasjon

### Steg 6 — Hent/opprett sjekkliste-maler
- URL: `/dashbord/oppsett/produksjon/sjekklistemaler`
- Handling: «Legg til» → «Hent fra bibliotek» for NS 3420-maler, eller «Opprett ny» for egne maler
- Bibliotek inneholder: NS 3420-K:2024 Anleggsgartnerarbeider (KA/KB/KC/KD)
- Allerede importert vises med grønt hake

### Steg 7 — Hent/opprett oppgave-maler
- URL: `/dashbord/oppsett/produksjon/oppgavemaler`
- Eksempel: HMS-avvik, Godkjenning

### Steg 8 — Koble maler til dokumentflyt
- URL: `/dashbord/oppsett/produksjon/kontakter`
- Handling: Under hver faggruppe/dokumentflyt → «+ Legg til mal» → velg fra dropdown
- Maler vises gruppert: SJEKKLISTER / OPPGAVER
- Allerede valgte maler vises som pills med «Fjern»-knapp

---

## Kjente UX-problemer (observert 2026-05-02)

| Problem | Konsekvens |
|---|---|
| `/dashbord/[prosjektId]/faggrupper` er read-only uten lenke til CRUD-siden | Bruker finner ikke «Ny faggruppe» |
| CRUD for faggrupper ligger på `/dashbord/prosjekter/[id]/faggrupper` — annen URL-struktur | 4 × 404 ved intuitiv navigering |
| Ingen tom-state veiledning på prosjekt-dashbord etter opprettelse | Bruker vet ikke hva neste steg er |
| Maler er firma-spesifikke men vises ikke på tvers av firma | Nytt firma starter uten maler |

---

## Ønsket veileder-implementasjon (planlagt)

Etter prosjektopprettelse skal en steg-for-steg veileder vises:

```
Steg 1 av 4: Sett opp dokumentflyt
→ Legg til faggrupper og definer hvem som sender til hvem

Steg 2 av 4: Legg til teammedlemmer
→ Inviter ansatte og knytt dem til faggrupper

Steg 3 av 4: Velg sjekkliste- og oppgavemaler
→ Hent fra NS 3420-biblioteket eller opprett egne

Steg 4 av 4: Knytt maler til dokumentflyt
→ Bestem hvilke maler som hører til hvilken faggruppe
```

Implementasjonsalternativer (ikke besluttet):
- Modal/wizard ved første besøk på nytt prosjekt
- Persistent progress-banner på prosjekt-dashbord til alle steg er fullført
- Tom-state med «Kom i gang»-knapp per seksjon

---

## Referanser
- UX-funn: `docs/claude/STATUS-AKTUELT.md` § Planlagte oppgaver
- Faggruppe-arkitektur: `docs/claude/dokumentflyt.md`
- NS 3420-bibliotek: `docs/claude/kontrollplan.md`
