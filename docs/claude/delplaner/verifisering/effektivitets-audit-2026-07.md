---
name: effektivitets-audit-2026-07
status: 🔵 Måling ferdig 2026-07-29 (grunn-audit A + Handlingslinje B) — venter fabel-prioritering (fiks-plan)
eier: lese-Opus (måling) · fabel (prioritering) · cowork (ordre-ruting)
branch: audit/effektivitets (fra develop, post-del6b `3b103cfc`)
ordre: delplaner/effektivitets-audit-ordre-2026-07-29.md
sist_verifisert_mot_kode: 2026-07-29
---

# Effektivitets-audit — stående opprett-/handlingsflater (web + mobil)

Ren lese-/telle-økt mot FABEL-RAMMEVERK § Effektivitets-gate. INGEN kode endret.
Alt målt mot faktisk kode på `audit/effektivitets` (fra develop, post-del6b `3b103cfc`).
Slette-flyt telles IKKE her — egen ordre (`slette-flyt-ordre-2026-07-28.md`); refereres i § Dobbel sikring.

**Referansepunkt (Kenneth 2026-07-29):** ett klikk «Opprett» → rett inn i utfylling; prosjekt/byggeplass/tittel/faggruppe/mal autogenerert fra kontekst; overstyring INNE i utfyllingen (chip → bunn-ark, 2 trykk). Teoretisk minimum måles mot dette.

---

## 1 — Klikk-tabell (happy path: inngang → fullført/lagret)

| Flyt | Plattform | I dag | Teoretisk min | Diff | Rot til differansen |
|------|-----------|-------|---------------|------|---------------------|
| Oppgave-opprett | Web | 2 (v/1 mal) | 1 | +1 | Malmodal åpner alltid, også ved 1 mal (ingen auto-hopp) |
| Sjekkliste-opprett | Web | 2 (1 kandidat) / 3 (flere kandidatflyter) | 1 | +1 / +2 | Malmodal + evt. flyt-velger-steg |
| HMS-meld | Web | 2 | 1–2 | ~0 | Nær optimal (dropdown berettiget v/flere maler) |
| Bilde-opplasting | Web | 3 (Vedlegg → Last opp fra PC → OS-dialog) | 1–2 | +1 | Ekstra kilde-mellomsteg («Last opp fra PC») |
| Statusendring (DokumentHandlingsmeny) | Web | 1 (primær) / 2 (send v/flere mottakere) | 1 | 0 | Nær optimal |
| Statusendring (FirmaHurtigModal) | Web | ~4 (Behandle → select → velg → Lagre) | 1–2 | +2 | Bevisst annen flate (firma-oversikt uten å åpne dok) |
| Timeregistrering / dagsseddel | Web | 7 (best case) | 1–2 | +5–6 | Todelt inngang + manglende prosjekt/lønnsart-autofyll |
| Oppgave-opprett | Mobil | 2 (fra liste) / 3 (fra hjem) | 1 | +1 / +2 | Eksplisitt «Opprett» (iOS-modal-kollisjon) |
| Sjekkliste-opprett | Mobil | 2 | 1 | +1 | Samme eksplisitt-«Opprett» |
| Sjekkliste-utfylling → lagre | Mobil | 1 lagre + 1 dismiss suksess-Alert | 1 | +1 | Unødvendig suksess-Alert |
| HMS-meld | Mobil | 2 | 1–2 | ~0 | Nær optimal (server auto-ruter) |
| Bilde-opplasting | Mobil | 2 (+ lukk kamera) | 2 | 0 | Optimal — kamera holdes åpent, GPS+komprimering parallelt |
| Statusendring | Mobil | 3 (flyt-boks → handling → Bekreft-modal) | 1–2 | +1 | Fast bekreftelses-modal også når ingen begrunnelse kreves |
| Timeregistrering / dagsseddel | Mobil (GPS Start/Slutt-dag) | 2 (start + slutt) → utkast + «Send» | 2 | ~0 | Nær optimal — GPS-veien |
| Timeregistrering / dagsseddel | Mobil (manuell) | 5 (best case) | 1–2 | +3–4 | Todelt inngang (Lagre og fortsett + Legg til timer) |

**Merk timer:** modellen er dagsseddel-sentrisk — ingen frittstående «én time-føring» finnes. En time er alltid en `SheetTimer`-rad inne i en `DailySheet` (`@@unique([userId, dato])`, `db-timer/prisma/schema.prisma:176`). Timeregistrering og dagsseddel er derfor samme flyt målt to steder.

---

## 2 — Kontekst-lekkasje (kilde finnes, men brukes ikke som default)

| Flyt | Felt | Kilde finnes | Brukt? | Fil:linje |
|------|------|--------------|--------|-----------|
| Oppgave-opprett (web) | byggeplass/tegning | `useByggeplass()` → `aktivByggeplass` | **NEI** — daud binding | felt/mutasjon `oppgaver/page.tsx:319, 415-422`; server godtar `oppgave.ts:405` |
| Sjekkliste-opprett (web) | byggeplass | `aktivByggeplass` | **NEI** — kun i dep-array | `sjekklister/page.tsx:270, 387-394`; server `sjekkliste.ts:243` |
| Sjekkliste-opprett (web) | tegning | `standardTegning` | **NEI** — kun i dep-array | `sjekklister/page.tsx:270, 428-430`; server `sjekkliste.ts:244` |
| HMS-meld (web) | byggeplass | `useByggeplass()` `hms/page.tsx:130` | **NEI** — kun til filtrering | mutasjon `hms/page.tsx:177-188` |
| HMS-meld (mobil) | byggeplass | `valgtBygningId` `hms/index.tsx:51` | **NEI** | mutasjon `hms/index.tsx:111-113` |
| Timer/dagsseddel (web) | lønnsart | firma-default finnes | **NEI** — rad-dialog init tom (`""`) | `timer/[id]/page.tsx:1546` |
| Timer/dagsseddel (web) | prosjekt | ingen GPS/sist-brukte-minne | mangler kilde | `timer/ny/page.tsx:191` |

**Rene flyter (ingen lekkasje — forbilder):**
- Timer bruker/org/dato: aldri spurt, server-utledet (`ctx.userId`, `krevBrukersOrg`, dato-default `ny.tsx:57` / `ny/page.tsx:42`).
- Mobil opprett-modal: prosjekt/tittel/faggruppe/flyt/lokasjon alle auto (`OpprettDokumentModal.tsx:176-224, 292-319, 535-556`).
- Web oppgave/sjekkliste: prosjekt (URL), faggruppe, tittel, dokumentflyt alle auto.

**Mønster:** samme antimønster gjentas i **fire opprett-mutasjoner** (web oppgave, web sjekkliste, web HMS, mobil HMS) — `aktivByggeplass`/`valgtBygningId` hentes i komponenten men slippes aldri inn i mutasjonen, selv om serveren godtar `byggeplassId`/`drawingId`. Dokumentet opprettes uten byggeplass trass i aktiv kontekst.

---

## 3 — Dobbel sikring (bekreftelse oppå sikkerhetsnett)

| Sted | Funn | Fil:linje | Vurdering |
|------|------|-----------|-----------|
| Web status (DokumentHandlingsmeny) | Bekreftelse KUN på `closed`/`deleted` + påkrevd begrunnelse ved avvis | `DokumentHandlingsmeny.tsx:377, 391-403` | ✅ Ikke antimønster — speiler server-guard, kun irreversible |
| Mobil sjekkliste-utfylling | **Suksess-Alert etter «Lagre»** | `sjekkliste/[id].tsx:579` | ⚠️ Unødvendig bekreftelse mot ren-UI-prinsippet |
| Mobil statusendring | **Fast bekreftelses-modal** også når ingen begrunnelse kreves | `DokumentHandlingsmeny.tsx:468-520` | ⚠️ +1 tap på enkle statusbytter |
| Mobil status/timer klient-validering | Klient speiler server-Zod (overlapp, begrunnelse) | `[id].tsx:401-405`; `TimerRadModal:1250` | ✅ Legitim for offline-first, ikke redundans |
| Timer «Send til attestering» | Ingen bekreftelse | `[id].tsx:830` | ✅ Bra |
| Slett (alle) | → egen slette-flyt-ordre | — | Se `slette-flyt-ordre-2026-07-28.md` — **ikke talt her** |

---

## 4 — Mobil-signaler (kartlagt, ikke designet)

**GPS→byggeplass FINNES og BRUKES aktivt:**
- Geofence-oppslag (haversine mot cachet lat/lng/radius): `byggeplassKatalog.ts:79-103`
- Auto-set global byggeplass v/treff: `ByggeplassKontekst.tsx:155-166`
- GPS→tegning→byggeplass ved opprett-modal: `OpprettDokumentModal.tsx:188-210`
- Timer: GPS ≤500 m → prosjekt-forvalg (`ny.tsx:108-156`), «Start/Slutt dag» → hel dagsseddel + rader + reise (`StartSluttDagKort.tsx:397, 448-469`)

**Gjenstående gap:** HMS-opprett bruker ikke byggeplass i det hele tatt (`hms/index.tsx:111-113`) — her ville eksisterende GPS→byggeplass gitt gratis lokasjon uten nytt steg.

**PSI→prosjekt FINNES IKKE:**
- PSI åpnes inne i allerede valgt prosjekt (`hjem.tsx:676`), setter ikke aktivt prosjekt.
- Ingen QR/strekkode-skanner i mobilen (bekreftet: ingen `expo-barcode`/`BarCodeScanner`).
- Prosjekt velges manuelt én gang, persisteres (`ProsjektKontekst.tsx:64-78`) — engangskostnad, ikke per-flyt.
- **Bevisst utelatt for timer:** geofence/PSI → arbeidstid brytes ikke — «tilstedeværelse ≠ arbeidstid» (MEMORY-regel). En QR-innsjekk→prosjekt/byggeplass-kobling ved ankomst er uutnyttet, men må respektere at innsjekk aldri foreslår timer.

---

## 5 — Topp 5 verstinger (rotårsak + skjema-eier)

### V1 — Web timeregistrering: 7 klikk (diff +5–6)
**Rotårsak:** (a) todelt inngang — opprett sedel på én side (`timer/ny/page.tsx`) → legg til rad på neste (`timer/[id]/page.tsx:1107`); (b) prosjekt ikke prefylt (ingen GPS/sist-brukte på web, `ny/page.tsx:191`); (c) lønnsart-rad init tom trass i firma-default (`[id]/page.tsx:1546`).
**Eier:** `apps/web/src/app/dashbord/timer/{ny,[id]}/page.tsx`.
**Kontrast:** mobil GPS-vei gjør dette på 2 tap — web mangler både GPS-signalet og lønnsart-prefill mobil allerede har.

### V2 — Byggeplass-kontekst-lekkasje i 4 opprett-mutasjoner (diff: mister lokasjon)
**Rotårsak:** `aktivByggeplass`/`valgtBygningId` hentes men sendes aldri inn i mutasjonen; server godtar `byggeplassId`/`drawingId`. Samme antimønster gjentatt.
**Eiere:** `oppgaver/page.tsx:319/415-422`, `sjekklister/page.tsx:270/387-394`, `hms/page.tsx:130/177-188` (web), `hms/index.tsx:51/111-113` (mobil).
**Effekt:** dokument opprettes uten byggeplass/tegning trass i aktiv kontekst — svekker senere filtrering/rapport.

### V3 — Auto-hopp malvelger ved 1 mal er IKKE i web-koden (diff +1 begge web opprett)
**Rotårsak:** del6b fase 2 skulle levert auto-hopp, men verken sjekkliste- eller oppgave-siden har logikk som hopper over malmodalen ved nøyaktig 1 mal — modalen åpner alltid. (`kandidater.length === 1` gjelder antall *flyter* per mal, ikke antall maler.)
**Eier:** `sjekklister/page.tsx:396-407`, `oppgaver/page.tsx:891-911`.
**Note:** mobil HAR auto-skip (`MalVelger.tsx:47-58`) — web ligger bak. Lovnaden i del6b-runden er delvis uinnfridd på web.

### V4 — Web bilde-opplasting: ingen komprimering
**Rotårsak:** `lastOppFil` sender rå `File` uten resize/kvalitet; server skriver til disk med 500 MB-grense, ingen `sharp`/resize (`upload.ts:78`). 300–400 KB-regelen (CLAUDE.md) gjelder kun mobil (`bilde.ts:51-99`).
**Eier:** `apps/web/src/components/rapportobjekter/FeltDokumentasjon.tsx:54-81` + `apps/api/src/routes/upload.ts`.
**Effekt:** ikke klikk, men data-/ytelseskost — fullstørrelse-bilder inn i basen fra web.

### V5 — Mobil friksjon: suksess-Alert + fast statusbekreftelse
**Rotårsak:** (a) suksess-Alert etter sjekkliste-lagring (`sjekkliste/[id].tsx:579`) — bekreftelse oppå handling som allerede har LagreIndikator; (b) fast bekreftelses-modal på hver statusendring (`DokumentHandlingsmeny.tsx:468-520`) også når ingen begrunnelse kreves.
**Eier:** `apps/mobile/app/sjekkliste/[id].tsx`, `apps/mobile/src/components/DokumentHandlingsmeny.tsx`.

**Hederlig omtale (ikke topp 5, men reelt):** mobil galleri mangler i sjekkliste/oppgave/HMS-felt — kun kamera + dokumentvelger; `velgBilde` finnes (`bilde.ts:167`) men er ikke koblet inn i `FeltDokumentasjon.tsx:329-363` (kun brukt i timer-utlegg).

---

## 6 — Fiks-rekkefølge (gruppert)

### Småsaker — ordre-klare (wire inn eksisterende kilde, ingen ny design)
1. **Send `byggeplassId`/`drawingId` i de 4 opprett-mutasjonene** (V2) — kilde + server-støtte finnes, kun wiring. Én ordre, fire like patcher. Rydd samtidig daud binding `oppgaver/page.tsx:319`.
2. **Web lønnsart-prefill** (V1c) — init rad-dialog med firma-default i stedet for `""` (`timer/[id]/page.tsx:1546`).
3. **Fjern suksess-Alert etter sjekkliste-lagring** (V5a) — mobil (`sjekkliste/[id].tsx:579`); LagreIndikator dekker kvitteringen.
4. **Koble `velgBilde`/galleri inn i `FeltDokumentasjon`** (mobil) — funksjonen finnes, mangler kun kall (`FeltDokumentasjon.tsx:329-363`).

### Strukturelle — fabel-design først
5. **Auto-hopp malvelger ved 1 mal på web** (V3) — speile mobils `MalVelger`-mønster, men avklar «rett inn i utfylling» vs dagens «opprett → detaljside»-rute.
6. **Todelt timer-inngang → ett-trykk-inn** (V1a) — slå sammen opprett-sedel + legg-til-rad; berører web + mobil manuell vei.
7. **Web bilde-komprimering** (V4) — mangler helt; arkitektur-valg (klient-canvas vs server-`sharp`).
8. **Web prosjekt-autofyll** (V1b) — «sist brukte»-fallback siden GPS ikke finnes på web; del av fallback-stigen i målbildet.
9. **Mobil eksplisitt «Opprett»-bekreftelse** — bevisst deaktivert auto-opprett pga. iOS-modal/navigering-kollisjon (`OpprettDokumentModal.tsx:478-479`); teknisk blokkering som trenger løsning før ett-trykk-inn.
10. **Mobil fast statusbekreftelse-modal** (V5b) — design når den trygt kan hoppes over (ingen begrunnelse påkrevd).
11. **PSI/QR→prosjekt/byggeplass ved ankomst** (mobil-signal) — ny inngang; må respektere «tilstedeværelse ≠ arbeidstid».

---

## 7 — Søkerom per flyt (verifikasjonsgrunnlag)

- **Web oppgave/sjekkliste-opprett:** `apps/web/src/app/dashbord/[prosjektId]/{oppgaver,sjekklister}/page.tsx`, `components/OpprettOppgaveModal.tsx`, `kontekst/{byggeplass,prosjekt}-kontekst.tsx`, `hooks/useVerktoylinje`, `api/src/routes/{oppgave,sjekkliste}.ts`.
- **Web HMS/bilde/status:** `app/dashbord/[prosjektId]/hms/page.tsx`, `app/dashbord/firma/hms/page.tsx`, `components/hms/*`, `components/DokumentHandlingsmeny.tsx`, `components/rapportobjekter/FeltDokumentasjon.tsx`, `lib/{flyt-ledd,flytmatrise-def}.ts`, `api/src/routes/upload.ts`, `@sitedoc/shared` (`isValidStatusTransition`, `hentStatusHandlinger`).
- **Mobil alle opprett:** `apps/mobile/app/{(tabs)/hjem,oppgave,sjekkliste,hms}/*`, `src/components/{MalVelger,HmsMalVelger,OpprettDokumentModal,DokumentHandlingsmeny,KameraModal}.tsx`, `src/components/rapportobjekter/FeltDokumentasjon.tsx`, `src/services/bilde.ts`, `src/providers/OpplastingsKoProvider.tsx`, `src/kontekst/*`, `src/services/byggeplassKatalog.ts`.
- **Timer/dagsseddel:** `apps/mobile/app/timer/*`, `src/components/{DagsseddelListe,StartSluttDagKort}.tsx`, `src/components/timer-detalj/*`, `src/services/{dagsseddelOpprett,timerKatalog}.ts`; `apps/web/src/app/dashbord/timer/{ny,mine,[id]}/page.tsx`, `components/timer/*`; `apps/api/src/routes/timer/*`; `packages/db-timer/prisma/schema.prisma`.

---

## 8 — Handlingslinja (statusendring-flyten, web `DokumentHandlingsmeny`)

Utvidet oppgave (cowork 2026-07-29, Kenneth-funn på sjekkliste KB2-007). Fortsatt ren måling/diagnose — fabel designer, ikke jeg.

**Søkerom:** `apps/web/src/components/{DokumentHandlingsmeny,FlytIndikator,DokumentTidslinje}.tsx`, `apps/web/src/lib/{flyt-ledd,flytmatrise-def}.ts`, `packages/shared/src/utils/{statusHandlinger,flytRolle,index}.ts`, `apps/api/src/routes/sjekkliste.ts` (`endreStatus`/`utledNyEier`), `sjekklister/[sjekklisteId]/page.tsx`.

### A) Send-oppførsel + flytindikator — diagnose

**Q1 — hva driver flytindikatorens aktive steg?**
Aktivt ledd beregnes i `finnAktivtIndex` (`flyt-ledd.ts:148`), kalt fra `FlytIndikator.tsx:86`. Det er **verken et eget felt eller `harBallen`** — det er en ren funksjon av `status` + `recipient*`. Prioritet: (1) `draft`/`cancelled` → bestiller-ledd (`:158-165`); (2) recipient-identitet `recipientGroupId`/`recipientUserId` → første ledd med den ID-en (`:168-175`); (3) fallback `forventetRolleKandidater(status)` (`:178-181`, `:38-52`). Ledd bygges per rolle (`byggLedd :91-99`), sekvensert på rolle-rang (`:22-27`) — `steg` er ikke populert.

**Q2 — avanserer «Send» ballen? Auto sent→received?**
Nei / ja. Ved `received` er «Send» en **sekundærknapp** (`DokumentHandlingsmeny.tsx:331-342`) som ikke setter mottaker → `onEndreStatus(mottaker=undefined)`. Server: `effektivStatus = nyStatus === "sent" ? "received" : nyStatus` (`sjekkliste.ts:1106`) → Sendt konverteres straks til Mottatt; `recipientUserId/GroupId = null` (`:1136-1139`); `utledNyEier(undefined, undefined)` → eier uendret (`:921-937`). **Netto av ett Send-klikk fra `received`: status = `received`, recipient = null.** `finnAktivtIndex("received", null, null)` → fallback `["utforer"]` (`flyt-ledd.ts:44-46`) = nøyaktig der ballen sto. Ingen bevegelse.

**Q3 — rangert rotårsak til at indikatoren ikke flytter seg:**
1. **(b) PRIMÆR — «Send» ved `received` er reelt en no-op.** Indikator bundet til `status`; Send re-stempler `received` med tom recipient, og fallback for `received` er hardkodet til utfører (`flyt-ledd.ts:44-46`). Markøren kan aldri flytte seg på «Send». Riktig framoverknapp er **«Besvar»** (`responded`, fallback `["godkjenner"]` `:47-48`) eller **«Godkjenn»** (`received→approved`). Kilde: `sjekkliste.ts:1106,1136-1139` + `flyt-ledd.ts:44-46,178-181`.
2. **(a) SEKUNDÆR/latent — utfører = godkjenner samme part.** `finnAktivtIndex :172-175` bruker `findIndex` (first-match) → selv om recipient hadde pekt framover til den delte parten, ville markøren låst til utfører (lavere rang). Ikke utløsende i testen (recipient var null → fallback rådet), men reell felle når én part har flere roller.
3. **(c) FORKASTET — re-render/invalidering.** `page.tsx:239-240` invaliderer både `hentForProsjekt` og `hentMedId` i `onSuccess`; indikator re-rendres, dataen er bare uendret. Ikke render-bug.

**Q4 (Symptom 2) — Sendt↔Mottatt-veksling: kode-løkke eller manuelle klikk?**
**N manuelle klikk, der hvert klikk auto-skriver 2 logg-rader server-side.** Per «Send» skrives to `documentTransfer`-rader i samme transaksjon: `→ sent` (`sjekkliste.ts:1144-1160`) + `sent → received` (kun når `nyStatus==="sent"`, `:1162-1172`). `DokumentTidslinje.tsx:120-122` rendrer hver rad som `fra→til`-badge → paret «→ Sendt» + «Sendt → Mottatt» per klikk. Klyngen 11:12–11:13 er **konsekvens av Symptom 1**: markøren flytter seg aldri → bruker klikker «Send» igjen → 2 nye rader per klikk. Ingen auto-mutasjon finnes (eneste `useEffect` er timer-opprydding `page.tsx:228`).

> **⚠️ Dette er en korrekthets-bug, ikke bare effektivitet.** «Send» tilbys som lovlig handling i en tilstand der den ikke gjør noe meningsfullt (received→sent→received, recipient nullstilt). Bør inn i fiks-planen som bugfiks (strukturell — fabel/statusmaskin-avklaring om «Send» i det hele tatt skal tilbys fra `received`).

### B) Knappe-klutter — måling

Knappe-settet avhenger av **`status × minRolle × adminNiva`** (ikke `harBallen`). Én bruker har alltid nøyaktig én resolvert `minRolle` (`flytRolle.ts:67-107`). Kilde: `hentStatusHandlinger` (`statusHandlinger.ts:19-82`).

**Renderings-bøtter (`DokumentHandlingsmeny.tsx`):** primær = `find(erPrimaer)` → flat knapp, `+split ▾` **kun** ved draft-send m/ >1 mottaker (`:299,515-552`) · sekundær (minus `forwarded`/ADMIN_NY) → **flate knapper** (`:331-342,555-578`) · `forwarded`-mottakere + ADMIN_NY-status + deaktiverte → bak dropdown-trigger «Videresend ▾»/«Admin ▾» (`:345-368,581-607`) · kommentar → egen flat `+`-knapp (`:621-640`).

**Status × rolle-matrise (handlingsknapper som vises samtidig; «flat» = direkte i linja):**

| Status | Rolle | Flate handlinger | Flat totalt (m/ ▾ + kommentar) |
|--------|-------|------------------|-------------------------------|
| **received** | **admin / uten flyt** | Besvar, Godkjenn, Send, Avvis | **6 ⚠️ VERSTE** (+ Videresend▾ + kommentar) |
| received | utfører | Besvar, Send, Avvis | 5 (+ Admin▾ + kommentar) |
| responded | godkjenner / admin | Godkjenn, Send tilbake, Send | 5 (+ ▾ + kommentar) |
| in_progress | utfører / admin | Besvar, Send på nytt | 4 |
| approved | admin / uten flyt | Gjenåpne, Send | 4 |
| received | godkjenner | Godkjenn | 3 |
| draft | registrator/bestiller | Send (m/split), Slett | 2 + split |
| closed / dismissed | registrator/admin | Gjenåpne | 2 |
| received/in_progress | ikke-eier-rolle | – (alt deaktivert bak ▾) | 1 |

**Verste fall:** `received × admin/uten-flyt` = **6 flate elementer**: Besvar (primær) · Godkjenn · Send · Avvis · Videresend ▾ · + kommentar. Treffer Kenneths funn presist. Merk: **Videresend er allerede bak ▾** (aldri flat, `:332` ekskluderer `forwarded`) — «Videresend» i klagen er dropdown-triggeren, ikke en flat knapp.

**Gap mot målbildet (primær + split-▾ for øvrige lovlige handlinger; Videresend beholder person-velger):**
- Split-▾-mønsteret **finnes alt**, men kun for draft-send m/ >1 mottaker (`:542`). I alle andre statuser rendres sekundær-handlingene flatt, og eksisterende ▾ inneholder IKKE disse lovlige sekundær-handlingene (kun admin-status/forwarded-mottakere/deaktiverte).
- Fabel-input for å nå målbildet: flytt sekundær-bøtta (`:331-342`) under primærens split, og generaliser split-betingelsen fra `draftSend && videresendValg.length > 1` (`:542,581`) til «primær finnes + ≥1 øvrig lovlig handling». Flate sekundær-knapper som da samles bak split: received×admin = 3 (Godkjenn/Send/Avvis), received×utfører = 2, responded×godkjenner = 2.
- `+ kommentar` (`:621-640`) står alltid som eget flatt element — selvstendig gap-element hvis målet er én primær + én ▾.
- Videresend har alt person-velger i dropdownen (`:681-727`, `medlemmer`-ekspansjon) — beholdes som i målbildet.

---

## Gate

Måling ferdig (grunn-audit § 1–7 + Handlingslinje § 8) → skrevet til `inbox-cowork.md` → fabel vurderer → prioritert fiks-plan til Kenneth → ordrer skrives derfra. Statuskilde: denne filen.
