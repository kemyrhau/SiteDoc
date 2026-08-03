# Ordre til redesign-Opus — del 6b FASE 2: Mobil-løft

> Fabel-ordre 2026-07-28. Relayes av Kenneth; cowork gir tre + branch + tavle-rad. Grunnlag: `delplaner/del6b-delplan.md` § Fase 2 + `verifisering/del6b-verifiseringslogg.md` (fase 1 lukket 2026-07-16 — FilterPanel + Table/filterAlternativer er nå delte kilder; bygg på dem, ikke ved siden av). Pilot-kontekst: ~50 ansatte, mobil viktigst.

## 1. Hva som er gjort (så du ikke gjentar noe)
- Fase 1 (web): FilterPanel bygget som delt filterkilde; døde elementer fjernet/koblet; print-grense løftet; mal-dualitet copy+kryss-lenker; i18n 35 nøkler × 13 språk; arbeidsforlop-rename i OppgaveModal. Commits 98162b07/dde5a729/8f2a0892.
- OppgaveModal-i18n ble RUTET HIT (fabel-vedtak 2026-07-16) — den er del av denne ordren.
- Fase M-3a del 1+2 lukket — MalBygger/renderer-filene er nylig rørt; les dem som de ER.

## 2. Oppdraget (prioritert rekkefølge)
1. **Filter på mobil-lister** (sjekkliste + oppgave): status/byggeplass minimum. NÅ-SJEKK FØRST: gjenbruk timer-mobilens filter/chip-mønstre der de finnes — mål med grep, ikke docs. Samme visuelle standard som fase 1-web (FilterPanel-paradigmet oversatt til mobil, ikke ny tredje variant).
2. **Opprett-vei fra oppgave-listen** på mobil (i dag kun fra tegning). Gjenbruk web-mønsteret (opprett fra mal).
3. **HMS-mobil bygges**: avvik/SJA/RUH-visning + opprett. Ryggraden er delt (ReportTemplate/Task/Checklist) — mobil-HMS er i hovedsak liste + eksisterende utfyllings-skjermer med domain-filter. Verifiser premisset før bygging.
4. **Kontrollplan-mobil: KUN lesevisning** (utførelse henger på fase 3-broen — ikke bygg noe som foregriper den).
5. **i18n på alle mobil-filer som røres** (index-skjermene har 0–2 t()) + OppgaveModal-i18n (rutet fra fase 1).

## 3. Ufravikelig
- Eget arbeidstre + egen branch fra develop (forslag: `feat/del6b-fase2-mobil` — bekreft ledig med cowork).
- Nå-rapporten/delplanen er input, ikke fasit — mål premissene selv (grep/git). Kjør negativ kontroll: tom output kan bety død sjekk.
- Rotårsak fremfor plaster; delte kilder fremfor duplisert logikk; eksplisitte guards/feilhåndtering.
- Rør IKKE: utfyllings-ryggraden (ambisjon b = etter pilot), MalBygger (fase M/gjennomgangsplanen eier den), sync-/append-only-bugklassen (develop/cowork eier — se `del6b-develop-bugordre.md`).
- Mobil hit-targets ≥ 44px.

## 4. Gate (per FABEL-RAMMEVERK)
Nå-sjekk i ordren → kode → build grønn → skjermbilder til fabel (alle nye/endrede skjermer, web-referanse ved siden av der relevant) → fabel-designgodkjenning → **Kenneths mobiltest (pilot-kritisk, ekstra gate for fase 2)** → dok-sync → cowork-merge. Status føres i `verifisering/del6b-verifiseringslogg.md` § Fase 2.
