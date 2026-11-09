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
- **Sortering:** opprettet, sist endret, sendt, frist, nummer, emne eller navn — sendt, frist, nummer og emne vises
  bare når lista har slike verdier. Trykk en brikke for å sortere på den; trykk igjen for å snu retningen, tredje trykk fjerner den.
  Velg opptil tre for å sortere videre innenfor like verdier («Frist ↑, deretter Nummer ↓»). Dokumenter uten verdi
  havner sist. Hjelpelinja i arket: «Trykk igjen for å snu · tredje trykk fjerner». Aktiv sortering vises som egen
  brikke over lista; trykk den for å gå tilbake til nyeste først. Under søk sorteres treffene etter relevans.
- **Hva:** emne (også «Uten emne»), mal og — for oppgaver — prioritet.
- **Når:** frist (har frist, ingen frist, forfalt — avsluttede og avbrutte regnes ikke som forfalt) og periode. Velg
  først hvilken dato perioden gjelder — opprettet, sendt, godkjent eller lukket (bare datoene lista har) — så tidsrom.
  Chipen over lista sier hvilken, f.eks. «Sendt: Siste uke». (M-pakke 2026-11-04)
- **Hvem:** hvem som opprettet det, mottaker/ansvarlig, bestiller- og utførerfaggruppe, og hvem som sendte, godkjente,
  lukket eller fylte ut. «Utfylt av» treffer alle som har fylt ut noe i dokumentet, ikke bare den siste.
- **Hvor:** område, tegning og dokumentflyt. Byggeplass velges med chipen over lista, ikke her.
- Aktive filtre vises som chips over lista; trykk × for å fjerne ett, eller «nullstill filter» for alle.

## Mobil: Prosjektkortet (`app/timer/[id]/kort/[projectId].tsx`, 36c-kort)

Ingen `?`-komponent på mobil ennå; vedtatt tekst for kortskjermen, brukes når mobil får hjelpe-ikon.

- **Hva er dette?** Ett kort = arbeid, maskiner og varer på ett prosjekt, én byggeplass og ett underprosjekt den dagen.
- **Endre kort:** flytter hele kortet til et annet prosjekt, en annen byggeplass eller et annet underprosjekt. Finnes
  kortet du velger fra før, slås de sammen. Reise, tillegg og utlegg blir liggende på dagen.
- **Slett kort:** sletter arbeid, maskiner og varer på kortet. Er det dagens siste kort, blir dagsseddelen stående som tomt utkast.
- Begge knappene finnes bare mens dagsseddelen er utkast eller returnert. Varer som alt er sendt, må endres på serveren —
  uten dekning er knappene sperret.

## Web: HMS-flytkortet på Dokumentflyt-siden (`HmsFlytKort.tsx`, ordre 2026-11-05 (9))

Siden `oppsett/produksjon/dokumentflyt/page.tsx` har ingen `?`-komponent for kortet ennå; vedtatt tekst, brukes når
det får hjelpe-ikon.

- **Fra firma:** HMS-ansvarlige fra firmaet. Rollen hører til firmaet, ikke prosjektet. Er du firma-admin i firmaet
  som ga rollen, har raden en X: den fjerner rollen i hele firmaet, i alle firmaets prosjekter. Bekreftelsen viser hvor
  mange åpne HMS-saker personen har ballen i. Sakene blir liggende hos HMS-behandlerne i prosjektet, og historikken
  viser hvorfor. Er personen også prosjekt-admin eller i prosjektets HMS-gruppe, beholder personen ballen der. Ellers står det hvor rollen settes («Settes av firma-admin i Firma →
  Ansatte») når du holder musa over merket. En deaktivert ansatt vises ikke.
- **Lagt til i prosjektet:** behandlere som bare gjelder dette prosjektet. X-en står alltid synlig, også på nettbrett,
  og fjerner personen bare fra prosjektets HMS-gruppe.

## Web: Deaktiver ansatt (`firma/ansatte/_components/DeaktiverModal.tsx`, ordre 2026-11-05 (11), (12))

Modalen har ingen `?`-komponent; vedtatt tekst, brukes når den får hjelpe-ikon.

- **Deaktiver:** personen mister tilgangen til firmaets prosjekter. Oppsummeringen viser hvilke prosjekter og
  flytledd som berøres, og hvor mange dokumenter som går tilbake til innsenderen. Har personen ballen i åpne
  HMS-saker, blir sakene liggende hos HMS-behandlerne i prosjektet, og historikken viser hvorfor. Aktiveres
  personen igjen, får personen ikke sakene tilbake.
- **Feil:** kan ikke oppsummeringen hentes, står det, og du kan lukke og prøve igjen. «Deaktiver» er sperret så
  lenge du ikke ser hva deaktiveringen avslutter.

## Web: Periode og område i sjekkliste- og oppgavelista, metadata i tegningslista (metadata S-pakke 2026-11-04)

Sidene `sjekklister/page.tsx`, `oppgaver/page.tsx` og `TegningerPanel` har ingen `?`-komponent ennå; vedtatt tekst,
brukes når de får hjelpe-ikon.

- **Periode:** velg om du vil se på når dokumentet ble *opprettet* eller sist *endret*, og velg tidsrom. Knappen viser
  valget, f.eks. «Endret: Siste uke».
- **Område:** kolonnen viser området dokumentet er plassert i på tegningen. Filtrer i kolonnehodet; filteret vises bare
  når lista har områder.
- **Kolonner** (2026-11-04): dra i håndtaket ⋮⋮ til venstre i en kolonneoverskrift for å flytte kolonnen, eller dra
  i lista øverst i «Velg parameter». Rekkefølgen huskes for deg. En kolonne du slår på, havner sist. «Nullstill» gir
  standardkolonnene i standardrekkefølge. Avkrysningsruta står alltid først.
- **Hvem og når** (M-pakke 2026-11-04, slås på i kolonnevelgeren): «Sendt av/Sendt», «Godkjent av/Godkjent»,
  «Lukket av/Lukket», «Sist utfylt av/Sist utfylt» og «Signatur». Gjenåpnes et dokument, vises godkjent og lukket bare
  så lenge dokumentet faktisk står som godkjent eller lukket. Periode-knappen kan også se på sendt-, godkjent- og
  lukket-dato.
- **Sist utfylt av:** viser «—» når endringsloggen er slått av i malen (holde musa over forklarer hvorfor). Filteret
  «Utfylt av» treffer alle som har fylt ut noe, ikke bare den siste.
- **Signatur:** for signaturfelt i malen: «✓» når alle er signert, «2/3» når noen mangler. For SJA vises bare hvor
  mange som har signert, for eksempel «3 signert» — en SJA sier ikke på forhånd hvem som skal signere. Har dokumentet
  begge, står det «2/3 · 3 signert». «—» når ingen har signert eller dokumentet ikke har signaturfelt. Filtrer på
  Signert, Mangler signatur eller Uten signaturfelt (en SJA regnes som signert når minst én har signert); sortering
  gir komplette først.
- **Tegningslista:** hver tegning viser revisjon, status, opprinnelig filformat (DWG, PDF …) og utgivelsesdato når de
  finnes. Under søket kan du snevre inn på status, filformat og georeferanse — bare valg som finnes i lista vises.
  Byggeplasser uten treff skjules mens et filter er satt.
