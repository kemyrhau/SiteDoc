# P1-ordre — Nivåsignal firma/prosjekt (fabel → redesign-Opus, via Kenneth)

Vedtak: `delplaner/p1-nivasignal-vedtak.md`. Mockup (fasit for utseende/interaksjon): `P1 Nivåsignal Beslutningskart.dc.html` § 2a. Scope NÅ: HMS-paret (pilot for mønsteret). Gjennomgående plan for øvrige par = egen sak etterpå.

## Ledd 1 — kodeverifisert nå-rapport (FØR koding; fabel gater rapporten)
1. Topplinje-komponenten: er den ÉN delt kilde for firma- og prosjektflater? Fil/komponentnavn + alle bruksflater (kandidatmengde oppgis — hvilket søkerom).
2. HMS-parets ruter/komponenter: hva deles, hva er duplisert i dag?
3. Prosjektkontekst ved firma→prosjekt-bytte: finnes «sist besøkte prosjekt» i koden i dag? (Negative svar krever søkerom.)
4. Firmainnstillinger: hvor legges en ny valgfri innstilling (suffiks-flagget) — eksisterende innstillingsstruktur, ikke ny.
5. Flater uten motpart: hvilke firma-/prosjekt-flater mangler par (chip vises da UTEN bytte, kun signal — bekreft ingen teknisk hindring).

## Ledd 1 — LEVERT og fabel-gatet 2026-07-21
Funn som endret scope: forvekslingen finnes KUN bak `nyNavigasjon` (KontekstChip.tsx rendres uten kontekst-gren, Toppbar.tsx:127-158; gammel nav bruker FirmaKontekstVelger og har ikke problemet — cowork-verifisert). Øvrig: Toppbar én delt kilde (montert dashbord/layout.tsx:37) · HMS-presentasjonslag delt, kun side-skall duplisert · «sist besøkte prosjekt» finnes (prosjekt-kontekst.tsx:14, localStorage) · chip uten motpart OK.

## Ledd 2 — koding (fabel-gatet scope)
A. **KontekstChip.tsx KUN** (fabel-beslutning 2026-07-21: gammel-nav-stien røres ikke): firmakontekst viser kun firmanavn; prosjektkontekst kun prosjekt + bygning.
B. **Chip** FIRMA (amber #fef3e2/#92400e/kant #f5c97b) / PROSJEKT (blå #e8effc/#1e40af/kant #a9c4f5), klikkbar ⇄ → navigerer til motpart-flaten (vanlig navigasjon, ingen ny mekanisme; sidebar uendret — K5). Firma→prosjekt: sist besøkte prosjekt (eller det rapporten viser er etablert mønster). Uten motpart: chip uten klikk.
C. **Tonet sidehode**: svak sonetone (gradient mot hvit à la mockup) + 4px sonefarget h1-markør. Tonen skal ikke konkurrere med status-farger i tabellen.
D. **UT AV P1 (Kenneth-vedtak b, 2026-07-21):** suffiks-innstillingen (Prisma-migrering på OrganizationSetting, schema.prisma:224) er egen sak — `delplaner/p1d-suffiks-innstilling-sak.md`. P1 leverer A–C uten suffiks.
E. Flagg-nøytralt (funksjon på felles sider); kun hvis signalet bor i nav-skallet vurderes `nyNavigasjon` eksplisitt.

## Krav (kvalitet > tempo)
- Rotårsak, delte kilder, ingen duplisert topplinje-logikk.
- Premisser i denne ordren er fabel-målte, IKKE fasit — utfører måler selv. **Enkeltmålt premiss:** «topplinja er identisk på begge flater» (fabels lesning av prod-skjermbilder).
- DoD: build grønn → skjermbilder begge nivåer + bytte begge veier → fabel-designgate → dok-sync → cowork-merge.
- Statuskilde: `verifisering/p1-nivasignal-verifiseringslogg.md` (opprettes ved ledd 2).

## Sekvensering (cowork eier)
P2-valideringsordren (`delplaner/p2-inndata-validering-vedtak.md`) og P1 kan røre delte flater; cowork avgjør rekkefølge, også mot sak 2 / A-3b Fase B-køen.
