---
name: timer-mobil-f2f3f5-spec
description: Konsolidert spec for tre mobil-timeføring-fikser fra Kenneths feltfunn på del-6-timeføring (#39-ekvivalent bygg) — F2 byggeplass-velger tri-tilstand, F3 byggeplass per timer-rad (prosjekt/byggeplass-modal), F5 matpause-avhuking (flyttbar, kun én/dag). IKKE det samme som navigasjons-F1-F5 i f1-f5-arbeidstre-manifest.md.
status: 🟢 DESIGN-OK (fabel 2026-07-14) — byggeordre til develop-Opus sendt
sist_verifisert_mot_kode: 2026-07-14
branch_base: develop b37f9887 (Byggeplasser-hub merget her — se § Tverrgående)
eier: cowork (spec) · fabel (design-gate) · develop-Opus (bygg)
---

# Mobil timeføring — F2/F3/F5-spec

> ⚠️ **Navnekollisjon:** «F2/F3/F5» her er **feltfunn fra Kenneth på del-6-timeføringen** (mobil), IKKE navigasjons-redesignets F1–F5+F2 i [f1-f5-arbeidstre-manifest.md](f1-f5-arbeidstre-manifest.md). Disse to F-nummereringene er urelaterte.

## Opphav

Kenneth testet del-6-timeføring på et #39-ekvivalent bygg (commit `cd3efcb5`-innhold) og rapporterte ni skjermbilde-funn. Etter grunngitt diagnose (kode + git + device-SQL) står tre igjen som byggbare mobil-fikser: **F2, F3, F5**. Resten er lukket, parkert eller uendret (§ Kontekst nederst).

## Tverrgående hensyn (fabel-gitt, ufravikelig)

1. **Branch-base ≥ develop `b37f9887`.** Fabels «Byggeplasser-discoverability»-hub er merget der (er develop-tip 2026-07-14). F2/F3/F5-branchen kuttes fra `b37f9887` eller nyere. Da ligger fabels i18n-nøkler i basen, og `nb/en.json` auto-merger rent (nøkler i ulike regioner).
2. **Filisolasjon:** F2/F3/F5 er **kun `apps/mobile`**. Fabels arbeid er web (`innstillinger-kort.tsx`, `useSokRegistry.ts`) + i18n. Eneste delte fil = `packages/shared/src/i18n/{nb,en}.json`. Ingen TS-kodekonflikt.
3. **Begrepsvedtak (Kenneth):** «**Byggeplasser**» i all synlig copy — aldri «lokasjoner». **Gjenbruk eksisterende i18n-nøkler** der de finnes; ikke lag synonym-duplikater. Nye nøkler legges i **nb + en manuelt**, øvrige 13 språk får **nb-fallback**.
4. **Gate-flyt:** denne spec-en → **fabels design-gate** → develop-Opus bygger → cowork dual-review-gate før commit til develop. F2/F3/F5 er UI-endringer i redesignets domene.

---

## F2 — Byggeplass-velger: tri-tilstand tom-visning

**Problem.** Velgeren viser «Ingen byggeplasser funnet» uansett årsak (`byggeplassVelger.ingen`, `nb.json:893`, rendret `ByggeplassVelger.tsx:126`).

**Rotårsak (grunnet — kode + device).** Ikke manglende data. Byggeplasser synkes av `triggerKatalogRefresh` (`TimerSyncProvider.tsx`), som er **online-gated** (`if (!bruker?.id || !erPaaNettet) return`, L97), **async**, og fyrer på login/online (L158) + foreground (L167). Velgeren leser lokal cache (`hentByggeplasserForProsjektLokalt`, `byggeplassKatalog.ts:108`). Device-verifisert (simulator-Opus, 2026-07-14): `byggeplass_local` hadde 4 korrekte rader for Markussen-sedelen, eksakt org+`projectId`-match, velgeren renderte dem. Den tomme visningen Kenneth så var altså et **legitimt vindu**: offline eller før første sync fullførte.

**Beslutning (Kenneth).** Skill de tre tilstandene i stedet for én misvisende melding:

| Tilstand | Betingelse | Melding (copy → fabel) |
|----------|-----------|------------------------|
| Tom cache + online | henter | «Henter byggeplasser …» (spinner) |
| Tom cache + offline | ikke nåbar | «Ingen tilkobling — byggeplasser hentes neste gang du er på nett.» |
| Bekreftet tomt | refresh fullført, 0 rader | «Prosjektet har ingen byggeplasser ennå. De opprettes i Innstillinger › Byggeplasser på web.» |
| Har data | ≥ 1 rad | (vis lista — uendret) |
| Søk uten treff | egen tilstand | dagens «Ingen treff» beholdes |

Bonus: når velgeren åpnes med tom cache + online, bør den **trigge en byggeplass-refresh** (ikke bare vente på neste foreground).

**Kodeanker.** `ByggeplassVelger.tsx` (L126 tom-visning), sync-signal fra `TimerSyncProvider` (`katalogLastet`/`erPaaNettet`), `byggeplassKatalog.refreshByggeplassKatalog`.

**i18n.** Nye nøkler `byggeplassVelger.lastes` / `.offline` / `.prosjektMangler` (nb+en). Gjenbruk eksisterende der mulig. «Byggeplasser»-begrep.

**Design (fabel-OK 2026-07-14).** Copy per tabellen over (nye `byggeplassVelger.*`-nøkler). **Auto-refresh: ja** — ved åpning med tom cache + online (rotårsaksfiksen på sync-timing). «Bekreftet tomt» (tilstand 3) vises **kun etter** at refresh har fullført tomt, aldri før.

---

## F3 — Byggeplass per timer-rad (prosjekt/byggeplass-modal)

**Beslutning (Kenneth).** Byggeplass velges **per timer-rad**. Rad-feltet viser «**prosjekt / byggeplass**», og «endre» åpner **én** modal der begge velges (byggeplass innenfor valgt prosjekt). Ingen ekstra vindu — bare endret visning + utvidet modal.

**Grunnlag.** Schema støtter det: `sheet_timer.byggeplassId` (`packages/db-timer` schema:203, kommentar «T.2 — Per-rad byggeplass … byggeplass-NULL er gyldig»). Byggbart nå for ethvert prosjekt med byggeplasser; mega-prosjektet (100 byggeplasser) er fremtidig bruk, men funksjonen er ikke avhengig av det.

**Hierarki (Kenneth).** Prosjekt → byggeplass **innenfor** prosjekt. Byggeplass-valget bærer alltid prosjektet.

**Kodeanker.** Rad-modal `TimerSeksjon.tsx` (prosjekt-felt L797-802 + `ProsjektVelgerModal` L939). Gjenbruk `timer-detalj/ByggeplassVelger.tsx` (i dag sedel-nivå, `app/timer/[id].tsx:844`). Ny/utvidet kombinert prosjekt+byggeplass-modal.

**i18n / begrep.** «Byggeplasser» i copy; gjenbruk eksisterende nøkler.

**Design (fabel-OK 2026-07-14).**
- Én `pageSheet` (gjenbruk dagens modal-skjelett): øverst prosjekt-rad (valgt prosjektnavn + chevron; trykk ekspanderer prosjektlisten **inline**), under byggeplass-lista filtrert på valgt prosjekt — dagens F6-sortering (favoritter → GPS-forslag → resten) + søkefelt-terskel (>7) intakt. **Ikke** to-stegs wizard; prosjektbytte oppdaterer lista på stedet.
- Rad-felt: sekundærlinje på rad-kortet «Prosjekt · Byggeplass» (grå, 12–13px) + chevron høyre; hele linja er trykkflate, min 44px høy. **Ingen** egen «endre»-knapp.
- **Begge lever.** Sedel-nivå (`[id].tsx:844`) forblir default + vanligste vei (server propagerer til rader); per-rad er override for multi-prosjekt-dager. Rad uten override viser arvet verdi **nedtonet** med «fra dagskortet»-hint; override i vanlig tekststyrke. Sedel-nivå-velgeren fjernes ikke.

---

## F5 — Matpause-avhuking (flyttbar, kun én per dag)

**Beslutning (Kenneth).**
- Avhukingen vises **først når regelen trigger** (dagen passerer 5,5t-terskelen OG arbeidet krysser 4,0t-pausevinduet).
- **Auto-avhuket «på»** på det aktuelle kortet.
- Arbeider kan huke **av** → pausen flyttes, forhåndsvalgt «på», til **neste registrering**.
- **Kun ett kort** bærer pausen: avhuket på én rad → skjul/deaktivér på de andre.

**Underliggende pause-modell (dokumentert + deployet — beholdes).** To regler i `packages/shared/src/utils/pauseBeregning.ts`:
1. **Hvor pausen faller (vindu):** skiftstart + `DEFAULT_PAUSE_ETTER_TIMER` (4,0t) → 07:00-start = 11:00–11:30. Start-relativt.
2. **Om pausen gjelder (terskel):** `PAUSE_TERSKEL_TIMER` (5,5t) via `pauseMinForDag` (AML §10-9). Kenneth: **beholdes** («så lenge det fungerer endrer vi ikke»).

Fordelingen skjer i `fordelArbeidstidFradrag` (`StartSluttDagKort.tsx:449`, lengste-først). F5-avhukingen gir arbeider kontroll over **hvilket kort** som bærer pausen.

**Merk — #8 er lukket:** «5t → Til 12:30» er korrekt per vindusmodellen (07:00–11:00 + lunsj 11:00–11:30 + 11:30–12:30 = 5t netto). Var Kenneths telling, ikke en bug.

**Kodeanker.** `StartSluttDagKort.tsx` (`fordelArbeidstidFradrag`), `pauseBeregning.ts`, kort-/rad-UI for avhukingen.

**Design (fabel-OK 2026-07-14).**
- Kompakt rad nederst på det **trigrede** rad-kortet: checkbox + «Matpause trukket (30 min)» — kun synlig når regelen trigget. Ikke eget kort/seksjon.
- Kun-én-per-dag håndheves som **flytt**, ikke radio-UI: huker bruker AV på raden med trekket → flyttes automatisk til neste kvalifiserte rad + toast «Pausen trekkes i [neste rads tidsrom]». Ingen kvalifisert rad igjen → bekreftelsesdialog «Ingen pause trekkes for dagen — sikker?» (AML-varsel, ikke-blokkerende, ekte modal ikke `confirm()`). Huker bruker PÅ på annen rad → trekket flyttes dit (forrige hukes av stille).

---

## Kontekst (ikke i denne runden)

- **F1 — byggeplass i topbar:** **beholdes uendret** (informerer autovalg). Byggeplass-opprettelse finnes (`apps/api/src/routes/byggeplass.ts` `opprett` + `Byggeplass`-modell schema:748; geofence fra georeferert tegning, Fase 1c). Hierarki prosjekt→byggeplass.
- **F4 — GPS-fri autovalg-fallback for prosjekt:** **parkert** → egen GPS-testplan. Autovalg er i dag geo-basert (Haversine 500 m), likt #38/#39 — ikke rør GPS uten åpenbar feil.
- **5,5t-gate spec-note (verifisert gap 2026-07-14):** den deployede 5,5t-terskelen (`PAUSE_TERSKEL_TIMER`, F-e) er dokumentert i STATUS-AKTUELT L27 + BACKLOG § F-e, men **mangler i pause-modell-referansen** — grep av [timer.md](timer.md) + [mobil-dagsseddel-ui-spec.md](mobil-dagsseddel-ui-spec.md) gir 0 treff på `5,5`/`PAUSE_TERSKEL`/`§10-9`. De beskriver kun 4,0t-vinduet → en leser tror pause alltid gjelder. **Fold inn i F5s pause-modell-docs-oppdatering** (F5 rører modellen uansett). Ikke kodeendring.

## Hva trenger hva

| Finding | Fabel design-ok | Develop-Opus bygg |
|---------|-----------------|-------------------|
| F2 tri-tilstand | Copy (3 tilstander) + auto-refresh-valg | `ByggeplassVelger.tsx` + sync-signal |
| F3 prosjekt/byggeplass-modal | Modal-layout + rad-visning + sedel-vs-rad | `TimerSeksjon.tsx` + `ByggeplassVelger.tsx` + schema T.2 |
| F5 matpause-avhuking | Avhukingens plassering + flytt-interaksjon | `StartSluttDagKort.tsx` + `pauseBeregning.ts` |
