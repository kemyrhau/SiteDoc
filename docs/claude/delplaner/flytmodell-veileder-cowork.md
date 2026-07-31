# Veileder til cowork: Dynamisk posisjonsmodell for dokumentflyt

**Fra:** fabel · **Godkjent av:** Kenneth 31.07.2026 · **Status:** vedtatt modell, klar for teknisk planlegging
**Gjelder:** sjekkliste + oppgave, server + web + mobil
**Prototype (fasit for oppførsel):** `Flytmodell Prototype.dc.html` · design: `Mobil Detalj Redesign.dc.html` turn 2 (2a–2d)

---

## 1. Bakgrunn — funnet 31.07

Kenneths mobiltest (sjekkliste, flyt 1 registrator → 2 bestiller → 3 utfører → 4 godkjenner, samme person i alle ledd) viste:

- Send hoppet over bestiller (ledd 2) — rett til utfører
- Besvar sendte ballen **bakover** til forrige avsender (bestiller), ikke til godkjenner
- Godkjenn dukket opp som førstevalg hos bestiller; dokumentet ble godkjent **uten at godkjenner (ledd 4) noen gang hadde ballen** — og uten spor av det
- Kenneth: «vi sender til hardkodede flytbokser basert på navn → vi burde ha sendt til flytbokser basert på faktisk rekkefølge»

### Rotårsaker i dagens kode (verifisert)

| Sted | Problem |
|---|---|
| `apps/api/src/routes/sjekkliste.ts` ~1117 (og `oppgave.ts` ~1261) | Besvar: `besvarMottaker = sisteTransfer.senderId` — historikk-basert, aldri flytens rekkefølge |
| `sjekkliste.ts` ~1006 (og oppretting ~380) | Send/flytbytte: mottaker hardkodet fra `erHovedansvarlig` på `rolle: "utforer"` |
| `sjekkliste.ts` 1241/1295/1349 (og `oppgave.ts` 1387/1441/1495) | Godkjenn/retur/lukk: mottaker hardkodet = `bestillerUserId` |
| `apps/web/src/lib/flyt-ledd.ts` (`forventetRolleKandidater`) | Klient speiler samme hardkodede status→rolle-antagelse; filheader merker selv sekvenseringen som *interim* |
| `apps/mobile/src/utils/dokumentflyt-ledd.ts` | Parallell kopi av samme logikk — MÅ endres i samme runde (jf. mobil-paritet-lærdom 30.07) |
| Datamodell | `dokumentflytMedlem.steg` er ikke populert (alle = 1) — faktisk rekkefølge finnes ikke i data |

Rutingen konsulterer altså **aldri** dokumentflytens leddrekkefølge. Riktig oppførsel oppstår kun når flyten tilfeldigvis matcher kanonisk rollerekkefølge med distinkte personer. Pilot-blokkerende: med distinkte personer blir bestiller sittende med ballen på `responded` uten gyldige handlinger, og godkjenner varsles aldri.

---

## 2. Vedtatt modell (Kenneth 31.07)

### 2.1 Posisjon er rutingsannheten

Et dokuments flyt er en **ordnet liste av ledd** (posisjon 1..N). Antall ledd er dynamisk — rutingen teller ledd, aldri rollenavn.

### 2.2 Tre retninger

| Handling | Regel |
|---|---|
| **Send →** | Neste ledd i flyten som kan holde ballen. Fra **siste** ledd finnes ingen neste → handlingen ER «Godkjenn og fullfør» (ingen spesialkode for «bestiller sist») |
| **Besvar ←** | Nærmeste ledd **bakover med kontroll-ansvar**. Rene «Orienteres»-ledd hoppes over (vedtak 31.07: vi stoler på at involverte sender riktig; admin rydder) |
| **Videresend ↔** | På tvers av flyten. Synlig kun for de med rettighet (H3-mønsteret finnes) |

«Orienteres»-ledd kan **aldri** holde ballen — de får varsel og lesetilgang.

### 2.3 Status avledes — settes aldri direkte

Lagrede fakta: **posisjon** (aktivt ledd), **retning** (siste bevegelse: frem/tilbake/på tvers), **terminal** (godkjent/avvist/lukket/null), **sendt** (har forlatt ledd 1) + transferloggen (finnes).

```
avledStatus(posisjon, retning, terminal, sendt):
  terminal          → "«Terminal-etikett» hos N · X"   (Godkjent/Avvist/Lukket hos 4 · Kontroll)
  !sendt            → "Utkast"
  retning = tilbake → "Besvart — hos N · X"
  ellers            → "Hos N · X"
```

- Dagens status-enum i DB **beholdes som avledet cache** (rapporter/filtre/API), men skrives KUN av én delt `avledStatus`-funksjon — aldri direkte av endepunktene. Da kan status og posisjon aldri divergere (dagens feilklasse).
- `terminal` er et **åpent felt**, ikke en tilstandsmaskin: ny tilstand senere (f.eks. «Parkert») = ny verdi + etikett + evt. gjenåpningsregel. Ruting, posisjon og logg røres ikke. Godkjent-dokument blir *liggende hos siste ledd* i historikken (løser «ble på en måte lukket»-funnet).
- `isValidStatusTransition` (rolle×status-matrise) erstattes av retningsregler: hvem kan sende →, ← og ↔ fra hvert ledd, styrt av leddets ansvar. `perspektivEtikett` beholdes for seer-relativ visning — den får riktigere input.

### 2.4 Gjenåpne-regel (Kenneth 31.07)

1. Ballen går til **åpnerens eget ledd**
2. Åpner ikke medlem av leddet dokumentet ligger hos → **nærmeste ledd åpneren er medlem av** (Orienteres-ledd kan ikke motta — da nærmeste kontroll-ledd)
3. Åpner utenfor flyten (admin) → dokumentet gjenåpnes **i samme boks**

### 2.5 Flytboksenes navn (vedtak-kandidat 2d-B)

Rollenavn fjernes som brukervendt identitet. Hver boks viser: **posisjonsnummer + hvem (person/faggruppe) + ansvarsmerke** valgt ved flytoppsett («Bestiller arbeid», «Kontrollerer avvik», «Godkjenner økonomi», «Utfører», «Orienteres»). Internt beholdes rolle kun som rettighetsmal bak merket. Begrunnelse: «Bestiller» midt i flyten er en mellomgodkjenner (avvik, ikke økonomi) — fast rollevokabular lover feil ting og tolkes ulikt.

---

## 3. Krav til implementasjon (kvalitet fremfor tempo)

1. **Rotårsaksfiks, ikke plaster:** ruting skal gå gjennom ÉN delt utledning («neste ledd» / «forrige kontroll-ledd») i `@sitedoc/shared`, brukt av server, web og mobil. Ingen av dagens tre hardkodede rutingveier overlever.
2. **Datamodell først:** populer reell rekkefølge (`steg`/posisjon) på `dokumentflytMedlem` + ansvarsmerke per ledd. Migrering for eksisterende flyter: kanonisk rollerekkefølge som utgangspunkt (dagens interim-antagelse blir engangsmigrering).
3. **Én statuskilde:** `avledStatus` i shared; endepunktene skriver fakta (posisjon/retning/terminal), aldri status.
4. **Mobil-paritet i samme runde:** web `flyt-ledd.ts` og mobil `dokumentflyt-ledd.ts` konsolideres mot shared-utledningen (fil-headeren i flyt-ledd.ts forutsetter allerede dette byttet).
5. **Tester:** retningsregler (inkl. Orienteres-hopp, siste-ledd-godkjenning, gjenåpne-reglene) som delte enhetstester; e2e for Kenneths testsekvens 31.07 med distinkte personer.
6. **Verifiser mot prototypen:** `Flytmodell Prototype.dc.html` er oppførselens fasit — de tre forhåndsvalgene (standard 4 ledd / med Orienteres / bestiller sist) skal gi identisk logg.

## 4. UI-konsekvenser (bygger på M1–M3, ikke om igjen)

Posisjonsmodellen koster null ekstra plass mot merget M1–M3-design — kun *tekstinnholdet* endres:

- Flytlinje i header: nummer + hvem (ansvarsmerke bor i flyt-sheeten 1c)
- Primærknapp: «Send til N · X →» / «Godkjenn og fullfør ✓» (siste ledd)
- Besvar ←, Avvis, Lukk: split-▾-menyen (som 1b)
- Statuschip: avledet status («Hos 4 · Kontroll»), + «Du har ballen»-mikrotekst

## 5. Åpne punkter (avklares før/under implementering)

- Endelig ordliste for ansvarsmerker + flytoppsett-UI (hvor velges merket?)
- Varslingsregler for Orienteres-ledd (når varsles de — hver bevegelse eller kun terminal?)
- Rettighetsmatrise-detaljer: hvilke ansvar gir ← og ↔
- Forholdet til F6-snarveien (direkte godkjenn fra Mottatt i flyt uten utfører) — trolig overflødig i posisjonsmodellen (kort flyt gir samme resultat naturlig)
