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

## Mobil: Søk (`apps/mobile/app/sok/index.tsx`)

Mobilappen har ingen `?`-komponent ennå (ingen `HjelpKnapp` i `apps/mobile`); teksten under er vedtatt
hjelpetekst for søkeskjermen og brukes når mobil får hjelpe-ikon.

- **Hva er dette?** Søk i hele prosjektet fra ett felt. Skriv minst to tegn og trykk Søk. Åpnes fra søke-ikonet på
  Hjem og i Mapper, eller fra raden «Søk … i hele prosjektet» under søkefeltet i oppgave-, sjekkliste- og HMS-lista
  (da er lista du kom fra valgt, og teksten er tatt med).
- **Alle · Mapper · Sjekklister · Oppgaver · HMS:** «Alle» viser treff fra alle fem, med de ti første i hver gruppe.
  Trykk på en gruppe for å se alle treffene der.
- **Mapper** søker i teksten inni dokumentene. Trykk et treff for å lese stedet i dokumentet; pilene går mellom
  treffene, og «Åpne dokumentet» viser hele fila. Krever nett.
- **Sjekklister og oppgaver** søker på nummer, tittel og mal — ikke på det som er fylt ut. Uten nett søkes den
  lagrede versjonen på telefonen (for eksempel finner Ola oppgave «OPP12» selv i kjelleren uten dekning).
- **HMS** søker i avvik, SJA og RUH samtidig; hvert treff viser hvilken type det er. Også uten nett.

## Mobil: Filter og sortering i sjekkliste-, oppgave-, innboks- og HMS-lista (`FilterOgSorteringSheet.tsx`)

Ingen `?`-komponent på mobil ennå; vedtatt tekst for trakt-arket, brukes når mobil får hjelpe-ikon.

- **Hva er dette?** Snevre inn og ordne lista. Bare valg som finnes i lista vises.
- Gjelder sjekklister, oppgaver og innboksen (innboksen har ikke prioritet).
- **Ballen hos meg:** viser bare dokumenter der du eller gruppa di har ballen nå. Krever nett og at lista er hentet
  fra serveren — uten dekning, eller mens lista viser den lagrede versjonen, er bryteren skjult.
- **Sortering:** opprettet, sist endret, frist, nummer, emne eller navn — frist, nummer og emne vises bare når lista
  har slike verdier. Trykk en brikke for å sortere på den; trykk igjen for å snu retningen, tredje trykk fjerner den.
  Velg opptil tre for å sortere videre innenfor like verdier («Frist ↑, deretter Nummer ↓»). Dokumenter uten verdi
  havner sist. Hjelpelinja i arket: «Trykk igjen for å snu · tredje trykk fjerner». Aktiv sortering vises som egen
  brikke over lista; trykk den for å gå tilbake til nyeste først. Under søk sorteres treffene etter relevans.
- **Hva:** emne (også «Uten emne»), mal og — for oppgaver — prioritet.
- **Når:** frist (har frist, ingen frist, forfalt — avsluttede og avbrutte regnes ikke som forfalt) og når dokumentet ble opprettet.
- **Hvem:** hvem som opprettet det, mottaker/ansvarlig, bestiller- og utførerfaggruppe.
- **Hvor:** tegning og dokumentflyt. Byggeplass velges med chipen over lista, ikke her.
- Aktive filtre vises som chips over lista; trykk × for å fjerne ett, eller «nullstill filter» for alle.

