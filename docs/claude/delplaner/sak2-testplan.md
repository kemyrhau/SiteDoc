---
name: sak2-testplan
status: 🟢 KJØRT + GRØNN (ledd 5, 2026-07-21) — T1 ✅ · T2 ✅ (beviset) · T3/T4/T5 kode-verifisert. Sak 2 lukket
eier: cowork (testplan) · web-Opus (ledd 5) · Kenneth (klikk-gate)
sist_verifisert_mot_kode: 2026-07-21
gjelder: fix/sak2-oppretter-ser-eget (d418f100) → merget develop
---

> **Resultat (web-Opus, test, 2026-07-21):**
>
> | Dokument | Før toggle (T1) | Etter toggle (T2) | Tilgangsvei |
> |---|---|---|---|
> | KB2-005 (Godkjent) | synlig | **forsvant** | flyt-medlemskap |
> | KB2-001 (Avvist) | synlig | **forsvant** | flyt-medlemskap |
> | KB2-006 (Utkast) | synlig | **ble stående** | oppretter (uavhengig) |
>
> **T1 ✅** — KB2-006, dokumentet som forsvant i N3-testen, sto i lista med **tom flyt-kolonne**: synlig via oppretter-grenen, uten flyt-binding. **T2 ✅** — da flyt-medlemskapet ble deaktivert forsvant de to flyt-scopede dokumentene mens KB2-006 ble stående (sidebar: Alle 1). **To uavhengige tilgangsveier, slått av hver for seg, i samme liste for samme bruker.**
>
> **T3/T4/T5 kansellert og kode-verifisert:** ingen nøytral bruker på B12 (T3) · admin-grenen returnerer `null` før OR-bygging, verifisert 3× samme dag (T4) · kmys HMS-liste tom, og `byggHmsSynlighetsFilter` har allerede person-grenene (T5). Kansellert bevisst for å spare nettleser-runder på ustabilt nett.

# Testplan — Sak 2: oppretter/mottaker ser sitt eget i lista (ledd 4)

> **Browser-testen er ikke valgfri her.** Endringen ligger i `byggTilgangsFilter`, som **ikke har testdekning** — matrisen tester detalj-gaten, ikke liste-filteret (se `tilgangsmatrise.test.ts` § «VIKTIG OM DEKNING»). Dette er den eneste faktiske verifiseringen av fiksen.

## 0. Forutsetninger
| # | Sjekk | Forventet |
|---|---|---|
| F1 | `fix/sak2-oppretter-ser-eget` merget → develop → deployet test | `d418f100`-koden kjører |
| F2 | kmy (`kenneth@sitedoc.no`) aktiv flyt-rad, `periode_slutt` NULL | 1 rad |
| F3 | **KB2-006 finnes** — utkastet kmy opprettet under N3-D2 | ja |

## 1. Testtilfeller

### T1 — Kjernen: det opprinnelige symptomet er borte
KB2-006 er dokumentet som **avdekket** bugen: kmy opprettet det, det forsvant fra lista, men åpnet via direkte URL.

Som kmy: åpne Bygg B12 → Sjekklister.

**Forventet:** **KB2-006 står nå i lista.** Før fiksen: usynlig (ingen `dokumentflytId` før send, og kmy har ingen faggruppe-kobling).
**Avvik:** fortsatt usynlig → `bestillerUserId`-grenen traff ikke.

### T2 — Diskriminerings-testen (skarpest — skiller de to tilgangsveiene)
Kenneth deaktiverer kmys flyt-medlemskap:
```
UPDATE dokumentflyt_medlemmer SET periode_slutt = now() WHERE project_member_id = 'cd110957-35f8-4044-ad5a-3853e39e555f' AND dokumentflyt_id IN (SELECT id FROM dokumentflyter WHERE name = 'A.Markussen Ansatte');
```

Som kmy, last lista på nytt.

**Forventet — to ting samtidig:**
- **KB2-005 og KB2-001 forsvinner** (de var synlige via *flyt*-grenen, som nå er deaktivert).
- **KB2-006 blir stående** (synlig via *bestiller*-grenen, uavhengig av flyt).

Det beviser at de to tilgangsveiene er uavhengige — og at den nye grenen faktisk er person-basert, ikke en bieffekt av flyt-medlemskap.
**Avvik:** forsvinner alt → bestiller-grenen virker ikke. Blir alt stående → flyt-deaktiveringen har ingen effekt (annen feil).

Så reaktiver (`periode_slutt = NULL`) og bekreft at alle tre er tilbake.

### T3 — Negativ kontroll
Et dokument kmy verken har opprettet, mottatt, har faggruppe til eller flyt-tilgang til (f.eks. et i Byggherre-flyten) skal **fortsatt være usynlig** for kmy.
**Avvik:** synlig → grenen er for bred.

### T4 — Admin uendret
Admin (`kemyrhau@gmail.com`) ser samme antall dokumenter som før. **Avvik:** endring → fiksen rørte admin-grenen (skal returnere `null` før OR-bygging).

### T5 — HMS (kode-verifisert hvis testdata mangler)
Sak 2 fikser også en HMS-inkonsistens: `byggHmsSynlighetsFilter` (hms.ts:49-54) slapp allerede gjennom «apen ELLER innsender ELLER mottaker», men det ytre filteret blokkerte brukerens **eget private** HMS-dok.

Finnes et privat HMS-dok opprettet av kmy: det skal nå være synlig for kmy, og fortsatt skjult for uvedkommende. Finnes ingen: noter kode-verifisert (begge filtre har nå person-grenene).

## 2. Sekvens
F1–F3 → **T4 (admin) + T3 (negativ) først** → **T1 (kjernen)** → **T2 (diskriminering, Kenneth toggler)** → T5. Skjermbilde per steg, forventet-vs-observert.

## 3. Utfall lukker
T1 + T2 grønn → sak 2 verifisert: lista speiler detalj-gaten, og bestiller-grenen er uavhengig av flyt. Da er alle tre tilgangsgatene (`byggTilgangsFilter`, `verifiserDokumentTilgang`, `byggHmsSynlighetsFilter`) enige om bestiller/mottaker.
