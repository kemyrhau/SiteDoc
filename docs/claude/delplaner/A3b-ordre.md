---
name: A3b-ordre
status: 🟡 KLAR — venter Del E-lukking + tavle-rad (åpnes IKKE før A-3a er lukket)
eier: fabel (ordre) · cowork (gate + pkt 7-flagg bekreftet)
sist_verifisert_mot_kode: 2026-07-18
---

# Ordre — A-3b: perspektiv-prinsippet i dokumentflyt (omrammet)

> **Fabel-ordre 2026-07-18.** Relayes av Kenneth; cowork gir tre + branch + tavle-rad. **Kan ikke kjøre parallelt med B-2 eller CLAUDE.md-runden (generate.ts).** Grunnlag: [funn-fra-a3a-verifisering-2026-07-18.md](funn-fra-a3a-verifisering-2026-07-18.md) (N1-vedtaket + Kenneths syv beslutninger) + testrapportene 2026-07-18.
>
> **Forutsetning: Del E (rollefiltrering, ikke-admin) er kjørt og A-3a lukket FØR denne åpnes** — begge rører samme meny/badge-flater.

## 1. Fundamentet (Kenneth-vedtatt N1 — rammen, ikke en fiks)

**Status er perspektiv-avhengig, ikke global.** «Sendt» gjelder kun avsender, som momentan kvittering; mottaker ser «Til behandling»; avsender ser SENERE dokumentets sanne tilstand (ikke sin gamle handling). Gjelder alle steg — etiketten tilpasses dokumentets mening, ikke en fast tabell.

**Halve modellen er bygget (cowork-målt):** lagret tilstand ER mottaker-perspektiv (`sent→received` ubetinget, `sjekkliste.ts:923` — **RØRES IKKE, det er fundamentet, ikke en bug**), `harBallen`-data finnes, `status-badge.tsx:43` har kontekst-frø (`sent+lest→«Lest»`). Det som bygges er **visningslaget**.

## 2. Oppdraget

### Del 1 — perspektiv-visning (kjernen)

a. **Seer-avhengig badge:** status-badge får seer-kontekst (`harBallen`/rolle/avsenderskap). Etikett-logikk som **delt kilde i `@sitedoc/shared`** (én funksjon: `(lagretStatus, seerKontekst) → etikett+farge`) — web + mobil + lister konsulterer den; ALDRI per-flate if-er. **Etikettene per status × perspektiv legges frem for fabel som tabell FØR implementering** (kort designgate — Kenneth-vedtaket sier «tilpasses meningen», tabellen er konkretiseringen).

b. **Kvitterings-øyeblikket:** rett etter egen handling vises handlings-kvittering («Sendt») momentant; ved neste visning dokumentets sanne tilstand. (Toast/optimistisk badge — **ikke lagret tilstand**.)

c. **«Hvem har ballen» synlig:** dokumentkort + detaljside viser ball-holder (faggruppe/person). N2-lærdommen: «Venter på»-treghet **ikke reprodusert, ikke løst** — dette er synlighetsfiksen, ikke tekstfiks.

d. **«Mine oppgaver»:** liste-/søkefilter på `harBallen` (mottaker finner dokumentet i sin liste når ballen er hans).

### Del 2 — Kenneths syv beslutninger (fra funn-dokumentet)

1. **Badge-feedback ved videresend** (dekkes av 1c — verifiser at videresend oppdaterer synlig).
2. **«Til revisjon»-badge** for `rejected` sett fra den som sendte tilbake; **«Under arbeid/Pågående»** for utfører (perspektiv-tabellen, del av 1a).
3. **Tydeligere Send-skille:** «Send videre til:»-overskrift over faggruppene, ADMIN-seksjonen separat for overstyring.
4. **Person-videresending:** faggruppe vist kollapset → åpner viser medlemmer (Kenneth bekreftet; datamodellen bærer det, ingen schema-endring).
5. **Kommentar-nudge KUN ved «Send tilbake»/«Avvis»** — ikke universelt.
6. **Tooltip på felttyper i MalBygger → RUTES SPOR C** (ikke denne ordren; føres dit).
7. **«Trekk tilbake»:** med N1-fundamentet flyttes den til avsenders handlingsrom mens ballen er hos mottaker og dokumentet er ubehandlet.

> ⚠️ **Pkt 7 KREVER statusmaskin-/rollematrise-endring (cowork-målt 2026-07-18):** `ROLLE_HANDLINGER.bestiller` har ingen `received:`-oppføring — avsender har i dag INGEN handling på `received`. Å gi avsender «Trekk tilbake» der er en rollematrise-utvidelse. **Egen beslutning FØR bygging** (fabels flagg-krav). Ikke bygg pkt 7 i samme sveip som resten — flagg og vent.

## 3. Ufravikelig

- `sjekkliste.ts:923` (auto-mottak) **RØRES IKKE.** Statusmaskinen røres ikke uten flagg (pkt 7-unntaket). **Lagret tilstand endres ALDRI** — alt er visningslag + filter.
- **Perspektiv-tabellen (1a) fabel-gates FØR bygging.** Delt kilde-endringer (badge-funksjonen, `ROLLE_HANDLINGER`) → mobil re-verifiseres i samme gate.
- Alle fire dokumenttyper. i18n `t()` + `generate.ts` (ditt vindu). §11c/§11d/§11e. **Mål selv; rapportene er input.**

## 4. DoD

Kode → `next build` grønn → bevis til fabel: samme dokument sett som avsender OG mottaker (ulike etiketter), kvittering-øyeblikket, ball-holder synlig på kort+detalj, «mine oppgaver»-filteret, Send-skillet, person-videresending kollapset, nudge kun ved tilbakesending → fabel-gate → **Kenneths egen klikktest** (funnene kom derfra — gaten skal samme vei) → dok-sync (`dokumentflyt.md` § 2/§ 6 med perspektiv-prinsippet) → «klar for commit».

## 5. Opprydding

Cowork eier merge + fase 4.
