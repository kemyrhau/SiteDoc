#!/usr/bin/env python3
"""PoC: ezdxf som DXF->SVG-motor bak SiteDocs eksisterende lag.

Dette er IKKE produksjonskode. Det er en målbar prøve (jf.
relay/inbox-dokgen-ezdxf-poc.md). Motoren er ment å kunne byttes inn bak
flagget DWG_MOTOR=ezdxf i konverterDwg (apps/api/.../dwgKonvertering.ts),
og returnere samme DxfSvgResultat-form {svg, vbW, vbH, width, height,
autoRotasjon, startutsnitt, rapport}.

Arkitektur (jf. LAG-KART.md):
- ezdxf Frontend tegner geometri til native SVGBackend (= en Recorder).
  Vi leser player.recordings() -> primitiver i VERDENSKOORDINATER (DXF-enheter),
  med per-element farge + lineweight + lag + handle i BackendProperties.
- INGEN SVGBackend-subklasse (scope-kutt, orkestrator 2026-10-10). Vi bruker
  kun den offentlige Player-API-en.
- TextPolicy.IGNORE: ezdxf tegner IKKE tekst. Vi emitterer TEXT/MTEXT/ATTRIB
  som ekte <text> med vår egen kode (fontStr=h/0.716, mtekstForankring,
  motrotering), slik dxfTilSvg gjør i dag.
- viewBox i DXF-ENHETER med y-flip + 2% margin (som dxfTilSvg), IKKE ezdxf
  sin 1e6-normalisering -> mmPrPiksel/georef blir motor-uavhengig (krav 6).
- Strek i viewBox-enheter, INGEN vector-effect (hotfix 2-lærdom:
  non-scaling-stroke regnes mot feil CTM i iOS WebKit <img> -> svart flate).
"""
from __future__ import annotations
import argparse, json, math, sys, time, html
from dataclasses import dataclass, field

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.svg import SVGBackend
from ezdxf.addons.drawing.config import (
    Configuration, TextPolicy, LineweightPolicy, LinePolicy, HatchPolicy,
    BackgroundPolicy, ColorPolicy,
)
from ezdxf.math import Matrix44

CAP_RATIO = 0.716          # dwgKonvertering.ts:1296
LANGSIDE_PIKSEL = 2000     # dwgKonvertering.ts (hotfix mobil)
MARGIN_ANDEL = 0.02        # dwgKonvertering.ts:1954

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

def hent_primitiver(player, flatten_dist, db=None):
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
        if cls == "PathRecord":
            d = path_til_d(record.path, flatten_dist, close=False)
            if d: prims.append(Prim("stroke", d, color, lw, layer, handle, dtype))
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
                prims.append(Prim("stroke", f"M {p0.x:.4f} {p0.y:.4f} L {p1.x:.4f} {p1.y:.4f}", color, lw, layer, handle, dtype))
            elif n == 1:
                p = pts[0]
                prims.append(Prim("stroke", f"M {p.x:.4f} {p.y:.4f} L {p.x:.4f} {p.y:.4f}", color, lw, layer, handle, dtype))
        elif cls == "SolidLinesRecord":
            pts = record.lines.vertices()
            segs = []
            for i in range(0, len(pts) - 1, 2):
                a, b = pts[i], pts[i+1]
                segs.append(f"M {a.x:.4f} {a.y:.4f} L {b.x:.4f} {b.y:.4f}")
            if segs: prims.append(Prim("stroke", " ".join(segs), color, lw, layer, handle, dtype))
    return prims

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
# M/L/Q/C/Z. (PoC — ytelse ok for engangskonvertering.)
import re
_TOKEN = re.compile(r"([MLQCZ])|(-?\d+(?:\.\d+)?)")

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
    ap.add_argument("--gruppering", choices=["farge", "ingen"], default="farge",
                    help="farge=mega-paths (liten fil), ingen=per-primitiv (jevn perf)")
    ap.add_argument("--metadata", choices=["av", "på"], default="av",
                    help="på = data-layer (fra player) + data-type (via handle) pr. element "
                         "(kun gruppering=ingen) — gjenoppretter klikk-identifiser + rapport UTEN subklasse")
    ap.add_argument("--meta", help="skriv JSON-metadata hit")
    ap.add_argument("--flatten-mm", type=float, default=0.1)
    args = ap.parse_args()

    t0 = time.time()
    doc = ezdxf.readfile(args.dxf)
    msp = doc.modelspace()
    mmPrEnhet = {1: 25.4, 2: 304.8, 4: 1.0, 5: 10.0, 6: 1000.0}.get(doc.header.get("$INSUNITS", 0))
    t_les = time.time() - t0

    ctx = RenderContext(doc)
    cfg = Configuration(
        text_policy=TextPolicy.IGNORE if args.tekst != "ezdxf" else TextPolicy.OUTLINE,
        line_policy=LinePolicy.ACCURATE,
        hatch_policy=HatchPolicy.NORMAL,
        background_policy=BackgroundPolicy.WHITE,
        color_policy=ColorPolicy.COLOR,
        lineweight_policy=LineweightPolicy.ABSOLUTE,
    )
    backend = SVGBackend()
    t1 = time.time()
    Frontend(ctx, backend, config=cfg).draw_layout(msp)
    t_tegn = time.time() - t1

    player = backend.player()
    prims = hent_primitiver(player, args.flatten_mm, db=doc.entitydb if args.metadata == "på" else None)

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

    # auto-rotasjon
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    R = 0.0
    if args.rotasjon == "auto":
        vegg = dominant_veggvinkel(segmenter)
        if vegg and vegg["andel"] >= 0.6:
            Rk = velg_auto_rotasjon(vegg["grader"], tekstrot)
            if abs(Rk) >= 0.5:
                R = Rk
    rotm = rot_matrise(R, cx, cy) if R else None

    # extents etter rotasjon (robust trim)
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

    # emit. gruppering=farge: slå sammen per (farge,strek) -> få mega-paths (liten
    # fil, men dårlig panorerings-perf — hele pathen må re-rasteriseres). gruppering=ingen:
    # én path pr. primitiv (flere noder, men nettleseren kan delinvalidere -> jevn perf).
    fills = []
    stroke_paths = []
    strokes_by = {}
    def meta_attr(p):
        if args.metadata != "på":
            return ""
        lag = f' data-layer="{html.escape(p.layer)}"' if p.layer else ""
        typ = f' data-type="{html.escape(p.dtype)}"' if p.dtype else ""
        return lag + typ
    for p in prims:
        td = transform_d(p.d, rotm, minx, miny, rund)
        if not td: continue
        if p.kind == "fill":
            fills.append(f'<path d="{td}" fill="{p.color}" stroke="none"{meta_attr(p)}/>')
        else:
            swv = lw_til_vb(p.lineweight)
            if args.gruppering == "ingen":
                stroke_paths.append(f'<path d="{td}" fill="none" stroke="{p.color}" stroke-width="{swv}"{meta_attr(p)}/>')
            else:
                strokes_by.setdefault((p.color, swv), []).append(td)
    for (color, swv), ds in strokes_by.items():
        stroke_paths.append(f'<path d="{" ".join(ds)}" fill="none" stroke="{color}" stroke-width="{swv}"/>')

    # tekst som egen <text>
    text_svg = []
    startPkt = []
    if args.tekst == "egen":
        for t in tekster:
            x, y = t["x"], t["y"]
            if rotm: x, y = roter_pkt(x, y, rotm)
            nx = rund(x - minx); ny = rund(-(y - miny))
            startPkt.append((nx, ny))
            fs = round((t["h"] / CAP_RATIO) * 100) / 100
            anchor = mtekst_forankring(t.get("att"))
            rot_attr = f' transform="rotate({-t["rot"]:g} {nx:g} {ny:g})"' if t["rot"] else ""
            text_svg.append(
                f'<text x="{nx:g}" y="{ny:g}" font-size="{fs:g}" font-family="sans-serif" '
                f'fill="{t["color"]}"{(" "+anchor) if anchor else ""}{rot_attr}>{html.escape(t["tekst"])}</text>'
            )
    for p in prims:
        pass

    # startutsnitt (persentil 1-99 av tegnede punkter i SVG-piksel-brøk)
    startutsnitt = beregn_startutsnitt(
        [(rund((roter_pkt(x,y,rotm)[0] if rotm else x) - minx),
          rund(-(((roter_pkt(x,y,rotm)[1] if rotm else y)) - miny))) for (x,y) in zip(xs,ys)],
        vbX, vbY, vbW, vbH)

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vbX:g} {vbY:g} {vbW:g} {vbH:g}" '
        f'width="{svgBredde}" height="{svgHoyde}">'
        f'<rect x="{vbX:g}" y="{vbY:g}" width="{vbW:g}" height="{vbH:g}" fill="#ffffff"/>'
        f'<g stroke-linecap="round" stroke-linejoin="round">'
        + "".join(fills) + "".join(stroke_paths) + "".join(text_svg)
        + "</g></svg>"
    )
    with open(args.ut_svg, "w") as f:
        f.write(svg)
    t_tot = time.time() - t0

    import subprocess
    noder = svg.count("<path") + svg.count("<text")
    meta = {
        "fil": args.dxf, "tekst": args.tekst, "rotasjon": args.rotasjon, "lineweight": args.lineweight,
        "mmPrEnhet": mmPrEnhet, "autoRotasjon": R,
        "vbW": vbW, "vbH": vbH, "width": svgBredde, "height": svgHoyde,
        "strekBredde": strekBredde, "koordDesimaler": dec,
        "svg_bytes": len(svg.encode()), "path_noder": svg.count("<path"),
        "text_noder": svg.count("<text"), "noder_total": noder,
        "antall_tekster": len(tekster),
        "extents": {"minX": minx, "maxX": maxx, "minY": miny, "maxY": maxy},
        "mmPrPiksel": (vbW * mmPrEnhet) / svgBredde if mmPrEnhet else vbW / svgBredde,
        "startutsnitt": startutsnitt,
        "tid_s": {"les": round(t_les,2), "tegn": round(t_tegn,2), "total": round(t_tot,2)},
    }
    if args.meta:
        with open(args.meta, "w") as f: json.dump(meta, f, indent=2)
    print(json.dumps(meta, indent=2))

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

def les_tekster(msp):
    ut = []
    for e in msp:
        t = e.dxftype()
        if t == "TEXT":
            ut.append({"tekst": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.height, "rot": e.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None})
        elif t == "MTEXT":
            ut.append({"tekst": _ren_mtext(e.text), "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.char_height, "rot": math.degrees(e.dxf.get("rotation", 0) or 0) if e.dxf.get("rotation",0) and abs(e.dxf.get("rotation",0))>2*math.pi else (e.dxf.get("rotation",0) or 0),
                       "color": "#000000", "att": e.dxf.get("attachment_point", 1)})
        elif t == "ATTRIB":
            ut.append({"tekst": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                       "h": e.dxf.height, "rot": e.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None})
    # INSERT -> ATTRIB
    for ins in msp.query("INSERT"):
        for att in ins.attribs:
            ut.append({"tekst": att.dxf.text, "x": att.dxf.insert.x, "y": att.dxf.insert.y,
                       "h": att.dxf.height, "rot": att.dxf.get("rotation", 0) or 0,
                       "color": "#000000", "att": None})
    return [t for t in ut if (t["tekst"] or "").strip()]

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
