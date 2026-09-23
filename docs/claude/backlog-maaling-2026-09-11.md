---
status: midlertidig
sist_verifisert_mot_kode: 2026-09-11
sist_endret: 2026-09-11
gjelder_versjon: tverrgående
avhenger_av:
  - BACKLOG.md
slettes_når: cowork har gatet hvilke rader som lukkes og merge-agenten har ført dem inn i BACKLOG.md
---

# Måling: BACKLOGs seks 🔴-rader mot kode (2026-09-11)

**Målt mot:** `origin/develop` @ `60ef9853` · branch `docs/backlog-maaling-2026-09-11`.
**Metode:** to søkeformer pr. rad (funksjonsnavn + symptom/nabokode). Ren måling —
ingen kodeendring. Radene fant jeg på overskrift; linjenummer i BACKLOG er coworks
måling 2026-09-11 og flere har flyttet seg.

🔴 **Denne fila redigerer ikke BACKLOG.md.** Cowork gater hvilke rader som lukkes.

## Sammendrag

| § | Overskrift (forkortet) | Dom |
|---|---|---|
| 220 | MOBIL-PSI vises fullført selv når serveren avviste | 🟢 **LEVERT** |
| 763 | Tretten uferdige koblinger bak lint-gjelden | ⚠️ **DELVIS** — 2 levert, 9 fortsatt ekte, 2 grensetilfeller |
| 825 | Offline gjelder tegninger, ikke dokumenter | ⚠️ **DELVIS** — sjekkliste levert i dag; oppgave + HMS fortsatt ekte |
| 610 | i18n-generatoren bærer 132 nøklers drift | 🔴 **FORTSATT EKTE** |
| 1388 | Signerte vedlegg-URL-er persisteres i `Checklist.data` | 🔴 **FORTSATT EKTE** |
| 1461 | P1 Posisjonsmodell-restansen | 🔴 **FORTSATT EKTE** (kun linjenumre driftet) |

---

## § 220 — MOBIL-PSI vises fullført selv når serveren avviste · 🟢 LEVERT

Arbeidseksempelet. Signeringsgrenen i `apps/mobile/app/psi/[psiId].tsx` er nå riktig ordnet:

- `:203-208` `await fullforMut.mutateAsync(...)` — sendingen kjøres FØRST.
- `:209-211` `catch → Alert.alert(...) + return` — feiler sendingen, markeres seksjonen **ikke** fullført.
- `:213` `setSeksjonFullfort(...)` — kjører KUN etter serverbekreftelse (inne i try, etter await).
- Kommentar `:198-200` sier uttrykkelig at serveren MÅ bekrefte før markering. Speiler web `2ee6e343`.

Den gamle rekkefølgen BACKLOG beskriver (`setSeksjonFullfort` på `:189` før `mutateAsync`) finnes ikke lenger.
Levert via `fix/stille-mutasjoner` (merget — `apps/mobile/app/psi/[psiId].tsx` var kontrollplans fil der).

**Søkeformer:** funksjon `gåTilNeste`/`setSeksjonFullfort` · symptom «grønn progresjon / seksjon fullført» + `mutateAsync`-rekkefølge.

---

## § 763 — Tretten uferdige koblinger · ⚠️ DELVIS

To av de tretten er koblet inn siden 2026-09-08 (faggruppe-medlemskap-flaten). Ni består. To er grensetilfeller.

| # | Symbol | Dom | Bevis (fil:linje) | Søkeform 1 | Søkeform 2 |
|---|---|---|---|---|---|
| 1 | `fjernMutation` → `fjernFaggruppeMutation` | 🟢 LEVERT | `PersonKort.tsx:135` (mutation+onSuccess), sett mål `:359`, `mutate :612` | `fjernMutation` (0 treff) | `fjernFraFaggruppe` |
| 2 | `tilgjengeligeFaggrupper` (brukere-flate) | 🟢 LEVERT | `PersonKort.tsx:177` `ledigeFaggrupper`, rendret+wiret `:367-382` (`leggTilFaggruppeMutation :134`) | `tilgjengeligeFaggrupper` | `ledigeFaggrupper`/`leggTilFaggruppe` |
| 3 | `FaggruppeVelger` | 🔴 FORTSATT EKTE | `import-dialog.tsx:16` kun import; state `faggruppeId :70` aldri brukt; `<FaggruppeVelger>` rendres aldri | `FaggruppeVelger` | `faggruppeId` |
| 4 | `tilgjengeligeBygninger` | 🔴 FORTSATT EKTE | `oppsett/produksjon/psi/page.tsx:95` kun deklarert; søster `tilgjengeligeKopierBygninger` brukes `:315/332/340` | `tilgjengeligeBygninger` | `KopierBygninger` |
| 5 | `harScrolletNed`/`innholdKortNok` | ⚠️ SLETTET (ikke uferdig) | `psi/[prosjektId]/page.tsx:402` kommentar: scroll-krav «fjernet bevisst i `547261c4` (2026-04-03)». Symbolene finnes ikke — verken hull eller levert, koden er borte | `harScrolletNed`/`innholdKortNok` (0 treff) | `scroll`/`bunn`/`gate` |
| 6 | `pauseTimer` | 🔴 FORTSATT EKTE | `SeddelKort.tsx:163` `const pauseTimer = sedel.pauseMin/60` — aldri referert/rendret | `pauseTimer` | `pauseMin` |
| 7 | `verdi` (SignaturWeb) | 🔴 FORTSATT EKTE | `psi/[prosjektId]/page.tsx:666` prop `verdi`; canvas gjenoppretter den aldri (kun `onEndre(toDataURL()) :709`) | `verdi` (SignaturWeb) | `canvas`/`toDataURL` |
| 8 | `mappeNavn` (TilgangModal) | 🔴 FORTSATT EKTE | `box/page.tsx:109/114` destrukturert i TilgangModal, aldri rendret i modal-body (`SpraakModal :575` viser eget mappeNavn — annen komponent) | `mappeNavn` | `TilgangModal` |
| 9 | `nyMalId` (psi-siden) | 🔴 FORTSATT EKTE | `oppsett/produksjon/psi/page.tsx:79` — `setNyMalId` aldri kalt; mal-select `:365` bruker `value=""`+`byttMalMut :369` (RedigerPunktDialog har egen wiret `nyMalId` — annen komponent) | `nyMalId`/`setNyMalId` | `velgMal`/`byttMal` |
| 10 | `t` (RedigerPunktDialog/HistorikkSeksjon) | ⚠️ DELVIS | `RedigerPunktDialog.tsx:563` `t` brukes for noen strenger (`:587`,`:591`), men `handlingLabel :570-576` er fortsatt hardkodet norsk (Opprettet/Startet/Utført/Godkjent/Avvist/Endret) | `useTranslation`/`const t` | hardkodet `"Opprettet"`/`handlingLabel` |
| 11 | `mandagIUke` | 🔴 FORTSATT EKTE | `UkeVelger.tsx:29` — eneste treff i repo, 0 kallere | `mandagIUke` | repo-vid grep (kun def) |
| 12 | `nsDokumentIder` | 🔴 FORTSATT EKTE | `dashbord/[prosjektId]/sok/page.tsx:59` — eneste treff; ikke sendt til `aiSok.sok :74` eller `ftdSok.sokDokumenter :85`; ingen `ekskluderDokumentIder` | `nsDokumentIder` | `ekskluderDokumentIder`/`aiSok.sok` |
| 13 | `nåværendeOrgId` | 🔴 FORTSATT EKTE | `dashbord/admin/prosjekter/page.tsx:236` — eneste treff; raden bruker `p.primaryOrganization`, aldri `nåværendeOrgId` | `nåværendeOrgId` | `orgProj`/`primaryOrganization` |

**Merk:** post 13-filen ligger på `apps/web/src/app/dashbord/admin/prosjekter/page.tsx` (BACKLOG skriver «admin/prosjekter:236» — samme sted, full sti presisert).

⚠️ **Hva som skiller:** postene 1–2 (legg-til/fjern faggruppe i brukere-flaten) ER wiret nå (`PersonKort.tsx`, `ed21b640`-familien). Post 5 er hverken hull eller levert — funksjonen ble bevisst slettet i april, så BACKLOG-linjen refererer symboler som ikke finnes. De øvrige ni er uendret: deklarert, aldri koblet.

---

## § 825 — Offline gjelder tegninger, ikke dokumenter · ⚠️ DELVIS

**Endret i dag (2026-09-11):** `feat/offline-sjekklister` fase 1 (`970045d7`) er merget til develop.
Den er ancestor av `origin/develop` (verifisert med `git merge-base --is-ancestor`).

| Del | Tilstand nå | Bevis |
|---|---|---|
| Sjekkliste-lista | 🟢 **Offline-speilet nå** | `sjekkliste_local`-tabell `apps/mobile/src/db/schema.ts:615`; `sjekklisteKatalog.ts` speiler pr. prosjekt; list-skjermen leser via `velgOfflineListeKilde` (`app/sjekkliste/index.tsx:16,116`) |
| «Forbered offline»-menyen | 🟢 **Dekker sjekklister nå** | `mer.tsx:90-96` kaller `refreshSjekklisteKatalog`; tekst «Ferdig: … tegninger, … 3D-modeller, … sjekklister» |
| Oppgave | 🔴 **FORTSATT EKTE** | ren nett-tRPC `trpc.oppgave.hentForProsjekt.useQuery` (`app/oppgave/index.tsx:78`, `hjem.tsx:184`, `innboks/index.tsx:85`); ingen `oppgave_local`/`oppgaveKatalog` |
| HMS | 🔴 **FORTSATT EKTE** | ren nett-tRPC `trpc.hms.hentDokumenter.useQuery` (`app/hms/index.tsx:56`); ingen lokal speiling |

⚠️ **Hva som MANGLER:** oppgave og HMS har fortsatt ingen SQLite-speiling — samme klasse som sjekkliste var før i dag.
Radens kjernepåstand (sjekkliste + oppgave + HMS er nett-baserte) var sann da den ble skrevet 2026-09-07;
i dag gjelder den kun oppgave + HMS. **Bør snevres inn, ikke lukkes.**

**Underpunkt (853-864, chevron-uten-mål):** `mer.tsx:215` `MenyRad … visChevron={false}` — den navigerings-lovende
chevronen vises ikke lenger. Det underpunktet er adressert (ingen falsk affordans), men det finnes fortsatt
ingen liste-visning over hva som ligger lokalt.

**Søkeformer:** funksjon `sjekklisteKatalog`/`refreshSjekklisteKatalog`/`velgOfflineListeKilde` + tabellnavn `_local` · symptom `hentForProsjekt` (nett-kall) i oppgave/HMS-skjermene.

---

## § 610 — i18n-generatoren bærer 132 nøklers drift · 🔴 FORTSATT EKTE

Målt direkte mot `packages/shared/src/i18n/`: `nb.json` og `en.json` har begge **4411 nøkler**.
Hver av de 13 genererte språkfilene (`sv lt pl uk ro et fi cs de ru lv fr sq`) mangler **nøyaktig 132**
av dem — identisk tall i alle 13. Unionen av manglende nøkler = **132**. Blant dem `brukere.*`
(`brukere.leggTilFaggruppe`, `brukere.fjernFraFaggruppeTittel`, …) og `kontrollplan.*`
(`kontrollplan.fremdriftsplan.msProjectXml`, `kontrollplan.opprettPunkt.visKapitler`, …) — akkurat som BACKLOG navngir.

Generatoren uten `--only` itererer `Object.keys(nb)` og genererer alle manglende (`generate.ts` topp-doc: «kun manglende nøkler»),
så en agent som kjører den drar fortsatt alle 132 med seg. `--only`-flagget (`generate.ts:parseOnlyFlag`,
`generateArgs.ts`) finnes som per-agent-verktøy og lar en agent generere KUN egne nøkler — men de 132
drift-nøklene er fortsatt ugenerert. Tiltaket BACKLOG foreslår (generer de 132 i egen isolert runde) er ikke gjort.

**Søkeformer:** funksjon `generate.ts`/`--only`/`parseOnlyFlag` (mekanismen) · symptom: nøkkeltelling `en.json` vs. 13 språkfiler = 132 uniform.

---

## § 1388 — Signerte vedlegg-URL-er persisteres i `Checklist.data` · 🔴 FORTSATT EKTE

Rotårsaken (rå lagring av klientens `input.data`) er uendret. Linjenumre driftet (BACKLOG: 615/754/807 → nå 696/740/847/871).

Lagringsstien `oppdaterData` (`apps/api/src/routes/sjekkliste.ts:696`):
- `:740` `innData = input.data` — kun vær-felt strippes for terminale dokumenter, ellers rått.
- `:847` `merget = { ...eksisterende, ...innData }` — blind feltvis merge (eller `kollisjonsmerge` `:835`); ingen URL-normalisering.
- `:871-874` `tx.checklist.update({ data: merget })` — lagrer det rått.
- `:884` `signerDataRad(oppdatert)` re-signerer vedlegg-URL-ene på VEI UT → klienten får `?exp=&sig=` og sender det tilbake ved neste lagring → signaturen persisteres.
- `grep -c 'split("?")'` i `sjekkliste.ts` = **0**. Ingen query-stripping i lagringsstien (til forskjell fra `disk-bilde.ts`/`hmac.ts` på serve-siden).

**Radens to «mål før fiks»-spørsmål:**
1. **Dobbeltsignerer `signerDataRad`?** 🟢 **Nei — ikke korrupt.** `signerHvisPrivat` (`hmac.ts:65`) → `signerFilSti` (`:46`) gjør `path = sti.split("?")[0]` (`:50`) FØR den hengr på ny `?exp=&sig=`. En allerede-signert URL re-signeres rent (fersk utløp), ingen `?exp=..&sig=..?exp=..`. Samsvarer med triage-notatet «signering idempotent → usynlig».
2. **Hvor mange rader har signatur i `data` i dag?** ⚠️ **IKKE MÅLBAR FRA KODE.** Krever read-only-telling mot prod (`Checklist.data`/`Task.data` med `?exp=`/`&sig=`) — utenfor denne kode-målingens scope. Omfanget (backfill-rydding vs. normalisering-ved-lagring holder) er fortsatt uavklart.

`signerVedleggIData` (`utils/vedleggSignering.ts:43`) muterer aldri input — den forgifter ikke DB direkte;
det er klient-rundturen som gjør det. Rotårsaken (mangel på strip ved lagring) består.

**Søkeformer:** funksjon `oppdaterData`/`signerDataRad`/`signerHvisPrivat` · symptom `split("?")`/`normaliserForDiff`/`?exp=` i lagringsstien (0 treff der).

---

## § 1461 — P1 Posisjonsmodell-restansen · 🔴 FORTSATT EKTE

Alle underpåstander står. Kun linjenumre og filplassering har driftet (fil rekonstruert i `e31f06ea`, seed flyttet til egen fil).

| Underpåstand | Dom | Bevis nå | BACKLOG-referanse (driftet) |
|---|---|---|---|
| Flytoppsett sender hardkodet `steg={1}` | 🔴 EKTE | `dokumentflyt/page.tsx:968` (`<LeggTilMedlemDropdown steg={1}>`) og `:987` (`InviterNyMedlemModal steg={1}`) | `page.tsx:869,886` + `OpprettKontaktModal.tsx:211` |
| Standardflyter seedes `steg: 1` for både bestiller og utfører | 🔴 EKTE | `services/prosjektSeed.ts:139` og `:152` — begge `steg: 1` → begge kollapser til ett ledd | `prosjekt.ts:515,529` (koden flyttet til `prosjektSeed.ts`) |
| Kun HMS setter steg eksplisitt | 🔴 EKTE | `routes/modul.ts:79` (`steg: 1`), `:86` (`steg: 2`) | `modul.ts:61,68` |
| `klassifisering` settes ikke fra UI | 🔴 EKTE | 0 skrive-treff på `klassifisering` i `oppsett/produksjon/` (kun en kommentar i `MalListe.tsx:63`) | — |
| `utledMinRolle`-porten gater tredje ledd feil | 🔴 EKTE | `packages/shared/src/utils/flytRolle.ts` faggruppe-match kun hvis `dokumentFaggrupper.has(m.faggruppeId)` («kun relevant hvis faggruppen er part i dokumentet») → tredje faggruppe-bundne ledd får `besteRolle=null` → `minRolle=null` → «Lesevisning» `DokumentHandlingsmeny.tsx:587` (`if (minRolle === null && harFlyt)`) | `flytRolle.ts:96-98` + `DokumentHandlingsmeny.tsx:556` |

⚠️ Avhengigheten BACKLOG advarer om består: fikser man steg-inngangen uten `utledMinRolle`-porten,
slår klient/server-uenigheten ut i samme øyeblikk. De to må fikses sammen.

**Søkeformer:** funksjon `stegForRolle`/`utledMinRolle`/`prosjektSeed` · symptom hardkodet `steg={1}` + `steg: 1`-seed + `minRolle === null → Lesevisning`.

---

## Rader jeg IKKE rakk

Ingen. Alle seks i ordren er målt. Stoppet der — ikke fortsatt nedover BACKLOG på eget initiativ.
