---
name: arbeidstegning-spec
description: Produktspesifikasjon for arbeidstegning — DWG/DXF som verktøy på byggeplassen, ikke som bilde. Brukerhistorier (fagarbeider, bas, prosjektleder), ni funksjoner merket MÅ/BØR/KAN med akseptkriterier som kan kjøres på Kenneths tretten ekte filer (tre ARK/utomhus + sju Revit-tegninger fra HABU + et sykehus-sett: ARK-underlag, medisinske gasser, tele/elektro), avgrensning, § 8 felles objektmodell på tvers av 2D-tegning, IFC/3D og mobil (Kenneth-vedtak 2026-10-12), F11 georeferanse fra DWG (kart-CRS, ett fastpunkt à la Dalux, to punkter, 2D→IFC via IfcMapConversion, nord opp), fjorten spørsmål til Kenneth (Q1–Q11 besvart); F11.7–F11.9 gjør georef fra fil til påstand med kilde, konfliktvarsel og justering mot fasit; § 9 gjenkjenning på tvers av CAD-standarder med firmakobling lag/mønster → type (Kenneth-hjemmel 2026-10-18). Teknisk vei (A: ezdxf-SVG + egenskapsregister · B: DXF på klient) velges IKKE her — den avgjøres av Dokgens målte prøve mot § 3.
sist_verifisert_mot_kode: 2026-10-12
eier: fabel (plan-eier) — orkestrator gater spec; kode-ordrer gates av Kontrollør (§ 0 én gate)
status: 🟢 VEDTATT (Q1–Q8 besvart 2026-10-12) · rev. 13, 2026-10-22 (§ 9.7 K6 veggtype: AT-V1–V6 målt, GJ-3/GJ-4, Q15) · rev. 12, 2026-10-19 — ⚠️ UTKAST TIL GATE (RETUR 1 rettet: tykkelse fra geometri, frittstående prosjekter, kildetekst): § 9 gjenkjenning av lag/objekter på tvers av CAD-standarder (AT-K1–K8 målt; K1 rekkefølge + «Ukjent type», K2 aldri feil tall, K3 rapport, K4 prosjekt-/firmakobling = FUNKSJONSENDRING m/ Kenneth-hjemmel 18.10, K5 testkorpus; Q12–Q14 besvart 18.10). F11 rev. 9 fortsatt til gate. Ingenting under er bygget.
---

# Arbeidstegning — DWG/DXF som verktøy, ikke bilde

> Hjemmel: **Kenneth 2026-10-12:** *«ved innzooming kan det være nødvendig å laste mer detaljer dersom brukeren trenger zoom
> for å skille ulike rør og materialer fra hverandre → det er nettopp poenget med en tegning → man skal se hva som skal
> utføres på byggeplass. DWG inneholder også metadata på linjer og objekter. disse bør også være klikkbare og kunne hentes
> opp. jeg hadde håpet dxf-sporet ville lede til det detaljerte grensesnittet som gjør dwg/dxf nyttig vs PDF»* + *«ja»* til
> spesifikasjon før noe mer bygges. Ordre: orkestrator 2026-10-12 (`relay/inbox-fabel.md`). Rev. 2: Kenneth la til sju
> Revit-tegninger (`DWG eksempelfiler/HABU/Fra interaxo/`) — *«prøv å analysere disse filene → er det mer informasjon?»* Ja (§ 1b). Rev. 3: to MEP-tegninger (`TB3-1074.dwg`, `VB3-1074.DWG`) — *«sjekk disse to filene»* (AT-F10–F13). Rev. 4: ARK-underlaget `AB3-1071.dwg` kom — *«nå er filen der»* (AT-F14). Rev. 5: Kenneth *«har du sjekket hva 3d motoren med ifc gjør → vi har objekter der også som leses og vises. kan vi bygge på de ulike plattformer slik at vi bygger bredt og robust?»* → *«ja»* til § 8. Rev. 6 (13.10): Kenneth *«en dwg-tegning kan være georeferert … IFC-modellen georefereres basert på DWG-ens georeferanse … Dalux orienterte tegningen med kun det ene koordinatet»* → orkestrator: krav nå, ikke bygging (F11). Rev. 7 (13.10): Kenneth la **IFC-en og en punktsky** fra HABU i eksempelmappa — *«kan du se i dwg eksempelfiler, jeg la til en ifc og en punktsky»* (AT-G13–G14). Rev. 8: *«nå er hele punktskyen der»* → AT-G14 målt ferdig. Rev. 9 (13.10): Kenneth på Q11 *«jeg tror IFC er feil georeferert. den er georeferert av noen som ikke kunne jobben sin. punktskyen stoler jeg 100 % at er rett»* → orkestrator: georef fra fil er påstand, konfliktvarsel, justering mot fasit (F11.7–F11.9).

## 0. Hva dette er, og ikke er

Dette er **hva byggeplassbrukeren skal kunne gjøre** med en DWG/DXF-tegning på telefon og PC, med krav som kan testes på de
tretten ekte filene i `DWG eksempelfiler/` (tre av dem er fixtures i `apps/api/test-fixtures/dwg/`; HABU-filene: se Q7, flyttet bort 2026-10-12). Den
**velger ikke** teknisk vei. A (ezdxf-SVG + egenskapsregister) mot B (DXF tegnet på klient) avgjøres av Dokgens målte prøve
mot akseptkriteriene i § 3. Bygger på [tegning-dwg-spec.md](tegning-dwg-spec.md) (konvertering, enheter, layouts, strek). § 8 eier den **felles objektmodellen** som også IFC/3D-viseren skal bruke (Kenneth 2026-10-12), men
rører ikke 3D-renderen/punktsky, PDF-veien eller tegningsserie (T2).

## 1. Målt utgangspunkt (2026-10-12)

### 1a. Viseren i dag

| # | Fakta | Bevis |
|---|---|---|
| AT-M1 | **Klikk på objekt** (web, modus «Inspeksjon») viser bare *Lag · Type · Tekst*, lest fra `data-layer`/`data-type`/`textContent` på det trufne elementet. Ingen blokk, attributt, materiale, farge, lengde eller stabil id | `tegninger/page.tsx:1149-1168, :2450-2480` |
| AT-M2 | **Lagliste / lag av-på finnes ikke.** Eneste «lagfilter» er markørtyper (oppgaver/kontrollpunkter) + periode | `page.tsx:226-231, :1868-1898`; `grep -i layer` → kun CSS/inspeksjon |
| AT-M3 | **Søk i tegningen finnes ikke** (0 treff utover URL-param) | `page.tsx:236-244` |
| AT-M4 | **Måling:** linjal/polylinje/areal + 90°-lås + referanselinje + snap. `beregnSnap` snapper **kun mot egne målepunkter**, aldri mot tegningsgeometri (0 treff `getPointAtLength`/`isPointInStroke`/`elementFromPoint`). Målinger lagres ikke | `page.tsx:1754-1820, :971-1003`; `maaling.ts:595-635` |
| AT-M5 | **Markører = felt på dokumentet** (`Task`/`Checklist`/`KontrollplanPunkt`: `drawingId`, `positionX/Y` i %). Ingen markørtabell, ingen objektreferanse. Oppgave opprettes fra klikk (web+mobil), sjekkliste bare på web. **Sjekklister med posisjon vises ikke på tegningen.** Ingen avviks-/notatmarkør. Områder: `Omrade.polygon` | `schema.prisma:1377-1379, :1468-1470, :2600-2602, :1162-1185`; `page.tsx:1172-1278, :226-228`; `lokasjoner.tsx:555-618` |
| AT-M6 | **Zoom** 0,25–50 (web), bredde `zoom·100 %` på inline-SVG; strek dempes `zoom^0,5` klemt 0,5–4 px. Mobil: nettleser-pinch til 50×, demping ved settle | `page.tsx:150-152, :2219-2239, :588-602`; `TegningsVisning.tsx:188, :269-291` |
| AT-M7 | **Mobil har ingen objektklikk**, og mobilvarianten er farge-gruppert uten `data-layer` (vedtak C2: 12 775 mot 59 958 noder, pinch 39,6 mot 7,7 fps). Lupe er RN-overlay, bare i måling/flytt | `dwgKonvertering.ts:2293-2298`; `TegningsVisning.tsx:409, :706-751` |
| AT-M8 | **Offline:** tegningsfil lastes ned til `sitedoc-tegninger/`, men viseren leser alltid server-URL; `hentTegningLokalSti` har 0 brukere; «Forbered til offline»-menyen har tom handler. Måling bare med nett | `offlineKlargjoring.ts:55-112`; `lokasjoner.tsx:477-478`; `BACKLOG.md:57-59`; `mobil.md:320` |
| AT-M9 | **Stabil objekt-id finnes ikke i SVG-en:** `render.py` leser DXF-handle for å utlede type, men skriver ikke `data-handle` (0 treff). **XDATA leses ikke** av noen motor (0 treff `xdata`/`get_xdata` i `render.py`/`dwgKonvertering.ts`). **Laginventar lagres ikke i DB** — `konverteringRapport` har bare `parsetPrType/tegnetPrType/ikkeTegnet` + `markor` | `render.py:80, :203-208, :479-513`; `dwgKonvertering.ts:950-971, :1364-1372` |
| AT-M10 | Tegningssiden har **ingen hjelpetekst** (?-ikon); bare tooltip-nøkler `maaling.*Hjelp` | `nb.json:1670-1678`; `grep HjelpKnapp tegninger/` → 0 |

### 1b. Hva de tretten ekte filene faktisk bærer (ezdxf 1.4.4 på `dwg2dxf -y`-DXF, lokalt 2026-10-12)

| # | Fil | Fakta |
|---|---|---|
| AT-F1 | **Fallplan (ArchiCAD-eksport, AC1032, mm)** 24 074 entiteter, **55 lag i bruk**. Lagnavn bærer **NS 3451-bygningsdel** («231- Bærende yttervegger», «242- Ikke-bærende innervegger», «315- Utstyr for sanitærinstallasjoner») og **IFC/AIA-kategori** («A-WALL», «S-COLS», «P-SANR-FIXT» = sanitærutstyr, 7 847 el.). Suffiks «(Skravur)» / «(Nye konstruksjoner)» skiller flate fra kontur og nytt fra eksisterende. **60 rom som blokker med attributter `ROOM_NAME`/`ROOM_NUMBER`** («LAB. 12», «6V-18.03»). **Skravurmønster = materiale:** `Betong_strukturell` 413, `Gips` 183, `Lettklinker` 25, `Trefiber` 2. 37 MTEXT: koter («+42 000») og fallvinkler («1,35°»), 24 LEADER. **Alle entiteter ACI 7 / ByLayer-lw** (CTB-funn, lukket). 0 XDATA, 0 hyperlenker |
| AT-F2 | **Utomhus UTM32 (AC1032, m)** 749 entiteter, **29 lag**. Objekttypen ligger i lagnavnet med SOSI-liknende kode: «8250 Kum» 69, «8253 Sluk_rist» 30, «6013 Annet gjerde» 63, «88 Lampearmatur» 18. Ingen blokker, ingen tekst, 0 XDATA. Farge pr. entitet |
| AT-F3 | **NTM6 (AC1032, m)** 761 entiteter på **ett lag «Diverse»**, skilt bare med farge. Hver entitet har extension dict `AEC_PROPERTY_SETS` (AutoCAD Architecture/Civil 3D), men **libredwg 0.14 melder «Unhandled Class object AEC_PROPERTY_SET_DEF»** → settene finnes ikke i DXF-en. 🔴 Tapt i kjeden vår uansett vei A/B |
| AT-F4 | **MEP er nå målt på to eldre AutoCAD-tegninger** (AT-F10–F13): system = lag + linjetype, dimensjon/medium = tekst ved siden av røret, ingen objektdata. **Revit/MagiCAD-MEP-eksport** (som ville gitt kategori-id for rør/kanaler som i AT-F6) er fortsatt ikke målt → Q1 |
| AT-F5 | **HABU (sju Revit-eksporter, AC1024, mm, 100–155 KB hver; AART arkitekter, «UNN Aktivitetssal HABU», tilbudsunderlag 2026):** A-10-101/102 plan 1./2. etasje, A-30-100 snitt, A-40-100 fasader, A-82-101 rivetegning, A-88-101/102 himlingsplan. 173–461 entiteter pr. fil (LINE, HATCH, INSERT, MTEXT, DIMENSION, ARC). **11–19 lag med NS 3451-kode i navnet** («A23_yttervegg», «A24_innervegg», «A233_dør vindu», «A82_akser», «A83_romtekst», «A84_målsetting», «A255_himling»). libredwg gir bare ufarlige advarsler («Skip HATCH common handles»); ezdxf leser uten `recover` |
| AT-F6 | 🟢 **Hver entitet bærer XDATA `REVIT`** (100 % av 2 201 entiteter): kode 1 = **Revit element-id**, kode 2 = **Revit-kategori** (BuiltInCategory, bekreftet mot lagnavnene: −2000011 Vegger, −2000023 Dører, −2000014 Vinduer, −2000032 Dekker, −2000035 Tak, −2000038 Himlinger, −2000100 Søyler, −2000080 Inventar, −2000220 Akser, −2000240 Nivåer/koter, −2000260 Målsetting, −2000300 Tekst, −2000480 Romtagger, −2000200 Snittmarkører, −2001160 VVS, −2005002/−2005011 himlings-/veggkoder), kode 3 = underkategori (snittlinje/projeksjon/skravur), kode 5 = **type-id** (nøyaktig én pr. element, 317/317). **Én vegg = mange streker med samme element-id** (vegg 727699: 29 LINE + 4 skravur + 3 HATCH i A-10-101). **Element-id er stabil på tvers av tegninger:** 91 av 317 elementer finnes i 2–7 tegninger; vegg 727699 i plan 1, plan 2, snitt, fasade og begge himlingsplaner |
| AT-F7 | 🟢 **Pennebredde finnes:** lag har distinkt ACI-farge og lineweight (vegger lw 15, akser/tekst lw 9, tak lw 20 pr. entitet) → **tykk/tynn kan tegnes fra fila**. CTB-konklusjonen i `tegning-dwg-spec.md` («bare ACI 7, ingen lineweight») gjelder ArchiCAD-IFC-importen, **ikke** Revit-eksporter. Linjetype `Demolished` på rivetegningen (A-82-101) = «rives»; `stiplet 4_0mm`, `Grid Line`, `Dash dot` i bruk |
| AT-F8 | 🟢 **Tittelfeltet er lesbar tekst i paper space** (Layout1, 17–23 MTEXT): målestokk «1 : 50», tegningsnavn («Plan 1. etasje»), prosjekt («UNN Aktivitetssal HABU»), dato («7.5.2026»), tegningsnummer («A-10-101»), status («Tilbudsunderlag»), prosjektnr. («2025004-43»), adresse, gnr/bnr, «Tilbygg», revisjonstabell-hode (REV./DATO/ENDRING). Lukker T-funnet «DWG-tittelblokk parses ikke» (`tegning-serieopplasting-spec.md:110`) for Revit-filer. Snittpil-tekst «A-30-100» i modelspace = **kryssreferanse til annen tegning** |
| AT-F9 | **Blokknavn bærer familie + type + størrelse + element-id + visning (HABU):** «Focus-ID Hel - 10x21M_dyttefuge 10mm-710045-1_ et_ 1-50 Plan» (innerdør, 10×21 M), «Focus-krysspost åpningsvindu bunn - 12x12M-755431», «Rektangulær søyle - 130x110-555886», «WC HC gulvstående». Romtekst som tre MTEXT pr. rom (navn/nummer/areal: «Aktivitetssal» «137» «56.8 m²») på A83_romtekst, kategori Romtagger. 28 DIMENSION med måleverdi (3 440 mm …). Skravur: `SOLID` + Revit-fyll `FP_1…FP_21` (mønsternavnet er tapt, bare nummer). Ingen ATTRIB, ingen hyperlenker |

| AT-F10 | **VB3-1074 (VVS, medisinske gasser; AC1018 = AutoCAD 2004, `$INSUNITS 0` = enhetsløs, koordinater i mm)** 1 303 entiteter. **Hvert gassystem er ett lag med egen farge OG linjetype:** V3411 (CENTER, gul), V3412 (CENTER2, blå), V3413 (CENTERX2, magenta), V3414 (DASHEDX2), V3415 (DIVIDEX2), V3416 (DIVIDE2) — NS 3451 341 medisinske gassanlegg, siste siffer = system. V3400 = utstyr (blokker `GB` 13, `SKAP2/3`, `TRVAKT`), V341-T = **tekstlag** med 152 TEXT: dimensjon + medium «15.TR», «12.O2», «18.O2», «22.TR», «10.LG», «15.EVAK», «10.CO2», «10 MM OKSYGEN», «12 MM MED.TR.LUFT». Blokker: `PILS` (strømningspil) 126, `AVST` (avstengingsventil) 34. 175 CIRCLE (r 15/20 = uttak). **Ingen ATTRIB, ingen XDATA på entiteter, ingen hyperlenker.** Hvilken tekst som hører til hvilket rør er **bare geometri** (nærmeste linje), ikke data |
| AT-F11 | **TB3-1074 (tele/elektro, samme bygg, AC1018, enhetsløs)** 731 entiteter, 14 lag: E4113 (449, føringer; 172 LINE `DASHED_2` = skjult/i tak), E4111, E521/E520-T (tele, 521), E556 (lyd/bilde), E4611 (lys), E1821, E232, E433. **Komponentblokker med attributter:** `_E-0019` ×11 på E521 (`LITT=J32.200`, `ANTAL=1`), `_E-0234B` ×13 på E556 (`LITT=J76.2`, `$TEXT=R/TV`), `_E-01221` ×23 på E1821, `ESYMB_30` (`PLH=3000` plasseringshøyde, `MAN=Av`), `$AHEIGHT` (rom-/dørhøyder). Attributtene `LITT` (littera/komponentmerking), `RUM` (rom, tom), `ANTAL` kommer fra et nordisk E-CAD-oppsett. TEXT: romnummer «B7.06» ×11 på E520-T, kursnummer «D1.1»–«D2.7». Tekstlag med suffiks «-T»/«T» |
| AT-F12 | 🔴 **Bygget er en xref som mangler.** Begge filene refererer `AB3-1071` (ARK-plan) fra `T:\A-RITO\B\B3\AB3-1071.DWG`, innsatt i origo, skala 1, rotasjon 0, på lag `XREF-ARK`. Lastes VB3/TB3 opp alene → **tegningen viser bare rør/kabler i tomrom, uten vegger.** (Xref-fila kom i rev. 4, AT-F14.) VB3 bærer ARK-ens lagnavn med beskrivelse (`AB3-1071|A2312` «Ikke bærende yttervegg», `AB3-1071|ROMNR` «Tekn.romnr./Romkode», «Lagstruktur etter POINT arkitekt modul») — et spor etter underlaget, ikke geometri. **TB3, VB3 og AB3 deler koordinatramme** (extents 152 694–197 330 / 257 727–294 508, samme xref-innsetting) → fagtegningene kan legges oppå hverandre uten kalibrering. **Bekreftet i rev. 4:** AB3-1071 har extents 152 999–197 326 / 257 740–294 263 — samme ramme som VB3 på desimalen |
| AT-F13 | **Enhetsløs (`$INSUNITS 0`)** på begge → D5-regelen låser måling til kalibrering, selv om koordinatene åpenbart er mm (bygg 44 × 37 m, teksthøyde 150). `$LTSCALE` 50/200 → linjetypemønsteret (CENTER/DASHED) må skaleres riktig for å skille systemene visuelt; egen motor tegner i dag alle linjetyper heltrukne (`tegning-dwg-spec.md` D-M12), ezdxf-motoren er ikke målt på dette |

| AT-F14 | **AB3-1071 (ARK-underlaget; AC1032, mm, `$LTSCALE 200`)** 1 911 entiteter (1 465 LINE, 213 TEXT, 204 INSERT), 21 lag. 🟢 **Lagene bærer egne beskrivelser i fila** (`AcAecLayerStandard`, lest av ezdxf `layer.description`): A2311 «Yttervegg bærende», A2411 «Innervegg bærende», A2412 «Innervegg IKKE bærende» (966 el.), A2433 «Dører i innervegg», A2334 «Vindu i yttervegg», A222 «Søyler», A271 «Fast innventar», A27131 «Sanitærutstyr», A621 «Heiser», A661 «Sjakter», ROMNR «Tekn.romnr./Romkode», BRNR «Bruksnr.» — lagstruktur etter POINT arkitektmodul. **Rom:** 140 TEXT på ROMNR = romkode («7S-21.02») og romnavn («EKSP.», «MEDISIN», «VAKT», «ISOL.») som to løse tekster ~230 mm fra hverandre; BRNR = bruksnummer («B3-773 A»). **XDATA fra POINT** på 1 373 entiteter (`XA40AWALLLINE` vertex-punkt + typekode, `XA40ASTOMKOMP` dør/vindu-mål 4500×1380, `XA40ACOLUMN` søylemål 400×400) — **gir ikke objektidentitet** (vegg = linjer som deler vertex, bare geometri). Dør/vindu-blokker med kodet navn («_A_LD1P9590PMLNS88», «_A_W24P115…»), anonyme `*U24…` dynamiske blokker, WC1/S14/G2 sanitær. Ingen tittelfelt (Layout1 tom), 3 DIMENSION. ⚠️ **libredwg 0.14 gir 97 `ERROR: bit_rd_BL: unexpected 2-bit code`** på denne AC1032-fila og skriver likevel DXF — fullstendighet mot TrueView er ikke målt (test 18) |

**Konsekvens:** «hva er dette?» kommer fra fire kildeklasser, avhengig av eksporten:
1. **Revit-eksport (HABU):** element-id + kategori + type fra XDATA, familie/størrelse fra blokknavn, pennebredde fra lag — rikest, og id-en holder på tvers av tegninger og (normalt) revisjoner.
2. **ArchiCAD/IFC-import (fallplan):** lagnavn (NS 3451/IFC), romblokker med attributter, skravurmønster = materiale.
3. **Vektorisert/landmåler (UTM32, NTM6):** bare lagnavn og farge; AEC-egenskapssett tapt.
4. **Eldre AutoCAD/POINT (AB3/VB3/TB3):** system/bygningsdel = lag med **beskrivelse i fila** + linjetype + farge, dimensjon/medium/romnavn = tekst ved siden av objektet (bare geometrisk kobling), komponent = blokk med attributter (littera, type, høyde); **bygget ligger i en egen xref-tegning** som må stables under fagtegningene (F10).
§ 3 krever at viseren bruker det som finnes, og viser aldri «—» for det som mangler.

### 1c. IFC/3D-viseren i dag (målt 2026-10-12)

| # | Fakta | Bevis |
|---|---|---|
| AT-I1 | **Modellen parses i nettleseren** (web-ifc wasm + `@thatopen/components` ^3.3.3, `FragmentsManager`/`IfcLoader`). Ingen server-konvertering, ingen objekter/egenskaper i DB; serveren leser bare metadata med regex (prosjekt, etasjer, GPS → `Drawing.ifcMetadata`) | `tred-viewer-kontekst.tsx:345-471`; `ifcMetadata.ts:20-156`; `tegning.ts:454-475` |
| AT-I2 | 🟢 **Klikk gir rike egenskaper:** raycast → `getItemProperties`/`getPropertySets`/`getTypeProperties`/`getMaterialsProperties`, forelder (IfcRelAggregates), type (IfcRelDefinesByType), lag (IfcPresentationLayerAssignment), system (IfcRelAssignsToGroup), Psets + mengder, materialer/lag/profiler, IFC-typenavn. Vist i `EgenskapsPopup` (kategori, navn, attributter, grupper). **GlobalId/expressID filtreres bort** fra visningen | `kontekst :619-942`; `EgenskapsPopup.tsx:39-110`; `konstanter.ts:29-35` |
| AT-I3 | **Skjul pr. IFC-type / lag / system** finnes, men bare fra et klikket objekt (øye-knapper) via `GetLineIDsWithType` + `setVisible`. **Ingen forhåndsliste/lagpanel, ingen søk** (0 funksjonstreff). Etasje: nedtrekk fra `ifcMetadata.etasjer` + to klippeplan, bare i `/tegning-3d` | `kontekst :967-1122, :1172-1185`; `FilterChipBar.tsx`; `tegning-3d/page.tsx:203-311` |
| AT-I4 | **Ingen kobling objekt → oppgave/sjekkliste.** 3D-markøren er en midlertidig rød kule som ikke lagres. `Task`/`Checklist` har bare `drawingId` + 2D-posisjon; ingen felt for GlobalId/expressID/3D-posisjon | `kontekst :583-601, :647`; `schema.prisma:1377-1379, :1468-1470` |
| AT-I5 | **2D ↔ 3D:** `gpsOverride {lat,lng,rotasjon,skala,transform}` fra firepunkts-kalibrering i tegning-3d; etasjeklipp bytter til plantegning med samme `floor`; `flyTil`/`sisteKlikkPunkt` synker. Ingen 2D-plangenerering fra IFC | `tegning.ts:896-931`; `tegning-3d/page.tsx:294-311, :402-505`; `kontekst :1123-1155` |
| AT-I6 | **Mobil:** egen WebView-rute `/mobil-viewer` med egen OBC/web-ifc-instans; bare `getItemProperties` (ingen Psets), ingen skjuling pr. type/lag/system. To cacher (IFC-fil `sitedoc-ifc/`, fragmenter `sitedoc-fragments/`); **modell lastet fra fragment-cache gir ingen egenskaper ved klikk** (`ifcDataMap` settes bare i fallback). `sendModeller` sender nett-URL, ikke `file://` (avvik fra mobil.md:563) | `mobil-viewer/page.tsx:54-106, :218-244, :288-315, :395-411`; `IfcViewer.tsx:94-158`; `ifcCache.ts:11-105` |
| AT-I7 | **Viserne deler nesten ingenting.** Tegningsviser og 3D deler bare `beregnTransformasjon`/`tegningTilGps`/`gpsTil3D`. Ingen felles markørmodell, egenskapskort eller lagpanel; **to kopier av `EgenskapsPopup`** (3d-visning/komponenter + modeller/page.tsx:326) | `tegninger/page.tsx:16-56`; `tegning-3d/page.tsx:10-16`; `koordinatBro.ts:118-168`; `web.md:502` |
| AT-I8 | Ytelse/gjeld: web-3D fast høyde + treg pan/zoom (regresjon kommer tilbake), debug-`console.log` i kontekst, layout-persistering 🔴 | `BACKLOG.md:1082-1103, :5551-5556`; `kontekst :476-481, :650-651` |

**Konsekvens:** 3D-viseren har allerede det rikeste egenskapskortet (AT-I2) og mekanismen for skjuling pr. kategori (AT-I3), men mangler panel, søk og kobling til dokumenter — de samme hullene som 2D (AT-M2/M3/M5). Byggeplassbrukeren møter dermed to visere med ulik oppførsel for samme vegg. § 8 lukker det.

### 1d. Georeferanse i dag — 2D, IFC og de 13 filene (målt 2026-10-13)

| # | Fakta | Bevis |
|---|---|---|
| AT-G1 | **Kartsystemer:** wgs84, UTM 32/33/35/36, NTM 5–20 (ikke 21–30). Egen Transverse Mercator-rekke, ingen proj4, **ingen høyde/NN2000** noe sted. `detekterKoordinatSystem`: filnavn (`EPSG…`, `NTM_n`, `UTM_nn`) først, så tallheuristikk: northing 6,4–8 M kreves; X 30–200 k → `null` («kan ikke bestemme NTM-sone»); **X 100–900 k → alltid «utm33»** — en gjetning uten sone-grunnlag | `koordinatKonvertering.ts:10-29, :40-140, :167-218` |
| AT-G2 | **Auto-georef ved DWG-konvertering:** bare når CRS er funnet: to punkter fra extents (pixel {0,0} ↔ (maxY,minX), {100,100} ↔ (minY,maxX)), uten marg-korreksjon, uten `$INSUNITS`-sjekk. JSON `GeoReferanse {point1, point2, ekstraPunkter?}` med pixel i **prosent av SVG**, gps lat/lng; **ingen crs i JSON** — CRS i egen kolonne `Drawing.coordinateSystem` | `dwgKonvertering.ts:2234, :2358-2371`; `types/index.ts:902-911`; `schema.prisma:935` |
| AT-G3 | **Minst to punkter alltid:** Zod krever point1+point2 (`ekstraPunkter` uten tak); **ett punkt er umulig i typen**. Matematikk: 2 punkter = eksakt similaritet (skala+rotasjon+translasjon, speiling foldet inn); 3+ = **full affin** minste kvadrat (kan skjære). Web krever ≥ 3 for måling (`harGeoref`), mobil nøyer seg med 2 (GPS-markør) | `validation/index.ts:76-92`; `georeferanse.ts:90-184, :217-298`; `page.tsx:1424-1427`; `lokasjoner.tsx:233, :354-406` |
| AT-G4 | **Editor** (`GeoReferanseEditor.tsx`, under byggeplass-oppsett, ikke på tegningssiden): klikk i tegning + GPS fra Leaflet-klikk eller tekst (`øst,nord@EPSG:258xx`, «Nord/Øst», desimalgrader, DMS). **Valgbare: WGS84 + UTM 32/33/35/36 — ikke NTM.** Kalibreringsfeil vises først ved ≥ 3 punkter | `GeoReferanseEditor.tsx:69-77, :96-180, :485-498, :685-722` |
| AT-G5 | **Rotasjon:** auto-rotasjon = dominant veggvinkel (lengdevektet 1°-histogram mod 90°, ≥ 20 segmenter, andel ≥ 0,6), kvadrant etter lesbar tekst; **slås av når CRS er funnet** («georefererte tegninger skal stå nord-opp», `:1539-1543`; ezdxf `--rotasjon av`). «Nord opp» er bare implisitt (urotert SVG); **ingen nordpil** i 2D web/mobil. `rotasjonOverstyrt` er visningsrotasjon satt av bruker; markører flyttes med `rotDelta` ved re-konvertering | `dwgKonvertering.ts:996-1066, :1539-1609, :2105`; `tegning.ts:304-345, :882-893`; `page.tsx:1402-1405` |
| AT-G6 | **IFC:** serveren leser bare `IFCSITE RefLatitude/RefLongitude/RefElevation` med regex (krever `.ELEMENT.`, bare positive heltall). **0 treff `MapConversion`/`ProjectedCRS`/`Eastings`/`Northings`** i kode. **0 `.ifc`-filer lokalt** (repo, fixtures, Downloads) | `ifcMetadata.ts:28-43, :172-186`; `grep -r` |
| AT-G7 | **2D↔3D (`gpsOverride`):** to punktpar (tegning A/B ↔ 3D A/B) → eksakt 2D-similaritet tegning(%)→3D(x,z): `a = s·cosθ, b = s·sinθ`, ingen minste kvadrat; `rotasjon`/`skala` sendes aldri fra UI; uten transform = ren TM-differanse fra IFC-opprinnelsen **uten rotasjon**. Opprinnelse: gpsOverride → `ifcMetadata.gps` → null; CRS = modellens, ellers «utm33» | `tegning.ts:896-931`; `tegning-3d/page.tsx:130-151, :231-232, :416-500`; `koordinatBro.ts:141-201` |
| AT-G8 | **DWG-3/D7 (fire hjørner, marg-korreksjon, `$INSUNITS`=m, sone-varsel) er ikke bygget**; STATUS-AKTUELT:177 «bindingen brutt» | `tegning-dwg-spec.md:6, :48, :59`; `STATUS-AKTUELT.md:167-177` |
| AT-G9 | **dxf-viewer (`feat/arbeidstegning-f1`, ikke på develop):** `render.py --register-world` gir bbox i **rå DXF-verdenskoordinater** (uavhengig av rotasjon/trim/viewBox); viseren er en harness utenfor git (`relay/arbeidstegning-prove/gate1/harness-v3.html`), kameraet roteres `R = overstyrt ?? autoRotasjon`, native tekst tilter med. **Åpent valg A/B/C hos Kenneth** (A behold kamerarotasjon, tekst tiltet · B ingen rotasjon, vegger skrå · C tegn all tekst selv, motrotert) | `a652254b`, `6717ba7b`; `relay/inbox-orkestrator.md:1218-1225` |
| AT-G10 | **De 13 filene:** 🟢 **I kartsystem (2):** Ålesund UTM32 (E 353 343 / N 6 929 907, m) og NTM6 (E 82 215 / N 1 498 216, m) — CRS bare fra **filnavnet**; uten det gir heuristikken `null` for NTM6 og **feil sone «utm33»** for UTM32-fila. **Lokalt nett (11):** fallplan (mm, 0–662 m, gitterdominert), HABU ×7 (mm, 0–45 m, Revit-prosjektbase; målt 12.10 på kopier), sykehus AB3/VB3/TB3 (mm, 139–204 m / 252–300 m, POINT-nett, felles ramme). **Ingen fil har `GEODATA`, fastpunkt-tekst, nordpil-blokk eller EPSG i tekst.** `$LATITUDE/$LONGITUDE` = **37.795/−122.394 (AutoCADs San Francisco-default)** på 4 filer, 0/0 på HABU, mangler på AC1018 → **må ignoreres uten `GEODATA`** (felle). `$NORTHDIRECTION` 0 der den finnes | `georef.py` 13.10 på `dwg2dxf -y`-DXF |
| AT-G11 | **Dalux (hjelpesider, lest 13.10 — uten innlogging; artiklene gir 403 ved direkte henting, lest via søkeutdrag):** kartsystem settes **pr. prosjekt** (EPSG-søk eller egen PROJ-streng); «Edit system setup» gir **X-offset, Y-offset, skala, rotasjon** på prosjektnivå; **DWG med innebygde koordinater plasseres automatisk og kan ikke flyttes**; tegninger uten koordinater «mappes manuelt mot modellen»; Revit-modell forankres i filens (0,0,0) → survey-koordinater går rett inn. Kenneths opplevelse (ett fastpunkt med kartsystem, riktig orientert) = kart-CRS + forskyvning, rotasjon 0 | support.dalux.com «How to set up Coordinate systems», «Upload and update drawings in Locations», «Revit Survey Point» |
| AT-G12 | **buildingSMART «User Guide for Geo-referencing in IFC» v2.0 (2020):** 2D Helmert (`Eastings, Northings, OrthogonalHeight, XAxisAbscissa, XAxisOrdinate, Scale`) i `IfcMapConversion` + `IfcProjectedCRS` (IFC4), i IFC2x3 som `ePSet_MapConversion`/`ePSet_ProjectedCRS` på `IfcProject`. Rotasjon er mot **rutenett-nord**, ikke sann/magnetisk nord. «Can be computed using two or more survey marks». Små tomter (≤ ~1 km²): én transformasjon holder. ⚠️ Veilederens formel `Rotation = atan2(XAxisAbscissa, XAxisOrdinate)` har **byttede argumenter**; IFC-skjemaet sier `atan2(XAxisOrdinate, XAxisAbscissa)` | veileder s. 8, 14–17; standards.buildingsmart.org IfcMapConversion |

| AT-G13 | 🟢 **IFC fra HABU (`E3 3D-modell ARK.ifc`, 4,8 MB, IFC2X3, Revit 25.4, CoordinationView 2.0 + QTO, header «CoordinateBase: Shared Coordinates»):** `IfcSite.ObjectPlacement` = **(654 052 282, 7 735 764 055, 55 080) mm med X-akse (0,488, −0,873)** → E 654 052,28 / N 7 735 764,06 (**EUREF89 UTM33**, Tromsø), høyde 55,08 m (= koten «+55.08 m» i snittet A-30-100), **rotasjon −60,78°** mot rutenett-nord (LoGeoRef 30). `RefLatitude/RefLongitude` 69,6865 / 18,9795 (LoGeoRef 20). **Ingen `IfcMapConversion`/`ePSet_MapConversion`** (0 treff, som ventet i IFC2x3). TrueNorth i kontekst = (0,1). Serverens `trekUtIfcMetadata` leser lat/long og etasjer, **ikke site-plasseringen eller rotasjonen** (`gpsHøyde: null`). 🟢 **DWG og IFC deler lokal ramme:** vegg 727574 i IFC, uttrykt i site-rammen, ender i (9 898, 20 186) mm; samme vegg i A-10-101 har bbox (9 823–9 980, 17 240–20 186) mm → **IFC-ens site-plassering georefererer alle sju HABU-DWG-ene direkte** (tilstand R med kjent vinkel). 🟢 **Revit element-id er felles:** `IfcWall.Tag = '727574'`, `IfcWallType.Tag = '341721'` = DWG-XDATA kode 1/kode 5; **87 av 317 DWG-ider finnes som IFC-Tag** (resten er akser/mål/tekst som ikke er IFC-elementer). 222 elementer med Tag, Psets (`Pset_WallCommon` 81, `Pset_WindowCommon` 44, `Pset_SpaceCommon` 7 …), 7 `IfcSpace` med romnummer+navn («137 Aktivitetssal») = DWG-romtekstene | STEP-grep + python 13.10; `ifcMetadata.ts` kjørt på fila |
| AT-G14 | **Punktsky `2513379 Gimlevegen 70 - UTM33 - 5mm.e57`** (3 472 449 536 B = **3,47 GB**, komplett; ASTM E57 1.0, Leica): **ett skann, 111 513 855 punkter**, felt XYZ (ScaledInteger, 0,01 mm) + intensitet + RGB + normaler. Punktene er lagret **lokalt** (bounds x −42,8…−11,7 m, y −16,9…14,1 m, z −4,6…3,5 m) med **pose i UTM33**: translasjon **E 654 114,05 / N 7 735 939,24 / H 56,83**, rotasjon quaternion → **yaw 35,1°**. Fotavtrykk i UTM33 (bounds + pose): E 654 071–654 114, N 7 735 901–7 735 944, H 52–60 m. `coordinateMetadata` tom (CRS bare i filnavnet). 🔴 **Skannet ligger ~160–180 m nord for IFC-bygget** (site-origo 654 052 / 7 735 764, vegg 727574 på 654 075 / 7 735 765): høyden stemmer (55 m), men fotavtrykkene overlapper ikke → Q11. **Server-kjeden:** `server.ts:108` multipart-grense **500 MB** → fila kan ikke lastes opp (7×); `PointCloud.fileSize Int?` tåler maks 2,15 GB (overflow); CloudCompare-kallet (`-SILENT -O … -C_EXPORT_FMT LAS -SAVE_CLOUDS`) sender **ingen `-GLOBAL_SHIFT`** → om pose anvendes og UTM33-offset bevares i LAS er **ikke målt**; Potree lastes bare i den gamle `/punktskyer`-siden uten offset mot IFC (`punktskyer/page.tsx:539`), `PointCloud.boundingBox/coordinateSystem` finnes | header + XML 13.10; `punktskyKonvertering.ts:54-62, :149-181`; `schema.prisma:1012-1029` |

**Konsekvens:** ett fastpunkt er umulig i dagens datamodell (AT-G3), CRS gjettes fra tallverdi (AT-G1), georef lagres i SVG-prosent som ikke overlever ny viewBox (AT-G2) mens arbeidstegning-motoren jobber i DXF-verdenskoordinater (AT-G9), og IFC-ens egen georeferanse leses ikke (AT-G6) — heller ikke site-plasseringen, som for HABU bærer hele georeferansen (AT-G13). F11 retter alle fire, og F11.3 går **begge veier**.

## 2. Brukerhistorier

**Fagarbeider (telefon, står på plassen):** «Jeg står i rom B7.06. Hvilket rør i taket er oksygen og hvilket er trykkluft, og hvilken dimensjon? Hvilken vegg er lettvegg, hvilken er betong?
Hvilken dør er det — størrelse? Hva er kotehøyden her? Jeg vil trykke på veggen og få svar, og legge inn avviket på akkurat
den veggen.» I dag: zoomer til streken blir en svart bjelke, gjetter ut fra form, og setter markøren på et punkt som ikke vet
hva det peker på.

**Bas/formann (telefon + PC):** «Vis meg bare rør-/sanitærlaget og veggene, resten av fagene forstyrrer. Finn rom 137. Hvor
mange meter er denne veggen? Hvilke oppgaver henger på dette rommet? Avviket jeg la på veggen i planen — vis det også i
snittet og på himlingsplanen.» I dag: ett bilde med alt, ingen filtrering, søk finnes ikke, måling snapper ikke til veggen,
og en markør lever bare på den ene tegningen.

**Prosjektleder (PC):** «Sju tegninger kom fra Interaxo. Nummer, navn, målestokk og dato står i tittelfeltet — ikke få meg
til å taste det sju ganger. Tegningen kom i ny revisjon: hva ligger av oppgaver og sjekklister på objekter som er endret?
Legg sjekklisten på rommet, ikke på et punkt.» I dag: alt tastes (T1 fyller bare ved entydig filnavn), og sjekklister med
posisjon vises ikke engang på tegningen (AT-M5).

**Hva en PDF gjør dårlig her:** en PDF er et utskriftsbilde. Ingen lag (eksport med PDF-lag er sjelden), ingen objektidentitet,
ingen attributter, strektykkelse låst til utskriftsmålestokk (tynn strek blir usynlig på telefon, tykk blir klump), ingen
enheter (krever kalibrering), søk bare om teksten er vektor. DWG bærer alt dette — hvis viseren bruker det. Gjør den ikke
det, er DWG **dårligere** enn PDF: like flatt, pluss konverteringsfeil (`tegning-dwg-spec.md` RETUR 1–6).

## 3. Funksjoner, prioritert, med akseptkriterier

Hvert kriterium kjøres på **fallplanen** (ARK, mm), **UTM32** (utomhus, m) og/eller **HABU A-10-101** (Revit-plan, mm).
«Telefon» = iPhone WebKit 390×844 (Kenneths telefon eller Playwright-WebKit-bevis som i C2). Kriterier merket **[A/B-prøve]**
er de Dokgens prøve måles mot.

### F1 — Trykk på objekt → egenskaper · **MÅ** (web + mobil)

- Trykk/klikk på en strek, flate eller tekst viser et egenskapskort. **Hele objektet markeres**, ikke bare streken: alle
  elementer med samme Revit element-id (AT-F6), ellers samme blokk-instans, ellers bare det trufne elementet.
- **Felt, i denne rekkefølgen, bare de som har verdi:**
  1. **Hva** — (rekkefølge og sikkerhet presisert i **§ 9.2**; ukjent → «Ukjent type», aldri rått lagnavn som type) Revit-kategori på norsk («Vegg», «Dør», «Vindu», «Himling», …) når XDATA finnes; ellers **lagets egen beskrivelse fra fila** når den finnes (AT-F14: «Innervegg IKKE bærende»); ellers tolket fra lagnavn: bygningsdel (NS 3451-kode + navn), objekttype (SOSI-kode + navn) eller IFC-kategori. Rå lagnavn alltid synlig under
  2. **Type/størrelse** — fra blokknavn (familie + type + størrelse: «Focus-ID Hel · 10×21 M») eller Revit type-id
  3. **Rom/blokk** — blokknavn + attributter (`ROOM_NAME`, `ROOM_NUMBER`, …) når objektet er, eller ligger i, en blokk; romtekst (navn/nummer/areal) når objektet er en romtagg
  4. **Materiale** — skravurmønster oversatt («Betong_strukturell» → Betong), rå navn under; Revit `FP_n` vises ikke (bare nummer, uten mening)
  5. **Tekst** — TEXT/MTEXT/ATTRIB-innhold; DIMENSION → måleverdi
  5b. **Merking i nærheten (tolket)** — for rør/kabel uten egen tekst: nærmeste TEXT på tegningens tekstlag innen én teksthøyde × 4, vist som «15.TR (nærmeste merking)» — alltid merket tolket, aldri som objektets egen verdi (AT-F10)
  6. **Mål** — lengde (strek) / areal (lukket flate) i tegningens enheter, **bare når `kanMale`** (`scaleKilde="dwg"`); ellers skjult, ikke «—»
  7. **Status** — «rives» når linjetypen er `Demolished`; «eksisterende»/«nytt» når lagnavnet bærer det («(Nye konstruksjoner)»)
  8. **Linjetype / pennebredde / farge** — bare når de avviker fra laget (ByLayer skjules)
  9. **Id** — Revit element-id (liten, kopierbar) når den finnes; brukes av F3/F5
- Kortet har én handling: **«Opprett her»** (→ F5), og en liste «Vises også i …» (→ F8) når element-id finnes i andre tegninger. Ingen redigering av egenskaper.
- Trefftoleranse: minst 12 px (web) / 20 px (telefon) rundt streken, uavhengig av zoom.
- **Akseptkriterier:**
  - A1 Fallplan, web: klikk på en vegg på laget «242- Ikke-bærende innervegger» → kortet viser «Ikke-bærende innervegger · 242» og rå lagnavn.
  - A2 Fallplan: trykk på romstemplet «LAB. 12» → `ROOM_NAME = LAB. 12`, `ROOM_NUMBER = 6V-18.03`.
  - A3 Fallplan: klikk i en skravert flate med `Gips` → Materiale «Gips»; med `Betong_strukturell` → «Betong».
  - A4 UTM32: klikk på en kum → «Kum · 8250»; på et lampepunkt → «Lampearmatur · 88».
  - A5 Fallplan, **telefon** **[A/B-prøve]**: A1–A3 gjentatt med trykk; svar innen 300 ms etter trykk.
  - A6 Negativ: klikk i tomrom → ingen kort, ingen feil.
  - A7 NTM6: klikk → «Diverse» + farge; **ingen** AEC-egenskaper (AT-F3) — dokumentert tap, ikke bug.
  - A8 HABU A-10-101: klikk på én strek i yttervegg 727699 → **alle 36 elementene** med den id-en markeres; kortet viser «Vegg · A23 Yttervegg · id 727699 · Vises også i 5 tegninger».
  - A9 HABU A-10-101: klikk på dørblokken «Focus-ID Hel - 10x21M…-710045» → «Dør · Focus-ID Hel · 10×21 M · id 710045».
  - A10 HABU A-82-101: klikk på en strek med linjetype `Demolished` → Status «rives».
  - A11 HABU A-10-101: klikk på målsetting → måleverdi (f.eks. «3 440 mm»); på romtekst «137» → «Rom 137 · Aktivitetssal · 56,8 m²».
  - A12 VB3-1074: trykk på en linje på V3411 → «Medisinsk gass · system 3411 · lag V3411 · linjetype CENTER» + «15.TR (nærmeste merking)» når teksten ligger innen grensen; linje uten tekst i nærheten → ingen merkingsfelt.
  - A13 TB3-1074: trykk på blokken `_E-0234B` → «Komponent · _E-0234B · LITT J76.2 · R/TV · antall 1 · lag E556»; på `ESYMB_30` → «PLH 3000».
  - A14 AB3-1071: klikk på en linje på A2412 → «Innervegg IKKE bærende · A2412» (beskrivelsen fra fila, ikke tolkning); på romkoden «7S-21.02» → «Rom 7S-21.02 · EKSP. (nærmeste merking)».
- **Objektidentitet:** hvert objekt skal kunne refereres stabilt: **Revit element-id når den finnes** (stabil på tvers av tegninger og revisjoner fra samme modell), ellers DXF-handle innen samme revisjon (AT-M9). Kreves av F3/F5/F8.

### F2 — Lag/fag av og på · **MÅ** (web + mobil)

- Lagpanel med to nivåer: **gruppe** → **rå lag** under (gjenkjenningsrekkefølge og «Ukjent (N lag)» i **§ 9.2**). Gruppe = Revit-kategori når XDATA finnes («Vegger», «Dører/vinduer», «Akser», «Målsetting», «Tekst», «Himlinger»); ellers lagets beskrivelse fra fila som visningsnavn (AT-F14) gruppert på NS 3451-prefiks; ellers tolket fra lagnavn: NS 3451-prefiks (2–3 siffer, med eller uten «A»-prefiks og «-»/«_»), AIA/IFC-prefiks (`A-`/`S-`/`P-`/`I-`/`Q-`), SOSI-kode (3–4 siffer + mellomrom), suffiks «(Skravur)»/«(Tekst)»/«(Nye konstruksjoner)». Lag uten treff → gruppe «Andre» med rå navn.
- Av/på pr. gruppe og pr. lag; «Bare dette»; «Alle på». Antall objekter pr. lag synlig.
- Oppsettet huskes pr. tegning på enheten (Q4 avgjør om det skal deles).
- **Akseptkriterier:**
  - B1 Fallplan: 55 lag i panelet, gruppert; slå av «242- Ikke-bærende innervegger» → de 258 + 169 (Skravur) elementene forsvinner; på igjen → tilbake. Måles ved telling av synlige elementer.
  - B2 Fallplan: «Bare dette» på «P-SANR-FIXT-OTLN» → bare sanitærutstyret (7 847 el.) vises.
  - B3 UTM32: slå av gruppe «Kummer og sluk» (8250/8253) → 99 elementer borte.
  - B4 **Telefon** **[A/B-prøve]**: B1 på fallplanen; bytte synlig innen 500 ms; pinch etterpå ≥ 30 fps (C2-målemetode).
  - B5 Lagvalget overlever bytte til annen tegning og tilbake (samme enhet).
  - B6 Markører (F5) følger ikke lag — de vises uansett.
  - B7 HABU A-10-101: gruppe «Vegger» (kategori −2000011) av → 325 elementer borte på tvers av lagene A23/A24/A85; lag «A82_akser» alene av → 29 borte.
  - B9 AB3-1071: panelet viser «Innervegg IKKE bærende (966)» og «Yttervegg bærende (142)» — beskrivelsene fra fila, rå navn under; slå av begge dør-lagene (A2433, A2333) → 171 borte.
  - B8 VB3-1074: «Bare dette» på V3411 → ett gassystem (265 el.) + tekstlaget valgfritt; slå av V3413 → 284 borte. Linjetypen (CENTER mot CENTERX2) er synlig forskjellig ved arbeidsnivå (F4).

### F3 — Søk etter objekt/system · **BØR** (web MÅ, mobil BØR)

- Ett søkefelt over tegningen: treffer **tekst** (TEXT/MTEXT/ATTRIB/måltekst), **blokknavn/attributter** (romnummer, dørtype), **lagnavn/kategori** og **element-id**. Treff listes med type; valg sentrerer og markerer objektet, lag slås på om det er av.
- **Akseptkriterier:**
  - C1 Fallplan: søk «6V-18.03» → ett treff (rom) → viseren sentrerer på romstemplet og fremhever det.
  - C2 Fallplan: søk «+42 080» → kote-teksten, sentrert.
  - C3 Fallplan: søk «sanitær» → lag «315- Utstyr for sanitærinstallasjoner» + «P-SANR-FIXT» som lagtreff.
  - C4 UTM32: søk «kum» → lagtreff 8250/8253 (ingen tekst i fila).
  - C5 Søk uten treff → «Ingen treff», ingen feil.
  - C7 AB3-1071: søk «7S-21.02» → romkoden sentrert; søk «MEDISIN» → romnavnet; søk «B3-773» → bruksnummeret.
  - C6 HABU A-10-101: søk «137» → rom Aktivitetssal; søk «10x21» → de 5 dørblokkene i størrelsen; søk «727699» → veggen.

### F4 — Detaljnivå ved zoom · **MÅ**

Dette er Kenneths kjernekrav: *«man skal se hva som skal utføres»*. Reglene (fra `tegning-dwg-spec.md` C1/C2) presiseres som krav, uavhengig av vei:

- **Oversikt (zoom ≤ 1):** alle konturer synlige; skravur og tekst under 3 px høyde kan utelates/forenkles for ytelse.
- **Arbeid (zoom 2–10):** skravurmønster skiller materialer (Gips ≠ Betong ≠ Lettklinker), dobbeltlinje i vegg er to linjer, tekst lesbar, linjetype (stiplet, `Demolished`) synlig som stiplet.
- **Detalj (zoom > 10):** ingen strek tykkere enn 4 px, ingen tynnere enn 0,5 px (gjeldende klem), ingen «svart klump» (RETUR 5 TILLEGG 2-saken).
- **Pennebredde fra fila (AT-F7):** når lag/entitet bærer lineweight, skal forholdet mellom tykk og tynn bevares gjennom dempingen (vegg lw 15 tegnes synlig tykkere enn akse lw 9 på alle zoomnivåer). Filer uten lineweight (fallplan) får dagens uniforme strek.
- Aldri vise en «enklere» tegning enn kilden ved arbeids-/detaljnivå. Hvis klienten laster mer detaljer ved zoom, skal det skje uten synlig hopp i posisjon (BACKLOG `:5932`).
- **Akseptkriterier:**
  - D1 Fallplan, telefon, 400 % på en gipsvegg ved betongvegg **[A/B-prøve]**: skravurene er forskjellige og veggens to konturlinjer er atskilte (bevisbilde som `relay/ezdxf-visning/`).
  - D2 Fallplan, 1 000 %: maks strekbredde ≤ 4 px, målt i DOM/canvas.
  - D3 Fallplan, telefon: pinch fra 100 % → 800 % → 100 %, ingen frame under 30 fps ved settle, ingen posisjonshopp > 2 px **[A/B-prøve]**.
  - D4 HABU A-82-101: `Demolished`-linjer vises stiplet ved arbeidsnivå; `Continuous` heltrukket. VB3-1074: CENTER, CENTERX2 og DASHEDX2 er tre synlig ulike mønstre, skalert med `$LTSCALE` (i dag tegnes alle heltrukne, AT-F13 — test som feiler).
  - D5 Fil-/minnebudsjett på telefon **[A/B-prøve]**: fallplanen med objektklikk (F1) og lag (F2) ≤ 3 s til første visning på 4G og ≤ 150 MB JS-heap. (C2 målte 9,3 MB/59 958 noder → 29 MB heap, pinch 7,7 fps for den ugrupperte SVG-en; det tallet er gulvet veien må slå.)
  - D6 HABU A-10-101, 100 % og 400 %: yttervegg (lw 15) måles ≥ 1,5× bredere enn akse (lw 9) på skjerm, og begge innenfor klemmen.

### F5 — Kobling til oppgave / sjekkliste / avvik fra et objekt · **MÅ** (oppgave, sjekkliste) · **BØR** (HMS/avvik)

- «Opprett her» på egenskapskortet (F1) oppretter oppgave (web+mobil), sjekkliste (web; mobil BØR) eller HMS-sak via dagens flyt (`opprettFraTegning.ts`), med **objektreferanse** i tillegg til posisjon: `{elementId?, handle, lag, kategori?, tekst/attributt, revisjon}`. Posisjon settes til objektets midtpunkt (strek: midt på; flate: sentroid; blokk: innsettingspunkt).
- Dokumentet viser referansen i klartekst («Vegg · A23 Yttervegg · id 727699 · rom 137»).
- Fra objektet: egenskapskortet lister dokumentene som peker på det (antall + åpne).
- **Sjekklister med posisjon vises på tegningen** (lukker AT-M5-hullet) med egen lagbryter, som oppgaver/kontrollpunkter i dag.
- **Ny revisjon:** referansen beholder `elementId`/`handle` + lag + tekst; hvis id-en ikke finnes i ny revisjon, vises markøren på lagret posisjon med merke «objekt ikke gjenfunnet i rev. X» — aldri slettet, aldri stille. Med Revit element-id gjenfinnes objektet normalt (samme modell → samme id); posisjonen flyttes da til objektets nye midtpunkt.
- **Akseptkriterier:**
  - E1 Fallplan, web: klikk vegg → «Opprett oppgave» → oppgaven har `drawingId`, posisjon på veggens midtpunkt og objektreferanse med lag «242- …». Test som feiler når referansen er tom.
  - E2 Samme på telefon for oppgave.
  - E3 Klikk på veggen igjen → kortet viser «1 oppgave» og åpner den.
  - E4 Sjekkliste opprettet med posisjon vises som markør på tegningen (web + mobil); test som feiler i dag (AT-M5).
  - E5 Ny revisjon av fallplanen lastes opp → eksisterende oppgave beholder posisjon; hvis handle finnes, følger den objektet; hvis ikke, merkes den. Test med en DXF der ett handle er fjernet.
  - E6 Objektreferanse er **tilleggsfelt**; dokumenter uten referanse (alle dagens) fungerer uendret.
  - E7 HABU: oppgave opprettet på vegg 727699 i A-10-101 → ny revisjon av A-10-101 (samme DXF, nye handles) → oppgaven følger veggen via element-id, uten merke.

### F6 — Måling og snap mot objekter · **BØR** (web) · **KAN** (mobil)

- Snap mot tegningsgeometri: endepunkt, midtpunkt, nærmeste punkt på strek, skjæring mellom to streker; tydelig snap-indikator; kan slås av (dagens bryter). Egne målepunkter + referanselinje snapper som i dag.
- Mål fra kortet (F1 felt 6) uten å tegne: strek → lengde; lukket polylinje/skravur → areal + omkrets; DIMENSION → fila sin måleverdi (AT-F9), ikke beregnet.
- **Akseptkriterier:**
  - G1 Fallplan (mm, `scaleKilde="dwg"`): linjal med snap mellom to vegg-endepunkter gir samme lengde som DXF-koordinatene (±0,5 % — `kanMale`-vei fra D5).
  - G2 Fallplan: areal fra kortet på en `862- M___Nettoareal`-polylinje = polylinjens beregnede areal (±0,5 %).
  - G3 Snap slått av → ingen snap mot geometri (negativkontroll).
  - G4 Snap i synlig utsnitt bare (dagens regel, `page.tsx:971-982`), ≤ 16 ms pr. musebevegelse på fallplanen.
  - G5 HABU A-10-101: linjal mellom de to endepunktene en DIMENSION måler → viserens tall = dimensjonens måleverdi (±0,5 %).
  - G6 VB3-1074 (enhetsløs): måling er sperret til kalibrering (D5); etter kalibrering mot ett kjent mål virker G1-snap; ingen stille mm-antagelse.

### F7 — Offline · **MÅ** (vise + lag + egenskaper) · **KAN** (søk, måling)

- «Forbered til offline» på en tegning laster ned **det viseren faktisk trenger** (visningsfil + lag-/objektinventar + markører) og viseren bruker den lokale kopien når nettet mangler (lukker BACKLOG `:57-59` og den tomme handleren `lokasjoner.tsx:477`).
- F1 og F2 virker offline på nedlastet tegning; F5 oppretter i offline-kø som i dag for oppgaver.
- **Akseptkriterier:**
  - H1 Telefon i flymodus etter «Forbered til offline»: fallplanen åpner, lag kan slås av/på, trykk på vegg gir kortet. Test som feiler når viseren henter fra nett.
  - H2 Ikke forberedt + flymodus → tydelig tilstand «Ikke tilgjengelig offline» (ikke brutt bilde, jf. D8).
  - H3 Oppgave opprettet offline fra objekt synkes med objektreferanse intakt.

### F8 — Samme objekt på tvers av tegninger · **BØR** (krever Revit element-id)

- Når tegningene i en byggeplass/serie kommer fra samme Revit-modell (AT-F6), er element-id felles. Kortet (F1) viser «Vises også i: Plan 2. etasje · Snitt · Fasader …» med hopp dit (objektet markert). Markører (F5) med `elementId` **vises i alle tegninger** som inneholder elementet, ikke bare der de ble satt. Snittpil-tekst («A-30-100», AT-F8) er klikkbar og åpner den tegningen når den finnes på byggeplassen.
- **Akseptkriterier:**
  - I1 HABU, alle sju lastet på samme byggeplass: klikk vegg 727699 i A-10-101 → «Vises også i» lister 5 tegninger; hopp til A-30-100 markerer de 24 elementene med id-en der.
  - I2 Oppgave på 727699 satt i A-10-101 → markør synlig i A-30-100 og A-88-101 på veggens posisjon der.
  - I3 Klikk «A-30-100» (snittpil) i A-10-101 → A-30-100 åpnes; mangler tegningen → tekst uten lenke.
  - I4 Fallplan (ingen element-id): kortet har ingen «Vises også i», ingen feil.

### F9 — Tittelfelt → tegningsmetadata · **BØR** (eier: serieopplasting-spec, føres der ved gate)

- For DWG med lesbar tittelfelt-tekst i paper space (AT-F8) forhåndsutfylles **tegningsnummer, navn, målestokk, dato og revisjon** ved opplasting (T1-regelen «kun ved entydig treff» gjelder: nummeret må matche kjent mønster og stå i tittelfeltet, ellers tomt). Kryssreferansen i `tegning-serieopplasting-spec.md:110` oppdateres.
- **Akseptkriterier:**
  - J1 HABU A-10-101: opplasting foreslår nummer «A-10-101», navn «Plan 1. etasje», målestokk 1:50, dato 2026-05-07; alle redigerbare.
  - J2 Fallplan (ingen tittelfelt-tekst i paper space): ingen forslag, feltene tomme som i dag.

### F10 — Underlag: fagtegning oppå arkitekttegningen · **BØR** (krever samme koordinatramme)

- En DWG som refererer en xref som mangler (AT-F12) viser tilstanden **«Underlag AB3-1071 mangler»** i stedet for rør i tomrom, og lar brukeren velge en tegning på samme byggeplass som underlag. Når to tegninger deler koordinatramme (samme xref-base, eller extents som overlapper ≥ 90 %), kan de **stables**: ARK nederst, VVS/EL over, hvert fag med egen av/på-bryter (F2 på tvers av filer). Markører (F5) settes på den tegningen brukeren ser øverst, men posisjonen er felles.
- Ingen automatisk henting av xref-filer fra kundens filserver; underlaget er alltid en tegning som alt er lastet opp.
- **Akseptkriterier:**
  - K1 VB3-1074 lastet opp uten AB3 på byggeplassen → tilstand «Underlag AB3-1071 mangler» synlig i viseren og i tegningslisten; rørene vises likevel.
  - K2 AB3-1071 + VB3 + TB3 på samme byggeplass → «Legg oppå» tilbys (felles ramme målt på desimalen, AT-F12); ARK nederst, VVS og EL over, hvert fag av/på for seg; rørene ligger i korridorene, ikke i tomrom. Bevisbilde web + telefon.
  - K3 VB3 + fallplanen (ulik ramme) → «Legg oppå» tilbys ikke, ingen feil.
  - K4 Oppgave satt i stablet visning har `drawingId` = tegningen den ble satt på, og vises på samme punkt når tegningen åpnes alene.

### F11 — Georeferanse fra DWG: kart-CRS, ett fastpunkt, to punkter, 2D→IFC · **BØR** (hjemmel Kenneth 2026-10-13; krav nå, bygging senere)

**Tre tilstander for en tegning, og hva som kreves for hver (F11.1):**

| Tilstand | Når | Hva gir georeferansen | Rotasjon | Skala |
|---|---|---|---|---|
| **K Kart** | koordinatene *er* kartkoordinater (Ålesund, AT-G10) | CRS + `$INSUNITS` — **ingen punkter trengs**, georef = identitet | 0 (tegningsakser = rutenett-akser) | fra enheter |
| **F Fastpunkt** (Dalux-modellen) | lokalt nett **parallelt** med rutenett-nord | **ett** punkt: tegningskoordinat (DXF-verden) ↔ E/N i oppgitt CRS (+ høyde NN2000 som etikett) → ren forskyvning | 0, **bekreftet eksplisitt** av brukeren («aksene peker mot rutenett-nord») | fra enheter |
| **R Rotert** | lokalt prosjektnett dreid mot kartnord (HABU, sykehus, fallplan — ukjent retning) | **to** punkter (Helmert: forskyvning + rotasjon, skala som kontroll), **eller** ett punkt + oppgitt vinkel mot rutenett-nord (nordpil/«rotasjon» som i Dalux «Edit system setup»). 3+ punkter: similaritet med minste kvadrat + **residual** (ikke affin — affin kan skjære, AT-G3) | beregnet / oppgitt | fra enheter; avvik > 0,5 % → varsel |

- **Når holder ett punkt?** Bare i K (ingen) og F (bekreftet retning). Ett punkt *uten* bekreftelse gir tilstanden «mangler retning», ikke en gjettet georef. Ett punkt er nok i Dalux fordi prosjektets kartsystem og rotasjon alt er satt (AT-G11); hos oss bærer tegningen det selv.
- **CRS kommer aldri fra tallheuristikk alene** (AT-G1): kilder i rekkefølge `GEODATA` (ingen av de 13 har det) → EPSG/NTM/UTM i filnavn → brukervalg i editor (NTM 5–30 og UTM må være valgbare, AT-G4). Tallene brukes bare til å *foreslå* («ser ut som UTM — velg sone»). `$LATITUDE/$LONGITUDE` ignoreres uten `GEODATA` (San Francisco-fella, AT-G10).
- **Høyde:** `OrthogonalHeight`/NN2000 lagres og vises som etikett på fastpunktet; ingen høydetransformasjon finnes (AT-G1) og loves ikke.

**Datamodell (F11.2):** `GeoReferanse` utvides, bakoverkompatibelt: `{ modell: "kart"|"fastpunkt"|"topunkt"|"flerpunkt", crs, enhetMm, fastpunkt?: { tegning:{x,y} i DXF-verdenskoordinater, kart:{east,north,hoyde?}, vinkelMotNord: 0 | tall, bekreftetAvBruker: boolean }, punkter?: [...], residualM? }` + **avledede** `point1/point2` i SVG-prosent for alt som leser dem i dag (web, mobil, geofence). Punkter lagres i **DXF-verdenskoordinater**, ikke SVG-prosent, så georef overlever ny revisjon/viewBox og passer motoren (AT-G9). `Drawing.coordinateSystem` beholdes som speil av `crs`.

**2D → IFC (F11.3), koordinatkobling, ikke objektkobling (R8.2):**
- Når IFC-modellen deler koordinatsystem med plantegningen (Revit «shared coordinates», bekreftet av brukeren: «modellen har samme origo og akser som tegningen»), avledes **IfcMapConversion-ekvivalenten** fra tegningens georef: `Eastings/Northings` = kart − (rotert) tegningsorigo, `XAxisAbscissa/XAxisOrdinate` = cos/sin(vinkel), `Scale` = enhetsfaktor, `OrthogonalHeight` = fastpunkthøyde eller 0. Den lagres som dagens `gpsOverride.transform {a,b,tx,tz}` (samme similaritet, AT-G7) med `kilde:"dwg-georef"`.
- **Prioritet for påstanden:** IFC-ens egen `IfcMapConversion`/`ePSet_MapConversion` (leses server-side i `ifcMetadata.ts`, i dag 0 treff AT-G6) **>** avledet fra DWG. En manuell justering (F11.9) er ikke en påstand, men en **overstyring** som alltid vinner over påstanden (F11.7). Kilden vises alltid. Rotasjon regnes `atan2(XAxisOrdinate, XAxisAbscissa)` (AT-G12-advarsel).
- Aldri auto: ulikt origo (IfcSite RefLat/Long > 50 m fra tegningens fastpunkt) → ingen kobling, tilstand «modell og tegning har ulikt origo», manuell kalibrering som i dag.
- **Motsatt vei, IFC → DWG (rev. 7, AT-G13):** en IFC med `IfcSite.ObjectPlacement` i kartkoordinater (Revit «shared coordinates», LoGeoRef 30) eller `IfcMapConversion` bærer **E/N/høyde + rotasjon**. Når DWG-ene fra samme modell ligger i samme lokale ramme (målt: vegg 727574 på millimeteren), får **alle** tegningene tilstand R med kjent vinkel fra IFC-en — uten ett eneste punkt fra brukeren. `ifcMetadata.ts` må da lese site-plasseringen (origo + X-akse), ikke bare lat/long. Kilde `"ifc-site"`; brukeren bekrefter «tegningene bruker modellens koordinater» én gang pr. byggeplass/serie. Prioritet for en DWG: egen K/F/R-georef satt av bruker > avledet fra IFC > ingen.

**Georef fra fil er en påstand, ikke fasit (F11.7, rev. 9):** alt F11 leser ut av en fil — DWG i kartsystem (K), `IfcSite`-plassering/`IfcMapConversion`, E57-pose — er en **påstand fra den som eksporterte fila**. HABU viser hvorfor: IFC-en sier E 654 052 / N 7 735 764, punktskyen sier eksisterende bygg ligger 140–185 m lenger nord, og Kenneth vet at punktskyen er rett (§ 5a Q11). Rev. 7 lot alle sju DWG-er arve IFC-ens georef — med feil IFC sprer feilen seg til alle tegningene uten at noen merker det. Derfor:
- **Kilden vises alltid**, på tegning, modell og punktsky: «Georeferert fra: IFC-site (Revit, 2026-06-05)» / «E57-pose (Leica)» / «DWG-koordinater (UTM32 fra filnavn)» / «fastpunkt (Kenneth, 13.10)» / «arvet fra IFC E3 …». Aldri bare en nordpil.
- **Alt kan overstyres** (F11.9), og overstyringen lagres **ved siden av** påstanden: `georef = { paastand: {kilde, verdi, lestTid}, overstyring?: {kilde:"manuell-mot-<fasit>", transform, punktpar[], av, tid}, arvetFra?: modellId }`. Effektiv georef = overstyring ?? påstand. Fila endres aldri.
- **Arv følger den effektive:** en DWG som arver fra IFC-en (F11.3 IFC→DWG) arver IFC-ens *effektive* georef. Rettes IFC-en, flytter alle sju tegningene seg med — og viseren sier «georeferansen er arvet fra E3 3D-modell ARK.ifc, justert 13.10». Arv kan brytes pr. tegning (egen K/F/R-georef).
- `gpsOverride` (AT-G7) har ingen `kilde` i dag; den blir `overstyring` i denne modellen, med kilde påkrevd.

**Konfliktregel (F11.8):** når to georefererte kilder på samme byggeplass er uenige utover en terskel, vises tilstanden **«georeferansene er uenige»** med avstanden og begge kildene. Ingenting velges stille.
- *Uenige* måles som avstand mellom det kildene sier skal sammenfalle: samme punkt angitt i begge (fastpunkt, hjørne), eller — uten felles punkt — nærmeste avstand mellom fotavtrykkene når kildene er **ment å ligge inntil hverandre** (tilbygg ↔ eksisterende bygg, tegning ↔ modell av samme bygg). Terskel **2 m** for samme bygg/inntil-hverandre; byggeplass-vid sjekk: fotavtrykk mer enn **50 m** fra alle andre kilder på byggeplassen → varsel «ligger alene».
- Brukeren velger **hvilken kilde som er fasit, pr. byggeplass** (`byggeplass.georefFasit = punktsky-id | ifc-id | tegning-id | "kart"`). Fasit-kilden får ikke overstyring; de andre justeres mot den (F11.9). Uten valg: varselet står, alle vises som de påstår, ingen auto-flytting.
- Varselet vises på tegningslista, i 3D-viseren og på mobil (tilstand, ikke toast), og forsvinner først når avstanden er under terskel eller brukeren har merket «avviket er riktig» (f.eks. to bygg som faktisk ikke skal møtes).

**Rette en feil georef ved å justere mot fasit (F11.9):** fra konfliktvarselet (eller tegningens/modellens georef-kort) velger brukeren «Juster mot <fasit>» og får én av to veier, begge lagret som overstyring med kilde «manuell mot <fasit>»:
1. **To punktpar:** klikk punkt A og B i kilden som skal flyttes (IFC i 3D, DWG i 2D), og samme A og B i fasit (punktsky i 3D, kart, eller georeferert tegning) → eksakt 2D-similaritet (forskyvning + rotasjon; skala vises som kontroll, låses til 1 med mindre brukeren slår den på). Samme matematikk som dagens `gpsOverride` to-punkts (AT-G7), nå med kilde og residual.
2. **«Plasser ved»:** ett punkt i kilden ↔ ett punkt i fasit → ren forskyvning, rotasjon beholdt fra påstanden (K/F-logikken fra F11.1; brukeren bekrefter at retningen er riktig).
- Høyde: justeres som egen forskyvning (Z) når fasit har høyde (punktsky-pose H 56,83, fastpunkt NN2000); ellers urørt.
- Overstyringen kan **fjernes** («tilbake til filas påstand») og **erstattes**; historikken beholdes (hvem, når, mot hva, residual). Ny revisjon/ny eksport av fila beholder overstyringen og varsler «fila har ny påstand — overstyringen er fra 13.10, sjekk». IFC-fila og DWG-fila endres aldri; Potree/SVG regenereres ikke — forskyvningen legges på i viseren og i `tegningTilGps`.

**Visning (F11.4):** en georeferert tegning (K/F/R) vises **nord opp** — dagens regel beholdes (AT-G5) og utvides fra «CRS funnet» til «georef finnes». **Nordpil MÅ vises** når georef finnes (i dag ingen). For arbeidstegning-motoren betyr det: **georefererte tegninger får ingen kamerarotasjon** (= valg B tvunget for K/F/R, uavhengig av Kenneths A/B/C-valg, AT-G9); `rotasjonOverstyrt` forblir en ren visningsrotasjon som nordpilen følger. For **ikke**-georefererte tegninger gjelder Kenneths rotasjonsvalg. Native tekst som tilter (valg A) er dermed bare et problem for lokalt-nett-tegninger uten georef.

**Forhold til DWG-3/D7 (F11.5):** D7 (fire hjørner fra extents, marg-korreksjon, `$INSUNITS`=m, sone-varsel) var en punktbasert omskriving av tilstand K. **F11 erstatter DWG-3:** for K lagres `modell:"kart"` + CRS + enhet, og hjørnepunktene **avledes** (eksakt, uten marg-feil) i stedet for å lagres. D7s sone-varsel beholdes som F11.1-regelen om CRS-kilde. DWG-3 bestilles ikke; F11-K er første byggeordre i georef-sporet, F11-F/R og F11.3 etter prøven (§ 6) fordi de trenger DXF-verdenskoordinater fra motoren.

**Punktsky som fjerde kilde (F11.6, rev. 8, AT-G14):** en E57 med `pose` i kartkoordinater er georeferert på samme måte som en IFC med site-plassering: pose = Eastings/Northings/høyde + rotasjon. Kjeden må (a) lese pose + bounds fra E57-XML-en ved opplasting (billig, uten å lese punkter) og lagre `coordinateSystem` + `boundingBox` i **kart**koordinater, (b) bevare UTM33-offset gjennom CloudCompare → LAS → Potree (`-GLOBAL_SHIFT` eksplisitt, LAS-offset verifisert), (c) plassere Potree-skyen i 3D-viseren med samme origo som IFC-en, og (d) heve opplastingsgrensen eller bruke chunket opplasting — 500 MB (AT-G14) stopper enhver 5 mm-sky. Tegning (K/F/R), IFC (site/MapConversion) og punktsky (pose) møtes da i **én** kartramme uten kalibrering.

**§ 8-kobling:** O1 `geometriRef` i DXF-verdenskoordinater + tegningens georef gir **objektets kartposisjon** (tolket, merket kilde) → F8 kan vise samme vegg i plan og i 3D via posisjon, aldri via id (R8.2); objektRef kan bære kartposisjonen som tilleggsfelt for GPS-markør på mobil.

**Akseptkriterier:**
- M1 Ålesund UTM32: opplasting → `modell:"kart"`, `crs:"utm32"`, rotasjon 0, nord opp, nordpil synlig; GPS under musepeker ved et hjørne = DXF-hjørnet konvertert (±0,5 m); måling mellom to punkter = DXF-avstand (±0,5 %) på web **og** mobil (ikke lenger ≥ 3-punkts-sperre for K).
- M2 Ålesund NTM6: samme med `ntm6`. **Negativkontroll:** fila omdøpt uten «NTM6» → ingen CRS satt, tilstand «ser ut som NTM — velg sone», aldri «utm33».
- M3 Sykehus AB3-1071 (lokalt nett): ett fastpunkt (tegningskoordinat + E/N i UTM33 + bekreftet «aksene = rutenett-nord») → `modell:"fastpunkt"`; `tegningTilGps` på et annet kjent punkt = regnet verdi (±0,1 m); mobil GPS-markør virker; VB3/TB3 stablet (F10) **arver** samme georef uten nye punkter.
- M4 HABU A-10-101 (lokalt, rotert): ett punkt uten bekreftelse → «mangler retning», ingen georef; ett punkt + vinkel 23° → OK, nordpil viser 23°; to punkter → vinkel beregnet og vist, skalaavvik vist; tre punkter → residual vist, > 0,5 m gir varsel; test som feiler når affin brukes (skjæring ≠ 0).
- M5 2D→IFC: IFC uten `IfcMapConversion` + tegning i F + «samme origo» bekreftet → `gpsOverride.transform` avledet, kilde «dwg-georef»; et 3D-objekt ved kjent punkt lander på kart ±0,5 m. IFC **med** `IfcMapConversion` → den vinner, kilde «ifc». Negativ: IfcSite 200 m unna → ingen auto, tilstand vist. (Krever en ekte IFC, Q10.)
- M6 Ny revisjon av AB3-1071 med annen viewBox → georef uendret (lagret i DXF-verden), markører på plass.
- M7 `$LATITUDE/$LONGITUDE` = 37.795/−122.394 uten `GEODATA` → ignorert; test som feiler om verdien brukes.
- M8 **HABU IFC → DWG:** opplasting av `E3 3D-modell ARK.ifc` gir `ifcMetadata` site-origo (654 052,28 / 7 735 764,06 / 55,08) + rotasjon −60,78° + crs utm33; bekreftet «tegningene bruker modellens koordinater» → alle sju A-tegningene får `modell:"rotert"`, kilde «ifc-site»; punktet (9 900, 20 186) mm i A-10-101 → E 654 074,7 / N 7 735 765,3 (±0,5 m); nordpil viser 60,78°; måling på mobil virker. Negativ: IFC uten site-plassering i kart (origo 0,0,0) → ingen avledning, tilstand vist.
- M10 **Punktsky:** opplasting av `…UTM33 - 5mm.e57` (3,47 GB) → `boundingBox` i UTM33 = E 654 071–654 114 / N 7 735 901–7 735 944 / H 52–60 (±0,1 m, fra pose + bounds, før konvertering); etter konvertering lander et punkt ved skannerposisjonen på E 654 114,05 / N 7 735 939,24 i 3D-viseren med IFC-en i samme ramme (±0,1 m); `fileSize` lagres riktig (> 2,15 GB). Negativ: E57 uten pose → `coordinateSystem` null, tilstand «ikke georeferert».
- M11 **Konfliktvarsel (F11.8), ekte filer:** HABU-IFC (`E3 3D-modell ARK.ifc`) + punktsky (`…UTM33 - 5mm.e57`) på samme byggeplass, begge med georef fra fil → tilstand «georeferansene er uenige» med **ca. 160 m** (nærmeste fotavtrykk-avstand 136 m, origo-til-skanner 185 m — tallet som vises er fotavtrykk-avstanden, med begge kilder navngitt). Ingen av dem flyttes. Test som feiler når avstanden ikke vises eller en kilde velges stille.
- M12 **Fasit + justering (F11.9):** Kenneth velger punktskyen som fasit for byggeplassen; «Juster IFC mot punktsky» med to punktpar (hjørner på eksisterende bygg som finnes i begge) → IFC-en får overstyring kilde «manuell mot punktsky», **tilbygget ligger inntil eksisterende bygg der delen som skal rives er** (visuell fasit: bevisbilde 3D med punktsky + IFC; avstand mellom tilbyggets tilkoblingsvegg og skannet vegg < 0,2 m). IFC-fila er byte-identisk før og etter.
- M13 **Arv følger rettingen:** de sju HABU-DWG-ene som arvet IFC-georef (M8) flytter seg med justeringen uten ny handling; kortet viser «arvet fra E3 …, justert 13.10»; A-10-101-punktet (9 900, 20 186) mm lander nå på det justerte stedet (±0,2 m mot punktskyen).
- M14 **Kilde synlig:** hver av de tre (IFC, punktsky, A-10-101) viser «Georeferert fra: …» med kilde og tid på web og mobil; test som feiler når kilde mangler.
- M15 **Negativ/tilbake:** to kilder 1,5 m fra hverandre → ingen varsel (under terskel); «fjern overstyring» → IFC tilbake til filas påstand, varselet kommer tilbake med 160 m; «avviket er riktig» → varselet borte uten flytting.
- M9 **DWG ↔ IFC via Revit-id (R8.2-unntaket):** vegg 727574 klikket i A-10-101 → «Vises også i 3D-modellen»; samme vegg i 3D → oppgave satt i 2D vises; IfcWindow uten DWG-treff → ingen lenke; GlobalId og Revit-id vises begge.

### Prioritert rekkefølge (anbefaling)

F1 → F2 → F4 (ytelsesgaten) → F5 → F7 → F8 → F10 → F3 → F9 → F6. **Georef-sporet parallelt:** F11-K (erstatter DWG-3) når som helst; F11-F/R og F11.3 etter prøven. F1/F2/F4 er **én** prøve hos Dokgen (A mot B) fordi de deler
samme grunnspørsmål: kan telefonen bære objektidentitet og lag på fallplanen med ≥ 30 fps? Først når den er målt, bestilles
bygging. F8 og F9 er små når F1/F5 finnes (element-id ligger alt i objektreferansen; tittelfeltet er tekst i Layout1). F10 er den som gjør MEP-tegningene brukbare i det hele tatt (AT-F12).

## 4. Avgrensning — ikke med

- **Redigering av tegningen** (flytte/slette/tegne CAD-objekter, endre lagstruktur, lagre tilbake til DWG).
- Redigering av egenskaper (kortet er lesning).
- **AEC-egenskapssett / proxy-objekter** (AT-F3): tapt i libredwg; ikke forsøkt gjenopprettet. **Revit type-parametre** (brannklasse, U-verdi …) ligger ikke i DWG-eksporten — bare type-id; de er IFC-/BIM-spor, ikke dette.
- **Henting av xref-filer** fra kundens filserver/Interaxo (F10 bruker bare opplastede tegninger). Rør-til-tekst-kobling som *data* (bare geometrisk tolkning, F1 felt 5b).
- Paper space / layouts: følger `tegning-dwg-spec.md` D6 (klippet under hovedtegningen); F1–F8 gjelder modelspace. F9 leser bare tekst fra Layout1.
- 3D/IFC, punktsky, PDF-tegninger (PDF beholder dagens bilde-vei med kalibrering; F1–F3/F8 gjelder ikke PDF).
- Tegningsserie (T2) — eget spor. Georeferanse er nå F11 (erstatter DWG-3/D7). **Ikke med i F11:** høydetransformasjon (NN2000 bare etikett), NTM 21–30/andre land, automatisk henting av fastpunkt fra kartverket, geoid.
- Sammenligning av revisjoner (visuell diff) — KAN senere; F5 E5/E7 dekker bare at markører overlever.
- Lagring av målinger (AT-M4) — uendret, ikke i denne spec-en.

## 5. Åpne spørsmål til Kenneth (med anbefaling)

| # | Spørsmål | Anbefaling |
|---|---|---|
| Q1 | MEP er målt på to eldre AutoCAD-tegninger (AT-F10–F13): system i lag + linjetype, dimensjon som løs tekst, ingen objektdata. En **Revit/MagiCAD-MEP-eksport** (RIV/RIE på HABU) ville vise om rør bærer kategori/type som veggene gjør. Kan du be om én? | **Ønskelig, ikke blokkerende.** Spec-en dekker nå begge virkelighetene: moderne eksport (AT-F6) og eldre filer (AT-F10). Mange sykehus-/forvaltningstegninger er av den eldre typen |
| Q2 | Lagpanel: tolkede **grupper med rå lag under** (anbefalt), eller bare rå lagnavn (55 på fallplanen)? | **Grupper + rå under.** Revit-kategori når den finnes, ellers lagnavn-tolkning. Rå navn alltid synlig så ingenting skjules |
| Q3 | **Sjekklister med posisjon på tegningen** (vises ikke i dag, AT-M5) — ta det inn i F5 som MÅ? | **Ja.** Det er et hull, ikke et valg; samme lagbryter som oppgaver |
| Q4 | Lag-oppsett: **pr. bruker på enheten** (anbefalt) eller **delt pr. tegning** for hele prosjektet? | **Pr. bruker først** (ingen schema, ingen konflikt). Delt «standardvisning» pr. tegning som KAN etterpå |
| Q5 | Objektklikk på **mobil** er MÅ i § 3. Det kan koste større nedlasting/minne enn dagens fargegrupperte variant (AT-M7). Står MÅ, med D5-budsjettet som gate? | **Ja, MÅ.** Fagarbeideren står med telefonen. D5 (≤ 3 s, ≤ 150 MB, ≥ 30 fps) er gaten; klarer ingen vei det på fallplanen, meldes det tilbake med tall før nedprioritering |
| Q6 | Offline F7: holder **vise + lag + egenskaper** (MÅ) og søk/måling KAN? | **Ja.** Måling offline krever enheter som alt ligger i tegningen, så den kan komme gratis med vei B — men ikke lov det nå |
| Q7 | **HABU-filene i repoet?** (flyttet bort fra prosjektmappa 12.10 — spørsmålet gjelder om de kan hentes tilbake som fixtures) De er tilbudsunderlag for et navngitt prosjekt (UNN, AART, adresse, gnr/bnr) — ikke våre data. Fixtures i `apps/api/test-fixtures/dwg/` ligger i git og på GitHub | **Nei, ikke uten skriftlig OK fra eier.** Behold dem lokalt i `DWG eksempelfiler/HABU/` (untracked); tester på dem **skippes når mappa mangler** (samme mønster som «krever dwg2dxf + ezdxf»). Dokgens prøve kjører lokalt på dem. Alternativ: be AART om lov, eller lag én anonymisert Revit-eksport selv (ikke generert — ekte Revit-modell) |
| Q9 | **Ett fastpunkt uten nordpil (F11.1 F):** skal brukeren kunne bekrefte «aksene peker mot rutenett-nord» og få georef fra ett punkt (Dalux-modellen), eller kreve to punkter alltid? | **Tillat ett punkt med eksplisitt bekreftelse**, og vis nordpil + GPS-markør straks så en feil retning ses med én gang. To punkter forblir anbefalt vei for roterte nett |
| Q10 | ~~Ingen IFC-fil finnes lokalt~~ 🟢 **Besvart 13.10:** Kenneth la `E3 3D-modell ARK.ifc` (HABU, shared coordinates) + punktsky i eksempelmappa (AT-G13–G14). IFC-en bærer georef via site-plassering, ikke `IfcMapConversion`; M5/M8 kan måles. Samme Q7-regel: ikke i git |
| Q11 | **Punktskyen og IFC-en overlapper ikke** (AT-G14): skannet dekker 43 × 31 m rundt E 654 092 / N 7 735 922, IFC-tilbygget ligger ved E 654 052–654 075 / N 7 735 764. Er skannet av et annet bygg/område på Gimlevegen 70, eller er en av georeferansene feil (Revit shared coordinates, eller skannerens pose)? | **Avklar før M10 brukes som fasit.** Høyden stemmer (55–57 m), så kartsystemet er trolig riktig for begge; mest sannsynlig dekker skannet eksisterende bygg (riveplan A-82) og ikke tilbygget. Hvis du har et punkt du vet er felles (f.eks. et hjørne), sier det alt |
| Q12 | ~~Prosjektadmin foreslår koblinger til firma-admin?~~ 🟢 **Besvart 18.10 (Kenneth):** koblingen gjelder en tegning i et prosjekt — det skal ikke firma-admin ta stilling til → prosjektadmin kobler direkte (prosjektkobling), firma-admin kan løfte til firmanivå. Ingen forslagsflyt | — |
| Q13 | **Anvendelse på eksisterende tegninger:** koblinger anvendes **ved lesing** av registeret (gjelder alle tegninger straks, ingen rekonvertering) — eller ved rekonvertering (kø, maks 2 samtidig)? | **Ved lesing.** Ingen kø, ingen ventetid, gamle tegninger følger med, render.py røres ikke. Rekonvertering bare når kodens typeliste endres |
| Q14 | **Typelista** (kategorier/materialer) er SiteDocs faste liste; firma kan ikke lage egne typer. Holder det, eller trenger firma egne typer («Fjernvarme-rør»)? | **Fast liste først.** Forhåndsdefinerte valg slår fritekst (CLAUDE.md); mangler en type, utvides lista i kode etter ønske. Egne firmatyper = KAN senere, krever egen O1-adapter |
| Q15 | **Veggtype (§ 9.7 K6.3 pkt. 2–3):** prosjektadmin registrerer veggtyper (kode, navn, lag med materiale og tykkelse) på prosjekt/firma og kobler Revit type-id eller merking («IV1») til dem — ny flate. IFC-veien (pkt. 1) og geometri-stabelen (pkt. 4) trenger ingen hjemmel. | **Ja til begge, men bygg pkt. 1 + 4 først (GJ-3):** de svarer på fallplanen og HABU uten ny UI; tabellen (GJ-4) er først nyttig når en fil med merking kommer (AT-V1). |
| Q8 | **Underlag (F10):** skal SiteDoc kunne legge VVS/EL-tegningen oppå ARK-tegningen når de deler koordinatramme, eller holder det å vise tilstanden «underlag mangler»? TB3/VB3 er ubrukelige alene (rør i tomrom) | **Ja, F10 som BØR rett etter F8.** Det er slik fagarbeideren leser et tegningssett; og rammen er alt felles i filene (AT-F12). Samme spørsmål gjelder AB3/VB3/TB3 i repoet som fixtures (eier?) — anbefaler samme regel som Q7 |

### 5a. Kenneth-svar 2026-10-12 — 🟢 alle åtte

| # | Svar |
|---|---|
| Q1 | Har ikke riktige MEP-eksporter nå, kan komme senere. Prøven går uten; måles når de finnes |
| Q2 | Som anbefalt: grupper + rå lag under |
| Q3 | Som anbefalt: MÅ (Kenneth spurte hva MÅ betyr: med i første leveranse av F5, kan ikke droppes uten nytt vedtak) |
| Q4 | Som anbefalt: pr. bruker på enheten først |
| Q5 | MÅ står. Kenneth spurte om konsekvens og realiserbarhet → prøven får en **tredje variant A2: lett, farge-gruppert visning + separat romlig objektindeks** (bbox/id pr. objekt, oppslag ved trykk) i tillegg til A (ugruppert SVG m/ id) og B (klient-render). D5 avgjør på tall |
| Q6 | Som anbefalt |
| Q7 | HABU-filene er fjernet fra prosjektmappa; en agent kan få se dem ved behov (Kenneth gir tilgang). Aldri i git |
| Q8 | Som anbefalt: F10 BØR rett etter F8; sykehusfilene samme regel som Q7 |
| Q9 | 🟢 2026-10-13: **Ja**, ett fastpunkt med eksplisitt bekreftelse av at aksene peker mot rutenett-nord; nordpil + GPS-markør vises straks |
| Q10 | 🟢 2026-10-13: IFC (`E3 3D-modell ARK.ifc`, HABU) + punktsky lagt i eksempelmappa (ikke i git) |
| Q11 | 🟢 2026-10-13: **Annet bygg.** Punktskyen er eksisterende bygg; IFC er tilbygget som skal kobles til det; en del av det skannede bygget skal rives for tilkoblingen. ⚠️ **Avvik å måle:** da skal de to ligge inntil hverandre, men målt avstand er ~160 m (AT-G14). Én av georeferansene er trolig feil, eller E57-posen er lokal → M10 kan ikke brukes som fasit før avviket er forklart. **Kenneth 2026-10-13:** *«jeg tror IFC er feil georeferert … punktskyen stoler jeg 100 % at er rett»* → punktskyen er fasit (M10 gyldig), IFC-ens site-plassering regnes som feil |
| D5-budsjett | 🟢 2026-10-13 (Kenneth «1 og 2»): **store tegninger** (fallplan 22 MB DXF) får et eget førstegangsbudsjett på ~3–6 s **med fremdriftsindikator**, og åpnes deretter fra cache/offline-kopi. ≤ 3 s gjelder fortsatt vanlige tegninger. Samtidig spike 0,5b: forenklet DXF (fjerne XDATA/ubrukte blokker/metadata viseren ikke trenger) — løser den budsjettet, bortfaller unntaket. **RETUR 4 (2026-10-14, `DxfViewerTegning.tsx`):** klient-cache (`tegningFilCache.ts`, Cache Storage, nøkkel = usignert `/uploads/`-sti, LRU 200 MB, tømmes ved utlogging) + fremdrift (MB/%) implementert — gjenåpning skal treffe cache og ta < 1 s. Rotårsak til ustabil fokusbytte funnet og rettet: `signerUploadsOutput`-middlewaren (hmac.ts) minter ny HMAC-signatur pr. `tegning.hentMedId`-kall (inkl. bakgrunnsrefetch ved vindu-fokus), og effektens avhengigheter leste tidligere den signerte strengen — reload ved hver refetch. Nøkkel nå den usignerte stien. Komprimering: `/api/uploads/*` var helt ukomprimert (målt 15,9 MB transfer = 15,9 MB dekodet) — `@fastify/compress` (br/gzip) lagt til i `apps/api/src/server.ts`. ⚠️ Ikke verifisert på test ennå (krever levende nettleser-sesjon). **Worker-bunt (orkestrator 2026-10-15, «worker-bunt med esbuild, GODKJENT»):** DXF-parsingen (`_FetchFonts`/`DxfScene.Build`) flyttet til egen tråd via `dxf-viewer`s `workerFactory` — en FRITTSTÅENDE bunt bygget av `apps/web/scripts/build-dxf-worker.mjs` (esbuild, devDependency, **lisens MIT**) FØR `next dev`/`build`/`typecheck`, aldri Next sin egen webpack-worker-bundling (den native veien ga en manglende-chunk-defekt i en kald build, se forrige sjekkpunkt). Output: innholds-hashet statisk fil i `public/workers/` + `manifest.json` som klienten leser (`hentDxfWorkerFactory()`). Feiler worker-lastingen (404/CSP) faller `DxfViewerTegning.tsx` tilbake til hovedtråden med en konsollmelding — **målt** (headless, samme fallplan.dxf): `Load()` rejecter etter 84 ms, retry på samme viewer fullfører på 2,4 s, ingen blank flate. **Hovedtråd-blokk** under selve lastingen: uten worker 304 ms (over 200 ms-målet), med worker 46,8 ms — lastetid praktisk talt uendret (hovedtråd 2420 ms vs worker 2433 ms). dxf-viewer selv er MPL-2.0 (uendret, allerede notert i harness-overlegget). |
| Q12 | 🟢 2026-10-18: **Prosjektadmin kobler direkte i prosjektet, uten firma-admin.** «Snakker vi ikke om koblinger i en tegning i et prosjekt? → det skal ikke firmaadmin ta stilling til.» → to nivåer (prosjekt > firma), løft til firma er firma-admins valg |
| Q13 | 🟢 2026-10-18: ok — anvend ved lesing, ikke rekonvertering |
| Q14 | 🟢 2026-10-18: ok — fast typeliste først |
| Q15 | 🟡 2026-10-22: ikke besvart (GJ-4 venter) |
| Rotasjon | 🟢 2026-10-13: **B** — ikke-georefererte DWG vises som tegnet i arbeidstegning-motoren (ingen automatisk kamerarotasjon); brukerens ⟳ beholdes. Georefererte: nord opp (F11.4). **Presisert 2026-10-13:** *«I utgangspunktet er tegninger laget med tekst og rotasjon i korrekt retning og trenger ikke ekstra rotasjon»* → visning som tegnet er standard; ⟳ er en sjelden brukerhandling; **valg C (egen motrotert tekst) bygges ikke** |

## 6. Hva Dokgens prøve må levere (gate for valg A/B — ikke bygging)

Én prøve, begge veier om mulig, på **fallplanen**, **UTM32**, **HABU A-10-101** og **sykehus-settet AB3+VB3+TB3** (linjetyper, stabling K2, enhetsløs), på web (Chromium) og telefon (WebKit,
390×844): tallene for A5, A8, A12, A14, B4, B8, D1, D3, D4, D5, D6, K2 i § 3 + filstørrelse pr. tegning + hvor objektidentitet (element-id/handle),
XDATA og laginventar bor i hver vei. Rapport som tabell, samme form som C2-tabellen i `tegning-dwg-spec.md`. Prøven må i tillegg vise at kortet i vei A/B kan ta et O1-objekt fra IFC-viseren (§ 8 L1) — ellers er veien for smal. Og at motoren eksponerer DXF-verdenskoordinater for klikkpunkt og objekter (F11.2/M3 trenger dem). HABU-IFC-en (AT-G13) brukes som IFC-objekt i L1 og som georef-kilde i M8. Valget tas av
orkestrator/Kenneth på tallene; deretter bestilles F1/F2/F4 som første byggeordre. Ingen kode merges fra prøven.

## 7. Tester som skal FEILE i dag (DoD, uavhengig av vei)

1. SVG/klient-modell bærer stabil objekt-id pr. element (AT-M9) — fallplan: antall ider = antall tegnede entiteter; HABU: element-id fra XDATA på 100 % av entitetene.
2. Laginventar finnes pr. tegning (navn, antall, gruppe) — fallplan: 55 lag, UTM32: 29, HABU A-10-101: 14.
3. Egenskapskort for rom «LAB. 12» gir `ROOM_NUMBER = 6V-18.03` (A2); for vegg 727699 gir «Vegg» + id + 36 elementer (A8).
4. Skravurmønster → materiale: `Gips` → «Gips», ukjent mønster → rå navn, `FP_n` → skjult (A3).
5. Lag av → elementer usynlige, på → tilbake (B1); kategori «Vegger» av → 325 borte på tvers av lag (B7).
6. Oppgave opprettet fra objekt har ikke-tom objektreferanse (E1); eksisterende oppgaver uten referanse uendret (E6).
7. Sjekkliste med posisjon rendres som markør (E4).
8. Revisjon uten handle → markør merket, ikke slettet (E5); revisjon med samme element-id → følger objektet (E7).
9. Snap mot endepunkt gir DXF-koordinaten (G1); snap av → ingen (G3); linjal = DIMENSION-verdi (G5).
10. Offline: viseren leser lokal kopi når nett mangler (H1); ikke forberedt → tilstand, ikke brutt bilde (H2).
11. Strek ≤ 4 px ved 1 000 % (D2) — finnes delvis (`strek-skalering.test.ts`), utvides til DOM-måling; lw 15 ≥ 1,5× lw 9 (D6).
12. Element-id felles på tvers av tegninger → «Vises også i» + markør i alle (I1, I2); fallplan → ingen (I4).
13. Tittelfelt i Layout1 → nummer/navn/målestokk/dato foreslått (J1); fallplan → tomt (J2).
14. HABU-/MEP-tester skippes rent når filene mangler lokalt (Q7/Q8) — aldri rød i CI.
15. Xref som mangler → tilstand «Underlag … mangler» i konverteringsrapporten og viseren (K1); i dag: stille tomrom.
16. Linjetyper CENTER/CENTERX2/DASHEDX2 tegnes som tre ulike mønstre (D4); i dag heltrukne.
17. «Nærmeste merking» på VB3 gir «15.TR» for røret ved teksten og **ingenting** for et rør uten tekst innen grensen (A12) — tolkningen må feile rent.
18. Lagbeskrivelse fra fila (AT-F14) brukes som visningsnavn når den finnes (A14/B9); i dag leses den ikke (0 treff `description` i `render.py`/`dwgKonvertering.ts`).
19. Fullstendighet AB3-1071: antall LINE/TEXT/INSERT i DXF-en = antall i `dwgread` (libredwg 97 dekodefeil, AT-F14) — og TrueView-fasit side om side.
20. Én egenskapskort-komponent for tre kilder (L1); i dag to kopier av `EgenskapsPopup` og ingen i 2D.
21. IFC: kategori-panel før klikk (L2); oppgave fra IfcWall med `objektRef` som overlever gjenåpning (L3); fragment-cache med egenskaper (L4); 2D↔IFC ingen auto-id (L5).
22. Kart-tegning (UTM32) får georef uten punkter og måling på mobil med 2 avledede punkter (M1); UTM32-fil uten filnavn-hint gir aldri «utm33» (M2).
23. Ett fastpunkt + bekreftet retning gir gyldig georef (M3); ett punkt uten bekreftelse gir ikke (M4) — i dag er ett punkt umulig i typen.
24. 3+ punkter løses som similaritet med residual, ikke affin (M4).
25. `ifcMetadata` leser `IfcMapConversion`/`ePSet_MapConversion` og den vinner over avledet transform (M5); `$LATITUDE` ignoreres uten `GEODATA` (M7).
26. Georef lagret i DXF-verdenskoordinater overlever ny viewBox (M6); nordpil rendres når georef finnes (M1).
27. `ifcMetadata` leser `IfcSite.ObjectPlacement` (origo + X-akse) og gir E/N/høyde/rotasjon for HABU-IFC-en (M8) — i dag `gpsHøyde: null`, ingen rotasjon.
28. DWG-XDATA kode 1 = IFC `Tag` gir `objektRef.kilde:"revit-id"` på 87 HABU-elementer; ArchiCAD-fallplan + IFC uten Tag gir ingen (M9, negativkontroll).
29. E57-pose leses til `coordinateSystem`/`boundingBox` i kartkoordinater uten å lese punktene (M10); i dag leses ingenting av E57-XML-en.
30. 3,47 GB e57 kan lastes opp og `fileSize` lagres (M10); i dag 500 MB-grense og `Int?`.
31. LAS etter CloudCompare bærer UTM33-offset (pose anvendt, `-GLOBAL_SHIFT` eksplisitt) — test mot skannerposisjonen (M10); i dag ikke målt.
32. Georef lagres som `{paastand, overstyring?, arvetFra?}` med kilde; effektiv = overstyring ?? påstand (M12, M14); i dag `gpsOverride` uten kilde og `geoReference` uten opphav.
33. To kilder på samme byggeplass > 2 m fra hverandre (ment inntil) gir tilstand med avstand; HABU-IFC + punktsky → ~160 m (M11); 1,5 m → ingen (M15).
34. Justering med to punktpar mot fasit lagres som overstyring kilde «manuell mot punktsky», fila uendret (sha256 før/etter), arvede DWG-er følger (M12, M13).
35. «Fjern overstyring» gjenoppretter påstanden og varselet (M15).
36. Objekt på lag uten kjent kode/beskrivelse/Revit får `kategori: null` + «Ukjent type» i kortet og «Ukjent (N lag)» i panelet (K1, K5); i dag vises rått lagnavn som type.
37. `kategoriKilde`/`sikkerhet` finnes på hvert objekt i O1 og vises i kortet (§ 9.2).
38. Dør-INSERT uten WIDTH/BREDDE og uten størrelse i blokknavn viser ingen bredde (K9); i dag lengste segment.
39. Prosjektkobling `Skrålinjer_2 → isolasjon` slår inn på fallplanens 51 HATCH-objekter **uten rekonvertering**, bare i prosjektet, også i et frittstående prosjekt uten firma; etter løft bare i samme `organizationId` (K2, K4) — stille-tomhet-vakten; vanlig medlem får FORBIDDEN (K8).
44. Isolasjonsbånd med to parallelle lange kanter viser tykkelse «målt fra geometri» (100 mm ± 2 på fallplanen); uregelmessig skravert flate viser ingen (K9).
40. `konverteringRapport.gjenkjenning` finnes med andel/kilder/ukjente lag og mønstre (K7); i dag bare pr. entitetstype.
41. AutoCAD-standardmønster `INSUL` → materiale isolasjon uten firmakobling (§ 9.2 pri 7); i dag `materialeRaa`.
42. Korpus-manifest: test pr. fil som finnes lokalt, skip ellers; forventet kategori for «231- Bærende yttervegger» = vegg på fallplanen (§ 9.6).
43. Revit-kategori vinner over kobling på kategori, kobling gjelder materiale på Revit-tegning (K3); prosjektkobling vinner over firmakobling (K8); konflikt listes i rapporten.

## 8. Felles objektmodell på tvers av 2D, IFC/3D og mobil · **MÅ** (Kenneth 2026-10-12 «ja»)

**Prinsipp:** fire ting er like uansett kilde og bygges **én gang** i `packages/shared`, med tynne adaptere pr. kilde. Renderne forblir
separate: 2D-viseren skal **ikke** avhenge av three/web-ifc/wasm (tunge, mobil kjører dem bare i WebView, 3D-pan er alt treg — AT-I8).
Felles er modellen og komponentene, ikke renderen.

| Del | Innhold | Kilder (adaptere) | Bruk |
|---|---|---|---|
| **O1 Objektmodell** | `{ kilde, id, kategori, type?, navn?, egenskaper: [{gruppe, nøkkel, verdi, enhet?, tolket?}], geometriRef, tegningId/modellId, revisjon }` | IFC: `GlobalId` + IFC-type + Psets/mengder/materialer (AT-I2) · Revit-DWG: element-id + kategori + type-id + blokknavn (AT-F6/F9) · lag-DWG: handle + lagbeskrivelse/lagnavn-tolkning + nærmeste merking (AT-F10/F14) · PDF: ingen objekter (kortet vises ikke) | F1, F3, F5, F8, 3D-kort |
| **O2 Egenskapskort** | Én komponent, web + mobil-WebView; viser O1 i F1-rekkefølgen; handlinger «Opprett her», «Vises også i», øye (skjul kategori/lag) | 3D-kortet (`EgenskapsPopup`) er malen; begge kopier erstattes | F1 (2D), 3D-visning, mobil-viewer, mobil tegning |
| **O3 Lag-/kategoripanel** | gruppe → lag/type, av/på, «bare dette», «alle på», antall; husket pr. tegning/modell på enheten (Q4) | 2D: lag (F2) · IFC: IFC-type / lag / system / etasje (AT-I3 får forhåndslisten den mangler) | F2, 3D-visning, mobil |
| **O4 Objektreferanse på dokument** | `objektRef { kilde, id, kategori, tekst, tegningId/modellId, revisjon }` som **tilleggsfelt** på `Task`/`Checklist`/`KontrollplanPunkt` (F5 E6: gamle rader uendret); markør utledes av objektets midtpunkt i hver flate som bærer samme id | 2D (F5), 3D (AT-I4 lukkes: markøren lagres på objektet, ikke som kule) | F5, F8, 3D, mobil |

**Regler:**
- R8.1 **Samme vegg, samme kort:** et objekt vist i 2D-tegning, 3D-modell og på mobil gir samme felt i samme rekkefølge; bare kildespesifikke felt varierer (Psets i IFC, littera i EL-DWG).
- R8.2 **Id-rom holdes atskilt, med ett målt unntak:** IFC `GlobalId`, Revit element-id og DXF-handle er tre ulike rom. Kryss-visning *innen* et rom (F8: samme element-id i plan/snitt/fasade; samme GlobalId i to IFC-modeller) er automatisk. **Revit-unntaket (AT-G13, rettet rev. 7):** når DWG og IFC kommer fra samme Revit-modell, er DWG-XDATA kode 1 = `IfcElement.Tag` (87 av 317 målt på HABU) → kobling 2D-DWG ↔ IFC **er** automatisk via Revit element-id, lagret som `objektRef.kilde:"revit-id"` ved siden av `GlobalId`, og krever at begge filer bærer samme Revit `ContentGUID`/prosjektnr. eller at brukeren bekrefter «samme modell». Uten Revit-id (ArchiCAD, lag-DWG) går koblingen via kategori + navn/romnummer + posisjon (GPS-broen AT-I5) og merkes «tolket». Aldri gjett id-likhet utenfor unntaket.
- R8.3 **GlobalId vises** (lite, kopierbart) i 3D-kortet som i 2D (F1 felt 9) — i dag filtrert bort (AT-I2).
- R8.4 **Offline:** O1-inventar + O3-oppsett følger «Forbered til offline» for både tegning (F7) og IFC (mobil-cache AT-I6); fragment-cache uten egenskaper (AT-I6) er et brudd på R8.1 og rettes.
- R8.5 **Søk** (F3) kjører på O1 uansett kilde: navn, type, kategori, romnummer, id.

**Akseptkriterier (legges til Dokgens prøve, § 6):**
- L1 Samme egenskapskort-komponent rendrer: fallplan-vegg (A1), HABU-vegg 727699 (A8) og en IfcWall i en IFC-modell — tre kilder, én komponent, test på komponentnivå med tre O1-objekter.
- L2 IFC-modell: panelet (O3) lister IFC-typer med antall før noe er klikket; «bare IfcPipeSegment» skjuler alt annet; samme panel-komponent som B1 på fallplanen.
- L3 Oppgave opprettet fra IfcWall i 3D har `objektRef {kilde:"ifc", id:GlobalId}` og vises som markør på veggens midtpunkt ved neste åpning (ikke kule, ikke tapt); samme test-oppsett som E1.
- L4 Mobil: IFC lastet fra fragment-cache gir egenskaper ved klikk (AT-I6 rettet) — test som feiler i dag.
- L5 2D-DWG-vegg og IfcWall i samme bygg får **ikke** automatisk samme objektRef (R8.2); negativkontroll.

**Rekkefølge:** O1+O2 bygges med F1 (første byggeordre etter prøven) og tas i bruk i 3D-kortet i samme ordre, så det aldri finnes tre kort. O3 med F2. O4 med F5. IFC-panelet (L2) og mobil-IFC (L4) er egne små ordrer etter det, i 3D-sporet — spec-en her eier modellen, ikke 3D-renderen.

**Hvilken fil oppdateres:** `web.md` § 3D-visning og `mobil.md` § IFC får henvisning til § 8 ved første byggeordre (DOC-MAP); avvikene i AT-I6 (meldingsnavn `cacheFragment`, `file://`) rettes i `mobil.md` i samme ordre.

## 9. Gjenkjenning av lag og objekter på tvers av CAD-standarder (rev. 10, 2026-10-18)

> Hjemmel: **Kenneth 2026-10-18 «ja»** — firma-admin kobler lag/mønster til type. Ordre: orkestrator 18.10 (`relay/inbox-fabel.md`
> § POST: gjenkjenning av lag/objekter). Utløser: fallplanens **isolasjon** ligger som HATCH `Skrålinjer_2` på laget
> «231- Bærende yttervegger (Skravur)», uten «isol» noe sted — navneheuristikk kan ikke finne den, fordi hver arkitekt har sin egen
> CAD-standard. § 9 presiserer F1 felt 1/4 og F2 (gruppe) og § 8 O1 (`kategori`, `egenskaper[].tolket`).

### 9.1 Målt utgangspunkt (develop `faf2be07`, 2026-10-18)

| # | Fakta | Bevis |
|---|---|---|
| AT-K1 | **Prioritert tolkning finnes alt, server-side i render.py:** `kategori` = Revit-XDATA (`BUILTIN_CAT`, 17 kategorier; ukjent kode → «Kategori N») → `layer.description` → `tolk_lagnavn` (SOSI, A-prefiks, NS 3451, suffiks «(Skravur/Tekst/Nye konstruksjoner/Polylinje)» strippes) → **rått lagnavn**. `gruppe` via `tolk_lag_gruppe` (NS 3451/A-prefiks/SOSI/AIA), navn fra `NS3451_NAVN`/`AIA_FAG_NAVN`, ellers «Andre». **Ingen «Ukjent»-tilstand** — fallback er rått lagnavn som om det var en type | `render.py:191-204, :230-258, :298-304, :333-363, :559-590` |
| AT-K2 | **Skravur → materiale:** `MATERIALE`-tabell med **4** mønstre (Betong_strukturell, Gips, Lettklinker, Trefiber); ukjente mønstre → `materialeRaa` (vist som tolket), unntatt `FP_*`/`SOLID` som skjules. Fallplanens `Skrålinjer_2` (isolasjon) og `Skrålinjer_1`/`Prikker_tett` ender som rå mønsternavn. Ingen AutoCAD-standardmønstre (INSUL, ANSI31/37, AR-CONC, BRICK, EARTH …) i tabellen | `render.py:199, :285, :315-317` |
| AT-K3 | **Mål kan bli feil tall:** egenskapskortets «Mål» = lengden av første polylinje i `geom`, areal for HATCH/SOLID; for dør/vindu-INSERT brukes attributt WIDTH/BREDDE, **ellers lengste segment i blokken** — en gjetning. Tykkelse finnes ikke | `egenskapsfelt.ts:80-113` |
| AT-K4 | **Ingen gjenkjenningsrapport:** `KonverteringRapport` = `parsetPrType/tegnetPrType/ikkeTegnet` + `markor`; render.py teller `objekter/lag/elid` til stdout, men `genererDxfViewerArtefakter` leser ikke stdout. `laginventar` (navn, antall, visningsnavn, desc, aci, ltype, lw, gruppe) finnes i registeret, ikke i DB. Markørlinja på tegningssiden er ikke admin-begrenset | `dwgKonvertering.ts:958-965, :2184-2205`; `render.py:1440-1449, :1475`; `tegning.ts:342`; `tegninger/page.tsx:1736` |
| AT-K5 | **Lagpanelet viser tolket** (`gruppeNavn` + `visningsnavn`, rå kode i grått), gruppert av `byggLagGrupper` i shared; «Andre» slås sammen. Web og mobil bruker samme shared-funksjon | `lag-gruppering.ts:22-25`; `LagPanel.tsx:32-107`; `TegningLagPanel.tsx:45-126` |
| AT-K6 | **Ingen firma-scopet CAD-konfigurasjon.** Mønster å gjenbruke: `Kompetansetype`/`Avdeling` (`@@unique([organizationId, navn])`), `Lonnsart` (`@@unique([organizationId, kode])`), skriving via `autoriserAdminForFirma` (sitedoc_admin eller firma-admin), UI under `/dashbord/firma/…` med `kanAdministrereFirma`-layout og `firma-nav.tsx`. Ingen «Tegninger»-side under firma | `schema.prisma:372, :2834, :2938`; `db-timer schema.prisma:22-50`; `tilgangskontroll.ts:306, :858`; `firma/layout.tsx:23`; `firma-nav.tsx:43-64` |
| AT-K7 | **Migreringsmal for «stille tomhet»:** `20261002120000_byggeplass_geofence_kilde` (ADD COLUMN IF NOT EXISTS, backfill, CHECK i idempotent `DO $$`-blokk). Siste tegningsmigrering `20261013220000_arbeidstegning_dxfviewer_urls` er ren additiv | `packages/db/prisma/migrations/…` |
| AT-K8 | **Tester:** 15 py-tester for `tolk_lag_gruppe`/`gruppe_visningsnavn`/dominant Revit-kategori/nærmeste merking; **0** for `bygg_objektregister`, `parse_revit_xdata`, `MATERIALE`; `egenskapsfelt.test.ts` 15, `lag-gruppering.test.ts` 4; ingen komponenttester for lagpanel/egenskapskort; **ingen fixture med navngitt skravurmønster** (`hatchDxf` mangler gruppekode 2) | `test_render_f2.py`; `egenskapsfelt.test.ts:32-38, :79`; `dwgKonvertering.test.ts:113` |

**Konsekvens:** rekkefølgen i ordrens punkt 1 er i hovedsak bygget (AT-K1), men (a) ukjent blir aldri sagt høyt — rått lagnavn
presenteres som type og lengste segment som mål (AT-K1/K3), (b) skravur dekker fire mønstre fra én fil (AT-K2), (c) ingen ser hvor
mye som er gjenkjent (AT-K4), og (d) det finnes ingen måte å lære systemet firmaets egen standard (AT-K6).

### 9.2 Regel K1 — Gjenkjenningsrekkefølge og sikkerhet · **MÅ** (reparasjon av F1/F2, presisering av O1)

Hvert objekt får `kategori` + `kategoriKilde` + `sikkerhet` (`hoy | middels | lav | ukjent`) i O1, bestemt i denne rekkefølgen — første treff vinner, men **materiale** og **kategori** avgjøres hver for seg (en Revit-vegg kan ha ukjent skravur):

| Pri | Kilde | Gir | Sikkerhet | Finnes i dag |
|---|---|---|---|---|
| 1 | **Revit-kategori** (XDATA kode 2, `BUILTIN_CAT`) | kategori | høy | ja (AT-K1) |
| 2 | **Kobling** (§ 9.5: lag/mønster/blokk → type; prosjektkobling vinner over firmakobling) | kategori **når pri 1 mangler**; materiale **alltid** (Revit `FP_n` er meningsløs uten firmakobling) | høy (bekreftet av menneske) | nei |
| 3 | **Lagbeskrivelse fra fila** (`layer.description`, POINT/AB3) | kategori | høy | ja |
| 4 | **NS 3451-kode i lagnavn** (2–3 siffer, m/u «A»-prefiks) | kategori + gruppe | middels | ja |
| 5 | **AIA/IFC-kode** (`A-WALL`, `P-SANR-FIXT`, `S-COLS` …) | kategori + gruppe | middels | ja (gruppe), kategori-navn delvis |
| 6 | **SOSI-kode** i lagnavn («8250 Kum») | kategori | middels | ja |
| 7 | **Skravurmønster** — AutoCAD-standard (`INSUL`→isolasjon, `ANSI31/32`→stål/betong-snitt, `AR-CONC`→betong, `AR-SAND`/`AR-B816`→mur, `BRICK`, `EARTH`, `GRAVEL`, `DOTS`, `SOLID`) + norske navn (dagens 4 + `Prikker_tett`/`Skrålinjer_*` **bare** via firmakobling) | materiale | middels | 4 mønstre |
| 8 | **Geometri** — KAN, bare entydige tilfeller: lukket polylinje som omslutter en romtagg = rom; blokk med `ROOM_NAME` = romstempel. Aldri «to parallelle linjer = vegg» | kategori (rom) | lav | nei |
| 9 | **Rått lagnavn** | **ingen kategori**: `kategori = null`, kortet viser **«Ukjent type»** + rå lagnavn og rå mønster | ukjent | i dag vises lagnavnet *som* type |

- Lagpanelets gruppe følger samme rekkefølge; «Andre» blir **«Ukjent (N lag)»** med rå navn under, slik at det synes at noe ikke er gjenkjent.
- Kortet viser alltid kilden i grått under «Hva» («fra Revit», «fra prosjektkobling», «fra firmakobling», «fra lagbeskrivelse», «fra NS 3451-kode», «fra skravur», «ukjent»). Tolkede felt er kursiv som i dag (AT-K5-mønsteret).
- **Konflikt mellom kilder** (kobling sier isolasjon, Revit sier vegg) → Revit vinner for kategori, koblingen gjelder materiale, og rapporten (§ 9.4) lister konflikten.

### 9.3 Regel K2 — Aldri feil tall · **MÅ** (reparasjon)

- `kategori = null` (ukjent) → **ingen** mål, tykkelse eller type/størrelse på kortet (tykkelse krever kjent bånd/skravur, se under). Bare «Ukjent type», rå lagnavn, rå mønster, tekst i nærheten (tolket) og id. Ærlig tomt fremfor galt.
- Mål vises bare når geometrien er entydig for kategorien: lengde for strek/polylinje (alle kategorier), areal for lukket flate/skravur, **bredde for dør/vindu bare fra attributt (WIDTH/BREDDE) eller blokknavn med «10x21M»-mønster** — **aldri lengste segment** (AT-K3 fjernes). **Tykkelse (RETUR 1, Kenneth 18.10 «isolasjon → tykkelse»): vises for bånd/skravur når geometrien er entydig** — to lange, parallelle kanter innenfor toleranse (vinkelrett avstand mellom båndets to lange kanter, slik Dokgen alt beregner i `fix/arbeidstegning-flytt-punkt`: 100 mm ± 2 på fallplanens isolasjon), merket «målt fra geometri». Er kantene ikke parallelle, båndet ikke langt nok, eller flaten lukket uten to dominerende kanter → ingen tykkelse. Samme regel som vegglengde langs lengste akse (alt bygget).
- Tall som er tolket (nærmeste merking «15.TR», bredde fra blokknavn) merkes tolket; tall fra geometri merkes ikke.

### 9.4 Regel K3 — Gjenkjenningsrapport pr. tegning og pr. prosjekt · **MÅ** (reparasjon/utvidelse av konverteringsrapporten)

- `konverteringRapport.gjenkjenning` lagres ved konvertering (render.py-telling → TS, i dag kastet, AT-K4): `{ objekter, gjenkjent, andel, kilder: {revit, firmakobling, lagbeskrivelse, ns3451, aia, sosi, skravur, geometri, ukjent}, ukjenteLag: [{navn, antall}], ukjenteMonstre: [{navn, antall, lag}], ukjenteRevitKoder: [{kode, antall}], konflikter: [{lag|monster, kilde1, kilde2}] }`. `andel` = objekter med `kategori ≠ null` / objekter som ikke er tekst/mål/akser.
- **Vises for admin** (prosjektadmin/firma-admin, `erProsjektLeder`/`kanAdministrereFirma`) på tegningssiden som én linje under markøren: «87 % gjenkjent · 3 ukjente lag · 2 ukjente mønstre» med utfold. Ikke for vanlige brukere (de ser «Ukjent type» på kortet, det holder).
- **Samlet pr. prosjekt** (tegningslista, admin): sum over tegninger, listen av ukjente lag/mønstre på tvers, sortert på antall objekter — det er herfra firma-admin kobler (§ 9.5). **Samlet pr. firma** under `/dashbord/firma/tegninger` (ny side, § 9.5).
- Rapporten regenereres når en firmakobling anvendes (§ 9.5), så tallet stiger synlig etter kobling.

### 9.5 Regel K4 — Kobling lag/mønster/blokk → type, på prosjekt- og firmanivå · 🔴 **FUNKSJONSENDRING (Kenneth-hjemmel 2026-10-18)** · **MÅ**

**Hva (rev. 11, Kenneth på Q12: «snakker vi ikke om koblinger i en tegning i et prosjekt? → det skal ikke firmaadmin ta stilling til»):** koblingen lages der tegningen er — i prosjektet, av **prosjektadmin**, og gjelder **straks** for prosjektets tegninger uten noen godkjenning. Eksempel: «`Skrålinjer_2` = isolasjon». **To nivåer:**
- **Prosjektkobling** (`projectId` satt): prosjektadmin lager den fra rapporten på tegningen. Gjelder alle tegninger i prosjektet.
- **Firmakobling** (`projectId` null): firma-admin lager den under `/dashbord/firma/tegninger`, eller **løfter** en prosjektkobling dit med ett klikk («Gjelder hele firmaet»). Gjelder alle firmaets prosjekter.
- **Prosjektkobling vinner over firmakobling** når begge treffer samme nøkkel (prosjektet kjenner sine tegninger best); konflikten vises i rapporten.

**Datamodell (ny tabell i `packages/db`, siden `Drawing` bor der; to-stegs-policy: ren additiv migrering, ingen eksisterende kolonne røres):**
```
model CadKobling {            // cad_koblinger
  id             String   @id @default(uuid())
  organizationId String?                        // firma-scope; null bare for prosjektkobling i frittstående prosjekt
  projectId      String?                         // null = firmakobling; satt = prosjektkobling (svak FK)
                                                 // CHECK: organization_id IS NOT NULL OR project_id IS NOT NULL
  kildeType      String                          // "lag" | "monster" | "blokk"   (CHECK)
  nokkel         String                          // rå nøkkel, lagret som skrevet; matches case-insensitivt og trimmet
  maal           String                          // "kategori" | "materiale"       (CHECK)
  type           String                          // kode fra felles typeliste (shared: KATEGORIER / MATERIALER), aldri fritekst
  opphav         String                          // "prosjekt" | "firma" | "loftet_fra_prosjekt"
  aktiv          Boolean  @default(true)
  opprettetAv    String                          // userId
  opprettetTid   DateTime @default(now())
  fraTegningId   String?                         // hvor koblingen ble laget (sporbarhet), svak FK
  @@index([organizationId, aktiv])
  @@index([projectId, aktiv])
}
```
- **Unikhet med nullbare kolonner** (Postgres regner NULL ≠ NULL): to **partielle unike indekser** i rå SQL i migreringen — firmakobling `(organization_id, kilde_type, nokkel, maal) WHERE project_id IS NULL` og prosjektkobling `(project_id, kilde_type, nokkel, maal) WHERE project_id IS NOT NULL`. Prisma `@@unique` alene holder ikke. **Frittstående prosjekter** (`organizationId = null`, gyldig permanent tilstand, CLAUDE.md § Organisasjonsmodellen): prosjektkobling lagres med `organizationId null` + `projectId` satt (CHECK over), og prosjektadmin kobler som i et firmaprosjekt. «Løft til firma» finnes ikke der (ingen firma). Flyttes prosjektet inn i et firma senere (permanent firmaoverføring), settes `organizationId` på prosjektkoblingene i samme transaksjon.
- **Stille tomhet-regelen:** (a) backfill: ikke relevant — tabellen fødes tom med rette (ingen koblinger finnes før noen lager dem), og det **sies** i migreringens header; (b) DB-garanti: de to partielle unike indeksene; (c) **test som feiler når koblingen ikke slår inn**: etter at prosjektadmin lagrer «Skrålinjer_2 → isolasjon», må fallplanens register vise `materiale: "isolasjon"` på de 51 objektene — ellers rød (T39).
- **Typeliste** = én shared-konstant (`packages/shared/src/tegning/typer.ts`: `KATEGORIER` = Revit-/NS 3451-kategoriene som alt finnes i render.py + «isolasjon», «rom», «utstyr», «rør», «kanal», «kabel» …; `MATERIALER` = betong, gips, lettklinker, tre, trefiber, stål, mur, isolasjon, jord, grus, glass …). Forhåndsdefinerte valg, ikke fritekst (CLAUDE.md UI-prinsipp). Utvidelse av lista = kodeendring, ikke firmadata.

**Hvem:** prosjektkobling krever prosjektadmin (`ProjectMember.role = "admin"` via `erProsjektLeder`, eller firma-admin som arver); firmakobling og «løft til firma» krever `autoriserAdminForFirma` (sitedoc_admin eller firma-admin, som `Kompetansetype`). Ingen godkjenningsflyt, ingen forslag som venter (Q12). Vanlige medlemmer ser bare «Ukjent type».

**Hvor i UI:**
1. **Fra rapporten på tegningen/prosjektet** (§ 9.4): hver ukjent rad har «Koble til type …» → nedtrekk fra typelista (kategori eller materiale etter kildeType) → lagre = prosjektkobling, virker straks. SiteDoc **foreslår** øverst i nedtrekket når nøkkelen matcher kjente tokens (`insul|isol|iso` → isolasjon, `conc|betong` → betong, `brick|tegl|mur` → mur, `gips|gyp` → gips, `stål|steel|ansi3` → stål) eller når samme nøkkel alt er koblet i et annet firma (anonym statistikk, KAN). Forslag må bekreftes — aldri automatisk anvendt.
2. **Firmaside `/dashbord/firma/tegninger`** (ny, i `firma-nav`): liste over firmakoblinger **og** prosjektkoblinger gruppert pr. prosjekt (nøkkel, kildeType, type, antall objekter som treffes, laget av/når, fra tegning), «Gjelder hele firmaet» (løft), rediger type, deaktiver (ikke slett — sporbarhet), søk. Samlet gjenkjenningsgrad pr. prosjekt. Prosjektadmin ser og redigerer prosjektets koblinger i prosjektets tegningsliste (admin-visning), ikke på firmasiden.

**Hva skjer med eksisterende tegninger (Q13 🟢 ok):** koblingene **anvendes ved lesing** av registeret, server-side i `tegning.hentRegister` (ett oppslag pr. prosjekt + firma, cachet med versjonsstempel **`cadKoblingVersjon` på `Project`** — bumpes når prosjektets egne koblinger endres **og** når firmaets koblinger endres (bump alle firmaets prosjekter i samme transaksjon); frittstående prosjekter har dermed samme mekanisme uten `Organization`) — ikke ved rekonvertering. Da gjelder en ny kobling **alle firmaets tegninger med en gang**, inkludert gamle, uten kø eller rekonvertering; render.py røres ikke. Rapporten (§ 9.4) regenereres fra registeret ved samme lesning. Mobil-offline-kopier bærer prosjektets `cadKoblingVersjon` og hentes på nytt når den endres (F7). Rekonvertering trengs **bare** når typelista i render.py endres (kodeendring), ikke for firmadata.

**Forhold til automatisk gjenkjenning:** kobling (prosjekt > firma) er pri 2 i § 9.2 — vinner over lagbeskrivelse, NS 3451, AIA, SOSI, skravur-standard og rått lagnavn; taper for Revit-kategori på *kategori* (objektdata fra kilden er sannere enn en firmaregel), men gjelder *materiale* også på Revit-tegninger (`FP_3` → isolasjon). Konflikt vises i rapporten, ingenting velges stille (samme prinsipp som F11.8).

**Akseptkriterier (ekte filer):**
- K1 Fallplan før kobling: de 51 HATCH `Skrålinjer_2`-objektene har `materiale: null`, `materialeRaa: "Skrålinjer_2"`, kortet viser «Materiale: ukjent (Skrålinjer_2)»; rapporten lister «Skrålinjer_2 · 51 objekter · lag 231- … (Skravur)». Veggen rundt beholder kategori «Bærende yttervegger · 231» (lagnavn-kode, middels).
- K2 Prosjektadmin kobler `Skrålinjer_2 → isolasjon` fra rapporten (prosjektkobling) → **uten rekonvertering** viser kortet «Materiale: isolasjon (fra prosjektkobling)» på samme 51 objekter, rapporten går fra «2 ukjente mønstre» til «1», `andel` stiger; lagpanelet uendret (lag er kjent). Test T39 (feiler når koblingen ikke slår inn).
- K3 Samme firma, annen tegning (HABU A-10-101, Revit): `FP_3`-skravur får materiale «fra firmakobling» når firmakoblingen `FP_3 → isolasjon` finnes; Revit-kategori «Vegg» beholdes selv om admin skulle koble laget `A23_yttervegg → isolasjon` (Revit vinner kategori) — konflikten vises i rapporten.
- K4 Annet prosjekt i samme firma: prosjektkoblingen gjelder ikke der; etter «Gjelder hele firmaet» (firma-admin) gjelder den; annet firma: aldri (organizationId-isolasjon). Negativkontroller på begge. **Frittstående prosjekt** (`organizationId null`): prosjektadmin kobler `Skrålinjer_2 → isolasjon`, koblingen virker (`organizationId null`, `projectId` satt), «Gjelder hele firmaet» vises ikke; `cadKoblingVersjon` på `Project` bumpes.
- K5 UTM32: «8250 Kum» → kategori «Kum» fra SOSI (middels); lag «XREF-ARK» → «Ukjent type», ingen mål.
- K6 AB3-1071: `A2412` → «Innervegg IKKE bærende» fra lagbeskrivelse (høy) — ikke overstyrt av NS 3451-tolkning.
- K7 Rapport: fallplan viser andel og listene for prosjektadmin; vanlig medlem ser ikke linja; prosjektsamling summerer tre tegninger.
- K8 Prosjektkobling `Prikker_tett → betong` og firmakobling `Prikker_tett → mur` på samme nøkkel → prosjektet viser betong, rapporten lister konflikten; firmakobling gjelder i andre prosjekter. Vanlig medlem kan ikke lagre kobling (FORBIDDEN).
- K9 «Aldri feil tall»: dør-blokk uten WIDTH-attributt og uten størrelse i navnet viser ingen bredde (i dag lengste segment). Fallplanens isolasjonsbånd (`Skrålinjer_2`) viser «Tykkelse 100 mm (målt fra geometri)» (± 2 mm); en skravert, uregelmessig flate (ikke bånd) viser ingen tykkelse — negativkontroll.

### 9.6 Regel K5 — Testkorpus fra virkeligheten · **MÅ** (prosess, ikke kode i git)

- Testtegninger fra ulike firmaer ligger **bare lokalt/på test** (`DWG eksempelfiler/`, Q7-regelen: aldri i git). I git ligger en **manifest** `apps/api/test-fixtures/dwg/korpus.json`: pr. fil `{ navn, sha256, kilde (ArchiCAD/Revit/POINT/landmåler), forventet: { andel ≥ x, lag: {"231- Bærende yttervegger": "vegg"}, monstre: {"Skrålinjer_2": null | "isolasjon (via kobling)"}, revitTag: true/false } }`. Testen kjører pr. fil som finnes lokalt, skipper rent ellers (aldri rød i CI uten filer).
- **Hver feil fra virkeligheten blir en rad**: når Kenneth eller en kunde finner et objekt som er feil gjenkjent, legges fila (lokalt) + forventningen (i git) inn før fiksen — regresjon for alltid.
- Startkorpus (alt målt i denne spec-en): fallplan (ArchiCAD-IFC-import), HABU ×7 (Revit, lokalt hos Kenneth), AB3/VB3/TB3 (POINT/AutoCAD 2004), Ålesund NTM6/UTM32 (landmåler). Forventningene står i AT-F1–F14 og K1–K9.

### 9.7 Regel K6 — Veggtype og oppbygging: total tykkelse, lag for lag (rev. 13, 2026-10-22) · **MÅ** (presisering av K2/F1; K6.3 pkt. 2–3 🔴 FUNKSJONSENDRING, Q15)

> Utløser: **Kenneth 2026-10-20** trykket på isolasjonen i en innervegg (242) i fallplanen og fikk «Tykkelse 71 mm»: *«Er det med
> eller uten gipsplatene den er kledd med? Er det enkel eller dobbel gips? Gips er vanligvis 13 mm.»* Bilder
> `relay/arbeidstegning-prove/f1f2/kenneth/2010/2-isolasjon-71mm.jpg` og `3-gips-linje.png`. Ordre: orkestrator 22.10
> (`relay/inbox-fabel.md` § POST veggtype), Kenneth «ja» til spec. BACKLOG § «Arbeidstegning: veggens totale tykkelse fra veggtype-merking».

**Målt 2026-10-22** (ezdxf 1.4.5 på `dwg2dxf -y`-DXF i `relay/arbeidstegning-prove/gate1/` og `dxf-b/`; HABU A-30-100/A-40-100 konvertert på nytt
fra `DWG eksempelfiler/`; IFC `DWG eksempelfiler/E3 3D-modell ARK.ifc`; skript i Fabels scratchpad `veggtype/`):

| # | Fakta | Bevis |
|---|---|---|
| AT-V1 | **Ingen veggtype-merking og ingen veggtypetabell i korpuset.** 0 TEXT/MTEXT/ATTRIB som matcher «IV1»/«YV2»/«V1»-mønster, 0 `ACAD_TABLE`, 0 tegnforklaringsblokker — i fallplan (24 074 ent.), AB3/VB3/TB3, HABU A-10-101/A-30-100/A-40-100. Eneste «ISOL.»-tekst er to romtekster på AB3-lag `ROMNR`. 🟡 Merking + tabell er vanlig på større prosjekter, men finnes ikke i noen av de tretten filene — veien via merking (K6.1 pri 3) kan ikke måles før en slik fil kommer (K5: inn i korpuset når den dukker opp) | `maal.py` 22.10: 0 treff i alle seks DXF |
| AT-V2 | 🟢 **Fallplanen (ArchiCAD) tegner veggen lag for lag — geometrien bærer svaret.** Isolasjonen Kenneth trykket på (`AFF2`) er en anonym blokk `*X1089` med 305 LINE på lag «242- Ikke-bærende innervegger (Skravur)(Nye konstruksjoner)», bånd **70,0 mm** × 1 075 mm. På hver side ligger **to HATCH `Gips` à 12,5 mm** som deler kanter (offset ±35 → ±47,5 → ±60), og ytterst én PLINE på «236- Innvendig kledning og overflate» (= `B00C`, det Kenneth trykket på i bilde 3; linje uten bredde). Veggen er **12,5 + 12,5 + 70 + 12,5 + 12,5 = 120 mm, dobbel gips på begge sider** — og det står ikke skrevet noe sted i fila. Hele 242-(Skravur)-laget: 154 HATCH `Gips` (bånd 12–15 mm), 15 HATCH `Prikker_tett` (107 mm), 41 anonyme linjeblokker (isolasjon; bånd 70–113 mm) | `aff2c.py`: offset −60,3/−47,8/−35,3/+34,7/+47,2/+59,7; `fall242.py` |
| AT-V3 | **ArchiCAD-isolasjonen har ikke noe mønsternavn.** Fyllet er eksportert som linjer i en anonym blokk (`*X957`…`*X1089`, ett navn pr. instans) på «(Skravur)»-laget, med seks vinkler og ujevn avstand — ingen signatur å nøkle på. K4-nøklene `monster` og `blokk` treffer den ikke, og laget alene skiller ikke isolasjonen fra Gips-skravurene på samme lag. Den trenger en egen nøkkel: **«linjeblokk på lag X»** (K6.3 pkt. 2) | `aff2c.py`: vinkler 75°/26°/36°/111°/115°/170°, avstand 4,3/1,6/7,4 mm |
| AT-V4 | 🟢 **HABU (Revit): veggtype-id finnes i hver strek, navnet gjør det ikke.** XDATA `REVIT` kode 5 på vegg-entiteter (kat −2000011): A-10-101 har fire type-id-er (556257: 142 ent./9 elementer · 341721: 92/13 · 338346: 49/9 · 700392: 42/2); A-30-100 tre, A-40-100 tre. Ingen tekst, blokk eller lag i DWG-ene bærer typenavnet. Veggkode-taggen finnes som blokk `aart_veggkode 2mm - type_brannklasse-339875` på lag `A24-K_koder vegg` (kat −2005011), **men er sju streker uten tekst/attributt** — innholdet forsvant i eksporten. Én instans i A-10-101 | `habu2.py`; XDATA `{1070 1, 1000 '872333'}{1070 5, 1000 '339875'}{1070 2, 1000 '-2005011'}` |
| AT-V5 | 🟢 **Prosjektets IFC bærer både navn og oppbygging, nøklet på samme type-id.** `IfcWallType.Tag` = Revit type-id (341721 «Basic Wall:Innervegg 150», 338346 «Innervegg 100», 556257 «Yttervegg 198+48», 700392 «Innervegg 198+48 2»); `IfcWallStandardCase.Tag` = element-id (727699 ↔ XDATA kode 1, AT-F6). `IfcMaterialLayerSet` gir lagene: «Yttervegg 198+48» = **367 mm** (Liggende kledning 20 + Lufting 70 + Stender isolert 198 + 48 + OSB 18 + Gips hvit 13); «Innervegg 198+48 2» = 308 mm (Gips 13 + OSB 18 + Stender 198 + 48 + OSB 18 + Gips 13); «Innervegg 150»/«100» = ett lag «Default Wall» 150/100 (oppbygging ikke modellert). 81 vegger; 74 med layerset-usage, 7 med bare type | `ifc.py`; IFC `#527`, `#28227`, `#28296`, `#42820` |
| AT-V6 | **I dag:** IFC parses bare i nettleseren (AT-I1); serveren leser prosjekt/etasjer/GPS med regex til `Drawing.ifcMetadata`. Ingen leser `IFCWALLTYPE`/`IFCMATERIALLAYERSET`, og ingen kobler 2D-XDATA kode 5 til noe (XDATA leses ikke, AT-M9). AB3/VB3/TB3 (POINT/AutoCAD 2004): vegger er enkeltstreker uten bånd, mønster eller type — bare K6.1 pri 3 kan noen gang svare der | `ifcMetadata.ts:7-9`; `schema.prisma:949`; `render.py` 0 treff `xdata` |

**Konsekvens:** Kenneths spørsmål har tre ulike svar etter kilde: i fallplanen står svaret i geometrien (AT-V2) og ingen steder i
tekst; i HABU står det i IFC-en, nøklet på en id DWG-en alt bærer (AT-V4/V5); i AB3 finnes det ikke. Ingen av de tretten filene har
merking eller tabell (AT-V1). Dagens kort svarer «71 mm» uten å si at det er ett lag av fem. BACKLOG-notatet 20.10 («gips er tegnet som
én linje uten bredde») var feil for fallplanen: gipsen *er* tegnet som 12,5 mm-bånd; linjen Kenneth traff (236) er overflatelinjen.

#### K6.1 Rekkefølge for veggtype (første treff gir *type*; tykkelse og lag følger kilden; materiale pr. bånd følger K1/K4 som før)

| Pri | Kilde | Gir | Sikkerhet | Målt |
|---|---|---|---|---|
| 1 | **Revit type-id (XDATA kode 5) → IFC på samme byggeplass** (`IfcWallType.Tag` = type-id, lag fra `IfcMaterialLayerSet`) | navn, lag for lag, total | høy | AT-V4/V5 |
| 2 | **Kobling type-id → veggtype** (K4, ny `kildeType "revittype"`, nøkkel = type-id) — når IFC mangler, eller typen har ett «Default»-lag | navn, lag, total (registrert) | høy (menneske) | 🟡 ikke målt — ingen fil krever det ennå |
| 3 | **Merking i tegningen** («IV1», «YV2», tag-blokk-attributt) nærmest veggen → **veggtypetabell** på prosjekt/firma (K6.3 pkt. 3) | navn, lag, total (registrert) | middels (nærmeste tekst, som «15.TR» i K2) | 🟡 ikke målt — 0 forekomster i korpuset (AT-V1) |
| 4 | **Geometri: stabel av parallelle bånd** — bånd (HATCH, linjeblokk, SOLID) som deler kant med det trufne båndet langs samme akse, samlet til én stabel; materiale pr. bånd fra K1 pri 7 (mønster) eller K4; bånd uten begge forblir «ukjent» | total mellom ytterste kanter, lagliste med tykkelser | **målt** (ingen tolkning) | AT-V2: 120 mm = gips 12,5 ×2 · ukjent 70 · gips 12,5 ×2 |
| 5 | **Ingen** | bare det trufne båndet som i dag | ukjent | AB3/VB3/TB3 |

- **Aldri gjett (K2):** ingen «13 mm gips» som standardverdi, ingen «enkel» fordi vi bare ser én linje. Et bånd uten mønster og uten
  kobling listes som «ukjent 70 mm». En linje uten bredde (236-PLINE, bilde 3) er **ikke** et lag og får ikke tykkelse.
- Pri 1 og 4 kan begge finnes (Revit-vegg tegnet med skravurbånd): pri 1 gir type og lag; pri 4 brukes som kontroll og vises bare ved
  avvik > 5 mm mellom IFC-total og målt total («IFC: 367 mm · tegnet: 360 mm»), og avviket går i rapporten (K3).
- Pri 3 er en *tolkning* (nærmeste tekst) og vises med «(tolket)» som andre nærmeste-merkinger (K2); to merkinger like nær → ingen.

#### K6.2 Hva kortet viser (F1 felt 2 «Mål» utvides; § 8 O1 får `vegg?: { type, kilde, total, lag: [{ materiale, tykkelse, kilde }] }`)

1. **Linje 1:** «Vegg: Innervegg 198+48 2 · 308 mm» (pri 1–3) eller «Vegg 120 mm (målt fra geometri)» (pri 4). Kilde i grått som i K1:
   «fra IFC», «fra prosjektkobling», «fra firmakobling», «fra veggtypetabell», «målt fra geometri».
2. **Linje 2, utfoldbar «Oppbygging»:** lagene i rekkefølge fra den siden brukeren trykket: «gips 12,5 · gips 12,5 · **ukjent 70** ◀ · gips
   12,5 · gips 12,5». Det trufne båndet er markert. Et ukjent bånd har «Koble til type …» for prosjektadmin (K4) rett i lista.
3. **Linje 3:** dagens svar for det trufne elementet («Tykkelse 70 mm · isolasjon») beholdes, så ingenting forsvinner.
4. Pri 5: kortet som i dag. Deler et annet bånd kant med det trufne uten at stabelen kan lukkes (bare ett nabobånd, ingen ytterkant),
   vises «Ett lag — veggens oppbygging er ikke kjent».
5. Web og mobil samme felt (§ 8 O1); offline (F7) bærer `vegg` i registeret som alt annet; IFC-typer følger `cadKoblingVersjon`-mekanismen
   (K4) så en IFC lastet opp senere slår inn uten rekonvertering.

#### K6.3 Datagrunnlag — fire deler, to er funksjonsendring

1. **IFC → veggtyper på serveren (utvidelse av `ifcMetadata`, ingen ny UI):** ved IFC-opplasting leses `IFCWALLTYPE` (Name, Tag),
   `IFCMATERIALLAYERSET`/`IFCMATERIALLAYER`/`IFCMATERIAL`, `IFCRELASSOCIATESMATERIAL`/`IFCMATERIALLAYERSETUSAGE` og `IFCRELDEFINESBYTYPE`
   med samme linje-regex-tilnærming som i dag (ingen web-ifc på server) til `Drawing.ifcMetadata.veggtyper: { [typeId]: { navn, total,
   lag: [{ materiale, tykkelse }] } }` + `elementTyper: { [elementId]: typeId }` (dekker de 7 veggene uten layerset-usage, AT-V5).
   Anvendes **ved lesing** i `tegning.hentRegister` som K4: for hver 2D-tegning på byggeplassen med XDATA kode 5 slås typen opp i
   byggeplassens IFC-er. Krever at render.py skriver XDATA kode 1/2/**5** i registeret (GJ-1 tar kode 1/2; kode 5 legges til der).
   *Reparasjon/presisering — ingen ny flate.*
2. **`CadKobling` (§ 9.5) utvides** med `kildeType "revittype"` (nøkkel = type-id) og `"linjeblokk"` (nøkkel = lagnavn; treffer **bare**
   anonyme `*X`-blokker som består av linjer på det laget, AT-V3 — aldri HATCH på samme lag). `maal` får verdien `"veggtype"` ved siden av
   kategori/materiale, med `type` = id i veggtypetabellen. Samme prosjekt > firma-regel og samme partielle unike indekser.
   🔴 *Funksjonsendring* (ny nøkkeltype prosjektadmin kan velge) — dekkes av Q15.
3. **Veggtypetabell (ny tabell i `packages/db`):** `Veggtype { id, organizationId?, projectId?, kode («IV1»), navn, lag: Json
   [{ materiale (fra `MATERIALER`), tykkelse }], total (beregnet ved lagring), aktiv, opprettetAv, opprettetTid }` med CHECK org/prosjekt
   og partiell unik `(projectId, kode) WHERE project_id IS NOT NULL` / `(organizationId, kode) WHERE project_id IS NULL` (samme mønster
   som K4). Registreres av prosjektadmin fra kortet («Koble til type … → Ny veggtype») og som egen fane under `/dashbord/firma/tegninger`
   (K4-siden); «Gjelder hele firmaet» løfter som for koblinger. Forhåndsdefinerte materialer (nedtrekk), tykkelse i mm (tall), aldri fritekst.
   **Stille tomhet:** tabellen fødes tom med rette (sies i migreringens header); DB-garanti over; **test som feiler når en registrert kode
   ikke slår inn** (T46). 🟡 Kan ikke måles på korpuset før en fil med merking finnes (AT-V1) — T46/V7 bruker en syntetisk DXF-fixture med
   TEXT «IV1» ved en vegg, som eneste unntak fra K5 (merket slik i manifestet). 🔴 *Funksjonsendring* — Q15.
4. **Bånd-stabling (pri 4) er ren geometri i render.py/registeret** (*reparasjon*, presisering av K2 «tykkelse fra geometri»): naboskap =
   parallell innen 1°, delt kant innen 1 mm, overlapp langs aksen ≥ 50 % av det korteste båndet; stabelen lukkes når ytterste bånd på hver
   side ikke har flere naboer. Alle bånd i stabelen peker på samme `vegg` (de fem i AT-V2). Linjer uten bredde deltar ikke.

#### K6.4 Akseptkriterier (ekte filer, pluss én syntetisk for pri 3)

- V1 Fallplan `AFF2`: kortet viser «Vegg 120 mm (målt fra geometri)», oppbygging «gips 12,5 · gips 12,5 · ukjent 70 ◀ · gips 12,5 · gips
  12,5»; trykk på en av Gips-skravurene gir samme stabel med annet bånd markert; trykk på 236-PLINE `B00C` gir **ingen** vegg og ingen
  tykkelse (linje uten bredde). Toleranse ± 1 mm pr. bånd.
- V2 Fallplan etter prosjektkobling `linjeblokk «242- Ikke-bærende innervegger (Skravur)(Nye konstruksjoner)» → isolasjon` (K4): «ukjent 70»
  blir «isolasjon 70 (fra prosjektkobling)» på alle 41 linjeblokker; de 154 Gips-skravurene på samme lag beholder gips (nøkkelen treffer ikke HATCH).
- V3 HABU A-10-101 + `E3 3D-modell ARK.ifc` på samme byggeplass: vegg 727699 → «Vegg: Yttervegg 198+48 · 367 mm (fra IFC)», oppbygging
  seks lag som i AT-V5; en vegg av type 341721 → «Innervegg 150 · 150 mm (fra IFC)» med ett lag «Default Wall 150» og teksten
  «oppbygging ikke modellert i IFC» — ikke gjettet gips.
- V4 HABU uten IFC på byggeplassen: samme vegg → ingen veggtype; kortet som i dag + «Koble til type …» for prosjektadmin. Etter kobling
  `revittype 556257 → Veggtype «YV1»` (registrert 367 mm) vises «YV1 … (fra prosjektkobling)». Lastes IFC opp etterpå vinner IFC (pri 1),
  koblingen beholdes, og avvik > 5 mm mellom de to listes i rapporten (K3).
- V5 HABU A-30-100 (snitt): samme element-id som i plan gir samme veggtype uten ny kobling (F8).
- V6 AB3-1071: innervegg `A2412` (enkeltstreker) → ingen tykkelse, ingen oppbygging, ingen feilmelding, kortet som i dag.
- V7 Syntetisk fixture `veggmerke.dxf` (TEXT «IV1» 300 mm fra en lukket 120 mm-polylinje): uten tabell → «Merking IV1 (tolket) — veggtype
  ikke registrert»; med `Veggtype IV1` på prosjektet → «Vegg: IV1 · 120 mm (fra veggtypetabell)»; to tekster like nær → ingen merking.
- V8 Negativkontroller: ingen «13», «gips» eller «enkel/dobbel» i noe kort uten målt bånd eller registrert kilde; to bånd som ikke deler
  kant (3 mm mellomrom) stables ikke; vanlig medlem kan ikke lagre veggtype (FORBIDDEN).

#### K6.5 Tester som skal feile i dag

- **T44** register fallplan: `AFF2.vegg.total === 120`, `vegg.lag.length === 5`, `vegg.lag[2].materiale === null` (i dag: `vegg` finnes ikke).
- **T45** `ifcMetadata` på HABU-IFC: `veggtyper["556257"].total === 367`, `.lag.length === 6`; `veggtyper["341721"].lag.length === 1`;
  `elementTyper["727699"] === "556257"` (i dag: feltene finnes ikke).
- **T46** veggtypetabell: `Veggtype { kode: "IV1" }` på prosjektet → fixture-veggen får `vegg.kilde === "veggtypetabell"`; uten rad →
  `vegg === null` (feiler når koblingen ikke slår inn — stille tomhet (c)).
- **T47** egenskapsfelt: `B00C` (PLINE, bredde 0) → ingen `vegg`, ingen tykkelse; `vegg === null` + ukjent kategori → ingen mål i feltlista.

### 9.8 Ordre

| Ordre | Innhold | Gate | Hjemmel |
|---|---|---|---|
| **GJ-1 (reparasjon)** | § 9.2 kilde+sikkerhet i O1 og «Ukjent type» (render.py + egenskapsfelt + lagpanel «Ukjent (N)») · § 9.3 aldri feil tall · § 9.4 rapport i `konverteringRapport.gjenkjenning` + admin-linje på tegning + prosjektsamling · AutoCAD-standardmønstre i `MATERIALE` · § 9.6 manifest + skip-tester · T36–T38, T40–T42 | Kontrollør | ingen ny — presiserer F1/F2/O1 |
| **GJ-2 (funksjonsendring)** | § 9.5 `CadKobling` (migrering m/ to partielle unike indekser + CHECK org/prosjekt, frittstående prosjekter, Zod, prosjektadmin-/firma-admin-tilgang), anvendelse ved lesing + `cadKoblingVersjon` på `Project`, kobling fra rapporten i prosjektet, «løft til firma», firmaside `/dashbord/firma/tegninger` · T39, T43 | Kontrollør; FUNKSJONSENDRINGER.md ved merge | Kenneth 18.10 «ja» |
| **GJ-3 (reparasjon)** | § 9.7 K6.3 pkt. 1 + 4: XDATA kode 5 i registeret, `ifcMetadata.veggtyper`/`elementTyper` fra IFC (regex), oppslag ved lesing i `hentRegister`, bånd-stabling i render.py, kortets linje 1–3 for pri 1 og 4 · T44, T45, T47 · V1, V3, V5, V6, V8 | Kontrollør | ingen ny — presiserer K2/F1 |
| **GJ-4 (funksjonsendring)** | § 9.7 K6.3 pkt. 2 + 3: `kildeType "revittype"`/`"linjeblokk"` + `maal "veggtype"` i `CadKobling`, tabell `Veggtype` (migrering, partielle unike indekser, Zod, prosjektadmin/firma-admin), «Ny veggtype» fra kortet og fane på `/dashbord/firma/tegninger`, pri 2–3 i kortet · T46 · V2, V4, V7 | Kontrollør; FUNKSJONSENDRINGER.md ved merge | 🟡 Q15 — venter Kenneth |

GJ-1 først (uten «Ukjent» finnes det ingenting å koble), deretter GJ-3 (trenger registeret fra GJ-1), så GJ-2, og GJ-4 sist (trenger `CadKobling` fra GJ-2). Agent: Dokgen (eier render.py/register/ifcMetadata), redesign for firmasiden i GJ-2/GJ-4.
