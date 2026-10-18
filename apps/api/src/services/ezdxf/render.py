#!/usr/bin/env python3
"""ezdxf som DXF->SVG-motor bak SiteDocs eksisterende lag (DWG_MOTOR=ezdxf).

Motoren byttes inn bak flagget DWG_MOTOR i konverterDwg
(apps/api/src/services/dwgKonvertering.ts) og returnerer samme DxfSvgResultat-
form som den TS-interne `dxfTilSvg`: {svg, vbW, vbH, width, height,
autoRotasjon, startutsnitt}. Metadata skrives til --meta som JSON; TS leser
den og SVG-fila tilbake.

Arkitektur:
- ezdxf Frontend tegner geometri til native SVGBackend (= en Recorder).
  Vi leser player.recordings() -> primitiver i VERDENSKOORDINATER (DXF-enheter),
  med per-element farge + lineweight + lag + handle i BackendProperties.
- INGEN SVGBackend-subklasse. Vi bruker kun den offentlige Player-API-en.
- TextPolicy.IGNORE: ezdxf tegner IKKE tekst. Vi emitterer TEXT/MTEXT/ATTRIB
  som ekte <text> med samme kode som dxfTilSvg (fontStr=h/0.716,
  mtekstForankring, motrotering).
- viewBox i DXF-ENHETER med y-flip + 2% margin (som dxfTilSvg), IKKE ezdxf
  sin 1e6-normalisering -> mmPrPiksel/georef blir motor-uavhengig (krav 6).
- Strek i viewBox-enheter, INGEN vector-effect (hotfix 2-lærdom:
  non-scaling-stroke regnes mot feil CTM i iOS WebKit <img> -> svart flate).

Denne renderen SPEILER bevisst rotasjon/extents/robust-trim/startutsnitt fra
dxfTilSvg i Python, slik at egen og ezdxf gir samme ramme. Paritetstesten
(gate L10) er vakten mot drift mellom de to implementasjonene.

Sikkerhet (Kontrollør-gate): prosessen settes under et minnetak (RLIMIT_AS,
--mem-mb) ved oppstart; TS-laget spawner med execFile (ingen shell) og
tidsavbrudd. Kundefila leses kun; ingenting skrives utenfor --ut og --meta.
"""
from __future__ import annotations
import argparse, json, math, sys, time, html
from dataclasses import dataclass

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.svg import SVGBackend
from ezdxf.addons.drawing.config import (
    Configuration, TextPolicy, LineweightPolicy, LinePolicy, HatchPolicy,
    BackgroundPolicy, ColorPolicy,
)

CAP_RATIO = 0.716          # dwgKonvertering.ts:1296
LANGSIDE_PIKSEL = 2000     # dwgKonvertering.ts (hotfix mobil)
MARGIN_ANDEL = 0.02        # dwgKonvertering.ts:1954

# ---------- forenklet DXF for dxf-viewer (spike 0,5b, leveranse 1) ----------
# Egen fil for klienten som tegner DIREKTE fra rå DXF (dxf-viewer/WebGL) — SVG-veien
# og registeret (hit-test) bygges fortsatt fra den OPPRINNELIGE, upåvirkede DXF-en
# (full presisjon). Avrundingen her er <=0,1 mm, godt innenfor registerets egen 2 mm
# treffetoleranse (se hit_tol_world under) — målt 0-0,13 % pikselavvik, kun
# sub-piksel antialiasing (relay/arbeidstegning-prove/spike-05b). Fjerner KUN
# ikke-tegnet metadata (XDATA/extension-dicts/ubrukte blokker) + avrunder koordinater
# — aldri geometri som faktisk tegnes.
MM_PR_ENHET_FORENKLET = {0: 1.0, 1: 25.4, 2: 304.8, 3: 1609344.0, 4: 1.0, 5: 10.0,
                          6: 1000.0, 8: 0.0000254, 9: 0.0254, 10: 914.4, 13: 0.001, 14: 0.01}
_PUNKT_KODER_FORENKLET = set(range(10, 40))


def _forenklet_desimaler(doc) -> int:
    units = doc.header.get("$INSUNITS", 4) or 4
    mm_pr_enhet = MM_PR_ENHET_FORENKLET.get(units, 1.0)
    tol_enheter = 0.1 / mm_pr_enhet
    if tol_enheter <= 0:
        return 6
    dec = max(0, -math.floor(math.log10(tol_enheter)))
    return min(dec, 8)


def _forenklet_refererte_blokknavn(doc) -> set:
    referert = set()
    for e in list(doc.entitydb.values()):
        if not e.is_alive:
            continue
        t = e.dxftype()
        if t == "INSERT":
            navn = e.dxf.get("name", None)
            if navn:
                referert.add(navn)
        elif t == "DIMENSION":
            geo = e.dxf.get("geometry", None)
            if geo:
                referert.add(geo)
    for nokkel in ("$DIMBLK", "$DIMBLK1", "$DIMBLK2", "$DIMLDRBLK"):
        verdi = doc.header.get(nokkel, "")
        if verdi:
            referert.add(verdi)
    for dimstil in doc.dimstyles:
        for attr in ("dimblk", "dimblk1", "dimblk2", "dimldrblk"):
            verdi = dimstil.dxf.get(attr, "")
            if verdi:
                referert.add(verdi)
    return referert


def _forenklet_rund_koordinater(tekst: str, desimaler: int) -> str:
    # DXF ASCII er en streng (kode, verdi)-vekselrekke fra forste linje — MA
    # behandles parvis med fast steg 2 (en verdi som "24" ligger selv innenfor
    # punkt-kode-intervallet 10-39 og feiltolkes som ny kode ellers).
    har_siste_linjeskift = tekst.endswith("\n")
    linjer = tekst.split("\n")
    if har_siste_linjeskift:
        linjer = linjer[:-1]
    ut_desimaler = desimaler if desimaler > 0 else 1
    n = len(linjer)
    i = 0
    while i + 1 < n:
        kode_linje = linjer[i].strip()
        if kode_linje.isdigit() and int(kode_linje) in _PUNKT_KODER_FORENKLET:
            try:
                verdi = float(linjer[i + 1].strip())
                linjer[i + 1] = f"{round(verdi, desimaler):.{ut_desimaler}f}"
            except ValueError:
                pass
        i += 2
    resultat = "\n".join(linjer)
    return resultat + "\n" if har_siste_linjeskift else resultat


def _fjern_foreldrelose_dict_oppforinger(doc) -> int:
    """libredwg skriver iblant «unstable» class-objekter (MATERIAL/TABLESTYLE/
    MLEADERSTYLE — sett i konverteringslogg for enkelte Revit-DWG-er) som ender opp
    som foreldreløse håndtak i en DXF DICTIONARY. ezdxf sin egen
    `Dictionary.items()`/`.get()` returnerer da håndtak-STRENGEN i stedet for en
    entitet («can be a handle string if the entity does not exist», dokumentert i
    ezdxf/entities/dictionary.py) — og ezdxf sin EGEN `doc.saveas()`-skriving
    (`_update_header_vars()`, som slår opp `materials.get("ByLayer").dxf.handle` for
    $CMATERIAL) kræsjer da med `AttributeError: 'str' object has no attribute 'dxf'`.
    Målt 2026-10-14 på fallplanen i test-miljøet (libredwg Docker-bygg, ikke
    reprodusert med Homebrew-libredwg lokalt — selve kildefila er grensetilfellet,
    ikke koden). Rydd ALLE slike foreldreløse oppføringer FØR skriving, så én korrupt
    kildereferanse ikke tar ned hele artefakt-settet (register-world ville ellers gå
    tapt sammen med den forenklede DXF-en, se kallested i dwgKonvertering.ts)."""
    from ezdxf.entities import Dictionary
    n = 0
    for e in doc.entitydb.values():
        if isinstance(e, Dictionary):
            for navn, obj in list(e.items()):
                if isinstance(obj, str):
                    e.discard(navn)
                    n += 1
    return n


def skriv_forenklet_dxf(kilde_dxf_sti: str, ut_sti: str) -> dict:
    """Leser DXF-en PÅ NYTT (upåvirket kopi) og skriver en forenklet variant:
    XDATA + extension-dicts fjernet, ubrukte blokkdefinisjoner slettet (sikret
    mot DIMENSION-geometri/DIMSTYLE-pilblokker — se spike 0,5b-rapport), ikke-
    tegnede seksjoner (THUMBNAILIMAGE/ACDSDATA/ubrukt CLASSES) faller bort ved
    ezdxf sin egen skriving, og koordinater avrundet til <=0,1 mm. Returnerer
    tall til markøren (konverteringsrapport)."""
    doc = ezdxf.readfile(kilde_dxf_sti)
    xdata_n = 0
    extdict_n = 0
    for e in list(doc.entitydb.values()):
        if not e.is_alive:
            continue
        if e.xdata:
            e.xdata = None
            xdata_n += 1
        if e.has_extension_dict:
            e.discard_extension_dict()
            extdict_n += 1
    referert = _forenklet_refererte_blokknavn(doc)
    slettet_blokker = []
    for navn in [b.name for b in doc.blocks if not b.name.startswith("*")]:
        if navn in referert:
            continue
        try:
            doc.blocks.delete_block(navn, safe=True)
            slettet_blokker.append(navn)
        except Exception:
            pass  # i faktisk bruk (nested INSERT/layout/special) -> behold
    foreldrelose_n = _fjern_foreldrelose_dict_oppforinger(doc)
    desimaler = _forenklet_desimaler(doc)
    tmp_sti = ut_sti + ".tmp"
    doc.saveas(tmp_sti)
    with open(tmp_sti, "r", encoding="utf-8", errors="replace") as fh:
        tekst = fh.read()
    tekst = _forenklet_rund_koordinater(tekst, desimaler)
    with open(ut_sti, "w", encoding="utf-8") as fh:
        fh.write(tekst)
    import os
    os.remove(tmp_sti)
    return {"xdataStrippet": xdata_n, "extdictStrippet": extdict_n,
            "blokkerSlettet": len(slettet_blokker), "desimaler": desimaler,
            "foreldreloseDictOppforingerFjernet": foreldrelose_n}

# ---------- felles objektmodell O1 (arbeidstegning-spec § 8) ----------
# Revit BuiltInCategory -> norsk (målt AT-F6, arbeidstegning-spec.md § 1b).
BUILTIN_CAT = {
    -2000011: "Vegg", -2000023: "Dør", -2000014: "Vindu", -2000032: "Dekke",
    -2000035: "Tak", -2000038: "Himling", -2000100: "Søyle", -2000080: "Inventar",
    -2000220: "Akse", -2000240: "Nivå/kote", -2000260: "Målsetting", -2000300: "Tekst",
    -2000480: "Romtagg", -2000200: "Snittmarkør", -2001160: "VVS",
    -2005002: "Himlingskode", -2005011: "Veggkode", -2000588: "Vegg (projeksjon)",
}
# Skravurmønster -> materiale (AT-F1, F1 felt 4). Revit FP_n skjules (bare nummer).
MATERIALE = {
    "Betong_strukturell": "Betong", "Gips": "Gips", "Lettklinker": "Lettklinker",
    "Trefiber": "Trefiber",
}

def parse_revit_xdata(e):
    """REVIT-XDATA: nested {(1070,kode)(1000,verdi)}. kode 1=element-id,
    2=kategori (BuiltInCategory), 3=underkategori, 5=type-id (AT-F6)."""
    try:
        tags = e.get_xdata("REVIT")
    except Exception:
        return None
    if not tags:
        return None
    par = {}
    kode = None
    for (gc, val) in tags:
        if gc == 1070:
            kode = val
        elif gc == 1000 and kode is not None:
            par[kode] = val
            kode = None
    res = {}
    if 1 in par: res["elid"] = str(par[1])
    if 5 in par: res["typeId"] = str(par[5])
    if 2 in par:
        try: res["katKode"] = int(par[2])
        except Exception: res["katKode"] = par[2]
    if 3 in par: res["subKode"] = par[3]
    return res or None

def tolk_lagnavn(navn):
    """F1 felt 1 fallback: tolk bygningsdel/objekttype fra lagnavn — NS 3451
    (2-3 siffer, evt. A-prefiks), SOSI (3-4 siffer + mellomrom), IFC/AIA-prefiks."""
    if not navn:
        return ""
    base = navn
    m = re.match(r"^(\d{3,4})\s+(.+)$", base)             # SOSI: "8250 Kum"
    if m:
        return f"{m.group(2).strip()} · {m.group(1)}"
    m = re.match(r"^A(\d{2,4})[_\- ]?(.*)$", base)         # "A24_innervegg"
    if m and m.group(1):
        rest = m.group(2).strip()
        return f"{rest} · {m.group(1)}" if rest else m.group(1)
    m = re.match(r"^(\d{2,3})[-.\s]+(.+)$", base)          # "242- Ikke-bærende..."
    if m:
        rest = re.sub(r"\((Skravur|Tekst|Nye konstruksjoner|Polylinje)\)", "", m.group(2)).strip()
        return f"{rest} · {m.group(1)}"
    return base

def layer_info_map(doc):
    """Lag -> {aci, ltype, lw, desc}. `description` er en property (AT-F14:
    lagbeskrivelse fra fila, f.eks. POINT-arkitektmodul), ikke et DXF-attributt."""
    ut = {}
    for lay in doc.layers:
        lw = lay.dxf.get("lineweight", None)
        ut[lay.dxf.name] = {
            "aci": lay.dxf.color, "ltype": lay.dxf.linetype,
            "lw": (lw if lw not in (None, -3, -1) else None),
            "desc": (getattr(lay, "description", "") or ""),
        }
    return ut

def bygg_objektregister(doc, msp, handles, lagmap):
    """O1 pr. handle som faktisk er tegnet. Kategori-prioritet (F1 felt 1):
    Revit-XDATA -> lagbeskrivelse fra fila -> lagnavn-tolkning. Rå lagnavn
    følger alltid med (§ 8, O1 egenskaper)."""
    objekter = {}
    elid_index = {}
    insert_info = {}
    for ins in msp.query("INSERT"):
        h = ins.dxf.handle
        atts = {a.dxf.tag: a.dxf.text for a in ins.attribs if (a.dxf.text or "").strip()}
        # attrMeta (GATE 3-TELEFON pkt 1): egen posisjon/høyde/rotasjon pr. ATTRIB — INSERT-
        # ens samlede bbox dekker HELE blokken (dørsymbol+ramme m.m.), ikke der teksten faktisk
        # sitter. Kun i register-world (rå DXF-verdenskoord, ingen SVG-transform å tolke).
        attr_meta = {
            a.dxf.tag: {
                "x": round(a.dxf.get("insert", (0, 0))[0], 3),
                "y": round(a.dxf.get("insert", (0, 0))[1], 3),
                "h": round(a.dxf.get("height", 0.0), 3),
                "rot": round(a.dxf.get("rotation", 0.0), 2),
            }
            for a in ins.attribs if (a.dxf.text or "").strip()
        }
        insert_info[h] = {"navn": ins.dxf.name, "attr": atts, "attrMeta": attr_meta}
    hatch_info = {h.dxf.handle: h.dxf.get("pattern_name", "") for h in msp.query("HATCH")}
    for h in handles:
        e = doc.entitydb.get(h)
        if e is None:
            continue
        lag = e.dxf.get("layer", "") or ""
        lm = lagmap.get(lag, {})
        obj = {"id": h, "lag": lag, "dtype": e.dxftype()}
        rev = parse_revit_xdata(e)
        kat = None
        if rev:
            if "elid" in rev: obj["elid"] = rev["elid"]
            if "typeId" in rev: obj["typeId"] = rev["typeId"]
            kk = rev.get("katKode")
            if isinstance(kk, int):
                kat = BUILTIN_CAT.get(kk, f"Kategori {kk}")
        if not kat and lm.get("desc"):
            kat = lm["desc"]
        if not kat:
            kat = tolk_lagnavn(lag) or lag
        obj["kategori"] = kat
        if h in insert_info:
            obj["blokk"] = insert_info[h]["navn"]
            if insert_info[h]["attr"]:
                obj["attr"] = insert_info[h]["attr"]
                if insert_info[h]["attrMeta"]:
                    obj["attrMeta"] = insert_info[h]["attrMeta"]
        if h in hatch_info:
            pn = hatch_info[h]
            if pn in MATERIALE:
                obj["materiale"] = MATERIALE[pn]
            elif pn and not pn.startswith("FP_") and pn != "SOLID":
                obj["materialeRaa"] = pn
        lt = e.dxf.get("linetype", "BYLAYER")
        if lt and lt != "BYLAYER":
            obj["linjetype"] = lt
        obj["lagLinjetype"] = lm.get("ltype", "")
        obj["lagLw"] = lm.get("lw")
        if (lt or "").lower().startswith("demol") or lm.get("ltype", "").lower().startswith("demol"):
            obj["status"] = "rives"
        elif "Nye konstruksjoner" in lag:
            obj["status"] = "nytt"
        objekter[h] = obj
        if "elid" in obj:
            elid_index.setdefault(obj["elid"], []).append(h)
    return objekter, elid_index


def tolk_lag_gruppe(navn):
    """F2 gruppe-NØKKEL fra lagnavn (fallback når laget ikke har en dominant Revit-
    kategori, se lag_dominante_revit_kategorier()): NS 3451 (2-3 siffer, med/uten
    A-prefiks), AIA/IFC-prefiks (A-/S-/P-/I-/Q-), SOSI (3-4 siffer + mellomrom).
    Returnerer BARE koden/prefikset (ikke resten av navnet som tolk_lagnavn() —
    ingen NS 3451-kode→tekst-oppslagstabell finnes i kodebasen i dag, så koden ER
    etiketten til en slik tabell finnes). '' = ingen treff (kalleren faller til "Andre")."""
    if not navn:
        return ""
    m = re.match(r"^(\d{3,4})\s+", navn)       # SOSI: "8250 Kum" -> "8250"
    if m:
        return m.group(1)
    m = re.match(r"^A(\d{2,4})[_\- ]?", navn)  # "A24_innervegg" -> "24" (NS 3451 uten A)
    if m:
        return m.group(1)
    m = re.match(r"^(\d{2,3})[-.\s]", navn)    # "242- Ikke-bærende..." -> "242"
    if m:
        return m.group(1)
    m = re.match(r"^([ASPIQ])-", navn)         # AIA/IFC: "A-", "S-", "P-", "I-", "Q-"
    if m:
        return f"{m.group(1)}-"
    return ""

# NS 3451:2022 kode -> navn (Statsbygg PA 0802 TFM vedlegg 9.1, revisjon 5,
# godkjent 17.02.2026 — offisiell bygningsdelstabell, hentet for RETUR F1+F2 web,
# 2026-10-17: "Kenneth leser ikke koder"). Dekker hoveddel 2-7 (2- og 3-siffer).
# IKKE ArchiCAD/Revit sine EGNE interne lagkoder i 80-89-serien (snittmarkør,
# nettoareal, modullinjer m.m.) — disse har SAMME "NNN- "-mønster i lagnavnet
# som ekte NS 3451-koder, men er IKKE en del av standarden (MÅLT på fallplanen:
# "82-- Modullinjer", "852-...", "858-...", "862-..." — ekte NS 3451 stopper på
# 79 Andre utendørs anlegg). Disse faller bevisst til "Andre" i gruppe_visningsnavn().
NS3451_NAVN = {
    "20": "Bygning, generelt",
    "21": "Grunn og fundamenter", "211": "Klargjøring av tomt", "212": "Byggegrop",
    "213": "Grunnforsterkning", "214": "Støttekonstruksjoner", "215": "Pelefundamentering",
    "216": "Direkte fundamentering", "217": "Drenering", "218": "Utstyr og komplettering",
    "219": "Andre deler av grunn og fundamenter",
    "22": "Bærende konstruksjoner", "221": "Rammer", "222": "Søyler", "223": "Bjelker",
    "224": "Avstivende konstruksjoner", "225": "Brannbeskyttelse av bærende konstruksjoner",
    "226": "Kledning og overflate", "228": "Utstyr og komplettering for bærende konstruksjoner",
    "229": "Andre deler av bærende konstruksjoner",
    "23": "Yttervegger", "231": "Bærende yttervegger", "232": "Ikke-bærende yttervegger",
    "233": "Glassfasader", "234": "Vinduer, dører, porter", "235": "Utvendig kledning og overflate",
    "236": "Innvendig overflate", "237": "Solavskjerming", "238": "Utstyr og komplettering",
    "239": "Andre deler av yttervegger",
    "24": "Innervegger", "241": "Bærende innervegger", "242": "Ikke-bærende innervegger",
    "243": "Systemvegger og glassfelt", "244": "Vinduer, dører, foldevegger", "245": "Skjørt",
    "246": "Kledning og overflate", "248": "Utstyr og komplettering",
    "249": "Andre deler av innervegger",
    "25": "Dekker", "251": "Frittbærende dekker", "252": "Gulv på grunn, bunnplate",
    "253": "Oppført gulv og påstøp", "254": "Systemgulv", "255": "Gulvoverflate",
    "256": "Faste himlinger og overflatebehandling", "257": "Systemhimlinger",
    "258": "Utstyr og komplettering", "259": "Andre deler av dekker",
    "26": "Yttertak", "261": "Primærkonstruksjon for yttertak", "262": "Taktekning",
    "263": "Glasstak, overlys, takluker, røykluker", "264": "Takoppbygg",
    "265": "Gesimser, takrenner og nedløp", "266": "Himling og innvendig overflate",
    "267": "Prefabrikerte takelementer", "268": "Utstyr og komplettering",
    "269": "Andre deler av yttertak",
    "27": "Fast inventar", "271": "Murte piper og ildsteder", "272": "Monteringsferdige ildsteder",
    "273": "Kjøkkeninnredning", "274": "Innredning og garnityr for våtrom",
    "275": "Skap og reoler", "276": "Sittebenker, stolrader, bord", "277": "Skilt og tavler",
    "278": "Utstyr og komplettering", "279": "Annet fast inventar",
    "28": "Trapper, balkonger m.m.", "281": "Innvendige trapper", "282": "Utvendige trapper",
    "283": "Ramper", "284": "Balkonger og verandaer", "285": "Tribuner og amfier",
    "286": "Baldakiner og skjermtak", "287": "Andre rekkverk, håndlister og fendere",
    "288": "Utstyr og komplettering for trapper, balkonger m.m.",
    "289": "Andre trapper, balkonger m.m.",
    "29": "Andre bygningsmessige deler", "290": "Andre bygningsmessige deler",
    "291": "Hull, tettinger",
    "30": "VVS-installasjoner, generelt",
    "31": "Sanitær", "310": "Sanitæranlegg", "311": "Bunnledninger for sanitærinstallasjoner",
    "314": "Armaturer for sanitærinstallasjon", "315": "Utstyr for sanitærinstallasjon",
    "316": "Isolasjon av sanitærinstallasjon",
    "32": "Varme", "320": "Varmeanlegg", "321": "Bunnledninger for varmeinstallasjon",
    "322": "Ledningsnett for varmeinstallasjon", "324": "Armaturer for varmeinstallasjon",
    "325": "Utstyr for varmeinstallasjon", "326": "Isolasjon av varmeinstallasjon",
    "329": "Annen varmeinstallasjon",
    "33": "Brannslokking", "331": "Installasjon for manuell brannslokking med vann",
    "332": "Installasjon for brannslokking med sprinkler",
    "333": "Installasjon for brannslokking med vanntåke",
    "334": "Installasjon for brannslokking med pulver",
    "335": "Installasjon for brannslokking med gass",
    "336": "Installasjon for brannslokking med skum", "337": "Brannslokking med håndslukker",
    "339": "Andre deler av installasjoner for brannslokking",
    "34": "Gass og trykkluft", "341": "Installasjon for gass til bygningsdrift",
    "342": "Installasjon for gass til virksomhet", "343": "Installasjon for medisinske gasser",
    "345": "Installasjon for trykkluft til virksomhet",
    "346": "Installasjon for medisinsk trykkluft", "347": "Installasjon for vakuumanlegg",
    "348": "Spesialavtrekk for gasser", "349": "Andre installasjoner til gass- og trykkluft",
    "35": "Varmepumpe- og kuldeinstallasjoner",
    "351": "Installasjoner for kjøling av kjølerom", "352": "Installasjoner for kjøling av fryserom",
    "353": "Installasjoner til kjøling for virksomhet",
    "354": "Installasjoner til kjøling og varme for industri og produksjon",
    "355": "Installasjoner til kjøling for innenders idrettsbaner",
    "356": "Installasjoner for oppvarming og kjøling i bygg",
    "359": "Andre deler for varmepumpe- og kuldeinstallasjoner",
    "36": "Luftbehandling", "360": "Luftbehandling", "364": "Utstyr for luftfordeling",
    "365": "Utstyr for luftbehandling", "366": "Isolasjon av installasjon for luftbehandling",
    "369": "Annet utstyr for luftbehandling",
    "37": "Komfortkjøling", "370": "Komfortkjøleanlegg", "374": "Armatur for komfortkjøling",
    "375": "Utstyr for komfortkjøling", "376": "Isolasjon av installasjon for komfortkjøling",
    "379": "Annen komfortkjøling",
    "38": "Vannbehandling", "381": "Installasjon for rensing av vann",
    "382": "Installasjon for rensing av avløpsvann",
    "383": "Installasjon for vannrensing til svømmebasseng",
    "386": "Innendørs fontener og springvann", "389": "Annen vannbehandling",
    "39": "Andre VVS-installasjoner", "390": "Andre VVS-installasjoner",
    "40": "Elkraftinstallasjoner, generelt",
    "41": "Basisinstallasjon for elkraft", "411": "Kabelføring for elkraftinstallasjoner",
    "412": "Jording for elkraftinstallasjoner", "413": "Lynvern",
    "414": "Systemer for elkrafttak", "419": "Andre basisinstallasjoner for elkraft",
    "42": "Høyspent forsyning", "421": "Installasjoner for høyspent fordeling",
    "422": "Nettstasjoner", "429": "Andre deler for høyspent forsyning",
    "43": "Lavspent forsyning", "431": "Installasjoner for elkraftinntak",
    "432": "Installasjoner for hovedfordeling", "433": "Elkraftfordeling til alminnelig forbruk",
    "434": "Elkraftfordeling til driftstekniske installasjoner",
    "435": "Elkraftfordeling til virksomhet", "436": "Elkraftfordeling til lading",
    "439": "Andre deler for lavspent forsyning",
    "44": "Lys", "442": "Belysning", "443": "Nødlys",
    "449": "Andre deler for installasjoner til lys",
    "45": "Elvarme", "450": "Elvarme", "452": "Varmeovner",
    "453": "Varmeelementer for innebygging", "454": "Vannvarmere og elektrokjeler",
    "459": "Annen elvarme",
    "46": "Reservekraft", "461": "Elkraftaggregater", "462": "Avbruddsfri kraftforsyning",
    "463": "Akkumulatoranlegg", "469": "Andre deler for reservekraftforsyning",
    "47": "Lokal elkraftproduksjon", "471": "Solceller", "472": "Vindmøller",
    "479": "Andre deler for lokal elkraftproduksjon",
    "48": "Installasjon for elektrisk beskyttelse", "481": "Elektrisk korrosjonsbeskyttelse",
    "482": "Elektrisk sikkerhet for forebygging mot uønskede hendelser",
    "489": "Andre deler for installasjon for elektrisk beskyttelse",
    "49": "Andre elkraftinstallasjoner", "490": "Andre elkraftinstallasjoner",
    "50": "Ekom og automatisering, generelt",
    "51": "Basisinstallasjoner for ekom og automatisering", "511": "Kabelføring",
    "512": "Jording", "514": "Inntak for ekom og automatisering",
    "515": "Fordelinger for ekom og automatisering",
    "519": "Andre basisinstallasjoner for ekom og automatisering",
    "52": "Integrert kommunikasjon", "520": "Integrert kommunikasjon", "521": "Kabling for IKT",
    "522": "Nettutstyr", "523": "Sentralutstyr", "524": "Terminalutstyr",
    "529": "Spredenett for eiendomsdrift",
    "53": "Telefoni og personsøking", "532": "Telefoni", "533": "Nødkommunikasjon",
    "534": "Porttelefoner", "535": "Høyttalende hustelefoner", "536": "Personsøking",
    "539": "Andre deler for telefoni og personsøking",
    "54": "Alarm- og signal", "542": "Brannalarm",
    "543": "Adgangskontroll, innbrudds- og overfallsalarm", "544": "Pasientsignal",
    "545": "Uranlegg og tidsregistrering", "546": "Alarm knyttet til bygning eller installasjon",
    "549": "Andre deler for alarm og signal",
    "55": "Lyd og bilde", "552": "Fellesantenne", "553": "Internfjernsyn",
    "554": "Lyddistribusjonsanlegg", "555": "Lydanlegg", "556": "Bilde og AV",
    "559": "Andre deler for lyd og bilde",
    "56": "Automatisering", "562": "Sentral driftskontroll og automatisering",
    "563": "Lokal automatisering", "564": "Installasjoner for buss-systemer",
    "569": "Andre deler for automatisering",
    "57": "Instrumentering", "570": "Instrumentering", "571": "Kabling for instrumentering",
    "572": "Instrumentering for måling av mengde", "573": "Instrumentering for måling av trykk",
    "574": "Instrumentering for måling av temperatur",
    "575": "Instrumentering for måling av lengde", "576": "Instrumentering for måling av vekt",
    "577": "Instrumentering for måling av elektriske størrelser",
    "578": "Instrumentering for analyse", "579": "Annen instrumentering",
    "59": "Andre installasjoner for ekom og automatisering",
    "590": "Andre installasjoner for ekom og automatisering",
    "60": "Andre installasjoner, generelt",
    "61": "Prefabrikerte rom", "611": "Prefabrikerte kjølerom", "612": "Prefabrikerte fryserom",
    "613": "Prefabrikerte baderom", "614": "Prefabrikerte skjermrom",
    "615": "Prefabrikkerte moduler for sjakter og himlinger", "619": "Andre prefabrikerte rom",
    "62": "Person- og varetransport", "621": "Heiser", "622": "Rulletrapper",
    "623": "Rullebånd", "624": "Løftebord", "625": "Trappeheiser", "626": "Kraner",
    "627": "Fasade- og takvask", "629": "Annen person- og varetransport",
    "63": "Transportanlegg", "631": "Dokument og småvaretransportører",
    "632": "Transportanlegg for tørr og løs masse",
    "633": "Transportanlegg for drivstoff, olje og kjemikalier",
    "634": "Selvgående transportører", "639": "Andre transportanlegg",
    "64": "Lokal varmeproduksjon", "641": "Kogenerering – CHP", "642": "Solfanger",
    "649": "Annen lokal varmeproduksjon",
    "65": "Avfall og støvsuging", "651": "Utstyr for oppsamling og behandling av avfall",
    "652": "Sentralstøvsuger", "653": "Pneumatisk søppeltransport",
    "659": "Andre installasjoner for avfall og støvsuging",
    "66": "Fastmontert spesialutrustning for virksomhet",
    "660": "Utstyr for fastmontert spesialutrustning for virksomhet",
    "67": "Løs spesialutrustning for virksomhet",
    "670": "Utstyr for løs spesialutrustning for virksomhet",
    "68": "Inventar", "680": "Deler til inventar",
    "69": "Andre tekniske installasjoner", "690": "Andre tekniske installasjoner",
    "70": "Utendørs, generelt",
    "71": "Bearbeidet terreng", "711": "Grovplanert terreng", "712": "Drenering",
    "713": "Forsterket grunn", "714": "Grøfter og groper for tekniske installasjoner",
    "715": "Bergrom", "719": "Annen terrengbearbeiding",
    "72": "Utendørs konstruksjoner", "721": "Utendørs støttemurer og andre murer",
    "722": "Utendørs trapper, ramper, terrasser, platting i terreng",
    "723": "Utendørs skjørtak, leskur m.m. som henger sammen med bygning",
    "724": "Utendørs svømmebassenger m.m.", "725": "Utendørs gjerder, porter og bommer",
    "726": "Utendørs kanaler og kulverter for tekniske installasjoner",
    "727": "Utendørs kummer og tanker for tekniske installasjoner",
    "729": "Andre utendørs konstruksjoner",
    "73": "Utendørs røranlegg", "731": "Utendørs VA", "732": "Utendørs varme",
    "733": "Utendørs brannslokking", "734": "Utendørs gassinstallasjon",
    "735": "Utendørs kjøling for idrettsbaner", "736": "Utendørs luftbehandlingsanlegg",
    "737": "Utendørs forsyningsanlegg for termisk energi",
    "738": "Utendørs fontener og springvann", "739": "Andre utendørs røranlegg",
    "74": "Utendørs elkraft", "742": "Utendørs høyspent forsyning",
    "743": "Utendørs lavspent forsyning", "744": "Utendørs lys", "745": "Utendørs elvarme",
    "746": "Utendørs reservekraft", "749": "Andre installasjoner for utendørs elkraft",
    "75": "Utendørs ekom og automatisering", "752": "Utendørs integrert kommunikasjon",
    "753": "Utendørs telefoni og personsøking", "754": "Utendørs alarm og signal",
    "755": "Utendørs lyd og bilde", "756": "Utendørs automatisering",
    "759": "Andre installasjoner for utendørs ekom og automatisering",
    "76": "Veier og plasser", "761": "Veier", "762": "Plasser", "763": "Utendørs skilter",
    "764": "Utendørs sikkerhetsrekkverk, avvisere, guard-rail m.m.",
    "769": "Andre deler for veier og plasser",
    "77": "Parker og grøntanlegg", "771": "Utendørs gressarealer", "772": "Utendørs beplantning",
    "773": "Utendørs utstyr", "774": "Utendørs plasser for idrett og kultur",
    "775": "Utendørs tribuner og amfier", "779": "Andre deler for park og grøntanlegg",
    "78": "Utendørs infrastruktur",
    "783": "Utendørs tilknytning til eksterne nett for vannforsyning, avløp og fjernvarme",
    "784": "Utendørs tilknytning til eksternt elkraftnett",
    "785": "Utendørs tilknytning til eksternt telenett",
    "789": "Andre deler for utendørs infrastruktur",
    "79": "Andre utendørs anlegg", "790": "Andre utendørs anlegg",
}

# AIA CAD Layer Guidelines-fagkode -> norsk. IFC-eksport-konvensjonen
# "<fag>-<type>-<modifikator>-OTLN" (MÅLT på fallplanen: A-WALL/A-DOOR/A-FLOR/
# A-ROOF/A-AREA/A-GENM/A-GLAZ = Arkitektur-elementer, S-COLS/S-STRS = søyler/
# trapper (Konstruksjon), P-SANR = sanitærutstyr (VVS/rør, samsvarer med NS 3451
# 315), I-WALL = interiørvegg (Interiør), Q-CASE = fast innredning/casework
# (Utstyr) — sub-kodene bekrefter fagkoden). Alle fem bekreftet av Kenneth
# (SVAR F1+F2 web r2, orkestrator 2026-10-17).
AIA_FAG_NAVN = {
    "A": "Arkitekt", "S": "Konstruksjon", "P": "VVS (rør)", "I": "Interiør", "Q": "Utstyr",
}

def gruppe_visningsnavn(kode, revit_kategori=None):
    """F2 (RETUR F1+F2 web, orkestrator 2026-10-17): gruppenavn med NAVN — Kenneth
    leser ikke rå koder. `kode` er `tolk_lag_gruppe()` sin returverdi, `revit_kategori`
    er `lag_dominante_revit_kategorier()` sitt treff for laget (allerede
    menneskelesbar norsk, f.eks. "Vegger" — brukes uendret når den finnes).
    Ukjent/manglende kode -> "Andre" (selve koden vises fortsatt separat av UI-en
    foran navnet i grått, se LagPanel.tsx — unngår duplisert kode i selve teksten)."""
    if revit_kategori:
        return revit_kategori
    if not kode:
        return "Andre"
    if kode.endswith("-") and kode[:-1] in AIA_FAG_NAVN:
        return AIA_FAG_NAVN[kode[:-1]]
    return NS3451_NAVN.get(kode, "Andre")

def lag_dominante_revit_kategorier(objekter):
    """F2 B7: gruppe «Vegger» slår av lag A23/A24/A85 samtidig — kategorien kommer
    fra Revit-XDATA PÅ OBJEKTENE, ikke fra lagnavnet, når XDATA finnes. Pr. lag:
    mest frekvente kategori blant objektene MED elid (rene lag-DWG uten XDATA gir
    ingen treff her og faller til tolk_lag_gruppe())."""
    tellere = {}
    for o in objekter.values():
        if "elid" not in o:
            continue
        kat = o.get("kategori")
        if not kat:
            continue
        c = tellere.setdefault(o["lag"], {})
        c[kat] = c.get(kat, 0) + 1
    return {lag: max(c.items(), key=lambda kv: kv[1])[0] for lag, c in tellere.items()}

def beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat):
    """AT-F10/A12/A14 (§7 pkt 17): for strek-/kurve-objekter uten egen tekst eller
    blokkattributt på et RÅTT fag-internt system-lag (V3411, E556 — altså et lag
    UTEN NS 3451/AIA/SOSI-prefiks-treff og uten Revit-XDATA-kategori, se
    tolk_lag_gruppe()/lag_dominante_revit_kategorier()), finn nærmeste TEXT/MTEXT/
    ATTRIB på et tekstlag (lagnavn med "(Tekst)") innen avstand = tekstens egen
    høyde × 4. ALLTID tolket/merket som sådan — settes ALDRI som objektets egen
    verdi. Ingen tekst innen grensen -> feltet utelates helt (A12 negativkontroll).

    Lag-avgrensningen er MÅLT nødvendig (fallplanen, før denne ble lagt til): uten
    den fikk ordinære vegglinjer og IFC-importert sanitærutstyr feilaktig en
    tilfeldig nærliggende romtekst ("Sluse"/"TOAL.") som "nærmeste merking" — rene
    NS 3451/AIA-lag har alltid EGEN kategori og skal aldri gjennom denne tolkningen.

    Tekstlag-konvensjon varierer med fag (MÅLT): NS 3451-filer bruker parentes-
    suffiks "(Tekst)"; MEP-filer (VB3-1074) bruker et DELT "-T"-lag pr. system
    (V3411-V3416 sin tekst ligger samlet på "V341-T", ikke pr. geometrilag)."""
    kandidater = [
        t for t in tekster
        if (("(tekst)" in (t.get("layer") or "").lower()) or (t.get("layer") or "").lower().endswith("-t"))
        and (t.get("tekst") or "").strip() and (t.get("h") or 0) > 0
    ]
    if not kandidater:
        return
    for o in objekter_world.values():
        if o.get("attr") or o.get("blokk") or o["dtype"] in ("TEXT", "MTEXT", "ATTRIB"):
            continue
        lag = o["lag"]
        if lag in lag_dominant_kat or tolk_lag_gruppe(lag):
            continue  # NS 3451/AIA/SOSI/XDATA-lag har egen kategori — ikke et "umerket" system-lag.
        bb = o.get("bbox")
        if not bb:
            continue
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        best, best_d = None, None
        for t in kandidater:
            grense = t["h"] * 4
            d = math.hypot(cx - t["x"], cy - t["y"])
            if d <= grense and (best_d is None or d < best_d):
                best, best_d = t["tekst"].strip(), d
        if best:
            o["naermesteMerking"] = best


def sett_minnetak(mem_mb: int) -> None:
    """Selvpålagt minnetak via RLIMIT_AS (unix). Ingen shell/ulimit trengs — en
    kundefil som sprenger taket dreper prosessen i stedet for serveren. No-op der
    `resource` mangler (ikke-unix)."""
    if not mem_mb or mem_mb <= 0:
        return
    try:
        import resource
        cap = mem_mb * 1024 * 1024
        _, hard = resource.getrlimit(resource.RLIMIT_AS)
        ny_hard = cap if hard == resource.RLIM_INFINITY else min(cap, hard)
        resource.setrlimit(resource.RLIMIT_AS, (cap, ny_hard))
    except Exception as e:
        print(f"[ezdxf] minnetak ikke satt: {e}", file=sys.stderr)

# ---------- geometri-hjelpere (speiler dxfTilSvg) ----------

def koord_desimaler(vb_per_px: float) -> int:
    # dwgKonvertering.ts:1725
    return min(6, max(0, math.ceil(-math.log10(max(vb_per_px, 1e-9) * 0.05))))

def rund_fn(dec: int):
    f = 10 ** dec
    return lambda v: round(v * f) / f

@dataclass
class Prim:
    kind: str            # 'stroke' | 'fill'
    d: str               # SVG path-data i VERDENSKOORD (M/L/C, før transform)
    color: str           # #rrggbb
    lineweight: float    # mm (0 = default/ByLayer uoppgitt)
    layer: str
    handle: str
    dtype: str = ""      # DXF-entitetstype utledet fra handle (for data-type)
    pts: list | None = None  # KORREKSJON treff (Kenneth 2026-10-13): liste av polylinjer
                          # (hver en liste (x,y)-tupler) i VERDENSKOORD, kun for kind=='stroke'
                          # og kun når register-world sin treffetest trenger ekte geometri (ikke
                          # kontrollpunkter — path_til_d sin d-streng bærer Bezier-KONTROLLpunkter
                          # for Q/C, som ikke ligger PÅ kurven og derfor ikke kan brukes til
                          # avstandsmåling). None for fill (flate taper alltid mot kontur/symbol —
                          # bbox-containment er nok, se erFlateObjekt i harness).

# ---------- rotasjon (speiler dominantVeggvinkel/velgAutoRotasjon) ----------

def dominant_veggvinkel(segmenter):
    # dwgKonvertering.ts:981 — lengdevektet vinkelhistogram mod 90, 1-grads binner
    if len(segmenter) < 20:
        return None
    bins = [0.0] * 90
    total = 0.0
    for (x1, y1, x2, y2) in segmenter:
        dx, dy = x2 - x1, y2 - y1
        lengde = math.hypot(dx, dy)
        if lengde < 1e-9:
            continue
        v = math.degrees(math.atan2(dy, dx)) % 90.0
        bins[int(v) % 90] += lengde
        total += lengde
    if total <= 0:
        return None
    topp = max(range(90), key=lambda i: bins[i])
    # sub-grads lengdevektet snitt rundt toppen (+/-1)
    num = den = 0.0
    for off in (-1, 0, 1):
        i = (topp + off) % 90
        num += (topp + off) * bins[i]
        den += bins[i]
    grader = (num / den) % 90 if den else float(topp)
    andel = sum(bins[(topp + o) % 90] for o in (-1, 0, 1)) / total
    return {"grader": grader, "andel": andel}

def normaliser180(g):
    while g > 180: g -= 360
    while g <= -180: g += 360
    return g

def velg_auto_rotasjon(vegg, tekstrot):
    # dwgKonvertering.ts:1028
    base = -vegg
    best, best_score, best_abs = 0.0, -1.0, 1e9
    for kand in (base, base + 90, base + 180, base + 270):
        R = normaliser180(kand)
        score = 0.0
        for (g, vekt) in tekstrot:
            if abs(normaliser180(g + R)) <= 45:
                score += vekt
        if score > best_score or (score == best_score and abs(R) < best_abs):
            best, best_score, best_abs = R, score, abs(R)
    return best

# ---------- robust ytter-trimming (speiler robustGrense) ----------

def robust_grense(verdier, gap_andel=0.03, maks_trim=0.02, bins=512):
    """Skreller isolerte ytter-klynger (<= maks_trim av punktene) bak et tomt gap
    (>= gap_andel av spennet). No-op på rene tegninger. Speiler dwgKonvertering.ts:1126."""
    if not verdier:
        return (0.0, 0.0)
    lo, hi = min(verdier), max(verdier)
    spenn = hi - lo
    if spenn < 1e-9:
        return (lo, hi)
    bw = spenn / bins
    tel = [0] * bins
    for v in verdier:
        i = min(bins - 1, int((v - lo) / bw))
        tel[i] += 1
    n = len(verdier)
    gap_min = max(1, math.ceil(gap_andel * spenn / bw))  # bins
    maks = maks_trim * n

    def finn_start(order):
        idx = list(order)
        trimmet = 0
        pos = 0
        start = idx[0]
        while pos < len(idx):
            while pos < len(idx) and tel[idx[pos]] == 0:
                pos += 1
            if pos >= len(idx):
                break
            start = idx[pos]
            klynge = 0
            stor_gap = False
            while pos < len(idx):
                if tel[idx[pos]] > 0:
                    klynge += tel[idx[pos]]; pos += 1
                else:
                    q = pos
                    while q < len(idx) and tel[idx[q]] == 0:
                        q += 1
                    if (q - pos) >= gap_min:
                        stor_gap = True
                        break           # klyngen slutter ved stort gap
                    pos = q             # lite hull -> samme klynge
            if stor_gap and (trimmet + klynge) <= maks:
                trimmet += klynge       # isolert liten ytterklynge -> skrell
                continue
            return start                # hovedmassen starter her
        return start

    lo_bin = finn_start(range(bins))
    hi_bin = finn_start(range(bins - 1, -1, -1))
    return (lo + lo_bin * bw, lo + (hi_bin + 1) * bw)

# ---------- hovedrender ----------

def rot_matrise(R_grader, cx, cy):
    r = math.radians(R_grader)
    c, s = math.cos(r), math.sin(r)
    return (c, s, cx, cy)

def roter_pkt(x, y, m):
    c, s, cx, cy = m
    dx, dy = x - cx, y - cy
    return (cx + dx * c - dy * s, cy + dx * s + dy * c)

def hent_primitiver(player, flatten_dist, db=None, hit_tol=None):
    # hit_tol (verdenskoord, kun satt når --register-world): slår PÅ innsamling av ekte
    # polylinje-geometri (pts) pr. strek-primitiv, til KORREKSJON-treffetesten (avstand
    # punkt->segment, ikke bbox-kant). record.path.flattening(hit_tol) gir punkter PÅ
    # kurven (bue/spline), i motsetning til path_til_d sin Bezier-kontrollpunkt-streng.
    prims = []
    for record, props in player.recordings():
        color = props.color[:7] if props.color else "#000000"
        lw = float(props.lineweight or 0.0)
        layer = props.layer or ""
        handle = props.handle or ""
        dtype = ""
        if db is not None and handle:
            e = db.get(handle)
            if e is not None:
                dtype = e.dxftype()
        cls = type(record).__name__
        # KORREKSJON-MÅLING (Kenneth 2026-10-13): HATCH/SOLID er ALLTID "flate" i harnessets
        # erFlateObjekt() og treffer kun via bbox-containment (tier 1, taper alltid mot kontur/
        # symbol) — geometri der er ren kost uten gevinst. MÅLT: ezdxf tegner skravurMØNSTERET
        # (ANSI31 m.m.) som ekte strek-primitiver attribuert til HATCH-handelet (kind='stroke',
        # dtype='HATCH'), IKKE som én fylt bane — uten dette unntaket ble registeret 40 MB/
        # 1,0 mill. polylinjer (933 200 fra HATCH alene) i stedet for titusener.
        tol = hit_tol if dtype not in ("HATCH", "SOLID") else None
        if cls == "PathRecord":
            d = path_til_d(record.path, flatten_dist, close=False)
            if d:
                pts = None
                if tol is not None:
                    verts = [(v.x, v.y) for v in record.path.flattening(tol)]
                    if len(verts) >= 2:
                        pts = [verts]
                prims.append(Prim("stroke", d, color, lw, layer, handle, dtype, pts))
        elif cls == "FilledPathsRecord":
            ds = [path_til_d(p, flatten_dist, close=True) for p in record.paths]
            ds = [x for x in ds if x]
            if ds: prims.append(Prim("fill", " ".join(ds), color, lw, layer, handle, dtype))
        elif cls == "PointsRecord":
            pts = record.points.vertices()
            n = len(pts)
            if n > 2:  # fylt polygon
                d = "M " + " L ".join(f"{p.x:.4f} {p.y:.4f}" for p in pts) + " Z"
                prims.append(Prim("fill", d, color, lw, layer, handle, dtype))
            elif n == 2:
                p0, p1 = pts
                geo = [[(p0.x, p0.y), (p1.x, p1.y)]] if tol is not None else None
                prims.append(Prim("stroke", f"M {p0.x:.4f} {p0.y:.4f} L {p1.x:.4f} {p1.y:.4f}", color, lw, layer, handle, dtype, geo))
            elif n == 1:
                p = pts[0]
                geo = [[(p.x, p.y)]] if tol is not None else None
                prims.append(Prim("stroke", f"M {p.x:.4f} {p.y:.4f} L {p.x:.4f} {p.y:.4f}", color, lw, layer, handle, dtype, geo))
        elif cls == "SolidLinesRecord":
            pts = record.lines.vertices()
            segs = []
            geo = [] if tol is not None else None
            for i in range(0, len(pts) - 1, 2):
                a, b = pts[i], pts[i+1]
                segs.append(f"M {a.x:.4f} {a.y:.4f} L {b.x:.4f} {b.y:.4f}")
                if geo is not None:
                    geo.append([(a.x, a.y), (b.x, b.y)])
            if segs: prims.append(Prim("stroke", " ".join(segs), color, lw, layer, handle, dtype, geo or None))
    return prims

def rdp_simplify(pts, tol):
    """Ramer-Douglas-Peucker, iterativ (stack) — ingen rekursjonsgrense på lange
    LWPOLYLINE-kjeder. Bevarer alltid endepunktene. KORREKSJON (Kenneth 2026-10-13):
    kurveforenkling der det ikke påvirker treff (±tol, typisk 2 mm) — kutter register-
    størrelsen på flattened buer/polylinjer uten å flytte punktene mer enn toleransen."""
    if len(pts) < 3 or tol <= 0:
        return pts
    keep = [True] * len(pts)
    stack = [(0, len(pts) - 1)]

    def dist_til_segment(p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    while stack:
        i0, i1 = stack.pop()
        if i1 - i0 < 2:
            continue
        a, b = pts[i0], pts[i1]
        maks_d, maks_i = -1.0, -1
        for i in range(i0 + 1, i1):
            d = dist_til_segment(pts[i], a, b)
            if d > maks_d:
                maks_d, maks_i = d, i
        if maks_d > tol:
            stack.append((i0, maks_i))
            stack.append((maks_i, i1))
        else:
            for i in range(i0 + 1, i1):
                keep[i] = False
    return [p for i, p in enumerate(pts) if keep[i]]

def path_til_d(path, flatten_dist, close):
    # Bevar kurver via commands() (M/L/C) i verdenskoord.
    try:
        cmds = list(path.commands())
    except Exception:
        return ""
    if len(cmds) == 0:
        st = path.start
        return f"M {st.x:.4f} {st.y:.4f}"
    st = path.start
    out = [f"M {st.x:.4f} {st.y:.4f}"]
    cur = st
    from ezdxf.path import Command
    for cmd in cmds:
        end = cmd.end
        if cmd.type == Command.MOVE_TO:
            out.append(f"M {end.x:.4f} {end.y:.4f}")
        elif cmd.type == Command.LINE_TO:
            out.append(f"L {end.x:.4f} {end.y:.4f}")
        elif cmd.type == Command.CURVE3_TO:
            out.append(f"Q {cmd.ctrl.x:.4f} {cmd.ctrl.y:.4f} {end.x:.4f} {end.y:.4f}")
        elif cmd.type == Command.CURVE4_TO:
            out.append(f"C {cmd.ctrl1.x:.4f} {cmd.ctrl1.y:.4f} {cmd.ctrl2.x:.4f} {cmd.ctrl2.y:.4f} {end.x:.4f} {end.y:.4f}")
        cur = end
    if close:
        out.append("Z")
    return " ".join(out)

# transform av et verdens-d-streng til viewBox-koordinater:
# vi parser d-strengen og transformerer hvert tallpar. Enkelt og robust for
# M/L/Q/C/Z.
import re
_TOKEN = re.compile(r"([MLQCZ])|(-?\d+(?:\.\d+)?)")
# samme som _TOKEN, men inkluderer SMÅ bokstaver (m/l/c/q/z) — brukes til å parse transform_d()
# sin RELATIV-kommando-output (td), ikke det absolutte M/L/Q/C/Z-inputformatet _TOKEN er for.
_BBOX_TOKEN = re.compile(r"([MmLlQqCcZz])|(-?\d+(?:\.\d+)?)")

def transform_d(d, rotm, minx, miny, rund, relativ=True):
    """Transformer verdens-d (M/L/Q/C/Z) til viewBox-koord. Emitterer RELATIVE
    kommandoer (l/q/c) etter første M for kompakt output (som ezdxf native)."""
    ut = []
    toks = _TOKEN.findall(d)
    seq = []
    cmd = None
    tall = []
    for (c, num) in toks:
        if c:
            if cmd is not None:
                seq.append((cmd, tall))
            cmd = c; tall = []
        else:
            tall.append(float(num))
    if cmd is not None:
        seq.append((cmd, tall))

    def tp(x, y):
        if rotm: x, y = roter_pkt(x, y, rotm)
        return (rund(x - minx), rund(-(y - miny)))

    def fmt(v):
        return f"{v:g}"

    curx = cury = 0.0
    for (c, tall) in seq:
        if c == "Z":
            ut.append("Z"); continue
        pts = [tp(tall[i], tall[i+1]) for i in range(0, len(tall) - 1, 2)]
        if not pts:
            continue
        if c == "M":
            x, y = pts[0]
            if not ut:
                ut.append(f"M {fmt(x)} {fmt(y)}")
            else:
                ut.append(f"m {(x-curx):g} {(y-cury):g}")
            curx, cury = x, y
            rest = pts[1:]
            if rest:
                deltas = []
                for (px, py) in rest:
                    deltas.append(f"{(px-curx):g} {(py-cury):g}"); curx, cury = px, py
                ut.append("l " + " ".join(deltas))
        elif c == "L":
            deltas = []
            for (px, py) in pts:
                deltas.append(f"{(px-curx):g} {(py-cury):g}"); curx, cury = px, py
            ut.append("l " + " ".join(deltas))
        elif c == "Q":
            # par: ctrl, end
            for i in range(0, len(pts) - 1, 2):
                cx, cy = pts[i]; ex, ey = pts[i+1]
                ut.append(f"q {(cx-curx):g} {(cy-cury):g} {(ex-curx):g} {(ey-cury):g}")
                curx, cury = ex, ey
        elif c == "C":
            for i in range(0, len(pts) - 2, 3):
                c1x, c1y = pts[i]; c2x, c2y = pts[i+1]; ex, ey = pts[i+2]
                ut.append(f"c {(c1x-curx):g} {(c1y-cury):g} {(c2x-curx):g} {(c2y-cury):g} {(ex-curx):g} {(ey-cury):g}")
                curx, cury = ex, ey
    return " ".join(ut)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dxf")
    ap.add_argument("ut_svg")
    ap.add_argument("--tekst", choices=["egen", "ezdxf", "ingen"], default="egen",
                    help="egen=<text>, ezdxf=glyph-paths (måling krav2), ingen")
    ap.add_argument("--rotasjon", choices=["auto", "av"], default="auto")
    ap.add_argument("--robust", choices=["på", "av"], default="på",
                    help="av for georef-tegninger (ingenAutoRotasjon) — matcher egen")
    ap.add_argument("--presisjon", choices=["adaptiv", "full"], default="adaptiv",
                    help="full = ingen koordinatavrunding (krav 3-måling)")
    ap.add_argument("--lineweight", choices=["ekte", "uniform"], default="ekte")
    ap.add_argument("--hatch", choices=["normal", "solid", "ignore"], default="normal",
                    help="normal=mønster (web), solid=fyll (mobil), ignore=dropp")
    ap.add_argument("--linje", choices=["accurate", "solid"], default="accurate",
                    help="accurate=ekte linjetyper (stiplet), solid=heltrukket (mindre)")
    ap.add_argument("--gruppering", choices=["farge", "ingen", "handle"], default="ingen",
                    help="farge=mega-paths (liten fil, hakkete pan, MISTER objektidentitet), "
                         "ingen=per-primitiv (jevn perf, ett path pr. geometri-fragment), "
                         "handle=per (handle,farge,lw) — SAMME objektidentitet som ingen "
                         "(data-id/data-elid uendret pr. objekt), men blokk-instanser (dør/"
                         "vindu, mange streker pr. INSERT-handle) samles til én path. "
                         "Kutter nodetall uten tap av F1/F8-picking (D5-fiks for tegninger "
                         "med mange blokk-instanser, f.eks. fallplanens 1231 dørblokker)")
    ap.add_argument("--fyll-gruppering", choices=["ingen", "lag"], default="ingen",
                    help="lag=skravur/flate slått sammen pr. (lag,farge) — kutter nodetall på "
                         "hatch-tunge tegninger (D5). Strek ALLTID per-primitiv her (data-id/"
                         "data-elid uendret, F1/F8-picking bevart). ingen=dagens per-primitiv fyll.")
    ap.add_argument("--metadata", choices=["av", "på"], default="av",
                    help="på = data-layer (fra player) + data-type (via handle) pr. element "
                         "(kun gruppering=ingen) — gjenoppretter klikk-identifiser + rapport UTEN subklasse")
    ap.add_argument("--register", help="skriv egenskapsregister (O1, § 8) hit + data-id/"
                                       "data-elid pr. strek i SVG-en (impliserer metadata=på)")
    ap.add_argument("--register-world", help="skriv et EKSTRA register hit med bbox i RÅ DXF-"
                    "verdenskoordinater (ingen rotasjon, ingen Y-flip, ingen margin/viewBox-"
                    "offset) — for motorer som tegner direkte fra DXF-en (dxf-viewer/WebGL), "
                    "ikke fra vår SVG. Samme objekt-felter som --register (kategori/lag/elid/"
                    "attr), kun bbox-koordinatsystemet er annerledes. Kan brukes uten --register.")
    ap.add_argument("--klipp", default=None,
                    help="minX,minY,maxX,maxY i tegningsenheter (layout-klipp) — "
                         "setter extents direkte, kobler ut rotasjon/robust (som egens klippBounds)")
    ap.add_argument("--meta", help="skriv JSON-metadata hit")
    ap.add_argument("--mem-mb", type=int, default=2048,
                    help="selvpålagt minnetak (RLIMIT_AS). 0 = av.")
    ap.add_argument("--flatten-mm", type=float, default=0.1)
    ap.add_argument("--forenklet-dxf", help="skriv en forenklet DXF hit for dxf-viewer-klienten "
                    "(leveranse 1) — XDATA/extension-dicts/ubrukte blokker fjernet, koordinater "
                    "avrundet <=0,1 mm. Bygges fra en FERSK lesing av kilde-DXF-en (uavhengig av "
                    "SVG/register over, som alltid bruker full presisjon). Tall til markøren "
                    "skrives inn i --meta under nøkkelen forenkletDxf.")
    args = ap.parse_args()

    if args.register or args.register_world:
        args.metadata = "på"

    sett_minnetak(args.mem_mb)

    klipp = None
    if args.klipp:
        kv = [float(v) for v in args.klipp.split(",")]
        if len(kv) != 4:
            print("KLIPP krever minX,minY,maxX,maxY", file=sys.stderr); sys.exit(2)
        klipp = (kv[0], kv[1], kv[2], kv[3])

    t0 = time.time()
    doc = ezdxf.readfile(args.dxf)
    msp = doc.modelspace()
    mmPrEnhet = {1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}.get(doc.header.get("$INSUNITS", 0))
    t_les = time.time() - t0

    hatch_map = {"normal": HatchPolicy.NORMAL, "solid": HatchPolicy.SHOW_SOLID,
                 "ignore": HatchPolicy.IGNORE}
    line_map = {"accurate": LinePolicy.ACCURATE, "solid": LinePolicy.SOLID}
    ctx = RenderContext(doc)
    cfg = Configuration(
        text_policy=TextPolicy.IGNORE if args.tekst != "ezdxf" else TextPolicy.OUTLINE,
        line_policy=line_map[args.linje],
        hatch_policy=hatch_map[args.hatch],
        background_policy=BackgroundPolicy.WHITE,
        color_policy=ColorPolicy.COLOR,
        lineweight_policy=LineweightPolicy.ABSOLUTE,
    )
    backend = SVGBackend()
    t1 = time.time()
    Frontend(ctx, backend, config=cfg).draw_layout(msp)
    t_tegn = time.time() - t1

    # KORREKSJON (Kenneth 2026-10-13): 2 mm reell toleranse for treffe-geometri/RDP-forenkling,
    # uttrykt i DXF-enheter (mmPrEnhet = mm pr. DXF-enhet). Kun satt for --register-world —
    # kostnaden (flattening + RDP pr. strek-primitiv) tas ikke for vanlig SVG-rendering.
    hit_tol_world = None
    if args.register_world:
        hit_tol_world = 2.0 / mmPrEnhet if mmPrEnhet else 2.0

    player = backend.player()
    prims = hent_primitiver(player, args.flatten_mm, db=doc.entitydb if args.metadata == "på" else None,
                             hit_tol=hit_tol_world)

    # Fullstendighetsrapport (krav 5): ezdxf attribuerer blokk-intern geometri til
    # INSERT-handelet, så ARC/ELLIPSE osv. inne i blokker får data-type="INSERT" og
    # ville ellers flagges falskt som «ikke tegnet». Vi samler derfor typene inne i
    # blokker som faktisk refereres av en INSERT (rekursivt), og krediterer dem i TS.
    blokk_typer = blokk_innhold_typer(msp, doc) if args.metadata == "på" else {}

    # punkter for extents fra ALLE prims
    xs, ys = [], []
    for p in prims:
        toks = _TOKEN.findall(p.d)
        tall = [float(n) for (_, n) in toks if n]
        for i in range(0, len(tall) - 1, 2):
            xs.append(tall[i]); ys.append(tall[i+1])
    if not xs:
        print("TOM TEGNING", file=sys.stderr); sys.exit(2)
    # segmenter for rotasjon: KUN rene LINE/LWPOLYLINE/POLYLINE (ikke kurver/hatch),
    # som dominantVeggvinkel i dxfTilSvg
    segmenter = les_segmenter(msp)

    # tekst-entiteter (for rotasjons-lesbarhet + egen <text>)
    tekster = les_tekster(msp)
    tekstrot = [(t["rot"], t["h"]) for t in tekster if t["rot"]]

    # auto-rotasjon (hoppes ved klipp — som egens klippBounds => ingen rotasjon)
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    R = 0.0
    if not klipp and args.rotasjon == "auto":
        vegg = dominant_veggvinkel(segmenter)
        if vegg and vegg["andel"] >= 0.6:
            Rk = velg_auto_rotasjon(vegg["grader"], tekstrot)
            if abs(Rk) >= 0.5:
                R = Rk
    rotm = rot_matrise(R, cx, cy) if R else None

    # extents etter rotasjon (robust trim). Ved klipp: bruk gitte bounds direkte.
    if klipp:
        minx, miny, maxx, maxy = klipp[0], klipp[1], klipp[2], klipp[3]
    else:
        rxs, rys = [], []
        for (x, y) in zip(xs, ys):
            if rotm: x, y = roter_pkt(x, y, rotm)
            rxs.append(x); rys.append(y)
        if args.robust == "på" and args.rotasjon != "av":
            lox, hix = robust_grense(rxs)
            loy, hiy = robust_grense(rys)
        else:
            lox, hix = min(rxs), max(rxs)
            loy, hiy = min(rys), max(rys)
        minx, maxx, miny, maxy = lox, hix, loy, hiy
    w = maxx - minx; h = maxy - miny
    svgMargin = max(w, h) * MARGIN_ANDEL
    vbX = -svgMargin; vbY = -(h + svgMargin)
    vbW = w + 2 * svgMargin; vbH = h + 2 * svgMargin

    # Nøyaktig som dwgKonvertering.ts:1692/1693/1969 (svgBredde fra INNHOLD w/h,
    # ikke vbW; vbPerPx fra innhold-w; svgHoyde fra vbH/vbW).
    svgBredde = max(1, round(LANGSIDE_PIKSEL * (w / h))) if h > w else LANGSIDE_PIKSEL
    vbPerPx = w / svgBredde
    svgHoyde = round(svgBredde * (vbH / vbW))
    sw = vbPerPx * 1.5
    strekBredde = round(sw * 100) / 100
    dec = 6 if args.presisjon == "full" else koord_desimaler(vbPerPx)
    rund = rund_fn(dec)

    # mm -> viewBox-enheter for ekte lineweight
    def lw_til_vb(lw_mm):
        if args.lineweight == "uniform" or not lw_mm or not mmPrEnhet:
            return strekBredde
        vb = lw_mm / mmPrEnhet  # DXF-enheter = viewBox-enheter
        return max(strekBredde, round(vb * 100) / 100)

    # O1-register (§ 8): bygges FØR emit så strek-paths kan bære data-id/data-elid.
    # Kun handles som faktisk er tegnet (prims) telles — speiler fullstendighetsrapporten.
    reg_objekter, reg_elidIndex = {}, {}
    trenger_register = bool(args.register or args.register_world)
    lagmap_reg = layer_info_map(doc) if trenger_register else {}
    if trenger_register:
        # union med tekst-handles: rom-/komponentstempler (INSERT m/ attributt, F1 felt 3)
        # har ofte INGEN synlig strek/fyll-geometri — bare attributtekst — og ville ellers
        # aldri få en O1-oppføring (AT-F1: 53/60 romtagger på fallplanen er rene attributt-
        # blokker uten egen boundary).
        prim_handles = {p.handle for p in prims if p.handle} | {t.get("handle") for t in tekster if t.get("handle")}
        reg_objekter, reg_elidIndex = bygg_objektregister(doc, msp, prim_handles, lagmap_reg)
        # F1 felt 5 (Tekst): frittstående TEXT/MTEXT sin egen tekst-innhold lagres ikke av
        # bygg_objektregister() (den dekker kun ATTRIB via blokk-attributter/"attr") — uten
        # dette ville F1-kortet ALDRI vise tekst-feltet for en ren TEXT/MTEXT-entitet.
        for t in tekster:
            if t.get("dtype") in ("TEXT", "MTEXT") and t.get("handle") in reg_objekter:
                reg_objekter[t["handle"]]["tekst"] = t["tekst"]

    # emit. gruppering=farge: slå sammen per (farge,strek) -> få mega-paths (liten
    # fil, men dårlig panorerings-perf — hele pathen må re-rasteriseres). gruppering=ingen:
    # én path pr. primitiv (flere noder, men nettleseren kan delinvalidere -> jevn perf).
    # fyll-gruppering=lag: skravur/flate slått sammen pr. (lag,farge) UAVHENGIG av strek-
    # gruppering — strek beholder alltid data-id/data-elid (F1/F8-picking upåvirket, D5-fiks
    # for hatch-tunge tegninger som fallplanen, AT-F1: 86 % av nodene er skravur).
    fills = []
    fills_by = {}
    stroke_paths = []
    strokes_by = {}
    reg_bbox = {}
    reg_bbox_world = {}
    reg_segs_world = {}  # handle -> liste av polylinjer (RDP-forenklet, kun stroke) — KORREKSJON treff
    lw_min = None  # tynneste strek (viewBox-enheter) -> data-lw-base (lw-faktor = lw/lwBase)
    def meta_attr(p):
        lag = f' data-layer="{html.escape(p.layer)}"' if (args.metadata == "på" and p.layer) else ""
        typ = f' data-type="{html.escape(p.dtype)}"' if (args.metadata == "på" and p.dtype) else ""
        idd = ""
        if args.register and p.handle:
            idd = f' data-id="{html.escape(p.handle)}"'
            o = reg_objekter.get(p.handle)
            if o and o.get("elid"):
                idd += f' data-elid="{html.escape(o["elid"])}"'
        return lag + typ + idd
    def bbox_oppdater(handle, td):
        # td er transform_d() sin RELATIV-kommando-output (M absolutt, m/l/c/q relativ delta
        # etter første M — se transform_d-docstring). Må parses med kommando-semantikk, ikke
        # som en flat liste av (x,y)-par: _TOKEN matcher bare STORE bokstaver, så en naiv
        # findall(td) mister alle små m/l/c-tokens og leser etterfølgende delta-tall som om de
        # var absolutte punkter — ga feil bbox for samtlige objekter (funnet i V1/V2-prøven,
        # gate 1, 2026-10-13). Z/z hoppes over: hver subpath i td starter alltid med en ny
        # absolutt M (transform_d), så Z sin implisitte lukke-linje treffer alltid et punkt
        # subpathens egen M allerede har talt med i bbox.
        if not args.register or not handle:
            return
        bb = reg_bbox.get(handle)
        def punkt(x, y):
            nonlocal bb
            if bb is None:
                bb = [x, y, x, y]; reg_bbox[handle] = bb
            else:
                if x < bb[0]: bb[0] = x
                if y < bb[1]: bb[1] = y
                if x > bb[2]: bb[2] = x
                if y > bb[3]: bb[3] = y
        cx = cy = 0.0
        cmd = None
        buf = []
        def flush():
            nonlocal cx, cy
            if cmd == "M" or cmd == "L":
                for i in range(0, len(buf) - 1, 2):
                    cx2, cy2 = buf[i], buf[i+1]; cx, cy = cx2, cy2; punkt(cx, cy)
            elif cmd == "m" or cmd == "l":
                for i in range(0, len(buf) - 1, 2):
                    cx, cy = cx + buf[i], cy + buf[i+1]; punkt(cx, cy)
            elif cmd == "c":
                for i in range(0, len(buf) - 5, 6):
                    punkt(cx + buf[i], cy + buf[i+1]); punkt(cx + buf[i+2], cy + buf[i+3])
                    cx, cy = cx + buf[i+4], cy + buf[i+5]; punkt(cx, cy)
            elif cmd == "C":
                for i in range(0, len(buf) - 5, 6):
                    punkt(buf[i], buf[i+1]); punkt(buf[i+2], buf[i+3])
                    cx, cy = buf[i+4], buf[i+5]; punkt(cx, cy)
            elif cmd == "q":
                for i in range(0, len(buf) - 3, 4):
                    punkt(cx + buf[i], cy + buf[i+1])
                    cx, cy = cx + buf[i+2], cy + buf[i+3]; punkt(cx, cy)
            elif cmd == "Q":
                for i in range(0, len(buf) - 3, 4):
                    punkt(buf[i], buf[i+1])
                    cx, cy = buf[i+2], buf[i+3]; punkt(cx, cy)
            buf.clear()
        for (c, num) in _BBOX_TOKEN.findall(td):
            if c:
                flush(); cmd = c
            else:
                buf.append(float(num))
        flush()
    def bbox_world_oppdater(handle, d_verden):
        # p.d er ALLTID absolutt M/L/Q/C/Z i rå DXF-verdenskoordinater (se path_til_d) —
        # ingen rotasjon/flip/relativ-delta å tolke, i motsetning til bbox_oppdater() sin td.
        # Samme enkle (x,y)-par-uttrekk som extents-beregningen (xs/ys) lenger opp.
        if not args.register_world or not handle:
            return
        bb = reg_bbox_world.get(handle)
        toks = _TOKEN.findall(d_verden)
        tall = [float(n) for (_, n) in toks if n]
        for i in range(0, len(tall) - 1, 2):
            x, y = tall[i], tall[i+1]
            if bb is None:
                bb = [x, y, x, y]; reg_bbox_world[handle] = bb
            else:
                if x < bb[0]: bb[0] = x
                if y < bb[1]: bb[1] = y
                if x > bb[2]: bb[2] = x
                if y > bb[3]: bb[3] = y
    def segs_world_oppdater(handle, pts_list):
        # KORREKSJON (Kenneth 2026-10-13): ekte geometri pr. primitiv, RDP-forenklet ±2 mm.
        # Flate (HATCH/SOLID/skravur) kommer ALDRI hit — p.pts er None for kind=='fill'
        # (erFlateObjekt i harness avgjør alene via containment, geometri er overflødig der).
        if not handle or not pts_list:
            return
        arr = reg_segs_world.setdefault(handle, [])
        for poly in pts_list:
            if len(poly) < 3:
                arr.append(poly)  # 1-2 punkt: RDP gir ingen besparelse, lagre som-er
            else:
                arr.append(rdp_simplify(poly, hit_tol_world))
    for p in prims:
        td = transform_d(p.d, rotm, minx, miny, rund)
        if not td: continue
        bbox_oppdater(p.handle, td)
        bbox_world_oppdater(p.handle, p.d)
        if p.kind == "stroke":
            segs_world_oppdater(p.handle, p.pts)
        if p.kind == "fill":
            if args.fyll_gruppering == "lag":
                fills_by.setdefault((p.layer, p.color), []).append(td)
            else:
                fills.append(f'<path d="{td}" fill="{p.color}" stroke="none"{meta_attr(p)}/>')
        else:
            swv = lw_til_vb(p.lineweight)
            lw_min = swv if lw_min is None else min(lw_min, swv)
            # RETUR 1 (web-visning): strek bærer BÅDE `stroke-width` (ekte lineweight i
            # viewBox-enheter — standalone <img>/PDF/librsvg uten var()-støtte bruker den)
            # OG `style="--lw"` (per-strek lineweight som rot-<style> dempet-skalerer pr.
            # zoom i web-viseren → bevarer FORHOLDET mellom lineweights).
            if args.gruppering == "ingen":
                stroke_paths.append(f'<path d="{td}" fill="none" stroke="{p.color}" stroke-width="{swv}" style="--lw:{swv}"{meta_attr(p)}/>')
            elif args.gruppering == "handle":
                # Identitet bevart (gruppenøkkelen ER handle) — kutter kun duplikat-geometri
                # fra samme objekt (blokk-instanser med mange interne streker, se D5).
                key = (p.handle, p.color, swv)
                g = strokes_by.setdefault(key, {"ds": [], "layer": p.layer, "dtype": p.dtype})
                g["ds"].append(td)
            else:
                strokes_by.setdefault((p.color, swv), []).append(td)
    for (lag, color), ds in fills_by.items():
        lagattr = f' data-layer="{html.escape(lag)}"' if (args.metadata == "på" and lag) else ""
        fills.append(f'<path d="{" ".join(ds)}" fill="{color}" stroke="none"{lagattr}/>')
    if args.gruppering == "handle":
        for (handle, color, swv), g in strokes_by.items():
            lw_min = swv if lw_min is None else min(lw_min, swv)
            lag = f' data-layer="{html.escape(g["layer"])}"' if (args.metadata == "på" and g["layer"]) else ""
            typ = f' data-type="{html.escape(g["dtype"])}"' if (args.metadata == "på" and g["dtype"]) else ""
            idd = ""
            if args.register and handle:
                idd = f' data-id="{html.escape(handle)}"'
                o = reg_objekter.get(handle)
                if o and o.get("elid"):
                    idd += f' data-elid="{html.escape(o["elid"])}"'
            stroke_paths.append(f'<path d="{" ".join(g["ds"])}" fill="none" stroke="{color}" stroke-width="{swv}" style="--lw:{swv}"{lag}{typ}{idd}/>')
    else:
        for (color, swv), ds in strokes_by.items():
            lw_min = swv if lw_min is None else min(lw_min, swv)
            stroke_paths.append(f'<path d="{" ".join(ds)}" fill="none" stroke="{color}" stroke-width="{swv}" style="--lw:{swv}"/>')
    lw_base = lw_min if lw_min is not None else strekBredde

    # tekst som egen <text>
    text_svg = []
    def meta_text(t):
        if args.metadata != "på":
            return ""
        lag = f' data-layer="{html.escape(t["layer"])}"' if t.get("layer") else ""
        typ = f' data-type="{html.escape(t["dtype"])}"' if t.get("dtype") else ""
        return lag + typ
    if args.tekst == "egen":
        for t in tekster:
            x, y = t["x"], t["y"]
            if rotm: x, y = roter_pkt(x, y, rotm)
            nx = rund(x - minx); ny = rund(-(y - miny))
            fs = round((t["h"] / CAP_RATIO) * 100) / 100
            anchor = mtekst_forankring(t.get("att"))
            rot_attr = f' transform="rotate({-t["rot"]:g} {nx:g} {ny:g})"' if t["rot"] else ""
            text_svg.append(
                f'<text x="{nx:g}" y="{ny:g}" font-size="{fs:g}" font-family="sans-serif" '
                f'fill="{t["color"]}"{(" "+anchor) if anchor else ""}{rot_attr}{meta_text(t)}>{html.escape(t["tekst"])}</text>'
            )

    # startutsnitt (persentil 1-99 av tegnede punkter i SVG-piksel-brøk)
    startutsnitt = beregn_startutsnitt(
        [(rund((roter_pkt(x,y,rotm)[0] if rotm else x) - minx),
          rund(-(((roter_pkt(x,y,rotm)[1] if rotm else y)) - miny))) for (x,y) in zip(xs,ys)],
        vbX, vbY, vbW, vbH)

    # RETUR 1: `data-motor="ezdxf"` på roten lar web-viseren kjenne igjen ezdxf-SVG-en og
    # BEHOLDE denne <style>-en (i stedet for å stripe den og injisere sin faste 1,5-regel,
    # som gjorde hver strek ~115× for tynn på denne 135501-brede viewBoxen).
    #
    # TILLEGG C1 (dempet strekskalering): stroke-width = var(--lw) × --strek-skala, klemt i
    # viewBox-enheter til [--strek-min, var(--lw) × --strek-maks-k]. Viseren setter de tre
    # JS-variablene pr. zoom (zoom^(k−1) + px→vb-konvertert gulv/tak — beregnStrekVars() i
    # @sitedoc/shared). STANDALONE (<img>/PDF/librsvg, ingen JS): --strek-skala=1, --strek-min=0,
    # --strek-maks-k = stor → stroke-width = var(--lw) = ekte lineweight (uendret der).
    # `data-lw-base` = tynneste strek → lw-faktor = lw/lwBase for taket.
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" data-motor="ezdxf" data-lw-base="{lw_base:g}" '
        f'viewBox="{vbX:g} {vbY:g} {vbW:g} {vbH:g}" '
        f'width="{svgBredde}" height="{svgHoyde}">'
        f'<style>path[style*="--lw"]{{stroke-width:clamp(var(--strek-min,0px),'
        f'calc(var(--lw) * var(--strek-skala,1) * 1px),calc(var(--lw) * var(--strek-maks-k,1e9) * 1px))}}</style>'
        f'<rect x="{vbX:g}" y="{vbY:g}" width="{vbW:g}" height="{vbH:g}" fill="#ffffff"/>'
        f'<g stroke-linecap="round" stroke-linejoin="round">'
        + "".join(fills) + "".join(stroke_paths) + "".join(text_svg)
        + "</g></svg>"
    )
    with open(args.ut_svg, "w") as f:
        f.write(svg)
    t_tot = time.time() - t0

    noder = svg.count("<path") + svg.count("<text")
    meta = {
        "fil": args.dxf, "tekst": args.tekst, "rotasjon": args.rotasjon, "lineweight": args.lineweight,
        "klipp": bool(klipp),
        "mmPrEnhet": mmPrEnhet, "autoRotasjon": R,
        "vbW": vbW, "vbH": vbH, "width": svgBredde, "height": svgHoyde,
        "strekBredde": strekBredde, "koordDesimaler": dec,
        "svg_bytes": len(svg.encode()), "path_noder": svg.count("<path"),
        "text_noder": svg.count("<text"), "noder_total": noder,
        "antall_tekster": len(tekster),
        "blokkTyper": blokk_typer,
        "extents": {"minX": minx, "maxX": maxx, "minY": miny, "maxY": maxy},
        "mmPrPiksel": (vbW * mmPrEnhet) / svgBredde if mmPrEnhet else vbW / svgBredde,
        "startutsnitt": startutsnitt,
        "tid_s": {"les": round(t_les,2), "tegn": round(t_tegn,2), "total": round(t_tot,2)},
    }
    lag_dominant_kat = lag_dominante_revit_kategorier(reg_objekter) if trenger_register else {}
    if args.register_world:
        # Egne kopier av objektene (IKKE reg_objekter direkte) — --register under muterer
        # "bbox" (og fjerner attrMeta) på de samme dict-instansene til SVG-viewBox-koordinater;
        # de to registrene deler objekt-METADATA (kategori/lag/elid/attr), men ALDRI bbox-
        # verdien eller attrMeta (rå verdenskoordinater, kun gyldig her). MÅ bygges FØR
        # --register-blokken under muterer/fjerner felt på de delte dict-instansene.
        objekter_world = {}
        for h, o in reg_objekter.items():
            ow = dict(o)
            bb = reg_bbox_world.get(h)
            if bb:
                # KORREKSJON (Kenneth 2026-10-13): heltall (bbox er allerede kun grovfilter/
                # containment for flate+rbush — sub-mm-presisjon her tjener ingen treff).
                ow["bbox"] = [round(bb[0]), round(bb[1]), round(bb[2]), round(bb[3])]
            else:
                ow.pop("bbox", None)
            segs = reg_segs_world.get(h)
            if segs:
                # Ekte geometri pr. primitiv (RDP-forenklet ±2 mm), heltall, flate array
                # pr. polylinje [x0,y0,x1,y1,...] — treffetesten måler avstand punkt->segment
                # mot DENNE, ikke bbox-kanten (var rotårsaken: dørsvingens union-bbox er langt
                # fra trykkpunktet, mens kledningens tette bbox feilaktig vant).
                ow["geom"] = [[c for (x, y) in poly for c in (round(x), round(y))] for poly in segs]
            objekter_world[h] = ow
        beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat)
        lag_antall_w = {}
        for o in objekter_world.values():
            lag_antall_w[o["lag"]] = lag_antall_w.get(o["lag"], 0) + 1
        laginventar_w = []
        for navn, ant in sorted(lag_antall_w.items(), key=lambda kv: -kv[1]):
            lm = lagmap_reg.get(navn, {})
            _revit_kat = lag_dominant_kat.get(navn)
            _gruppe_kode = tolk_lag_gruppe(navn)
            laginventar_w.append({
                "navn": navn, "antall": ant, "visningsnavn": lm.get("desc") or tolk_lagnavn(navn) or navn,
                "desc": lm.get("desc", ""), "aci": lm.get("aci"), "ltype": lm.get("ltype", ""), "lw": lm.get("lw"),
                "gruppe": _revit_kat or _gruppe_kode or "Andre",
                "gruppeNavn": gruppe_visningsnavn(_gruppe_kode, _revit_kat),
            })
        # 90°-lås-fallback (RETUR 2026-10-18, Kenneths telefontest punkt 3): måleverktøyets
        # ortho-lås skal følge BYGGETS veggvinkel i rå DXF-verdenskoord (samme rom som
        # register_world under), IKKE skjermaksene — de to faller bare sammen når bygget
        # er aksejevnt med DXF-ens egen X/Y, som fallplanen (40°) beviser at det ikke er.
        # Uavhengig av `args.rotasjon`/`klipp` (de styrer kun den kasserte SVG-en over) —
        # `segmenter` er alt lest rått, samme kildedata som den SVG-interne beregningen.
        # Samme 60 %-konfidensterskel som SVG-veien (andel < 0.6 → for tynt grunnlag → null,
        # klienten faller da tilbake til aksejevne akser, identisk med dagens oppførsel).
        vegg_laas = dominant_veggvinkel(segmenter)
        dominant_veggvinkel_grader = vegg_laas["grader"] if vegg_laas and vegg_laas["andel"] >= 0.6 else None

        register_world = {
            "fil": args.dxf,
            "koordsys": "dxf-verden (rå enheter fra fila, Y opp, INGEN rotasjon/flip/margin — "
                        "matcher det en motor som tegner direkte fra DXF-en (f.eks. dxf-viewer) "
                        "bruker FØR dens egen lokale origin-forskyvning). bbox og geom er HELTALL "
                        "i denne enheten (KORREKSJON Kenneth 2026-10-13, mm for filer der "
                        "$INSUNITS=mm — se mmPrEnhet i --meta for andre enheter).",
            "antallObjekter": len(objekter_world), "antallLag": len(laginventar_w), "antallElid": len(reg_elidIndex),
            "objekter": objekter_world, "elidIndex": reg_elidIndex, "laginventar": laginventar_w,
            # 0-90° (mod 90, ikke kvadrant-løst — ortho-låsen bruker parallell+vinkelrett,
            # som allerede dekker alle fire kvadranter). null = for tynt/usikkert grunnlag.
            "dominantVeggvinkelGrader": dominant_veggvinkel_grader,
        }
        with open(args.register_world, "w") as f: json.dump(register_world, f, ensure_ascii=False)
        meta["registerWorld"] = {"objekter": len(objekter_world), "lag": len(laginventar_w), "elid": len(reg_elidIndex)}

    if args.register:
        for h, o in reg_objekter.items():
            bb = reg_bbox.get(h)
            if bb:
                o["bbox"] = [round(bb[0], 3), round(bb[1], 3), round(bb[2], 3), round(bb[3], 3)]
            # attrMeta er RÅ DXF-verdenskoordinater (kun gyldig i --register-world) — ugyldig i
            # dette SVG-roterte/flippede/margin-forskjøvede koordinatsystemet. Fjernes her.
            # (register-world-blokken over har allerede tatt sin egen kopi inkl. attrMeta.)
            o.pop("attrMeta", None)
        lag_antall = {}
        for o in reg_objekter.values():
            lag_antall[o["lag"]] = lag_antall.get(o["lag"], 0) + 1
        laginventar = []
        for navn, ant in sorted(lag_antall.items(), key=lambda kv: -kv[1]):
            lm = lagmap_reg.get(navn, {})
            _revit_kat = lag_dominant_kat.get(navn)
            _gruppe_kode = tolk_lag_gruppe(navn)
            laginventar.append({
                "navn": navn, "antall": ant, "visningsnavn": lm.get("desc") or tolk_lagnavn(navn) or navn,
                "desc": lm.get("desc", ""), "aci": lm.get("aci"), "ltype": lm.get("ltype", ""), "lw": lm.get("lw"),
                "gruppe": _revit_kat or _gruppe_kode or "Andre",
                "gruppeNavn": gruppe_visningsnavn(_gruppe_kode, _revit_kat),
            })
        register = {
            "fil": args.dxf, "vbW": vbW, "vbH": vbH,
            "antallObjekter": len(reg_objekter), "antallLag": len(laginventar), "antallElid": len(reg_elidIndex),
            "objekter": reg_objekter, "elidIndex": reg_elidIndex, "laginventar": laginventar,
        }
        with open(args.register, "w") as f: json.dump(register, f, ensure_ascii=False)
        meta["register"] = {"objekter": len(reg_objekter), "lag": len(laginventar), "elid": len(reg_elidIndex)}

    if args.forenklet_dxf:
        meta["forenkletDxf"] = skriv_forenklet_dxf(args.dxf, args.forenklet_dxf)

    if args.meta:
        with open(args.meta, "w") as f: json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))

def blokk_innhold_typer(msp, doc):
    """Entitetstyper (med antall) inne i blokker som faktisk refereres av en INSERT
    i modelspace (rekursivt gjennom nestede INSERT). Når en INSERT tegnes, tegnes
    hele blokk-innholdet — så disse typene ER dekket selv om player attribuerer dem
    til INSERT-handelet. Krediteres i TS så rapporten ikke gir falske «ikke tegnet»."""
    referert = set()
    def saml(navn):
        if not navn or navn in referert:
            return
        referert.add(navn)
        try:
            blk = doc.blocks.get(navn)
        except Exception:
            return
        if blk is None:
            return
        for e in blk:
            if e.dxftype() == "INSERT":
                saml(e.dxf.get("name", None))
    for ins in msp.query("INSERT"):
        saml(ins.dxf.get("name", None))
    typer = {}
    for navn in referert:
        try:
            blk = doc.blocks.get(navn)
        except Exception:
            continue
        if blk is None:
            continue
        for e in blk:
            t = e.dxftype()
            typer[t] = typer.get(t, 0) + 1
    return typer

def les_segmenter(msp):
    """Rene LINE/LWPOLYLINE/POLYLINE-segmenter i verdenskoord (for rotasjon)."""
    segs = []
    for e in msp:
        t = e.dxftype()
        if t == "LINE":
            s, en = e.dxf.start, e.dxf.end
            segs.append((s.x, s.y, en.x, en.y))
        elif t == "LWPOLYLINE":
            pts = [(p[0], p[1]) for p in e.get_points()]
            closed = e.closed
            for i in range(len(pts) - 1):
                segs.append((pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]))
            if closed and len(pts) > 2:
                segs.append((pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))
        elif t == "POLYLINE":
            try:
                vs = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            except Exception:
                vs = []
            for i in range(len(vs) - 1):
                segs.append((vs[i][0], vs[i][1], vs[i+1][0], vs[i+1][1]))
    return segs

def _mtext_rot(e):
    """MTEXT-rotasjon i GRADER. Rå DXF lagrer MTEXT-kode 50 i radianer, men ezdxfs
    høynivå-API (`e.dxf.rotation`) konverterer alltid til grader — så vi returnerer
    verdien direkte. (PoC hadde en «> 2π ⇒ radianer»-heuristikk som feiltolket f.eks.
    53°-rotert måltekst som radianer → ~3044°; fjernet.)"""
    return e.dxf.get("rotation", 0) or 0

def les_tekster(msp):
    ut = []
    for e in msp:
        t = e.dxftype()
        lag = e.dxf.get("layer", "") or ""
        if t == "TEXT":
            ut.append({"tekst": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.height, "rot": e.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None, "dtype": "TEXT", "layer": lag,
                       "handle": e.dxf.handle})
        elif t == "MTEXT":
            ut.append({"tekst": _ren_mtext(e.text), "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.char_height, "rot": _mtext_rot(e),
                       "color": "#000000", "att": e.dxf.get("attachment_point", 1),
                       "dtype": "MTEXT", "layer": lag, "handle": e.dxf.handle})
        elif t == "ATTRIB":
            ut.append({"tekst": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.height, "rot": e.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None, "dtype": "ATTRIB", "layer": lag,
                       "handle": e.dxf.handle})
    # INSERT -> ATTRIB. handle = BLOKK-INSTANSEN (ins), ikke attributtets egen handle —
    # det er rom-/komponent-stempelet brukeren klikker på (F1/register, O1-id).
    for ins in msp.query("INSERT"):
        for att in ins.attribs:
            ut.append({"tekst": att.dxf.text, "x": att.dxf.insert.x, "y": att.dxf.insert.y,
                       "h": att.dxf.height, "rot": att.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None,
                       "dtype": "ATTRIB", "layer": att.dxf.get("layer", "") or "",
                       "handle": ins.dxf.handle})
    # DIMENSION -> måltekst. ezdxf tegner dimensjonens linjer/piler, men TextPolicy.IGNORE
    # suppr. teksten — så vi henter den selv (krav 2; manglet i PoC). Primær kilde er
    # dimensjonens geometri-blokk (*D...), som bærer TEXT/MTEXT ferdig plassert/rotert/
    # skalert slik AutoCAD/TrueView viser den. Fallback: egen måling + text_midpoint.
    doc = getattr(msp, "doc", None)
    if doc is not None:
        for dim in msp.query("DIMENSION"):
            ut.extend(_dim_tekster(dim, doc))
    return [t for t in ut if (t["tekst"] or "").strip()]

def _fmt_maal(v):
    # Fallback-formattering (kun når geometri-blokk mangler): strip hale-nuller.
    return f"{round(v, 2):g}"

def _dim_tekster(dim, doc):
    ut = []
    lag = dim.dxf.get("layer", "") or ""
    blk_navn = dim.dxf.get("geometry", None)   # anonym *D...-blokk (DXF-kode 2)
    blk = None
    if blk_navn:
        try:
            blk = doc.blocks.get(blk_navn)
        except Exception:
            blk = None
    if blk is not None:
        for e in blk:
            t = e.dxftype()
            if t == "MTEXT":
                ut.append({"tekst": _ren_mtext(e.text), "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                           "h": e.dxf.char_height, "rot": _mtext_rot(e),
                           "color": "#000000", "att": e.dxf.get("attachment_point", 5),
                           "dtype": "DIMENSION", "layer": lag})
            elif t == "TEXT":
                ut.append({"tekst": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                           "h": e.dxf.height, "rot": e.dxf.get("rotation", 0) or 0,
                           "color": "#000000", "att": None,
                           "dtype": "DIMENSION", "layer": lag})
        if any((t["tekst"] or "").strip() for t in ut):
            return ut
        ut = []
    # Fallback: ingen brukbar geometri-blokk -> mål selv og plasser på text_midpoint.
    txt = (dim.dxf.get("text", "<>") or "<>")
    maal = None
    try:
        maal = dim.get_measurement()
    except Exception:
        maal = None
    if isinstance(maal, (int, float)):
        vist = _fmt_maal(maal) if txt in ("", "<>") else txt.replace("<>", _fmt_maal(maal))
    else:
        vist = "" if txt in ("", "<>") else txt
    if not (vist or "").strip():
        return ut
    pos = dim.dxf.get("text_midpoint", None) or dim.dxf.get("defpoint", None)
    if pos is None:
        return ut
    h = 2.5
    try:
        style = doc.dimstyles.get(dim.dxf.get("dimstyle", "Standard"))
        h = (float(style.dxf.get("dimtxt", 2.5) or 2.5) * float(style.dxf.get("dimscale", 1.0) or 1.0)) or 2.5
    except Exception:
        pass
    ut.append({"tekst": vist, "x": pos.x, "y": pos.y, "h": h, "rot": 0, "color": "#000000",
               "att": 5, "dtype": "DIMENSION", "layer": lag})
    return ut

def _ren_mtext(s):
    import re
    s = re.sub(r"\\[A-Za-z][^;]*;", "", s or "")
    s = s.replace("\\P", " ").replace("{", "").replace("}", "")
    return s.strip()

def mtekst_forankring(att):
    if not att or att == 7:
        return ""
    kol = (att - 1) % 3  # 0 venstre,1 midt,2 høyre
    rad = (att - 1) // 3  # 0 topp,1 midt,2 bunn
    a = ""
    if kol == 1: a += ' text-anchor="middle"'
    elif kol == 2: a += ' text-anchor="end"'
    if rad == 0: a += ' dominant-baseline="text-before-edge"'
    elif rad == 1: a += ' dominant-baseline="central"'
    return a.strip()

def beregn_startutsnitt(punkter, vbX, vbY, vbW, vbH, p=0.01):
    if len(punkter) < 50: return None
    xs = sorted(x for x,_ in punkter); ys = sorted(y for _,y in punkter)
    n = len(xs)
    def pct(arr, q): return arr[min(n-1, max(0, int(q*n)))]
    x0, x1 = pct(xs, p), pct(xs, 1-p)
    y0, y1 = pct(ys, p), pct(ys, 1-p)
    if x1-x0 < 1e-6 or y1-y0 < 1e-6: return None
    return {"x": (x0-vbX)/vbW, "y": (y0-vbY)/vbH, "w": (x1-x0)/vbW, "h": (y1-y0)/vbH}

if __name__ == "__main__":
    main()
