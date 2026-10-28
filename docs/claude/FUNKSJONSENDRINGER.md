---
name: FUNKSJONSENDRINGER
description: Register over merger som endret INTENSJONEN — det brukeren skal kunne, ikke bare det koden gjorde. Kenneths kontrollflate. Føres av cowork ved merge, aldri i ettertid.
sist_verifisert_mot_kode: 2026-09-28
sources: cowork
---

# Funksjonsendringer — Kenneths kontrollflate

🔴 **HVA DENNE FILA ER FOR** (Kenneth 2026-09-27):

> «jeg trenger å fange opp det som endrer funksjoner → jeg trenger ikke bruke tid på hull og
> forbedringer uten funksjonsendring»

**Definisjonen, løypa og smutthullet står i
[SAMARBEIDSREGLER § LUKKER HULL vs ENDRER FUNKSJON](SAMARBEIDSREGLER.md).** Kort:

- 🔴 **FUNKSJONSENDRING** = intensjonen byttes. **Krever hjemmel fra Kenneth før ordren sendes.**
- 🟢 **REPARASJON** = koden kommer tilbake til noe som var ment. **Ingen godkjenning** — men føres
  her hvis virkningen er synlig, så Kenneth ikke blir overrasket.
- 🔴 **Intensjon teller bare hvis den er SKREVET NED før endringen.** Finnes ingen: funksjonsendring
  som standard. **«Produktvalget er tatt» i en designordre er ikke en hjemmel.**

---

## 🔴 FUNKSJONSENDRINGER — krevde hjemmel

### 2026-10-28

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `137cc1a6` (merge `63d1a573`) | Annotering mobil: redigerbart lag | **Før:** et bilde annotert på mobil ble lagret flatt, og markeringene kunne ikke flyttes eller slettes senere. **Etter:** mobil lagrer original + lag som web, og gjenåpning (mobil og web) viser markeringene redigerbare. Også offline: feltet holdes tilbake til originalen er oppe. Kommer originalen aldri opp (fil borte / hard feil), lagres vedlegget flatt i stedet, så bildet og kommentaren alltid når serveren. **Flagget:** (1) web åpner vedlegg annotert på mobil 21.–28.10 (original uten lag) på det innbrente bildet, og slike forblir flate; (2) kamera-annotering lager fortsatt ikke lag, og erstatter den et vedlegg, fjernes gammelt lag. Kjent grense: lukket skjerm når originalen blir ferdig → laget når serveren først ved neste lagring. ⚠️ Ikke bekreftet på telefon. | Kenneth 28.10 (redigerbar annotering på mobil) |
| `2ad0aa06` (merge `c5c934bd`) | Dokumentsøk: mappetilgang | **Før:** firma-admin uten medlemsrad, og medlem uten tilgang til noen mappe, fikk 500 i søket (også i prod). **Etter:** (1) firma-admin i prosjektets eget firma ser dokumenter i alle mapper; firma-admin fra annet firma ser bare dokumenter uten mappe; (2) medlem uten mappetilgang får treff i dokumenter uten mappe; (3) flerspråklig søk (`blokkSok`) og mengde tar nå med dokumenter uten mappe, som de andre søkene. ⚪ Kjent: på deaktivert prosjekt ser firma-admin med medlemsrad alle mapper i søket. | Kenneth 28.10 «enig» |
| `8b451eae` | Annotering (mobil + web): gjenåpning av lagret bilde | **Før:** et annotert bilde som var lastet opp, kunne åpnes som et helt svart lerret uten mulighet til å redigere (feil siden september: rå `/uploads/`-URL gir 401, og svaret ble tolket som bilde). På web var feilen stille. **Etter:** bildet lastes etter ny signering (inntil 3 forsøk). Ellers vises «Bildet kunne ikke åpnes. Lukk og prøv igjen om litt.» Mens bildet lastes står «Laster bildet …», og Ferdig er av til bildet er lastet (mobil og web). ⚠️ Ikke bekreftet på telefon. | Reparasjon (Kenneth på telefon 28.10 20:04) |
| `a5b4490f` | Annotering (mobil, og fingerberøring på web): trykk med berøring | **Før:** et trykk med en finger som vinglet 10 px eller mer, ble tolket som dra. Trykk på kanten av en sirkel tegnet en ny sirkel, så former kunne i praksis ikke velges eller flyttes på telefon. **Etter:** berøring har en grense på 22 px (mus og penn har fortsatt 10 px). En form under 22 px kan ikke tegnes med finger. Når noe er valgt, fjerner en kort frihåndsstrek (≤ 22 px) bare valget, og streken forsvinner. ⚠️ Ikke bekreftet på telefon. | Reparasjon av `6afa50d8` (Kenneth på telefon 28.10) |
| `a17f6aec` | 🔴 **Dokumentsøk (web): SØK-1** | **Før:** høyre rute scrollet ikke til treffet, utsnittet var de første 240 tegnene, de leksikalske kandidatene ble kuttet før de ble rangert, og semantiske treff viste ingen markering. Tre leseveier ga tekst eller filnavn fra lukkede mapper, og én (`hentDokumentChunks`) manglet prosjektsjekk. **Etter:** scroll til valgt treff, også i DOCX, med valgt treff i amber. Utsnittet er et vindu rundt treffet med «…» og «side N»/«avsnitt N». Rangering skjer før `LIMIT`, og filteret gjelder alle veier. Semantiske treff markerer beste setning (stiplet lilla) eller viser ingen markering. Alle ftdSok- og aiSok-leseveier krever prosjekt- og mappetilgang. | Reparasjon etter spec (`dokumentsok-visning-spec.md`); sikkerhet `sikkerhet.md` § 8d |
| `6afa50d8` | 🔴 **Annotering (mobil + web via delt motor): velg, flytt og endre størrelse på alle objekter** | **Før:** bare tekst kunne velges med et trykk. Sirkel, firkant, pil og frihånd kunne bare flyttes i web-«Flytt», og angre fjernet alltid siste objekt. **Etter:** et trykk nær streken velger formen i alle verktøy. Dra på en valgt form flytter den, og dra i håndtakene endrer størrelsen med samme strektykkelse. Dra fra en form som ikke er valgt, tegner en ny. (a) I Tekst velger et trykk på streken formen, mens et trykk inne i formen lager ny tekst. (b) Sirkel kan bli oval. (c) Trykk på tekst redigerer også i Frihånd. (d) Angre tar siste handling, også flytt og størrelse. Pil endres ved å dra endepunktene. Web-«Flytt» er beholdt, men håndtakene er runde og blå, og en form kan ikke lenger speilvendes ved å dra et håndtak forbi motsatt kant (`lockScalingFlip`). Gamle annoteringer åpnes og eksporteres byte-identisk. ⚠️ Ikke bekreftet på telefon. | 🟢 Kenneth GO 2026-10-28 (a–d); speilvending: Kontrollør-vilkår, meldt Kenneth 28.10 |

### 2026-10-22

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `640a71b4` | 🔴 **Annotering (mobil + web via delt motor): tekstrute og kamera** | **Før:** teksten var én linje uten bredde som gikk ut over bildekanten. Markøren hoppet til slutten, og teksten kunne ikke dras eller endre bredde. I kameraet måtte man gå ut for å annotere. **Etter:** tekstrute med bryting, bredde fra trykkpunktet til bildekanten og håndtak for bredden. Markøren flyttes fritt, og dra flytter teksten. Kameraet har en miniatyrstripe med øktens bilder, og trykk annoterer uten å forlate kameraet. Re-annotering tegner oppå (tidligere annotering er innbrent). Web får samme tekstrute. ⚠️ Ikke bekreftet på telefon. | 🟢 Kenneth 2026-10-21/22 |
| `020d687c` | Annotering (mobil + web via delt motor): trykk på tekst | **Før:** en avsluttet tekst kunne bare åpnes igjen med «Tekst» valgt, og tekstruten frøs når den brøt til 3+ linjer (regresjon fra `640a71b4`, aldri i prod). **Etter:** et trykk (< 10 px) på en tekst åpner den for redigering i alle verktøy; et dra som starter på en tekst tegner fortsatt formen. Lerretet ligger fast mens man skriver. | Kenneth på telefon 22.10 09:56 (bilde 12); trykk/dra-regelen orkestrator-presisering |

### 2026-10-21

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `3e81941c` | 🔴 **Oppgave og sjekkliste, web + mobil + api: godkjent rapport = bare visning av bilder** | **Før:** feltvedlegg og galleribilder på en godkjent, lukket eller kansellert rapport kunne annoteres, erstattes, legges til og slettes. **Etter:** serveren avviser det, og klienten skjuler handlingene. Endring krever «Gjenåpne». Sendt og mottatt er uendret. En endring som var lagt i kø før godkjenning, avvises med én melding og prøves ikke på nytt. Omsortering av galleriet er ikke låst (BACKLOG). | 🟢 Kenneth 2026-10-21 («enig, kun visning på godkjent») |
| `3e81941c` ← `21459f40`, `0b9eb770` | 🟢 **Mobil: annotering (reparasjon + Kenneth-ønsker)** | **Før:** tastaturet dekket bildet, og «Ferdig» kunne fryse appen og la bildet peke på en død lokal fil. **Etter:** bildet står fast under overskriften. Eksporten er ≤ 400 KB og ikke-blokkerende, og originalen beholdes til den nye fila er lastet opp. Teksten er 18 (før 14) med stor forbokstav etter punktum. Trykk på tekst redigerer. Web er uendret. ⚠️ Ikke bekreftet på telefon. | Reparasjon + Kenneth 2026-10-21 (tekststørrelse, autostor) |

### 2026-10-20

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `35f62a9f` ← `d0524e3d` | 🔴 **Arbeidstegning (KUN test bak `TEGNING_MOTOR`): snap og 90° live i Linjal/Polylinje/Areal med pekeren** | **Før:** snap-ring og 90°-hjelpelinje vistes bare i «Flytt punkt». I måleverktøyene slo de inn først ved selve trykket. **Etter:** ringen og hjelpelinja vises live mens tegningen dras, også for første punkt, og «Sett punkt» legger punktet på målet. ⚠️ Ikke bekreftet på telefon ennå. | 🟢 Kenneth 2026-10-20 («bestill snap og 90° til dokgen nå») |
| `22266d57` ← `b0ace0d1` | 🟢 **Mobil — oppgave/befaring (reparasjon, PROD via OTA)** | **Før:** «Fra tegning»-kortet kunne ikke trykkes, et utkast ble låst etter ut og inn, og tastaturet dekket bildet ved annotering. **Etter:** kortet åpner tegningen og setter eller flytter punktet (bare utkast). Utkast kan redigeres til det er sendt. Bildet skyves opp over tastaturet. Arbeidstegning: «Isolasjon 71 mm» i stedet for «Tykkelse» på isolasjon (`a9892446`). | Reparasjon (Kenneth-funn i prod 2026-10-20) |

### 2026-10-19

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `ee884ff8` ← `b332bf9c`, `d92f4d30` ← `ac87caf9`/`ab4b6c78`/`72b05f02` | 🔴 **Arbeidstegning (dxf-viewer, KUN test bak `TEGNING_MOTOR`): peker og flytt punkt** | **Før:** et målepunkt ble flyttet med langt trykk + dra og en lupe ved fingeren. **Etter:** pekeren er eneste vei til å flytte punkt (langt trykk + dra og den gamle dra-lupen er fjernet). Pekeren har lupe ×3 over trådkorset mens kameraet beveger seg, prikk i treffpunktet og presisjonsdra med én finger i 1/3 fart (med to fingre går det i normal fart). iOS-tekstvalg og -lupe er slått av på pekerflaten. ⚠️ Lupens plassering og iOS-markeringen er ikke bekreftet på telefon ennå. Reload: test-deploy + bryter + OTA test | 🟢 Kenneth 2026-10-19 («pekeren zoomer … dras med større presisjon … prikk på treffpunktet»; «langt trykk + dra og lupen skal fjernes») |
| samme | 🔴 **Arbeidstegning: målfelt i trykk-arket** | **Før:** dør viste 1,59 m (slagbue). Isolasjon viste areal eller feil tykkelse. Mål i én desimal. **Etter:** dørmål tas fra merkingen i dørblokkens «Dørstempel» (1 090×2 090 → 1,09 × 2,09). Lange smale objekter (L/B > 8, tykkelse ≥ 10 mm) viser tykkelse + lengde, *tolket*. Flater (HATCH/SOLID uten isolasjon) og rom beholder areal. Mål vises med to desimaler. | 🟢 Kenneth 2026-10-19 (telefontest + «ja» til innsnevring for rom/flater) |

### 2026-10-14

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `feca5bc4` ← `e22a995e` | 🔴 **Mobil — offline tegninger (RETUR 2)** | **Før:** kald start i flymodus ga «Ingen byggeplasser»/«Ingen tegninger» selv for et forberedt prosjekt. **Etter:** tegningsliste og byggeplass-velger leses fra lokalt speil offline, med «Sist oppdatert …»; ikke-lagret prosjekt viser «Ikke lagret for offline» (aldri falsk tomhet); nøytralt «Frakoblet»-banner; speilet tømmes ved utlogging. ✅ Kenneth verifiserte på telefon 2026-10-14 (OTA test). Reload: OTA | 🟢 Kenneth 2026-10-13 (offline-testen: «da åpnes ikke byggeplasser») |
| `9182ab38` ← `ce91ba7a` (+ `07b62198`, `6349fcf7`) | 🔴 **Web — arbeidstegning leveranse 1 (dxf-viewer, KUN test bak `TEGNING_MOTOR`)** | **Før:** DWG vises kun som SVG. **Etter (bare med bryteren på, bare test):** ny tegning tegnes i WebGL fra forenklet DXF, skarpt ved innzoom; vises som tegnet (vedtak B). I denne grenen er måling, markører, filtre, rotasjon og zoom-knapper **skjult** (kommer i senere leveranser) — derfor kan bryteren ikke slås på i prod før markørene er bygget. ⚠️ RETUR 4 åpen: ny lasting ved fokusbytte, blank flate, 9 s lastetid. Reload: test-deploy + bryter | 🟢 Kenneth 2026-10-12/13 (spec rev. 9, rotasjon B) |
| *(bestilt, ikke merget)* | 🔴 **Mobil — måling: langt trykk fjerner ikke lenger hjørne** | **Før:** langt trykk på hjørne → «Fjern hjørne?» → sletter punktet (i praksis det sist flyttede) og avslutter målingen. **Etter:** langt trykk gjør ingenting; «Slett» (hele målingen) beholdes. | 🟢 Kenneth 2026-10-14 («trenger vi denne? nei») |

### 2026-10-09

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `cea95273` ← `dc8fe05f` | 🔴 **Web — originalfil pr. revisjon** | **Før:** eldre revisjoner av DWG-tegninger hadde bare den konverterte visningen. **Etter:** ny revisjon tar vare på originalfila (gjelder fra nå, også tegninger lastet opp tidligere); revisjoner arkivert før endringen viser fortsatt «Originalfil ikke lagret». Zip lister filer som mangler på disk i `MANGLER.txt`. Migrering `20261010120000_revisjon_originalfil` (additiv). Reload: deploy + migrering | 🟢 Kenneth 2026-10-10 («ja, ta med original på nye revisjoner») |
| `749b362e` ← `482e1f84` (+ `8af3cc6e`) | 🔴 **Web + mobil — ezdxf-motor for DWG (bak `DWG_MOTOR`, standard `egen`)** | **Før:** egen DWG-motor manglet skravering/møbler/dørsvinger/stiplet; strek usynlig eller svart. **Etter (når `DWG_MOTOR=ezdxf`):** ezdxf tegner, web full mønsterskravering med dempet strek (`lw × zoom^0,5`), mobil lett farge-gruppert variant (`mobilFileUrl`) vist inline med dempet strek etter pinch, mobil åpner på startutsnittet. Migrering `20261011120000_tegning_mobil_fil_url`. Kun på test inntil iPhone-sjekk. ⚠️ Test 2026-10-12 (Kenneth): **linjer alt for tykke** på web og mobil (Rev. F, konvertert før strekformatet; RETUR 2 bestilt, se `tegning-dwg-spec.md` § EZDXF-MOTOR). Reload: deploy + rebuild + env + OTA | 🟢 Kenneth 2026-10-11 («ja» til ezdxf, kolonnevalg 1, dempet strek) |
| `793018d0` ← `50546e73` | 🔴 **Web — konverteringsmarkør** | **Før:** ingen måte å se om en tegning var konvertert med koden som nettopp ble deployet (avslørt kun med SQL). **Etter:** «Konvertert ‹tid› · versjon ‹sha›» i tegningsdetaljer og verktøylinje; eldre tegninger viser «Konvertert før versjonsmerking». Lagres i `konvertering_rapport.markor`, ingen migrering. ⚠️ DWG layout-barn får ikke markør ennå. Reload: deploy | 🟢 Kenneth 2026-10-11 («ja») |
| `c323e309` ← `48abf5a6` | 🔴 **Web + mobil — DWG-rotasjon** | **Før:** rotasjon valgt med ⟳ ble nullstilt ved ny revisjon eller «prøv igjen». **Etter:** brukerens rotasjon følger med; markører holder posisjon. Automatisk veggretting beholdes. Reload: deploy | 🟢 Kenneth 2026-10-10 («rotasjonen skal følge med til neste revisjon») |
| `b57d462b` ← `be46642b` | 🔴 **Web — last ned tegninger** | **Før:** tegninger kunne bare åpnes i visningen, originalfila (DWG/PDF) kunne ikke hentes. **Etter:** «Last ned» i tegningsvisning (originalfil) og pr. revisjon (PDF/bilde; DWG-revisjoner viser «Originalfil ikke lagret»); avkryssede tegninger og hel serie som zip (maks 200 tegninger / 2 GB). Sikkerhet: `diskSti` herdet sentralt mot path traversal (gjelder også eksport/arkiv). Reload: deploy | 🟢 Kenneth 2026-10-10 («med zip … laste ned en serie») |
| `76520b47` ← `271b52d8` | 🔴 **Web + mobil — DWG-konvertering, retur 4** | **Før:** blokk-attributter (ATTRIB, f.eks. høydetekster i fallplan) ble ikke tegnet. **Etter:** synlige ATTRIB tegnes (fallplan 0 → 237 tekster), vannrett som MTEXT; hver konvertering lagrer `drawings.konvertering_rapport` (tegnet / hoppet over pr. type), test feiler ved ukjent synlig type. Migrering `20261009130000_dwg_konvertering_rapport` (additiv). Reload: deploy + migrering + ny konvertering | 🟢 Kenneth 2026-10-09 («skal ikke alle streker gjenskapes?») |
| `033d720d` ← `830f7221` | 🔴 **Web + mobil + server — timer, firma-isolasjon** | **Før:** ny dagsseddel blandet tre firmakilder (valgt firma, alle medlemsprosjekter, medlemsfirma) — prosjekter fra andre firma ble tilbudt og avvist; timer havnet på medlemsfirmaet. **Etter:** timer følger innlogget firma («Mitt firma» på mobil); prosjektlista kun firmaets prosjekter; egne timer krever å være ansatt i firmaet (synlig sperre m/ forklaring, ingen admin-unntak); «Mine dagsedler» (periode, dato, prosjekt, status, fritekst, også sedler uten rader); returnert og ikke-attestert dagsseddel kan slettes. Reload: OTA + deploy | 🟢 Kenneth 2026-10-09 (to vedtak + tillegg) |
| `91cbd3ea` ← `51295a13` (DWG retur 2+3) | 🔴 **Server + web + mobil — DWG** | **Etter:** bygningsplaner uten koordinatsystem rettes opp automatisk (veggvinkel), tekst holdes vannrett; tegninger med koordinatsystem står nord-opp (ingen rotasjon); «Rotert N° automatisk» + «Roter»; fallpiler (LEADER) tegnes; startvisning zoomer til bygget; markører følger rotasjonsendring (tilnærmet for ikke-kvadratiske tegninger). Migrering `20261009120000_dwg_rotasjon_startutsnitt` | 🟢 Kenneth 2026-10-09 (A rett opp, B godta) |
| ← `0747c6bf` | **Web + mobil — måling** | **Før:** snap kunne feste seg til punkter fra en tidligere åpnet tegning og til hjelpelinjer fra punkter utenfor skjermen. **Etter:** snap kun til synlige mål; målinger nullstilles ved tegningsbytte | 🟢 Reparasjon (Kenneth 2026-10-09) |
| ← `4452a40b` | **Web + mobil — måling, eldre tegninger** | **Før:** PDF-er konvertert før 25.09 kunne aldri måles; håndskrevet målestokk telte ikke; forklaringen sa «bekreft målestokk». **Etter:** «Hent målegrunnlag» (admin) regner mm/px fra original-PDF uten ny rendering; målestokk skrevet inn = «manuell»; forklaringen sier «mangler målegrunnlag» når det er årsaken | 🟢 Reparasjon (Kenneth 2026-10-09) |

### 2026-10-08

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `13b0a79e` ← `510aa11c` (DWG-2) | 🔴 **Server + web + mobil — DWG** | **Etter:** DWG konverteres direkte (ikke via r2000 — Ålesund-tegningene var tomme av den grunn), ekstreme koordinater (1e20) gir ikke lenger tom tegning, .dxf konverteres; måling åpnes direkte fra DWG-enhetene («fra DWG-enheter»); modelspace er tegningen, layouts kun med eget utsnitt og uten duplikater ved revisjon (uten markører slettes, med markører beholdes); revisjonsliste på tegningssiden viser tidligere revisjoner skrivebeskyttet. Migrering `20261008130000_dwg_layout_kobling` | 🟢 Kenneth 2026-10-08 Q1–Q4 |
| `45b4d80d` ← `732ce826` (DWG-1) | **Server + web — DWG** | **Før:** ingen DWG-konverterer i Docker-bildene; hver DWG endte som «konvertering feilet». **Etter:** libredwg 0.14 i begge bilder (ODA og xvfb ut); opplastingsdialogen avviser .dwg/.dxf med forklaring hvis serveren mangler konverterer. Konvertering, måling og layouts kommer i DWG-2 | 🟢 Kenneth 2026-10-08 «libredwg» |
| ← `19dbc187` (T2) | **Web — tegninger** | **Etter:** merk tegninger → «Ny serie fra valgte» / «Flytt til serie» / «Ta ut av serie»; lista grupperes fag → serie → nummer med kollaps; seriens fag/rådgiver/byggeplass er forslag, «Bruk på alle i serien» med telling. Revisjon/målestokk/status forblir pr. tegning. Migrering `20261008120000_tegningsserie` | 🟢 Kenneth 2026-10-06/08 |
| ← `948c564a` (V20-M) | 🔴 **Mobil — timer** | **Etter:** samme pauseregel som server/web: pausevindu fra ankomst (første fra-tid) når firmaet står på «Ankomst», «Arbeidstid i dag» utledet av radene, avkrysningen vises låst på sendte dager; mobilen skriver ikke hodets pause selv. Reload: OTA | 🟢 Kenneth 2026-10-06 V20 = B |
| ← `e633d27c` | **Mobil + web — måling i tegning** | **Etter:** «90°» låser linja vannrett/loddrett/vinkelrett på forrige; «Referanse» velger en eksisterende måling langs en (skrå) vegg → parallell/vinkelrett på den; stiplet hjelpelinje + «90°»-etikett; «Snap» fester punkter til eksisterende målepunkter (på som standard). Web-polylinje avsluttes kun med «Fullfør»/Enter (dobbeltklikk fjernet), «Fortsett» på ferdig polylinje (også mobil) | 🟢 Kenneth 2026-10-08 («90 grader … samt snap»; polylinje på web) |
| ← `e9662121` … `66a25e24` (retur 3–6) | 🔴 **Mobil (+ web der nevnt) — måling i tegning** | **Etter:** egne verktøy Flytt · Linjal · Polylinje · Areal · ＋ Opprett; lupe med trådkors (tegnet av appen), punkt settes ved slipp; tegningen står stille under drag; alle punkter flyttbare; figur avsluttes kun med «Fullfør»/«Lukk flate»/første punkt; rediger figur (kant → nytt hjørne, langt trykk → fjern; web: shift-klikk/Delete); maks zoom mobil 50×; piltaster fjernet | 🟢 Kenneth 2026-10-08 (flytt-ikon, lupe med kryss, rediger areal) |
| ← `21edd9ed` + `f0ad4d47` | **Mobil + web — måling i tegning** | **Etter:** fast størrelse på punkter, tekst og strek uansett zoom; iOS-bildemeny av ved langt trykk; måling går foran plassering; alle punkter kan dras (lupe på mobil); flere målinger blir liggende, trykk for å velge, «Slett»/«Slett alle»; maks zoom mobil 10→20. Målinger lagres ikke | 🟢 Kenneth 2026-10-08 (dra punkter, flere målinger + slett; «skal ikke lagres nå») |
| ← `9cf1fbea` | 🔴 **Mobil — tegningsvisning** | **Før:** kort trykk i «Navigering» gjorde ingenting; opprettelse krevde bytte til «Plassering»; ingen måling. **Etter:** kort trykk viser hint («Hold inne for å opprette …») og bryteren blinker; langt trykk setter markør og åpner malvalget; «Mål» med linjal/polylinje/areal (samme regnestykke og lås som web, kilde vises, kalibrering kun på web, krever nett). Reload: OTA | 🟢 Kenneth 2026-10-07 «ja til 1 og 2, ta med måling på mobil» |
| ← `84f97c19` | **Web — tegningssiden, måleverktøy og zoom** | **Før:** ett måleverktøy (kontinuerlig punkt til punkt); musehjulet panorerte (regresjon fra `09fd30a4`); knip rykket litt. **Etter:** tre verktøy — linjal (to punkter), polylinje (summert, avsluttes på eksisterende punkt/Enter/dobbeltklikk), areal (skravert, m² + omkrets); musehjulet zoomer igjen; knip forankret fra gest-start. Konsekvens: loddrett tofinger-scroll på styreflate zoomer (sidelengs panorerer) | 🟢 Kenneth 2026-10-07 («Adobe benytter 3 stk icon …»; musehjul = reparasjon) |

### 2026-10-07

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| ← `09fd30a4` | 🔴 **Web — tegningssiden, måling og zoom** | **Før:** måling var sperret når målestokken var lest fra tittelfeltet (alle PDF-tegninger); knip på styreflate hoppet; kalibrering hadde ingen veiledning. **Etter:** målestokk fra tittelfeltet kan måles direkte, kilden vises ved målet («1:50 (fra tittelfeltet)») med «Stemmer ikke? Kalibrer»; knip gir jevn zoom ved pekeren, tofinger-scroll panorerer, musehjulet beholder trinn; kalibrering viser stegene og tegner punktene. Gjelder `kanMale` i shared (også mobil) | 🟢 Kenneth 2026-10-07 «vis 1:50 → da skal de fungere → kalibrering … dersom 1:50 oppdages som feil» |
| ← `2946fe5b` | **Web — tegningssiden** | **Før:** zoom med hjulet havnet midt på toppen av tegningen; verktøylinja (måling, innstillinger) scrollet ut av syne. **Etter:** zoom treffer musepekeren (målt ±0,9 px), bare tegningen scroller og verktøylinja blir stående | 🟢 Reparasjon av feltfunn 24.09 + Kenneth 2026-10-07 |
| ← `db98eb09` (T1c) | **Web — tegninger, detaljtabell** | **Før:** fag og rådgiver kunne bare settes før opplasting; tegningsnummer og type ble ikke foreslått for ARK-filnavn som «B3-06-A-20-31-02 Himlingsplan». **Etter:** kolonnene «Fag» og «Rådgiver» kan redigeres pr. rad; hele «B3-06-A-20-31-02» foreslås som nummer og «…plan» som type `plan` (merket «foreslått») | 🟢 Kenneth 2026-10-07 «kan ikke redigere fag dersom det er feil» + ekte filnavn |
| ← `e1a71e69` (T1b) | **Web — tegninger (byggeplass-oppsett)** | **Før:** etter opplasting kunne tegninger bare slettes; grupper kunne ikke lukkes. **Etter:** «Rediger flere» og blyant pr. rad åpner detaljtabellen igjen; «Vis» viser tegningen og «Tilbake til tabellen» uten å miste ulagrede endringer; fag- og etasjegrupper kan kollapses (huskes pr. byggeplass) | 🟢 R4-reparasjon + Kenneth 2026-10-07 (vis og tilbake, kollaps) |
| `0e50adad` ← `b5ca44cc` | 🔴 **Web — tegninger (byggeplass-oppsett)** | **Før:** én fil om gangen, én «Tegningsdetaljer»-modal pr. fil; ny revisjon måtte lastes som ny tegning. **Etter:** velg mange filer, fyll fag/rådgiver én gang, detaljer i tabell nå eller senere («Rediger flere»); nummer/type foreslås kun ved entydig treff; lista grupperes pr. fag (veksel til etasje); «Last opp ny revisjon» på web med konvertering. Målestokk valgfri som før | 🟢 Kenneth 2026-10-06 (20 ark-tegninger, «detaljer etterpå», «sortere pr fag»); spec `tegning-serieopplasting-spec.md` |
| `6ec95359` ← `18ad5bc3` | 🔴 **Mobil + web — sjekkliste, «+ Oppgave»** | **Før:** vanlige felt kunne bare ha én oppgave (knappen forsvant etter første); etter «+ Oppgave» → tilbake frøs sjekklisten (usynlig modal fanget trykk). **Etter:** alle felt viser alle oppgavene som chips og «+ Oppgave» blir stående; frysen rettet i rotårsaken (`OpprettDokumentModal` uten speil-state). Reload: OTA + web-deploy | 🟢 Kenneth 2026-10-07 «alle objekter … må støtte opprettelse av flere (+oppgave)»; frys = reparasjon |
| `d5758806` ← `e868f782` | 🔴 **Web — dagsseddel og attestering** | **Før:** web-raden hadde ingen matpause-avkrysning; timetallet trakk pausen skjult; «Arbeidstid i dag» hadde eget pausefelt. **Etter:** avkrysning «Matpause trukket (30 min)» på raden, ny rad får pausen automatisk etter regelen; «Arbeidstid i dag» utledes av radene og mister pausefeltet (start/slutt beholdt); attestanten ser «Matpause trukket» på bæreren, også når sedelen er låst | 🟢 Kenneth 2026-10-06 V20 = B |
| `669c579b` ← `625a7de6` | 🔴 **Timer (server) — engangsretting S2** | Dager der timetallet beviser trukket pause men raden ikke bar den, får krysset også når hodet sto på 0 (Kenneths 05.10). Hodet = Σ rad. Timetall endres aldri. Migrering `20261007120000_v20_s2_pause_backfill` | 🟢 V20 = B; Kenneth-test 2026-10-07 |
| `3b06dcb1` ← `dfa2a4aa` | 🔴 **Timer (server) — pausen eies av radene** | **Før:** hodet bar pausen, radene trakk den skjult. **Etter:** radens `pauseMin` er sannheten, hodet = Σ rad utledet på serveren; synk fra eldre app normaliseres (avvises aldri); splitt flytter pausen til delraden i pausevinduet; engangsretting `20261006220000_v20_pause_backfill` setter krysset der timetallet beviser fradraget | 🟢 Kenneth 2026-10-06 V20 = B |
| (denne commit) | **Web — malarkiv (SiteDoc-arkivet, firmaarkivet, import-tilordning i kontrollplan)** | **Før:** gruppetitlene viste standardens kode foran navnet («NS3420-K — Anleggsgartnerarbeider»). **Etter:** bare navnet. Kapittelkoder («KB …») vises som før | 🟢 §7b pkt 2 (fabel 2026-10-07), etter at Kenneth stoppet prod-seed over NS-henvisninger |

### 2026-10-06

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `a933898f` ← `dcaadd21` | 🔴 **Mobil — manuell timerad og matpause** | **Før:** en manuelt ført rad som krysset pausevinduet fikk firmaets 30 min trukket skjult. Avkrysningen sto tom, og fradraget skjedde også på dager under 5,5 t. **Etter:** raden bærer pausen synlig (kryss + `pauseMin` lagret) når dagen er over 5,5 t, raden krysser pausevinduet og ingen annen rad bærer den. Ellers trekkes ingenting. 07:00–15:00 → kryss, 7,50 t; fjernes krysset → 8,00 t. ⚠️ Eldre rader med skjult fradrag rettes først i V20-S (backfill). Reload: OTA | 🟢 Kenneth 2026-10-06 «avhukingen skal vise tilstanden også for manuell føring» + V20=B |

### 2026-10-03

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `586c2c95` ← `15aab779` | 🔴 **Mobil + web — versjonssjekk aktiv** | Telefonen husker serverversjonen pr. rad og sender den. **Effekt:** endring kun på PC → PC står og telefonen henter den; begge endret / slettet på én side → forslag med årsak («Endret både på PC og telefon», «Telefonen: slettet», «PC: slettet»), valg her eller på PC. Banner: «Dagen er også endret på PC. Se begge og velg — her eller på PC.» Reload: OTA etter server + migrering | 🟢 Kenneth 2026-10-05 |
| `2e37dec3` ← `50e356ab` | 🔴 **Timer-synk (server) — samme sedel redigert på PC og telefon** | **Før:** den som synket sist overskrev den andre, stille. **Etter:** serveren sjekker radversjon: kun PC endret → PC står; kun telefon endret → telefonen lagres; begge (eller slettet på én side) → telefonens versjon blir forslag, arbeideren velger, attestering blokkert. **Ikke virksomt før V19.9-B** (telefonen sender versjon). Eldre app uten versjon får konflikt ved ulikt innhold i stedet for overskriving | 🟢 Kenneth 2026-10-05 «systemet skal finne ut av dette» |
| `9d400c02` ← `6abc2c47` | 🔴 **Web — dagsseddel og attestering ved overlapp** | **Arbeideren:** dagsseddelen på web får «Forslag fra mobilen — velg» med PC/mobil side om side og «hele dagen»-knapper. **Attestanten:** forslaget vises lesbart, attester-knappen er grå med forklaring; retur virker. Forslag går aldri i eksport | 🟢 Kenneth 2026-10-04: V19, «b», V19.5 blokkert |
| `8100fcc0` ← `e9039b37` | 🔴 **Mobil — dagsseddel med overlapp mot PC** | **Før:** overlappende rader ble slått stille sammen («slått sammen»). **Etter:** dagen havner i konflikt med banner «Dagen er også registrert på PC, og tidene overlapper. Se begge og velg — her eller på PC»; sammenligningen viser serverens forslag, «hele dagen»-knapper, valget skrives samlet. Valg tatt på PC slipper konflikten på telefonen ved neste synk. Ikke-overlappende rader slås sammen som før. Ingen låseskjerm-varsel (krever `expo-notifications`). Reload: OTA etter server | 🟢 Kenneth 2026-10-04: V19, «b», V19.4 ja |
| `3dd2f590` ← `8492b66c` | 🔴 **Attestering (web) + eksport** | **Før:** reise-rad så ut som vanlig rad («—» i tid), «(inkl. reise)»-badge, `rad.beskrivelse` skjult. **Etter:** reise-merke («Reise ut/retur», «Reise (manuell)», «Reise» når retning mangler, «reise (kilde ukjent)» for gamle rader) med rute/km/min/kilde, arbeid/reise delt, banner når normen ikke er serverens, varsel ved `reiseAvvik`, beskrivelse vises. Eksporten får 11 nye kolonner; Excel uten valg har alle faste (som før, `78394d44`); byggherre-eksport får ikke kilde/tidskilde/norm | 🟢 K5 + V8 (Kenneth 2026-10-03); Excel fast + AML-varsel uendret (Kenneth 2026-10-04) |
| `73fe99c0` ← `775246c2` | 🔴 **Timer-synk og attestering (server)** | **Før:** dag ført på PC + overlappende rader fra mobil ble slått stille sammen (PC 07–15 + mobil 07–15 = 16 t). **Etter:** ved overlapp lagres mobilens rader som FORSLAG (egen tabell, telles ikke), sedelen får `konfliktVentendeSiden`, og **attestering blokkeres** (begge veier) til arbeideren har valgt. Rader uten overlapp slås sammen som før. Eldre app får vanlig konflikt i stedet for stille sammenslåing. Ikke synlig i UI før V19-B/C. Purring (A-6) utsatt | 🟢 Kenneth 2026-10-04: V19, «b», V19.4 ja, V19.5 blokkert |
| ← `cef84b94` (2026-10-06) | 🔴 **Mobil — timer-synk** | **Før:** et nettkall som aldri fikk svar låste synken for resten av økta; dagsseddelen sto «Venter» uten forklaring. **Etter:** hvert nettkall har 20 s tidsgrense og prøves igjen; synken kjører straks appen åpnes; banneret viser «Ikke sendt: … — prøver igjen automatisk» og har «Prøv igjen nå». Reload: OTA | 🟢 Reparasjon av `timer.md` (30 s synk) |
| `54f7ccb2` ← `737a357e` | 🔴 **Mobil — Hjem, prosjektvelger og «Ny dagsseddel» uten nett** | **Før:** «Kunne ikke hente prosjekter» erstattet hele Hjem; prosjektvelgeren og «Ny dagsseddel» var tomme. **Etter:** prosjektene leses fra telefonen, Hjem viser alltid Oppgaver/Sjekklister/HMS med «Frakoblet»-banner, innboksen vises fra lokale data (ellers «Innboksen krever nett»). Reload: OTA | 🟢 Reparasjon av Kenneth-vedtak «A» + CLAUDE.md «Mobil-appen MÅ fungere offline» |
| `b51623b0` ← `5b24a802` | **Mobil — Mer → prosjekt** | **Før:** «Skriv ut» og «Eksporter» viste bare «kommer snart». **Etter:** knappene er fjernet. PSI, kart og IFC-etiketter følger brukerens språk | 🟢 Kenneth 2026-10-04 «fjern knappene» |
| `b51623b0` ← `255c739c` | 🔴 **Mobil — offline-lesing + «Forbered til offline»** | **Før:** i flymodus ble et lagret dokument stående og laste (spørringen pauset, ble aldri regnet som frakoblet). «Forbered offline» viste ingenting varig. **Etter:** lagret dokument åpnes skrivebeskyttet; Mer viser alltid «N dokumenter og M tegninger lagret for offline · sist klargjort …» eller «Ingenting lagret ennå»; feil blir stående. Reload: OTA | 🟢 Reparasjon av Kenneth-vedtak «A» + Kenneth 2026-10-04 «minimum burde det stå om noe er lagret» |
| `fce371ad` ← `3025be8d` | 🔴 **Mobil — åpne dokument uten nett** (sjekkliste, oppgave, HMS) | **Før:** spinner/«ikke funnet» uten nett. **Etter:** dokumenter brukeren har åpnet med nett, eller lastet ned via «Forbered offline» (maks 200, ikke avsluttede), åpnes **skrivebeskyttet** med «Frakoblet – viser lagret versjon fra …». Bilder viser «Bilde krever nett». På nett: uendret (spinner mens den venter). Ikke-nedlastet dokument: «ikke lastet ned» i stedet for evig spinner. **Forhånds-nedlasting stempler ALDRI «lest av mottaker»** (ny bieffekt-fri `hentForOffline`). Sjekklistelista offline viser ikke lenger forrige brukers liste ved brukerbytte. Reload: OTA; forhånds-nedlasting krever server-deploy | 🟢 Kenneth-vedtak «A» 2026-10-03 (LESE offline) |
| `28c7d168` ← `99e5bdbc` | 🔴 **Mobil — reise-rader på dagsseddelen** | **Før:** reise-rader hadde ingen klokkeslett («—»), og raden husket ikke etappe, avstand eller kilde. **Etter:** reise ut/retur får et utledet klokkevindu (`tidKilde = "utledet"`), og raden bærer hele sporet til serveren og tilbake ved pull. Manuelt lagte reise-rader merkes `reiseKilde = "manuell"` uten retning. Reload: OTA | 🟢 K5 + V8 + B4 valg A (fabel 2026-10-03) |
| `28c7d168` | **Mobil — «Reisetid teller mot overtid»** | Mobilen leser ikke lenger innstillingen (kolonnen står, to-stegs) | 🟢 V2 |
| `6b05a694` ← `fe5ed27f` | 🔴 **Overtidsgrunnlaget på serveren (attestering)** | **Før:** serveren summerte reise-rader inn i timene som sammenlignes med normen — 7,5 t arbeid + 1 t reise ga 1 t «overtid». **Etter:** reise-rader holdes utenfor; grunnlaget viser arbeid og reise hver for seg. 🔴 **Overtidsavviket attestanten ser blir mindre på reisedager** | 🟢 V1 «reisetid er aldri overtid» (Kenneth 2026-10-01) |
| `6b05a694` | **Firma → innstillinger** | **Før:** avkrysningen «Reisetid teller mot overtid» (som ingen lenger leste). **Etter:** den er borte. Kolonnen står til neste release (to-stegs) | 🟢 V2 «flagget utgår» (Kenneth 2026-10-01) |
| `6b05a694` | **Timerader (server)** | **Før:** en reise-rad ble gjenkjent på lønnsartnavn ved hver lesing. **Etter:** raden bærer `erReise` + etappe, avstand, kjøretid, kilde og regel-snapshot; serveren flagger `reiseAvvik` mot matrisen (dobbel terskel: >10 % OG >2 km / >10 min), men regner aldri om. Ikke synlig før L2-C (attestering) og L2-B (mobil sender sporet). 🔴 **Migrering `20261003120000_timer_lag2_sporbarhet` IKKE kjørt** — Kenneth leser navne-match-tallet før prod | 🟢 K5 «mottak med sporbarhet» (Kenneth 2026-10-03) |
| `2e993250` | 🔴 **Attesteringsvarselet (server) + web-sedelen** | **Før:** begge leste et **flatt** tall fra firmainnstillingen. Web-koden sa det rett ut: *«sesongjustering krever server-endepunkt → utenfor scope»*. **Etter:** begge delegerer til én utledning, og firmaer med `normKilde = "kalender"` ser en **sesongjustert** norm | 🟢 V16, Kenneth 2026-10-02. **H22-fiksen** |
| `2e993250` | **Overtid på reisedager (alle flater)** | **Før:** flagget «Reisetid teller mot overtid» senket dagsnormen med reisetiden, så overtiden begynte tidligere. **Etter:** normen står urørt — **reisetid er aldri overtid**. 🔴 **Mindre overtidsbetaling på reisedager for firmaer som hadde flagget på** | 🟢 V1/V2, Kenneth. Fasit **Dag E** feiler hvis normen senkes |
| `2e993250` | **Arbeidsdagen på mobil** | **Før:** dagen begynte når GPS-en startet, altså ved reisestart. **Etter:** arbeidsvinduet er `[start + ut, slutt − retur]` — **dagen begynner når reisen slutter**, og normen og pausen henger på det vinduet | 🟢 V3/V5/V6 |
| `2e993250` | **Når prosjektet ikke kan utledes** | **Før:** `prosjekter[0]` — en vilkårlig sedel, stille. **Etter:** dagen holdes åpen med `prosjektUkjent`, og **meldingen navngir veien ut**: velg prosjekt, trykk «Slutt dag» på nytt | 🟢 H1. Samme mønster som `kildeManglet` |
| `2e993250` | **Når normen er ukjent** (offline >30 d) | **Ingen normaltid/overtid-splitt**, alle timer på standard lønnsart, med varsel etter «Slutt dag» og banner på sedelen. 🔴 **ALDRI 7,5 som gjetning** — en gjettet norm ser ut som et regnet faktum | 🟢 B6.3. Feilretningen er underbetaling, derfor er markøren synlig |

🟢 **Og en KORREKSJON av H22 som kom fra karakteriseringstestene:** mobilens og serverens
utledninger var **strukturelt identiske**. H22 var at varselet og web-sedelen leste den **flate
kolonnen** — ikke at utledningene var uenige. ⚠️ **Uten testene først ville vi trodd vi lukket noe
annet enn vi gjorde.**

### 2026-10-02

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `6ff26a80` | **Opprett byggeplass** (web) | **Før:** dialogen hadde kun navn. **Etter:** adressefelt — fylles det ut, geokodes byggeplassen mot Kartverket og får et punkt, så reise kan beregnes. 🔴 **Ikke påkrevd** (byggeplasser i terreng har ikke alltid adresse), og geokoding som feiler blokkerer aldri opprettelsen | 🟢 V14, helhetsplanen. Kenneth 2026-10-01: koordinat inn i opprettelsen |
| `6ff26a80` | **Byggeplasslista + reisetid-matrisen** | **Før:** en byggeplass uten punkt var usynlig — ingen flate sa fra. **Etter:** «Mangler plassering — reise beregnes ikke» i lista (når Timer er aktiv), og to tellere på matrise-flaten: hvor mange byggeplasser som mangler punkt, og hvor mange par som er uoppnåelige | 🟢 V14. ⚠️ **Dette er grunnen til at H21 kunne stå i fire måneder** |
| `6ff26a80` | **«Beregn fra tegning»** | **Før:** overskrev alltid et manuelt satt punkt. **Etter:** et punkt satt i kartvelgeren er fredet | 🟢 Kenneth-dialog 2026-10-01: «kartvelgeren overstyrer alltid» |
| `1ca8f6e4` | **«+ Ny» dagsseddel på mobil** | **Før:** GPS foreslo prosjekt innenfor 500 m av prosjektets punkt. **Etter:** forslaget krever treff i en byggeplass-**geofence**. 🔴 **Noen prosjekter vil slutte å få forslag** til byggeplassene deres har punkt — det er tilsiktet, og C5-varslene viser hvilke | 🟢 H2 i helhetsplanen: to innganger med ulike regler |

🔴 **Reparasjon med stor virkning, samme runde (`6ff26a80`): H21.** Reisematrisen målte til
**prosjektets** koordinat når byggeplassen manglet punkt — siden `7d98b80a`, 11. juni. Et prosjekt kan
strekke seg over kilometer, og avstanden avgjør om kjøringen betales som arbeidstid eller reisetid.
**Arv-baserte rader slettes ved neste recompute.** ⚠️ **En byggeplass som i dag «har reise» via arven,
mister den til punktet er satt** — C5-varslene gjør det synlig.

### 2026-10-01

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `e4866f8d` + `9c7c1ad1` | **Dagsseddel i mobilappen** — når telefonen og web har rørt samme dato | **Før:** rødt banner «Server-versjonen vant», ingen opplysning om hva serveren har, og eneste knapp slettet arbeiderens timer. **Etter:** banneret peker til en **sammenligning av begge dagskort pr. tidsrom**. Arbeideren velger **pr. rad** hva som er rett, retter i skjermen, og bekrefter — resultatet er **ETT dagskort**. Er web-kortet sendt/attestert: lesevisning, og han ber lederen returnere det | 🟢 **Kenneth 2026-09-30:** *«vi må vise begge registreringer og bruker må velge hvilken som er rett -> evt mest rett»* + *«vi skal ende opp med et utfylt dagskort -> verifiserbart på begge flater»*. Tre presiseringer bekreftet av ham: valg pr. rad · sammenligning pr. tidsrom · visningen brukes også uten konflikt |
| `9c7c1ad1` | Samme — attestert dagskort | **Arbeideren kan se begge sett, men ikke endre.** Vernet i **to lag**: lesevisning i appen, og serveren avviser kallet | 🟢 **Kenneth 2026-09-30, alternativ A.** Serveren har håndhevet grensen siden 2026-07-09 (`dagsseddel.ts:2159-2164`) — dette gjør den synlig i forkant i stedet for som en blokkering |

⚠️ **Skrivingen er atomisk, og det var et valg:** én mutasjon i stedet for en sekvens av
eksisterende kall. **Et halvveis anvendt valg er samme feilklasse som det stille datatapet** —
et dagskort i en tilstand ingen har valgt, på lønnsdata.

🔴 **Kontrolløren fant et TOCTOU-vindu før merge:** redigerbarhets-sjekken lå utenfor
transaksjonen, så en bulk-skriving kunne landet på et kort som ble attestert i vinduet. **Da
ville alternativ A vært håndhevet i skjermen, men ikke i koden.** Lukket med status-betinget
`updateMany` som åpner den interaktive transaksjonen.

### 2026-09-30

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `b02630ef` | **Dagsseddel i mobilappen** — når web-dagskortet er sendt/attestert | **Før:** «Gjenåpne for redigering» var trykkbar, og den slettet arbeiderens egne timer fra telefonen. **Etter:** knappen er grå i den tilstanden, med teksten «Timene dine er bevart. Dagskortet kan ikke gjenåpnes herfra nå — kontakt lederen, som kan sende det tilbake til deg.» 🔴 **En handling er fjernet i ett feiltilfelle** — den handlingen ødela brukerens data | 🟢 Orkestrator 2026-09-30, meldt til Kenneth i samme runde. **Feiltilfeller teller som funksjon** |
| `b02630ef` | Samme — konfliktbanneret | **Før:** «Server-versjonen vant. Lokale endringer er erstattet» — **falskt etter vakten**, og vist rett over «Timene dine er bevart». **Etter:** to tekster som brancher på status: låst → «kontakt lederen»; returnert → «rediger og send inn på nytt». Alle 15 språk | 🟢 Reparasjon av en tekst som ble usann. Funnet av kontrolløren |

🟢 **Reparasjon med synlig virkning, samme merge (til orientering):** det stille datatapet er
lukket. En arbeiders timer for en dag kunne forsvinne fra telefonen uten spor — rødt banner ble
grønt, timene borte. **Kenneth fant symptomet; målingen fant tapet.**

| `1cecdb71` | **Firma-attestering** — Sedler-visningen (`SeddelKort`), Per ansatt-pivoten, sedel-detalj (web) og sedel-lista (mobil) | **Før:** attestanten måtte regne selv. Overtid som ikke stemte med ukenormen var usynlig med mindre han åpnet Per ansatt-fanen, der badgen har ligget siden 20.08. **Etter:** varsel på hovedflaten og i detaljen, begge veier — **ført overtid regelen ikke finner dekning for**, OG **ukesum over norm uten at noe er ført som overtid**. Viser norm, sum ordinært og sum overtid. 🔴 **Blokkerer ingenting** — attestanten er kontrollpunktet, ikke systemet | 🟢 `designnotat-attestering-fabel-2026-08-20.md` § D2, **Kenneth-vedtak 2026-08-20.** Badgen på `SeddelKort` er D2s egen ordlyd |

⚠️ **Hvorfor varselet er verdt å ha, i én setning:** web og mobil fører overtid **ulikt** —
mobilen setter overtidslønnsart automatisk, web gjør det ikke (nå-rapport `:141` M4).
**Varselet gjør forskjellen synlig i stedet for å skjule den**, og designnotatet er eksplisitt
om at systemet **aldri** retter `lonnsartId` stille: *«Lønnsartvalget er en menneskelig
handling.»*

🟢 **Til orientering, samme merge (reparasjon med synlig virkning):** `beregnUkeAvvik` lå som
en **privat funksjon i en web-komponent uten én test** — levert 20.08, utestet i seks uker.
Den er nå i `@sitedoc/shared` med **én definisjon og tre konsumenter**, og de seks
D2-tilfellene dekker den **retroaktivt**. Den bygde badgen tok ikke feil; testene er grønne.

| `21064640` | Bildevedlegg i **mobilappen** — kvittering på tillegg/utlegg, vedlegg i dokument, info-bilder | **Før:** feilet et bilde permanent (slettet fil, utløpt tak), viste `<Image>` bare en tom grå firkant der bakgrunnen sto på bildet selv — og på flater uten bakgrunn: ingenting. **Etter:** en synlig sluttilstand med `ImageOff`-ikon og teksten «vedlegget kunne ikke lastes», skalert pr. flate. 🔴 **Et zoom-vindu som før åpnet seg tomt, sier nå hvorfor** | 🟢 Kenneth 2026-09-30: **«send tilbake»** — etter at kontrolløren fant at `return null` kollapset den grå firkanten, og avviket ble lagt fram i klartekst før merge |

⚠️ **Hvorfor dette står som funksjonsendring og ikke reparasjon:** selvfornyelsen (krav 3b) er
reparasjon — den var alltid ment å virke. **Men den terminale tilstanden var et nytt valg:** å
rendre `null` ville gjort et slettet vedlegg usynlig, og det er *stille tomhet*. **Feiltilfeller
teller som funksjon** — hvordan systemet oppfører seg når noe går galt, er noe brukeren opplever.

🟢 **Kontrolløren fant den, ikke gaten.** Rollen ble innført samme dag, og dette var dens første
oppdrag. **De fire andre punktene i gaten var rene** — taket, backoffen, 404-vakten og
debouncen ble bekreftet mot koden.


### 2026-09-29

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `1b7fc87b` | Bildevedlegg i sjekklister og oppgaver — **web** | **Ingen annotering i web.** Bildet kunne vises og slettes, ikke merkes. Nå: pil, sirkel, firkant, frihånd og tekst — og **Velg/Flytt**, så en pil kan dras i stedet for å tegnes på nytt | 🟢 Kenneth 2026-09-29, valgte «paritetsmåling + annotering i web i samme runde» |
| `1b7fc87b` | Samme | Annoteringen lagres som et **redigerbart lag**, ikke brent inn i bildet. Tre artefakter: **originalen røres aldri** · Fabric-laget som data · utflatet JPEG for visning, PDF og mottaker | 🟢 Kenneth 2026-09-29: *«hvorfor kan vi ikke legge et eget lag på bildet → slik at anotering er redigerbart?»* |

#### 🟡 HJEMMEL GITT PÅ FORHÅND — ikke levert ennå: innlogging kreves for alle lagrede objekter

Føres her **før** ordren sendes, som regelen krever. Ingen hash ennå — måleordren
(`relay/inbox-uploads-innlogging-maaling.md`) endrer ingen kode. Raden flyttes opp i
tabellen over med hash når gaten faktisk merges.

| Flate | Før → Etter | Hjemmel |
|---|---|---|
| Uthenting av **alle lagrede objekter** — bilder, tegninger, punktskyer, vedlegg, eksporter | I dag: **signatur-kun**. `hmac.ts:231` krever gyldig HMAC i URL-en og sjekker **ikke** innlogging — en signert lenke virker for hvem som helst i 15 min. Etter: **gyldig innlogging kreves i tillegg**, og prosjekttilgang pr. objekt der eierraden finnes | 🟢 Kenneth 2026-09-29: *«URL skal ikke være nok for å hente ut et bilde → vi skal ha en gyldig innlogging → dette gjelder alle objekter som lagres og tilhører systemet»* |

🟢 **Kenneth-vedtak 2026-09-30 — IMPERSONERINGEN STYRER SYNLIGHETEN.** `Session` bærer både
`userId` og `impersonatedUserId`. **Den EFFEKTIVE brukeren avgjør hva som vises** — den som
ser skjermen, ikke den som eier innloggingen. Signaturen bindes til effektiv `userId`, og
gaten sammenligner mot effektiv `userId`.

**Følgen, og den er selvhelbredende:** signaturer laget under impersonering slutter å matche
i det øyeblikket impersoneringen opphører — manuelt eller ved at `impersonationExpiresAt`
løper ut. Tilgangen strammes automatisk, uten opprydding.
⚠️ **Forutsetter at `SignertBilde` sin selvfornyelse utløses av DENNE feiltypen og ikke bare
av utløpt signatur. IKKE MÅLT.** Slår den ikke inn, blir resultatet tomme bilder til brukeren
laster siden på nytt.

**Kenneth har eksplisitt akseptert restrisikoen** i 15-minutters-vinduet: *«15 minutter er
ikke et problem → risiko for tyveri er betydelig redusert til pågående arbeid»*.
Signaturen beholdes derfor som den er — innlogging legges **oppå**, ikke i stedet for.

⚠️ Dette er andre gang samme krav stilles. `hmac.ts:224-227` siterer Kenneths krav fra
**2026-09-24** — «sjekk om den som henter ut bilder er innlogget, ikke bare ved pålogging»
— og konkluderer likevel med «Ingen sesjons-fallback». Kravet ble den gang lest som
«strammere signatur» i stedet for «innlogging». Det er rotårsaken til at det kommer opp igjen.

#### 🟡 HJEMMEL GITT PÅ FORHÅND — ikke levert ennå: tekstverktøyet skal treffe overalt

| Flate | Før → Etter | Hjemmel |
|---|---|---|
| Annotering, tekstverktøyet (web + mobil) | **I dag:** `annoterings-html.ts:109` — `if (opt.target) return`. Treffer klikket en eksisterende markering, opprettes **ingen** tekst, og brukeren får ingen tilbakemelding. **Etter:** klikket oppretter alltid tekst, **unntatt** når det treffer en eksisterende *tekst* — den åpnes da for redigering. Velging hører til Flytt | 🟢 Kenneth 2026-09-30: *«enig»* på coworks anbefaling |

**Bakgrunn:** Kenneth: *«fritekst annoteringer fungerer ikke → jeg finner ikke logikken for når
de vises og ikke vises»*. Logikken fantes, men var usynlig — treffområdet er hele objektets
rammeboks, ikke bare streken, så på et bilde med markeringer traff klikket ofte noe uten at
brukeren kunne vite det.

**To reparasjoner følger samme runde — ingen hjemmel nødvendig, de retter noe som var ment å
virke:** tom tekst slettes stille ved `text:editing:exited` (`:158`), og iframe-fokus gjør at
første klikk kan miste tastetrykkene (**hypotese, ikke målt**).

#### 🔴 TEKSTANNOTERING ER VERIFISERT I WEB — MOBIL ER UTESTET

⚠️ **Ikke les «tekstannotering levert» som levert på begge flater.** Tekstverktøyet ble bygget om
2026-09-29: modalen er fjernet, og teksten skrives nå direkte på bildet med `fabric.IText` som går rett
i `enterEditing()`.

| Flate | Status |
|---|---|
| **Web** | 🟢 Verifisert. IText fokuserer i nettleser |
| **Mobil** | 🔴 **UTESTET.** I `react-native-webview` avhenger tastaturet av at `enterEditing()` faktisk åpner WebView-tastaturet. **Gjør den ikke det, virker ikke tekstannotering på telefon i det hele tatt** |

🔴 **Og det er mobilarbeid etter paritetsregelen** — «ta bilde, sette pin» står eksplisitt på
mobil-siden. **Annotering i felt gjøres på telefon, ikke på PC.** ⚠️ **Oppdages dette først med hansker
i regn, er det på verste sted.**

🟡 **Kandidat-fiks, ikke satt:** `keyboardDisplayRequiresUserAction={false}` på WebView-en (iOS).
🟢 **Redesign nektet å sette en prop han ikke kunne teste** — en prop satt på antakelse er en umålt
påstand i kode. **Krever enhet.** 🔴 **Og det blokkeres av at simulatoren peker mot produksjon i stedet
for `api-test`** ([BACKLOG](BACKLOG.md)) — den saken er nå på kritisk vei.

#### 🔴 KONSEKVENS DU SKAL KJENNE: flatene har nå ULIK ANGRERETT på samme handling

**Web:** annoter → originalen består → åpne igjen → flytt pilen → angre helt.
**Mobil:** annoter → **originalen erstattes permanent** (`FeltDokumentasjon.tsx:532`, siden 2026-08).

⚠️ **Ingen ny skade — mobil har oppført seg slik siden annoteringen ble bygget, og web bryter ikke på
mobil-annoterte bilder** (KRAV(c) test 4: de blir ikke-redigerbare, ikke ødelagte). 🔴 **Men fra og med
denne mergen avhenger det av hvilken skjerm brukeren holder i hånda om han kan angre.** **Og piloten er
mobil-først — altså den flaten som IKKE kan.**

🟢 **Mobil-runden er avgrenset bevisst, ikke utsatt:** den endrer lagringsmodellen og rører
**offline-køen**, som er den skjøreste flaten vi har («Mobil-appen MÅ fungere offline»). Den får egen
gate. 🔴 **Og den er blokkert til simulatoren peker mot `api-test` i stedet for produksjon**
([BACKLOG](BACKLOG.md)) — den runden trenger den innloggede in-app-flyten.

#### 🟢 Sidefunn fra samme runde: annoteringen var aldri borte

**Kenneth trodde funksjonen var forsvunnet fra sjekklister.** Målt: `FeltDokumentasjon.tsx` i web har
**null treff på annotering i hele git-historikken.** Den har alltid vært mobil-only. 🟢 **Paritetsmålingen
som fulgte:** 33 rapportobjekt-komponenter finnes i BEGGE trær — **24 i full paritet, 9 divergerer, 1 ren
mangel.** ⚠️ **De ni er divergens fra parallell utvikling, ikke tap** — men listen bør vedlikeholdes, ikke
lages én gang.

### 2026-09-27

| Hash | Flate | Før → Etter | Hjemmel |
|---|---|---|---|
| `a2a4083c` | `/uploads/` fil-URL-er (alle flater) | Signaturlevetid **24 t → 15 min** | 🟢 Kenneth valgte 15 min, **betinget** av at selvfornyelsen gjør utløp usynlig ([BACKLOG](BACKLOG.md)). Betingelsen ble oppfylt 27.09 da lenke-klassen fikk selvfornyelse ⚠️ **Kenneth fikk betingelsen, ikke brukeropplevelsen — se merknad under** |
| `e1b0f61b` | Sjekklister (web + mobil) | **KA7** «Dokumentasjon på opprinnelse», **KB2** «Varedeklarasjon kontrollert», **KB4** «Klippet jevnlig frem til overtakelse» var trafikklys. Nå nedtrekk med navngitte valg | 🟢 Kenneth bestilte MK C-revisjonen |
| `e6e20804` | Malbygger, prefiks-felt | Tom prefiks ble godtatt. **Nå avvises den.** Auto-suffiks `SJA2` → `SJA-2` | 🔴 **INGEN.** Designordren skriver «Produktvalget er tatt», men `grunnlag` er coworks kartlegging + SQL-målinger |
| `83ee6bb6` | Firmamal, prefiks-felt | Lagret man med tomt prefiks-felt, ble prefikset **fjernet**. Nå betyr tomt felt «ikke endre» | 🔴 **INGEN.** Residual av samme ordre |
| `1c537726` | Sjekklistebibliotek, malkode | Malen het **`UM1.1`**. Heter nå **`UM1S`** | 🔴 **INGEN.** Designs ordre |
| `1ebfb693` | Eksport-flaten, 15 språk | 12 tekstnøkler het `arkiv.*` og brukte ordet «arkiv» mot brukeren. Nå `eksport.*` og «eksport» | 🟡 Commit heter «navnevedtak» og peker på et vedtak — **sporet er ikke funnet. Bekreft eller korriger** |

#### 🔴 De fire radene som mangler hjemmel — til avklaring

**Alle fire er små, og alle fire er sannsynligvis riktige.** ⚠️ **Men de står i develop uten at
Kenneth har sett dem, og det er tilstanden registeret finnes for å hindre.** 🔴 **Ikke rull noe
tilbake før Kenneth har svart.**

#### ⚠️ Merknad til signaturlevetiden — hjemmelen holder, informasjonen holdt ikke

**Det som ble skrevet ned var betingelsen** («selvfornyelsen gjør utløp usynlig») — en teknisk
påstand. **Ingen skrev hva en bruker faktisk merker.** 🔴 **Og målt 2026-09-28: gaten har ALDRI kjørt
i prod** (siste prod-deploy `eb9071f2` 24.09; `/uploads/`-gaten kom 26.09, 15 min 27.09). **Så det
finnes ingen erfaring med tallet ennå.**

**Kenneth vurderte 8 timer og valgte å beholde 15 min** til test har gitt data — *å bytte bort
sikkerhet på grunnlag av en observasjon som ikke kunne ha skjedd, er å gjette med tall.*
🟢 **Den reelle brukerkostnaden er en annen og rettes separat:** `SIGNERT_BILDE_MAKS_FORSOK = 1`
betyr at ett dropp i dekningen ødelegger bildet, og med 15 min fornyes en åpen fane ~96 ganger i
døgnet. **Piloten er 50 anleggsgartnere på dårlig 4G — det er deres normaltilstand.**

---

## 🟢 REPARASJONER MED SYNLIG VIRKNING — til orientering, ingen godkjenning

### 2026-10-14

| Hash | Flate | Før → Etter |
|---|---|---|
| `ea24bc2a` ← `020a3b4b`, `544f0125`; `5a31477b` ← `e452792c`; `d3ea5ce5` ← `4e18bc80` | **Web — dokumentsøk, reprosessering** | **Før:** «Prosesser alle PDF-er på nytt» gav mange røde dokumenter som måtte startes én og én, ingen samlet fremdrift, søket kunne henge når NorBERT ikke svarte. **Etter:** knappen heter «Prosesser alle dokumenter på nytt» (den gjorde alltid alt), viser «Prosesserer N av M» / «Ferdig: X ok, Y feilet», er deaktivert mens den kjører; embedding har timeout + nye forsøk og felles kø mot NorBERT; jobber som har hengt seg (>15 min uten livstegn) vises «Avbrutt»; søket faller til tekstsøk med synlig merknad. ✅ Bevist på test (32 dok, 0 røde, `relay/dokumentsok-bevis/12-*`, `13-*`). Reload: deploy |
| `feca5bc4` ← `d3fb35bc` | **Web — dokumentsøk, PDF-sidetall** | **Før:** alle PDF-treff sto på «side 1» (pdf-parse skiller ikke sider med `\f`), og «avsnitt» var 0-indeksert. **Etter:** riktig side pr. treff for nye PDF-er; avsnitt 1-indeksert. Eksisterende PDF-er rettes først med reekstraksjon (`fix/pdf-reekstraksjon`, venter Kontrollør). Reload: deploy |

### 2026-10-10

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `5efd2a6f` ← `9f6cf836` + `3c83052d` | Web + mobil + API — opplasting og DWG-visning | **Sikkerhet (8c-2):** opplasting tar nå bare filtyper appen bruker (`.svg`/`.html`/`.js` avvises); filer i `/uploads/` som ikke er bilde/PDF/binær får sandbox-CSP, så skript i dem ikke kjører. **ezdxf:** gammel ezdxf-fil uten nytt strekformat vises med vanlig strek, ikke som svarte bjelker (bare test berørt) | Lukker lagret XSS; tegningen skal vises som tegnet. Reload: deploy + OTA |
| `44d2e913` ← `31e78bdd` | 🔴 **Web — dokumentsøk** | **Før:** DOCX ble aldri søkbar (stille «ferdig» uten tekst), embedding etter opplasting hoppet stille over (evig «venter»), søketreff viste ikke hva/hvor. **Etter:** DOCX søkbar med overskrifter; ukjent format får synlig status; embedding via tjenesten med synlig feil; «Prosesser på nytt» pr. dokument/mappe; treff med uthevet utdrag, side/seksjon, metode, gruppert pr. dokument, forhåndsvisning til treffet; zip-bomb-vern; score kun superadmin. ✅ Verifisert i UI på test 2026-10-14 (Redesign, `relay/dokumentsok-bevis/01–06`). Reload: deploy | 🟢 Kenneth 2026-10-13/14 («ja til A, B og C», søkekvalitet) |
| `0d5dab1b` ← `66b27df8` | Mobil — offline tegning | **«Forbered til offline» gjorde ingenting** (tomme handlere) og viseren leste aldri lokal kopi. Nå: forbered tegning/byggeplass, lokal kopi først (file://), «Ikke tilgjengelig offline» uten nett, gammel revisjon ryddes, LRU-tak 500 MB. Lupe vises ikke lenger for SVG/DWG (dekodet aldri SVG; pinch-zoom). ⚠️ Ikke verifisert på telefon | F7 MÅ (arbeidstegning-spec), BACKLOG § OFFLINE. Reload: OTA |
| `b4fafe65` ← `5150b332` | Web + mobil — startutsnitt | **Stående tegninger** (fallplan etter rotasjon) åpnet for stort og måtte scrolles: zoomen ble regnet bare i bredden. Nå får hele utsnittet plass i begge akser; liggende tegninger uendret | Startutsnitt vedtatt RETUR 2 §3. Reload: deploy + OTA |
| `29807936` ← `76c390b2` | Web — ny revisjon og konvertering | **Lagre/Avbryt** i «Rediger tegningsdetaljer» kunne avbryte revisjonsopplasting; **«Konverter DWG»** var aktiv under pågående konvertering og startet en parallell; markøren viste forrige revisjons versjon under konvertering; tegningen scrollet i stort format før startutsnittet. Nå sperret, idempotent, «Konverterer …», startutsnitt før første bilde. Henger en konvertering > 10 min: «Konverteringen ser ut til å ha stoppet» + «Prøv igjen» | Ny revisjon skal fullføres uten feller. ⚠️ Klokka er `updatedAt`, så redigering under henging utsetter rømningsveien (BACKLOG). Reload: deploy |
| `ba70fa4a` ← `7e42ddf2` | Web — «Last opp ny revisjon» fra «Rediger tegningsdetaljer» | **Siden låste seg og fila ble aldri lastet opp** (knappen submittet det ytre skjemaet, revisjonsdialogen ble liggende usynlig over siden). Nå åpnes A→B-dialogen og opplastingen fullføres. Fra «Rediger tegninger»-tabellen virket det fra før | Ny revisjon fra begge steder (T1/R8). Reload: deploy |
| `8cdfc888` ← `51d220c4` | Mobil + georef-editor — DWG-visning (prod-regresjon) | **Rå DWG-SVG ble svart** på iPhone (og i web de første ~0,5 s): `vector-effect:non-scaling-stroke` i `<img>` ga ~170 px strek. Nå strek i viewBox-enheter, ~1,5 px ved intrinsic størrelse | Tegningen skal vises. ⚠️ Ikke verifisert på iPhone ennå. Reload: deploy + rekonvertering |
| `7c9c1811` ← `7821138a` | Mobil + web — DWG-visning (prod-regresjon fra `83a8d53f`) | **Mobil:** rotert DWG på høykant (fallplan) ble 7 MP og vistes ikke i iOS. Nå lengste side 2000 px (2,15 MP); krever rekonvertering. **Web:** etter ny revisjon fanget viseren ikke touchpad-pinch, så Chrome zoomet hele siden. Nå re-festes lytteren | Tegningen skal vises og zoomes som før. Reload: deploy + rekonvertering av berørte DWG |
| `675f8cc3` ← `2f4a3558` | Web + mobil — DWG-tegninger | **Tekst ble ~0,72× riktig høyde** (rom- og kotetekster for små mot TrueView); MTEXT-forankring (gruppe 71) ble ignorert (tekst oppå tekst). Løse elementer (modullinjer, snittmarkør) styrte startutsnittet så tegningen åpnet for langt ute. Nå riktig teksthøyde og forankring, startutsnitt etter bygget (georefererte tegninger uendret) | Tegningen skal vises som tegnet; startutsnitt vedtatt RETUR 2 §3. Reload: deploy + ny konvertering |
| `deb57d89` ← `def7f228` | Web + mobil — DWG-tegninger | **Store DWG-er (fallplan) viste svarte flater** i georeferanse-editor, ved åpning og på mobil (strektykkelse i tegningsenheter ≈ 94 px). Nå fast 1,5 px-strek i SVG-en selv | Tegningen skal vises som tegnet. Reload: deploy (ny konvertering for eksisterende DWG) |

### 2026-10-03

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `1a9c8e10` ← `733903eb` | Mobil — oppgavelista og HMS-lista | **Uten nett var listene tomme/feilet.** Nå vises sist hentede liste med «Frakoblet – viser lagrede dokumenter» og «Sist hentet», som sjekklistelista har gjort siden `970045d7`. Å ÅPNE et dokument offline virker fortsatt ikke (fase 2, LES — Kenneth-vedtak 2026-10-03) | CLAUDE.md «Mobil-appen MÅ fungere offline» + Kenneth 2026-09-07 «offline må utbedres». Reload: OTA |

### 2026-09-30

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `49d3fffb` ← `49a137e2` | Tegninger, web — ny rediger-modal (8 felt) | **Tegningsdetaljer kunne ikke rettes etter opprettelse.** Nå kan navn, tegningsnummer, fagdisiplin, tegningstype, **etasje**, **status**, opphav og beskrivelse endres | 🔴 **`tegning.oppdater` (`tegning.ts:375`) har hatt skrivetilgang på ALLE feltene hele tiden**, med `verifiserProsjektmedlem`. Knappen ble aldri koblet — i web brukes mutasjonen kun til målestokk (`tegninger/page.tsx:333`) |
| `a82b88d0` ← `3b2a2004` | Annotering, web + mobil | **Frihåndsstrøk ble aldri lagret.** De kunne heller ikke angres eller flyttes. Nå dekkes de av lagring, Angre og Flytt | 🔴 **`canvas.isDrawingMode` lot Fabric legge strøket på lerretet uten at noen fanget det.** 0 `path:created`-håndterere → strøket kom aldri inn i `objekter`, som er kilden til alle tre |
| `a82b88d0` ← `3b2a2004` | Samme — pilen | Den hvite kontrastkanten lå forskjøvet under den røde streken | 🔴 Begge `fabric.Line` manglet eksplisitt senter-anker. Sirkel og firkant ble rettet tidligere; pil-linja ble antatt konsentrisk uten at det var målt |

#### 🔴 To feller av samme slag, lukket samme dag — verdt å kjenne mønsteret

**Begge tegnings-fellene er felt som settes ÉN gang, i en flyt brukeren kanskje aldri kjører,
uten vei tilbake:**

- En tegning opprettet uten `floor` havnet i **«UTEN ETASJE»** og kom aldri derfra
- `status` settes til `"utkast"` ved opprettelse (`tegning.ts:186`) og kunne **kun** endres ved
  å laste opp en ny revisjon (`nyRevisjon`, `:412`). 🔴 **Hver tegning i systemet sto som
  «utkast» for alltid** med mindre noen kjørte revisjonsflyten

⚠️ **Frihånds-tapet var samme klasse, ett hakk verre:** strøket ble brent inn i den flate
JPEG-en, men forsvant ved neste annotering — og var **permanent tapt uten varsel** ved neste
lagring. **Kenneth meldte tegnings-saken 19.08 og igjen 30.09** før den ble tatt.

🟢 **Verifisert ved merge:** i18n 23 lagt til / 0 slettet i alle 15 språkfiler · georeferanse,
GPS, kalibrering, 3D, punktsky og IFC = 0 treff · tom etasje faller tilbake til «Uten etasje»
på alle tre grupperingsstedene (`TegningerPanel.tsx:56`, `TegningsModal.tsx:50`,
`byggeplasser/page.tsx:73`) — målt av cowork, ikke antatt.

### 2026-09-28

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `38567b33` | Trafikklys i sjekklister/oppgaver — web, mobil og arkiv-PDF | **Rendreren leste aldri `objekt.config.options`.** En mal som erklærte sitt eget lyssett ble ignorert, og feltet viste standardsettet Godkjent/Anmerkning/Avvik/Ikke relevant. **Nå vises malens eget sett, i malens rekkefølge, med malens etiketter** | 🔴 **Malene har erklært lyssettene hele tiden.** `TrafikklysObjekt.tsx:14` destrukturerte `{ verdi, onEndreVerdi, leseModus }` og leste aldri `objekt` — `config.options` var uleselig for skjermen |
| `38567b33` | Malbyggeren | Én trafikklys-oppføring i paletten | **To:** ett tre-lys og ett fire-lys. Begge oppretter `traffic_light`; tresettet er en delmengde (firesettet minus `gray`), ikke en andre liste |
| `38567b33` | Malbyggeren, lagring | Et lyssett kunne lagres med duplikater, ukjente verdier eller ett lys | **Avvises nå** med `BAD_REQUEST`. 🟢 **Antallet er IKKE låst til 3/4** — en hardkodet grense ville gjentatt feilen i [`bruk-er-ikke-behov.md`](retningslinjer/bruk-er-ikke-behov.md). Mangler `options` → kanonisk firelys-fallback, som verner de 27 dagens felt |

🔴 **KUNDESYNLIG NÅR DET DEPLOYES:** målt at **6 av 6 `traffic_light`-felt i PROD har egne `options`** —
altså viser samtlige feil etiketter i dag. **Fire av de seks tilhører A.Markussen.** 🟢 **Ingen er besvart
ennå**, så ingen lagret verdi skifter betydning. ⚠️ **Ligger på develop; prod er ikke rørt.**

🟡 **Én konsekvens å kjenne til, ikke en mangel:** seedede etiketter oversettes (`oversettStandardtekst`),
**firmaets egne etiketter vises rått på alle 15 språk.** 🔴 **Det er et bevisst valg, og grunnen er ikke at
vi ikke KAN oversette — det er at vi ikke SKAL:** en maskinoversatt etikett på et kontrollpunkt er en
påstand om hva som ble kontrollert mot, og tar oversettelsen feil, **lyver et signert dokument.** Samme
grunn som malreglene forbyr ordrett normtekst. 🟢 **Rammer bare den som aktivt overstyrer teksten — da er
det hans tekst, på hans språk.**

### 2026-09-27

| Hash | Flate | Før → Etter | Hvilken intensjon som gjenopprettes |
|---|---|---|---|
| `c98791a4` | PSI-opprettelse (web) | PSI nr. to ga **stille feil** — spinneren stoppet, ingenting skjedde. Nå inline melding om hvilken PSI som finnes og hva brukeren kan gjøre | Det var meningen at opprettelsen skulle gi tilbakemelding |
| `0f8eccdf` | Trafikklys (web + mobil + arkiv-PDF) | En lagret verdi utenfor verdisettet fikk feltet til å se **ubesvart** ut. Nå vises den rå verdien med teksten «ikke et gyldig valg» | Et lagret svar skal aldri forsvinne stille |
| `e1b0f61b` | Sjekkliste KB4, hjelpetekst | «… sett «Ikke relevant».» → «… sett «Ikke relevant (grasbakke/eng)».» | Hjelpeteksten skal sitere opsjonen som finnes |
| `24b598bf` | PSI-opprettelse (DB-garanti) | Prod håndhevet **én PSI per prosjekt**. Nå: én per byggeplass, og høyst én på prosjektnivå | 🟢 Kenneths egen beskjed: «et prosjekt kan ha ti forskjellige psi» — indeksen avvek fra den |

### 🔴 Venter på prod, og skal verifiseres FØR deploy

| Hash | Hva som skjer | Hvorfor det må ses i felt |
|---|---|---|
| `8db99f8e` + `a2a4083c` | `/uploads/` er **default-deny for hele treet**. Hver bilde- og vedlegg-URL må være signert | **Har aldri kjørt i prod.** Er én konsument glemt, viser den et tomt bilde hos en kunde. Coworks negative kontroll fant 0 gjenstående rå lenker i `apps/web/src`, og mobil dekkes av resolveren — **men det er målt i kode, ikke i felt.** 🔴 **Verifiser som innlogget på test: sjekkliste med bilder · oppgave med vedlegg · en tegning · last ned ett vedlegg.** `curl` med 200 beviser ingenting her |

---

## Ikke ført — ingen synlig virkning i noe tilfelle

**29 docs-merger 26.–27.09** · `fix/psi-prosjektniva-unik` DROP-vakt (testfil) · snubletråder,
paritetstester, `psiWhere`-opprydding, `ukjentTrafikklysVerdi` flyttet til `shared`.
