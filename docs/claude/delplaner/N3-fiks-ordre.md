---
name: N3-fiks-ordre
status: 🟢 KLAR — ledd 2-gatet, hjem anvist. Venter tavle-rad + relay
eier: fabel (ordre) · cowork (ledd 2-gate + hjem-anvisning)
sist_verifisert_mot_kode: 2026-07-18
---

# Ordre — N3-fiks: dokumentflyt-synlighet leser DokumentflytMedlem (b)

> **Fabel-ordre 2026-07-18.** Sløyfe-ledd 1 (plan) — **cowork-gatet ledd 2 (2026-07-18): retning (b) bekreftet, datamodell sunn, leser-listen rettet (tre korreksjoner tatt inn), hjem anvist.** Grunnlag: [funn-fra-a3a-verifisering-2026-07-18.md](funn-fra-a3a-verifisering-2026-07-18.md) (N3 alle tre fronter + § 3-lesning) + Kenneth-DB-fasit 2026-07-18: person/gruppe-direkte er GYLDIG tilgangsvei (6 medlemmer, 0 med `faggruppe_id` — 2 group, 4 person).
>
> **Forutsetning for A-3b Del 1d; Del E re-kjøres i denne testrunden og lukker A-3a.**

## 1. Vedtak som styrer

**(b) Kenneth-vedtatt, data-bekreftet:** lese-siden konsulterer `DokumentflytMedlem` — alle tre bindingsformer (`faggruppe_id` / `group_id` / `project_member_id`). Ingen skrivevei-endring, ingen backfill, ingen dobbeltskriving. Lagret modell er riktig; leserne er blinde for **`project_member_id`-bindingen** (gruppe-veien finnes alt i filteret).

## 2. Oppdraget

1. **`byggTilgangsFilter` utvides:** synlighet = (dagens veier: `FaggruppeKobling` + gruppe-veien) ELLER (`DokumentflytMedlem` via `project_member_id`). **Fire lesere av `byggTilgangsFilter`** (cowork-målt): oppgave (`oppgave.ts:48`) · sjekkliste (`sjekkliste.ts:39`) · hms (`hms.ts:157`) · **bilde (`bilde.ts:16`)**.

2. **Opprett-veien, FIRE flater samme rot** (`mineFaggrupper`-lesere): sjekklister (`page.tsx:316`) · oppgaver (`page.tsx:327/372`) · tegninger (`page.tsx:179/559`) · OpprettOppgaveModal (`:41`). **Dypere enn datakilde-bytte:** match-logikken sammenligner mot flytens oppretter-**faggruppe**, men DB viser oppretter kan være **person/gruppe (null faggruppe)** — matchen må håndtere alle tre oppretter-bindingsformene. Feilmeldingen omskrives (i18n).

3. **Leser-listen (pkt 1+2) er cowork-gatet 2026-07-18 — fasit.** Flere under koding: flagg, ikke utelat stille. §11d: mål hva HVER leser konsulterer før/etter.

4. **Ingen rettighets-UTVIDELSE:** flyt-medlemskap gir synlighet + flytrolle-handlinger (`statusHandlinger`/`ROLLE_HANDLINGER`) — ikke admin, ikke redigering utenfor § 2 (append-only står).

### Cowork-anvisning: hjem for den delte kilden (ledd 2, 2026-07-18)

**`@sitedoc/shared` er Prisma-fri (0 deps) — kan IKKE huse en DB-avhengig medlemskaps-kilde.** Hjem = **api-lag:**
- Server-helper i **`tilgangskontroll.ts`** (der `byggTilgangsFilter` bor): `hentBrukersFlytMedlemskap(userId, projectId)` → flyter/roller brukeren er medlem av via alle tre bindinger. `byggTilgangsFilter` kaller den direkte.
- tRPC-prosedyre **`hentMineFlyter` i `medlem.ts`** (ved siden av `hentMineFaggrupper:47`) wrapper samme helper for de fire klient-opprett-flatene.

Én kilde, to konsumenter (server direkte + klient via tRPC). Ikke fire kopier.

## 3. Ufravikelig

- Metodesløyfen: cowork gatet planen (gjort). Avvik under koding → flagg til fabel.
- **Datamodell RØRES IKKE** (modellen er riktig — leserne fikses). Statusmaskin/lås-logikk røres ikke.
- Delt kilde i api-lag (over), ikke fire kopier. i18n `t()` + `generate.ts` (eget vindu). §11c/§11e.
- **Ytelse flagges:** medlemskaps-oppslaget treffer alle liste-spørringer — mål query-kost før/etter (N+1-vakt).

## 4. DoD (testplan: cowork ledd 4, web-Opus ledd 5)

Kode → `next build` grønn → testplan-kjøring med kmy: (1) kmy SER flytens dokumenter, (2) kmy kan opprette KB2/SJA, (3) kmy får rollefiltrert meny → **Del E kjøres ferdig i samme runde** (deaktiverte handlinger m/ rollebegrunnelser — lukker A-3a), (4) **negativ kontroll:** bruker UTEN flyt-medlemskap ser fortsatt ingenting, (5) admin-visning uendret → Kenneth klikker selv → fabel-gate → dok-sync (`dokumentflyt.md § 3` presiseres: synlighetsaksen navngis) → «klar for commit».

## Ledd 3-gate — kode-Opus' tre spørsmål (cowork-avgjort 2026-07-18)

**Premiss-korreksjon:** kode-Opus meldte «dokumentflytId har ALDRI blitt bundet» — **feildiagnose.** dokumentflytId bindes ved **send** (`videresend-valg.ts:93`, `df.id`), ikke opprett; Del A–D beviste at dokumenter får flyt. Faggruppe-medlemmer oppretter fint (`bestillerId = mineFaggrupper[0]`). Den døde `"oppretter"`-rolle-matchen er kun en fallback som svikter for person-direkte. **Ingen «aldri bundet»-bug — dokumentflytId-binding er UTENFOR scope.**

- **Q1 (utvid scope?):** Nei. Smal luke: person-direkte kan ikke utlede bestiller-faggruppe ved opprett. Bli i ordrens scope.
- **Q2 (enhver flyt-medlem oppretter, § 2?):** Ja.
- **Q3 (fallback `steg-faggruppe ?? Dokumentflyt.faggruppeId`):** **GRØNT.** `Dokumentflyt.faggruppeId` er nullbar, men DB-målt (prod 2026-07-18): «A.Markussen Ansatte» HAR `faggruppe_id = a94e9411…`. Fallback-kilden finnes. **Edge:** håndter grasiøst hvis en flyt likevel har `faggruppeId = NULL` (klar feilmelding, ikke krasj). **Test-flagg:** verifiser at *test*-flyten har `faggruppe_id` før ledd 5, ellers feiler kmy-testen på null-fallback (ikke en kode-feil).

Serveren krever bestiller+utfører-faggruppe for ikke-HMS (`sjekkliste.ts:188`) — fallbacken tilfredsstiller det.

## 5. Opprydding

Cowork eier merge + fase 4. **Prod-omfangets forfinede spørring (gruppe-veien) kjøres ETTER fiks** — da måler den rest-blinde, ikke kandidater.
