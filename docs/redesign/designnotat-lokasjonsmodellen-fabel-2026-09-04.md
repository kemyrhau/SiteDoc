# Designnotat — lokasjonsmodellen: «hele byggeplassen» som gyldig svar — fabel 2026-09-04

**Svar på:** `docs/redesign/til-fabel/fabel-lokasjonsmodellen.md` (cowork 29.08). Låser opp `relay/inbox-lokasjon-autoapne.md` (Kenneths auto-åpne-bestilling).

## Måling først — ett premiss i notatet er stale

Cowork-notatet sier `LokasjonVelger` «rendres ubetinget» på sjekklistens detaljside. **Målt 2026-09-04:** sjekkliste-detaljsiden gater den på malens `showLocation !== false` (`sjekklister/[sjekklisteId]/page.tsx:873–876`, «FASTE FELT Del B#2»), og malbyggeren har vis/skjul-toggle for lokasjonsfeltet (`MalBygger.tsx:865–875`). **Retning 3 («malen bestemmer») finnes altså allerede for sjekklister.**
Derimot: **oppgavesiden rendrer LokasjonVelger ubetinget** (`oppgaver/[oppgaveId]/page.tsx:806` — ingen showLocation-sjekk). Det er et paritetshull, ikke en modellbeslutning. *Cowork verifiserer begge målinger.*

## 🟢 VEDTATT AV KENNETH 2026-09-04 — med forankringen som gjør regelen forståelig

> **Kenneth 2026-09-04, om når «hele byggeplassen» er riktig svar:**
> *«Denne observasjonen gjelder ikke ett punkt — den gjelder hele anlegget. Dette kan være rett
> for f.eks. → alle gatelysene mangler merking.»*

🔴 **Dette eksempelet er styrende, og skal med i ordren.** «Alle gatelysene mangler merking» er
én observasjon om hundre lyspunkt. En pin ville vært feil — ikke fordi den mangler, men fordi
den ville påstått at funnet gjelder ett sted. Samme klasse: feil armaturtype gjennom hele
anlegget, en strekning som ikke er kostdekket, manglende skilting langs en vei.

**Konsekvensen for PDF-en er hele poenget:** i dag skriver den «Ikke utfylt» der Kenneth mente
«gjelder alt». En byggherre leser det som en glipp. Etter endringen står det at rapporten gjelder
hele byggeplassen — et svar, ikke et hull.

Samme prinsipp som EXIF-vedtaket samme døgn: **et dokument skal ikke påstå noe usant om
virkeligheten, og et tomt felt der noe var ment er en usann påstand.**

Auto-åpning: ✅ **kun `status=draft`** (Kenneth 04.09) — et godkjent eller sendt dokument skal
aldri nages om en pin. Det er ferdig.

## Vedtaksforslag: retning 3 + retning 1 kombinert

**Malen bestemmer OM dokumentet har lokasjon (finnes). Dokumentet bærer eksplisitt HVILKET omfang (nytt).**

Nytt nullable felt på `Checklist` og `Task` (additiv migrering, ingen backfill):

```
lokasjonOmfang: "punkt" | "byggeplass" | null
```

| Tilstand | Betydning | Visning/PDF |
|---|---|---|
| `null` | ikke valgt ennå | «Ikke satt» — auto-åpning kan trigge |
| `"byggeplass"` | bevisst hele byggeplassen | PDF/web sier **«Gjelder hele byggeplassen»** — seksjonen utelates ALDRI stille (tar retning 2s utskriftspoeng med) |
| `"punkt"` + koordinater | pin satt | som i dag |

Null betyr ikke lenger noe alene — tvetydigheten notatet påpeker er borte, uten at gamle data må tolkes om.

## UI (mockup-detalj tas ved ordre; prinsippene er låst her)

- I LokasjonVelger/tegningsvisningen: handlingen **«Gjelder hele byggeplassen»** ved siden av pin-setting. Én affordance, aldri en obligatorisk bekreftelse (effektivitets-gaten: dobbel sikring forbudt).
- Auto-åpne-funksjonen blir entydig: åpne tegning kun når `showLocation` er på OG `lokasjonOmfang == null`. Auto-åpnet tegning har synlig utvei uten å sette noe (avbrytbarhets-regelen) — å lukke uten valg lagrer INGENTING (lukking ≠ «byggeplass»).
- Oppgavesiden får samme `showLocation`-gate som sjekklister (paritetsfiks, egen linje i ordren).

## Avgrensninger (åpne, tas i ordren)

- **Gamle dokumenter:** auto-åpning gjelder kun utkast (`status=draft`) eller dokumenter opprettet etter innføringen — historiske byggeplass-rapporter med null skal ikke nages. Innstilling: draft-gate; Kenneth avgjør.
- **Repeater-lokasjon røres ikke** (Kenneth-premiss, står).
- **Arv fra kontrollpunkt:** tegning arves, aldri pin (`b987d793`) — står. Arvet tegning + `lokasjonOmfang=null` er nettopp tilstanden auto-åpningen er til for.

## Begrepsrydding (masterplan-restansen «tre ting heter lokasjon»)

Fire ting, fire navn — brukes i ordrer og dok heretter:

| Kode | Begrep |
|---|---|
| `Checklist/Task.drawingId/positionX/Y` (+ nytt `lokasjonOmfang`) | **dokumentlokasjon** — det faste feltet, styrt av `showLocation` |
| `location`-rapportobjekt (fritekst) | **lokasjonstekst** |
| `drawing_position`-rapportobjekt (per felt) | **feltpin** |
| `ReportTemplate.showLocation` | **lokasjonsbryter** (mal-nivå: vis/skjul dokumentlokasjon) |

Ingen nye felt får hete «lokasjon» uten ett av disse begrepene.

## Kostnad
Én nullable kolonne × 2 tabeller, én PDF-/web-visningsregel, én gate-betingelse i auto-åpne, én paritetsfiks på oppgavesiden. Ingen eksisterende data endres.
