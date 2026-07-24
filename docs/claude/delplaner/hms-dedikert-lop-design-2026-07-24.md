---
name: hms-dedikert-lop-design
status: 🟡 FABEL-DESIGN 2026-07-24 — dedikert, adskilt HMS-løp (Kenneths modell). Erstatter H2-retningen i hms-flyt-design-2026-07-24.md med fullt design. Cowork gater mot kode og skriver kode-ordre.
eier: fabel (design) · cowork (gating + ordre) · Kenneth (vedtak D3)
TIL REPO: docs/claude/delplaner/hms-dedikert-lop-design-2026-07-24.md
---

# Dedikert HMS-løp — design

Ramme (Kenneth): HMS er et parallelt, selvstendig løp ved siden av dokumentflyten — aldri tredd inn i dokumentflyt/rolle-matrisen. Visuelt kart: designprosjektet, «Flyt-binding Beslutningskart.dc.html» (3a).

## D1 — Tilstandsmaskin (HMS-egen)

**Sendt → Besvart → Lukket (terminal).** Ingen kladd (opprett = send, ett steg, mobil-lav terskel). Ingen Mottatt/Under arbeid/Godkjent — aldri Godkjenn/Avvis/Videresend i HMS.

- **Sendt:** venter på HMS-svar. Oppretter kan tilføye informasjon; HMS-admin besvarer.
- **Besvart:** svar med begrunnelse gitt. Oppretters tilføyelse etter svar varsler HMS-admin (gjenåpner IKKE — dialog fortsetter i samme tilstand); HMS-admin kan svare igjen eller lukke.
- **Lukket:** terminal, kun lesing. «Gjenåpne» (HMS-admin) → Besvart. Ordbruk per flytspråket (terminologi 7a).

**Lagring (bekreftet avgrensning):** HMS forblir `checklists`-rader i samme liste/detalj/opprett-skall. Innstilling: gjenbruk eksisterende statusverdier som delmengde (`sent`/`responded`/`closed`) — ingen skjemaendring; det HMS-egne er overgangstabell + handlinger + etiketter i kode. **Cowork gater:** kolliderer delmengde-gjenbruk med rapporter/telling som antar generell maskin?

## D2 — Handlinger + autorisasjon

| Handling | Hvem | Når | Varsel til |
|---|---|---|---|
| Meld (opprett=send) | alle prosjektmedlemmer | — | HMS-gruppen |
| Tilføy informasjon | oppretter | Sendt · Besvart | HMS-admin |
| Besvar (begrunnelse **obligatorisk**) | HMS-admin | Sendt · Besvart | oppretter |
| Lukk | HMS-admin | Besvart | oppretter |
| Gjenåpne | HMS-admin | Lukket | oppretter |

- **HMS-admin** = HMS-gruppe-medlem ∪ firma-`hms_ansvarlig` ∪ prosjekt-admin — samme mengde som privat-lesefilteret i hms.ts. Én definisjon, delt kilde (ekstraher fra `byggHmsSynlighetsFilter`), aldri duplisert.
- **Egen server-guard `verifiserHmsHandling`** (tilstand × handling × hvem). HMS rører aldri `verifiserFlytRolle`/rolle-matrisen.
- **Følgegevinst:** `verifiserFlytRolle` kan gjøres **fail-closed** for ikke-HMS (`if (!dokumentflytId) throw`, tilgangskontroll.ts:639) — dagens fail-open-hull. Selve endringen hører til F1-sporet.
- «Tilføy informasjon» er alltid append (kommentar/vedlegg m/ tidsstempel) — det sendte redigeres aldri.
- **Varsling:** nå-tilstand ikke målt — cowork måler eksisterende mekanikk (e-post/in-app) før ordren lover kanal.

## D3 — Malbygger-tilhørighet (Kenneth vedtar etter kost-måling)

I dag: `domain="hms"` ligger på tvers av `category="oppgave"|"sjekkliste"` → HMS-maler dukker opp i begge opprett-modaler; tverr-kategorien er grunnen til at HMS halv-låner maskineriet.

**Fabel-anbefaling: HMS som egen topp-nivå-type** i malbyggeren (sidestilt med oppgave/sjekkliste), subdomain sja/ruh/avvik under. HMS-maler vises kun i HMS-inngangen («Meld HMS»), aldri i sjekkliste-/oppgave-modalen. Rotårsaksfiks mot dobbel-oppdukking; matcher «eget dyr»-rammen.

**Fallback ved tung migrering** (cowork måler kost): HMS føres kun på oppgave-siden og filtreres eksplisitt UT av sjekkliste-modalen. Aldri duplisert. Plaster — velges kun på kost-grunnlag.

## D4 — Avgrensning + rekkefølge

- `hmsSynlighet` (privat/åpen per mal) + `byggHmsSynlighetsFilter` beholdes uendret (H1).
- F1-sporet (generell flyt-binding) røres ikke; eneste koblingspunkt er fail-closed-endringen, som eies av F1-ordren.
- Rekkefølge: (1) cowork gater designet (statusverdi-delmengde, varslingsmekanikk, malbygger-kost) → (2) kode-ordre HMS-maskin + guard + handlinger → (3) malbygger-flytting per D3-vedtak → (4) klikktest RUH ende-til-ende (ikke-admin oppretter + HMS-admin, privat mal).

## Åpent

- Kenneth: vedtak D3 (topp-nivå vs oppgave-siden) etter coworks kost-måling.
- cowork: gate D1-delmengden, mål varslingsmekanikk, mål D3-migreringskost → kode-ordre.
