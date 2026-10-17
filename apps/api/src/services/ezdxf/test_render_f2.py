"""F2-gruppe + F1 nærmeste-merking (§7 pkt 17, spec § 3 F1/F2). Kjøres i
ezdxf-venv (samme Python-miljø render.py kjører i, se Dockerfile.api/.web
EZDXF_PYTHON) — ikke en del av pnpm-testsuiten (ingen eksisterende pytest-
oppsett for render.py fantes; disse tre funksjonene tar enkle dict/listepuner,
ingen ezdxf-objekter, og er derfor testbare i isolasjon).

Kjør: EZDXF_PYTHON pytest test_render_f2.py -v
"""

from render import (
    tolk_lag_gruppe, lag_dominante_revit_kategorier, beregn_naermeste_merking,
    gruppe_visningsnavn,
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
    assert gruppe_visningsnavn("A-") == "Arkitekt"
    assert gruppe_visningsnavn("P-") == "Rør"


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
