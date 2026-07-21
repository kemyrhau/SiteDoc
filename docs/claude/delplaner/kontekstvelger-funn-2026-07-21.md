---
name: kontekstvelger-funn-2026-07-21
status: 🟡 TRE FUNN — alle pre-eksisterende, ikke fra P1. K1+K2 har Kenneth-retning, K3 venter fabel
eier: fabel (K3 design) · Kenneth (retning gitt på K2) · cowork (gate) · redesign-Opus (måling)
sist_verifisert_mot_kode: 2026-07-21
---

# Firma/prosjekt/byggeplass-kontekst i ny nav — tre funn

> Funnet da Kenneth testet firma-HMS manuelt under P1-skjermbilderunden. **Alle tre er pre-eksisterende** — redesign-Opus verifiserte mot `git blame` at ingen stammer fra P1-branchen. De ble bare *synlige* fordi P1 ryddet i nivåsignalet rundt dem.

## K1 — Byggeplass-velgeren lekker inn i firmakontekst

**Kode:** `Toppbar.tsx:132` — betingelsen er `{prosjektId && <ByggeplassVelger />}`. Den sjekker kun om et sticky prosjekt finnes, **ikke** om brukeren står i prosjektkontekst.

**Virkning:** på `/dashbord/firma/hms` vises en «Bygg B12 ▾»-knapp ved siden av firma-chippen. Byggeplass er et rent prosjekt-begrep og betyr ingenting i firmavisning.

**Opphav:** `f77ef8e78` (2026-07-05) — før P1.

**Fiks (foreslått):** `{prosjektId && !erFirmaKontekst && <ByggeplassVelger … />}`. `erFirmaKontekst` finnes allerede i samme fil (`Toppbar.tsx:50`).

## K2 — Prosjektvalg fra popover navigerer ikke ut av firmasiden

**Kode:** `prosjekt-kontekst.tsx:123-136` (`velgProsjekt`), commit `17ba8bb05` (2026-07-08, «F4: behold nåværende rute»).

**Virkning:** velger du et prosjekt i chippens popover mens du står på en firmaside, skjer **ingenting synlig** — du blir stående, men prosjektkonteksten er byttet i bakgrunnen. Det er lett å ende i feil prosjekt uten å vite det.

**Paritetsbrudd:** gammel nav (`FirmaKontekstVelger.handleVelg`) navigerte **alltid** til prosjektet. Ny nav gjør det kun på noen ruter. Ikke bare en UX-svakhet — en regresjon mot gammel oppførsel.

**Hvorfor grenen finnes:** F4 bygde den for å la deg bytte prosjekt uten å forlate f.eks. `/dashbord/oppsett/*`. Der er «bli stående» riktig. På firmasider er det feil, fordi firma og prosjekt er **gjensidig utelukkende visninger**, ikke naboer i samme flate.

**✅ Kenneth-retning 2026-07-21:** *«da må vi heller bytte til prosjektvisning»* — når `pathname.startsWith("/dashbord/firma")`, alltid `router.push("/dashbord/{id}")`. Øvrige globale ruter beholder dagens oppførsel.

## K3 — Popoveren blander tre nivåer flatt (TIL FABEL)

**Kenneths ord:** *«nå blandes prosjekt og byggeplass i en salsasaus — alle ingredienser er synlig»*.

**Strukturell årsak:** popoveren rendrer **alt samtidig og flatt** — full firmaliste + prosjekt-scope-rader («Alle»/«Mine») + full prosjektliste — uten progressiv innsnevring. **Byggeplass ligger dessuten helt utenfor popoveren**, som en egen kontroll koblet kun til sticky-prosjektet. Tre nivåer, to ulike UI-mekanismer, null hierarki mellom dem.

**Kenneths vurdering:** det bør være **én trakt** — firma → prosjekt → byggeplass — der hvert steg **folder seg sammen når det er valgt** og avdekker kun neste nivås relevante liste.

**Hvorfor det er riktig retning:** det speiler den faktiske hierarkiske modellen ([terminologi.md § 0](../terminologi.md), tre-nivå-ankeret) i stedet for å late som firma og prosjekt er sidestilte valg.

**Dette er en IA-/designbeslutning, ikke en logikk-bug.** Samme kategori som chip-sonefarger og ⇄-plassering, som fabel har spesifisert eksakt gjennom hele P1. **Bygges ikke uten vedtak.**

## Sekvensering (cowork)

| Funn | Status | Neste |
|---|---|---|
| **K1** | Retning opplagt, fiks er én betingelse | Fabel gater som liten P1-utvidelse eller egen sak |
| **K2** | Kenneth-retning gitt | Samme — men rører delt kontekst-kode, ikke P1s filer |
| **K3** | Designvedtak mangler | Fabel |

**Cowork-anbefaling:** K1 og K2 hører naturlig til P1 *tematisk* — begge er nivåforvirring, som er hele P1s formål — men de rører `Toppbar.tsx` og `prosjekt-kontekst.tsx`, som ligger **utenfor P1s skrevne scope** (`KontekstChip` + HMS-skallene). La P1 lukkes på sitt scope, og ta K1+K2 som en liten oppfølger med egen gate. Ellers vokser P1 mens den verifiseres.

## Sidenotat — browser-verktøyene sviktet

Skjermbilde-runden kostet vesentlig tid: `claude-in-chrome` feilet med «script injection timed out» på 12+ forsøk, tre faner, også etter at alle andre økter var lukket — og **også mot `example.com`**, som beviser at det ikke var SiteDoc, P1-koden eller fane-tilstand.

Underveis ble det klart at `playwright-mcp` og `claude-in-chrome` kan kjempe om samme fane via Chrome debugger-API-et (én debugger per fane), og at «Playwright MCP Bridge»-utvidelsen kan bli hengende tilkoblet en død relay etter at en økt er lukket.

**Praktisk lærdom:** ved kollisjonsmistanke — klikk Playwright MCP Bridge-ikonet → **Disconnect** før neste økt kobler til. Se [SAMARBEIDSREGLER § Kollisjonssjekk pkt 5](../SAMARBEIDSREGLER.md).

**Kenneth tok bildene manuelt til slutt**, og det fungerte umiddelbart.
