---
name: A3a-ordre
status: 🟢 KLAR — venter tavle-rad + relay
eier: fabel (ordre) · cowork (gate + tillegg § 2.6–2.7)
sist_verifisert_mot_kode: 2026-07-17
---

# Ordre — A-3a: handlingsmeny på kilden + «hva sier den når nei»

> **Fabel-ordre 2026-07-17.** Relayes av Kenneth; cowork gir tre + branch + tavle-rad ([parallell-arbeid-lock.md](../parallell-arbeid-lock.md) — tre-sti i raden).
>
> **Grunnlag:** [lese-okt-a1-b1-2026-07-17.md](../lese-okt-a1-b1-2026-07-17.md) · [A2-B2-innstilling.md](A2-B2-innstilling.md) (Kenneth-vedtak A-2/A-i/A-ii) · [handlingsmatrise-maalt-2026-07-17.md](handlingsmatrise-maalt-2026-07-17.md).
>
> **A-3b** (rettighetsmotor: admins tilføye-modus, Godkjenning per-ledd, `erFirmaAdmin`-paritet) er EGEN senere ordre — ikke din.

## 1. Hva som er gjort / vedtatt

Lese-økten målte: web `DokumentHandlingsmeny.tsx` er helt hardkodet (egen if-kjede, frie admin-hopp serveren avviser); **mobil-menyen bruker kilden** (`hentRolleFiltrertHandlinger`) og er fasit-mønsteret; `StatusHandlinger.tsx`-**komponenten** er død. Statusmaskinen er korrekt og **RØRES IKKE**.

**Kenneth-vedtak:** A-2 = spec-implementering av [§ 6](../dokumentflyt.md) (klient validerer mot tabellen) + § 3 (ADMIN-seksjon med manuelle statusendringer — fri fra *flyten*, innenfor *tabellen*). A-i = `rejected → in_progress → responded`.

## 2. Oppdraget

**2.1 Web-menyen på kilden.** `DokumentHandlingsmeny.tsx` konsulterer `statusHandlinger.ts` (som mobil): normalflyt via `hentRolleFiltrertHandlinger`, ADMIN-seksjon = kildens admin-utledning (mobils `ADMIN_STATUSER`-splitt). If-kjeden og de frie hoppene dør.

**2.2 «Hva sier den når nei» — deaktivert med begrunnelse** (Kenneth-prinsipp: «si fra med en gang»). Handlinger som finnes men ikke er lovlige nå vises **deaktivert med kort begrunnelse** (i18n): «Låst ved godkjenning» · «Du er ikke avsender» · «Ugyldig fra denne statusen». **Ikke skjult** (brukeren leter), **ikke feilende** (fire klikk til BAD_REQUEST). Begrunnelsene utledes fra kilden — ingen ny lokal logikk.

**2.3 A-i implementeres:** `ROLLE_HANDLINGER` rettes (`rejected→responded` UT; `rejected→in_progress` INN) + UI-vei til `in_progress` bygges. **⚠️ DELT KILDE:** endringen treffer **mobil-menyen**, som allerede leser den — **mobil re-verifiseres i samme gate** (skjermbilder begge plattformer).

**2.4 `StatusHandlinger.tsx`-komponenten slettes.**

> ⚠️ **Fila er IKKE død — komponenten er det** (cowork-målt). Fila eksporterer `byggVideresendValg` + `VideresendValg`/`DokumentflytData`/`FaggruppeData`/`EntrepriseData`, og `DokumentHandlingsmeny.tsx:11-12` **importerer dem**. Flytt til levende hjem FØR sletting — `rm` på fila brekker bygget.
>
> **Bonus:** `:55` eksporterer `export type EntrepriseData = FaggruppeData`. **«Entreprise» er forbudt i ny kode** ([CLAUDE.md](../../CLAUDE.md) § Viktige regler). Flyttingen er anledningen til å drepe aliaset — mål hvem som importerer det først.

**2.5 `rejected→responded`-fella lukkes** i kilden (følger av 2.3) — verifiser at ingen UI lenger tilbyr den.

### 2.6 `erPrimaer` LESES (cowork-tillegg 2026-07-17, Kenneth-vedtatt)

`erPrimaer: true` er satt på **8 av 20 handlinger** i kilden og **leses av 0 flater** — verifisert: `apps/web` = 0 treff; `apps/mobile` = 2 treff, begge i timer-modulen (urelatert).

**Uten dette punktet porterer du if-lista til en kilde-drevet if-liste**, og «Trekk tilbake» — som kilden merker som **primærhandlingen** fra `sent` — blir liggende i nedtrekkets ADMIN-seksjon på 3–4 klikk. Det var Kenneths opprinnelige funn.

**Krav:** primærhandlingen rendres som **knapp**, resten i nedtrekk. Layouten skal fortsatt matche [§ 3](../dokumentflyt.md)s ASCII-spec — men **utledet fra `erPrimaer`, ikke hardkodet**.

### 2.7 Bekreftelse differensieres (cowork-tillegg 2026-07-17, Kenneth-vedtatt)

**Målt:** `DokumentHandlingsmeny.tsx:416-424` er to-stegs for **alle** handlinger — første klikk armerer, andre utløser. **Bekreftelsen fanger ingen informasjon:** `DocumentTransfer` skrives ved hver statusendring med `senderId` + `senderRolle` + `fromStatus`→`toStatus` + `createdAt` + mottaker + org-snapshot. **`comment` er `String?`** — valgfri i schema og i tRPC (`kommentar: z.string().optional()`).

**Bekreftelse er for irreversibilitet, ikke for logging.** Statusmaskinen sier hvor: **`closed: []`** er eneste blindvei; `deleted` er sletting. Alt annet er reversibelt (`cancelled → draft`, `sent → cancelled`).

**Krav:**
- **1 klikk** for alt unntatt `closed` og `deleted` — handlingen utføres direkte; `DocumentTransfer` registrerer hvem/hva/når.
- **2 klikk** (bekreft) for `closed` og `deleted`.
- **Kommentar: alltid tilgjengelig, aldri påkrevd** — et felt, ikke et modalt steg. `comment: String?` er designet slik.

**Ingenting går tapt.** Sporet er identisk; bekreftelses-dialogen forsvinner der den ikke beskytter noe. Kenneths funn: *«Lukk → Bekreft med kommentar → sjekklisten fikk ingen endringer — hvorfor lukke med kommentar?»*

> **Presisering til 2.1** (cowork): ordren sa opprinnelig at kommentaren på `:3-5` er «usann». **Den er sann** — mobil *bruker* kilden. Rådet er derimot snudd: den anbefaler at mobil migreres til webs «posisjon-baserte logikk», og web er den ødelagte. Den skal dø fordi anbefalingen er invertert, ikke fordi den lyver.

## 3. Ufravikelig

- Statusmaskinen (`isValidStatusTransition`) endres **IKKE**. Server-rutene endres **IKKE**. A-3b-scope (redigeringsmodus/tilføye, Godkjenning-rettigheter, `erFirmaAdmin` i web) røres **IKKE**.
- Rapporten/ordren/matrisen er **input — mål selv**. Negativ kontroll. Usikker: **SI DET**. [§11c](../dokumentasjons-standard.md)-nevner på tall. [§11e](../dokumentasjons-standard.md) på fravær.
- i18n `t()` på alle nye strenger + `generate.ts` (du eier generatoren i ditt vindu — cowork bekrefter at ingen annen økt kjører den).
- Alle fire dokumenttyper verifiseres (Sjekkliste/Oppgave/HMS/Godkjenning — HMS/Godkjenning rendres via oppgave-/sjekkliste-sidene).

## 4. DoD

Kode → **`next build` grønn** (ikke bare typecheck) → skjermbilder til fabel: web-meny normalbruker + admin (deaktiverte med begrunnelse synlig), **primærhandling som knapp**, **1-klikks-handling utført + `DocumentTransfer`-rad verifisert**, mobil-meny re-verifisert, `rejected`-dokument med `in_progress`-vei → fabel-gate → dok-sync ([dokumentflyt.md](../dokumentflyt.md) § 3/§ 6: «klient validerer mot tabellen» er nå sann) → «klar for commit» til cowork.

## 5. Opprydding

Cowork eier merge + branch- og worktree-sletting ([fase 4](../SAMARBEIDSREGLER.md)).
