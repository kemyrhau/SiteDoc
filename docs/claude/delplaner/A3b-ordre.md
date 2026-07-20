---
name: A3b-ordre
status: 🟢 ÅPEN — cowork ledd 2-gate GRØNT 2026-07-19 (Del E lukket, alle premisser kode-verifisert). Pkt 7 venter Kenneth-vedtak
eier: fabel (ordre) · cowork (gate) · kode-Opus (ledd 3)
sist_verifisert_mot_kode: 2026-07-19
---

# Ordre — A-3b: perspektiv-prinsippet i dokumentflyt (omrammet)

> **Fabel-ordre 2026-07-18.** Relayes av Kenneth; cowork gir tre + branch + tavle-rad. **Kan ikke kjøre parallelt med B-2 eller CLAUDE.md-runden (generate.ts).** Grunnlag: [funn-fra-a3a-verifisering-2026-07-18.md](funn-fra-a3a-verifisering-2026-07-18.md) (N1-vedtaket + Kenneths syv beslutninger) + testrapportene 2026-07-18.
>
> **Forutsetning: Del E (rollefiltrering, ikke-admin) er kjørt og A-3a lukket FØR denne åpnes** — begge rører samme meny/badge-flater.

## 0. For deg som koder (les først)

**Hvem du er:** kode-Opus, **ledd 3 (koding)**. Fabel planla, cowork gatet mot kode (§ 6 — grønt). **Du koder — kun det.** Du gater ikke, tester ikke med brukere, merger ikke, deployer ikke.

**Branch:** `feat/a3b-perspektiv` fra develop (`68f3ddaf`). Du pusher kun denne.

**Leveranse i to faser — STOPP mellom:**
1. **Fase A — perspektiv-tabellen (ikke kode).** Lever tabellen `status × perspektiv → etikett + farge` for alle fire dokumenttyper (§ 2 Del 1a krever fabel-designgate FØR implementering). **Stopp. Gi tabellen til fabel via Kenneth.**
2. **Fase B — koding.** Etter fabel-godkjenning: Del 1a–d + Del 2 pkt 1–5. **Pkt 6 er rutet til spor C** (ikke din). **Pkt 7 kodes IKKE før Kenneth har vedtatt rollematrise-endringen** (se § 6).

**Ditt neste svar:** perspektiv-tabellen — ikke kode.

## 1. Fundamentet (Kenneth-vedtatt N1 — rammen, ikke en fiks)

**Status er perspektiv-avhengig, ikke global.** «Sendt» gjelder kun avsender, som momentan kvittering; mottaker ser «Til behandling»; avsender ser SENERE dokumentets sanne tilstand (ikke sin gamle handling). Gjelder alle steg — etiketten tilpasses dokumentets mening, ikke en fast tabell.

**Halve modellen er bygget (cowork-målt):** lagret tilstand ER mottaker-perspektiv (`sent→received` ubetinget, `sjekkliste.ts:923` — **RØRES IKKE, det er fundamentet, ikke en bug**), `harBallen`-data finnes, `status-badge.tsx:43` har kontekst-frø (`sent+lest→«Lest»`). Det som bygges er **visningslaget**.

## 2. Oppdraget

### Del 1 — perspektiv-visning (kjernen)

a. **Seer-avhengig badge:** status-badge får seer-kontekst (`harBallen`/rolle/avsenderskap). Etikett-logikk som **delt kilde i `@sitedoc/shared`** (én funksjon: `(lagretStatus, seerKontekst) → etikett+farge`) — web + mobil + lister konsulterer den; ALDRI per-flate if-er. **Etikettene per status × perspektiv legges frem for fabel som tabell FØR implementering** (kort designgate — Kenneth-vedtaket sier «tilpasses meningen», tabellen er konkretiseringen).

b. **Kvitterings-øyeblikket:** rett etter egen handling vises handlings-kvittering («Sendt») momentant; ved neste visning dokumentets sanne tilstand. (Toast/optimistisk badge — **ikke lagret tilstand**.)

c. **«Hvem har ballen» synlig:** dokumentkort + detaljside viser ball-holder (faggruppe/person). N2-lærdommen: «Venter på»-treghet **ikke reprodusert, ikke løst** — dette er synlighetsfiksen, ikke tekstfiks.

d. **«Mine oppgaver»:** liste-/søkefilter på `harBallen` (mottaker finner dokumentet i sin liste når ballen er hans).

### Del 2 — Kenneths syv beslutninger (fra funn-dokumentet)

1. **Badge-feedback ved videresend** (dekkes av 1c — verifiser at videresend oppdaterer synlig).
2. **«Til revisjon»-badge** for `rejected` sett fra den som sendte tilbake; **«Under arbeid/Pågående»** for utfører (perspektiv-tabellen, del av 1a).
3. **Tydeligere Send-skille:** «Send videre til:»-overskrift over faggruppene, ADMIN-seksjonen separat for overstyring.
4. **Person-videresending:** faggruppe vist kollapset → åpner viser medlemmer (Kenneth bekreftet; datamodellen bærer det, ingen schema-endring).
5. **Kommentar-nudge KUN ved «Send tilbake»/«Avvis»** — ikke universelt.
6. **Tooltip på felttyper i MalBygger → RUTES SPOR C** (ikke denne ordren; føres dit).
7. **«Trekk tilbake»:** med N1-fundamentet flyttes den til avsenders handlingsrom mens ballen er hos mottaker og dokumentet er ubehandlet.

> ⚠️ **Pkt 7 KREVER statusmaskin-/rollematrise-endring (cowork-målt 2026-07-18):** `ROLLE_HANDLINGER.bestiller` har ingen `received:`-oppføring — avsender har i dag INGEN handling på `received`. Å gi avsender «Trekk tilbake» der er en rollematrise-utvidelse. **Egen beslutning FØR bygging** (fabels flagg-krav). Ikke bygg pkt 7 i samme sveip som resten — flagg og vent.

## 3. Ufravikelig

- `sjekkliste.ts:923` (auto-mottak) **RØRES IKKE.** Statusmaskinen røres ikke uten flagg (pkt 7-unntaket). **Lagret tilstand endres ALDRI** — alt er visningslag + filter.
- **Perspektiv-tabellen (1a) fabel-gates FØR bygging.** Delt kilde-endringer (badge-funksjonen, `ROLLE_HANDLINGER`) → mobil re-verifiseres i samme gate.
- Alle fire dokumenttyper. i18n `t()` + `generate.ts` (ditt vindu). §11c/§11d/§11e. **Mål selv; rapportene er input.**

## 4. DoD

Kode → `next build` grønn → bevis til fabel: samme dokument sett som avsender OG mottaker (ulike etiketter), kvittering-øyeblikket, ball-holder synlig på kort+detalj, «mine oppgaver»-filteret, Send-skillet, person-videresending kollapset, nudge kun ved tilbakesending → fabel-gate → **Kenneths egen klikktest** (funnene kom derfra — gaten skal samme vei) → dok-sync (`dokumentflyt.md` § 2/§ 6 med perspektiv-prinsippet) → «klar for commit».

## 5. Opprydding

Cowork eier merge + fase 4.

## 6. Ledd 2-gate (cowork, kode-målt 2026-07-19) — GRØNT

**Forutsetningen er oppfylt:** A-3a er merget i develop (branch slettet etter merge; `StatusHandlinger.tsx` borte, kilde-markørene til stede). **Del E lukket 2026-07-19** — rollefiltreringen bor i nedtrekket (Send▾/Admin▾), ikke inline-raden, og er verifisert i begge retninger med kmy = utforer: `received` → Avvis deaktivert «KUN ADMINISTRATOR» · `responded` → Godkjenn/Send tilbake/Videresend deaktivert «KUN GODKJENNER». *(Tidligere «meny identisk med admin» var registrator-regelen `statusHandlinger.ts:85` som virker, ikke en bug.)*

**Premisser verifisert mot kode:**

| Ordrens påstand | Kode | Dom |
|---|---|---|
| `sjekkliste.ts:923` auto-mottak `sent→received` ubetinget — RØRES IKKE | `const effektivStatus = input.nyStatus === "sent" ? "received" : input.nyStatus` | ✅ |
| `status-badge.tsx:43` har kontekst-frø | `packages/ui/src/status-badge.tsx:44` — `status === "sent" && lestAvMottakerVed != null` → «Lest» | ✅ |
| `harBallen`-data finnes | `beregnHarBallen`, `packages/shared/src/utils/flytRolle.ts:123` | ✅ |
| Pkt 7 krever rollematrise-endring | `ROLLE_HANDLINGER.bestiller = {draft, sent, approved, cancelled}` — **ingen `received`** | ✅ flagget står |

**Cowork-tillegg — hvorfor 1a MÅ i `@sitedoc/shared` (mekanisk, ikke stilistisk):** mobil importerer **ikke** `@sitedoc/ui` (0 treff i `apps/mobile/package.json`) men **importerer** `@sitedoc/shared`. Etikett-funksjonen `(lagretStatus, seerKontekst) → etikett+farge` må derfor bo i shared (rammeverk-fri); `packages/ui/src/status-badge.tsx` konsumerer den. Legges den i `ui` blir mobil avskåret — samme feilen som ville rammet N3-helperen.

**Pkt 7 — Kenneth-beslutning kreves FØR koding:** «Trekk tilbake» ligger på `bestiller.sent → cancelled`, men auto-mottak gjør hvert sendt dokument `received` umiddelbart, og `bestiller` har ingen `received`-oppføring. Å gi avsender «Trekk tilbake» på `received` er en **utvidelse av rollematrisen**, ikke en visningsendring. Ordrens § 3 sier statusmaskinen ikke røres uten flagg — dette er flagget.
