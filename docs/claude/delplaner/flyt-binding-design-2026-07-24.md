---
name: flyt-binding-design
status: 🟡 FABEL-INNSTILLING 2026-07-24 (rev. HMS-gaffel samme dag) — design på F1. Kenneth vedtar B1–B4; HMS-håndtering (vedtak A) innarbeidet etter cowork-gating.
eier: fabel (design) · cowork (kode-gating) · Kenneth (vedtak)
TIL REPO: docs/claude/delplaner/flyt-binding-design-2026-07-24.md
---

# F1 — Flyt-binding ved opprettelse (design-innstilling)

Kontekst: `docs/claude/delplaner/flyt-rolle-verifisering-2026-07-24.md` (F1 = rotårsak).
Visuelt beslutningskart: designprosjektet, «Flyt-binding Beslutningskart.dc.html» (1a).

## Kodemålt rotårsak (develop, 2026-07-24)

- `apps/api/src/routes/sjekkliste.ts:151` — `dokumentflytId: z.string().uuid().optional()`: server godtar dokument uten flyt.
- `apps/web/.../sjekklister/page.tsx` `handleOpprettFraMal` — to hull:
  1. `matchDf` bruker `.find()` → ved flere flyter som matcher mal+medlemskap velges én vilkårlig (stille feilkilde).
  2. `bestillerId` kan utledes via `minFlyt.faggruppeId`-veien selv når `matchDf` er `undefined` → mutasjonen sendes med `dokumentflytId: undefined` → foreldreløst dokument.

## Innstillinger (Kenneth vedtar per punkt)

### B1 — Dokument tilhører ALLTID nøyaktig én flyt (påkrevd)
`dokumentflytId` gjøres **påkrevd på server** i `sjekkliste.opprett`. Frittstående dokumenter er ikke gyldig tilstand: uten flyt finnes ingen rolle-separasjon, ingen flyt-medlem-synlighet, ingen Flyt-kolonne. Server-kravet er rotårsaksfiksen; UI-utledning alene er plaster (enhver fremtidig kallvei kan gjenskape foreldreløse).

**HMS-unntaket (cowork-gatet + fabel-verifisert mot sjekkliste.ts:164–216, vedtak A):** HMS-grenen (`erHms`, mal.domain="hms") er flyt-løs by design — auto-rutes til HMS-gruppen, egen synlighetsmodell (`hmsSynlighet` per mal). HMS lider ikke av F1-symptomet og skal IKKE inn i dokumentflyt.
- `dokumentflytId` påkrevd kun i standard-grenen (ikke-HMS) — kravet legges i samme `else`-gren som dagens faggruppe-krav.
- Guard 1: HMS-grenen **avviser** innsendt `dokumentflytId` (fail loud — HMS-mal i flyt er config-feil).
- Guard 2: HMS-maler i mal-modalen viser «HMS — rutes automatisk til HMS-gruppen», aldri flyt-badge (påvirker B2); B4-backfill begrenses til `domain ≠ hms`.

### B2 — Binding: mal først · auto når entydig · velger når flere
- Mal velges først (dagens mentale modell beholdes).
- Kandidatmengde per mal = flyter som har malen OG der brukeren er oppretter-medlem — beregnes med **`.filter()`, ikke `.find()`**.
- Nøyaktig 1 kandidat → auto-bind, opprett direkte. Flytnavn står synlig på mal-kortet FØR klikk — binding er aldri usynlig.
- Flere kandidater → steg 2 i samme modal: flyt-velger (radioliste: flytnavn + oppretter-faggruppe + utfører), deretter Opprett.
- 0 kandidater → B3.
- Server stoler ikke på klienten: `opprett` validerer at valgt flyt har malen og at brukeren er oppretter-medlem (TRPCError ellers) — samme håndhevingsprinsipp som `verifiserFlytRolle`.

### B3 — Ingen flyt har malen: blokker, men vis det FØR klikk
- Blokkering beholdes («tillat + koble senere» gjenskaper F1 med vilje).
- Maler uten kandidatflyt vises dempet i modalen med forklaring på kortet (i stedet for feilmelding etter klikk).
- Handlingsrettet melding: «Ingen dokumentflyt bruker denne malen der du er oppretter. En administrator må legge malen til en flyt (Innstillinger → Dokumentflyt).»
- G3-skillet `ingenFlytMedMal` / `flytManglerFaggruppe` beholdes.

### B4 — Backfill: entydig auto, resten manuelt, aldri gjetting
Engangs, idempotent backfill-skript — kjøres FØR server-kravet skrus på (ellers blir eksisterende rader ulovlige):
- Entydig (dokumentets mal + bestillerFaggruppe matcher nøyaktig én flyt) → sett `dokumentflytId`, logg.
- Flertydig / null treff → IKKE gjett; skriv rapportliste (id, tittel, mal, bestiller). Manuell kobling via eksisterende flyt-bytte i `oppdater` (sjekkliste.ts:785).

**Cowork måler før ordre-låsing:** faktisk antall foreldreløse i prod + andel entydige.

## Opprettelses-UX (hva brukeren ser)

1. Modal åpnes → kandidatflyter beregnes per mal; hvert mal-kort viser flyt-status: grønn «Flyt: <navn>» (entydig) · gul «N flyter bruker malen — du velger i neste steg» · dempet kort med forklaring (0 treff).
2. Klikk mal → 1 kandidat: opprett direkte · 2+: flyt-velger-steg · 0: kortet var allerede dempet/uklikkbart.
3. Klient sender alltid `dokumentflytId` (aldri `undefined`).
4. Server (påkrevd felt) validerer flyt↔mal↔medlemskap; binding skjer i samme transaksjon som opprettelsen — et dokument eksisterer aldri uten flyt.

## Avgrensning
Synlighet (F2/F3) og rettigheter (F4) røres ikke — egne ledd per sekvensen i flyt-rolle-verifisering-2026-07-24.md.

## Åpent
- Kenneth: vedtak B1–B4.
- cowork: verifiser B1-premisset (andre opprett-kallveier) + mål B4-volum; gate deretter designet mot koden før kode-Opus-ordre formuleres.
