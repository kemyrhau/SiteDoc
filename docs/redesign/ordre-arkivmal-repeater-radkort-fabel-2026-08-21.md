---
name: ordre-arkivmal-repeater-radkort-fabel-2026-08-21
description: Kenneth-vedtatt print-form for rike repeatere i arkiv-PDF — radkort (2a) med bildestørrelser fra godkjent mockup. Erstatter dagens tabellrendring for rike repeatere.
til: redesign-Opus / kontrollplan (via Kenneth)
mockup: mockup-2a-radkort-vedtatt.png / mockup-2b-skalar-tabell.png / mockup-2c-mange-bilder.png (samme leveranse)
bakgrunn: Kenneth underkjente dagens print 2026-08-21 (loddrette felter stokket vannrett); vedtak samme dag: radkort 2a med 3a-bildestørrelser
sist_endret: 2026-08-21
---

# Ordre: repeater i arkiv-PDF — radkort-form

## DESIGNLÅS (kvitteres i leveransen: «designavvik: ingen» eller forslag som VENTER på vedtak)

1. **Formvalg per repeater:** helskalar repeater (alle barn tekst/tall/dato/status) →
   tabellform som i dag (mockup 2b). Minst ett rikt barnefelt (bilder, tegningsposisjon,
   nestet repeater) → RADKORT (mockup 2a). Aldri blandingsformer.
2. **Radkortet:** én loddrett blokk per rad. Radheader: radnr i sirkel + «{repeater-label} —
   rad N» + «markør N på tegningssiden» når raden har markør. Felter i MALBYGGERENS
   rekkefølge med barn-label som ledetekst (uppercase, liten).
3. **Per felttype:** skalar → label + verdi; beregning → label + resultat; tomt felt →
   «Ikke utfylt» (aldri utelatt); nestet repeater → rekursivt radkort med innrykk, tom →
   «Ingen rader».
4. **Bilder:** egen blokk hos SITT felt. To og to i full bredde (som godkjent mockup):
   4:3 liggende ~høyde 60 mm, 3:4 stående samme høyde, sideforhold ALLTID bevart, aldri
   oppskalert, flere bilder bryter til ny rekke. Bildetekst under hvert bilde:
   «Bilde NN — {filnavn} · {dato kl}». Dagens atferd der bilder samles øverst i tabellen
   FJERNES.
5. **Tegningsposisjon:** koordinattekst (Z-20-01 (60,6 %, 75,2 %)) + LITE detaljutsnitt
   (~40 mm bredt, 4×-zoom rundt markøren, kun visuell lokasjon — Kenneth: «den skal bare
   visuelt vise lokasjon») + ev. merknad i kursiv under. Gjenbruk byggDetaljUtsnitt.
6. **Tegningshelsiden (D2b) er uendret:** hele tegningen + nummererte markører; markørnr =
   radnr i radkortene.
7. **Sidegrense:** radkort holdes samlet når det får plass på én side; ellers brytes MELLOM
   felter, aldri inne i et felt; bildeblokk kan brytes mellom rekker, aldri midt i en rekke
   og aldri mellom label og første rekke.
8. **Veilednings-/infofelt printes ikke** (D9 — bryteren «Ta med veiledningstekster» er
   egen sak; undersøkelsesordren for det skrivbare info-feltet løper separat).

## Implementering
- `arkivmal/repeater.ts` (+ ev. ny radkort-modul i `arkivmal/`). `tegningsside.ts` urørt.
- **`felt.ts` FROSSET.** Ingen regresjon i mobil-PDF.
- Test: rik repeater → radkort; helskalar → tabell; rad uten bilder → ingen bildeblokk;
  nestet repeater med rader → rekursivt kort; BEF-002 rendres som mockup 2a.

## DoD
1. Rotårsak, delte kilder (utsnitt-maskineriet gjenbrukes, ikke kopieres)
2. Build grønn + testsuiter grønne
3. Skjermbilde-designgate hos fabel: leveransen sammenlignes LINJE FOR LINJE mot
   Designlås-blokken og mockup-PNG-ene
4. Dok-sync (designnotat-arkivmal: TILLEGG om radkort-vedtaket; verifiseringslogg)
5. Merge via cowork (`--no-ff`)
