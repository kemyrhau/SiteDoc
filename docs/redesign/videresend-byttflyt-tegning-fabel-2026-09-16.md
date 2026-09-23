# Videresend / Bytt flyt — tegningsnotat (fabel, 2026-09-16)

Svar på ordre `relay/inbox-fabel.md` (develop a49452a1). Tegning: `videresend-byttflyt-tegning-fabel-2026-09-16.dc.html` (samme mappe).

## A. Anbefaling: ÉN handling, synlig konsekvens

Ikke to handlinger («Tildel» / «Bytt flyt»), men én «Videresend …» der konsekvensen vises i valgøyeblikket.

Begrunnelse (målt): begge hensikter er samme server-operasjon. `forwarded` bytter flyt når `input.dokumentflytId ≠ oppgave.dokumentflytId` (oppgave.ts:1368ff) — flyt-byttet UTLEDES av hvilken mottaker som velges. Det finnes ikke noe eget «bytt flyt»-kall å henge en egen menyoppføring på; to oppføringer som ender i samme kall tvinger brukeren til å selvdiagnostisere hensikt før han ser valgene. Fiksen er synlighet:

1. Mottakervelgeren deles i **«I denne flyten — dokumentet blir hvor det er»** (flat personliste, ball-holder merket) og **«Andre flyter — flytter dokumentet dit»** (faggruppe→flyt-valgene fra `byggVideresendValg`, hvert med ⇄-konsekvenslinje som navngir målflyten).
2. Valg under «Andre flyter» fyrer et **bekreftelsessteg**: konsekvensboks (forlater flyt X, går inn i flyt Y, ballen til N, status endres ikke) + **påkrevd kommentar**. Knappen navngir målflyten («Flytt til Elektro — sluttkontroll»), aldri generisk «Bekreft».
3. Videresend innen egen flyt går direkte med valgfri kommentar — normal drift, ingen friksjon.

## Kenneths tre spørsmål — målt svar

1. **Re-gate til person: JA, mulig i dag uten å ødelegge noe.** Server tar `forwarded` med `recipientUserId`; F3.1 gjør handlingen ufarlig by design (status røres ikke, kun `aktivPosisjon`/mottaker). Prosjektadmin passerer `kanByttFlyt` (vei 2) og beholder full mottakerliste (H3).
2. **Rette feil flyt: JA** — samme kall med annen `dokumentflytId`; server auto-utleder mottaker fra hovedansvarlig utfører i målflyten (oppgave.ts:1433ff). Problemet er at byttet er stille — løst av ramme 2+3.
3. **Tømrer venter på elektriker: JA** — videresend paatvers. Problemet er at elektrikeren bare ser et nytt dokument — løst av ramme 4.

## Tilleggsfunn — må med i ordren

**Pilot-fiks A (02.08) gater Videresend HELT bort for flyt-bundne dokumenter** i handlingsmenyen: web `!harFlyt` (DokumentHandlingsmeny.tsx:434), mobil `harFlyt ? []` (DokumentHandlingslinje.tsx:208). Kenneths tre scenarier gjelder nettopp flyt-bundne dokumenter — funksjonen serveren har er unåelig fra menyen der den trengs. Tegningen gjenåpner den bevisst. Gate-grunnen den gang (mottakervelger hvis valg «kastes» av posisjonsruting) faller bort når videresend-stien alltid sender eksplisitt mottaker + flyt-ID, som tegnet.

## B. Gate-spørsmål — AVGJORT (Kenneth 16.09: JA, behold)

`kanByttFlyt` (tilgangskontroll.ts:1723) har fire veier til ja: sitedoc-admin, prosjektadmin, registrator, og **ball-holder som selv er medlem av målflyten**. Skal den fjerde veien bestå?

**Kenneth svarte JA 16.09 — alle fire veier består. `kanByttFlyt` røres ikke.** «Andre flyter»-seksjonen i velgeren vises kun for dem gaten slipper gjennom.

## Vern mot koding utenfor intensjon (Kenneth 16.09)

Tegningen (øverste seksjon «I dag vs. ny») skiller eksplisitt:

**Røres IKKE (går inn som forbud i ordre-DoD til Opus):** server-endepunktet `forwarded`, F3.1 (status urørt), `kanByttFlyt` (alle fire veier), H3-filteret, `byggVideresendValg`-datastrukturen, draft-send-stien, posisjonsruting for Send/Besvar.

**Endres (kun presentasjonslag):** meny-gaten `!harFlyt` løftes for Videresend (web DokumentHandlingsmeny.tsx:434, mobil DokumentHandlingslinje.tsx:208), mottakervelgerens to seksjoner + ⇄-linje, nytt bekreftelsessteg ved flyt-bytte, mottakerens dokumentrad.

Ingen endring i datamodell, ruter eller tilgangskontroll — verste utfall av feilkoding er en visningsfeil, som er reversibel og ikke kan skade flyten.

## C. Person-tildeling

Finnes (Del 2.4), men skjult bak ekspandering av faggruppe-rad. Tegnet: personene i dokumentets EGEN flyt ligger flate og synlige øverst i velgeren; i «Andre flyter» beholdes ekspander-mønsteret men med synlig persontall («3 personer ▾»).

## D. Hva mottakeren ser

Loggen «Videresendt fra X til Y: {kommentar}» er ikke nok — den ligger i historikken. Tegnet (ramme 4): dokumentraden i mottakerens liste får (1) «⏳ Venter på deg»-badge når dokumentet kom paatvers med kommentar, (2) avsender med rolle og tidspunkt, (3) kommentaren synlig i raden. Datagrunnlaget finnes i `DocumentTransfer` (senderId, comment, retning=paatvers) — ingen schema-endring. Mikrotekstene i ramme 1–3 følger § 3a (hvor · hvem · hva ser motparten).

## Ikke tegnet (DoD 2)

- Mobil-layout — samme modell og tekster gjelder; egen tegnerunde om cowork trenger den
- Statusmodell og F3.1 — urørt per ordre (vedtak 02.08 står)
- Datamodell/ruter, HMS, Malforvaltning — utenfor scope per ordre
- Varslingskanal (e-post/push) til mottaker — kun liste-visningen er tegnet
- Draft-send (draft→sent) — bruker ufiltrert liste i dag, urørt
