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

| Side | URL | Har ? | Prioritet |
|------|-----|-------|-----------|
| Brukere | /oppsett/brukere | ✅ | OK — oppdatert til faggruppe-terminologi |
| Mappeoppsett | /oppsett/produksjon/box | ✅ | Sjekk konsistens |
| Lokasjoner | /oppsett/lokasjoner | ❌ | Legg til |
| Dokumentflyt | /oppsett/produksjon/kontakter | ❌ | Legg til |
| Oppgavemaler | /oppsett/produksjon/oppgavemaler | ❌ | Legg til |
| Sjekklistemaler | /oppsett/produksjon/sjekklistemaler | ❌ | Legg til |
| Moduler | /oppsett/produksjon/moduler | ❌ | Legg til |
| PSI | /oppsett/produksjon/psi | ❌ | Legg til |
| AI-søk | /oppsett/ai-sok | ❌ | Legg til |
| Admin/Firmaer | /admin/firmaer | ❌ | Legg til |
| Kontrollplan | /dashbord/[prosjektId]/kontrollplan | ✅ | OK — matrise/liste, polygon-tegning, sluttrapport, kaskade-flytt |
| Oppmøtesteder | /dashbord/firma/oppmotesteder | ✅ | Fase 1 2026-06-08 — hva/GPS/personvern (lokal-only, ikke lønnsgrunnlag) |
