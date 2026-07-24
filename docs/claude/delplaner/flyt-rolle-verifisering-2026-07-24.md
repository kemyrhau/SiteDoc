---
name: flyt-rolle-verifisering
status: 🔴 AKTIV RAPPORT — strukturert rolle-for-rolle-verifisering av dokumentflyt (funksjon + synlighet). Grunnlag for senere lukke-plan. Kenneth-vedtak 2026-07-24
eier: cowork (kode-måling + rapport) · Kenneth (klikktest per rolle) · fabel (design på flyt-binding)
sist_verifisert_mot_kode: 2026-07-24 (develop `9cdd4096`)
---

# Dokumentflyt — rolle-for-rolle-verifisering (rapport + metode)

## Bakgrunn

Klikktesten av A-3b (perspektiv-visning) avdekket at dokumentflyten **ikke oppfører seg som en ren rolle-separert flyt** for en ikke-admin bruker: dokumenter er ikke pålitelig knyttet til en flyt, synligheten svikter, og rolle-rettighetene er uklare. **A-3b selv står merget og er korrekt** — perspektiv-visningen er en ren funksjon av `rolle`/`harBallen`/`erAdmin`; feilene sitter i **inndata-laget** (flyt-tilknytning, rolle-utledning, synlighet, rettigheter) som A-3b konsumerer.

**Kenneth-føring 2026-07-24:** verifiser flyten **rolle for rolle** (Registrator → Bestiller → Utfører → Godkjenner), sjekk **funksjon (rettigheter)** + **visning (synlighet)** per rolle. **Få flyten til å funke FØR perspektiv-visning av pågående oppgave polishes.** Denne rapporten er grunnlaget for en senere lukke-plan.

## Kode-anker (målt 2026-07-24, develop)

| Lag | Funksjon / fil | Oppførsel |
|---|---|---|
| **Opprettelse** | `sjekkliste.ts` `opprett` | `dokumentflytId: z.string().uuid().optional()` — **valgfri**. Dokument kan opprettes uten flyt-tilknytning (`dokumentflyt_id = NULL`). |
| **Synlighet (liste)** | `byggTilgangsFilter` (`tilgangskontroll.ts`) | OR-grener: `bestillerUserId=meg` · `recipientUserId=meg` · direkte `FaggruppeKobling` (bestiller/utfører-faggruppe) · gruppe/domain · **flyt-medlemskap** (`hentFlytIderForMedlem`, krever `dokumentflytId` PÅ dokumentet). |
| **Rolle-utledning** | `utledMinRolle` (`flytRolle.ts`) | Admin → `registrator`. Ellers: **høyest-prioriterte** matchende rolle via `projectMemberId` / `groupId` / `faggruppeId`. |
| **Rettigheter (handlinger)** | `hentRolleFiltrertHandlinger` + `verifiserFlytRolle` | `adminNiva`-bypass (sitedoc/prosjekt) · ellers `ROLLE_HANDLINGER_DEFAULTS[rolle]` ∩ statusmaskin. Server håndhever. |
| **Fasit (matrise)** | Flyt-rettighetsmatrisen (global, Admin-flate) | `registrator = {draft: send/slett, rejected: send på nytt}`. Bestiller/utfører/godkjenner per matrisen. |

## Bekreftede funn (2026-07-24)

- **F1 — 🔴 Flyt-tilknytning mangler ved opprettelse (ROTÅRSAK).** `dokumentflytId` er valgfri → dokumenter blir foreldreløse (`dokumentflyt_id = NULL`; 11 av 15 på test før opprydding). Konsekvens: (a) lista viser ikke hvilken flyt, (b) flyt-medlemmer ser dem ikke (synlighets-gren «flyt-medlemskap» er død), (c) «ingen reel flyt». **Alt annet hviler på denne.**
- **F2 — 🟠 Lista viser ikke flyt / faggruppe / person.** Kolonnene «Flyt» + tilordning (faggruppe/person) er tomme fordi dokumentet ikke er tilknyttet (følge av F1) — OG evt. manglende kolonne-rendering. Ball-chip («hvem har ballen») fungerer.
- **F3 — 🟠 Synlighets-gren #3 bruker kun `FaggruppeKobling`.** En flyt-registrator bundet via **flyt-rolle** (ikke direkte faggruppe-kobling) fanges ikke av faggruppe-grenen — ser ikke egne faggruppe-dokumenter med mindre flyt-grenen (F1-avhengig) redder ham.
- **F4 — 🟠 kmy for mange rettigheter (må isoleres per rolle).** kmy er i test-configen nå ført i **flere roller** (registrator + bestiller + utfører + godkjenner) → `utledMinRolle` gir høyest-prioriterte rolle, så han «kan alt». Uavklart: er dette **config** (kmy i mange roller — forventet) eller et **enforcement-gap** (rettighet lekker forbi matrisen)? **Avklares i rolle-for-rolle-testen under.**

## Metode — rolle-for-rolle-verifisering

For hver rolle: sett opp **én ikke-admin bruker KUN i den ene rollen** (rene faggruppe-/flyt-bindinger), opprett/ruter et dokument gjennom flyten, og verifiser to akser:

### Rolle 1 — Registrator
- **Forventet FUNKSJON (matrise):** `Opprett` · `Send` · `Slett` (kladd) · `Send på nytt` (returnert). **INGENTING** på Mottatt / Under arbeid / Besvart / Godkjent.
- **Forventet VISNING:** ser dokumenter hun har opprettet + er flyt-medlem av. Ser flyt-tilknytning + hvem har ballen. Ser IKKE nøytral admin-etikett (hun er deltaker, ikke admin — A-3b § 8).
- **Sjekkliste:** ☐ opprett→send virker · ☐ ingen handlinger tilbudt på Mottatt · ☐ eget dokument synlig i lista med flyt-kolonne · ☐ etikett = avsender-perspektiv (blå «Til behandling»), ikke nøytral.

### Rolle 2 — Bestiller
- **Forventet FUNKSJON (matrise):** `Trekk tilbake` (sendt) · `Lukk` (godkjent) · `Gjenåpne` (trukket tilbake) · `Send på nytt` (returnert). (Verifiser mot matrisen ved test.)
- **Forventet VISNING:** ser dokumenter der han er bestiller/mottaker i flyten. Flyt + tilordning synlig.
- **Sjekkliste:** ☐ mottar sendt dokument · ☐ kun matrise-handlinger tilbys · ☐ synlig i lista · ☐ riktig perspektiv-etikett.

### Rolle 3 — Utfører
- **Forventet FUNKSJON (matrise):** `Besvar` (mottatt/under arbeid → besvart) · `Send tilbake` (under arbeid → sendt) · `Gjenoppta` (returnert → under arbeid) · `Videresend` (om beholdt).
- **Forventet VISNING:** ser dokumenter tildelt hans faggruppe/person som utfører. «Din tur» (amber) når ballen er hos ham.
- **Sjekkliste:** ☐ ser tildelt dokument · ☐ Besvar virker · ☐ kun matrise-handlinger · ☐ amber når ballen er hans.

### Rolle 4 — Godkjenner
- **Forventet FUNKSJON (matrise):** `Godkjenn` (besvart → godkjent) · `Send tilbake` (besvart → returnert) · `Videresend` (om beholdt).
- **Forventet VISNING:** ser dokumenter som venter på hans godkjenning. «Til godkjenning» (amber) når ballen er hos ham.
- **Sjekkliste:** ☐ ser dokument til godkjenning · ☐ Godkjenn/Send tilbake virker · ☐ kommentar-nudge ved Send tilbake · ☐ riktig etikett.

## Sekvens / prioritet (Kenneth-føring)

1. **F1 — Flyt-tilknytning** ved opprettelse (utled fra faggruppe/flyt, eller krev valg) + backfill. **Grunnmur — alt hviler på den.** Design-vinkel → fabel.
2. **F2/F3 — Synlighet:** lista viser flyt + faggruppe/person; flyt-medlemmer ser sine dokumenter; gren #3 fanger flyt-rolle-binding.
3. **F4 — Rettigheter per rolle:** verifiser matrise-håndheving rolle for rolle (metoden over). Skill config fra enforcement-gap.
4. **SIST — Perspektiv-visning av pågående oppgave:** IKKE polish før flyten funker (Kenneth-føring). A-3b står merget; end-to-end-verifisering av perspektiv-etikettene venter på en fungerende flyt.

## Neste steg

- **Fabel-design på flyt-bindings-modellen** (F1): utled `dokumentflytId` fra bestiller/utfører-faggruppens flyt vs. krev eksplisitt valg ved opprettelse + backfill-policy. Arkitektur-beslutning om dokument↔flyt-relasjonen.
- Deretter fiks-ordrer per lag (F1 → F2/F3 → F4), rolle-for-rolle-verifisert.
- **Denne rapporten er grunnlaget for lukke-planen.** Funn oppdateres etter hvert som rolle-testene kjøres.
