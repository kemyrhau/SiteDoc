# Ordre: én fargetabell for dokumentstatus — web og mobil

**Til:** redesign (cowork klargjør worktree og relayer) · **Fra:** design · **Dato:** 2026-09-19
**Spor:** cowork avgjør. **Branch-forslag:** `fix/statusfarger-paritet` fra `origin/develop`.
**Grunnlag:** `docs/redesign/designnotat-statusfarger-paritet-design-2026-09-19.md` — **les § 1–3 og vedtaket i § 8.**

---

## Kort

Fire kilder viser dokumentstatus ulikt. Etter denne runden leser **alle** fra `perspektivEtikett` i `@sitedoc/shared`:
lister nøytralt, detaljsider personlig. Mobil mister indigo og lilla og får «din tur» i gult på detaljsiden, slik web
har. `in_progress` heter «Under arbeid» overalt (Kenneth 2026-09-19 — overstyrer Runde-2 fra 2026-08-02).

## Fasit (fra NOEYTRAL-kolonnen, uendret der den står)

| Status | Nøytral (lister, filtre, tidslinjer) | Personlig, ballen din (detaljside) |
|---|---|---|
| draft | grå · Utkast | grå · Utkast |
| sent | blå · Sendt | – |
| received | blå · Mottatt | **gul** · Til behandling |
| in_progress | blå · **Under arbeid** | **gul** · Under arbeid |
| responded | blå · Besvart | **gul** · Til godkjenning |
| approved | grønn · Godkjent | grønn |
| dismissed / rejected | rød · Avvist | rød |
| closed | grå · Lukket | grå |
| cancelled | rød · Avbrutt | rød |

Personlig kolonne for «venter»-perspektivet og HMS: som `perspektivEtikett` har dem i dag — ingen endring.

## Steg 0: mål før du bygger (meld i leveransen)

1. **Hvor vises dokumentstatus?** List alle steder på web og mobil som viser status, filtrerer på status eller viser
   status i en tidslinje — og hvilken kilde de bruker i dag. Kjente: `packages/ui/src/status-badge.tsx`,
   `apps/mobile/src/components/StatusMerkelapp.tsx` (+ `StatusFilterRad`), web-listene
   `[prosjektId]/oppgaver/page.tsx`, `[prosjektId]/sjekklister/page.tsx`, `paneler/OppgaverPanel.tsx`,
   `paneler/SjekklisterPanel.tsx`, `hms/firma-hurtig-modal.tsx`.
2. **Filterknapper:** der `received` og `in_progress` i dag er slått sammen til én «Mottatt»-knapp, blir de to knapper:
   «Mottatt» og «Under arbeid». Meld hvert sted.
3. **Mobil detaljside:** har `app/oppgave/[id].tsx` og `app/sjekkliste/[id].tsx` dataene `utledPerspektiv` trenger
   (seerens rolle og om den har ballen), slik web-detaljsidene har? **Mangler data fra API-et: stopp og meld før du
   endrer server-kode.**

## Endringer

### A. Shared
1. Eksporter et nøytralt oppslag fra `perspektivEtikett.ts` (f.eks. `noeytralEtikett(status)`), med samme fallback
   som i dag. **Ingen celle i tabellene endres** — fasiten over er det som står.

### B. Web
2. `packages/ui/src/status-badge.tsx`: dokumentstatusene (tabellen over) utledes fra det nøytrale oppslaget, ikke fra
   den egne tabellen. **Ikke-dokumentstatusene** (`active`, `archived`, `completed`) beholdes som de er.
   Kommentaren om Runde-2 (`in_progress` → «Mottatt») erstattes med en peker til designnotatet § 8.
3. Web-listene og filtrene fra steg 0: `in_progress` viser «Under arbeid», egen filterknapp.

### C. Mobil
4. `STATUS_MAP` i `StatusMerkelapp.tsx` utledes fra det nøytrale oppslaget, med en liten oversettelse fra variant
   (`default/primary/success/warning/danger`) til NativeWind-klasser — **samme fem farger som web-`Badge`**
   (`gray/blue/green/yellow/red`, 100-bakgrunn og 700/800-tekst). Indigo og lilla forsvinner. Legg oversettelsen og
   utledningen i en ren `.ts`-fil så den kan testes i mobil-harnessen.
5. `StatusFilterRad`: egne knapper for «Mottatt» og «Under arbeid» (steg 0.2).
6. Detaljsidene `app/oppgave/[id].tsx` og `app/sjekkliste/[id].tsx` bruker `perspektivEtikett` med seerens perspektiv,
   som web-detaljsidene. Forutsetter at steg 0.3 er grønt.

**Timer-statusene** (`TimerStatusMerkelapp`, web `timer/StatusBadge`) røres ikke.

## Paritetsmatrise

| | Web | Mobil-app | Arkiv-PDF |
|---|---|---|---|
| Liste / filter / tidslinje (nøytral) | ✅ B.2–3 | ✅ C.4–5 | ❌ gjelder ikke — PDF viser status som tekst, ikke merkelapp |
| Detaljside (personlig) | ✅ uendret | ✅ C.6 | ❌ gjelder ikke — PDF er ikke seer-relativ |

## Funksjonsinventar

| Kodevei | Vedtak |
|---|---|
| `perspektivEtikett`-tabellene | **BEVART** — ingen celle endres, bare en eksport legges til |
| «Lest»-grenen i `StatusBadge`/`StatusMerkelapp` | **BEVART** (bruker `title=` — egen oppfølger, ikke her) |
| Ikke-dokumentstatuser i `StatusBadge` | **BEVART** |
| Filtrering på `received`/`in_progress` | **ENDRET** — to knapper i stedet for én (Kenneth-vedtak) |
| Timer-statuser | **BEVART, ikke rørt** |

Finner du en annen funksjon i disse kodeveiene som ordren ikke nevner: stopp og meld.

## Tester

- **Paritetstest (obligatorisk):** for hver dokumentstatus i fasiten gir web-`StatusBadge` (nøytral) og mobil-oppslaget
  **samme i18n-nøkkel og samme variant** som det nøytrale oppslaget. Rød først (mot dagens indigo/lilla og gul
  `responded`).
- `perspektivEtikett.test.ts`: frosne rader uendret — skal fortsatt være grønn uten endring.
- Gate-tall `unit-mock · unit-ren · integrasjon · e2e`. Web build, mobil typecheck, `pnpm test` fra rot.

## DoD

1. Steg 0 meldt.
2. Endringer A–C, paritetstesten grønn.
3. **Tekstbevis:** en tabell generert fra koden (f.eks. en test som skriver den ut) med status → nøkkel + variant for
   web-liste, mobil-liste og mobil-detalj (aktiv/venter/nøytral). Ingen skjermbilder.
4. Leveranse nederst i `relay/inbox-design.md` + «design har post» til Kenneth. Design svarer «Designgatet – klar for
   merge» eller «Avvik: …».

## Utenfor

Nye statuser · statusoverganger · timer-statuser · PDF · «Lest» og `title=` · fargeverdiene i `Badge` (tokenrydding).
