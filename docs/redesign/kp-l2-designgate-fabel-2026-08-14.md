# KP L2 — fabels designgate (2026-08-14)

Gatet mot skjermbevis i `relay/kontrollplan-l1-bevis/` (L2-a … L2-d) + Opus' rapport.

## Verdikt: BETINGET GODKJENT — ett bevis må lukkes før prod

| Krav | Verdikt | Begrunnelse |
|---|---|---|
| a) Markørfarge/-form | 🟡 Grønt med to merknader | Tre tilstander DOM-verifisert (godkjent = fylt grønn, påbegynt = fylt blå, forfalt = hvitt fyll/rødt omriss). Merknader under. |
| b) «Vis på tegning» med utheving | 🔴 Ikke bevist | `L2-c-vis-paa-tegning-uthevet.png` viser **ingen synlig utheving** — bildet er visuelt identisk med L2-a. Og `L2-c2-utheving-usynlig-funn.png` heter i klartekst «utheving usynlig». Hopper-til-tegning er bevist; uthevingen er ikke. |
| c) Lagfilter | ✅ Grønt | L2-b: kontrollpunkt-markørene forsvinner, oppgave-laget står. Tellerne i togglene (3/1) er riktig detalj. |
| d) Full plasseringsflyt | ✅ Grønt | L2-d: KB4 plassert, teller 3→4. |
| Deklarert uoppfylt (skille frie sjekklister) | ✅ Akseptert | Korrekt håndtert: «frie sjekklister på tegning» finnes ikke i koden — å filtrere på noe som ikke rendres er meningsløst. Egen sak hvis ønsket. Døde felter (`Checklist.drawingId`/`positionX`/`positionY`) føres i BACKLOG som rydding, samme klasse som `ansvarsmerke`. |

## Betingelse for prod (blokkerende)

**B1 — bevis synlig utheving.** Enten (i) nytt skjermbilde der uthevingen faktisk synes (ring/puls/zoom-til-markør), eller (ii) hvis c2-funnet betyr at uthevingen ER usynlig i praksis: fiks først (forslag: zoom/sentrer til markøren + puls-ring i 2–3 s — en statisk ring på en liten markør mot flyfoto vil ikke synes). Avklar hva c2-funnet konkluderte; rapporten nevner det ikke.

## Merknader (ikke blokkerende, føres som L2-restanser)

**M1 — formmatrisen er ufullstendig bevist.** Regelen er: form bærer «er arbeid startet», farge bærer «haster det». Beviset viser tre kombinasjoner (godkjent/påbegynt/forfalt-ikke-startet). Hva viser et **forfalt punkt der arbeid er startet** — fylt form med rødt omriss? Bekreft at matrisen er komplett i `avledPunktTilstand` og at forfalt ikke kollapser form og farge til én tilstand. (Forfalt-markøren i beviset har både annen form OG annen farge enn de to andre — det kan være riktig hvis den også er ikke-startet, men da mangler den fjerde cellen.)

**M2 — markørstørrelse/finnbarhet.** På 100 % mot flyfoto er markørene ~14 px. På tegninger med titalls punkter blir dette tungt å treffe og skille. Ikke blokker for L2, men noter til tegnings-runde: min. treffflate og evt. clustring ved mange punkter.

## Andre avgjørelser i samme runde

- **B12 1/4:** står. Koblingen er ekte dokumentasjon; nullstilling ville gjeninnført bugen som datatilstand. (Kenneth-vedtak 2026-08-14.)
- **L1.6 (punktets faggruppe som startgrense):** tatt til etterretning — vedtatt og i bygging, ingen ny beslutning her.
- **Sak 4-tillegg (årsakskode):** fabel støtter. `KontrollplanHistorikk` bør bære en **årsakskode ved fristendring** — forslag til startsett: `byggherre_forsinkelse` · `entreprenor_forsinkelse` · `forsering` · `revidert_fremdriftsplan` · `annet` (+ fritekst-notat). Kontraktuelt er hvem-som-er-årsak avgjørende for fristforlengelseskrav (NS 8405/8407-sporet), og planen kan bli bevis. Kode + notat er nok — ingen arbeidsflyt rundt det nå. Tas inn i granularitets-/fristrevisjonsspecen (egen leveranse).

— fabel
