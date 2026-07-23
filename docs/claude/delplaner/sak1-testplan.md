---
name: sak1-testplan
status: 🟢 KJØRT (ledd 5, 2026-07-20) — S1/S2/S7 ✅, S3/S4/S5/S6 kode-verifisert. Sak 1 lukket
eier: cowork (testplan) · web-Opus (ledd 5) · Kenneth (klikk-gate)
sist_verifisert_mot_kode: 2026-07-19
gjelder: fix/sak1-flytmedlem-paritet (fd573b61) — review godkjent av cowork
---

# Testplan — Sak 1: flyt-medlemskap likestilt med faggruppe (ledd 4)

> Grunnlag: [sak1-flytmedlem-paritet-ordre.md](sak1-flytmedlem-paritet-ordre.md) § 3. Kjøres av web-Opus på **test**, innlogget som **kmy** (`kenneth@sitedoc.no`, person-direkte flyt-medlem, **registrator**, ikke-admin). Forventet utfall per steg — mål AVVIK.

## 0. Forutsetninger
| # | Sjekk | Forventet |
|---|---|---|
| F1 | `fix/sak1-flytmedlem-paritet` merget → develop → deployet test | `fd573b61`-koden kjører |
| F2 | kmy aktiv flyt-rad (`periode_slutt` NULL), rolle `registrator` | 1 rad |

## 1. Testtilfeller

### S1 — D5-snu: skrive-tilgang virker nå (kjernen)
> **Rettet 2026-07-20:** opprinnelig pekte denne på `leggTilKommentar` — men den bor på **oppgave.ts** (`taskComment.create`), ikke sjekkliste. «Valgfri kommentar»-feltet på sjekkliste-detaljen er status-handlingens kommentar, ikke en frittstående tråd.

**Bruk `sjekkliste.oppdaterData`** — kode-målt: **ingen status-vakt, ingen rolle-vakt**, kun `verifiserDokumentTilgang`. Reneste test av selve paritetsendringen som finnes.

Som kmy: åpne KB2-005 (dokument i kmys flyt som kmy **ikke** er bestiller av) → **fyll ut et kontrollpunkt** (svar-feltet, ikke «Valgfri kommentar»-feltet i handlingsraden).

**Forventet:** verdien lagres. Samme skriveoperasjon ga «Du har ikke tilgang til dette dokumentet» i N3-del-2-testen.
**Avvik:** «ikke tilgang» står → flyt-grenen traff ikke mutasjons-stien.

*Alternativ, like ren:* kommentar på en **oppgave** i kmys flyt (`leggTilKommentar` — heller ingen status-/rollevakt). Bruk den hvis en oppgave er lettere tilgjengelig.

### S2 — Rolle-styrt overgang + klient/server-samsvar (ny risiko)
Som kmy: forsøk en **statusendring** fra menyen på KB2-005.

**Forventet:** tilgangsgaten passeres (sak 1), deretter avgjør `verifiserFlytRolle`. Utfallet skal være **enten** at overgangen gjennomføres, **eller** en tydelig rollemelding: «Du har rollen «X» i denne dokumentflyten og kan ikke utføre overgangen A → B».

**Kritisk observasjon:** klienten spesialbehandler registrator (`statusHandlinger.ts:85` — «ser alle handlinger»), mens serveren avgjør via `erTillattForRolle`. **Tilbyr menyen en overgang serveren avviser?** Noter nøyaktig hvilke handlinger menyen viser vs. hvilke som faktisk går gjennom.
**Avvik-flagg:** meny tilbyr overgang → server avviser med rollemelding = klient/server-divergens. Ikke en sak-1-regresjon, men et funn (samme klasse som N3).

### S3 — Faggruppe-regresjon (KRITISK)
Logg inn som en **faggruppe-bundet** bruker. Utfør de samme operasjonene som før endringen: åpne detalj, kommentere, redigere utkast, statusendring.

**Forventet:** **identisk** oppførsel med før — verken mer eller mindre. Sak 1 **legger til** en tilgangsvei, den skal ikke røre den eksisterende.
**Avvik:** enhver endring for faggruppe-brukeren.

### S4 — Negativ kontroll (over-breddes ikke?)
Bruker uten flyt-medlemskap, faggruppe **og** gruppe: forsøk kommentar/redigering/statusendring på et dokument.

**Forventet:** avvist på **alle** forsøk. Grenen krever fortsatt at dokumentets `dokumentflytId` finnes i brukerens egne flyter.
**Avvik:** noe lykkes → over-bredding. **Farligste avviket.**

### S5 — Periode-vindu gjelder også skriving
Kenneth deaktiverer kmys flyt-rad (`periode_slutt = now()`). Som kmy: forsøk kommentar på KB2-005.

**Forventet:** avvist — deaktivert medlem mister **både** lese og skrive (arves fra helperen, som filtrerer `periodeSlutt = null`).
Så reaktiver (`= NULL`) og bekreft at kommentaren går igjen.

### S6 — F1-A: privat HMS blokkerer også skriving
Finnes et **privat** HMS-dok (RUH/avvik) i kmys flyt: forsøk kommentar/endring som kmy.

**Forventet:** avvist — F1-A-konjunktet gjelder hele grenen, ikke bare lesing.
Finnes ingen slike dok i kmys flyt: noter «kode-verifisert» (konjunktet er uendret i diffen) og hopp over live.

### S7 — Admin uendret
Admin (`kemyrhau@gmail.com`): detalj, kommentar, redigering, statusendring — identisk med før.

## 2. Sekvens
F1–F2 → **S4 (negativ) + S3 (faggruppe-regresjon) + S7 (admin) først** (farligst/regresjon) → **S1 (kjernen)** → S2 (rolle + divergens) → S5 (periode) → S6 (F1-A). Skjermbilde + forventet-vs-observert per steg → Kenneth klikker → fabel-gate → dok-sync (cowork ved merge).

## 3. Utfall lukker
- S1 + S3 + S4 grønn → **paritets-vedtaket verifisert**: flyt-medlem skriver som et faggruppe-medlem, uten lekkasje eller regresjon.
- S2 er observasjon, ikke pass/fail — utfallet mater [sak1b-mutasjoner-rollestyring.md](sak1b-mutasjoner-rollestyring.md).
