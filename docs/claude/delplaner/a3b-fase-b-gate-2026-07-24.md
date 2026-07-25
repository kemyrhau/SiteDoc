# A-3b Fase B — fabel design-gate (2026-07-24)

TIL REPO: docs/claude/delplaner/a3b-fase-b-gate-2026-07-24.md.

## Vedtak: GODKJENT mot § 8/§ 9-gaten + Del 1c/2-designet — med ÉN verifisering før merge + to oppfølgere.

**Godkjent:** § 8 (erAdmin → nøytral ubetinget; registrator ball-utledet — avsender ser «Til behandling», ikke nøytral) · § 9 (rejected perspektiv-avhengig: ballinnehaver warning «Til utbedring», venter/nøytral primary «Til revisjon»; fotnote ¹ strøket, § 2b konsumert, HMS synket) · Del 1c/1d/2 (ball-holder-chip m/ person foran faggruppe, Mine oppgaver på beregnHarBallen, Send videre-skille m/ ADMIN separat, person-videresending, nudge kun ved Send tilbake/Avvis) · ufravikelige holdt (statusmaskin urørt, pkt 7 ikke bygget, HMS-retur målt+flagget som aspirasjonell — IKKE fylt: korrekt håndtering).

**Verifisering før merge (liten, mot kode):** relé-formuleringen «alle andre ball-utledes: harBallen ? aktiv : venter» — bekreft at **D-leser-fallbacken finnes**: en bruker med leserett uten partsforhold (faggruppe-bundet, verken avsenderskap eller ball) skal falle til nøytral D («Mottatt»/«Til revisjon»), IKKE til venter-A («Til behandling» — avsender-etikett hos en som aldri sendte). Perspektiv-tabellens § 2-fallback er D. Er den dekket i `utledPerspektiv`, merge; hvis ikke, én-linjes fiks først.

**Oppfølger 1 (planlegges, egen kloss):** mobil-wiring av perspektivEtikett — delt funksjon er klar i `@sitedoc/shared`, mobil-badgen ikke wiret. Mobil er pilotens hovedflate (timeregistrering + dokumentflyt); dette skal inn i køen før pilot, ikke ligge som stille gap. Ingen regresjon i dag (ny funksjon, ikke importert).

**Oppfølger 2:** dokumentflyt.md § 2/§ 6-sync post-merge (dokumentasjonssync-plikten).

/code-review: enig med cowork — display-lag, ren måling, build+tester+klikktest+gate holder. Valgfri fil-review på videresend-valg.ts er belte-og-bukseseler.

Sekvens: D-fallback-verifisering → merge → test-deploy → Kenneths klikktest (cowork leverer sjekklisten).
