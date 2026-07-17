---
name: a2-b2-innstilling
status: 🟡 INNSTILLING — venter Kenneth-vedtak på fire punkter
eier: fabel (design) · cowork committer revisjoner
sist_verifisert_mot_kode: 2026-07-17
---

# A-2 + B-2 — fabels innstilling etter lese-økt-rapporten

> **Fabel 2026-07-17.** Grunnlag: [lese-okt-a1-b1-2026-07-17.md](../lese-okt-a1-b1-2026-07-17.md) (merget `47e628e7`) — gatet og godkjent: metode ren, nevner-disiplin, båret-vs-lest fullført, §11e anvendt.
>
> **Rapporten korrigerte to av coworks premisser:** `StatusHandlinger.tsx` er **død kode** (ikke «den andre levende UI-en»), og **mobil er den eneste kilde-drevne flaten**. Se rettelses-boksen i [gjennomgangsplanen](gjennomgangsplan-dokumenthandling-utfylling-malbygger.md).
>
> **Kenneth vedtar per punkt.** Innstilling ≠ vedtak.

## A-2 — admin-spørsmålet

**Faktum (rapport-målt):** web-menyens ADMIN-seksjon tilbyr **frie status-hopp** (`approved`/`closed`/`cancelled`/`draft` fra enhver status) som serveren avviser. Mobil viser kun **kilde-utledede** admin-handlinger per status, og er stort sett gyldig. Dok-utledningen (`dokumentflyt.md` § 2/3/5/6 + `ROLLE_HANDLINGER`) gir admin/registrator **utvidede** handlinger — men **innenfor statusmaskinen**, aldri frie hopp.

**Innstilling A-2: mobil-modellen er svaret.** Admin får de kilde-utledede admin-handlingene (mer enn normalflyten: lukk/trekk tilbake/gjenåpne **der statusmaskinen tillater det**) — ingen frie hopp. ADMIN-seksjonen beholdes, men drives av kilden.

**Dette er ikke en innskrenkning av admin:** de frie hoppene **virker ikke i dag** — serveren avviser dem etter fire klikk. Vi fjerner et løfte UI-et ikke kan holde.

### Tilleggsbeslutninger (avdekket av rapporten)

**A-i — `rejected → responded`-desynken.** `ROLLE_HANDLINGER` tillater den; `isValidStatusTransition` avviser → server-BAD_REQUEST. Skal en avvist oppgave kunne besvares direkte (utvid statusmaskinen), eller skal veien gå `rejected → in_progress → responded` (rett `ROLLE_HANDLINGER`)?
**Fabels innstilling:** rett `ROLLE_HANDLINGER`. Statusmaskinen er spec, og «via `in_progress`» er sporbart.

**A-ii — spec-spenning § 2 vs § 3** (admin-redigering av innsendt oppgave). § 2 sier «aldri»; § 3 sier admin får redigeringsmodus. Koden følger § 2 strengt (låst også for admin).
**Fabels innstilling:** § 2 vinner (append-only). Admin retter via avviksbehandling, ikke stille redigering; § 3-raden rettes.

**A-iii — dok↔kode-avvik 1 + 3 → develop-ordre, ikke redesign.** Type-spesifikk «closed kun admin» håndheves ikke · `company_admin`-arv mangler i `verifiserFlytRolle`/`verifiserDokumentTilgang` (FORBIDDEN for company_admin uten medlemsrad). Begge er **server-side håndhevingshull**.

### A-3-scope (etter vedtak)

Web `DokumentHandlingsmeny` konsulterer kilden (if-lista + den usanne kommentaren dør) · **«hva sier den når nei» bygges** (deaktivert med begrunnelse) · `erAdmin`-paritet web↔mobil (web mangler `erFirmaAdmin`) · `StatusHandlinger.tsx` slettes (død kode) · `in_progress`-veien inn i kilden hvis A-i vedtas slik.

## B-2 — prioritering (utfyllings-rendereren)

**1. Toleranse-regelen.** Implementér vedtatt modell i `grenseSjekk.ts`: `nominell` i `Grense`/`normaliserGrense`, `|verdi − nominell| > toleranse`, **Område XOR Toleranse håndhevet**.

> **Cowork-verifisert 2026-07-17:** i dag kan alle tre være aktive samtidig (`harGrense` returnerer true på hvilken som helst), og `formaterGrense` **konkatenerer begge** — `deler.push("8–12 cm")` + `deler.push("± 2 cm")` → `"8–12 cm · ± 2 cm"`. Det er teksten Kenneth så på skjermen. Data-fotavtrykk for `nominell` = **null** (rapport-bekreftet) → default 0 er trygt.

**2. Web-utfylling mangler `info_text`/`info_image`/`video`** → `UkjentObjekt`, og **PDF dropper 6 typer**. **Ikke edge-case:** 39 + 12 + 5 + 15 objekter bærer reelt innhold som droppes stille (data-bekreftet). Web-`KOMPONENT_MAP` kompletteres (mobil-komponentene er fasit). **B-i — Kenneth-beslutning: skal instruksjonsinnhold (info-typer) med i PDF?**

**3. Repeater-familien.** Barn rendres uten `FeltWrapper` → label forsvinner i utfylling (wrap barna) · nestet repeater får aldri barneObjekter (propagér) · PDF/utfylling har **motsatt** bilde/verdi-rekkefølge.
**Innstilling:** label → verdi → bilder overalt, som utfylling.

**4. Trafikklys — INGEN editor bygges.** F3 er komplett i begge ender: rendererne leser ikke `config.options`, **og dataen bærer den ikke** (alle 14 objekter: `{zone}`/`{zone, helpText}`). En editor ville skrevet en nøkkel ingen leser. **Fiks kun mobil-hullet** (`gray` mangler — 3 av 4 farger). Konfigurerbare farger utsettes til noen faktisk trenger dem.

**5. Delt-substrat-løft (drift-vaksine).** `REDIGERBARE_STATUSER` ×4 og `erSynlig` ×4 → `@sitedoc/shared`. Samme klasse som ga `04f6d295`-regresjonen — se [BACKLOG § Det delte substratet](../BACKLOG.md).

### Rutes develop (ikke B-2)

Avvik 2 (server håndhever ikke append-only — alt 🟠 i BACKLOG) · søsken-sporene fra spørsmål 4: `ROLLE_HANDLINGER`-diff mot statusmaskinen, klient-lås-søsken, nøkkel-dualiteter.

## Kenneth-beslutninger samlet

**A-2** (mobil-modellen?) · **A-i** (rejected-veien) · **A-ii** (§ 2 vs § 3) · **B-i** (info-typer i PDF?)

Resten er innstilt og kan gå i ordre ved ja.
