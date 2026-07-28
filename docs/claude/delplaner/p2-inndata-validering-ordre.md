# P2-ordre — Inndata-validering på status-handlinger (fabel → Opus, via Kenneth)

> Fabel-ordre 2026-07-28. Vedtak: `delplaner/p2-inndata-validering-vedtak.md` (Kenneth 2026-07-21). Sekvensering: cowork eier — P2 rører handlingsmeny + status-mutasjoner (overlapper A-3b Fase B-flatene); cowork gir tre/branch/tavle-rad og avgjør vindu. Forslag branch: `feat/p2-inndata-validering`.

## 1. Nå-bilde (fabel-målt 2026-07-28 — mål selv før koding)
- Delt valideringskilde FINNES: `statusKreverBegrunnelse(nyStatus)` i `packages/shared/src/utils/index.ts:139`, håndhevet server-side i `apps/api/src/routes/sjekkliste.ts:1081` og tilsvarende i `oppgave.ts` — men returnerer true KUN for `dismissed`.
- HMS-stiene (`hmsBesvar`/`hmsLukk` i sjekkliste.ts/oppgave.ts, tilgangsregler i `trpc/tilgangskontroll.ts`) har allerede obligatorisk begrunnelse — rør ikke, men gjenbruk mønsteret.
- Test finnes: `packages/shared/src/utils/statusHandlinger.test.ts:234` låser dagens «kun dismissed» — den skal ENDRES bevisst, ikke omgås.
- NB: F3-migreringen (prod 27.07) flyttet `rejected`→`in_progress` som data. Mål hvilke statusverdier «Send tilbake» og «Besvar» faktisk produserer i dag FØR du utvider regelen — vedtakets intensjon gjelder handlingen, ikke et bestemt statusnavn.
- Enkeltmålt premiss (navngitt per vedtaket): coworks måling av `flytRolle.ts:191` («kun inndata-validering mangler, ikke tilgangskontroll») — mål selv.

## 2. Oppdraget
1. **Utvid den delte kilden** (shared/utils): Besvar-klassen og Send tilbake/Avvis-klassen krever kommentar; Videresend krever IKKE. Én funksjon/tabell — aldri per-flate `if`-er.
2. **Server-side håndheving alle dokumenttyper** (sjekkliste, oppgave, HMS der den ikke alt finnes; sjekk kontrollplan-stiene i `kontrollplan.ts` mot samme regel).
3. **Tom besvarelse:** utfylling/besvarelse kan aldri sendes tom — minst ett utfylt felt. Håndheves server-side i samme runde; finn dagens submit-sti og legg guarden i delt kilde.
4. **UI speiler:** prinsipp «UI viser aldri en handling serveren avviser» — handlingen deaktiveres med begrunnelse (mikrotekst/tooltip), ikke skjules, ikke lar brukeren feile mot serveren. Kommentarfeltet gjøres påkrevd i dialogen (markering + disabled send til utfylt), web + mobil.
5. **Test:** oppdater `statusHandlinger.test.ts` + ny testdekning for hver klasse (kommentar-krav, tom-besvarelse, videresend-unntak).

## 3. Ufravikelig
- Rotårsak i delt kilde; ingen duplisering server/UI — UI leser samme regel (eksportér fra shared).
- i18n på alle nye strenger (alle språk-nøkler, ikke bare nb).
- Rør ikke tilgangskontrollen (`flytRolle.ts`) — dette er inndata-validering, egen bug-klasse.
- Eget arbeidstre; ikke parallelt med økter i handlingsmeny/status-flatene (cowork sekvenserer).

## 4. Gate
Nå-sjekk → kode → build + tester grønne → skjermbilder (dialog med påkrevd kommentar, deaktivert handling m/begrunnelse, mobil + web) → fabel-designgate → dok-sync → cowork-merge. Statuskilde: `verifisering/p2-inndata-validering-verifiseringslogg.md` (opprettes ved oppstart).
