---
name: N3-fiks-del2-testplan
status: 🟢 KJØRT + GRØNN (ledd 5, 2026-07-19) — D1/D2/D3/D5/D6/D7 PASS · D4 kode-verifisert · D8 delvis. To åpne saker til fabel
eier: cowork (testplan) · web-Opus (ledd 5) · Kenneth (klikk-gate)
sist_verifisert_mot_kode: 2026-07-19
gjelder: fix/n3-flytmedlem-del2 (3bcee52e) → merget develop `d2863dd5`
---

> **Resultat (web-Opus, test, 2026-07-19):** D1 detalj + alle 6 lese-stier ✅ (KB2-005 åpner — del-1-blokkeren løst) · D2 opprett KB2 ✅ · D3 SJA riktig skilt melding, fortsatt blokkert ✅ · D5 mutasjon blokkert «ikke tilgang» ✅ (lese≠skrive holder) · D6 toggle av/på ✅ · D7 admin uendret ✅ · D4 ⏭️ kode-verifisert (kmys HMS-liste tom) · D8 🟡 ingen HTTP-N+1, DB-plan krever postgres-logg.
>
> **To funn til fabel:** (1) **G1-mutere UX** — rollemenyen tilbyr Besvar/Send/Avvis til person-direkte medlem uten deaktivering, men klikk gir «ikke tilgang». (2) **Opprett→usynlig** — dokument opprettet av person-direkte medlem (KB2-006) vises ikke i lista (ingen `dokumentflytId` før send) men åpner via direkte URL. Ingen av dem er del-2-regresjoner.

# Testplan — N3-fiks del 2 (ledd 4)

> Grunnlag: [N3-fiks-del2-ordre.md](N3-fiks-del2-ordre.md) § 5 DoD + review 2026-07-19 (koden korrekt per ordren). Kjøres av web-Opus (ledd 5) på **test**, innlogget som kmy (`kenneth@sitedoc.no`, person-direkte registrator, ikke-admin). Forventet utfall per steg — mål AVVIK.

## 0. Forutsetninger (Kenneth, før ledd 5)

| # | Sjekk | Forventet |
|---|---|---|
| F1 | `fix/n3-flytmedlem-del2` merget → develop → deployet test | container viser `3bcee52e`-koden |
| F2 | kmy person-direkte flyt-medlem aktiv (`periode_slutt` NULL) | 1 rad, registrator |
| F3 | **For D4:** minst ett **privat** HMS-dok (RUH/avvik, `synlighet=privat`) i kmys flyt på B12, + ett **åpent** (SJA) | begge finnes |

## 1. Testtilfeller

### D1 — Detalj-lese + alle 6 lese-stier (LUKKER Del E) — DoD (1)
kmy åpner KB2-005 (som i del-1-testen ga «Sjekklisten ble ikke funnet»).
- **Detalj (`hentMedId`):** åpner nå ✅ (var «ikke funnet»).
- **Handlingsmeny (Del E):** rendrer rollefiltrert — kmys registrator-handlinger + andre **deaktivert m/ begrunnelse** («Kun godkjenner» e.l.).
- **Kommentarer (`hentKommentarer`):** laster (test på et oppgave-dok).
- **Underoppgaver (`hentForSjekkliste`):** laster.
- **Videresend-meny (`hentTilgjengeligeFlyter`):** åpner uten FORBIDDEN.

**Avvik-flagg:** «ikke funnet» står → flyt-grenen traff ikke `verifiserDokumentTilgang`. Én av de andre 5 stiene gir FORBIDDEN → et lese-site mangler flagget.

### D2 — Opprett KB2 (lykkes) — DoD (2)
kmy oppretter KB2 fra mal. **Forventet:** opprettes, ingen «tilhører ikke faggruppen» (Steg 2 godtar flyt-medlem der faggruppen er flytens eier-faggruppe). **Avvik:** feil står → `verifiserFaggruppeTilhorighet`-alternativet traff ikke.

### D3 — Opprett SJA (riktig skilt melding, fortsatt blokkert) — DoD (3)
kmy prøver SJA. **Forventet:** korrekt **skilt** melding — «Ingen av dine dokumentflyter har denne malen» (hvis kmys flyt ikke har SJA-malen) ELLER «Flyten mangler eier-faggruppe» (hvis den har malen men mangler faggruppe). **IKKE** den gamle generiske «Fant ingen faggruppe…». Opprett fortsatt blokkert (G3 = NEI). **Avvik:** gammel generisk melding, eller feil av de to.

### D4 — F1-A: privat HMS respekteres — kritisk
- **Privat HMS-dok** (RUH/avvik i kmys flyt): kmy åpner detalj → **«ikke funnet»/FORBIDDEN** (F1-A holder privat låst tross flyt-medlemskap). Konsistent med at lista også skjuler det.
- **Åpent HMS-dok** (SJA): kmy ser det (alle prosjektmedlemmer gjør).

**Avvik-flagg:** kmy åpner det private HMS-dokumentet → F1-A brutt = rettighetsutvidelse på konfidensielt HMS. **Farligste avviket — prioriter.**

### D5 — Lese ≠ skrive: mutasjon blokkert (G1-mutere utsatt) — verifiser splitten
Mens kmy har KB2-005 åpen: forsøk en **skrive-handling** fra menyen (f.eks. endre status / besvar).
- **Forventet:** handlingen **feiler** på mutasjons-gaten (de 11 mutasjonene har ikke flyt-grenen — G1-mutere er egen sak). kmy kan **lese** dokumentet, men ikke **endre** det via flyt-medlemskap alene.
- **Observer UX-konsekvensen:** tilbyr menyen en handling kmy ikke kan utføre? Noter om det er forvirrende (input til G1-mutere-saken + om Del E kan «lukkes» fullt eller kun visuelt).

**Avvik-flagg:** en mutasjon *lykkes* for kmy → flyt-grenen lakk inn i en mutasjons-guard (bryter «11 mutasjoner urørt»).

### D6 — Negativ kontroll (toggle) — DoD (4)
Kenneth deaktiverer kmys flyt-rad (`periode_slutt = now()`), kmy laster på nytt:
- Liste: 0 · Detalj (KB2-005): «ikke funnet» · Opprett KB2: blokkert.
- **Forventet:** kmy ser/gjør INGENTING — nå også på detalj + opprett (ikke bare liste som i del 1).
Så reaktiver (`periode_slutt = NULL`). **Avvik:** kmy ser noe deaktivert → flyt-grenen respekterer ikke periode-vinduet.

### D7 — Admin uendret — DoD (5)
Admin (`kemyrhau@gmail.com`): detalj åpner, opprett virker, ser alt — identisk med før. **Avvik:** endring → fiksen rørte admin-grenen (skal returnere før flyt-grenen).

### D8 — Ytelse
Detalj-lasting + opprett: ingen N+1 (flyt-grenen gjenbruker allerede-hentet `medlem`; Steg 2 er ett `findFirst` på index-et `dokumentflyt.faggruppeId`). **Avvik:** ekstra medlems-oppslag per dokument.

## 2. Sekvens
F1–F3 → **D4 (F1-A privat) + D7 (admin) + D5 (mutasjon blokkert) først** (farligst/regresjon) → D1–D3 (positiv) → D6 (toggle-negativ) → D8. Skjermbilde + forventet-vs-observert per steg → **Kenneth klikker selv** → fabel-gate → dok-sync (`dokumentflyt.md § 3` + STATUS-AKTUELT.md — cowork ved merge) → «klar for commit».

## 3. Utfall lukker
- D1 grønn → **Del E lukket (visuelt)**; D5 avklarer om handlingene fungerer eller venter på G1-mutere.
- Alle grønn (unntatt forventede D3/D5-blokkeringer) → **N3-fiks del 2 verifisert** → A-3b Del 1d avblokkeres.
- Foreldreløs `dokumentflyt.feil.ingenFaggruppe`-nøkkel: slettes per CLAUDE.md i18n-regel (cowork ved merge).
