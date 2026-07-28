---
name: p2-inndata-validering-verifiseringslogg
status: 🔵 Ledd 1 nå-sjekk ferdig 2026-07-28 — venter gate før koding (Ledd 2)
eier: Opus C (utførende) · cowork (gate + sekvensering)
branch: feat/p2-inndata-validering
ordre: delplaner/p2-inndata-validering-ordre.md
sist_verifisert_mot_kode: 2026-07-28
---

# P2 Inndata-validering — verifiseringslogg

Statuskilde for P2-arbeidet. Nå-sjekk (Ledd 1) er MÅLING mot kode, ingen endring.

## Ledd 1 — nå-sjekk (2026-07-28, målt mot `feat/p2-inndata-validering` @ origin/develop `cc8c1d80`)

### MP1 — Statusverdier «Send tilbake» og «Besvar» produserer i dag
| Handling | tekstNøkkel | overgang | nyStatus | Enekilde til nyStatus? |
|---|---|---|---|---|
| Besvar | `statushandling.besvar` | received→responded, in_progress→responded | `responded` | Ja — kun Besvar produserer `responded` |
| Send tilbake | `statushandling.sendTilbakeUtforer` | responded→in_progress (F3) | `in_progress` | Ja — kun Send tilbake produserer `in_progress` |
| Avvis | `handling.avvis` | received→dismissed | `dismissed` | Ja (allerede dekket) |
| Videresend | `statushandling.videresend` | →`forwarded` (pseudo) | `forwarded` | Utenfor — skal IKKE kreve kommentar |
| Send / Send på nytt | `handling.send` / `statushandling.sendPaaNytt` | →`sent` | `sent` | Utenfor |

Kilder: `packages/shared/src/utils/statusHandlinger.ts:27,44-56`, `index.ts:108-126` (validTransitions).
F3-migrering bekreftet: `20260725130000_merge_underarbeid_rejected` (rejected→in_progress som data).

**Konklusjon:** `statusKreverBegrunnelse(nyStatus)` kan skille rent på `nyStatus` alene.
Utvidelse = legg til `responded` + `in_progress` (i tillegg til `dismissed`). Ingen kollisjon —
ingen godartet handling produserer `responded`/`in_progress`. Rot-årsak i delt kilde holder.

### MP2 — flytRolle-premiss (tilgangskontroll ≠ inndata-validering)
Vedtakets sitat `flytRolle.ts:191 (if (!harBallen) return "leser")` har drevet: linje 191 =
destrukturering i `utledDokumentRettighet`; selve `!harBallen → "leser"`-gaten står nå på
**`packages/shared/src/utils/flytRolle.ts:207`**. Premiss HOLDER: tilgangskontroll (harBallen)
finnes og er en egen funksjon, adskilt fra inndata-validering (statusKreverBegrunnelse + Zod-gate
i routes). **P2 rører den ikke.**

### MP3 — Mobil-overlapp mot A (del6b) — feil fil i ordre-premisset
- Kommentarfelt-dialogen på mobil ligger IKKE i `OppgaveModal.tsx` (det er oppgave-OPPRETTELSE —
  null status/kommentar/nyStatus). Status-handlingsdialogen med kommentarfelt + disabled-send ligger i
  **`apps/mobile/src/components/DokumentHandlingsmeny.tsx`** (leser `statusKreverBegrunnelse` @ 161, 461).
- A rørte `OppgaveModal.tsx` (`98162b07` del6b-fase1). A rørte IKKE mobil `DokumentHandlingsmeny.tsx`
  (siste commits der: F1/Kloss2/Fase-A-B statusmaskin — ikke del6b).
- **→ P2s mobil-endring har ingen fil-kollisjon med A/del6b sin OppgaveModal.** Om A/del6b-branchen
  (`53c7cbd8`, ikke synlig herfra) også rører `DokumentHandlingsmeny.tsx` må cowork bekrefte.
  **Cowork eier sekvenseringen.**

### Bonusfunn (påvirker scope)
- **Plumbingen finnes allerede:** delt kilde (`index.ts:139`) + server (`sjekkliste.ts:1081`,
  `oppgave.ts:1226`) + web-UI (`web/DokumentHandlingsmeny.tsx:432`) + mobil-UI
  (`mobile/DokumentHandlingsmeny.tsx:161,461`) — ALLE leser `statusKreverBegrunnelse` og disabler
  send til kommentar er fylt. → Kommentar-kravet = utvid RETURSETTET i shared; UI/server arver auto.
- **kontrollplan.ts er UTENFOR scope:** eget status-domene (`planlagt/pagar/utfort/godkjent` for punkt;
  `utkast/aktiv/godkjent/arkivert` for plan). Ingen Besvar/Send tilbake/Avvis, bruker ikke
  `statusKreverBegrunnelse`. Ingen endring der.
- **Tom-besvarelse er en SEPARAT mekanisme** (kan ikke uttrykkes via `statusKreverBegrunnelse` som kun
  kjenner `nyStatus`): felt lagres via `oppdaterData` (`sjekkliste.ts:489`); status flippes via
  `endreStatus`→responded (`sjekkliste.ts:828`). Guard «min ett utfylt felt» må ligge i endreStatus-stien
  når nyStatus=responded, laste feltverdier, avvise hvis alt tomt. Gjenbrukbar helper finnes:
  `harFeltVerdi(verdi)` (`feltLaasing.ts:28`). Feltmodell ulik per doktype (sjekkliste=ChecklistItemValue,
  oppgave=data-blob) → guard henter riktig kilde per type, avgjørelse «≥1 fylt» sentraliseres i shared.
- Test `statusHandlinger.test.ts:234` («kun dismissed») ENDRES bevisst (→ responded+in_progress), ikke omgås.

## Ledd 2 — koding (FERDIG 2026-07-28, venter build-verifisering + gate)

Kenneth-vedtak valg **B**: «utfylt felt» = `verdi` ELLER `kommentar` ELLER `vedlegg`.

### Delt kilde (`packages/shared`)
- `statusKreverBegrunnelse` (`utils/index.ts`): utvidet fra `{dismissed}` til `{dismissed, in_progress, responded}` (Set). Videresend(`forwarded`)/Send(`sent`) utenfor.
- `feltLaasing.ts`: nye eksporter `IKKE_UTFYLLBARE_FELTTYPER` (`heading, subtitle, location, drawing_position, calculation`), `erUtfyllbartFelt`, `feltErBesvart` (valg B), `harMinstEttUtfyltFelt(felter, data)`. Helperen bruker malen kun til å avgjøre OM noe er utfyllbart; «har svart» går mot `Object.values(data).some(feltErBesvart)` → robust mot nestede/repeater-nøkler. Malen uten utfyllbare felt → tillat (ingen falsk blokkering).
- Barrel `utils/index.ts:59` re-eksporterer de nye helperne.

### Server (autoritativ)
- `sjekkliste.ts` + `oppgave.ts` `endreStatus`: (1) begrunnelse-guard arver auto (delt kilde) — feilmelding gjort generisk («…for denne handlingen»); (2) ny tom-besvarelse-guard: `nyStatus === "responded" && !harMinstEttUtfyltFelt(template.objects, data)` → BAD_REQUEST. La `objects:{id,type}` i `template`-include (scalars fulgte allerede med).
- kontrollplan: UT (eget status-domene, bekreftet Ledd 1).

### UI (speiler, innholds-agnostisk komponent + beregning på flaten)
- `DokumentHandlingsmeny` (web+mobil): ny prop `besvarDeaktivertGrunn?: string | null`. Deaktiverer Besvar-primærhandlingen + viser grunn (web: tooltip; mobil: undertekst). Komponenten får IKKE `data`/`objects` — beslutningen kommer fra flaten.
- Kommentar-krav (Besvar/Send tilbake/Avvis): arver automatisk fra delt `statusKreverBegrunnelse` (send-knapp disabled til kommentar fylt) — ingen ny UI-wiring.
- Flate-beregning av `besvarDeaktivertGrunn` (samme delte helper alle 4 flater):
  - **Web** (sjekkliste + oppgave): fra LAGRET `sjekkliste.data`/`oppgave.data` → eksakt server-paritet, ingen debounce-race-falsk-avvisning (web autolagrer 2s). Bonus: beskytter mot pre-eksisterende fyll-så-besvar-datatap.
  - **Mobil** (sjekkliste + oppgave): fra LOKAL svar-tilstand (`hentFeltVerdi` per objekt) — offline-first, umiddelbar for feltarbeideren. Fyll → Lagre → Besvar.
- i18n: ny nøkkel `statushandling.laast.tomBesvarelse`, nb+en manuelt, 13 språk auto-generert (1 linje/fil, ingen mass-rewrite).

### Test
- `statusHandlinger.test.ts`: gammel «kun dismissed» erstattet; nye describe-blokker for kommentar-klassen (responded/in_progress/dismissed true; forwarded/sent false) + `harMinstEttUtfyltFelt`/`feltErBesvart`/`erUtfyllbartFelt`. **376 shared-tester grønne.**

### Ledd 3 — web-bevis (lokal dev) fanget TO reelle bugs (fikset)
Bevis-oppsett: lokal dev (`NODE_ENV=development` + `tsx --env-file`), dev-login-cookie som test-arbeider (utfører m/ball), seedet received-sjekkliste. Bevis i `SiteDoc/p2-bevis/` (p2-web-01…04).

1. **Web-hookene projiserte bort `data`** (`useSjekklisteSkjema`/`useOppgaveSkjema` returnerte et utvalg UTEN svar-blobben) → `besvarDeaktivertGrunn` leste `undefined` → **Besvar PERMANENT deaktivert på web**, også når dokumentet var utfylt. Fiks: eksponer `data` i begge hookenes retur + type.
2. **Besvar (responded) rutet ikke gjennom kommentar-dialogen** — web `NUDGE_TEKSTNOEKLER` hadde bare Send tilbake + Avvis; Besvar fyrte direkte → serveren ville avvist «begrunnelse påkrevd» uten at UI ba om den. Fiks: `klikk()` åpner bekreftelses-dialogen for ENHVER `statusKreverBegrunnelse`-status (Besvar/Send tilbake/Avvis).
3. **Mikrotekst genericisert:** `statushandling.begrunnelsePaakrevd`/`begrunnelsePlaceholder` var avvisning/retur-spesifikke («…ved avvisning», «Begrunnelse for retur») — dialogen tjener nå alle tre handlinger → «Begrunnelse er påkrevd» / «Skriv en begrunnelse…». nb+en + regenerert 13 språk (slettet+regenererte de 2 endrede nøklene siden generate.ts er additiv).

**Bevis (web, 4 skjermbilder):** 01 tom → Besvar deaktivert + tooltip «Fyll ut minst ett felt for å besvare»; 02 utfylt → Besvar åpner dialog «Begrunnelse er påkrevd» + send-knapp deaktivert; 03 kommentar skrevet → send-knapp aktiv; 04 Avvis-dialog samme påkrevd-kommentar (rejection-klassen). Mobil-bevis utestående (A holder simulatoren; ruter til Kenneths re-test — mobil `DokumentHandlingsmeny` viser samme via `visBekreftelse`-modal + undertekst).

### Build/typecheck-status
- shared test ✅ 376/376 · api typecheck+build ✅ · web typecheck+build ✅ (etter follow-up-fikser).
- **Mobil typecheck**: feiler KUN på pre-eksisterende gjeld utenfor min diff (`erstattVedlegg` hook-type-mismatch i `useOppgaveSkjema`/`useSjekklisteSkjema`, `timerSync`, `psi`, `hjem`). Mine tre mobil-filer gir NULL typecheck-feil. Bekreftet: ingen av de feilende filene er i min diff.
- Fresh worktree krevde `pnpm install --frozen-lockfile` + `prisma generate` (4 db-pakker) for å typecheck'e — ingen nye pakker/schema-endring.
