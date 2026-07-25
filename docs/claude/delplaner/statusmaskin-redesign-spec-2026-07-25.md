# Statusmaskin-redesign — design-spec (fabel 2026-07-25, rev. 2)

TIL REPO: docs/claude/delplaner/ (erstatter rev. 1). Kilde: livssyklus-redesign-beslutninger-2026-07-25.md + Kenneth-gate av rev. 1 (fem justeringer). Krysssjekket mot kode: VALID_TRANSITIONS (`utils/index.ts`), `statusHandlinger.ts`, `perspektivEtikett.ts`, `flytmatrise-def.ts`, `flyt-rettigheter/page.tsx`. cowork gater koherensen; kode-Opus implementerer i faser (§ 8).

**Rev. 2-endringer (Kenneth-gate):** (1) trekk tilbake received→draft står uendret; (2) «Under arbeid» BEHOLDES — `rejected` («Returnert») og `in_progress` smelter til ÉN tilstand med label «Under arbeid», og Send tilbake ruter DIREKTE dit (manuell Gjenoppta var forstyrrelsen, ikke statusen); (3) soft delete = 90-dagers papirkurv med auto-hardslett; (4) alle tre gate-punktene JA (cancelled utfases, påkrevd begrunnelse ved Avvis, hard delete kun prosjektadmin); (5) **STYRENDE: intern koherens** — matrise-rad ↔ hover-tekst ↔ statusmaskin-overgang skal beskrive nøyaktig samme ting; dagens UI/kode er ikke føringen (§ 0).

## 0. Koherens-prinsippet (styrende, Kenneth)

Matrisen og hoveren er én sammenhengende beskrivelse av MÅL-statusmaskinen. Konkret krav til implementering: **én delt kilde** — `statusHandlinger.ts` utvides til å bære hele universet (handling, fra→til, roller-default, `flythjelp`-nøkkel), og BÅDE matrise-radene (`MATRISE_RADER`) og hover-tekstenes nøkler AVLEDES derfra. Da kan celle, hover og overgang ikke divergere (samme mekanikk som kvitterings-nøklingen). DoD per fase: for hver rad i matrisen finnes nøyaktig én VALID_TRANSITIONS-oppføring og én `flythjelp`-tekst som sier det samme — cowork gater trippelen, ikke tre lister.

**Drift-funn som består fra rev. 1:** D-1 «Trekk tilbake» er død i dag (`sent` persisteres aldri — handlingen flyttes til `received`); D-2 fantom-raden received→in_progress fjernes; D-3 Kenneths «Avvist» kan ikke hete `rejected` (opptatt) — enum `dismissed`.

## 1. Ny status-mengde

| Enum | Norsk etikett | Endring |
|---|---|---|
| `draft` | Kladd | uendret |
| `sent` | Sendt | uendret (transient — auto→received) |
| `received` | Mottatt | uendret |
| `in_progress` | **Under arbeid** | **MERGED tilstand** (rev. 2): dagens `in_progress` + `rejected` smelter hit. Enum-valg: `in_progress` beholdes (flest eksisterende rader + navnet matcher labelen); `rejected` UTGÅR som enum, rader migreres (§ 9) |
| ~~`rejected`~~ | ~~Returnert~~ | **UTGÅR** — absorbert i «Under arbeid» |
| `responded` | Besvart | uendret |
| `approved` | Godkjent | uendret |
| `dismissed` | **Avvist** | NY — begrunnet (påkrevd), gjenåpnbar |
| `closed` | Lukket | uendret |
| `cancelled` | Trukket tilbake | utfases som produserbar (gate-JA) — legacy-rader beholder lesbarhet + gjenåpne |
| «Slettet» | Slettet | visningsstatus fra `deletedAt` (§ 5) — 90-dagers papirkurv |

## 2. Ny VALID_TRANSITIONS

```
draft:       ["sent"]
sent:        ["received"]                            // kun auto
received:    ["responded", "sent", "draft", "dismissed"]
in_progress: ["responded", "sent", "closed"]         // Under arbeid: Besvar / Send på nytt / Lukk (+ Videresend pseudo)
responded:   ["approved", "in_progress", "sent"]     // Send tilbake → DIREKTE til Under arbeid
approved:    ["closed", "sent"]
dismissed:   ["draft"]                               // gjenåpne
closed:      ["draft"]                               // gjenåpne
cancelled:   ["draft"]                               // kun legacy-rader
```

Handling → overgang (trippelen matrise ↔ hover ↔ maskin, § 0):

| Handling | Overgang | Merknad |
|---|---|---|
| Send | draft→sent, received→sent, responded→sent, approved→sent | Paring (beslutning 6): Send overalt der Videresend finnes — gjenbruk `handling.send` |
| Send på nytt | in_progress→sent | samme fysiske overgang som Send, egen etikett/hover: fram igjen etter retting |
| Trekk tilbake | received→draft | redigerbar kladd hos avsender, før mottaker har svart (rev. 1 står) |
| Besvar | received→responded, in_progress→responded | tilbake til avsender (`sisteTransfer.senderId`) |
| Avvis | received→dismissed | begrunnelse PÅKREVD (gate-JA) |
| Send tilbake | responded→in_progress | **direkte til Under arbeid hos utbedreren — ingen Gjenoppta** |
| Godkjenn | responded→approved | uendret |
| Lukk | approved→closed, in_progress→closed | in_progress→closed arver dagens rejected→closed (avslutt uten nytt svar) |
| Gjenåpne | closed→draft, dismissed→draft, cancelled→draft | samlet; rett: registrator + prosjektadmin (§ 4) |
| Slett / Gjenopprett / Slett endelig | `deletedAt`-operasjoner, ikke overganger | § 5 |
| Videresend | pseudo `forwarded` fra received/in_progress/responded/approved | kryssflyt (eksplisitt i hover) |
| ~~Gjenoppta~~ | — | UTGÅR (forstyrrelsen, ikke statusen) |

## 3. Nye matrise-rader

Seksjoner per fra-status; `AUTO_OVERGANGER` = kun sent→received. Defaults (X = på; avledes fra delt kilde, § 0):

| Fra → til (handling) | Reg | Best | Utf | Godkj | P-adm |
|---|---|---|---|---|---|
| nytt → opprett (Opprett) | 🔒X | X | | | X |
| draft → sent (Send) | X | X | | | X |
| draft → slett (Slett, myk) | X | X | | | X |
| received → responded (Besvar) | | | X | | X |
| received → sent (Send) | | | X | | X |
| received → draft (Trekk tilbake) | X | X | | | X |
| received → dismissed (Avvis) | | | X | | X |
| received → forwarded (Videresend) | | | X | | X |
| in_progress → responded (Besvar) | | | X | | X |
| in_progress → sent (Send på nytt) | | | X | | X |
| in_progress → closed (Lukk) | | X | | X | X |
| in_progress → forwarded (Videresend) | | | X | | X |
| responded → approved (Godkjenn) | | | | X | X |
| responded → in_progress (Send tilbake) | | | | X | X |
| responded → sent (Send) | | | | X | X |
| responded → forwarded (Videresend) | | | | X | X |
| approved → closed (Lukk) | | | | X | X |
| approved → sent (Send) | | | | X | X |
| approved → forwarded (Videresend) | | | | X | X |
| lukket/avvist/trukket → draft (Gjenåpne) | X | | | | X |
| slettet → gjenopprett (Gjenopprett) | X | | | | X |
| slettet → slett endelig (Slett endelig) | | | | | X |

`sent`-seksjonen utgår (transient uten handlinger); `rejected`-seksjonen utgår (merged).

## 4. Gjenåpne (avgjort i rev. 1, står)

Rett: **registrator (oppretter) + prosjektadmin** (godkjenner-ledd kan mangle — relasjonelt prinsipp; #9: gjenåpne lander alt hos oppretter). Ruting: **kladd hos oppretter — én regel** for lukket/avvist/trukket. Slettet er unntaket: **Gjenopprett** legger dokumentet tilbake NØYAKTIG der det var (status urørt) — restaurering, ikke gjenåpning. Avvist: kun dismissed→draft + myk slett; begrunnelse ved gjenåpning valgfri (nudge).

## 5. Soft delete — 90-dagers papirkurv (rev. 2)

**`deletedAt` + `deletedById`-felt** (gate-bekreftet modell). Nytt i rev. 2: **auto-hardslett etter 90 dager** (jobb, f.eks. daglig sweep `deletedAt < now() - 90d` → `delete()`), i tillegg til manuell **Slett endelig** (kun prosjektadmin + sitedoc-bypass) før fristen. Én guard-kilde: lister/tellinger filtrerer `deletedAt IS NULL`; papirkurv-visning = inversen, med dager-igjen. Ligger i F0. cowork/kode gater teknisk (indekser, partial constraints, jobb-infrastruktur).

## 6. Mikrotekst (`flythjelp.*`) — koherent med § 2, perspektiv-etiketter i «hos dem» (beslutning 8)

| Nøkkel | Brødtekst |
|---|---|
| `send` | Flytter dokumentet ett ledd fram: fra deg til {{mottaker}}. Hos dem står det som Til behandling. |
| `sendPaaNytt` | Flytter dokumentet fram igjen: fra deg til {{mottaker}}, etter retting. Hos dem står det som Til behandling. |
| `besvar` | Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, som vurderer svaret. Hos dem står det som Til godkjenning. |
| `sendTilbakeUtforer` | Flytter dokumentet ett ledd tilbake: fra deg til {{mottaker}}, for utbedring. Hos dem står det som Under arbeid. |
| `trekkTilbake` | Henter dokumentet tilbake fra {{mottaker}} før de har begynt. Det blir redigerbar kladd hos deg — rett og send på nytt. |
| `avvis` | Avviser dokumentet med begrunnelse. Flyten stopper; {{mottaker}} ser det som Avvist med begrunnelsen din. Kan gjenåpnes. |
| `slett` (én nøkkel) | Legger dokumentet i slettede. Det kan gjenopprettes i 90 dager — deretter slettes det endelig. |
| `slettEndelig` (NY) | Sletter dokumentet permanent, før 90-dagersfristen. Kan ikke angres. |
| `gjenopprett` (NY) | Legger dokumentet tilbake der det var, med samme status som før slettingen. |
| `gjenapne` | Henter et avsluttet dokument tilbake til start: det blir kladd hos oppretteren, klart til redigering og ny sending. |
| `videresend` | Flytter dokumentet PÅ TVERS AV DOKUMENTFLYTER: ut av denne flyten, til {{mottaker}} i en annen flyt. |
| `godkjenn`, `lukk`, `opprett`, `autoMottatt` | uendret fra mikrotekst-spec rev. 2 |
| `gjenoppta`, `sendTilbake` (in_progress→sent uten svar) | UTGÅR |

Kvitteringer (`kvitteringEtikett`): `statushandling.gjenoppta`-raden fjernes; + rader for gjenopprett/slettEndelig/gjenapne-varianter der de mangler.

## 7. Perspektiv-etiketter (`perspektivEtikett.ts`)

Merged «Under arbeid» (arver `rejected`-cellenes ballinnehaver-grammatikk — § 9-konsolideringen består):

| Status | Nøytral D | Aktiv (ballinnehaver) | Venter |
|---|---|---|---|
| `in_progress` | «Under arbeid» primary | «Under arbeid» warning (din tur — dekker både førstegangsarbeid og utbedring etter retur) | «Under arbeid» primary |
| `dismissed` | «Avvist» danger | «Avvist» danger | «Avvist» danger |
| Slettet (`deletedAt`) | «Slettet» default | «Slettet» default | «Slettet» default |

`rejected`-cellene (Til revisjon/Til utbedring) UTGÅR — retur-nyansen bæres av kvitteringen «Sendt tilbake ✓» + påkrevd/nudget kommentar, ikke av en egen statusetikett. Avvist/Slettet er perspektiv-flate (ingen ball) — kun NOEYTRAL-celler + fallback. `cancelled`-cellene beholdes (legacy).

## 8. HMS-grensen (uendret fra rev. 1)

HMS (`domain="hms"`, egen maskin, `verifiserHmsHandling`, `HmsHandlingsflate`) berøres IKKE. cowork verifiserer: (a) ingen HMS-rad i `rejected` før enum-fjerning (HMS-perspektivkartet har rejected-celler — døde?); (b) `deletedAt`-guarden legges også på HMS-lister.

## 9. Migrering (test + prod)

| Dagens data | Vei |
|---|---|
| Rader i `rejected` | → `in_progress` (merged tilstand — ballen ligger alt hos utbedreren; ingen datatap) |
| Rader i `in_progress` | blir stående (tilstanden består) |
| Rader i `cancelled` | blir stående som legacy («Trukket tilbake», gjenåpne→draft); ingen nye kan oppstå |
| Hardslettede | borte — uopprettelige |

## 10. Fase-inndeling (cowork gater rekkefølgen)

| Fase | Innhold | Avhenger av |
|---|---|---|
| **F0 Soft-delete** | `deletedAt` + guard + Gjenopprett + Slett endelig + 90-dagers auto-sweep + mikrotekst | ingenting — starter nå |
| **F1 Avvist** | `dismissed` + received→dismissed + påkrevd begrunnelse + etikett + matrise-rad + mikrotekst | ingenting — starter nå (parallelt med F0) |
| **F2 Trekk tilbake → kladd** | received→draft, handlingen flyttes sent→received (D-1), mikrotekst | F1 (avvis ut av cancelled først) |
| **F3 Merge Under arbeid** | migrering rejected→in_progress, `rejected`-enum bort, responded→in_progress direkte (Send tilbake), Gjenoppta bort, fantom-rad bort, etikett-celler | F1+F2 |
| **F4 Gjenåpne-samling** | closed/dismissed/cancelled→draft, rett registrator+admin, matrise-rad, mikrotekst | F1 |
| **F5 Send/Videresend-paring** | received/in_progress/responded/approved→sent med `handling.send`/`sendPaaNytt`, matrise-rader, mikrotekst | sist — utvider fram-veiene mot ferdig maskin |

Hver fase endrer delt kilde (statusHandlinger-universet, § 0) + VALID_TRANSITIONS + i18n SAMMEN; matrise og hover avledes og kan ikke divergere. cowork gater koherens-trippelen per fase; deretter kode-Opus.
