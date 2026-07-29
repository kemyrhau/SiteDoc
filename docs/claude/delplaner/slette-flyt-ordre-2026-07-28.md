# Ordre — slette-flyt forenkling (utkast ett trykk) + mobil utkast-sletting (fabel, 2026-07-28)

> Kenneth-funn 2026-07-28 (prod-test web + mobiltest fase 2). Første sak under Effektivitets-gaten (FABEL-RAMMEVERK § Effektivitets-gate). Cowork ruter (develop-nær, liten) og sekvenserer mot A/C-øktene.

## Funn [Kenneth-målt, skjermbilder 2026-07-28]
- **Web:** sletting av UTKAST krever 3 steg — Slett → skriv «slett» i bekreftelsesfelt → Bekreft. Dokumentet går til papirkurv med 90 dagers gjenoppretting (tooltip bekrefter). Skriv-bekreftelse oppå soft-delete = dobbel sikring oppå sikkerhetsnett.
- **Mobil:** utkast kan ikke slettes i det hele tatt.

## Klikk-budsjett (per Effektivitets-gaten)
- I dag: web 3 interaksjoner (+ presisjonskrav skriving); mobil ∞ (umulig). **Mål: 1 trykk** (+ angre-mulighet).

## Oppdraget
1. **Utkast (web + mobil): ett-trykks sletting** med angre-toast (eller papirkurv-lenke i toast). Ingen bekreftelsesdialog, ingen skriving. Begrunnelse: utkast er ikke delt med noen; papirkurven er sikringen.
2. **Ikke-utkast (web):** behold ett bekreftelsessteg (Bekreft/Avbryt-knapp), men FJERN skriv-«slett»-kravet — papirkurv + 90 dager er sikkerhetsnettet. Valgfri kommentar beholdes.
3. **Mobil:** utkast-sletting bygges (mangler helt) — samme ett-trykks-regel; nå-sjekk hvorfor den mangler (bevisst gating eller hull?) og oppgi søkerom.
4. Server-side: verifiser at slette-retten håndheves der (eier/admin) — UI-forenkling skal ikke svekke tilgangskontroll.

## Ufravikelig
- Rotårsak/delt kilde: slette-bekreftelsen er trolig delt komponent — endre regelen ETT sted, per dokumentstatus.
- i18n alle nye strenger. Angre-toast: eksisterende toast-mønster gjenbrukes.
- Rør ikke papirkurv-/gjenopprettingslogikken.

## Gate
Nå-sjekk → kode → build grønn → skjermbilder/skjermopptak (web utkast, web ikke-utkast, mobil) + rapportert klikk-tall mot budsjett → fabel-designgate (task-walkthrough) → dok-sync → cowork-merge.

---

## Cowork-reconciliation (kode-diagnose 2026-07-28 — premiss-korreksjon FØR bygging)

Cowork kjørte en kode-diagnose (statisk, fil:linje). Ordrens funn-beskrivelse er bygget på Kenneths symptom og bommer på ett viktig punkt — utførende Opus verifiserer alt i nå-sjekken, men bygg på dette bildet:

1. **Primær web-bug ordren IKKE navnger — dette er fiks #1:** utkast-sletting er ikke «3 tunge steg», den **gjør ingenting**. `onSlett`-propen sendes ALDRI til `DokumentHandlingsmeny` på oppgave-detaljsiden (`apps/web/src/app/dashbord/[prosjektId]/oppgaver/[oppgaveId]/page.tsx:593-620`). Koden bruker `onSlett?.()` (optional chaining) → «Bekreft» = stille no-op → oppgaven blir stående. Sjekkliste-siden gjør det riktig (mønster å speile: `const slettMutasjon = trpc.oppgave.slett.useMutation({onSuccess: invalidér hentForProsjekt + naviger bort})` + `onSlett={() => slettMutasjon.mutate({id: params.oppgaveId})}`, jf. `sjekklister/[sjekklisteId]/page.tsx:204,625`).

2. **Det finnes INGEN «skriv slett»-krav.** Feltet i bekreft-baren er «Valgfri kommentar» (optional — `draft`/`deleted` er ikke i `statusKreverBegrunnelse`). Kenneth skrev «slett» selv, men det var aldri påkrevd. Ordrens pkt 2 «fjern skriv-slett-kravet» gjelder en ikke-eksisterende regel. **Reframe:** bekreft-baren er Slett→Bekreft = 2 klikk (kommentar allerede valgfri). For draft: hopp over HELE bekreft-baren (`trengerBekreft` i `DokumentHandlingsmeny.tsx:369`, f.eks. `nyStatus==="deleted" && status!=="draft"`). For cancelled (eneste ANDRE slettbare tilstand — `oppgave.slett`-guarden tillater kun draft+cancelled): behold ett Bekreft-steg.

3. **API + migrering + tilgang er alt på plass** (pkt 4 er verifisert, ikke å bygge): `oppgave.slett` (`apps/api/src/routes/oppgave.ts:1540-1575`) soft-deleter (`deletedAt`+`deletedById`), guard tillater draft+cancelled, migrering `20260725120000_softdelete_checklist_task` finnes, lista filtrerer `deleted_at IS NULL`. Server-retten håndheves alt i mutasjonen.

4. **Klikk-budsjett reframe:** web draft i dag = teknisk 0-effekt (bug), ikke «3 steg». Etter fiks: 1 trykk. Mobil: bygges (mangler helt — nå-sjekk hvorfor).

5. **Sekvensering (cowork eier):** kolliderer med **C/P2** (`DokumentHandlingsmeny.tsx` web+mobil + `oppgaver/[oppgaveId]/page.tsx`). **Bygg oppå P2 ETTER at P2 merger** — ikke start før cowork gir GO. Diagnose-detalj: cowork-subagent 2026-07-28 (matcher symptom eksakt).
