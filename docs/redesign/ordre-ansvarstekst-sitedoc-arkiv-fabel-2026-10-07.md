# Ordre: ansvarstekst i SiteDoc-arkivet og hent-dialogen (web)

**Til:** redesign (`~/Documents/Programmering/SiteDoc-redesign`) · **Fra:** fabel · **Dato:** 2026-10-07
**Branch:** `feat/ansvarstekst-arkiv` fra `origin/develop`. Kun web + i18n. Ingen schema, ingen api.
**Gate:** fabel alene (SAMARBEIDSREGLER § 0 «én gate pr. leveranse»). Orkestrator merger på «klar for merge».
**Hjemmel:** Kenneth 2026-10-07 så «Faglig grunnlag: NS 3420-K:2024, post KD2» på test: *«det er i grenseland → advarsel om at
brukeren selv er ansvarlig for å kontrollere innhold i sjekklistene, og at disse stemmer med standarden»* — «ja» til to faste
linjer. MAL-METODE § 7a pkt 5: ansvaret legges på kunden **én gang sentralt**, aldri pr. sjekkliste eller pr. PDF.
Henvisningene i beskrivelsene («Faglig grunnlag: …») beholdes (§ 7b pkt 2). **Ingen nytt banner på sjekklister.**

---

## 0. Målt (fabel, develop `0025e760`)

| # | Fakta | Bevis |
|---|---|---|
| A1 | Malforvaltning → fane **SiteDoc-arkiv** rendres av `SitedocArkivFane.tsx`; toppen er `adminBibliotek.tittel`/`undertittel` (:38-39), så tre + detalj. Over fanen ligger `Nivaabanner` («Du er i SITEDOC-ARKIV — …scope») fra `components/nivaa/Nivaabanner.tsx:42-71`, nøkkel `nivaabanner.sitedoc.scope` | `SitedocArkivFane.tsx`, `page.tsx:85` |
| A2 | «Hent fra arkiv» = `components/bibliotek/HentFraArkivModal.tsx`: to faner (`firma`/`sitedoc`, :59); sitedoc-fanen rendres :388-410 via `ArkivListe` som har `fotnote: ReactNode` (:498) under lista; henting skjer **direkte på radknappen** «Hent kopi til firmaarkiv» (:471) — det finnes ingen egen bekreftelse. Fotnoten i dag: `maler.arkiv.fotSitedoc` («redigeres kun av SiteDoc-admin») / `fotSitedocRediger` | `HentFraArkivModal.tsx:388-410, :455-475, :482-500` |
| A3 | Utdatert tekst: `maler.arkiv.ingenSitedocForklart` = «SiteDoc-arkivet inneholder i dag kun NS 3420-K sjekklistemaler» — arkivet har K/F/U/J | `nb.json:138`, `en.json:138` |
| A4 | Mobil har ingen «Hent fra arkiv» (0 treff) — web-only ordre | grep `apps/mobile` |

## 1. Ordlyd (endelig — ikke omformuler)

| Nøkkel | nb | en |
|---|---|---|
| `maler.arkiv.ansvarKilde` | Malene er utarbeidet av SiteDoc med NS 3420 som faglig grunnlag. De er ikke godkjent av Standard Norge og erstatter ikke standarden. | The templates are prepared by SiteDoc with NS 3420 as the professional basis. They are not approved by Standards Norway and do not replace the standard. |
| `maler.arkiv.ansvarFirma` | Firmaet er selv ansvarlig for å kontrollere at sjekklisten dekker kravene i kontrakten og gjeldende standard. | The company is responsible for verifying that the checklist covers the requirements of the contract and the applicable standard. |
| `maler.arkiv.ingenSitedocForklart` (rettes) | SiteDoc-arkivet inneholder sjekklistemaler bygget med NS 3420 som faglig grunnlag. | The SiteDoc archive contains checklist templates built with NS 3420 as the professional basis. |

13 øvrige språk: `pnpm dlx tsx src/i18n/generate.ts --only maler.arkiv.ansvarKilde,maler.arkiv.ansvarFirma,maler.arkiv.ingenSitedocForklart` fra `packages/shared` — 🔴 slett den gamle `ingenSitedocForklart` i de 13 målspråkene FØRST (`--only` oppdaterer aldri).

## 2. Plassering

- **P1 — Malforvaltning, SiteDoc-arkiv-fanen** (`SitedocArkivFane.tsx`): én **fast** linje rett under tittel/undertittel (:38-39), full bredde over tre + detaljpanel: `ansvarKilde`. Stil: `text-xs text-gray-600`, ikke boks, ikke ikon, **ingen lukk-knapp, ingen localStorage**. Vises alltid, også når ingen mal er valgt. Rør ikke `Nivaabanner` (den sier *hvor* du er; denne sier *hva malene er*).
- **P2 — Hent-dialogen, sitedoc-fanen** (`HentFraArkivModal.tsx:388-410`): `ArkivListe` får ny valgfri prop `topplinje?: ReactNode`, rendret **over** lista (under søkefeltet). Sitedoc-fanen sender to linjer i én `<div className="space-y-0.5 text-xs text-gray-600">`: `ansvarKilde` og `ansvarFirma`. Firma-fanen sender ingen topplinje (firmaet har alt tatt ansvaret ved henting). Fotnoten (`fotSitedoc`/`fotSitedocRediger`) beholdes. **Ingen avkrysning, ingen ekstra klikk** — «Hent kopi til firmaarkiv» virker som før.
- **P3** — `ingenSitedocForklart` rettet (tom-tilstand i sitedoc-fanen, :269).

## 3. Tester som skal FEILE (DoD)

1. `SitedocArkivFane` rendrer uten `ansvarKilde`-teksten, eller teksten kan fjernes via klikk/state (grep-vakt: ingen `useState`/`localStorage` knyttet til linjen) ·
2. Hent-dialogen, sitedoc-fanen: `ansvarKilde` + `ansvarFirma` mangler over lista; firma-fanen viser dem (skal: ikke) ·
3. Hent-knappen krever et ekstra steg/avkrysning (skal: uendret) ·
4. `ingenSitedocForklart` nevner «kun NS 3420-K» i noe språk ·
5. i18n: nøklene finnes ikke i alle 15 filer.

## 4. DoD / leveranse

- [ ] P1–P3 + 3 nøkler ×15 (gammel `ingenSitedocForklart` slettet i 13 før generate)
- [ ] tester 1–5
- [ ] regel 10 fra rot: typecheck 11/11, kald web build, `pnpm exec turbo run test --force` 7/7 — meld tall
- [ ] leveranse (hash + hva som vises hvor, tekstbevis = de to linjene slik de rendres) i hovedtreets `relay/inbox-design.md`

Utenfor ordren: brukervilkårene (Kenneth), mobil (finnes ikke), banner pr. sjekkliste (skal ikke finnes).
