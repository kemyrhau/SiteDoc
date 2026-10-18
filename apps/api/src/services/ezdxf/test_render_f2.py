"""F2-gruppe + F1 nærmeste-merking (§7 pkt 17, spec § 3 F1/F2). Kjøres i
ezdxf-venv (samme Python-miljø render.py kjører i, se Dockerfile.api/.web
EZDXF_PYTHON) — ikke en del av pnpm-testsuiten (ingen eksisterende pytest-
oppsett for render.py fantes; disse tre funksjonene tar enkle dict/listepuner,
ingen ezdxf-objekter, og er derfor testbare i isolasjon).

Kjør: EZDXF_PYTHON pytest test_render_f2.py -v
"""

from render import (
    tolk_lag_gruppe, lag_dominante_revit_kategorier, beregn_naermeste_merking,
    gruppe_visningsnavn, tolk_lagnavn, bygg_objektregister, layer_info_map,
    er_arkicad_hjelpelinje,
)


def test_tolk_lag_gruppe_ns3451():
    assert tolk_lag_gruppe("242- Ikke-bærende innervegger") == "242"


def test_tolk_lag_gruppe_a_prefiks():
    assert tolk_lag_gruppe("A24_innervegg") == "24"


def test_tolk_lag_gruppe_sosi():
    assert tolk_lag_gruppe("8250 Kum") == "8250"


def test_tolk_lag_gruppe_aia():
    assert tolk_lag_gruppe("A-WALL-FULL") == "A-"


def test_tolk_lag_gruppe_ingen_treff():
    # Rått fag-internt system-lag (MEP) — ingen NS 3451/AIA/SOSI-konvensjon.
    assert tolk_lag_gruppe("V3411") == ""


def test_gruppe_visningsnavn_ns3451():
    # MÅLT på fallplanen: lagnavnet "244- Vinduer_ dører_ foldevegger" gir
    # gruppe-kode "244" via tolk_lag_gruppe() — navnet skal komme fra tabellen,
    # ikke den rå koden (RETUR F1+F2 web, "Kenneth leser ikke koder").
    assert gruppe_visningsnavn("244") == "Vinduer, dører, foldevegger"
    assert gruppe_visningsnavn("231") == "Bærende yttervegger"


def test_gruppe_visningsnavn_aia():
    # Alle fem AIA-fagnavn bekreftet av Kenneth (SVAR F1+F2 web r2, 2026-10-17).
    assert gruppe_visningsnavn("A-") == "Arkitekt"
    assert gruppe_visningsnavn("S-") == "Konstruksjon"
    assert gruppe_visningsnavn("P-") == "VVS (rør)"
    assert gruppe_visningsnavn("I-") == "Interiør"
    assert gruppe_visningsnavn("Q-") == "Utstyr"


def test_gruppe_visningsnavn_revit_kategori_overstyrer():
    # Revit-XDATA-kategorien er allerede menneskelesbar — brukes uendret, selv
    # om lagnavnet OGSÅ matcher en NS 3451-kode.
    assert gruppe_visningsnavn("242", revit_kategori="Vegger") == "Vegger"


def test_gruppe_visningsnavn_ukjent_kode_faller_til_andre():
    # MÅLT på fallplanen: "82-- Modullinjer" og "878- Annen overflate..." er
    # ArchiCAD-interne lagkoder i 80-89-serien, IKKE NS 3451 (som stopper på 79).
    assert gruppe_visningsnavn("82") == "Andre"
    assert gruppe_visningsnavn("878") == "Andre"


def test_gruppe_visningsnavn_ingen_kode():
    assert gruppe_visningsnavn("") == "Andre"


def test_lag_dominante_revit_kategorier_velger_mest_frekvent():
    objekter = {
        "h1": {"lag": "A23", "elid": "1", "kategori": "Vegger"},
        "h2": {"lag": "A23", "elid": "2", "kategori": "Vegger"},
        "h3": {"lag": "A23", "elid": "3", "kategori": "Dører"},
        "h4": {"lag": "A82_akser", "kategori": "Akser"},  # ingen elid -> ikke talt
    }
    res = lag_dominante_revit_kategorier(objekter)
    assert res["A23"] == "Vegger"
    assert "A82_akser" not in res  # ingen elid-objekter -> ingen dominant kategori


def test_naermeste_merking_a12_system_lag_innen_grense():
    # "linje på V3411" (rått system-lag) nær "15.TR"-teksten -> merket.
    objekter_world = {
        "h1": {"lag": "V3411", "dtype": "LINE", "bbox": [0, 0, 10, 0]},
    }
    tekster = [{"tekst": "15.TR", "x": 5, "y": 5, "h": 2, "layer": "V341-T"}]
    beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat={})
    assert objekter_world["h1"]["naermesteMerking"] == "15.TR"


def test_naermeste_merking_utenfor_grense_gir_ingenting():
    objekter_world = {
        "h1": {"lag": "V3411", "dtype": "LINE", "bbox": [0, 0, 10, 0]},
    }
    # Teksthøyde 2 -> grense 8; plassert 100 enheter unna -> utenfor.
    tekster = [{"tekst": "15.TR", "x": 100, "y": 100, "h": 2, "layer": "V341-T"}]
    beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat={})
    assert "naermesteMerking" not in objekter_world["h1"]


def test_naermeste_merking_ns3451_lag_ekskluderes():
    # MÅLT regresjon (fallplanen): et NS 3451-lag ("242...") skal ALDRI få
    # nærmeste-merking, selv om det ligger nær en tekst på et "(Tekst)"-lag —
    # det har allerede en egen kategori.
    objekter_world = {
        "h1": {"lag": "242- Ikke-bærende innervegger", "dtype": "LINE", "bbox": [0, 0, 1, 0]},
    }
    tekster = [{"tekst": "Sluse", "x": 0, "y": 0, "h": 5, "layer": "242- Ikke-bærende innervegger(Tekst)"}]
    beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat={})
    assert "naermesteMerking" not in objekter_world["h1"]


def test_naermeste_merking_ignorerer_objekt_med_egen_tekst():
    objekter_world = {
        "h1": {"lag": "V3411", "dtype": "INSERT", "blokk": "Ventil", "bbox": [0, 0, 1, 0]},
    }
    tekster = [{"tekst": "15.TR", "x": 0, "y": 0, "h": 2, "layer": "V341-T"}]
    beregn_naermeste_merking(objekter_world, tekster, lag_dominant_kat={})
    assert "naermesteMerking" not in objekter_world["h1"]


def test_tolk_lagnavn_aia_type_kjent():
    # POST flytte målepunkter, orkestrator 2026-10-18, pkt 4c: bug-eksempelet
    # "I-WALL-, -OTLN.IFC-standardImport" falt rått igjennom før denne grenen fantes.
    assert tolk_lagnavn("I-WALL-, -OTLN.IFC-standardImport") == "Interiør – vegg"
    assert tolk_lagnavn("A-DOOR-FULL") == "Arkitekt – dør"
    assert tolk_lagnavn("S-COLS") == "Konstruksjon – søyle"


def test_tolk_lagnavn_aia_ukjent_type_faller_til_fagnavn():
    assert tolk_lagnavn("A-XYZZY") == "Arkitekt"


def test_tolk_lagnavn_aia_ukjent_fag_faller_til_raatt_navn():
    assert tolk_lagnavn("X-WALL") == "X-WALL"


def test_tolk_lagnavn_ns3451_uendret_av_aia_grenen():
    # Regresjon: NS 3451-grenene (med siffer) skal fortsatt vinne over AIA-grenen.
    assert tolk_lagnavn("A24_innervegg") == "innervegg · 24"
    assert tolk_lagnavn("242- Ikke-bærende innervegger") == "Ikke-bærende innervegger · 242"


def test_bygg_objektregister_skralinjer2_er_isolasjon():
    # SVAR dda4110b (orkestrator 2026-10-18): verifisert mot EKTE fallplan-DXF
    # (relay/arbeidstegning-prove/gate1/fallplan.dxf) med ezdxf — ingen "isol"-
    # substreng forekommer noe sted i fila. Isolasjonen i ytterveggene er HATCH-
    # mønsteret "Skrålinjer_2" på laget "231- Bærende yttervegger (Skravur)",
    # KUN der (48/48 treff, aldri andre lag). Regresjonstest for MATERIALE-
    # tabellens oppslag, ikke en antagelse om "isol" i navnet.
    import ezdxf

    doc = ezdxf.new()
    msp = doc.modelspace()
    lag = "231- Bærende yttervegger (Skravur)"
    doc.layers.add(lag)
    h = msp.add_hatch(dxfattribs={"layer": lag})
    h.set_pattern_fill("Skrålinjer_2", scale=1.0)
    h.paths.add_polyline_path([(0, 0), (100, 0), (100, 104), (0, 104)], is_closed=True)
    lagmap = layer_info_map(doc)
    objekter, _ = bygg_objektregister(doc, msp, [h.dxf.handle], lagmap)
    obj = objekter[h.dxf.handle]
    assert "isol" not in obj["lag"].lower()
    assert obj["materiale"] == "Isolasjon"


def test_er_arkicad_hjelpelinje_80_89_serie():
    # RETUR isolasjon `7d5d6787` pkt 2: "Modullinjer · 82" og "Snittmarkør · 852" er
    # MÅLT på EKTE fallplan-DXF å være ArchiCAD-interne 80-89-hjelpelinjer (28-125 m
    # enkeltlinjer) — ikke NS 3451-bygningsdeler. Dekker begge kode-lengder (2 og 3
    # siffer, samme hovedgruppe 80-89).
    assert er_arkicad_hjelpelinje("82-- Modullinjer") is True
    assert er_arkicad_hjelpelinje("852- Snittmarkør") is True
    assert er_arkicad_hjelpelinje("858- Detaljer") is True
    assert er_arkicad_hjelpelinje("862- Nettoareal") is True


def test_er_arkicad_hjelpelinje_negativkontroll_ekte_bygningsdel():
    # Ekte NS 3451-bygningsdel (23-serie) skal ALDRI flagges som hjelpelinje —
    # regresjon mot at 80-89-sjekken ved en feil fanger alt med to/tre siffer.
    assert er_arkicad_hjelpelinje("231- Bærende yttervegger (Skravur)") is False
    assert er_arkicad_hjelpelinje("242- Ikke-bærende innervegger") is False
    assert er_arkicad_hjelpelinje("") is False


def test_bygg_objektregister_modullinje_faar_hjelpelinje_flagg():
    import ezdxf

    doc = ezdxf.new()
    msp = doc.modelspace()
    lag = "82-- Modullinjer"
    doc.layers.add(lag)
    ln = msp.add_line((0, 0), (1000, 0), dxfattribs={"layer": lag})
    lagmap = layer_info_map(doc)
    objekter, _ = bygg_objektregister(doc, msp, [ln.dxf.handle], lagmap)
    obj = objekter[ln.dxf.handle]
    assert obj.get("hjelpelinje") is True


def test_bygg_objektregister_ekte_vegg_faar_ikke_hjelpelinje_flagg():
    import ezdxf

    doc = ezdxf.new()
    msp = doc.modelspace()
    lag = "231- Bærende yttervegger"
    doc.layers.add(lag)
    ln = msp.add_line((0, 0), (1000, 0), dxfattribs={"layer": lag})
    lagmap = layer_info_map(doc)
    objekter, _ = bygg_objektregister(doc, msp, [ln.dxf.handle], lagmap)
    obj = objekter[ln.dxf.handle]
    assert "hjelpelinje" not in obj
