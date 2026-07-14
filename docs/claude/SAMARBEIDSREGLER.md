# Samarbeidsregler — roller, meldingsflyt, commit-orden

> Fasit for hvem gjør hva på tvers av Cowork-økter på SiteDoc. Formål:
> unngå kollisjon mellom kode-økter + holde orden på commits. Detaljerte
> kjøreregler i [parallell-arbeid-lock.md]. Les FØR du instruerer en annen økt.

## Roller

| Rolle | Ansvar | Kjører kommandoer | Kode/branch |
|-------|--------|-------------------|-------------|
| **Kenneth** | Eneste som kjører kommandoer (terminal/SSH/sudo). Tar produktbeslutninger (K-saker). Relayer alle meldinger mellom økter. Utfører + beslutter — koder ikke. | **Ja — alt** | — |
| **cowork** | Eier **commit-orden** + tverr-koordinering: merge-rekkefølge, regel 9/10-håndheving, prod-løp, konfliktvakt (frossen sone), BACKLOG, deploy-disiplin. Skriver timer/PSI-kode + gate-verifiserer. Gir Kenneth kommandoer. **Alt som lander på develop/main passerer cowork.** | Nei (gir Kenneth) | pipeline + timer |
| **fabel** | Eier redesignet. Skriver ordre til redesign-Opus (hva kodes, designkrav, akseptkriterier), designgodkjenner mot handoff-spec + skjermbilder (en flagg-på-endring er ikke lukket uten denne), bestiller verifisering fra Opus web. **Rører aldri git-koreografi.** | Nei | redesign-retning |
| **redesign-Opus** | Koder KUN på `redesign/navigasjon`, KUN fabels ordre, `(redesign)`-scope, fullt `next build` før merge, `--no-ff`. Design → fabel; merge-timing → cowork. | Ja (egen branch) | `redesign/navigasjon` |
| **develop-Opus** | Koder timer/PSI m.m. på develop. **Rører ikke frossen sone** (nav/layout-filer). Koordinering → cowork. | Ja (develop-worktree) | `develop` |
| **Opus web** | Verifiserer KUN i nettleser på test.sitedoc.no (inkognito ved behov). Får presise sjekklister fra fabel (design) eller cowork (funksjon). **Rapporterer funn — konkluderer ikke om årsak.** Skriver ikke kode, kjører ikke kommandoer. | Nei | — |
| **simulator-Opus** | Verifiserer på iOS-simulator (Metro @ develop) OG web. Kjører idb/simctl lokalt; leser test-DB via tunnel. Rapporterer observasjoner med kandidatmengde — konkluderer ikke om kode-atferd uten kodeverifisering. Skriver ikke produktkode; docs-endringer rutes via cowork. | Ja (simulator/lokalt) | — |

## Meldingsflyt (ufravikelig)

**Alle ordrer går via Kenneth — han limer, han ser alt. Ingen agent instruerer en annen direkte.**
- fabel → redesign-Opus / Opus web: formuleres ferdig av fabel, Kenneth relayer.
- cowork → develop-Opus / Opus web (funksjon): formuleres ferdig av cowork, Kenneth relayer.
- Kommandoer (git/build/sudo/deploy): formuleres til Kenneth, som kjører.

## Commit-orden — én eier: cowork

All merge-koreografi går gjennom cowork:
- **Rekkefølge:** timer og redesign treffer ikke develop samtidig uten build-gate mellom — én verifisert ting om gangen.
- **Regel 9:** `redesign/navigasjon → develop` alltid `--no-ff` (synlige, revertbare grenser).
- **Regel 10:** ingen merge til develop uten grønt `pnpm --filter @sitedoc/web build` (ikke bare typecheck).
- **Worktree per spor:** aldri to økter i samme arbeidstre.
- **Prod:** aldri uten Kenneths eksplisitte ordre; rett branch rsynca; migreringer gated.

> **Design-godkjenning (akseptkriterium):** en redesign-UI-endring (flagg-på) er **ikke lukket** før **fabel har designgodkjent mot skjermbilder** fra Opus web — aldri på typecheck/`next build` alene. Build-gaten (regel 10) sikrer at det *bygger*; design-godkjenningen sikrer at det *ser riktig ut*. Begge kreves.

Så lenge disse holdes vet Kenneth at develop er ren. «Går dette bra?» har én kilde: cowork.

## Cowork leveranse-ansvar (ordre 2026-07-14)

Fire regler skjerper cowork sitt ansvar. Ved motstrid rapporteres de kolliderende reglene til Kenneth **før** endring — løses aldri stille.

1. **Leveranse til prod + EAS.** cowork eier koordineringen av at alle gatede commits/merges/alt faktisk arbeid **når** produksjon og EAS-bygg. Ingenting blir liggende gatet-men-ikke-deployet uten en eksplisitt grunn ført i STATUS-AKTUELT. **EAS-kvote spores i STATUS-AKTUELT § EAS-byggteller** (bygg # + dato, nullstilles den 1. hver måned); ved **12 bygg/mnd** stopper cowork opp + sjekker klar-tilstand + flagger i status før nytt bygg fyres. *(Grense: selve prod-deployen og EAS-fyringen utløses fortsatt kun på Kenneths eksplisitte go — kvote-gaten på EAS består. cowork sikrer klar-tilstand + flagger stopp; Kenneth trykker avtrekkeren.)*
2. **Kommandoformat.** Alle terminalkommandoer som krever Kenneths TTY leveres i strukturert, nummerert rekkefølge — kopierbar blokk, forventet resultat per steg. Kenneth kjører + melder tilbake; cowork verifiserer mot forventningen før neste steg. *(Utvider meldingsflyt-regelen «kommandoer formuleres til Kenneth».)*
3. **Bygg utenfor redesign.** cowork har hovedansvar for alle bygg/leveranser utenfor redesignets domene, samt all merge-timing og deploy. redesign-Opus eier sitt (`redesign/navigasjon`, fabels ordre). *(Skjerper eksisterende cowork-rad «eier resten + merge-timing + deploy».)*
4. **Koden sjekkes alltid.** Gate skjer mot **faktisk kode / git-objekt** — aldri på beskrivelse alene. Verifiser mot koden før beslutning/gate. *(Presisering av en generell gate-regel cowork allerede følger — kode-sjekken er det som avdekker avvik; ikke en ny skjerping.)*

## Statustavle (vedlikeholdes av cowork)

Øverst i STATUS-AKTUELT: kort tavle over aktive økter — hvilken branch hver eier + hva som er in-flight mot develop. Billigste forsikring mot at to økter skriver i samme fil.
