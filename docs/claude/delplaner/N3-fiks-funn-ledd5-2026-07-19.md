---
name: N3-fiks-funn-ledd5-2026-07-19
status: 🔴 FUNN — fiks PARTIELL. Del-2-ordre kreves (fabel). Del E forblir åpen, A-3b Del 1d forblir blokkert
eier: cowork (funn + gate-miss-eierskap) · fabel (del-2-ordre) · web-Opus (ledd 5-kjøring)
sist_verifisert_mot_kode: 2026-07-19
gjelder: fix/n3-flytmedlem-synlighet merget i develop (96d5d2c0), deployet test
---

# Ledd 5-funn — N3-fiksen er partiell: liste fikset, detalj + opprett ikke

> Sløyfe-ledd 5 (web-Opus, test.sitedoc.no, kmy = `kenneth@sitedoc.no` person-direkte registrator). Testplan: [N3-fiks-testplan.md](N3-fiks-testplan.md). **Rå observasjoner web-Opus; mekanismer cowork-verifisert mot kode.**

## Resultat

| Test | Forventet | Observert | Dom |
|---|---|---|---|
| T4 negativ kontroll | 0 (deaktivert kmy) | 0 i sjekkliste/HMS/bilder — ingen lekkasje | ✅ PASS |
| T1 liste-synlighet | ≥1 (var 0) | KB2-005 + KB2-001 synlige (0→2 på `periode_slutt`-toggle) | ✅ PASS |
| T2 opprett KB2+SJA | begge opprettes | begge blokkert (to distinkte feil) | ❌ FAIL |
| T3 rollefiltrert meny (Del E) | åpne dok → meny | detalj «Sjekklisten ble ikke funnet» — meny utilgjengelig | ❌ BLOKKERT |
| T5 admin uendret | ser alt | admin ser 8/8, identisk fordeling — null-filter urørt | ✅ PASS |
| T6 ytelse | ingen N+1, ingen join | ingen N+1 på HTTP; kode: ett `findMany select {dokumentflytId}`, ingen join (bed4b6a3) | ✅ PASS (mandat møtt; DB-EXPLAIN unødvendig) |

**Enkelt-variabel-beviset (T4↔T1):** kun `periode_slutt` togglet (now()↔NULL) på kmys ene flyt-rad. 0→KB2 bekrefter at det er `DokumentflytMedlem`-grenen i `byggTilgangsFilter` som gir liste-synlighet. Fiksens liste-del virker, uten lekkasje.

## Rot: samme N3-mønster — flere tilgangsstier, bare én fikset

Fiksen utvidet **`byggTilgangsFilter`** (liste) med en `DokumentflytMedlem`-gren (person-direkte binding). Men dokument-tilgang gates av **minst tre funksjoner**, og bare den ene ble rørt:

| # | Funksjon | Sti | DokumentflytMedlem-gren? | Symptom |
|---|---|---|---|---|
| 1 | `byggTilgangsFilter` (tilgangskontroll.ts:724) | Liste (`hentForProsjekt:39`) | ✅ Lagt til (`:819-829`) | T1 grønn |
| 2 | `verifiserDokumentTilgang` (tilgangskontroll.ts:466) | **Detalj** (`hentMedId:116`) + mutasjoner | ❌ Mangler | **T3 blokkert** |
| 3 | `verifiserFaggruppeTilhorighet` (tilgangskontroll.ts:56) | **Opprett** (`sjekkliste.ts:194`) | ❌ Mangler | **T2 KB2 fail** |

**N3-ordrens leser-inventar (cowork-gatet) dekket fire `byggTilgangsFilter`-lesere + opprett-flatene — men bommet på #2 og #3.** Ledd 5 fanget det ledd 2 slapp.

## De tre gapene — kode-verifisert

### G1 — Detalj: `verifiserDokumentTilgang` mangler flyt-grenen (T3, blokkerer Del E)

`hentMedId:116` kaller `verifiserDokumentTilgang` (:466). Funksjonen har gammel struktur: sitedoc_admin → prosjektadmin → firmaansvarlig → bestiller/mottaker-userId-match → `faggruppeKoblinger` → gruppe-domain. **Ingen `DokumentflytMedlem`-gren, sjekker ikke dokumentets `dokumentflytId` mot brukerens flyt-medlemskap.** kmy (person-direkte, ingen faggruppe, ikke bestiller/mottaker) faller gjennom alle grener → kastes. Liste viser dokumentet, detalj avviser → **handlingsmenyen er aldri nåbar → Del E kan ikke lukkes.**

**Fiks-retning:** speil grenen fra `byggTilgangsFilter:819-829`, men som enkelt-dokument-sjekk: er `dokument.dokumentflytId ∈ hentBrukersFlytMedlemskap(userId, projectId)` → return. Samme delte helper.

### G2 — Opprett-membership: `verifiserFaggruppeTilhorighet` krever FaggruppeKobling (T2 KB2)

Klient-fiksen sender korrekt fallback-faggruppe (flytens `faggruppeId = 4a90be87`), som tilfredsstiller `sjekkliste.ts:188` (bestiller+utfører til stede). Men `sjekkliste.ts:194` kaller `verifiserFaggruppeTilhorighet(userId, bestillerFaggruppeId)` (:56) som krever en `FaggruppeKobling` mellom brukeren og faggruppen (:64-93). kmy har ingen (person-direkte, 0 faggrupper) → «Du tilhører ikke denne faggruppen» (:91). **Ledd-3-gaten fanget :188, bommet på :194/:91.**

**Fiks-retning:** `verifiserFaggruppeTilhorighet` må godta flyt-medlemskap som alternativ til `FaggruppeKobling` — når faggruppen er flytens eier-faggruppe og brukeren er flyt-medlem, tillat. (Eller opprett-veien slutter å kreve faggruppe-tilhørighet for flyt-medlemmer.)

### G3 — Opprett utenfor flytens maler: SJA (T2, design + misvisende feil)

Klient-fallbacken (`sjekklister/page.tsx:329-333`) finner en flyt bare hvis malen tilhører flytens `maler` OG kmy er medlem. KB2-malen tilhører kmys flyt → funnet. **SJA-malen gjør ikke** → ingen flyt → `bestillerId` undefined → generisk «`dokumentflyt.feil.ingenFaggruppe`». **F2 er grønn** (flyten HAR faggruppe) — så meldingen «mangler eier-faggruppe» er **misvisende**; ekte årsak er «ingen av dine flyter har denne malen».

**Beslutning (fabel/Kenneth):** skal person-direkte flyt-medlemmer kunne opprette dokumenter utenfor sin flyts maler? Uansett utfall: **feilmeldingen må skille de to tilfellene** (ingen matchende flyt ≠ flyt uten faggruppe).

## Del-2-scope (fabel-ordre)

1. **Komplett inventar først:** N3-roten er «flere tilgangsstier». Del-2 må inventere **alle** funksjoner som gater dokument-lese/opprett/mutasjon (ikke bare G1+G2 — grep etter `verifiserDokumentTilgang`/`verifiserFaggruppeTilhorighet`/inline-medlemssjekk i alle routes), og anvende `DokumentflytMedlem`-grenen konsistent. §11d: mål hver.
2. **G1 (detalj):** `verifiserDokumentTilgang` + flyt-gren → lukker Del E.
3. **G2 (opprett-membership):** `verifiserFaggruppeTilhorighet` godtar flyt-medlemskap.
4. **G3 (SJA/design):** beslutning + feilmelding-skille.
5. Delt helper: `hentBrukersFlytMedlemskap` finnes alt — gjenbrukes, ikke kopieres.

## Hva står, hva er blokkert

- **Liste-fiksen (96d5d2c0) beholdes på develop** — ekte fremgang, trygg (T4: ingen lekkasje). Ikke rull tilbake.
- **Del E forblir åpen** (G1 blokkerer rollemenyen).
- **A-3b Del 1d («mine oppgaver») forblir blokkert** — krever full N3, ikke bare liste.
- Test-DB: kmy reaktivert (`periode_slutt = NULL`) etter T4 — normaltilstand gjenopprettet.

## Gate-miss (cowork eier)

N3-ordrens leser-inventar, som cowork gatet i ledd 2, dekket `byggTilgangsFilter`-lesere + opprett-flatene men ikke `verifiserDokumentTilgang` (detalj) eller `verifiserFaggruppeTilhorighet` (opprett-membership). Ledd 5 (test) fanget begge. Lærdom: ved «leser X blind for binding Y» — inventér **alle** lesere av samme data, ikke bare den som meldte symptomet.
