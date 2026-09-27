"""Monogram, seal, icons and lockups built on art.py primitives. All output is outlined vector SVG."""
from art import (C, BN_FONT, BN_TAG, LAT_FONT, WORD, TAGLINE, defs, style, mandala, mukut, paan_leaf,
                 gatchhara, divider, circle, f, emblem_svg)
from textpath import text_path, text_bbox

PA_FONT = ("NotoSerifBengali[wdth,wght].ttf", {"wght": 700})


def T_roles(mode, mono="#4D050C", uid=""):
    """Colour roles for text-and-monogram compositions on plain grounds."""
    u = uid
    if mode == "full":     # on ivory / white
        return dict(word=C["crimson"], tag="#8A5A0B", latin=C["crimson"], rule="#B98A2C", letter=C["crimson"],
                    leaf=f"url(#foil{u})", vein=C["crimson"], crown=C["crimson"], crown_line=C["gold_lite"], mono=False)
    if mode == "reverse":  # on crimson
        return dict(word=f"url(#foil{u})", tag=C["gold_lite"], latin=C["gold_lite"], rule="#C8922A",
                    letter=f"url(#foil{u})", leaf=f"url(#silk{u})", vein=C["gold_lite"], crown=f"url(#foil{u})",
                    crown_line=C["crimson"], mono=False)
    if mode == "sun":      # on the gold sun-disc
        return dict(word=C["crimson"], tag=C["crimson"], latin=C["crimson"], rule=C["crimson"], letter=C["crimson"],
                    leaf=f"url(#silk{u})", vein=C["gold_lite"], crown=C["crimson"], crown_line=C["gold_lite"], mono=False)
    m = mono
    return dict(word=m, tag=m, latin=m, rule=m, letter=m, leaf=m, vein="none", crown=m, crown_line="none", mono=True)


def _S_from_T(T):
    return dict(crown=T["crown"], crown_line=T["crown_line"], leaf=T["leaf"], leaf_vein=T["vein"], mono=T["mono"])


def monogram(T, cx=500, cy=520, scale=1.0):
    """Crown + প + paan leaf, designed in a 1000-unit box, drawn centred on (cx, cy)."""
    x0, y0, x1, y1 = text_bbox("প", PA_FONT[0], 640, PA_FONT[1])
    lx = 470 - (x0 + x1) / 2
    ly = 640 - (y0 + y1) / 2
    d, _ = text_path("প", PA_FONT[0], 640, lx, ly, PA_FONT[1])
    S2 = _S_from_T(T)
    g = [f'<g transform="translate({f(cx)} {f(cy)}) scale({f(scale)}) translate(-500 -520)">',
         f'<path d="{d}" fill="{T["letter"]}"/>',
         mukut(S2, 500, 356, 1.18),
         paan_leaf(S2, 712, 738, 1.3, 16),
         '</g>']
    return "".join(g)


def svg_wrap(w, h, body, bg=None, uid="", vb=None):
    vb = vb or f"0 0 {w} {h}"
    b = f'<rect x="-5000" y="-5000" width="10000" height="10000" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{h}">'
            f'{defs(uid)}{b}{body}</svg>')


def monogram_svg(mode, mono="#4D050C", bg=None):
    T = T_roles(mode, mono)
    return svg_wrap(800, 800, monogram(T, 400, 400, 1.0), bg)


def seal_svg(mode, mono="#4D050C", bg=None):
    """Circular submark: the emblem's mandala with the monogram inside the sun-disc."""
    S = style(mode, "", mono)
    parts = [mandala(S)]
    if S["mono"]:
        parts.append(circle(500, 500, 336, "none", S["disc_line"], 5))
        parts.append(circle(500, 500, 322, "none", S["disc_line"], 1.8))
        T = T_roles("mono", mono)
    else:
        parts.append(circle(500, 500, 340, S["disc"], S["disc_line"], 5))
        parts.append(circle(500, 500, 322, "none", "#B87A14", 1.6))
        T = T_roles("sun")
    parts.append(monogram(T, 500, 516, 0.8))
    return svg_wrap(1000, 1000, "".join(parts), bg)


def app_icon_svg(rounded=True):
    T = T_roles("reverse")
    r = 230 if rounded else 0
    body = (f'<rect width="1024" height="1024" rx="{r}" fill="url(#velvet)"/>'
            f'<rect x="34" y="34" width="956" height="956" rx="{max(r-34,0)}" fill="none" stroke="url(#foil)" stroke-width="3" opacity=".9"/>'
            f'<rect x="52" y="52" width="920" height="920" rx="{max(r-52,0)}" fill="none" stroke="url(#foil)" stroke-width="1.4" opacity=".6"/>'
            f'{monogram(T, 512, 522, 0.98)}')
    return svg_wrap(1024, 1024, body)


def favicon_svg(rounded=True):
    """Small-size icon: large flat-gold প on crimson (no crown, leaf or gradient: they vanish below 48px)."""
    size = 960
    x0, y0, x1, y1 = text_bbox("প", PA_FONT[0], size, PA_FONT[1])
    d, _ = text_path("প", PA_FONT[0], size, 512 - (x0 + x1) / 2, 512 - (y0 + y1) / 2, PA_FONT[1])
    r = 230 if rounded else 0
    body = f'<rect width="1024" height="1024" rx="{r}" fill="#4D050C"/><path d="{d}" fill="#F2CF6E"/>'
    return svg_wrap(1024, 1024, body)


def _justified_latin(text, cx, base, size, width, fill, weight=600):
    """Latin line set in Cinzel with tracking chosen so its ink width equals `width`."""
    x0, _, x1, _ = text_bbox(text, LAT_FONT[0], size, {"wght": weight})
    tr = (width - (x1 - x0)) / (len(text) - 1)
    d, _ = text_path(text, LAT_FONT[0], size, cx - width / 2 - x0, base, {"wght": weight}, tracking=tr)
    return f'<path d="{d}" fill="{fill}"/>'


def wordmark_svg(mode, mono="#4D050C", bg=None, with_tag=True):
    T = T_roles(mode, mono)
    W, H = 1400, (560 if with_tag else 380)
    x0, y0, x1, y1 = text_bbox(WORD, BN_FONT[0], 300, BN_FONT[1])
    d, _ = text_path(WORD, BN_FONT[0], 300, W / 2 - (x0 + x1) / 2, 300, BN_FONT[1])
    body = f'<path d="{d}" fill="{T["word"]}"/>'
    if with_tag:
        td, _ = text_path(TAGLINE, BN_TAG[0], 72, W / 2, 470, BN_TAG[1], anchor="middle", tracking=3)
        body += f'<path d="{td}" fill="{T["tag"]}"/>'
    return svg_wrap(W, H, body, bg)


def stacked_svg(mode, mono="#4D050C", bg=None):
    """Crown / wordmark / Latin / tagline / knot: the ring-free version of the primary emblem."""
    T = T_roles(mode, mono)
    S = _S_from_T(T)
    W, H = 1200, 1300
    body = [mukut(S, 600, 250, 1.5)]
    x0, y0, x1, y1 = text_bbox(WORD, BN_FONT[0], 300, BN_FONT[1])
    d, _ = text_path(WORD, BN_FONT[0], 300, 600 - (x0 + x1) / 2, 560, BN_FONT[1])
    body.append(f'<path d="{d}" fill="{T["word"]}"/>')
    body.append(_justified_latin("PARINEETA", 600, 665, 56, (x1 - x0) * 0.78, T["latin"]))
    body.append(divider(dict(ring=T["rule"], mono=T["mono"]), 600, 725, 150))
    td, _ = text_path(TAGLINE, BN_TAG[0], 62, 600, 830, BN_TAG[1], anchor="middle", tracking=3)
    body.append(f'<path d="{td}" fill="{T["tag"]}"/>')
    Sk = style("full" if mode == "full" else "reverse" if mode == "reverse" else "mono", "", mono)
    body.append(gatchhara(Sk, 600, 1000, 1.25))
    return svg_wrap(W, H, "".join(body), bg)


def horizontal_svg(mode, mono="#4D050C", bg=None):
    T = T_roles(mode, mono)
    H = 700
    body = [monogram(T, 330, 350, 0.72),
            f'<path d="M660 130 V570" stroke="{T["rule"]}" stroke-width="3"/>']
    x0, y0, x1, y1 = text_bbox(WORD, BN_FONT[0], 300, BN_FONT[1])
    ww = x1 - x0
    wx = 760
    d, _ = text_path(WORD, BN_FONT[0], 300, wx - x0, 400, BN_FONT[1])
    body.append(f'<path d="{d}" fill="{T["word"]}"/>')
    body.append(_justified_latin("PARINEETA", wx + ww / 2, 490, 54, ww, T["latin"]))
    td, _ = text_path(TAGLINE, BN_TAG[0], 58, wx + ww / 2, 585, BN_TAG[1], anchor="middle", tracking=3)
    body.append(f'<path d="{td}" fill="{T["tag"]}"/>')
    W = int(wx + ww + 120)
    return svg_wrap(W, H, "".join(body), bg)


def emblem_svg_reverse():
    return emblem_svg("reverse")
