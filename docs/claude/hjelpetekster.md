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

Hvilke sider som har `?`-hjelp er utledbart fra koden — en håndført tabell råtner
(sto med 7 sider feilmerket ❌ mens de faktisk hadde `HjelpKnapp`). Kjør i stedet:

```bash
# Sider MED ?-hjelp:
grep -rl "HjelpKnapp" apps/web/src/app --include=page.tsx | sort

# Sider UTEN (kandidater for å legge til):
comm -23 \
  <(find apps/web/src/app -name page.tsx | sort) \
  <(grep -rl "HjelpKnapp" apps/web/src/app --include=page.tsx | sort)
```

`HjelpKnapp` (eksportert fra `apps/web/src/components/hjelp/HjelpModal.tsx`) er
kilden — er den importert og rendret på siden, har siden `?`-hjelp.
