# KP L1 — FABEL-DESIGNGODKJENT ✅ (klar for commit/merge → prod-vei)

Dato: 2026-08-14 · Fra: fabel · Til: cowork + Opus kontrollplan (via Kenneth)

## Gate-vurdering (alle 8 skjermbilder gjennomgått)
- **a)** GRØNT. a1 viser 0/4 (prod-bugen: 13 foreldreløse teller ikke), a2 viser 1/4 godkjent på urørte data. 1/4-avgjørelsen (fabel 2026-08-14) fulgt korrekt.
- **b)** GRØNT. Koble-dialogen lister de foreldreløse KB2-sjekklistene (#17–#23 synlig).
- **c)** GRØNT. Én flyt → ingen velger, 1 klikk, sjekkliste opprettet — klikk-budsjettet holdt (målt, ikke rapportert).
- **d)** GRØNT med merknad. Velgeren vises («Velg dokumentflyt», Endringsmelding synlig); dropdown-klipping deklarert og de to flytene DOM-verifisert. Medlemsendringen (kemyrhau → registrator i ekte Endringsmelding-flyt) var deklarert, minimal og reversert — akseptert.
- **e)** GRØNT. Full feilmeldingstekst i bildet: navngir hva som mangler OG hvem som fikser. Nøyaktig det gaten krevde. Konstruksjon deklarert og ryddet.
- **BUG-fangsten:** gaten gjorde jobben sin — Start-veien var død på develop (`.uuid()` mot cuid) og coworks kodegate så det ikke. Fiks + regresjonstest (bevist ekte guard) + sweep med søkerom (ett treff i routes/) oppfyller kravene. **Dette føres som presedens: skjermbilde-gate mot kjørende kode er ikke seremoni.**
- **Enkeltmålt-flagg:** deklarert som krevd (fabels gate + Opus' måling = de to leddene).
- **Ekte/konstruert-deklarasjon:** komplett per bilde. Godkjent.

## Avgjørelser på de åpne punktene
1. **B12 står på 1/4 — LA STÅ.** Koblingen er ekte og riktig (KB2-punktet ER utført og godkjent); å nullstille ville gjeninnføre bugen som datatilstand. Resten kobles når Kenneth vil, via UI-et som nå finnes.
2. **Narvik tom kontrollplan:** kosmetisk, aksepteres. «Slett kontrollplan»-mutasjon føres som backlogg-sak (L2 eller vedlikehold), ikke blokker.
3. **Coworks Endringsmelding-diagnose korrigert av Opus** (punktum-variant-brukeren): tas til etterretning; ingen aksjon.

## Design-observasjon til L2 (ikke blokker)
I a2/c1 viser KB2-raden Status «Pågår» og Sjekkliste «Godkjent» samtidig. Det BEVISER avledet kilde (bra), men kan forvirre brukere: to statusord på én rad. L2s form/farge-modell (form=arbeid, farge=hast) bør samtidig avklare hva Status-kolonnen skal bety når fremdrift avledes av sjekklisten — trolig skal punkt-status pensjoneres også fra UI, ikke bare som kilde.

## Neste steg
- **Fabel melder: KP L1 klar for commit/merge.** Kenneth relayer til cowork — cowork eier merge-timing og prod-deploy (merk: L1 er IKKE i 25-commits-deltaet; egen vei).
- Innlogget prod-verify etter deploy: gjenta a-scenarioet på prod-dataene (de reelle 13) — det er selve kundeverdien.
- L2 (tegningspunkter + passiv fristvarsling) kan bestilles når Kenneth vil.
