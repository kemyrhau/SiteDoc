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
3. **Topplinja viser kun eget nivå**: firmakontekst = kun firmanavn; prosjektkontekst = kun prosjekt + bygning (firmaprefiks ut).
4. **«— hele firmaet»-suffiks valgfri per firma** — innstilling i firmainnstillinger.
5. **Gjennomgående mønster** for alle firma-/prosjekt-par — egen plan lages ETTER at vedtatt delplan er ferdig.
6. **Sidebar-funksjon a)** (Kenneth 2026-07-21): chip = **kun snarvei** til motpart-flaten; sidebaren forblir uendret strukturkilde (K5 bevares).

## Åpent

- Nå-rapport før ordre: topplinje-komponenten (én delt kilde?), flater uten motpart, prosjektvalg ved firma→prosjekt-bytte (sist besøkte?).
- **Chip-bytte og suffiks-innstilling er foreslått funksjonalitet — finnes ikke i koden.** Ikke anta at noe av det kan gjenbrukes.

## Status

Alle beslutninger tatt; nå-rapport bestilt før ordre ([p1-nivasignal-ordre.md](p1-nivasignal-ordre.md)). Statuskilde ved utførelse: `verifisering/p1-nivasignal-verifiseringslogg.md` (opprettes ved ledd 2).
