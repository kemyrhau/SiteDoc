---
name: p1-nivasignal-vedtak
status: 🟢 VEDTATT (Kenneth 2026-07-21) — alle beslutninger tatt. Nå-rapport bestilt før koding
eier: Kenneth (vedtak) · fabel (design + gate) · cowork (sekvensering) · redesign-Opus (utførelse)
sist_verifisert_mot_kode: 2026-07-21
---

# P1 — Nivåsignal firma vs. prosjekt (Kenneth-vedtak 2026-07-21)

Kilde: prod-verifiseringsrunde 2026-07-21 ([prod-funn-2026-07-21.md § P1](prod-funn-2026-07-21.md)). Beslutningskart/mockup: `P1 Nivåsignal Beslutningskart.dc.html` (2a = vedtatt retning, interaktiv).

> ⚠️ **Mockupen ligger utenfor repoet** (designprosjektet). Utførende Opus må ha den tilgjengelig før ledd 2 — den er fasit for utseende og interaksjon. Relayes av Kenneth.

## Problemet som vedtaket løser

Firma-HMS og prosjekt-HMS var i prod visuelt nesten identiske: samme topplinje (`A.Markussen AS / 998 Instinniforbotn · Narvik` — også i firmavisningen), samme fire faner, nesten samme tabell. Eneste skille var h1-tekst, to ekstra kolonner, og hvilken menyseksjon som var uthevet. Firmavisningen har «Behandle»-knapp per rad → feilhandling ett klikk unna.

## Vedtatt

1. **Variant 1c**: chip i topplinja + svakt sonetonet sidehode + sonefarget h1-markør. **Amber = FIRMA / blå = PROSJEKT** (låst grammatikk, del 5).
2. **Chip er klikkbar** — bytter mellom firma- og prosjektvisning av samme flate.
3. ~~**Topplinja viser kun eget nivå**: firmakontekst = kun firmanavn; prosjektkontekst = kun prosjekt + bygning (firmaprefiks ut).~~ **🔄 REVERSERT av K3 kloss 2c (Kenneth-forslag + fabel-gate 2026-07-22).** Ny regel: **prosjektkontekst** viser to linjer — linje 1 = Firma (dempet grå brødtekst, informasjon), linje 2 = Prosjekt · Byggeplass (blå chip + sonetone, aktiv kontekst). **Firmakontekst** viser fortsatt kun firma. Begrunnelse: kundetelefon-prøvesteinen er ny fakta — hierarkiet må kunne leses i topplinja uten å åpne trakten. Sonetonen følger **aktiv** kontekst, aldri alle synlige nivåer (to soneToner samtidig = intet signal). Full grammatikk: [k3-ordre § Kloss 2c](k3-ordre.md).
4. **«— hele firmaet»-suffiks valgfri per firma** — innstilling i firmainnstillinger.
5. **Gjennomgående mønster** for alle firma-/prosjekt-par — egen plan lages ETTER at vedtatt delplan er ferdig.
6. **Sidebar-funksjon a)** (Kenneth 2026-07-21): chip = **kun snarvei** til motpart-flaten; sidebaren forblir uendret strukturkilde (K5 bevares).

   **Presisert R2 (fabel 2026-07-21):** `KontekstChip` er **eneste** firma-/prosjektvelger i ny nav (ledd 1-funn) — **velger-popoveren BEHOLDES** (paritet = akseptkriterium); **⇄ legges til som eget bytte-affordance** på chippen. Chip-klikk = velger, ⇄ = flatebytte.

   **Admin-konsekvens bevisst akseptert:** firmanavnet er borte fra topplinja i prosjektkontekst. **Vilkår:** popover-headeren viser prosjektets firma. Pilot-friksjon → egen sak.

7. **Sidehodet (§ 2C) er flagg-nøytralt** — vises for **alle** brukere, ikke bare de med `nyNavigasjon`. *(Fabel 2026-07-21, som bekreftelse av eksisterende prinsipp — ikke et nytt valg.)*

   **Følger av flagg-prinsippet (Kenneth 2026-07-12):** funksjonalitet på felles sider bygges flagg-nøytralt; **kun nav-skallet** ligger bak `nyNavigasjon`. Sidehodet bor på siden, ikke i skallet. At chip og topplinje (§ 2A/2B) *er* bak flagget skyldes utelukkende at `KontekstChip` tilfeldigvis bor i skallet.

   **Og det er ønsket virkning:** gammel-nav-brukere mangler chippen og trenger sonesignalet mest. Gates sidehodet bak flagget, får de som allerede har nivåsignal enda ett, mens de som mangler det får ingenting.

   > Cowork løftet dette som et åpent valg 2026-07-21. Det var det ikke — svaret sto allerede i [p1-nivasignal-ordre.md § 2E](p1-nivasignal-ordre.md). Ført her så neste økt ikke stiller spørsmålet på nytt.

## Åpent

- Nå-rapport før ordre: topplinje-komponenten (én delt kilde?), flater uten motpart, prosjektvalg ved firma→prosjekt-bytte (sist besøkte?).
- **Chip-bytte og suffiks-innstilling er foreslått funksjonalitet — finnes ikke i koden.** Ikke anta at noe av det kan gjenbrukes.

## Status

Alle beslutninger tatt; nå-rapport bestilt før ordre ([p1-nivasignal-ordre.md](p1-nivasignal-ordre.md)). Statuskilde ved utførelse: `verifisering/p1-nivasignal-verifiseringslogg.md` (opprettes ved ledd 2).
