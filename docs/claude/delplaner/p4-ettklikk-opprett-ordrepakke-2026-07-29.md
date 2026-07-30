# P4-ordrepakke — ett-klikk opprett (fabel → utfør-Opus, via cowork, 2026-07-29)

> Forutsetning OK: audit + P1 + P2 + P3 på develop. Målbilde/fallback-stige/overstyring: `effektivitets-audit-ordre-2026-07-29.md` § Målbilde (Kenneth-vedtatt) + mockup `Ett-klikk Opprett Malbilde.dc.html` (1a/1b). Tre delordrer i rekkefølge — cowork sekvenserer og kan kjøre P4a ∥ P4b (ulike flater); P4c etter P4b (deler chip-mønsteret).

## P4a — Mobil: løs iOS-modal-blokkeringen (teknisk forutsetning)
1. **Nå-sjekk først (fabel-gates):** reproduser kollisjonen bak dagens bevisste ekstra «Opprett»-trykk (`OpprettDokumentModal.tsx:478-479`) — hva kolliderer (modal-dismiss vs router-push?), på hvilke iOS-versjoner/navigasjonsstack. Rapportér rotårsak + 2-3 løsningskandidater (f.eks. router-push ETTER modal-dismiss-callback, full-screen route i stedet for modal).
2. Bygg valgt løsning: trykk på mal (eller «+» ved auto-valgt mal) → dokument opprettes som utkast → rett inn i utfyllingen. Ingen «Opprett»-bekreftelse.
3. DoD: fysisk iOS-test (Kenneth) — opprett fra hjem og fra liste, ingen hengende modal/dobbel-navigering.

## P4b — Web: ett-klikk opprett med kontekst-chips
0. **TILGJENGELIGHETS-FILTER FØRST (Kenneth-gate-funn 2026-07-29, mobiltest — gjelder web OG mobil):** malvelgeren (og auto-valget) skal KUN tilby maler brukeren faktisk kan opprette fra: mal ∈ en dokumentflyt der brukeren er registrator/bestiller i valgt faggruppe (+ maler uten flyt-krav). I dag lister mobil-velgeren 7 maler hvorav opprettelse feiler ved innsending («Dokumentflyt er påkrevd for denne sjekklistetypen») — brukeren fyller hele skjemaet før avvisning. Ufravikelig: filteret evalueres server-side i mal-listekallet (samme regel som valideringen ved opprett — DELT kilde, ikke duplisert klient-logikk); en mal som ville feile ved Opprett skal aldri vises. Faggruppe-avhengighet: velges faggruppe FØR mal (eller utledes den), filtreres mallisten på den; ellers viser velgeren tilgjengelighet per mal. Dette punktet er forutsetning for pkt 1 — auto-opprett med en mal som avvises er verre enn dagens flyt.
1. Opprett-knapp → dokument opprettes som utkast direkte → detaljsiden i utfyllingsmodus. Malvelger vises KUN ved reell flertydighet (P2 landet auto-hopp ved 1 mal; behold).
2. **Kontekst-chip-linje** øverst på detaljsiden (mockup 1b-mønsteret): prosjekt · byggeplass · faggruppe · mal. Hver chip = velger (klikk → dropdown/ark: relevante øverst, sist brukte, søk). Byggeplass-default: header-kontekst (P2 wiret den inn i mutasjonene — gjenbruk).
3. **Mal-overstyring:** velger gruppert per dokumentflyt (flyt som overskrift, maler under) når brukeren er registrator i flere flyter. Malbytte → tittel regenereres; utfylte felt beholdes m/varsel.
4. **Fallback-stige per felt:** kjent kontekst → sist brukte (merket) → tom chip m/varselfarge, kreves før innsending (aldri før opprettelse).
5. Tittel: malnavn + løpenummer, redigerbar i header (P2-mønsteret fra mobil gjenbrukes).

## P4c — Timer: todelt inngang → ett trykk (størst gevinst, 7→1-2)
1. «Ny dagsseddel»/«Før timer» → én flate: dagsseddel opprettes (finnes den for dato+bruker, åpnes den — `@@unique([userId, dato])`), prosjekt prefylt (sist brukte; GPS der den finnes), lønnsart firma-default (P2 landet), dato i dag. Rad-redigering direkte.
2. Ingen mellomside `timer/ny` for happy path — den beholdes kun som overstyringsvei (annen dato/bruker) eller fjernes hvis chip-mønsteret dekker det (utførers nå-sjekk avgjør, fabel gater).
3. DoD: klikk-telling web manuell vei rapporteres (mål ≤2 til første rad lagret).
4. **Maskin [fabel-målt 2026-07-29 + Kenneth-vedtak 2026-07-29]:** maskintimer registreres SAMMEN med arbeidstimer — maskin arbeider ikke uten en mann. Dagens maskin-i-rad-mønster (valgfri maskin-seksjon i timerrad-dialogen, maskin ≤ arbeid-kapasitet, inline MASKIN-merke, maskinførerbevis-varsel — `timer/[id]/page.tsx`) er dermed RIKTIG modell og bevares som eneste ordinære vei. **Unntak (Kenneth): utleie** — per døgn eller til annen entreprenør — er de eneste tilfellene der maskintid står uten arbeidsrad. Nå-sjekk: finnes frittstående maskin-rad-vei fortsatt (MaskinRadDialog direkte)? I så fall avgrenses den til utleie (eksplisitt utleie-markering på raden; maskin ≤ arbeid-regelen gjelder ikke utleie-rader) — rapportér omfang før bygging, fabel gater. Regressjonssjekk maskin-rad i task-walkthrough-gaten.
5. **Varelager:** vareforbruk er egen flate (ikke i dagsseddelen) og røres IKKE av P4c. Den ble heller ikke målt i auditen — fabel noterer vareforbruk-flyten som kandidat til neste audit-runde (klikk-telling + kontekst-default), egen sak.

## Ufravikelig (alle tre)
Delte kilder (chip-komponenten bygges ÉN gang, gjenbrukes oppgave/sjekkliste/HMS/timer) · ingen ny dokumentklasse/rute-duplisering · i18n · hit-targets ≥44px · server røres kun der nå-sjekk viser at default mangler (ikke ny valideringslogikk — P2/P1 eier den).

## Gate (per delordre)
Nå-sjekk → fabel-gate → kode → build+tester → skjermbilder/opptak (harness for chip-tilstander, e2e for flyten — jf. bevis-løype-veiledningen) + klikk-tall mot budsjett → fabel task-walkthrough → Kenneth-test (P4a/P4c: fysisk enhet) → dok-sync → merge.
