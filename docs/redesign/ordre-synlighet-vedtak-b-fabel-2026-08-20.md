# Ordre: kartlegging medlemskapsmodeller + synlighetsvedtak B (fabel → kode-Opus)

**Dato:** 2026-08-20 · **Status:** kartlegging + forberedelse til fiks. Ingen kodeendringer uten egen commit-klarering.
**Bakgrunn:** faggruppen «A.Markussen» på prosjekt 999 hadde 0 FaggruppeKobling-medlemmer selv om Kenneth deltok i flyten via tilgangsgruppen «A.Markussen Ansatte» — dokumentet ble usynlig. Tre medlemskapsmodeller (person-ledd, gruppe-ledd, faggruppe-ledd) presenteres som én i UI, men synlighetslogikken leser bare én av dem.

## Vedtak (Kenneth 2026-08-20)

**Invariant:** et flyt-ledd skal aldri kunne peke på en bemanningskilde som ikke gir medlemmene synlighet.

**Valgt løsning: B — synlighet leser alle tre ledd-kildene.** Dokument- og mappesynlighet skal sjekke person-ledd (`projectMemberId`), gruppe-ledd (`groupId` → gruppens medlemmer) og faggruppe-ledd (`faggruppeId` → FaggruppeKobling) — samme prinsipp som `useFlytKontekst.ts` og `hms-hos.ts` allerede bruker. Ingen synk-plikt, ingen dupliserte koblinger. Løsning A (opprette koblinger ved flyt-opprettelse) er forkastet: den skaper vedlikeholdsplikt ved gruppeendringer og en ny driftskilde til samme feil.

## Kartleggingspunkter (rapport før fiks-ordre)

1. **Hvilke synlighetssjekker leser kun FaggruppeKobling i dag?** Kandidater: dokument-/sjekklistesynlighet, mappetilgang (`mapper/page.tsx` l. ~176, `MapperPanel.tsx` l. ~166 leser kun `faggruppeKoblinger`), `medlem.hentMineFaggrupper`, arkiv/dokumentsøk. List hver sjekk med fil/linje og hvilken kilde den leser.
2. **DokumentflytMedlem:** bekreft XOR-invarianten (faggruppeId/groupId/projectMemberId) i skjema og all skrivevei — finnes rader som bryter den?
3. **Estimat for B:** hvilke funksjoner må endres, kan gruppe-oppslaget deles med `flyt-ledd.ts` som felles kilde (ikke duplisert logikk)?
4. **Død kode:** `medlem.tilknyttFaggruppe` (medlem.ts ~l. 472) har ingen UI-kallere — behold (og gi UI) eller fjern? Innstilling ønskes.
5. **Skjult faggruppe-side:** `/dashbord/[prosjektId]/faggrupper` er i `hub-ruter.ts` men utelatt fra sidebaren i `navigasjon-kontekst.tsx` — bevisst eller glemt? Med B som vedtak: hvilken rolle skal siden ha?

## UI-funn til samme rapport (redesign-input, ikke fiks nå)

- **To Kontakter-sider:** `/dashbord/[prosjektId]/kontakter` (navn/rolle/e-post) og `/dashbord/oppsett/brukere` (telefon/firma/flyt-rolle). Vedtatt feltsett for kontaktside: **navn, e-post, telefon, firma personen er ansatt i, prosjektrolle.** Kartlegg hva som skal til for én side (eller én delt datakilde).
- **Tre medlemskap ser identiske ut:** «A.Markussen Ansatte (3)» (tilgangsgruppe) vs «A.Markussen, 0 medlemmer» (faggruppe) — samme navneprefiks, ulike modeller, ingen visuell forskjell. Dokumentflyt-siden viser «Kontakter: —» uten forklaring eller handling. Noter forslag, ikke implementer.

## Rapportformat
Per punkt: funn med fil/linje, deretter samlet innstilling til fiks-ordre for B (omfang, risiko, testbehov). Ingen kodeendringer i denne ordren.
