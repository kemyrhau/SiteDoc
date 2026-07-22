# P1 — Nivåsignal firma vs. prosjekt (Kenneth-vedtak 2026-07-21)

Kilde: prod-verifiseringsrunde 2026-07-21. Beslutningskart/mockup: `P1 Nivåsignal Beslutningskart.dc.html` (2a = vedtatt retning, interaktiv).

## Vedtatt
1. **Variant 1c**: chip i topplinja + svakt sonetonet sidehode + sonefarget h1-markør. Amber=FIRMA / blå=PROSJEKT (låst grammatikk, del 5).
2. **Chip er klikkbar** — bytter mellom firma- og prosjektvisning av samme flate.
3. **Topplinja viser kun eget nivå**: firmakontekst = kun firmanavn; prosjektkontekst = kun prosjekt + bygning (firmaprefiks ut).
4. **«— hele firmaet»-suffiks valgfri per firma** — innstilling i firmainnstillinger.
5. **Gjennomgående mønster** for alle firma-/prosjekt-par — egen plan lages ETTER at vedtatt delplan er ferdig.
6. **Sidebar-funksjon a)** (Kenneth 2026-07-21): chip = snarvei til motpart-flaten; sidebaren uendret strukturkilde (K5 bevares). **Presisert R2 (fabel 2026-07-21):** KontekstChip er eneste firma-/prosjektvelger i ny nav (ledd 1-funn) — velger-popoveren BEHOLDES (paritet = akseptkriterium); ⇄ legges til som eget bytte-affordance på chippen. Chip-klikk = velger, ⇄ = flatebytte. Admin-konsekvens bevisst akseptert: firmanavn borte fra topplinja i prosjektkontekst — vilkår: popover-headeren viser prosjektets firma; pilot-friksjon → egen sak.
7. **C er flagg-nøytral — bevisst valgt (fabel 2026-07-21, alternativ a):** tonet sidehode (SonetonetSidehode) vises for ALLE brukere på begge HMS-sider, ikke bare bak `nyNavigasjon`. Følger flagg-prinsippet av 2026-07-12 (funksjon på felles sider = flagg-nøytral; kun nav-skall flagges). A+B ligger bak flagget kun fordi KontekstChip bor i nav-skallet. Gammel-nav-brukere mangler chippen og trenger sonesignalet mest.

## Åpent
- Nå-rapport før ordre: topplinje-komponenten (én delt kilde?), flater uten motpart, prosjektvalg ved firma→prosjekt-bytte (sist besøkte?).
- Chip-bytte og suffiks-innstilling er **foreslått** funksjonalitet — finnes ikke i koden.

## Status
Alle beslutninger tatt; nå-rapport bestilt før ordre (`delplaner/p1-nivasignal-ordre.md`). Statuskilde ved utførelse: egen verifiseringslogg.
