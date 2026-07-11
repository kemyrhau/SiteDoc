---
name: k13-sokdekning-rapport
description: K13 — Full sidedekning i globalt søk (Ctrl+K). Dekningsmatrise (rute → søkekilde/UDEKKET) + løsningsforslag (én ny «dype sider»-kilde) + dekningstest. K13 = søkedekning (fabel 2026-07-11, distinkt fra F20-K12 fakturering).
status: godkjent — under implementasjon
sist_verifisert_mot_kode: 2026-07-11
branch: redesign/navigasjon
k13_utfall: "a) kom-i-gang JA (dyp side, uten sone-brødsmule) · b) modeller/punktskyer NEI (vent K4) · c) opprett-handlinger egen sak · d) dokumentleser ekskludert v1 + ryddesjekk i BACKLOG · e) admin NEI (vent K11) · g) begge timer-setup-faner (onboarding+oppsett) som hub-underlenker, gjenbruk fane-nøkler (fabel, funnet ved rebase mot develop). Kenneth/fabel bekreftet 2026-07-11."
---

> **STATUS 2026-07-11:** Godkjent av fabel med tre pålegg (innbakt i §4.0/§4.2b/§4.3).
> **KODE KOMPLETT + verifisert:** typecheck rent, **vitest dekningstest grønn (2/2)** —
> 94 disk-ruter, 0 udekket, 0 orphans. i18n nb+en + generate.ts (15 språk).
> **Gjenstår:** browser Ctrl+K-skjermbilder (inkl. negativ-test) → fabel-designgodkjenning.
> **Fabel-avgjørelse:** kom-i-gang får INGEN sone-brødsmule — kun tittel «Kom i gang» i SIDER-gruppa.
>
> **Dev-deps (dev-only, additive):** `vitest` (finnes i monorepo via @sitedoc/shared) +
> `@vitejs/plugin-react` (NY — vitest 4/rolldown krever den for å parse `.tsx` med
> lucide-ikoner i testens importerte moduler). Flagget til fabel.

# K13 — Full sidedekning i globalt søk

**Mål:** Globalt søk (Ctrl+K, `SokModal` via `useSokRegistry`) skal treffe **alle
navigerbare sider**, uansett om siden ligger i sidebar/hub eller ikke. Innholdssøk
(dokumenter, personer, timer) er UTENFOR scope (v2, serverside/ai-søk).

**Metode:** Verifisert `navigasjon-arkitektur-analyse-2026-05-03.md` (tiltak-tabell A–E)
+ paritetssjekklista mot faktisk `apps/web/src/app/`-struktur (105 `page.tsx` i dag).
Rutene ble **ikke** kartlagt på nytt fra scratch — avvik mot ankeret rapporteres nedenfor.

---

## 1. Dagens søkedekning — hvordan registeret bygges

`useSokRegistry` (`apps/web/src/hooks/useSokRegistry.ts`) utleder treff fra **tre**
delte kilder — ingen egen søkeliste:

| Kilde | Fil | Gir treff for |
|---|---|---|
| Hub-kort (INNSTILLINGER) | `lib/innstillinger-kort.tsx` (`useInnstillingerKort`) | Hver synlig `underlenke` i firmaKort + prosjektKort (chip-nivå) |
| Prosjekt-sidebar (SIDER) | `components/layout/sidebar-elementer.tsx` (`useSidebarElementer` → `filtrertHovedelementer`) + `kontakterElement` | Prosjektmodulene i sidebaren + Kontakter |
| Firma-nav (SIDER) | `components/layout/firma-nav.tsx` (`useFirmaNavElementer`) | FIRMA-sonens navigasjon |

**Konsekvens av dagens design:** kun ruter som er representert i én av disse tre
strukturene blir søkbare. `bunnelementer` (maskin, oppsett) itereres **ikke** av
registeret — maskin reddes av hub-kortet, men `oppsett`-landing gjør det ikke.
Enhver «dyp» side (fane/underside/sekundærside) uten nav-hjem er usynlig i søk.
Dette er samme feilklasse som F3: en rute finnes, men ingen inngang peker på den,
og ingenting feiler når det skjer.

---

## 2. Dekningsmatrise

Legende: **✅ Dekket** (kilde angitt) · **❌ UDEKKET** (navigerbar side, mangler i søk,
skal inn) · **⬜ Ekskludert** (bevisst utenfor — grunn angitt) · **🟡 Blokkert** (K-avklaring
kreves før den kan inn).

### 2.1 Per-prosjekt `/dashbord/[prosjektId]/*`

| Rute | Status | Kilde / grunn | Gating | Paritet |
|---|---|---|---|---|
| `/[pid]` | ✅ | sidebar `dashbord` | `kreverProsjekt=false` | P1 |
| `sjekklister` | ✅ | sidebar | `kreverGruppemodul="sjekklister"` | P2 |
| `sjekklister/[id]` | ⬜ | detaljside ([id]) | — | P3 |
| `sjekklister/skriv-ut` | ⬜ | utskrift | — | P4 |
| `oppgaver` | ✅ | sidebar | `kreverGruppemodul="oppgaver"` | P5 |
| `oppgaver/[id]` | ⬜ | detaljside | — | P6 |
| `hms` | ✅ | sidebar | `kreverModul="hms-avvik"` | P7 |
| `tegninger` | ✅ | sidebar | `kreverGruppemodul="tegninger"` | P8 |
| `3d-visning` | ✅ | sidebar | `kreverIfc`+`kreverGruppemodul="3d"` | P9 |
| `tegning-3d` | ✅ | sidebar | `kreverIfc` | P10 |
| `modeller` | 🟡 | K4 (3D-konsolidering — underinngang under «Tegninger», utsatt) | avledet | P11 |
| `punktskyer` | 🟡 | K4 (utsatt) | — | P12 |
| `bilder` | ✅ | sidebar | `kreverProsjekt` | P13 |
| `mapper` | ✅ | sidebar | `kreverProsjekt` | P14 |
| `dokumentleser` | 🟡 | Reader, ingen nav-hjem, ingen direkte lenke funnet — **verifiser med Kenneth (K13-d)** | `kreverProsjekt` | P19 |
| `dokumenter/[id]/les` | ⬜ | detaljside (per-dok reader) | — | P19 |
| `kontrollplan` | ✅ | sidebar | `kreverModul="kontrollplan"` | P20 |
| `okonomi` | ✅ | sidebar | `kreverModul="okonomi"` | P21 |
| `sok` | ✅ | sidebar | `kreverProsjekt` | P22 |
| `psi` | ✅ | sidebar | `kreverModul="psi"` | P23 |
| `mannskap` | ✅ | sidebar | `kreverModul="psi"` | P24 |
| `timer` | ✅ | sidebar | `kreverFirmaModul="timer"` | P25 |
| `timer/ny` | ⬜ | opprett-side (nås fra `timer`) | — | P25 |
| `timer/[id]` | ⬜ | detaljside | — | P25 |
| `timer/attestering` | ✅ | sidebar | `kreverFirmaModul="timer"`+`kreverTimerLeder` | P26 |
| `timer/attestering/[id]` | ⬜ | detaljside | — | P26 |
| `timer/godkjenning` | ⬜ | redirect → attestering | — | P27 |
| `vareforbruk` | ✅ | sidebar | `kreverFirmaModul="varelager"` | P28 |
| **`maler`** | **❌** | **Ingen søkeinngang.** Sidebar utelater maler bevisst; hub «Maler»-kort peker på *malverk* (oppgavemaler/sjekklistemaler), ikke bibliotekvalg-siden. Lenket kun fra prosjekt-dashbord-kort | `kreverProsjekt` | P29 |
| `faggrupper` | ✅ | hub «Medlemmer › Faggrupper» | `kreverProsjekt` | P30 |
| `kontakter` | ✅ | `kontakterElement` | `kreverProsjekt` | P31 |

### 2.2 Prosjekt-oppsett `/dashbord/oppsett/*`

| Rute | Status | Kilde / grunn | Gating | Paritet |
|---|---|---|---|---|
| `oppsett` (landing) | ⬜ | landing erstattet av hub `/dashbord/innstillinger` under nyNav | — | — |
| `produksjon` (parent) | ⬜ | parent-node (O3), ingen egen skjerm | — | O3 |
| `brukere` | ✅ | hub «Medlemmer › Medlemmer» | `kreverProsjekt` | O1 |
| `byggeplasser` | ✅ | hub «Prosjektoppsett › Byggeplasser» | `kreverProsjekt` | O2 |
| `produksjon/dokumentflyt` | ✅ | hub «Dokumentflyt» | `manage_field` | O4 |
| `produksjon/kontakter` | ⬜ | redirect → dokumentflyt (K6) | — | O5 |
| `produksjon/oppgavemaler` | ✅ | hub «Maler › Oppgavemaler» | `manage_field` | O6 |
| `produksjon/oppgavemaler/[id]` | ⬜ | detaljside | — | O6 |
| `produksjon/sjekklistemaler` | ✅ | hub «Maler › Sjekklistemaler» | `manage_field` | O7 |
| `produksjon/sjekklistemaler/[id]` | ⬜ | detaljside | — | O7 |
| `produksjon/moduler` | ✅ | hub «Moduler» | `manage_field` | O8 |
| `produksjon/box` | ✅ | hub «Prosjektoppsett › Mappeoppsett» | `manage_field` | O9 |
| `produksjon/psi` | ✅ | hub «Maler › PSI-mal» | `manage_field`+psiAktiv | O10 |
| `ai-sok` | ✅ | hub «Søk og AI › AI-søk» | `kreverProsjekt` | O11 |
| **`firma`** | **❌** | **Ingen søkeinngang.** Ekte side (180 linjer, ikke redirect). Hub «Prosjektoppsett» mangler «Eier-firma»-underlenke | `harFirmaTilgang` | O12 |
| `prosjektoppsett` | ✅ | hub «Prosjektoppsett › Generelt» | — | O13 |

### 2.3 Firma-administrasjon `/dashbord/firma/*`

| Rute | Status | Kilde / grunn | Gating | Paritet |
|---|---|---|---|---|
| `firma` | ✅ | firmaNav «Oversikt» | company/sitedoc_admin | F1 |
| `prosjekter` | ✅ | firmaNav | do. | F2 |
| `ansatte` | ✅ | firmaNav + hub | do. | F3 |
| `avdelinger` | ✅ | firmaNav + hub | do. | F4 |
| `oppmotesteder` | ✅ | firmaNav | do. | F5 |
| `kompetanse` | ✅ | firmaNav + hub | do. | F6/F7 |
| `hms` | ✅ | firmaNav + hub | `kreverHmsTilgang` | F8/F9 |
| `moduler` | ✅ | firmaNav | do. | F10 |
| `timer` (index) | ✅ | firmaNav | `kreverFirmaModul="timer"` | — |
| `timer/lonnsarter` | ✅ | hub «Timer › Lønnsarter» | do. | F11 |
| `timer/aktiviteter` | ✅ | hub «Timer › Aktiviteter» | do. | F12 |
| `timer/tillegg` | ✅ | hub «Timer › Tillegg» | do. | F13 |
| **`timer/onboarding`** | **❌** | **Ingen søkeinngang.** Ikke i firmaNav, ikke i hub timer-kort | `kreverFirmaModul="timer"` | F14 |
| `timer/rapport` | ✅ | firmaNav | do. | F15 |
| **`timer/attestering`** | **❌** | **Ingen søkeinngang.** firmaNav har timer+rapport, ikke attestering; hub timer-kort har kun lønnsart/aktivitet/tillegg | do. | F16 |
| `timer/attestering/[id]` | ⬜ | detaljside | — | F16 |
| `kalender` | ✅ | firmaNav + hub | company/sitedoc_admin | F17 |
| `varelager` | ✅ | firmaNav + hub | `kreverFirmaModul="varelager"` | F18 |
| `varelager/import` | ✅ | hub «Varelager › Import» | do. | F19 |
| `fakturering` | ✅ | firmaNav + hub | `kreverSitedocAdmin` (K12) | F20 |
| `innstillinger` | ✅ | hub «Firmaprofil › Firmainfo» (firmaNav-treff droppes under nyNav) | company/sitedoc_admin | F21 |
| `innstillinger/integrasjoner` | ✅ | firmaNav | do. | F22 |

### 2.4 Firmamodul-arbeidsflater (maskin) `/dashbord/maskin/*`

| Rute | Status | Kilde / grunn | Gating | Paritet |
|---|---|---|---|---|
| `maskin` | ✅ | hub «Maskin › Register» | `kreverFirmaModul="maskin"` | FM1 |
| `maskin/[id]` | ⬜ | detaljside | — | FM2 |
| `maskin/nytt` | ⬜ | opprett-side (nås fra FM1) — **jf. K13-c** | — | FM3 |
| **`maskin/import`** | **❌** | **Ingen søkeinngang.** Hub maskin-kort har kun «Register» | `kreverFirmaModul="maskin"` | FM4 |

### 2.5 «Mine timer» / global timer `/dashbord/timer/*`

| Rute | Status | Kilde / grunn | Gating | Paritet |
|---|---|---|---|---|
| `timer/mine` | ✅ | sidebar `mine-timer` → «Min side»-treff | `kreverFirmaModul="timer"` | FM5 |
| `timer/ny` | ⬜ | opprett-side | — | FM5 |
| `timer/[id]` | ⬜ | detaljside | — | FM5 |

### 2.6 Øvrige `/dashbord/*`

| Rute | Status | Kilde / grunn | Paritet |
|---|---|---|---|
| `dashbord` (rot) | ✅ | sidebar `dashbord` (uten prosjekt) | — |
| `innstillinger` (hub) | ✅ | `inn:hub`-treff | — |
| `kom-i-gang` | 🟡 | Navigerbar side uten nav-hjem — **K8 utsatt; K13-a: inn i søk eller ekskluder?** | X2 |
| `nytt-prosjekt` | ⬜ | opprett-handling (firma påkrevd) — **jf. K13-c** | X3 |
| `prosjekter` + `prosjekter/[id]/*` | ⬜ | K9: legacy-tre, server-redirects → kanonisk `/[pid]/*` | X4 |

### 2.7 sitedoc_admin `/dashbord/admin/*`

| Rute | Status | Grunn | Paritet |
|---|---|---|---|
| `admin`, `admin/firmaer`, `admin/prosjekter`, `admin/integrasjoner`, `admin/tillatelser`, `admin/testsider` | 🟡 | K11 (admin-redesign UT AV SCOPE). Admin nås via toppbar. **K13-e: skal admin-sider i søk nå eller vente på K11?** | A1–A6 |

### 2.8 Utenfor `/dashbord` (X-serie)

| Rute | Status | Grunn |
|---|---|---|
| `/`, `/logg-inn`, `/registrer`, `/personvern`, `/aksepter-invitasjon`, `/mobil-viewer`, `/psi/[prosjektId]`, `/utskrift/*` | ⬜ | Offentlig/auth/QR/utskrift — utenfor sidebar-nav per definisjon (X1/X5/X6/X7) |

---

## 3. Oppsummering — det som mangler

**Klart UDEKKET (skal inn i søk, ingen K-blokker):**

| # | Rute | Paritet | Gating |
|---|---|---|---|
| 1 | `/dashbord/[prosjektId]/maler` | P29 | `kreverProsjekt` |
| 2 | `/dashbord/oppsett/firma` (Eier-firma) | O12 | `harFirmaTilgang` |
| 3 | `/dashbord/firma/timer/onboarding` | F14 | `kreverFirmaModul="timer"` |
| 4 | `/dashbord/firma/timer/attestering` | F16 | `kreverFirmaModul="timer"` |
| 5 | `/dashbord/maskin/import` | FM4 | `kreverFirmaModul="maskin"` |

**Blokkert (K-avklaring FØR de kan inn):** `modeller`, `punktskyer` (K4) ·
`dokumentleser` (K13-d) · `kom-i-gang` (K13-a) · admin-sider (K13-e).

**Avvik mot 2026-05-03-ankeret** (bekreftet under kartlegging, alt allerede fanget i
paritetslistas «Kode-diff-noter»): `firma/ansatte` (ikke `brukere`), `firma/hms`,
`firma/kalender`, `firma/oppmotesteder`, `firma/moduler`, `firma/varelager*`,
`firma/timer/rapport|attestering|onboarding`, `[pid]/mannskap`, `[pid]/vareforbruk`,
`[pid]/kontakter`, `[pid]/dokumentleser` — ankeret er utdatert her, paritetslista er fasit.

---

## 4. Løsningsforslag

### 4.1 Prinsipp — én kilde, nav og søk leser samme

Rotårsaken til hullene: dagens tre kilder dekker bare det som er *representert i nav/hub*.
De fem UDEKKEDE sidene er «dype» sider uten nav-hjem. Løsningen skal **ikke** duplisere
noen rutel iste, men legge til **ÉN ny delt, statisk kilde** for dype sider som
registeret konsumerer på lik linje med de tre andre.

**Regel som gjør dekningen komplett og drift-fri (akseptkriterium — rekkefølgen er bindende):**
Hver navigerbar `page.tsx` tilhører **nøyaktig én** kilde, og reglene prøves **i denne rekkefølgen**:
1. **Regel 1 prøves FØRST:** hører siden hjemme i nav/hub (en innstilling/konfig) → gi den
   nav-hjem som **hub-underlenke** (søk følger gratis, og hub-pariteten lukkes samtidig — F5-klasse). Ellers
2. **Regel 2:** er den en ren **arbeidsflate** uten nav-hjem → den nye `dypeSider`-kilden. Ellers
3. **Regel 3:** bevisst utenfor (redirect/detalj/opprett/offentlig/K-utsatt) → **eksplisitt unntaksliste** (§4.3).

Ingen side kan være i to kilder (unngår dobbelt-treff), og ingen kan mangle i alle tre
(fanges av dekningstesten). **Opus skal begrunne regel-valget per side i implementasjonen.**

### 4.0 Klassifisering av de fem UDEKKEDE (pålegg 2)

| Rute | Karakter | Regel | Plassering | Begrunnelse |
|---|---|---|---|---|
| `oppsett/firma` (Eier-firma, O12) | Innstilling | **1** | Hub-underlenke på «Prosjektoppsett»-kortet | Prosjekt-konfig-side; lukker hub-paritet O12 samtidig |
| `maskin/import` (FM4) | Innstilling | **1** | Hub-underlenke på «Maskin»-kortet | Speiler eksisterende «Varelager › Import»; lukker FM4 i hub |
| `firma/timer/onboarding` (F14) | Innstilling | **1** | Hub-underlenke på «Timer»-kortet | Timer-oppsett = konfig; lukker F14 i hub |
| `[pid]/maler` (P29) | **Arbeidsflate** | **2** | `dypeSider` | Bibliotekvalg for prosjekt, ikke konfig — hører ikke i innstillings-hub |
| `firma/timer/attestering` (F16) | **Arbeidsflate** | **2** | `dypeSider` | Leder-attestering = arbeidsflate, ikke konfig |

### 4.2 Ny kilde: `dype-sider.tsx` + `useDypeSider()`

Ny fil `apps/web/src/components/layout/dype-sider.tsx`:

```ts
export interface DypSide {
  id: string;
  labelKey: string;                 // i18n, nb+en
  brodsmuleKeys: string[];          // i18n-kjede, f.eks. ["nav.soneFirma","innstillinger.timer.tittel"]
  href: (pid: string | null) => string | null; // null når kreverProsjekt og ingen valgt
  // Gating — SAMME flagg-vokabular som nav (K7-abstraksjon når den kommer):
  kreverProsjekt?: boolean;
  kreverFirmaModul?: "timer" | "varelager" | "maskin";
  kreverHmsTilgang?: boolean;
  kreverSitedocAdmin?: boolean;
  tillatelse?: Permission;
  kreverModul?: string;
}

// Kun ARBEIDSFLATER uten nav-hjem (regel 2). Innstillings-sidene (eierFirma,
// maskinImport, timerOnboarding) er FLYTTET til hub-underlenker — se §4.2b.
export const dypeSider: DypSide[] = [
  { id: "maler", labelKey: "innstillinger.maler.tittel", brodsmuleKeys: ["nav.soneProsjekt"], href: (p) => p ? `/dashbord/${p}/maler` : null, kreverProsjekt: true },
  { id: "firmaAttestering", labelKey: "firmaNav.timerAttestering", brodsmuleKeys: ["nav.soneFirma","innstillinger.timer.tittel"], href: () => "/dashbord/firma/timer/attestering", kreverFirmaModul: "timer" },
  // + evt. { id: "komIGang", ... } hvis K13-a = JA.
];
```

### 4.2b Hub-underlenker (regel 1) — de tre innstillings-sidene

Legges som nye `underlenker` på **eksisterende** hub-kort i `innstillinger-kort.tsx`.
Gating arves fra kortets kontekst; nye underlenker får `synlig`-betingelse der siden
krever mer enn kortet:

| Rute | Kort | Ny underlenke (labelKey) | `synlig`-betingelse |
|---|---|---|---|
| `oppsett/firma` | «Prosjektoppsett» (prosjekt) | `innstillinger.lenke.eierFirma` | **`kreverProsjekt` OG `harFirmaTilgang`** (pålegg 1 — begge lag; prosjekt-kontekstuell + firmatilgang-gated) |
| `maskin/import` | «Maskin» (firma) | `innstillinger.lenke.maskinImport` | arves: `kanAdministrereFirma && harMaskin` (som «Register») |
| `firma/timer/onboarding` | «Timer» (firma) | `innstillinger.lenke.timerOnboarding` | arves: `kanAdministrereFirma && harTimer` |

> **Pålegg 1 (rettet):** Eier-firma krever **både** prosjekt-kontekst (for href-utleding)
> **og** `harFirmaTilgang` — ikke bare `kreverProsjekt`. `harFirmaTilgang`-signalet finnes
> ikke i `useInnstillingerKort` i dag og må hentes inn (samme kilde som O12-siden bruker).
> Dette er akkurat den stille tilgangsfeilen dekningstesten *ikke* fanger — verifiseres
> manuelt (bruker uten firmatilgang skal ikke se treffet).

Søk følger disse automatisk via den eksisterende INNSTILLINGER-sløyfen i `useSokRegistry`
(linje 85–98) — ingen ny registerkode for regel-1-sidene.

`useDypeSider()` **gjenbruker gating-signaler som allerede beregnes** (ingen nye
tRPC-kall utover det React Query allerede cacher): `useFirma()` (firmamoduler,
erSitedocAdmin, harHmsTilgang), `useProsjekt()` (prosjektId), og — der en dyp side
gater likt som en eksisterende nav-forelder — leser den samme flagg. Dette honorerer
«samme gating-abstraksjon som nav» (K7) uten å foregripe K7-refaktoren.

**`useSokRegistry` endres minimalt** — legg til én sløyfe etter de tre eksisterende:

```ts
const dypeSider = useDypeSider();
for (const s of dypeSider) {
  const href = s.href(prosjektId);
  if (!href) continue;
  legg(`dyp:${s.id}`, "sider", t(s.labelKey), s.brodsmuleKeys.map((k) => t(k)), href);
}
```

**i18n:** nye nøkler i `nb.json` + `en.json` (`innstillinger.lenke.eierFirma`,
`firmaNav.timerOnboarding`, `firmaNav.maskinImport`; `firmaNav.timerAttestering` finnes),
deretter `generate.ts` for de 13 øvrige (kun på redesign-branchen — frossen sone S5).

### 4.3 Dekningstest — så hullet ikke kan gjenoppstå stille (F3-klasse)

Ny test `apps/web/src/hooks/__tests__/sok-dekning.test.ts` (vitest — allerede i bruk i
`packages/shared`; web trenger en liten `vitest.config.ts`). Ren, hook-fri —
leser **statiske rutelister**, ikke React-tilstand:

1. **Diskside:** glob `apps/web/src/app/dashbord/**/page.tsx` → normaliserte rutemønstre.
2. **Dekket:** union av modulnivå-eksporter — `hovedelementer`, `bunnelementer`,
   `firmaNavElementer`, `dypeSider`, og en ny modulnivå-`hubRuter: string[]`
   (href-literalene løftes ut av `useInnstillingerKort`-useMemo til en delt const som
   både hooken og testen importerer — liten refaktor, ingen atferdsendring).
   **Akseptkriterium (pålegg 3):** `useInnstillingerKort` skal *lese hrefs fra* `hubRuter`
   (én sannhetskilde), ikke ha en parallell kopi ved siden av konsten — ellers gjenskapes
   nettopp driften testen skal hindre. Testen og hooken må dele identisk liste.
3. **Unntaksliste** `SOK_UNNTAK: {mønster, grunn}[]` — én rad per bevisst ekskludert rute:
   detalj (`[*]`), opprett (`/ny`,`/nytt`,`/nytt-prosjekt`), redirect (kontakter,
   godkjenning, legacy `prosjekter/*`), landing/parent (`oppsett`,`produksjon`),
   offentlig/auth/utskrift, K-utsatt (`modeller`,`punktskyer`,`dokumentleser`,
   `kom-i-gang`,`admin/*`).
4. **Assert:** hver disk-rute er *enten* dekket *eller* i unntakslista. Ny `page.tsx`
   som verken er i en kilde eller unntakslista → **testen feiler** og tvinger en bevisst
   beslutning (legg i kilde, eller i unntakslista med grunn).

Testen kjøres i `pnpm test` (turbo `test`-pipeline finnes). Alternativ hvis web-vitest
er uønsket: samme logikk som `tsx`-skript i `pnpm typecheck`-nabo — men vitest anbefales
(konsistent med `shared`, kjører i CI-pipeline).

---

## 5. Nye beslutninger (K-punkter) — meldes FØR kode

**Status:** Fabel-kontroll enig i alle anbefalingene under. **Venter Kenneths bekreftelse
(K13-a…e)** før de låses i K-BESLUTNINGER.md og kode.

| # | Spørsmål | Anbefaling (fabel + Opus enige) |
|---|---|---|
| K13-a | `kom-i-gang` i søk? | **Ja, som dyp side** «Kom i gang» (billig, findbar). Alt. ekskluder til K8. |
| K13-b | `modeller`/`punktskyer` i søk nå? | **Nei** — unntaksliste til K4 avgjør «Tegninger»-konsolideringen (unngå å foregripe K4). |
| K13-c | Opprett-sider (`nytt-prosjekt`, `maskin/nytt`, `timer/ny`) som søke-*handlinger*? | **Utenfor K13** — K13 = navigerbare sider, ikke handlinger. Egen sak. |
| K13-d | `[pid]/dokumentleser` (reader uten nav-hjem/lenke) — dyp side eller ekskluder? | **Ekskluder v1** (verifiser om siden fortsatt brukes; kandidat for opprydding). |
| K13-e | Admin-sider (`/dashbord/admin/*`) i søk nå? | **Nei** — unntaksliste til K11 (admin-redesign). Kun sitedoc_admin, nås via toppbar. |
| K13-f | Fakturering-gating i dyp/hub — `erSitedocAdmin` vs company_admin | **Uendret** (= F20-K12, allerede Kenneth-flagget). Ingen ny beslutning her. |
| K13-g | `firma/timer/onboarding` + ny `firma/timer/oppsett` (develop la til under rebase) — én eller begge i søk, og hvilken label? | **Avgjort (fabel 2026-07-11):** BEGGE faner som hub-underlenker på Timer-kortet (regel 1) — «Onboarding» → `/onboarding`, «Oppsett» → `/oppsett`. Gjenbruker develops `firma.timer.fane.onboarding`/`.oppsett`-nøkler (label var «Onboarding»/«Oppsett»); min feilaktige `innstillinger.lenke.timerOnboarding`=«Oppsett» **fjernet** (redundant). Funnet av dekningstesten under rebase mot develop. |

---

## 6. Estimat (etter godkjenning)

| Steg | Arbeid | Estimat |
|---|---|---|
| 1 | `dype-sider.tsx` + `useDypeSider()` + wire inn i `useSokRegistry` | 2–3t |
| 2 | 3 hub-underlenker (regel 1 — lukker hub-paritet O12/F14/FM4 samtidig) + 2 dype sider (regel 2) m/ korrekt gating + i18n (nb+en) + `generate.ts` (13 språk) | 1,5–2,5t |
| 3 | Dekningstest (vitest + `vitest.config.ts` i web + løft `hubRuter` til modulnivå) | 2–3t |
| 4 | Paritetssjekkliste: ny «Søkedekning»-kolonne + kryss av P/O/F/FM-rader | 0,5t |
| 5 | Verifisering (flagg på, Ctrl+K per nytt søkeord + dekningstest grønn) | 1t |
| | **Sum** | **~7–9t** |

Avhengig av K13-a…e kan 1–2 ekstra dype sider komme til (marginalt).

---

## 7. Dokumentasjonskrav (løpende)

- Paritetssjekklista (`redesign-paritetssjekkliste.md`) får **«Søkedekning»-kolonne** —
  gjøres i steg 4, ikke etterpå.
- K13-a…e låses ikke i kode før fabel/Kenneth har svart.
- Alt på `redesign/navigasjon`; frossen sone-regler (`parallell-arbeid-lock.md`) gjelder —
  `generate.ts` kjøres kun på denne branchen.

**Leveranse-status:** Fase 1 (kartlegging) + Fase 2 (design) komplett. Venter
fabel-godkjenning før implementasjon.
