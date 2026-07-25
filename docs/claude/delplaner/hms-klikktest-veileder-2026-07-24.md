---
name: hms-klikktest-veileder
status: 🟢 TESTVEILEDER for Opus-i-Chrome — verifiser HMS-svar-løpet (A–D) ende-til-ende på test. 2026-07-24
eier: cowork (veileder) · Kenneth (kjører i Chrome-Opus) · Chrome-Opus (utfører + skjermbilder)
---

# HMS-klikktest — veileder for Opus-i-Chrome

## Mål
Verifiser det **dedikerte HMS-svar-løpet** ende-til-ende på test.sitedoc.no etter Ordre A–D. HMS-dokumenter skal kjøre en egen, forenklet flyt — **ikke** den generelle statusmaskinen. Gjelder både checklist (SJA) og task (RUH, HMS-avvik).

## Miljø
- **URL:** test.sitedoc.no (innlogget)
- **Prosjekt:** Sitedoc Boligfelt B12
- **Inngang:** HMS-modulen (venstre nav) → **«Meld HMS»**-knappen øverst til høyre (nedtrekk: RUH / SJA / HMS-avvik)
- **Roller:** admin (Kenneth) · HMS-admin (HMS-gruppe-medlem) · ikke-admin (kmy) · vanlig medlem utenfor HMS-gruppen

## Kjerneforventning (det Ordre A–D innførte)
Et HMS-dokument skal:
- Opprettes **direkte som «Sendt»** — INGEN «Utkast»-steg.
- Vise egen handlingsflate: **Besvar** (HMS-admin, krever begrunnelse), **Tilføy informasjon** (oppretter), **Lukk** / **Gjenåpne** (HMS-admin).
- **IKKE** vise **Godkjenn / Send tilbake**, og **IKKE** ha en **«Godkjent»**-status.
- Tilstander: **Sendt → Besvart → Lukket** (+ Gjenåpne: Lukket → Besvart).

> ⚠️ Ser du «Utkast», «Mottatt», «Godkjenn», «Send tilbake» eller «Godkjent» på et HMS-dokument → **FAIL** (den generelle flyten slår inn, ikke HMS-flyten). Noter det.

## Testtilfeller (admin — Kenneth)

### T1 — RUH: opprett = Sendt (task)
1. HMS-modul → **Meld HMS** → **RUH** → fyll påkrevde felt (Tidspunkt, Innmelder, Type observasjon, Beskrivelse) → opprett/send.
2. **Forventet:** status blir **Sendt** umiddelbart (ikke Utkast). Detaljsiden viser HMS-handlingsflaten (Besvar / Tilføy informasjon), ikke den generelle menyen. *(skjermbilde av status + knapper)*

### T2 — Besvar krever begrunnelse (HMS-admin)
1. På den Sendte RUH-en: klikk **Besvar** UTEN å skrive begrunnelse.
2. **Forventet:** blokkeres — kan ikke sende tomt.
3. Skriv en begrunnelse → send. **Forventet:** status → **Besvart**. *(skjermbilde før + etter)*

### T3 — Ingen Godkjenn
1. På den Besvarte RUH-en, se handlingsknappene.
2. **Forventet:** **Lukk** (+ evt. Tilføy informasjon). **IKKE** Godkjenn / Send tilbake. *(skjermbilde)*

### T4 — Lukk + Gjenåpne
1. Besvart → **Lukk** (valgfri kommentar i bekreftelsen) → **Lukket**.
2. Lukket → **Gjenåpne** → **Besvart**. *(skjermbilder)*

### T5 — Tilføy informasjon (oppretter)
1. På Sendt eller Besvart: oppretter legger til en kommentar (Tilføy informasjon / Dialog-feltet).
2. **Forventet:** kommentaren legges til, status **uendret** (gjenåpner ikke), vises i **Tidslinjen**. *(skjermbilde)*

### T6 — HMS-avvik (task) — samme flyt
Gjenta T1–T3 kort for et **HMS-avvik**. **Forventet:** identisk oppførsel (Sendt, Besvar-med-begrunnelse, ingen Godkjenn).

### T7 — SJA (checklist) — samme flyt
Meld HMS → **SJA** (dette er en *checklist*, ikke task). **Forventet:** samme dedikerte flyt (Sendt, Besvar-med-begrunnelse, ingen Godkjenn, Lukk/Gjenåpne, Tilføy). Bekrefter at både task- og checklist-siden bruker HMS-flyten.

### T8 — Visningsfeil-sjekk
På RUH/HMS-lista: kolonnene **«Type observasjon»** og **«Innmelder»** skal vise lesbar tekst, **ikke** `[object Object]`. *(Forrige klikktest fant `[object Object]` her — bekreft om det er borte eller fortsatt til stede.)*

## Flerbruker-tester (krever innlogging som annen bruker)
> Agenten logger **ikke** inn med passord. Kenneth logger inn som riktig bruker i en fane; agenten observerer + tar skjermbilder.

### T9 — Ikke-admin (kmy) melder RUH
1. Som **kmy**: HMS-modul → Meld HMS → RUH → send.
2. **Forventet:** oppretter (kmy) kan **Tilføy informasjon**, men ser **IKKE Besvar** (kun HMS-admin besvarer). Status **Sendt**, rutet til HMS-gruppen.

### T10 — Privat synlighet
1. Som et **vanlig prosjektmedlem utenfor HMS-gruppen** (og ikke oppretter/mottaker): åpne HMS/oppgave-lista.
2. **Forventet:** en **privat** RUH er **IKKE synlig** for denne brukeren.

## Rapportering
Per test: **PASS / FAIL** + skjermbilde + evt. avvik. Flagg spesielt alt som viser den generelle flyten (Utkast / Mottatt / Godkjenn / Send tilbake / Godkjent) — det betyr at HMS-flyten ikke slår inn for det dokumentet.
