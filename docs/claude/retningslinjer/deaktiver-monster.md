---
status: styrende
sist_verifisert_mot_kode: 2026-08-12
sist_endret: 2026-08-12
gjelder_versjon: web
---

# Deaktiver-mønster (STYRENDE, 2026-08-12)

Felles mønster for å deaktivere/aktivere rader i katalog-flater (lønnsart, aktivitet,
tillegg, utleggskategori — og andre som følger etter). Bakgrunn: Kenneths feltfunn på
timer-flatene (deaktiver skjult/uforklart, `title=`-forsinkelse, filter uten knapp).

**Delte komponenter** i `apps/web/src/components/deaktiver/` — bruk disse, ikke bygg nytt:

| Komponent | Regel |
|---|---|
| `DeaktiverKnapp` | **`Power` (lucide) er deaktiver-ikonet i hele SiteDoc** (Kenneth-godkjent). Aldri `Trash2` — sletting ≠ deaktivering. Tooltip via `@sitedoc/ui` `Tooltip`, **aldri `title=`** (~1 s browserforsinkelse). |
| `InaktivBadge` | Minimal «Inaktiv»-badge. `opacity-50` alene leses som «laster» — badge sier at raden er bevisst deaktivert. **Ikke** `StatusBadge` (den bærer dokumentstatus-semantikk — annen akse). |
| `VisInaktiveToggle` | «Vis inaktive (N)», ikke naken checkbox. N=0 → kontrollen deaktiveres. Krever at flaten henter ALLE rader (`inkluderInaktiv: true`) og teller inaktive klient-side. |

## 🔴 Tooltip sier KONSEKVENSEN, ikke handlingen

Per [tooltip-hjelpetekst-veileder.md § 3](tooltip-hjelpetekst-veileder.md) — svar på «hva mister jeg»:

> **«Deaktiver — skjules for nye registreringer. Eksisterende dagsedler beholder den.»**

Det siste leddet er det viktigste: uten «eksisterende beholder den» tør ingen trykke.
i18n: `deaktiver.tooltip.deaktiver` / `.aktiver`.

## Sjekkliste per flate

- [ ] `DeaktiverKnapp` (Power + konsekvens-tooltip), ikke `title=` + rå Power.
- [ ] `InaktivBadge` på inaktive rader (eller egen status-pille) + `opacity` som støtte.
- [ ] `VisInaktiveToggle` med antall (hent alle rader, filtrer klient-side).
- [ ] Hjelpetekst (`HjelpKnapp`/`HjelpFane`): `deaktiver.hjelp.*`.
- [ ] API: `deaktiver`/`aktiver`-mutasjon som flipper `aktiv` (firma-admin-gated). Deaktivering skjuler for nye registreringer; historikk (dagsedler/SheetUtlegg-stempel) er upåvirket.

**Referanse-implementasjon:** `dashbord/firma/timer/{lonnsarter,aktiviteter,tillegg,utleggskategorier}/page.tsx`.
Ikke utvid til hele systemet i én runde — flater følger etter mønsteret over tid.
