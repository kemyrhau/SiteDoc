# Mikrotekst-spec — flyt-matrisens hover + handlingsknappenes mottaker (fabel 2026-07-25, rev. 2)

TIL REPO: docs/claude/delplaner/ (erstatter rev. 1). Anvender mikrotekst-standarden (tooltip-hjelpetekst-veileder § 3/§ 3a): hver tekst svarer på **hvor** dokumentet flytter · **hvem** får ballen · **hva** ser motparten, med relasjonelle benevnelser — aldri faste rollenavn som kan mangle.

**Rev. 2 (etter cowork-gating):** (⚠1) besvar ruter TILBAKE til avsenderen (`sisteTransfer.senderId`), ikke fram til en godkjenner — tekstene rettet, egen siste-ledd-variant; (⚠2) auto received→in_progress er ikke implementert — auto-raden fjernet (om in_progress bør auto-nås hører til livssyklus-design-gjennomgangen, backlog); (Kenneth-vedtak) ÉN delt tekstkilde `flythjelp.*` for begge flatene — ikke to parallelle nøkkelsett.

**Avhengighet:** Tooltip v2 (veileder § 2) bygges først (cowork skriver den ordren parallelt); mikrotekst-wiring venter på v2 + denne revisjonen. Nativ `title=` som bro frarådes (usynlig på mobil — pilotens viktigste flate).

---

## Delt tekstkilde — `flythjelp.*` (Kenneth-vedtak, rev. 2)

Én nøkkelfamilie begge flatene leser. `{{mottaker}}` er et **valgfritt hull**: matrisen fyller det med den relasjonelle fallback-benevnelsen (generisk — matrisen kjenner ingen konkret flyt); knappen fyller det med resolvert navn, med samme fallback når navn mangler. Knappe-hoveren er dermed AVLEDET av matriseteksten — aldri en tvilling som kan divergere.

### Handlingstekster (`flythjelp.handling.*`, nb-fasit)

| Nøkkel | Brødtekst (`{{mottaker}}` = navn eller fallback) |
|---|---|
| `opprett` | Oppretter et nytt dokument som kladd. Det ligger hos deg — kun du ser det til du sender. |
| `send` | Flytter dokumentet ett ledd fram: fra deg til {{mottaker}}. Hos dem står det som Mottatt; hos deg som Til behandling. |
| `slettKladd` | Sletter kladden din permanent. Mulig kun mens dokumentet ennå ligger hos deg — etter sending kan det bare trekkes tilbake. |
| `trekkTilbake` | Henter dokumentet tilbake fra {{mottaker}} før de har begynt. Flyten stopper; dokumentet avsluttes som Trukket tilbake hos begge. |
| `besvar` | Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, som vurderer svaret. Hos dem står det som Besvart. |
| `besvarSisteLedd` | Markerer dokumentet som Besvart og sender det tilbake til den som sendte det til deg — flyten har ingen videre ledd. |
| `avvis` | Stopper flyten: dokumentet avsluttes ubesvart, og {{mottaker}} ser det som avsluttet. |
| `sendTilbake` | Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, uten svar. Det havner i deres kø igjen. |
| `godkjenn` | Godtar svaret. Dokumentet flytter ikke videre — det står som Godkjent hos alle parter, klart til lukking. |
| `sendTilbakeUtforer` | Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, for utbedring. Legg ved kommentar så de ser hva som må rettes. |
| `gjenoppta` | Dokumentet blir hos deg og går tilbake til Under arbeid — klart for retting og nytt svar. |
| `sendPaaNytt` | Flytter dokumentet fram igjen: fra deg til {{mottaker}}, etter retting. |
| `lukk` | Avslutter flyten: dokumentet arkiveres som Lukket hos alle og flytter ikke videre. Gjenåpning krever egen rettighet. |
| `gjenapne` | Henter et trukket-tilbake dokument tilbake til start: det blir kladd hos oppretteren, klart til redigering og ny sending. |
| `videresend` | Flytter dokumentet sideveis: ut av denne flyten, til {{mottaker}} (admin-verktøy for kryssflyt). |
| `slettTrukket` | Sletter det trukket-tilbake dokumentet permanent. Flyten er alt stoppet — ingen andre parter berøres. |
| `autoMottatt` | Skjer automatisk i det dokumentet sendes: hos mottakeren registreres det straks som Mottatt. Derfor finnes ingen rolle å velge. |

### Fallback-benevnelser (`flythjelp.fallback.*` — relasjonelle, per § 3a)

| Nøkkel | Tekst | Brukes av |
|---|---|---|
| `nesteMottaker` | neste mottaker i flyten | send, sendPaaNytt |
| `avsender` | den som sendte det til deg | besvar, sendTilbake, avvis, trekkTilbake¹ |
| `utforer` | den som svarte | sendTilbakeUtforer |
| `videresendMottaker` | en person/faggruppe i en annen flyt | videresend (matrisen) |

¹ trekkTilbake: «den du sendte det til» semantisk — men avsender-nøkkelen gjelder mot-parten generisk; cowork velger `mottakerDin` («den du sendte det til») som egen nøkkel hvis gjenbruken skurrer i test.

Merk ⚠1 lukket: `fallback.godkjenner` fra rev. 1 er FJERNET — besvar-mottakeren er avsenderen (`sisteTransfer.senderId`, målt), retningen er «tilbake».

---

## Flate 1 — Matrise-hover (`dashbord/admin/flyt-rettigheter`)

### Presentasjon (målt mot `flyt-rettigheter/page.tsx` + `flytmatrise-def.ts`)

- **Én hover per rad**, på handlingsetiketten i Handling-kolonnen (`t(rad.labelNoekkel)`). IKKE per celle — cellene beholder sin egen overstyrt-tooltip (migreres fra nativ `title=` til Tooltip v2, allerede vedtatt i veileder § 2).
- Handlingsordet får **prikket understrek** (`text-decoration: underline dotted`, `text-underline-offset: 3px`, farge = etikettens gray-700 på 40 %) + `cursor-help`. Trigger får `tabindex="0"` + `aria-describedby` (Tooltip v2-kravene).
- Tooltip v2 med **tittel-linje (fet):** `{Handling} → {Ny status}` (f.eks. «Send → Mottatt»; bygges av `rad.labelNoekkel` + `flytmatrise.status.*` — ingen nye tittel-nøkler) og **brødtekst** = `flythjelp.handling.*` med `{{mottaker}}` fylt av fallback-benevnelsen. `max-width: 280px`, brytende.
- **Auto-raden** sent→received («A»-merket) får samme hover (`autoMottatt`) — forklarer hvorfor ingen rolle kan velges. Auto received→in_progress FINNES IKKE (⚠2, målt med positiv kontroll: in_progress nås kun via gjenoppta) — ingen rad, ingen tekst. Om in_progress bør auto-nås → livssyklus-design-gjennomgangen (backlog), ikke denne runden.
- **Inline vs hover: hover.** Inline ville doble matrisens høyde × ~23 rader; § 3a-teksten er setnings-lang og hører i mellomnivået (veileder § 2 nivå 2).

### Rad → nøkkel-mapping

| Rad (fra → til) | `flythjelp.handling.*` |
|---|---|
| nytt → opprett | `opprett` |
| draft → sent | `send` |
| draft → deleted | `slettKladd` |
| sent → cancelled | `trekkTilbake` |
| received/in_progress → responded | `besvar` (matrisen bruker alltid hoved-teksten; siste-ledd-varianten er en knappe-flate-sak) |
| received/in_progress → cancelled | `avvis` |
| in_progress → sent | `sendTilbake` |
| responded → approved | `godkjenn` |
| responded → rejected | `sendTilbakeUtforer` |
| rejected → in_progress | `gjenoppta` |
| rejected → sent | `sendPaaNytt` |
| rejected/approved → closed | `lukk` |
| received/in_progress/responded/rejected/approved → forwarded | `videresend` |
| cancelled → draft | `gjenapne` |
| cancelled → deleted | `slettTrukket` |
| auto sent → received | `autoMottatt` |

---

## Flate 2 — Handlingsknappene på dokumentdetaljsiden (`DokumentHandlingsmeny`, web + mobil)

### Prinsipp

Knappene sier ikke hvem handlingen går til (Kenneths funn). Data finnes allerede i komponenten — ingen API-endring. Samme `flythjelp.handling.*`-nøkler som matrisen; klienten fyller `{{mottaker}}` med resolvert navn, ellers fallback-benevnelsen.

### Presentasjon

- **Web: hover (Tooltip v2)** på primærknapp, sekundærknapper og nedtrekks-oppføringer. Tittel-linje: `{Handling} → {Ny status}`; brødtekst med navn utfylt. ~300 ms delay, `:focus-visible`-støtte.
- **Bekreft/nudge-modus** (closed/deleted/retur): brødteksten vises **inline** over kommentarfeltet (liten, gray-500) — i en bekreftelse skal konsekvensen ikke gjemmes bak hover (§ 3a på «Farlig sone»).
- **Mobil (`apps/mobile` DokumentHandlingsmeny):** samme nøkler, men **inline undertekst** i handlingsmenyen/action-sheeten (text-xs under handlingsnavnet) — hover finnes ikke, og tap-tooltip på en knapp kolliderer med selve handlingen. cowork måler plass i mobil-layouten før ordre.
- Nedtrekkets **deaktiverte rader** beholder dagens begrunnelse, men migreres fra nativ `title=` til Tooltip v2 (veileder § 2-sweep).
- **Send-oppføringene** i nedtrekket viser allerede mottakernavn (`visningsnavn`) — ingen ekstra hover der; person-radene likeså.

### tekstNoekkel → nøkkel + navn-resolusjon (klient, målt i koden)

| Handling (tekstNoekkel-suffiks) | `flythjelp.handling.*` | Navn for `{{mottaker}}` |
|---|---|---|
| send (kladd) | `send` | `videresendValg[0].visningsnavn` kun ved entydig valg; ellers fallback (nedtrekket navngir uansett) |
| slett | `slettKladd` / `slettTrukket` etter status | — |
| trekkTilbake | `trekkTilbake` | `finnMottakerNavn(flytMedlemmer, recipientUserId, recipientGroupId)` |
| besvar | `besvar`; ved `erSisteBoks` → `besvarSisteLedd` | avsenderen: `ledd[aktivtIndex - 1]?.navn`, ellers fallback `avsender`. ⚠ wiring: målt server-ruting er `sisteTransfer.senderId`; cowork verifiserer at klientens `mottakerForStandard()`-parameter på responded ikke overstyrer/motsier målt ruting — hvis den gjør det, er DET en egen kodefeil-sak, ikke tekst |
| avvis | `avvis` | `ledd[aktivtIndex - 1]?.navn` |
| sendTilbake | `sendTilbake` | `ledd[aktivtIndex - 1]?.navn` |
| godkjenn | `godkjenn` | — |
| sendTilbakeUtforer | `sendTilbakeUtforer` | `finnMottakerNavn` mot forrige mottaker hvis tilgjengelig, ellers fallback `utforer` |
| gjenoppta | `gjenoppta` | — |
| sendPaaNytt | `sendPaaNytt` | `ledd[aktivtIndex + 1]?.navn` |
| lukk | `lukk` | — |
| gjenapne | `gjenapne` | — |
| videresend | `videresend` | valgt oppførings `visningsnavn`; generisk fallback `videresendMottaker` på selve Send-knappen |

---

## Avgrensning + DoD

- Ingen tekst hardkodes i komponentene — alt via `flythjelp.*`; øvrige språk oversettes fra nb-fasiten. Rev. 1-familiene `flytmatrise.handlinghjelp.*` / `statushandling.hjelp.*` UTGÅR (aldri implementert — ingen migrering).
- `title=` innføres IKKE som bro (veileder-forbud); flatene venter på Tooltip v2 (egen cowork-ordre, parallell).
- HMS-dokumenter (`domain="hms"`, egen handlingsflate `HmsHandlingsflate`) er UTENFOR — eget spor (hms-flyt-design-2026-07-24).
- Backlog-avlevering: «bør received→in_progress auto-nås?» → livssyklus-design-gjennomgangen.
- DoD: besvar-wiring-⚠ (over) avklart; tastatur (`:focus-visible`) og touch verifisert på begge flatene; ingen gjenværende nativ `title=` på de to flatene; én delt tekstkilde — ingen tvilling-nøkler.

cowork gater + skriver kode-ordre.
