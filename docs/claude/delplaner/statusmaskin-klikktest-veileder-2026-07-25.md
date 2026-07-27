---
name: statusmaskin-klikktest-veileder
status: 🟢 KLIKKTEST-VEILEDER for Claude-i-Chrome — verifiser statusmaskin-redesign F0–F5 på test. 2026-07-25
eier: cowork (veileder) · Kenneth (kjører i Chrome-Opus)
---

# Statusmaskin-redesign — klikktest på test.sitedoc.no

## Mål
Verifiser F0–F5-redesignet ende-til-ende på test, med **koherens** som hovedkriterium: matrise-rad ↔ hover-tekst ↔ faktisk oppførsel skal beskrive samme ting for hver handling.

## Miljø
- **URL:** test.sitedoc.no (innlogget)
- **Prosjekt:** Sitedoc Boligfelt B12
- Hard refresh (Cmd+Shift+R) først — nytt JS-bygg.
- Opprett test-dokumenter (sjekkliste eller oppgave) etter behov; ikke rør ekte data.

## T1 — Avvist med påkrevd begrunnelse (F1)
1. Åpne et dokument som står som **Mottatt** (evt. opprett + send ett først).
2. **Forventet:** «Avvis» er en synlig **rød** knapp for utfører (ikke gjemt i ⋯-meny).
3. Klikk Avvis, la begrunnelses-feltet stå **tomt**, prøv å sende.
4. **Forventet:** handlingen **blokkeres** — begrunnelse er påkrevd.
5. Fyll inn begrunnelse, send.
6. **Forventet:** dokumentet står som **«Avvist»**, og motparten ser det som Avvist med begrunnelsen.
7. **FAIL** hvis: Avvis ligger i ⋯, tom begrunnelse godtas, eller status blir «Trukket tilbake»/«Avbrutt» i stedet for «Avvist».

*(skjermbilde av rød Avvis-knapp + av blokkeringen ved tom begrunnelse)*

## T2 — Papirkurv / soft-delete (F0)
1. Finn/opprett en **Kladd**. Slett den.
2. **Forventet:** dokumentet forsvinner fra lista, men er IKKE borte for godt.
3. Naviger til **Papirkurv** (venstre nav).
4. **Forventet:** dokumentet listes med **«dager igjen»** (~90). Som prosjektadmin ser du prosjekt-bredt (alle slettede i prosjektet).
5. Klikk **Gjenopprett** → dokumentet er tilbake der det var.
6. **FAIL** hvis: dokumentet er hardt borte, papirkurven mangler, dager-igjen ikke vises, eller gjenopprett ikke virker.

*(skjermbilde av papirkurv-lista med dager-igjen)*

## T3 — Trekk tilbake → redigerbar kladd (F2)
1. Som bestiller/registrator: send et dokument (→ Mottatt hos mottaker).
2. **Før mottaker svarer:** klikk **Trekk tilbake**.
3. **Forventet:** dokumentet blir **redigerbar Kladd hos deg** — du kan endre og sende på nytt.
4. **FAIL** hvis: det havner i en terminal «Trukket tilbake» du ikke kan redigere, eller trekk tilbake mangler.

## T4 — Send tilbake → direkte til «Under arbeid» (F3)
1. Få et dokument til **Besvart** (utfører besvarer en mottatt sjekkliste).
2. Som godkjenner: klikk **Send tilbake**.
3. **Forventet:** dokumentet går **direkte til «Under arbeid»** hos utfører. Det finnes **ingen** «Gjenoppta»-knapp/steg, og ingen mellomstatus «Returnert».
4. **FAIL** hvis: status blir «Returnert», eller det kreves et Gjenoppta-klikk for å komme til Under arbeid.

## T5 — Samlet gjenåpne + rolle-sjekk (F4, #9)
1. Få et dokument til **Lukket** eller **Avvist**.
2. **Forventet:** **Gjenåpne** er tilgjengelig → klikk → dokumentet blir **Kladd hos oppretteren**.
3. **Rolle-sjekk (#9):** bekreft at **kun registrator + prosjektadmin** ser Gjenåpne — **bestiller skal IKKE** ha den.
4. **FAIL** hvis: gjenåpne mangler fra en avsluttet status, lander feil sted, eller bestiller ser Gjenåpne.

## T6 — Send fram + Videresend side om side (F5)
1. På et dokument i **Mottatt / Besvart / Godkjent**: se på handlingene.
2. **Forventet:** BÅDE **Send** (fram i flyten) OG **Videresend** er tilgjengelige (der rollen har dem).
3. Hold over **Videresend** → hover sier eksplisitt **«på tvers av dokumentflyter»**.
4. **FAIL** hvis: Send mangler der Videresend finnes, eller videresend-hoveren ikke nevner kryssflyt.

## T7 — Matrise ↔ hover-koherens (styrende kriterium)
1. Gå til **admin → Flyt-rettigheter → Matrise**.
2. **Forventet struktur:** ingen egen «Returnert»-seksjon (merget til «Under arbeid»); en «Avvis → Avvist»-rad; gjenåpne-rader fra Lukket/Avvist/Trukket; auto-overganger viser KUN «Sendt → Mottatt» (ingen «Mottatt → Under arbeid»-fantomrad).
3. Hold over 4–5 handlingsetiketter (Send, Besvar, Avvis, Send tilbake, Gjenåpne).
4. **Forventet:** hver hover-tittel («Handling → Ny status») + brødtekst beskriver samme overgang som raden — og samme oppførsel du så i T1–T6.
5. **FAIL / FLAGG** enhver celle der matrise-rad, hover-tekst og faktisk oppførsel ikke stemmer overens.

*(skjermbilde av matrisen + 2–3 hovers)*

## Rapportering
Per test: **PASS / FAIL** + skjermbilde. Er alt PASS, er redesignet verifisert på test. Flagg spesielt T7-avvik (koherens-brudd) og T5 rolle-sjekken (#9).
