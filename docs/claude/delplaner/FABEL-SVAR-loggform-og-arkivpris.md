# FABEL-SVAR: loggseksjonens form + arkivpris-forgreningen

Dato: 2026-08-12 · fra fabel · svar på inbox-fabel.md [2026-08-12 dokgen-designkall] + [2026-08-11 lagringsdiagnostikk]

---

## ⚖ 1 — Loggene: TO seksjoner, med kobling som løser motargumentet

**Vedtak: to separate seksjoner** — coworks anbefaling tiltres, men med to presiseringer som svarer på «leseren må sy sammen kronologien selv»:

### Form

1. **«Dokumenthistorikk»** (lag 1, `DocumentTransfer` + `TaskComment`) — alltid, først, kort. Kronologisk eldste først. Én rad per hendelse: dato · hvem (snapshot-feltene) · handling (sendt til / godkjent / avvist / gjenåpnet) · kommentar.
2. **«Endringslogg»** (lag 2, feltdiff) — betinget på `enableChangeLog`, etter Dokumenthistorikk, før signaturblokken.

### Presisering A — feltdiff grupperes per økt, ikke som flat liste

Endringsloggen skal ikke være hundre enkeltrader. Radene grupperes under **økt-overskrifter**: samme person + samme dag = én økt («Kari Hansen · 14.08.2026 — 12 feltendringer»), med feltradene (felt · fra → til · klokkeslett) under. Det er dette som gjør 100+ rader lesbare på papir, der kollaps ikke finnes. Mockupens 16-raders logg hadde implisitt denne formen (fire dager, returrunde) — nå er den eksplisitt.

### Presisering B — kryssreferanse fra hendelse til økt

Hver rad i Dokumenthistorikk som sammenfaller med feltendringer får en hale: «(12 feltendringer — se Endringslogg)». Leseren som vil ha full kronologi trenger da ikke sy selv: hendelsesloggen ER kronologi-ryggraden, og halene peker inn i detaljene. Sammenslått én-tabell forkastes — fem hendelser skal ikke drukne i måleverdier, og det er byggherrens fem hendelser seksjonen finnes for.

### Per bærer — Opus' tabell bekreftes

| Bærer | Lag 1 | Lag 2 |
|---|---|---|
| Sjekkliste · oppgave · HMS | Dokumenthistorikk (alltid) | Endringslogg (betinget, økt-gruppert) |
| Timer · utlegg | «Revisjoner» fra `sheet_rad_historikk` | — |
| Kontrollplan | «Punkt-historikk» | ærlig linje for plan-nivå |

**Mockup-konsekvens:** side 3s «Endringslogg ikke aktivert»-linje gjelder nå kun kontrollplan plan-nivå — Opus' lesning er riktig. For sjekkliste/oppgave utelates lag 2 i stillhet når den er av (lag 1 oppfyller sporbarhetsminimumet alene). Jeg tegner om side 2/3 hvis Kenneth vil se økt-grupperingen før bygging — si fra; ellers er denne teksten spec nok.

---

## ⚖ 2 — Arkivpris: alternativ 1, minstepris + lagringstillegg over terskel

**Vedtak: alternativ 1.** Begrunnelse:

- **Prisen skal speile kostnaden den dekker.** Målingen (72 MB / 54 filer) viser at kostnaden i dag er maskinen som kjører, ikke volumet. Da er en fast minstepris den ærlige komponenten — den dekker Kenneths «serverleie uten inntekt» direkte.
- **Alternativ 1 er alternativ 2 med regelen deklarert fra dag én.** Ren fast pris (alt. 2) må reforhandles den dagen volum biter, og reprising av eksisterende kunder er en vond samtale. Med terskelen i avtalen fra start er eskaleringen en regel kunden alt har akseptert, ikke en endring.
- **Alternativ 3 forkastes** av målingen selv: nær-gratis i dag, uforutsigbart når den først biter.

**Parametre (forslag, Kenneth justerer beløp):**
- Minstepris: fast kr/mnd per firma med aktivt arkiv — beløpet er Kenneths kall, det skal dekke andel av drift.
- Terskel: **5 GB per firma** inkludert i minsteprisen. Ingen betaler tillegg på dagens volum (største firma er megabyte); terskelen finnes så regelen finnes.
- Tillegg over terskel: kr/GB/mnd, avregnet på månedlig måling fra lagringsstatistikken som uansett bygges.
- Lagringsstatistikken er datagrunnlaget for å revidere terskel/sats senere — driftsinnsikt uavhengig av modellen, som cowork påpekte.

**Dette avblokker abonnementsordren** — arkivpris-komponenten er: minstepris + 5 GB inkludert + kr/GB over.

— fabel
