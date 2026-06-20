---
name: timer-gps-prosjekt-utredning
status: agenda
sist_verifisert_mot_kode: 2026-06-13
---

# Utredning: Timer-registrering, GPS, prosjekt-tilknytning og dag-flyt

> **Session-klar agenda** for en dedikert utredningssesjon. Samler beslutningene som dukket
> opp 2026-06-13 rundt R4 (reisetid-matrise) + EAS-enhet-test. Ingen kode tas før beslutningene
> er fattet. Rekkefølgen er **avhengighets-ordnet**: Beslutning 1 styrer resten.

## Formål

Avgjøre hvordan timer-modulen håndterer **prosjekt-tilknytning + GPS-dagflyt**, forankret i
to-produkt-modellen og byggherreforskriften §15. Spenningen: SiteDoc er opprinnelig et
**prosjektstyringsverktøy** (streng prosjekt-isolasjon), mens timer-modulen behandler prosjekt
som en *etikett* arbeider velger. De kolliderer når valgt prosjekt ≠ faktisk posisjon.

## Forankring (les først)

- `terminologi.md § 0` — to-produkt-modell (firmamodul vs prosjektmodul; timer isolerer på org)
- `fase-0-beslutninger.md § T.8` — innsjekk-prosjektforslag (**🟡 under revurdering**)
- `mannskap.md` — PSI/§15 innsjekk-utsjekk, byggherreforskriften, 12t auto-utsjekk
- `domene-arbeidsflyt.md` — virkelig arbeidsflyt (styrende)
- `timer.md § Reise og oppmøtested` — R1–R4 reise-modell, «aldri auto-rad»
- `OPPSUMMERING-timer-arkitektur.md § D (G1)` — **GPS = friksjonsfjerner + bevis, ikke hard port**

## Kode-fakta (verifisert 2026-06-13)

- Tid registreres mot `valgtProsjekt` (`StartSluttDagKort:442`) **uansett fysisk posisjon**.
- «Start dag»-GPS identifiserer **kun oppmøtested (kontor)** — ikke byggeplass/prosjekt. Byggeplass-GPS = **1c-mobil, gjenstår**.
- **Ingen** validering av valgt prosjekt mot GPS-posisjon i dag.
- Dagsseddel-status: `draft → sent → accepted` (`draft/returned` redigerbar, `sent/accepted` låst). Innsending = `draft→sent`; leder-attestering = `→accepted`.
- T.8 i dag: innsjekk = **hint** i prosjekt-velger; arbeider oppretter dagsseddel + rader **eksplisitt**; innsjekk trigger **aldri** auto-dagsseddel/rader.

---

## BESLUTNING 1 (avgjør resten) — T.8: konservativ vs auto-utkast

**Spørsmål:** Hvem skriver timer-radene, og hvor ligger godkjennings-punktet?

| | Hvem skriver utkastet | Godkjennings-punkt |
|---|---|---|
| **A. Konservativ (dagens T.8)** | Arbeider oppretter manuelt (GPS = hint) | Ved opprettelse + innsending |
| **B. Auto-utkast (Kenneths forslag)** | Systemet auto-skriver fra GPS-dagflyt (draft) | Ved **innsending** (`draft→sent`) |

**Invariant (begge):** Arbeider godkjenner før noe blir *endelig* (innsending/attestering). Ingen lønn uten menneskelig godkjenning.

**Avveiing:** A = tryggest mot feil auto-rader, men mer manuelt (mer tasting). B = mye lavere friksjon («dagen fyller seg selv»), men hviler på at innsendings-gjennomgangen faktisk gjøres nøye.

**Konsekvens:** Velges B må «aldri auto-rad»-formuleringen i T.8 + 1c-mobil-noten (`timer.md:416`) revideres til «aldri auto-*innsending*». Styrer hele dag-flyt-designet under.

---

## BESLUTNING 2 — Prosjekt-mismatch (valgt prosjekt ≠ faktisk posisjon)

**Scenario:** Arbeider velger Prosjekt A, men er fysisk på Prosjekt B.

**Konsekvens i dag (udetektert):** feil prosjekt-kostnad (kjerne for prosjektverktøy), feil reise-forslag (R4 bruker A's byggeplass), feil §15-mannskaps-oversikt.

| Alternativ | Avveiing |
|---|---|
| **GPS-advisory (anbefalt, jf. G1)** | byggeplass-GPS detekterer B → soft advarsel ved mismatch → arbeider bekrefter/bytter. Balansert. |
| Status quo (kun valg) | Korrumperer kostnad + §15. Ikke holdbart. |
| Hard GPS-gate | For rigid — GPS upålitelig, bryter legitime kryss-prosjekt-dager. |

**Avhengighet:** 1c-mobil (byggeplass-GPS).

---

## BESLUTNING 3 — Dag-flyt-overgangene (ankomst + avreise)

**Scenario:** Kontor (A valgt) → kjør til B → ankomst B (reise→arbeid + prosjekt-bytte) → forlater B (utsjekk).

**Spørsmål:** Hvordan signaliseres overgangene? Popup? Auto? Timeout-fallback?

Se **Beslutning 4** (to-lags-modellen) — den gir svaret på «hvis ubesvart». Kort: popup ved ankomst/avreise; auto-fallback skiller §15-presence (kan auto-logges) fra lønnstid (utkast, ikke auto-commit med mindre Beslutning 1 = B).

**Åpent:** popup-design, terskel for «forlatt byggeplass», sammenheng med 12t auto-utsjekk.

---

## BESLUTNING 4 — To-lags-modell: §15-presence vs lønnstid

Geofence-overgangene driver **to lag med ulik commit-semantikk:**

| Lag | Hva | «Hvis ubesvart» |
|---|---|---|
| **§15-presence** (innsjekk/utsjekk per byggeplass) | Dokumentasjon, rettslig forpliktelse (GDPR art. 6(1)(c), byggherreforskriften §15). Primær nytte: katastrofe-mønstring. | **Kan auto-logges** (presedens: 12t auto-utsjekk). |
| **Lønnstid** (reise→arbeid, prosjekt-bytte) | Påvirker lønn. | **Konservativ T.8:** ikke auto. **Auto-utkast (B):** utkast skrives, bekreftes ved innsending. |

**Nøkkel:** §15-presence (nærvær) er mindre sensitiv enn lønnstid og kan automatiseres uavhengig av Beslutning 1. Lønnslaget følger Beslutning 1.

**Avhengighet:** Fase 4 Mannskap (PSI innsjekk/utsjekk-tabeller).

---

## BESLUTNING 5 — Autoritet: arbeider-valg vs GPS

Forankret i **G1: GPS = friksjonsfjerner + bevis, ikke hard port.** Arbeider-valg bør forbli autoritativt (legitime kryss-prosjekt-tilfeller: forberedelser, materialhenting, flytting). GPS detekterer + advarer/foreslår. Bekreft at dette holder for alle lagene over.

---

## BESLUTNING 6 — Multi-byggeplass-dager

Arbeider beveger seg mellom flere byggeplasser/prosjekter samme dag. Hvordan håndteres flere reise→arbeid-segmenter + flere §15-innsjekk/utsjekk på én dagsseddel? (R4 primær-byggeplass-regel er deterministisk per *prosjekt* — multi-prosjekt-dag trenger egen håndtering.)

---

## Avhengigheter (oppsummert)

- **Fase 1c-mobil** (byggeplass-GPS) — forutsetning for Beslutning 2, 3, 6.
- **Fase 4 Mannskap** (PSI innsjekk/utsjekk) — forutsetning for §15-laget (Beslutning 4).
- **Beslutning 1** styrer «aldri auto-rad»-formuleringen i T.8 + `timer.md:416`.

## Ut av scope (ikke i denne utredningen)

- Maskinkost-fordeling, ProAdm-eksport (OPPSUMMERING G5).
- Kontinuerlig GPS-sporing (🔴 personvern — BACKLOG, bygges ikke uten juridisk vurdering).
- Fra/til → HMS-register (G4, uavklart).
