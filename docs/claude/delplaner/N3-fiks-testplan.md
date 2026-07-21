---
name: N3-fiks-testplan
status: 🟡 KLAR — ledd 4 (cowork). Venter merge→test-deploy før ledd 5 kan kjøres
eier: cowork (testplan) · web-Opus (ledd 5-kjøring) · Kenneth (klikk-gate)
sist_verifisert_mot_kode: 2026-07-19
gjelder: fix/n3-flytmedlem-synlighet (97499e55 fiks + bed4b6a3 index-only)
---

# Testplan — N3-fiks: dokumentflyt-synlighet leser DokumentflytMedlem (ledd 4)

> Sløyfe-ledd 4. Grunnlag: [N3-fiks-ordre.md](N3-fiks-ordre.md) § 4 DoD + [funn-fra-a3a-verifisering-2026-07-18.md](funn-fra-a3a-verifisering-2026-07-18.md) N3. Kjøres av web-Opus (ledd 5) på **test**, innlogget. **Forventet utfall per steg oppgitt — web-Opus måler AVVIK, ikke bare pass/fail.**

## 0. Forutsetninger FØR ledd 5 (må være grønne, ellers feiler testen uten kode-feil)

| # | Sjekk | Forventet | Hvis rødt |
|---|---|---|---|
| F1 | `fix/n3-flytmedlem-synlighet` merget → develop → deployet til test | `git log` på test viser `bed4b6a3` | **Ikke kjør.** cowork/Kenneth merger + deployer først |
| F2 | Test-flytens egen faggruppe: `SELECT faggruppe_id FROM dokumentflyter WHERE name = 'A.Markussen Ansatte'` | **IKKE NULL** (Q3-fallback-kilde ved opprett) | Test 2 feiler på null-fallback — **ikke kode-feil**, sett en faggruppe på flyten først |
| F3 | kmy er person-direkte flyt-medlem: `SELECT rolle, project_member_id, faggruppe_id, group_id FROM dokumentflyt_medlemmer` for flyten | kmy-rad: `project_member_id` satt, `faggruppe_id`+`group_id` NULL | Test-subjektet er ikke person-direkte → testen måler ikke bypass-kanten |

> F2/F3 kjøres i psql (`docker exec -it $(sudo docker ps --format '{{.Names}}' | grep -x postgres) psql -U sitedoc -d sitedoc_test`). Kenneth kjører — SQL limes ALDRI i bash-shell.

## 1. Testtilfeller (web-Opus, innlogget på test)

### T1 — Synlighet (positiv kjerne) — DoD (1)

**Forhåndstilstand:** KB2-005 (eller annen sjekkliste) er sendt/videresendt gjennom flyten «A.Markussen Ansatte» på Bygg B12.

1. Logg inn som **kmy** (registrator, person-direkte).
2. Åpne Bygg B12 → Sjekklister.

**Forventet:** kmy SER flytens sjekklister (≥1). Før fiks: 0. **Avvik-flagg:** fortsatt 0 → `byggTilgangsFilter` leser ikke `DokumentflytMedlem.project_member_id` (fiksen traff ikke lese-veien).

Gjenta for **HMS** (`hms.ts:157`) og **bilder** (`bilde.ts:16`) — begge er lesere av `byggTilgangsFilter` (§11d: mål hver leser, ikke bare sjekkliste).

### T2 — Opprett (positiv) — DoD (2)

1. Som kmy: opprett **KB2** fra mal på B12.
2. Som kmy: opprett **SJA** fra mal på B12.

**Forventet:** begge opprettes. **Ingen** «Du er ikke medlem av noen faggruppe»-feil. Bestiller settes fra fallback (`Dokumentflyt.faggruppeId = a94e9411…`). **Avvik-flagg:** (a) rød feilmelding står → opprett-flaten leser fortsatt kun `mineFaggrupper`; (b) krasj/500 → null-fallback ikke håndtert grasiøst (F2 var rød, eller edge ikke fanget).

Test alle fire opprett-flatene som er rørt: sjekklister, oppgaver, tegninger, OpprettOppgaveModal.

### T3 — Rollefiltrert meny (lukker A-3a Del E) — DoD (3)

1. Som kmy: åpne et dokument der kmy har flyt-rolle (registrator).
2. Åpne handlingsmenyen.

**Forventet:** kmy ser sine registrator-handlinger **aktive**; handlinger utenfor rollen vises **deaktivert MED begrunnelse** («Kun godkjenner», «Kun administrator» e.l.) — ikke bare fraværende. **Avvik-flagg:** tom handlingsrad (fraværende knapper uten begrunnelse) = Del E-symptomet fra original-testen; rollefiltreringen viser ikke deaktivert-tilstand for ikke-admin.

### T4 — Negativ kontroll (KRITISK — over-breddes ikke?) — DoD (4)

1. Logg inn som en bruker **UTEN** flyt-medlemskap på B12, og uten `FaggruppeKobling`/`groupMembership` mot en matchende faggruppe.
2. Åpne B12 → Sjekklister / HMS / bilder.

**Forventet:** ser **fortsatt ingenting** (0 dokumenter). **Avvik-flagg:** ser dokumenter → fiksen utvidet filteret for bredt = tilgangslekkasje. Dette er det farligste avviket — prioriter.

### T5 — Admin uendret (regresjonsvakt) — DoD (5)

1. Logg inn som admin (Kenneth).
2. Åpne B12 → tell synlige dokumenter, sjekklister/HMS/bilder.

**Forventet:** **identisk** med før fiks (admin får `null`-filter = ser alt). **Avvik-flagg:** færre/flere dokumenter enn før → fiksen rørte admin-grenen (skal ikke — `byggTilgangsFilter` returnerer `null` for admin uendret).

### T6 — Ytelse (ordrens N+1-vakt) — § 4 ufravikelig

Mål query-kost på liste-lastingen (B12 sjekklister) før/etter fiks. **Forventet:** medlemskaps-oppslaget er **ett** index-only `findMany` på `dokumentflyt_medlemmer` (per `bed4b6a3`), gjenbruker allerede-hentet `medlem`. **Avvik-flagg:** N+1 (ett medlemskaps-oppslag per dokument) eller ekstra join → ikke index-only.

## 2. Sekvens

F1–F3 grønn → T4 (negativ, farligst) + T5 (admin-regresjon) FØRST → så T1–T3 (positiv) → T6 (ytelse) → web-Opus rapporterer avvik med skjermbilde per steg → **Kenneth klikker selv** (funnene kom derfra) → fabel-gate → dok-sync (`dokumentflyt.md § 3`: synlighetsaksen navngis — `DokumentflytMedlem` er access-entitet, ikke `FaggruppeKobling`) → «klar for commit».

## 3. Utfall lukker

- T1–T3 grønn → **A-3a Del E lukket** (rollefiltrert meny observert på ikke-admin).
- Alle grønn → **N3-fiksen verifisert** → A-3b Del 1d («mine oppgaver») avblokkeres.
- **Prod-omfangets forfinede spørring (gruppe-veien)** kjøres ETTER verifisert fiks — måler rest-blinde, ikke kandidater (N3-ordre § 5).
