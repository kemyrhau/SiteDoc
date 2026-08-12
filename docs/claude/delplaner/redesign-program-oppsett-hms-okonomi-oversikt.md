# Redesign-program: oppsett ↔ dokumentflyt ↔ HMS ↔ økonomi — spor-oversikt

> Indeks 2026-08-04. Binder sammen root-cause + fabels retningsskisse + spor 3-rammenotat.
> Program, ikke én oppgave. Ett felles fundament + tre uavhengige spor. Ingen schema-endring forventet på spor 1–2.

## Dokumenter

| Fil | Innhold |
|---|---|
| [brukeroppsett-dokumentflyt-rotarsak-2026-08-04.md](brukeroppsett-dokumentflyt-rotarsak-2026-08-04.md) | Root-cause: 3-begreps-modell koherent i data, fragmentert i UI. Symptom-kart E–H. |
| [brukeroppsett-dokumentflyt-redesign-retning.md](brukeroppsett-dokumentflyt-redesign-retning.md) | Fabels retningsskisse: terminologi, koblingen synlig begge veier, domene-wire, HMS-linje, ordre-rekkefølge 1–6. |
| [spor3-endringsmeldinger-rammenotat.md](spor3-endringsmeldinger-rammenotat.md) | Spor 3 flagg: endringsmelding/varsel/tillegg/regningsarbeid/EO ↔ økonomi. NS 8405/06/07. Egen designrunde. |

## Struktur: fundament + 3 spor

**Fundament-ordre (felles, FØRST):** domene-wire — `gruppe.oppdaterDomener` inn på gruppe-kortet i Oppsett → Brukere (§4, Funn H). Liten, selvstendig, admin-only. Låser opp HMS-konfig. **Eneste avhengighet mellom spor 1 og 2.** Kan kjøres alene med en gang.

**Spor 1 — Gruppe/dokumentflyt-oppsett** (§2–3 + §3c). Ren oppsett/admin-flate. Terminologi (Gruppe → «Tilgangsgruppe»), koblingen (GroupFaggruppe) synlig+redigerbar begge veier, gruppe-picker ved flyt-opprett. Ingen endring i flytmodell/velger.

**Spor 2 — HMS ↔ dokumentflyt** (§5, Funn E–G). Ren bruker-flate, bygger på v2-velgeren (live). HMS inn i unifisert velger + «+ Meld HMS» som snarvei · **åpne-regel-revisjon (auto-hopp fjernes — endrer Funn C §0)** · segmentert status-filter m/ synlig «Lukket» · retur-kontekst til HMS-lista · «Hos {faggruppe}»-vokabular.

**Spor 3 — Endringsmeldinger/økonomi** (rammenotat). Egen designrunde MED kontraktsjuridiske føringer. Rekkefølge: **NS 8405/06/07-notat → begrepsmodell (varsel/TA/EO/regningsarbeid) → Kenneth-vedtak → UI-skisse.** Spørsmål 1–4 avgjør datamodellen. Ikke startet.

**Spor 4 — Kryss-firma-samarbeid (NY, Kenneth 2026-08-04).** Én dokumentflyt med medlemmer fra ulike firmaer (byggherre + entreprenør + UE i samme flyt). **Ikke bygget i dag** — cross-org blokkert (`tilgangskontroll.ts:1353`; cross-org-flow «designet [senere]» `schema:1336`). Deferrert bevisst: «ett fokus av gangen = tryggere koding». Spor 1 forutsetter samme-firma. Egen designrunde senere.

**Parallellitet:** etter fundament-ordren kan spor 1 og spor 2 kjøres uavhengig (ulike filer: oppsett-sider vs velger/HMS-lister). Spor 3 + 4 er separate/senere.

## Beslutninger — Kenneth (VEDTATT 2026-08-04)

1. **Terminologi:** «dokumentflyt» beholdes (konsistent — liste=utvidet=samme flyt). Access-gruppe → «Tilgangsgruppe» (låses i §2). **Brukere → «Kontakter»** (samle til én kontaktliste som viser tilhørighet; inkonsistensen finnes alt: nav «Brukere» vs overskrift/data «Kontakter»).
2. **Åpne-regel:** auto-hopp fjernes **overalt inkl. sjekkliste** (én regel: ≥1 → velger). Funn C §0 pkt 3 oppdateres.
3. **Kobling Tilgangsgruppe↔Faggruppe:** redigerbar fra **begge sider**.

Spor 3-spørsmålene (NS-nivå, varsel↔EO) + kryss-firma (spor 4) avgjøres når de sporene starter.

## Status

Program rutet + dokumentert. **Spor 1 konsolidert til fabel** (terminologi låst + kontaktliste + kobling begge veier). Fundament-ordren (domene-wire) er klar til nedbryting uavhengig av fabel. Flytmodell + Funn A/C/D + v2 upåvirket. Prod fast-follow (Funn D+v2) fortsatt åpen.
