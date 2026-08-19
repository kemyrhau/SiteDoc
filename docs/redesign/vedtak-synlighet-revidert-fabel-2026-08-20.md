# Revidert vedtak: synlighet/medlemskap etter kartlegging (fabel → kode-Opus)

**Dato:** 2026-08-20 · **Erstatter:** ordre-synlighet-vedtak-b-fabel-2026-08-20.md (vedtak B-delen)
**Bakgrunn:** kartleggingen motbeviste premisset for vedtak B. Dokument-synlighet leser allerede alle tre ledd-kildene med admin-bypass (`byggTilgangsFilter` tilgangskontroll.ts:975, `avgjorDokumentTilgang`). 999-gåten skyldtes faggruppe-tellerens manglende deletedAt-filter — ikke synlighet.

## Vedtak (fabel 2026-08-20)

1. **Vedtak B lukkes som allerede implementert.** Invarianten («et flyt-ledd skal aldri peke på en kilde som ikke gir synlighet») består som prinsipp, men håndheves i skjemalaget, ikke ved ny synlighetskode.

2. **Fiks: faggruppe-tellerens deletedAt-filter** (faggruppe.ts:27–30, `_count` på bestiller/utforerChecklists og -Tasks teller slettede). Enlinjes, men den kostet en kvelds feilsøking og viser feil tall til brukeren. Egen liten fiks-ordre — klar for implementering nå. Verifisering: 999-faggruppen skal vise samme tall som sjekkliste-lista.

3. **Håndhev «høyst én» kilde i `addDokumentflytMedlemSchema`** med superRefine (i dag alle tre `.optional()` uten vern; null-ledd = «åpen for alle» er gyldig og skal fortsatt være det — altså 0 eller 1, aldri 2+). Vokter invarianten der brudd kan oppstå.

4. **Mappe-modellen (FolderAccess) flyt-bevisstgjøres IKKE nå.** Flyt-fraværet er strukturelt — mapper deles ikke gjennom dokumentflyt, og det er et forsvarlig design: mappetilgang er eksplisitt tildeling. Står som designspørsmål på redesign-lista, tas ved mapper-delen av masterplanen.

5. **`medlem.tilknyttFaggruppe` fjernes** (medlem.ts:472, død i API — ingen UI-kallere). Begrunnelse: to add-veier er duplisert logikk; veien som brukes er `medlem.leggTil`-upserten. NÅR faggruppe-siden får roster-UI i redesignet, gjeninnføres én delt funksjon som både roster-UI og leggTil delegerer til — ikke to parallelle mutations.

6. **Opprydding (lav prioritet, kan følge annen ordre):** løft `erMedlemAvLedd(ledd, bruker)` ut som delt predikat — i dag duplisert inline i `useFlytKontekst.ts` (l. 128–131) og `hms-hos.ts` (l. 41–49).

## Til gjennomføring nå
Punkt 2 og 3 kan gå i samme lille fiks-ordre (begge er vern/korrekthet, små, testbare). Punkt 5 samme runde hvis trivielt. Rapportformat: diff-omfang + test per punkt, deretter fabel-designgate før commit-klarering som vanlig.

## Står fortsatt åpent (redesign-lista, ikke denne ordren)
- Skjult faggruppe-side (`hub-ruter.ts:35` vs sidebar) — rolle avgjøres i redesignet.
- To Kontakter-sider; vedtatt feltsett: navn, e-post, telefon, firma, prosjektrolle.
- Tre medlemskapstyper visuelt identiske; «Kontakter: —» uten forklaring/handling.
- Mappe-modellens flyt-spørsmål (punkt 4).
