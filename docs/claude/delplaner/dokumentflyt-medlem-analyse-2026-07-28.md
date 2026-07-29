# Fabel-analyse — dokumentflyt: medlemsvisning + medlemsregistrering (2026-07-28)

> Kenneth-bestilling 2026-07-28 (skjermbilder test.sitedoc.no): (1) flytboksene tar for mye plass med flere medlemmer; (2) kobles medlem opprettet direkte i dokumentflyt riktig til brukergruppe/kontakter? Kodeverifisert mot `apps/web/.../produksjon/dokumentflyt/page.tsx`, `_components/dokumentflyt-komponenter.tsx`, `apps/api/src/routes/medlem.ts`. Hører hjemme i del 8 (dokumentflyt-redesign) — dette er forarbeid.

## Funn A — registrering fra flytboksen er ufullstendig kobling [MÅLT]
`InviterNyMedlemModal` (dokumentflyt-komponenter.tsx:233-) kjører to mutasjoner: `medlem.leggTil` → `dokumentflyt.leggTilMedlem`. Kallet sender `faggruppeIder: []` og **ingen `organizationId`**.

Server (`medlem.ts:116-315`):
1. `OrganizationMember` upsertes KUN hvis `input.organizationId` er satt (linje ~195). Admin-flyt sender den ikke → **ny bruker får ingen firma-tilknytning**. (Firmaansvarlig-stien tvinger egen org — den er OK.)
2. **Ingen `Group`-kobling finnes i det hele tatt** i `leggTil` — brukergruppene i Kontakter («Sitedoc Ansatte» osv.) er en separat modell som aldri røres. Personen står derfor gruppe-løs i Kontakter etter flyt-invitasjon.
3. Faggruppe: tom liste sendes → ingen faggruppe.

**Konsekvens:** Kenneths opplevde «ulogisk» er reell dobbeltregistrering: flyt-invitasjon gir et halvt medlem (bruker + prosjekt + flyt-rolle, men uten firma/gruppe/faggruppe); Kontakter-invitasjon gir medlem uten flyt-rolle. Ingen av veiene er komplett.

**Kollisjon med PM-sporet:** PM-vedtaket «firma påkrevd ved onboarding» gjør funn A.1 til en regelbrudd-produsent — flyt-invitasjon blir en bakdør som lager firma-løse brukere. Fiksen bør sekvenseres MED/FØR PM-byggeordren.

## Anbefaling A — én registreringsvei, kontekst-tilpasset
- **Rotårsak:** det finnes to opprettelses-UI-er med ulik dekning. Behold ÉN delt invitasjonsmodal (samme komponent begge steder) som alltid tar: e-post/navn → firma (påkrevd, forhåndsvalgt = inviterers firma) → brukergruppe (forhåndsvalgt fra kontekst) → faggruppe (valgfri). Åpnet fra flytboksen forhåndsutfylles i tillegg flyt+rolle; åpnet fra Kontakter forhåndsutfylles gruppen.
- Server: `medlem.leggTil` utvides med `groupId?` og gjøres firma-krevende (i takt med PM-interim). Gruppe-kobling gjøres i samme transaksjon.
- Svar på Kenneths «bruker eller direkte i flyt?»: **direkte i flyt skal være trygt** — det er samme vei med mer forhåndsutfylling, aldri en snarvei som hopper over koblinger.

## Funn B — flytboksens plassbruk [MÅLT]
`FlytBoks` rendrer én full rad per medlem (radio + ikon + navn + kilde-tekst + «Redigerer»-knapp) + «+ Legg til». Med grupper OG enkeltpersoner (skjermbilde: Bestiller med Sitedoc Ledelse + kmy + Kenneth Myrhaug) vokser boksen vertikalt og drar hele flyt-raden med seg; 4 roller × N medlemmer skalerer ikke.

## Anbefaling B — kompakt boks + detaljer på forespørsel
Mockup: `Dokumentflyt Flytboks Utforsking.dc.html` (1a/1b).
- **1a Kompakt chip-boks:** boksen viser grupper som chips m/antall og personer som avatar-stack (+N); klikk på boksen åpner popover med full liste + Legg til/Rediger. Flyt-raden får fast, lav høyde.
- **1b Detalj-modal:** boksene viser kun oppsummering (2 grupper · 3 personer); all administrasjon (legg til, fjern, hovedansvarlig, inviter ny) samles i én modal per flyt med alle fire rollene side ved side — samme redigeringsflate som i dag, bare flyttet ut av listen.
- Anbefaling: 1a for lesbarhet i listen, 1b-modalen som redigeringsflate — de kombineres (chip-boks klikk → modal).

## Ruting
- Funn A = funksjonell mangel → egen fiks-ordre (develop/cowork-nær, ikke ren redesign-flate); sekvenseres mot PM-interim.
- Funn B = del 8-design → inn i del 8-nå-rapporten når den bestilles; mockupen er forarbeid.
