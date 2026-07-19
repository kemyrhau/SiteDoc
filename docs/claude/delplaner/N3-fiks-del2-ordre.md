---
name: N3-fiks-del2-ordre
status: 🟢 GATE-GODKJENT (cowork ledd 2, 2026-07-19) — klar for kode-Opus. Steg 0-tabell leveres + cowork-gates før Steg 1–4 kodes
eier: fabel (ordre) · cowork (ledd 2-gate, alle refinements inn) · kode-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-19
gjelder: fix/n3-flytmedlem-del2 (ny branch fra develop 96d5d2c0)
---

# Ordre — N3-fiks del 2: alle tilgangsstier konsulterer flyt-medlemskap

> Fabel-ordre + cowork ledd 2-gate (refinements R1–R3 + flag-guardrail inne). Grunnlag: [N3-fiks-funn-ledd5-2026-07-19.md](N3-fiks-funn-ledd5-2026-07-19.md). Del 1 (`96d5d2c0`) var PARTIELL: liste fikset (T1/T4/T5/T6 ✅), detalj + opprett urørt. **Lukker Del E (A-3a) + opphever A-3b Del 1d-blokkeringen.**

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)** i seks-leddssløyfen. Fabel planla (ledd 1), cowork gatet planen mot kode (ledd 2 — ferdig, denne ordren). **Du koder — kun det.** Du **gater ikke** (heller ikke din egen Steg 0-tabell), **tester ikke** med brukere, **merger ikke**, **deployer ikke**. Etter deg: cowork lager testplan (ledd 4), web-Opus tester (ledd 5).

**Branch:** `fix/n3-flytmedlem-del2` fra develop (`96d5d2c0`). Du pusher **kun** denne branchen, aldri develop.

**Leveranse i to faser — STOPP mellom dem:**
1. **Fase A — Steg 0 (inventar-TABELL, ikke kode):** lever tabellen (§ Steg 0-format). **Stopp der. Gi tabellen til cowork (via Kenneth) for gating.** Ikke kod Steg 1–4 før cowork har godkjent tabellen — den kan avdekke stier ordren ikke forutså.
2. **Fase B — Steg 1–4 (koding):** etter cowork-godkjenning av tabellen, kod per Steg 1–4. `next build` grønn. Push branch. Vis diff til cowork.

**Ditt neste svar skal være Steg 0-tabellen — ikke kode.**

## 1. Styrende
Kenneth-vedtak (b): `DokumentflytMedlem` (person/gruppe/faggruppe-binding) er gyldig tilgangsvei. Ledd 5-lærdom = ordrens form: ved «leser blind for binding» inventeres **alle** lesere av samme data, ikke bare den som meldte symptomet.

## 2. Oppdraget

### Steg 0 — komplett inventar FØRST (tabell leveres, cowork-gates før koding)
Grep alle routes + `tilgangskontroll.ts` for HVER funksjon/inline-sjekk som gater dokument-lese/opprett/mutasjon: `verifiserDokumentTilgang`, `verifiserFaggruppeTilhorighet`, `byggTilgangsFilter` (gjort), **+ eksplisitt inline-sjekker i `hms.ts`, `bilde.ts`, tegning-rutene og mobil-API-veiene** (R3 — ikke bare de to sentraliserte funksjonene). Per rad: fil:linje, hvilke stier den gater, flyt-gren ✅/❌, og for mutasjons-sitene: merk «G1-mutere — egen sak». §11d/§11c. Tabellen er del-2s fasit; nye funn under koding flagges, utelates ikke stille.

### Steg 1 — G1-LESE (høyest — lukker Del E). SPLITTET (cowork-målt 2026-07-19, KORRIGERT: 17 call-sites = **6 lese (.query) + 11 mutasjon (.mutation)**)
> Rettelse: tidligere «1 lese + 16 mutasjon» var feil — alle **seks** query-sitene må ha flyt-grenen, ellers ser kmy detaljen men får FORBIDDEN på kommentarer/underoppgaver/flyt-valg (Del 1-fella igjen).

**F1-A (gate-vedtatt 2026-07-19 — Steg 0-kryssfunn):** flyt-grenen **respekterer HMS-synlighet** — den fyrer IKKE for private HMS-dok (`templateDomain === "hms" && templateHmsSynlighet !== "apen"`). Ellers ville flyt-medlem se private HMS-dok på detalj mens `byggHmsSynlighetsFilter` skjuler dem i lista = rettighetsutvidelse (bryter § 3) + liste↔detalj-inkonsistens. `verifiserDokumentTilgang` mottar `templateHmsSynlighet` (:474), begge `hentMedId` sender den → triviell å håndheve.

**Alle 6 lese-stier** får flyt-gren: dokumentets `dokumentflytId` ∈ `hentBrukersFlytMedlemskap(userId, projectId)` → tillat innsyn (med F1-A-forbeholdet over). GJENBRUK helperen. Sitene (verifisert):
- `sjekkliste.ts:116` hentMedId · `sjekkliste.ts:584` hentTilgjengeligeFlyter
- `oppgave.ts:177` hentMedId · `oppgave.ts:215` hentKommentarer · `oppgave.ts:278` hentForSjekkliste · `oppgave.ts:777` hentTilgjengeligeFlyter

**Guardrail (ufravikelig — ellers lekker splitten):** `verifiserDokumentTilgang` er ÉN funksjon kalt av alle 17. Grenen MÅ isoleres til lese-stiene via **flag-parameter `tillatFlytMedlemskap = false` (default, ny trailing-param — funksjonen har ingen bool-flag i dag)** — de **6 query-sitene** sender `true`, de **11 mutasjonene** kaller **uendret** (uten flagget) → byte-for-byte urørt. Grenen fyrer kun når flagget er sant.

**G1-mutere (11 sites) = UT av denne ordren.** Sjekkliste {oppdater:306, oppdaterData:354, forbedreOversettelse:511, endreStatus:702, slett:1016} + oppgave {leggTilKommentar:249, oppdater:465, oppdaterData:517, forbedreOversettelse:676, endreStatus:888, slett:1201}. Flyt-gren der = uvedtatt mutasjonsrett; de bruker i dag tilgangssjekken som eneste autorisasjon uten flytrolle-håndheving. Egen sak: først måle om server-side flytrolle-håndheving (`ROLLE_HANDLINGER`) mangler generelt (også for faggruppe-bundne), så egen ordre som legger rolle-håndheving per mutasjon; flyt-grenen i mutasjons-guardene følger DEN ordren.

### Steg 2 — G2 opprett-membership (R2: index-only bevart)
`verifiserFaggruppeTilhorighet` (:56) godtar flyt-medlemskap som alternativ. Helperen returnerer KUN `string[]` (flyt-ids) — den skal **IKKE** bære faggruppe (ville undo `bed4b6a3`s index-only). **NB: funksjonen tar `(userId, faggruppeId)` — ingen `projectId`; utled det fra faggruppen** (samme `faggruppe.findUnique → projectId` som admin-fallback-grenen :73 alt gjør). Mønster:
```
const fg = await prisma.faggruppe.findUnique({ where: { id: faggruppeId }, select: { projectId: true } });
if (fg) {
  const flytIder = await hentBrukersFlytMedlemskap(userId, fg.projectId);
  const treff = await prisma.dokumentflyt.findFirst({ where: { id: { in: flytIder }, faggruppeId } });
  if (treff) return; // flyt-medlem + faggruppen er flytens eier-faggruppe
}
```
`dokumentflyter.faggruppe_id` finnes + er `@@index`-et (schema:1205) → findFirst index-støttet. Faggruppe-veien (`FaggruppeKobling`) beholdes for faggruppe-bundne. Dekker begge kallere: `sjekkliste.ts:194` + `oppgave.ts:360`.

### Steg 3 — G3 SJA: kun feilmelding-skille (retten er vedtatt NEI, § 4)
Feilmeldingen skiller ALLTID: «Ingen av dine dokumentflyter har denne malen» ≠ «Flyten mangler eier-faggruppe» (i18n, begge nøkler). Klient-fallbacken (`sjekklister/page.tsx:334`, + oppgaver/tegninger/OpprettOppgaveModal samme mønster) velger riktig melding ut fra om en matchende flyt ble funnet vs. flyten mangler `faggruppeId`. **Ingen rettighetsutvidelse** — person-direkte medlemmer oppretter fortsatt ikke utenfor egen flyts maler.

### Steg 4 — resten av inventaret
De 6 lese-stiene i `sjekkliste.ts`/`oppgave.ts` er dekket av Steg 1. Steg 4 = ❌ lese-rader **utenfor** de to filene (hms/bilde/tegning/mobil, det Steg 0 finner) → flyt-gren via samme helper, eller dokumentert bevisst utelatelse (f.eks. admin-only). Mutasjons-rader står som «G1-mutere — egen sak».

## 3. Ufravikelig
- Steg 0-tabellen leveres + cowork-gates FØR Steg 1–4 kodes (to-fase i samme økt OK; koding før gate ikke).
- `hentBrukersFlytMedlemskap` = eneste medlemskaps-kilde, null kopier. Datamodell/statusmaskin/lås røres ikke. Ingen rettighetsutvidelse utover flytrollene (§ 2 append-only står).
- **T4-invarianten:** deaktivert medlem (`periode_slutt`) ser INGENTING — hver ny gren arver periode-vinduet (helper-gjenbruk gir det gratis).
- i18n `t()` + `generate.ts` (eget vindu). N+1-vakt på nye oppslag (T6-standard). §11c/§11e.
- Opus pusher egen branch (`fix/n3-flytmedlem-del2`), aldri develop. Merge eies av cowork/Kenneth.

## 4. G3 — Kenneth-vedtatt NEI (2026-07-19)
Person-direkte flyt-medlemmer oppretter IKKE på maler utenfor sin flyts maler. Flyten er arbeidsrommet; behovet løses ved å legge malen til flyten (admin-handling). Steg 3 = kun feilmelding-skillet.

## 5. DoD (testplan: cowork ledd 4; web-Opus ledd 5)
Kode → `next build` grønn → kmy-testrunde: (1) detalj åpner + rollefiltrert meny → **Del E kjøres ferdig (deaktiverte handlinger m/ begrunnelser per rolle) — lukker A-3a**, (2) opprett KB2 lykkes, (3) SJA gir riktig skilt melding (opprett fortsatt blokkert per G3), (4) T4-negativ re-kjøres (deaktivert kmy ser 0 overalt — nå inkl. detalj/opprett), (5) admin uendret → Kenneth klikker → fabel-gate → dok-sync (`dokumentflyt.md § 3`: tilgangsstiene navngis) → «klar for commit».

## 6. Opprydding
Cowork eier merge + fase 4. Etter merge: forfinet prod-spørring (rest-blinde etter full fiks) — Kenneth kjører.
