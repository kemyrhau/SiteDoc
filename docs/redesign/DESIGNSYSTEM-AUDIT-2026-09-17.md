---
name: designsystem-audit-2026-09-17
description: Kartlegging av designsystemet (tokens, packages/ui, web/mobil-paritet, statusfarger). Grunnlag for design-rollens videre arbeid etter Fabel.
sist_verifisert_mot_kode: 2026-09-17 (develop)
sist_endret: 2026-09-17
---

# Designsystem-audit (2026-09-17)

**Fra:** design-rollen (Claude Code, har overtatt etter Fabel) · **Status:** 🟡 FORSLAG. Prioriteringene under er anbefalinger; ingen ordre er gitt.
**Målt mot:** `develop` i hovedtreet. Grep-tall er størrelsesorden, ikke eksakte (alle `.ts`/`.tsx` i `apps/web/src` + `packages/ui/src`, og `apps/mobile/{app,src}` for mobil).

## Sammendrag

**Komponenter vurdert:** 14 i `packages/ui` + 3 i `apps/web/src/components/ui` + mobil-primitiver
**Hovedfunn:** 7 · **Score:** 48/100

Kort fortalt: SiteDoc har et **tynt** designsystem som dekker ca. en fjerdedel av det UI-et faktisk bruker.
Farge-tokens finnes, men bare for seks roller. Resten (grå, statusfarger, tekstskala, radius) er
ustyrt Tailwind. **Web og mobil deler ingen komponenter og er ikke enige om statusfarger.**

## 1. Token-dekning

| Kategori | Definert | Hardkodet / ustyrt |
|---|---|---|
| **Farger (web)** | 6 tokens: `sitedoc-primary/secondary/accent/success/warning/error`. **`accent` = `warning` = `#f59e0b`** | 693 token-bruk mot ~8 100 Tailwind-palettklasser (gray 5 792, blue 668, amber 521, red 515, green 313, purple/indigo/emerald/yellow/orange ~270). 191 hex i kode. Primærknapp: 204× `bg-sitedoc-primary` mot 56× `bg-blue-500/600/700/800` |
| **Farger (mobil)** | 4 tokens: `sitedoc-header #5a7a2e` (grønn), `-header-dark`, `-blue`, `-blue-light` | **Den grønne header-fargen brukes i 0 filer.** 43 token-bruk mot 695 hex; `#1E40AF` hardkodet 137 ganger (mest ikonfarger) |
| **Typografi** | Ingen tokens; Tailwind-skala | `text-sm` 1 815, `text-xs` 1 386, deretter **`text-[10px]` 169 og `text-[11px]` 128**, pluss 12/12,5/13/13,5/10,5/11,5 px. Det er i praksis en egen mikroskala under `text-xs` som ingen har vedtatt |
| **Spacing** | Tailwind-skala | 505 vilkårlige `-[..px/rem]`-verdier (mest tekststørrelser, deretter faste bredder som `w-[280px]`) |
| **Radius** | Ingen regel | `rounded` 750, `rounded-lg` 630, `rounded-md` 360, `rounded-full` 224, `rounded-xl` 33. Tre radier om hverandre for samme type flate |
| **Skygge** | Ingen regel | Seks nivåer i bruk (sm → 2xl), mest `shadow-lg` |
| **Ikoner** | Lucide (web 198 importer, mobil 88) | ✅ Konsistent bibliotek på begge flater |
| **Mørk modus** | – | 0 `dark:`-klasser. Ikke et funn, men et faktum: ingen mørk modus finnes |
| **Inline style** | – | 107 `style={{` i web |

## 2. Navnekonsistens

| Problem | Hvor | Anbefaling |
|---|---|---|
| To `StatusBadge` med samme navn og ulik fargetabell | `packages/ui/src/status-badge.tsx` · `apps/web/src/components/timer/StatusBadge.tsx` | Gi timer-varianten eget navn (`TimerStatusBadge`) slik mobil allerede gjør (`TimerStatusMerkelapp`) |
| Samme begrep, ulike navn på tvers av flater | web `StatusBadge` ↔ mobil `StatusMerkelapp` · web `Modal` ↔ mobil `ModalFlate` | Ikke rename nå. Før en ordbok (web-navn ↔ mobil-navn) i ui-standarder, så ordrer kan si begge |
| Engelsk og norsk blandet i `packages/ui` | `Button`, `Card` … mot `SidebarIkon` | Behold engelske navn i `packages/ui` (etablert). Ikke en ryddesak |
| Token-navn som ikke sier rolle | `accent` og `warning` har samme verdi | Slå sammen til én rolle, eller gi dem ulike verdier og ulike betydninger (se § 5) |

## 3. Komponentfullstendighet

| Komponent | Tilstander | Varianter | Tilgjengelighet | Brukt i (web-filer) | Score |
|---|---|---|---|---|---|
| Tooltip | ✅ hover/fokus/touch/Escape | ✅ | ✅ `role=tooltip`, `aria-describedby` | 9 | 9/10 |
| StatusBadge | – | ✅ perspektiv | ⚠️ dato bare i `title` | 12 | 7/10 |
| Button | ✅ inkl. loading | ✅ 4 × 3 | ⚠️ `focus:` ikke `focus-visible:`, spinner uten `aria-busy` | 66 | 6/10 |
| Input / Textarea | ✅ error | – | ⚠️ ingen `aria-invalid`/`aria-describedby`; id fra label kan kollidere | 28 / 4 | 6/10 |
| Modal | ✅ | ⚠️ kun bredde via className | ✅ native `<dialog>` (fokusfelle, Escape) · ⚠️ lukk-knapp uten `aria-label`, tittel ikke koblet | 50 | 6/10 |
| Select | ⚠️ error kun ramme | – | ⚠️ som Input | 5 | 5/10 |
| Card · EmptyState · Badge | – | ⚠️ Badge har bare hardkodet palett | – | 10 · 22 · 7 | 5/10 |
| Spinner | – | ✅ 3 str. | ❌ ingen `role=status` | 100 | 5/10 |
| SidebarIkon | ⚠️ ingen fokusmarkering | – | ✅ `aria-current` | **0** | 4/10 |
| Table | ✅ sort/filter/valg | ✅ | ❌ ingen tastatur, ingen `aria-sort` | 5 | 4/10 |
| SearchInput | ⚠️ | – | ❌ ingen label; «Søk...» hardkodet norsk (i18n-brudd) | 14 | 4/10 |
| MultiComboks (web/components/ui) | ⚠️ | – | ❌ ingen combobox/listbox-roller, ingen tastatur | filter-standard | 4/10 |

**Dekning:**

| Mønster | I systemet | Utenfor systemet |
|---|---|---|
| Knapper | 294 `<Button` | **832 rå `<button`** (~74 %) |
| Dialoger | 106 `<Modal` | 32 `fixed inset-0` i 23 filer; 9 egne `*Dialog`/`*Modal`-komponenter |
| Chips | **finnes ikke** | 4 web-varianter (`KontekstChip`, `DokumentKontekstChipLinje`, `FlytChip`, `FilterChipBar`) + 3 mobil |
| Mobil | **0 importer fra `@sitedoc/ui`** | Egne `StatusMerkelapp`, `ModalFlate`, bunnark skrevet inline, `MiniToast`, ingen Button-primitiv |

## 4. Statusfarger: web og mobil er ikke enige

| Status | Web `StatusBadge` | Web `perspektivEtikett` | Mobil `StatusMerkelapp` |
|---|---|---|---|
| draft | grå | grå | grå |
| sent | blå | blå | blå |
| received | blå | nøytral blå · **ballholder gul** | **indigo** |
| in_progress | blå | ballholder gul · ellers blå | **indigo** |
| responded | **gul** | nøytral **blå** · godkjenner gul | **lilla** |
| approved | grønn | grønn | grønn |
| rejected / cancelled | rød | rød | rød |
| closed | grå | grå | grå |

To brudd:
1. **Mobil bruker indigo og lilla**, som ikke finnes på web, og bruker ikke `perspektivEtikett` (`packages/shared`). Dette er et flateparitet-brudd etter vedtaket 2026-09-01/04.
2. **Web er uenig med seg selv** om `responded` (gul i StatusBadge, blå i nøytralt perspektiv).

## 5. Gul/amber er overbelastet, og det er svaret på feltstatus-kallet

`fabel-feltstatus-farge.md` (09-07) står åpent. Målingen viser at gul/amber i dag betyr **minst sju ting**:

- «din tur», ballholder (`perspektivEtikett.ts:116-120`)
- retur/sendt tilbake (`:216`, timer `returned`)
- «trekk tilbake»-handlingen (`statusHandlinger.ts:40`)
- sync pending (mobil)
- varsel-bannere (~95 × `bg-amber-50`)
- favorittstjerne (`KontekstChip.tsx:365`)
- «start dag»-knapp (mobil)

**Konsekvens for kallet:** å legge «felt som krever en avgjørelse» på gult som *fyllfarge* gir en åttende betydning. Dette er forslaget jeg vil legge fram som eget designnotat (ikke vedtatt):

| Tilstand | Visuelt | Tekst |
|---|---|---|
| Påkrevd, tomt (blokkerer) | Rød ramme **først etter lagreforsøk** (som i dag i `Input` error) | «Mangler: …» |
| Konsekvensbærende, tomt | **Amber venstrekant (3 px) + amber prikk ved etiketten**, hvit bakgrunn | Hjelpetekst: hva slutter å virke |
| Tvetydig (systemet gjetter) | Samme amber-markør + «Foreslått: …» i feltet | «Bekreft eller velg» |
| Valgfritt, tomt | Ingen markering | – |

**Hvorfor kant og prikk i stedet for fyll:** amber-fyll betyr allerede *melding* (bannere). En kantmarkør er
skillbar fra et banner på samme skjerm, og den tåler at mange felt lyser uten å bli tapet. **Over ca. 5
markerte felt** vises en oppsummering øverst («4 innstillinger venter på en avgjørelse») med hopp-lenker.
**Mobil:** samme regel der mobil har skjemaer. Kontorinnstillinger bor i web.

⚠️ Dette forutsetter at `accent`/`warning` ryddes til **én** rolle: «noen må ta stilling». Favorittstjerne og «start dag»-knapp bør da flyttes av amber over tid (opportunistisk, ikke sveip).

## 6. Prioriterte handlinger (anbefalt rekkefølge)

1. **Statusfarge-paritet web ↔ mobil.** Én fargetabell i `packages/shared` som både `StatusBadge` og `StatusMerkelapp` leser; mobil tar `perspektivEtikett`. *Hvorfor først:* det er et konkret paritetsbrudd pilotens mobilbrukere ser hver dag, lite i omfang (2 filer + shared), og låser fargespråket før feltstatus bygges oppå.
2. **Feltstatus-standard** (§ 5) som avsnitt i `ui-standarder.md` etter Kenneths gate. Tas i bruk opportunistisk.
3. **Token-rydding, minimal:** slå sammen `accent`/`warning`, fjern ubrukt mobil-grønn (`sitedoc-header`) *eller* bekreft at den skal inn, og vedta mikroskalaen (`text-[10px]`/`[11px]` → to navngitte tokens). Ingen sveip, bare nye/rørte flater.
4. **Tilgjengelighets-fikser i `packages/ui`** som gir gevinst i 100+ filer på én gang: Spinner `role=status`, Button `focus-visible`, Input `aria-invalid`/`aria-describedby`, Modal-lukk `aria-label`, SearchInput label + i18n.
5. **`Chip` inn i `packages/ui`.** Fire parallelle web-varianter er neste sted der drift blir synlig.

**Bevisst utenfor:** ingen sveip over 832 rå knapper eller 32 egne dialoger, ingen mørk modus, ingen felles web/mobil-komponentpakke (RN og DOM deler ikke primitiver; det som bør deles er **tokens og tabeller** i `packages/shared`, ikke komponenter).

## Kilder

Grep-måling og komponentgjennomgang 2026-09-17. Filreferanser er fra `develop` på måletidspunktet.
Relatert: `docs/claude/retningslinjer/ui-standarder.md` · `docs/redesign/fabel-feltstatus-farge.md` · `packages/shared/src/utils/perspektivEtikett.ts`.
