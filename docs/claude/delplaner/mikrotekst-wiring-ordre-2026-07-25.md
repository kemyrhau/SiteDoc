---
name: mikrotekst-wiring-ordre
status: 🟢 BYGGEORDRE for kode-Opus — wirer mikrotekst-hover på flyt-matrisen + dokumenthandlingsknappene. 2026-07-25
eier: cowork (ordre + gating) · kode-Opus (bygger)
base: origin/develop @ 4887d601 (Tooltip v2 + rev.2-spec inne)
spec: docs/claude/delplaner/mikrotekst-flyt-flater-spec-2026-07-25.md (fabel rev.2 — LES DEN FØRST)
---

# Byggeordre — mikrotekst-wiring (flyt-matrise + dokumenthandlingsknapper)

## Kontekst

Kenneth fant på prod at `Besvar`/`Send`-knappene ikke sier **hvem** handlingen går til, og at flyt-matrisen ikke forklarer hva hver overgang gjør. fabel har skrevet mikrotekst-spec-en (rev.2, gatet av cowork). Tooltip v2 er bygget + merget til develop. Denne ordren wirer teksten inn på **to web-flater** via Tooltip v2. Én delt tekstkilde `flythjelp.*` — matrisen og knappene leser samme nøkler.

**LES FØRST:** `docs/claude/delplaner/mikrotekst-flyt-flater-spec-2026-07-25.md` (fasit for ordlyd + mapping) og `docs/claude/retningslinjer/tooltip-hjelpetekst-veileder.md` § 2 (Tooltip v2-API) + § 3/§ 3a (mikrotekst-standard).

## Ufravikelig

- **Ingen hardkodet tekst i komponentene** — alt via `t("flythjelp....")`. Nøklene legges i `packages/shared/src/i18n/nb.json` + `en.json`, deretter auto-oversettes de 13 andre språkene fra `packages/shared`: `pnpm dlx tsx src/i18n/generate.ts` (oversetter fra `en.json`-master). Verifiser at nb+en har alle nøklene FØR generate.
- **Tooltip v2 er komponenten** (`@sitedoc/ui` → `Tooltip`). Ingen ny `title=` innføres på disse to flatene. Bruk `tittel`-prop for fet linje, `tekst` for brødtekst, `side`/`delayMs` etter behov.
- **Display-only.** Denne ordren endrer IKKE mutasjons-/rutingslogikk, IKKE server, IKKE `mottakerForStandard()`-beregningen. Kun visning (hover/inline-tekst). Den døde klient-`mottaker` på besvar er egen BACKLOG-sak — IKKE rør den her.
- **HMS utenfor scope.** `HmsHandlingsflate` / `domain="hms"` er eget spor. Denne ordren gjelder den generelle `DokumentHandlingsmeny` + flyt-matrisen.
- Norsk bokmål (æ/ø/å), `t()`-i18n, ingen `any`, named exports. Ikon-props `JSX.Element`.

## Steg 1 — i18n-nøkler (`flythjelp.*`)

Legg til i `packages/shared/src/i18n/nb.json` (fasit) + `en.json` (oversett). **Kilde: spec § «Delt tekstkilde», nb-fasit er ordrett i spec-tabellene.**

`flythjelp.handling.*` (17 nøkler): `opprett`, `send`, `slettKladd`, `trekkTilbake`, `besvar`, `besvarSisteLedd`, `avvis`, `sendTilbake`, `godkjenn`, `sendTilbakeUtforer`, `gjenoppta`, `sendPaaNytt`, `lukk`, `gjenapne`, `videresend`, `slettTrukket`, `autoMottatt`. Brødtekst ordrett fra spec § «Handlingstekster». `{{mottaker}}` beholdes som literal placeholder i strengen — klienten erstatter den ved rendering (se steg 2/3).

`flythjelp.fallback.*` (4 nøkler): `nesteMottaker` = «neste mottaker i flyten», `avsender` = «den som sendte det til deg», `utforer` = «den som svarte», `videresendMottaker` = «en person/faggruppe i en annen flyt».

Erstatnings-hjelper: lag en liten ren funksjon (f.eks. i `packages/shared` eller lokalt der teksten brukes) som tar `t("flythjelp.handling.X")` + et mottaker-navn og bytter `{{mottaker}}` → navn. Ingen `{{mottaker}}` skal lekke til skjerm.

## Steg 2 — Flate 1: matrise-hover (`apps/web/src/app/dashbord/admin/flyt-rettigheter/page.tsx`)

**Én hover per rad**, på handlingsetiketten i Handling-kolonnen — linje 214 (`<td …>{t(rad.labelNoekkel)}</td>`) og auto-raden linje 165–177.

For hver `MATRISE_RADER`-rad:
- Wrap etikett-teksten i `<Tooltip tittel={…} tekst={…} side="right">`.
- **Tittel** = `` `${t(rad.labelNoekkel)} → ${t(STATUS_LABEL_NOEKKEL[rad.til])}` `` (f.eks. «Send → Mottatt»). **KONFLIKT-AVKLARING (cowork):** `STATUS_LABEL_NOEKKEL` dekker kun fra-statusene — til-statusene `closed`/`deleted`/`forwarded` mangler. Legg til `flytmatrise.status.{closed,deleted,forwarded}` = «Lukket»/«Slettet»/«Videresendt» (nb; en Closed/Deleted/Forwarded, auto-oversett) + tilsvarende i `STATUS_LABEL_NOEKKEL`. For `opprett`-raden: bruk kladd-etiketten (`flytmatrise.status.draft`) som «ny status» → «Opprett → Kladd», ingen egen opprett-status-nøkkel. Rå engelsk-fallback (`?? rad.til`) er FJERNET — ingen engelsk skal lekke.
- **Brødtekst** = `flythjelp.handling.<key>` med `{{mottaker}}` fylt av den relasjonelle **fallback-benevnelsen** (matrisen kjenner ingen konkret person). Fallback per handling: se spec § «Fallback-benevnelser» kolonne «Brukes av».
- **rad → key-mapping:** se spec § «Rad → nøkkel-mapping» (linje 64–81). Implementér mappingen der den hører hjemme — helst som et felt/oppslag knyttet til `MATRISE_RADER` i `flytmatrise-def.ts` (f.eks. `flythjelpNoekkel` + `fallbackNoekkel` per rad), så matrise og definisjon ikke drifter. `received/in_progress → responded` bruker alltid `besvar` (ikke siste-ledd-varianten — det er en knappe-flate-sak).
- **Trigger-styling:** handlingsordet får prikket understrek (`underline decoration-dotted underline-offset-[3px] decoration-gray-400/40`) + `cursor-help`. Tooltip v2 gir `tabindex`/`aria-describedby` automatisk.

Auto-raden **sent→received** («A»-merket, i `AUTO_OVERGANGER`): samme hover med `flythjelp.handling.autoMottatt`. Ingen `{{mottaker}}`-fylling nødvendig (teksten har ingen). **KONFLIKT-AVKLARING (cowork):** `AUTO_OVERGANGER` inneholder OGSÅ `received→in_progress`, men den er en **fantom** — cowork-verifisert at serveren kun auto-fyrer `sent→received` (effektivStatus sjekkliste.ts:1077 + oppgave.ts:1222); `received→in_progress` fyres aldri. **La received→in_progress-raden stå helt urørt — ingen hover, ingen fjerning.** Om den bør auto-nås er et design-spørsmål (livssyklus-backlog), ikke denne ordren.

## Steg 3 — Flate 2: dokumenthandlingsknapper (`apps/web/src/components/DokumentHandlingsmeny.tsx`)

**Kun web** (mobil er utsatt — cowork måler layout først). Wrap primærknapp, sekundærknapper og nedtrekks-oppføringer i Tooltip v2.

- **Tittel** = `` `${t(handlingens labelNoekkel)} → ${t(status-label for nyStatus)}` `` (samme mønster som matrisen; bruk komponentens eksisterende status-label-oppslag).
- **Brødtekst** = samme `flythjelp.handling.*`-nøkkel som matrisen, men `{{mottaker}}` fylles med **resolvert navn** når tilgjengelig, ellers fallback-benevnelsen.
- **tekstNoekkel → key + navn-resolusjon:** se spec § «tekstNoekkel → nøkkel + navn-resolusjon» (linje 99–116). Nøkkelpunkter:
  - `besvar`: ved `erSisteBoks` → `besvarSisteLedd`; navn = `ledd[aktivtIndex - 1]?.navn`, ellers fallback `avsender`. **Dette er server-sannheten** (server ruter besvar til `sisteTransfer.senderId` = forrige avsender). Bruk IKKE `mottakerForStandard()` for hover-navnet.
  - `avvis` / `sendTilbake`: navn = `ledd[aktivtIndex - 1]?.navn`.
  - `trekkTilbake`: `finnMottakerNavn(flytMedlemmer, recipientUserId, recipientGroupId)`.
  - `sendPaaNytt`: `ledd[aktivtIndex + 1]?.navn`.
  - `sendTilbakeUtforer`: `finnMottakerNavn` mot forrige mottaker hvis tilgjengelig, ellers fallback `utforer`.
  - `send` (kladd): `videresendValg[0].visningsnavn` kun ved entydig valg, ellers fallback `nesteMottaker`.
  - `godkjenn`, `gjenoppta`, `lukk`, `gjenapne`: ingen `{{mottaker}}` i teksten — bare vis brødteksten.
  - `videresend`: valgt oppførings `visningsnavn`; fallback `videresendMottaker` på selve Send-knappen.
- **Bekreft/nudge-modus** (closed/deleted/retur — der komponenten viser et bekreftelses-/kommentarsteg): vis brødteksten **inline** (liten, `text-gray-500`) over kommentarfeltet i stedet for hover. I en bekreftelse skal konsekvensen ikke gjemmes bak hover (§ 3a).
- **Send-oppføringene** i nedtrekket viser allerede mottakernavn — ingen ekstra hover der. Person-radene likeså.
- **Nedtrekkets deaktiverte rader:** migrer dagens nativ `title=` (begrunnelse) til Tooltip v2 (samme fil, § 2-sweep). Behold ordlyden.

## Utenfor scope (IKKE gjør)

- Mobil `DokumentHandlingsmeny` (utsatt — cowork måler plass).
- Cellenes `title=` i matrisen (metaTekst «overstyrt av»/tilbakestill) — egen § 4 `title=→Tooltip`-sweep (med NavSidebar). IKKE migrer dem her.
- Server/mutasjon/`mottakerForStandard()`-endring — egen BACKLOG-sak.
- HMS-flaten.

## DoD

- [ ] `flythjelp.handling.*` (17) + `flythjelp.fallback.*` (4) i nb + en, ordrett fra spec; 13 språk auto-oversatt via `generate.ts`.
- [ ] Flate 1: hver matrise-rad + auto-raden har Tooltip v2-hover (tittel = handling → ny status, brødtekst = flythjelp med fallback-benevnelse). Prikket understrek + `cursor-help`.
- [ ] Flate 2 (web): primær/sekundær/nedtrekks-knapper har hover med resolvert navn/fallback per resolusjonstabellen; besvar bruker `ledd[aktivtIndex-1]`/`avsender` (ikke `mottakerForStandard`); bekreft-modus viser inline. Deaktiverte nedtrekksrader migrert til Tooltip v2.
- [ ] Ingen `{{mottaker}}` lekker til skjerm; ingen hardkodet tekst; ingen ny nativ `title=` på de to flatene.
- [ ] `pnpm --filter @sitedoc/web typecheck` grønt; `pnpm --filter @sitedoc/web test` grønt; ny/oppdatert test som verifiserer at en matrise-rad rendrer forventet brødtekst + at besvar-knappen bruker avsender-navnet (renderToString-nivå der mulig).
- [ ] Vis diff. Push `feat/mikrotekst-flyt-flater`. **Ikke merge** (cowork gater fra origin + kontroll-Claude merger). **Ikke rør** STATUS-AKTUELT.md / BACKLOG.md (cowork-filer).
