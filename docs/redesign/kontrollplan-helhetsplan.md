# KONTROLLPLAN — HELHETLIG PLAN (P0/haster)

Dato: 2026-08-13 · Eier: fabel · Utfører: redesign-Opus (via Kenneth) · Status lever i `verifisering/kontrollplan-verifiseringslogg.md` (opprettes ved leveranse 1-exit)

## Formål
Kontrollplanen skal telle og vise reell kontrollstatus: sjekklister startes fra planen via den VANLIGE dokumentveien, punkter markeres på riktig tegning, og tegningen viser passivt hva som er planlagt, aktuelt nå og forfalt — uten ny infrastruktur.

## Avklarte premisser (verifisert mot kode 2026-08-13)
- «Frittstående sjekkliste»-kategorien er FORKASTET. Kontrollpunktet har alt den vanlige veien krever: bestiller = faggruppen til den som trykker Start (`verifiserFaggruppeTilhorighet(ctx.userId, bestillerFaggruppeId)`), utfører = `punkt.faggruppeId` (valgt ved import), flyt = malens flyt via `DokumentflytMal`.
- Flertydighet mal-i-flere-flyter er løst: gjenbruk `opprettbareFlytIder` (mal.ts) med MalVelger-mønsteret — én flyt → null klikk, flere → valg, null → forklarende feilmelding (ALDRI stille feil).
- Skjemaet bærer allerede koblingen: `KontrollplanPunkt.sjekklisteId` + `Checklist.kontrollplanPunkt` — aldri fylt. Leveranse 1 = null nye kolonner.
- Klienten utleder bestiller/utfører fra flyten selv (sjekklister/page.tsx:375) — formalitetskravet oppfylles alltid.

## Leveranse 1 — koble og starte (liten, gir verdi i dag)
1. `koblePunkt`: koble eksisterende sjekkliste til kontrollplanpunkt (fyller `sjekklisteId`). De 13 eksisterende sjekklistene (Boligfelt B12) kobles — planen teller de 2 godkjente umiddelbart.
2. `startPunkt`: opprett sjekkliste fra kontrollplanpunkt via vanlig `sjekkliste.opprett`-vei med flyt fra malens `opprettbareFlytIder` (klikk-regel over).
3. Telling/filter i kontrollplanvisningen faller ut av relasjonen.
4. Branch: egen branch fra develop (ikke oppå revisjonsarbeidet — uavhengige leveranser skal ikke kobles i merge-køen).

**Klikk-budsjett:** Start av punkt der malen ligger i nøyaktig én flyt: 1 klikk (Start) + ev. bekreft-fritt. Rapporteres ved levering.

**Kjent skjørhet (krav om god feilmelding):** er malen ikke i en flyt der brukeren er registrator, kan punktet ikke startes. Feilmeldingen skal si HVA som mangler og HVEM som kan fikse det — ikke stille utilgjengelighet (samme funn Kenneth traff 2026-08-12).

## Leveranse 2 — tegningspunkter og passiv varsling
1. **Punkt markeres på valgfri tegning:** `drawingId` sitter på PUNKTET, ikke planen — stål på én tegning, utomhus på en annen. (Modell A bærer dette uten endring.) Migrering gjelder kun tegningspunktene.
2. **«Vis på tegning»** fra kontrollplanen: hopp til punktets tegning med markør.
3. **Skille i tegningsvisningen:** kontrollplanens sjekklister vs. tilfeldig opprettede sjekklister — egne lag/filter.
4. **Passiv varsling med farger, beregnet ved visning** fra `fristUke`/`fristAar` mot dagens dato, `varselUkerFor` styrer gul-terskel: grå/nøytral = planlagt · gul = aktuell nå · rød = forfalt. Ingen scheduler.
5. **Form og farge bærer hver sin akse:** hul markør = ikke påbegynt, fylt = arbeid finnes; farge = hast. Aldri slå sammen aksene.
6. **ÉN delt hjelper** for frist-beregningen — tegning, liste og rutenett leser samme regel (aldri tre implementasjoner).
7. **Test: ukenummer over årsskiftet** (U52→U01) — obligatorisk regresjonstest.

## Leveranse 3 — senere / egne saker (IKKE i ordrene over)
- Aktiv varsling (e-post/push): krever scheduler = ny infrastruktur; ses mot planlagt varslingsmodul.
- UI-hint i GeoReferanseEditor for 2-punkts eksakt-fit (jf. georef-speilfeil-ordren 2026-08-13).
- Byggherre-overlevering: «godkjent» i kontrollplanen betyr i dag utført/godkjent i VÅR flyt. Skal planen overleveres byggherre formelt, designes det som egen sak.

## Avhengigheter og grenseflater
- **Posisjonsmodell-restansen er IKKE kontrollplan-arbeid**, men grenser til: steg-inngangen som kollapser flyter (hardkodet `steg={1}`) og `utledMinRolle`-klientporten MÅ fikses sammen — ellers innfører steg-fiksen en ny feil i lesevisning. Ført i masterplanens backlogg 2026-08-13.
- Død kode-oppryddingen (egen ordre samme dato) fjerner `verifiserFlytRolle`/`byggFaggruppeFilter` som feilinformerte både Opus og fabel i denne runden.

## Definition of Done (per leveranse — jf. FABEL-RAMMEVERK)
1. Rotårsak/delte kilder · 2. build grønn · 3. fabel skjermbilde-gate + task-walkthrough mot klikk-budsjett · 4. dok-sync (exit-protokoll a–d) · 5. merge via cowork.
