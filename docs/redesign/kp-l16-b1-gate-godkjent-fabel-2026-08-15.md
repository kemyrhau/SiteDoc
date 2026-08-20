# KP L1.6 + B1 — gate GODKJENT med to merknader. Sak 8 avgjort: to ulike porter, ingen konflikt.

Dato: 2026-08-15 · fra fabel · svar på inbox-fabel-leveransen «L1.6-gate (4 skjermbilder) + B1-halobevis» (2026-08-15, develop `71143bc3`)

## B1 — GODKJENT og LUKKET

Halobeviset holder: på ekte B12-tegning skiller det uthevede kontrollpunktet (hvit skive + hårlinje bak rød pinne) seg tydelig fra oppgave-pinnen (ren rød) — lesbart i statisk skjermbilde, altså uten bevegelse, som var hele kravet. Rotårsaken (transform-kollisjonen) er fjernet, ikke lappet. L2 + B1 + M1 (gatet godkjent i `kp-l2-m1-gate-godkjent-fabel-2026-08-15.md`) er dermed klare for prod når M1 er bygget — Kenneth eier deploy-timingen.

## L1.6 — GODKJENT, med to merknader som fikses før prod (ikke re-gate; fiks + bekreft i relé)

Scenariene (i)–(iv) er grønne. Isolasjonen (iv)→(ii) — samme bruker, samme punkt, eneste variabel er faggruppemedlemskap — er akkurat den prøven gaten trengte. At bevisene er konstruert i Agent-testprosjektet aksepteres: org-grensen som sperret de menige testbrukerne ute fra B12 er reell og deklarert, og B1 er tatt på ekte data.

**Merknad 1 (min observasjon, ikke meldt av Opus): rå i18n-nøkkel i RedigerPunktDialog.** I `kp-l16-1-planoppsett-flyt-satt.png` står ledeteksten **`kontrollplan.status`** ubehandlet over «Uten frist»-radioen. En bruker skal aldri se en nøkkel. Fiks + 13-språk-generate.

**Merknad 2: (iii)-meldingen navngir kun prosjektadmin.** «En prosjektadmin må velge flyt for punktet» — etter Kenneths firmaadmin-utvidelse kan også firmaadmin fikse dette. Ordlyd: «En prosjekt- eller firmaadministrator …». Liten, men meldingen er selve veiviseren.

## Firmaadmin-utvidelsen — godkjent som utvidelse av mitt vedtak

Riktig hull, riktig fiks: `company_admin` uten `ProjectMember`-rad er normaltilstanden for firmaadmin, og fallback via `projectOrganization` gjenbruker eksisterende mønster (delt kilde, ikke duplisert). Presedens: bypass-settet er nå sitedoc_admin · prosjektadmin · firmaadmin · flyt-registrator — fremtidige porter bruker samme sett, ingen flate definerer sitt eget.

## Sak 8 avgjort: «punktets faggruppe» og «ansatt i flyten» er to ULIKE porter — begge gjelder

Kenneths setning var: *«senere skal en ansatt i flyten kunne åpne sjekklisten ved å trykke på markering i tegningen»* — den handler om å **åpne et eksisterende dokument**, ikke om å starte kontrollen. Mitt vedtak handler om **Start**. Ingen konflikt:

- **Start-porten = punktets faggruppe** (+ bypass-settet). Den som utfører kontrollen starter den. (iv) er dermed **riktig oppførsel**, ikke for streng.
- **Åpne-porten = dokumenttilgang som ellers** — flytmedlemskap gir allerede lesetilgang via eksisterende tilgangskontroll. Lederen i «Tømrer ansatte → Tømrer Ledelse» kan åpne sjekklisten fra markøren uten å kunne starte nye kontroller i en faggruppe han ikke tilhører.

Konsekvens for tegning-markør-klikk (fremtidig L-sak): klikk på markør med koblet sjekkliste → åpne (dokumenttilgang avgjør); markør uten → Start-porten avgjør om knappen vises. Ingen kodeendring bestilles nå.

## Multi-punkt modell (b)

Notert som orientering. Bekrefter premisset: unique-constrainten og importens rad-identitet må løsnes i samme operasjon — det hører til fristrevisjons-/granularitetsordren (sak 4), som jeg utformer separat.

## Neste

Opus: merknad 1+2 → push → cowork diff-gate → merge. M1 bygges per godkjent gate. Deretter samlet prod-deploy (L2 + B1 + M1 + L1.6) på Kenneths signal.
