---
name: handlingslinje-redesign-verifiseringslogg
status: 🟢 Design-gate godkjent (fabel task-walkthrough 2026-07-29) — bygget + bevist, venter dok-gate + cowork-merge
eier: Opus (utførende) · fabel (design-gate) · cowork (gate + merge)
branch: feat/handlingslinje-redesign (fra develop `402b9ce4`)
ordre: delplaner/p3-handlingslinje-ordre-2026-07-29.md
sist_verifisert_mot_kode: 2026-07-29
---

# Handlingslinje-redesign (P3) — verifiseringslogg

Statuskilde for P3-arbeidet: web `DokumentHandlingsmeny` → **primær + split-▾**. Grunnlag:
`effektivitets-audit-2026-07.md § 8B` + `p3-handlingslinje-ordre-2026-07-29.md` (fabels bygge-spec).
Scope: **web only** — mobil `DokumentHandlingsmeny` urørt (egen sak V5b/P5).

## Ledd 1 — nå-sjekk (målt mot `402b9ce4`, ingen kode)

**§8B-matrisa hadde driftet.** Auditen (linje 187–198) listet fortsatt «Send» som flat handling i
`received`/`responded`/`approved` — det er **pre-§8A**. Post-P1 (§8A fjernet `received/responded/approved→sent`
fra både `isValidStatusTransition` og `ROLLE_HANDLINGER_DEFAULTS`) er «Send fram» borte. Korrigert matrise
bygget fra `hentStatusHandlinger` + `ROLLE_HANDLINGER_DEFAULTS` + `isValidStatusTransition`.

**Klikk-budsjett — korrigert baseline:** audit anga **6** (pre-§8A, m/Send); post-P1 var reell baseline
**5 flate** (received×admin: Besvar · Godkjenn · Avvis · Videresend▾ · +kommentar) → mål **2**. Rapporteres
derfor som **5 → 2**, ikke 6 → 2.

Fabels ordre-linjenumre bekreftet mot treet: flate sekundærknapper `:331-342`, split-betingelse
`draftSend && videresendValg.length > 1` (`:542/581`), person-velger `:681-727`, `trengerBekreft` (`:377`).
Dropdown-komponent å gjenbruke = lokal `DropdownMeny` (`:650`). `onSlett` wiret på begge detaljsider
(oppgave `:638`, sjekkliste `:635`). Feilende `kvittering`-test rot-årsaket: `statusKreverBegrunnelse`
inkluderer nå `in_progress` → testen klikket «Send tilbake» ×2 uten begrunnelse → confirm disabled.

## Ledd 2 — bygget (`f35952c0`)

- **Split-betingelse generalisert** fra `draftSend>1` → `primærHandling && ≥1 øvrig lovlig`. Split-▾
  (`handling-split-nedtrekk`) på primærknappen i alle statuser.
- **Flate sekundærknapper fjernet** — alle øvrige inn i `DropdownMeny`, fast rekkefølge
  **framover → destruktiv (Avvis/Slett rød, begrunnelse-dialog beholdt) → Videresend (person-velger beholdt)
  → Admin → deaktiverte**. Draft-mottakere (>1) øverst som framover-utvidelse.
- **Primær-promotering:** `aktive.find(erPrimaer) ?? aktive[0]` — status uten `erPrimaer` for rollen
  (received×godkjenner = kun Godkjenn) viser den som primærknapp. Ingen aktiv primær (ikke-eier) →
  alt bak «Flere handlinger ▾».
- **Ett-trykks utkast-slett:** `trengerBekreft` unntar `deleted` når `status==="draft"` (papirkurv = sikringen);
  `closed` + `cancelled→deleted` beholder bekreft-baren.
- **Delt kilde `hentStatusHandlinger`** — ingen per-flate if-er, ingen statusmaskin/server-endring
  (P1 eier den), `flytRolle`/tilgangskontroll urørt.
- **i18n:** 1 ny nøkkel `statushandling.flereHandlinger` (nb+en) → auto-oversatt 13 språk (15 filer).

**Kvalitet:** typecheck 0, web-test 93/93, shared-test 379/379, lint rent, `pnpm build --filter @sitedoc/web` ok.
`dokument-handlingsmeny-kvittering.test.tsx` oppdatert mot korrigert matrise (åpne split-▾ → menyvalg →
fyll påkrevd begrunnelse → bekreft). `mikrotekst-flyt-flater.test.tsx` uendret grønn.

## Gater

| Gate | Status |
|---|---|
| Nå-sjekk (cowork) | ✅ gatet grønt — driftet §8B-matrise korrigert |
| Kode + build + tester | ✅ grønt (`f35952c0`) |
| Cowork strukturell (kode) | ✅ godkjent |
| Skjermbilder — cowork-gate | ✅ godkjent (harness 01–04, se under) |
| **Fabel task-walkthrough (design)** | ✅ **godkjent 2026-07-29** |
| Dok-sync | 🔵 denne loggen |
| Cowork-merge | ⏳ P3 merger alene (P1/P2 alt på develop) |

## Matrise-rader bevist (Løype 1 dev-harness → `SiteDoc/p3-bevis/`)

Midlertidig `app/dev/harness/page.tsx` rendret den EKTE `DokumentHandlingsmeny` med eksplisitte props per
tilstand (realistisk flyt-mockdata). Harness-ruten slettet etter fangst — `git status` ren, aldri i PR.

| Bilde | Rad | Bevist |
|---|---|---|
| `p3-harness-01-received-admin.png` | received×admin | Besvar (primær) + split-▾{Godkjenn → Avvis rød → Videresend m/person-velger → Trekk tilbake} = **2 flate + kommentar** |
| `p3-harness-02-received-godkjenner.png` | received×godkjenner | Godkjenn alene, **uten split** (promotert primær) |
| `p3-harness-03-draft-registrator.png` | draft×registrator | Send (primær) + split-▾{Slett rød}, ett-trykks (ingen bekreft-bar) |
| `p3-harness-04-ikke-eier.png` | ikke-eier | «Flere handlinger ▾» → deaktiverte m/forklaring (Kun godkjenner / Kun administrator) |

**Klikk-budsjett levert: 5 → 2** (audit anga 6 pre-§8A; post-P1 baseline = 5 flate → mål 2).
