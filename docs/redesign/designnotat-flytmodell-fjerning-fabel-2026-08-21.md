# Designnotat: flytmodell — fjerning av ledd-typer, registrator som flagg (fabel, 2026-08-21)

> **Denne fila er fasit.** Fabels arkivkopi ligger i leveransemappen
> `til-repo-2026-08-21-1400/` og er en kondensert versjon (40 mot 71 linjer) — den mangler
> overgangsstrategien i F1 punkt 2 og `attestertSnapshot`-begrunnelsen i F3. Innholdet er
> ellers verifisert identisk. Jf.
> [informasjonsflyt-fabel-cowork.md § 3](../claude/informasjonsflyt-fabel-cowork.md):
> committet fil i repoet er øverste autoritet.

**Grunnlag:** `docs/claude/na-rapport-flytmodell-2026-08-21.md` (kodeverifisert av dokgen). Vedtak: rekkefølge styrer, kun registrator består. Hovedfunn: serverens aktive autorisasjon er allerede posisjonsbasert — dette er primært en **datamodell- og UI-rydding**, ikke en logikkendring. Kenneth-gate før implementeringsordre.

## F1. Rekkefølge for fjerning (lav risiko først)

1. **Klient-UI slutter å konsumere typematrisen.** `erTillattForRolle`/`ROLLE_HANDLINGER_DEFAULTS` kalles kun fra klient-UI og admin-konfig — serveren bruker dem ikke. UI-gating erstattes av samme posisjonsregler som serveren (`verifiserRetningsrett`-semantikken speiles i klient); flytbyggerens typevelger fjernes, bokser vises nummererte. Matrisen i shared markeres deprecated, fjernes når ingen konsumenter gjenstår.
2. **Skrivestopp for semantikk, ikke for kolonner.** `DokumentflytMedlem.rolle` inngår i tre unique constraints — kolonnen består inntil ny entydighetsregel er migrert (F2), men nye flyter skriver posisjonsverdi, ikke semantisk type.
3. **Migrering av entydighet + lagret data** (F2/F3).
4. **Override-modellen** (F4) — siste, fordi den bærer kundekonfigurasjon.

## F2. Ny entydighetsregel

Erstatter rolle-basert unikhet: **`@@unique([flytId, posisjon, bemanningskilde])`** — ett ledd per posisjon per flyt; bemanning (person/gruppe/faggruppe, «høyst én»-vernet) unik innen leddet. Migreringen mapper eksisterende `rolle`-verdier til posisjon via flytens rekkefølge; kollisjoner (to ledd samme posisjon) rapporteres FØR migrering kjøres — dokgen leverer kollisjonstelling fra prod som del av implementeringsordren, migrering kjøres ikke blind.

🔴 **PRESISERING (cowork, målt 2026-08-21) — NULL-fellen.** «Bemanningskilde» er **tre
nullable kolonner**, ikke én. Postgres håndhever ikke unique når en kolonne er NULL: to
rader `(flyt, posisjon 2, NULL, NULL, NULL)` — to åpne ledd på samme posisjon — ville begge
vært lovlige. I dag maskeres dette av at `rolle` inngår i de tre nøklene
(`[dokumentflytId, faggruppeId, rolle, steg]` m.fl.).

**Fabels avgjørelse:** samme posisjon **kan ikke** ha to åpne ledd — det er semantisk samme
ledd to ganger, alltid en feil, aldri et uttrykk.

**Løsning — partial unique index:** `@@unique([flytId, posisjon, faggruppeId])` m.fl. som i
dag for bemannede ledd, pluss rå SQL i migreringen for åpne:

```sql
CREATE UNIQUE INDEX ... ON dokumentflyt_medlemmer (dokumentflyt_id, posisjon)
WHERE faggruppe_id IS NULL AND project_member_id IS NULL AND group_id IS NULL;
```

Partial index fremfor generert diskriminatorkolonne: ingen ny kolonne å vedlikeholde, og
vernet står i databasen der bruddet ville oppstått. Prisma støtter ikke partial index i
schema — rå SQL i migreringen med kommentar i schemafilen aksepteres.

## F3. Lagret historikk røres ikke — den omdøpes i visning

- **`DocumentTransfer.senderRolle`:** historiske rader er logg og skal ikke migreres (samme prinsipp som attestertSnapshot: frosset ved hendelsen). Nye overføringer skriver posisjonsetikett («Ledd 2 av 4») i samme felt. PDF-loggen leser feltet som før.
- **Bug rettes uavhengig og først:** arkiv-PDF viser rå enum (`loggseksjon.ts:46`) — `utforer` → «Utfører» via eksisterende i18n. Én linje, egen liten ordre, går inn i arkiv-PDF-sporet (dokgen har flaten fra arkivmal-ordren).
🔴 **PRESISERING (cowork, målt): tom verdi er normaltilfelle, ikke vern.** 20 av 58
`document_transfers` i prod har allerede `sender_rolle = null` — en tredjedel. Fiksen må
håndtere **tre former**: kjent enum → i18n-oversettelse · posisjonsetikett → vis
som-det-er · **tom/ukjent → «—», forventet tilfelle**.

- **`Dokumentflyt.roller` (JSON):** leses den av annet enn admin-UI? Rapporten sier konfig — bekreftes i implementeringsordren; deretter fryses feltet og nye flyter lagrer kun rekkefølge.

## F4. Registrator reconcile — én kilde

De to utledningene (rolle-streng i flyten; `create_*`-tillatelse i transfer-snapshot) erstattes av **ett boolsk flagg på leddet: `erRegistrator`**. Regler: minst ett registrator-ledd per flyt (validering ved lagring av flyt); «kan starte dokumentet» leser KUN flagget; transfer-snapshotets `create_*` avledes av flagget ved snapshot-tidspunkt (snapshotet forblir frosset historikk). KP-start-spørsmålet (a/b/c) lukkes med dette: start = registrator-leddets bemanning.

## F5. Overrides (`FlytRettighetOverride/Logg.rolle`)

Firmaers lagrede overstyringer refererer typene og kan ikke slettes stille (kundekonfig = menneskelig handling). Design: overrides migreres type → posisjon der mappingen er entydig; tvetydige tilfeller listes per firma og forelegges — **ingen automatisk fjerning**. Ny override-modell adresserer ledd via posisjon.

🔴 **PRESISERING (cowork, målt): `flyt_rettighet_overrides` har 0 rader i prod.** Ingen
kunde har lagret overstyringer. Designet over har ingen data å virke på.
**Omskrevet av fabel:** ren kodeopprydding — tabell og lese-/skrivesti fjernes. Ingen
kundedialog, ingen datamigrering, ingen tvetydige tilfeller å forelegge.

## Måltall fra prod (2026-08-21)

`dokumentflyt_medlemmer`: 28 rader (10 utforer · 8 bestiller · 6 registrator · 4 godkjenner).
`document_transfers`: 58 rader (18 utforer · 18 bestiller · 2 godkjenner · **20 null**).
`flyt_rettighet_overrides`: **0 rader**.

## Rekkefølge og gates

PDF-enum-buggen (F3) → F1 → F2-kollisjonstelling → F2+F3-migrering → F4 → F5. Fabel-designgate etter F1 (UI-et er der Kenneth ser vedtaket virke) og etter F2-kollisjonsrapporten. Dette notatet til Kenneth-aksept før noe relayes som implementeringsordre.

**Umålt:** F3-spørsmålet om andre lesere av `Dokumentflyt.roller`; kollisjonsomfanget i F2 — begge er eksplisitte målepunkter i implementeringsordren, ikke antakelser.
