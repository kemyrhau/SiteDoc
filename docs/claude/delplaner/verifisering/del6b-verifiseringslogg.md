---
name: del6b-verifiseringslogg
status: 🟢 Fase 2 fabel-godkjent + sim-verifisert (2026-07-28) — klar til merge (A merger sist, regenererer i18n). Branch `feat/del6b-fase2-mobil`
eier: Kenneth (mobiltest) · cowork (måling + gate) · fabel (design-call) · Opus A (bygging)
sist_verifisert_mot_kode: 2026-07-28
---

# del 6b verifiseringslogg

Sjekklister / Oppgaver / HMS / Kontrollplan — mobil-løft. Grunnlag: nå-rapport
`naa-rapport-del6b-sjekklister-oppgaver-hms-2026-07-16.md` + fabel-ordre
`delplaner/del6b-fase2-ordre.md`.

## Fase 1 (web) — lukket 2026-07-16

FilterPanel bygget som delt filterkilde; døde elementer fjernet/koblet;
print-grense løftet; mal-dualitet copy+kryss-lenker; i18n 35 nøkler × 13 språk;
arbeidsforlop-rename i OppgaveModal. Commits `98162b07`/`dde5a729`/`8f2a0892`.
(Detaljert logg lå i fase 1-treet; kun oppsummert her — denne fila ble opprettet
ved fase 2 dok-sync.)

---

## Fase 2 (mobil-løft) — fabel-godkjent 2026-07-28

**Branch:** `feat/del6b-fase2-mobil`. **Commits:**
- `ee7d4e3e` — filter (status klient + byggeplass global) på sjekkliste/oppgave-lister · opprett-vei fra oppgave-lista · HMS-mobil (3 subdomain-faner + opprett) · kontrollplan-mobil KUN lese · i18n rørte filer + OppgaveModal · delt `StatusFilterRad`
- `53c7cbd8` — `StatusFilterRad` chip-høyde (horisontal ScrollView-strekk)
- `5d3167db` — undertrykk dobbeltnavn i lister + HMS-mal-velger (fabel-designfunn)
- `5f4aba8c` — opprett-vei: tittel-felt (oppgave), prosjektnavn via `hentMedId`, `lib/feil.ts formaterServerFeil`, klikk-kutt (auto-velg 1 mal)
- `f5e69756` — `MalVelger` auto-velg uten iOS modal-kollisjon

### Levert (mot ordrens 5 punkter)
1. **Filter mobil-lister** — `StatusFilterRad` (klientside, kun statuser som finnes) + global byggeplass serverside (`hentForProsjekt.byggeplassId`). Ingen backend-endring (queriene tok allerede `status`/`byggeplassId`/`domain`). `app/sjekkliste/index.tsx`, `app/oppgave/index.tsx`.
2. **Opprett-vei fra oppgave-lista** — `MalVelger` + `OpprettDokumentModal` (`kategori="oppgave"`). Klikk-kutt: 1 mal → hopper over velger.
3. **HMS-mobil** — `app/hms/index.tsx`: 3 subdomain-faner via `hms.hentDokumenter`; opprett via `HmsMalVelger` → `oppgave/sjekkliste.opprett` → eksisterende `[id]`-skjerm. Rørte IKKE utfyllings-ryggraden.
4. **Kontrollplan-mobil KUN lese** — `app/kontrollplan/index.tsx`: `hentForByggeplass`, punkter gruppert på milepæl. Ingen mutasjon.
5. **i18n** — rørte filer + `OppgaveModal` (rutet fra fase 1). Nye nøkler i `nb`/`en`; `generate.ts` for 13 språk kjøres ved merge (A merger sist).

### Gate-kjede (bestått)
- **Build:** type-rent + lint-nøytralt på alle rørte filer (baseline-lint i `OpprettDokumentModal` uendret — 5 pre-eks unused-vars, 0 tilført).
- **Fabel designgate 1:** godkjent 02–10; oppgave-chips + dobbeltnavn til oppfølging.
- **Kenneths mobiltest:** fant 2 blokkere i opprett-veien (rå Zod-alert · «Prosjekt: Laster…»).
- **Fiks + fabel designgate 2 → FULL GODKJENNING:** begge blokkere rot-fikset + klikk-kutt, **verifisert end-to-end på sim** (BEF2 opprettet uten feil; prosjektnavn resolvet selv uten firma-valg).
- **Bevis:** 10 skjermbilder i `SiteDoc/del6b-bevis/` (`01`–`10`), inkl. `02` (StatusFilterRad dynamisk) + `03` (opprett-flyt: tittel-felt + resolvert prosjektnavn).

### ⚠️ Restanser (backlog-flagget, IKKE blokkerende for merge)
1. **Kontrollplan populert milepæl-layout ikke design-gatet.** Testprosjektet har ingen kontrollpunkter på noen byggeplass → `10-kontrollplan-lese` viser kun tom-tilstand. Den populerte milepæl/punkt-layouten må etter-gates (seed testdata eller gate mot web-referanse) FØR fase 2 lukkes helt. Lese-skjermen selv rendrer + håndterer tom-tilstand + byggeplass-bytte korrekt.
2. **Bredere feil-formaterings-sweep.** `lib/feil.ts formaterServerFeil` dekker create-veien nå (`OpprettDokumentModal`). Andre mutations (f.eks. `OppgaveModal` fra tegning, status-endringer) viser fortsatt rå `feil.message`. Sweep utover create-veien → backlog. `formaterServerFeil` er den delte mobil-feilformateringen — nye kallere/P2 konvergerer på den.

### Merge
Cowork eier merge-orden (batches med C/P2). **A merger SIST** og kjører avsluttende `generate.ts` — dekker A sin nye nøkkel (`opprettModal.tittel`) + C sin (`statushandling.laast.tomBesvarelse`). i18n nb/en lagt inn; 13 språk regenereres ved merge.
