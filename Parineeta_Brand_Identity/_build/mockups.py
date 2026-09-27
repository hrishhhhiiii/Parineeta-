"""Alpana pattern, stationery / packaging / signage mockups and social templates (all vector)."""
import re
import math
import marks
from art import (C, WORD, TAGLINE, BN_FONT, BN_TAG, LAT_FONT, defs, style, emblem_body, arch, petal, teardrop,
                 mukut, gatchhara, divider, circle, polar, f)
from textpath import text_path, text_bbox

HIND = {"Regular": "HindSiliguri-Regular.ttf", "SemiBold": "HindSiliguri-SemiBold.ttf"}
CORM = ("CormorantGaramond[wght].ttf", {"wght": 500})
CORM_I = ("CormorantGaramond-Italic[wght].ttf", {"wght": 500})

SHADOW = ('<filter id="sh" x="-20%" y="-20%" width="140%" height="160%">'
          '<feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="#2B0307" flood-opacity=".38"/></filter>'
          '<filter id="sh2" x="-20%" y="-20%" width="140%" height="160%">'
          '<feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#2B0307" flood-opacity=".30"/></filter>')


def sans(text, x, y, size, fill, anchor="start", weight="Regular", tracking=0):
    d, _ = text_path(text, HIND[weight], size, x, y, None, tracking=tracking, anchor=anchor)
    return f'<path d="{d}" fill="{fill}"/>'


def cinzel(text, x, y, size, fill, anchor="start", tracking=0, weight=600):
    d, _ = text_path(text, LAT_FONT[0], size, x, y, {"wght": weight}, tracking=tracking, anchor=anchor)
    return f'<path d="{d}" fill="{fill}"/>'


def corm(text, x, y, size, fill, anchor="start", tracking=0, italic=False):
    fnt = CORM_I if italic else CORM
    d, _ = text_path(text, fnt[0], size, x, y, fnt[1], tracking=tracking, anchor=anchor)
    return f'<path d="{d}" fill="{fill}"/>'


def bn(text, x, y, size, fill, anchor="middle", tracking=0, tag=False):
    fnt = BN_TAG if tag else BN_FONT
    d, _ = text_path(text, fnt[0], size, x, y, fnt[1], tracking=tracking, anchor=anchor)
    return f'<path d="{d}" fill="{fill}"/>'


def nest(svg, x, y, w, h):
    """Embed a full standalone SVG string as a positioned <svg> element."""
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    inner = svg[svg.index(">") + 1: svg.rindex("</svg>")]
    return (f'<svg x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" viewBox="{vb}" '
            f'preserveAspectRatio="xMidYMid meet">{inner}</svg>')


def canvas(w, h, body, bg=None, extra_defs=""):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    d = defs().replace("</defs>", SHADOW + extra_defs + "</defs>")
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{d}{b}{body}</svg>'


# ------------------------------------------------------------------ alpana pattern
def alpana_tile(line, accent, size=240):
    """A repeating tile drawn like rice-paste alpana: central lotus, diamond links and dot clusters."""
    h = size / 2
    g = [f'<g fill="none" stroke="{line}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">']
    # central 8-petal lotus
    for k in range(8):
        g.append(f'<path d="{petal(46, 24)}" transform="translate({h} {h}) rotate({k*45}) translate(0 -8)"/>')
    for k in range(8):
        g.append(f'<path d="{petal(22, 12)}" transform="translate({h} {h}) rotate({k*45+22.5}) translate(0 -6)" fill="{line}" stroke="none"/>')
    g.append(circle(h, h, 8, accent, "none"))
    g.append(circle(h, h, 60, "none", line, 1.4))
    # diamond links to neighbours
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        x, y = h + dx * (h - 6), h + dy * (h - 6)
        g.append(f'<path d="M{f(x)} {f(y-14)} L{f(x+14)} {f(y)} L{f(x)} {f(y+14)} L{f(x-14)} {f(y)}Z"/>')
        g.append(circle(x, y, 3.2, accent, "none"))
    g.append('</g>')
    # dot clusters at the tile corners
    for cx, cy in ((0, 0), (size, 0), (0, size), (size, size)):
        for k in range(8):
            x, y = polar(22, k * 45)
            g.append(circle(cx + x, cy + y, 2.6, accent))
        g.append(circle(cx, cy, 5, accent))
    return "".join(g)


def pattern_svg(bg, line, accent, w=1600, h=1600, size=240):
    pat = (f'<pattern id="alpana" width="{size}" height="{size}" patternUnits="userSpaceOnUse">'
           f'<rect width="{size}" height="{size}" fill="{bg}"/>{alpana_tile(line, accent, size)}</pattern>')
    return canvas(w, h, f'<rect width="{w}" height="{h}" fill="url(#alpana)"/>', extra_defs=pat)


def pattern_fill(bg, line, accent, pid, size=240, opacity=1):
    return (f'<pattern id="{pid}" width="{size}" height="{size}" patternUnits="userSpaceOnUse">'
            f'<rect width="{size}" height="{size}" fill="{bg}" fill-opacity="{opacity}"/>{alpana_tile(line, accent, size)}</pattern>')


# ------------------------------------------------------------------ business cards
def business_cards():
    W, H = 2000, 1300
    cw, ch = 900, 514   # 3.5 : 2
    body = []
    ground = f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>'
    # back card (ivory with details) - lower right
    bx, by = 1010, 640
    body.append(f'<g filter="url(#sh)" transform="rotate(-3 {bx+cw/2} {by+ch/2})">'
                f'<rect x="{bx}" y="{by}" width="{cw}" height="{ch}" rx="10" fill="{C["ivory"]}"/>'
                f'<rect x="{bx+16}" y="{by+16}" width="{cw-32}" height="{ch-32}" rx="6" fill="none" stroke="#C8922A" stroke-width="1.6"/>'
                f'{nest(marks.horizontal_svg("full"), bx+44, by+34, 470, 148)}'
                f'{cinzel("PROPRIETOR NAME", bx+56, by+250, 26, C["crimson"], tracking=4)}'
                f'{sans("Designation", bx+56, by+284, 22, "#8A5A0B")}'
                f'{sans("+91 00000 00000", bx+56, by+352, 22, "#4D050C")}'
                f'{sans("hello@yourdomain.com", bx+56, by+386, 22, "#4D050C")}'
                f'{sans("Shop / Studio address line, City – PIN", bx+56, by+420, 22, "#4D050C")}'
                f'{nest(marks.seal_svg("full"), bx+cw-250, by+ch-260, 210, 210)}'
                f'</g>')
    # front card (crimson velvet) - upper left
    fx, fy = 150, 180
    pf = pattern_fill("#4D050C", "#7C1522", "#7C1522", "pfront", 120)
    body.append(f'<g filter="url(#sh)" transform="rotate(2 {fx+cw/2} {fy+ch/2})">'
                f'<rect x="{fx}" y="{fy}" width="{cw}" height="{ch}" rx="10" fill="url(#velvet)"/>'
                f'<rect x="{fx}" y="{fy}" width="{cw}" height="{ch}" rx="10" fill="url(#pfront)" opacity=".55"/>'
                f'<rect x="{fx+16}" y="{fy+16}" width="{cw-32}" height="{ch-32}" rx="6" fill="none" stroke="url(#foil)" stroke-width="2"/>'
                f'{nest(marks.stacked_svg("reverse"), fx+cw/2-190, fy+30, 380, 454)}'
                f'</g>')
    return canvas(W, H, ground + "".join(body), extra_defs=pf)


# ------------------------------------------------------------------ letterhead
def letterhead():
    W, H = 1800, 2200
    pw, ph = 1240, 1754  # A4 ratio
    px, py = (W - pw) / 2, (H - ph) / 2
    body = [f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>',
            f'<g filter="url(#sh)"><rect x="{px}" y="{py}" width="{pw}" height="{ph}" fill="#FFFDF6"/></g>',
            f'<g opacity=".07">{nest(marks.seal_svg("mono", "#8A5A0B"), px+pw/2-380, py+ph/2-330, 760, 760)}</g>',
            f'{nest(marks.horizontal_svg("full"), px+90, py+80, 560, 176)}',
            f'<path d="M{px+90} {py+290} H{px+pw-90}" stroke="#C8922A" stroke-width="2"/>',
            divider(dict(ring="#B98A2C", mono=False), px + pw / 2, py + 290, 0) if False else ""]
    # placeholder letter text (light rules in place of lorem)
    for i in range(11):
        wln = pw - 180 - (0 if i % 4 != 3 else 260)
        body.append(f'<rect x="{px+90}" y="{py+440+i*46}" width="{wln}" height="8" rx="4" fill="#D9CDB0"/>')
    body.append(f'{sans("Date", px+pw-260, py+360, 22, "#8A5A0B")}')
    # footer
    fy = py + ph - 120
    body.append(f'<path d="M{px+90} {fy-30} H{px+pw-90}" stroke="#C8922A" stroke-width="2"/>')
    body.append(sans("+91 00000 00000", px + 90, fy + 12, 22, "#4D050C"))
    body.append(sans("hello@yourdomain.com", px + pw / 2, fy + 12, 22, "#4D050C", anchor="middle"))
    body.append(sans("Address line, City – PIN", px + pw - 90, fy + 12, 22, "#4D050C", anchor="end"))
    body.append(f'<rect x="{px}" y="{py+ph-14}" width="{pw}" height="14" fill="#4D050C"/>')
    return canvas(W, H, "".join(body))


# ------------------------------------------------------------------ envelope with wax-style seal
def envelope():
    W, H = 2000, 1200
    ew, eh = 1500, 750
    ex, ey = (W - ew) / 2, (H - eh) / 2 + 20
    flap = f"M{ex} {ey} L{ex+ew/2} {ey+eh*0.58} L{ex+ew} {ey} Z"
    body = [f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>',
            f'<g filter="url(#sh)"><rect x="{ex}" y="{ey}" width="{ew}" height="{eh}" rx="6" fill="url(#velvet)"/></g>',
            f'<path d="M{ex} {ey+eh} L{ex+ew*0.42} {ey+eh*0.42} M{ex+ew} {ey+eh} L{ex+ew*0.58} {ey+eh*0.42}" stroke="#7C1522" stroke-width="3" fill="none"/>',
            f'<path d="{flap}" fill="#5E0913" stroke="#C8922A" stroke-width="3" stroke-linejoin="round"/>',
            f'<path d="M{ex+30} {ey+22} L{ex+ew/2} {ey+eh*0.53} L{ex+ew-30} {ey+22}" fill="none" stroke="url(#foil)" stroke-width="2" opacity=".8"/>',
            f'<g filter="url(#sh2)">{nest(marks.seal_svg("full"), ex+ew/2-135, ey+eh*0.58-135, 270, 270)}</g>',
            cinzel("SHUBHO BIBAHO", ex + ew / 2, ey + eh - 90, 28, "#F3DC9A", anchor="middle", tracking=10)]
    return canvas(W, H, "".join(body))


# ------------------------------------------------------------------ shopping bag & gift box
def shopping_bag():
    W, H = 1600, 1500
    bx, by, bw, bh = 380, 420, 700, 820
    gus, drop = 130, 30
    body = [f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>']
    # rear handle (behind the bag)
    body.append(f'<path d="M{bx+bw-120+gus*0.6} {by-drop*0.6} C{bx+bw-120+gus*0.6} {by-230} {bx+200+gus*0.6} {by-230} {bx+200+gus*0.6} {by-drop*0.6}" fill="none" stroke="#B98A2C" stroke-width="12" stroke-linecap="round" opacity=".75"/>')
    # gusset
    body.append(f'<path d="M{bx+bw} {by} L{bx+bw+gus} {by-drop} L{bx+bw+gus} {by+bh-drop} L{bx+bw} {by+bh}Z" fill="#2B0307"/>')
    body.append(f'<path d="M{bx+bw} {by} L{bx+bw+gus} {by-drop} L{bx+bw+gus} {by+bh-drop} L{bx+bw} {by+bh}Z" fill="url(#pbag)" opacity=".25"/>')
    # front handle
    body.append(f'<path d="M{bx+190} {by+12} C{bx+190} {by-270} {bx+bw-190} {by-270} {bx+bw-190} {by+12}" fill="none" stroke="url(#foil)" stroke-width="16" stroke-linecap="round"/>')
    # front face
    body.append(f'<g filter="url(#sh)"><rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="url(#velvet)"/></g>')
    body.append(f'<rect x="{bx}" y="{by}" width="{bw}" height="{bh}" fill="url(#pbag)" opacity=".5"/>')
    body.append(f'<rect x="{bx+28}" y="{by+28}" width="{bw-56}" height="{bh-56}" fill="none" stroke="url(#foil)" stroke-width="2.4"/>')
    body.append(nest(marks.emblem_svg_reverse(), bx + 80, by + 100, bw - 160, bw - 160))
    body.append(divider(dict(ring="#C8922A", mono=False), bx + bw / 2, by + bh - 128, 150))
    body.append(cinzel("PARINEETA", bx + bw / 2, by + bh - 66, 28, "#C8922A", anchor="middle", tracking=14))
    for x in (bx + 190, bx + bw - 190):
        body.append(circle(x, by + 12, 9, "#1B0205"))
    pat = pattern_fill("#4D050C", "#7C1522", "#7C1522", "pbag", 120)
    return canvas(W, H, "".join(body), extra_defs=pat)


def gift_box():
    W, H = 1600, 1400
    s = 900
    x, y = (W - s) / 2, (H - s) / 2
    pat = pattern_fill("#4D050C", "#7C1522", "#7C1522", "pbox", 120)
    body = [f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>',
            f'<g filter="url(#sh)"><rect x="{x}" y="{y}" width="{s}" height="{s}" rx="14" fill="url(#velvet)"/></g>',
            f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="14" fill="url(#pbox)" opacity=".55"/>',
            f'<rect x="{x+34}" y="{y+34}" width="{s-68}" height="{s-68}" rx="8" fill="none" stroke="url(#foil)" stroke-width="3"/>',
            f'<rect x="{x+52}" y="{y+52}" width="{s-104}" height="{s-104}" rx="6" fill="none" stroke="url(#foil)" stroke-width="1.4" opacity=".7"/>',
            # ivory ribbon cross
            f'<rect x="{x+s/2-38}" y="{y}" width="76" height="{s}" fill="{C["ivory"]}" opacity=".96"/>',
            f'<rect x="{x}" y="{y+s/2-38}" width="{s}" height="76" fill="{C["ivory"]}" opacity=".96"/>',
            f'<rect x="{x+s/2-38}" y="{y}" width="76" height="{s}" fill="none" stroke="#C8922A" stroke-width="2"/>',
            f'<rect x="{x}" y="{y+s/2-38}" width="{s}" height="76" fill="none" stroke="#C8922A" stroke-width="2"/>',
            f'<g filter="url(#sh2)">{nest(marks.seal_svg("full"), x+s/2-190, y+s/2-190, 380, 380)}</g>']
    return canvas(W, H, "".join(body), extra_defs=pat)


# ------------------------------------------------------------------ invitation
def invitation():
    W, H = 1600, 2000
    cw, ch = 1000, 1500
    cx, cy = (W - cw) / 2, (H - ch) / 2
    body = [f'<rect width="{W}" height="{H}" fill="#E9DFC8"/>',
            f'<g filter="url(#sh)"><rect x="{cx}" y="{cy}" width="{cw}" height="{ch}" rx="10" fill="{C["ivory"]}"/></g>',
            f'<rect x="{cx+30}" y="{cy+30}" width="{cw-60}" height="{ch-60}" fill="none" stroke="#C8922A" stroke-width="3"/>',
            f'<rect x="{cx+46}" y="{cy+46}" width="{cw-92}" height="{ch-92}" fill="none" stroke="#C8922A" stroke-width="1.2"/>']
    mx = cx + cw / 2
    S = style("full")
    body.append(mukut(S, mx, cy + 300, 1.6))
    body.append(bn("শুভ বিবাহ", mx, cy + 500, 150, C["crimson"]))
    body.append(divider(dict(ring="#B98A2C", mono=False), mx, cy + 570, 190))
    body.append(bn("কনের নাম", mx, cy + 690, 74, C["crimson"], tag=True))
    body.append(bn("ও", mx, cy + 780, 50, "#8A5A0B", tag=True))
    body.append(bn("বরের নাম", mx, cy + 870, 74, C["crimson"], tag=True))
    body.append(bn("আপনার শুভ উপস্থিতি একান্ত কাম্য", mx, cy + 1010, 42, "#8A5A0B", tag=True, tracking=1))
    body.append(bn("তারিখ  ·  সময়  ·  স্থান", mx, cy + 1090, 40, C["crimson"], tag=True, tracking=1))
    body.append(gatchhara(style("full"), mx, cy + 1290, 1.05))
    return canvas(W, H, "".join(body))


# ------------------------------------------------------------------ signage fascia
def signage():
    W, H = 2400, 900
    fx, fy, fw, fh = 150, 250, 2100, 400
    pat = pattern_fill("#4D050C", "#7C1522", "#7C1522", "psign", 120)
    body = [f'<rect width="{W}" height="{H}" fill="#D8CDB6"/>',
            f'<rect x="0" y="{fy+fh+70}" width="{W}" height="{H-fy-fh-70}" fill="#BFB398"/>',
            f'<g filter="url(#sh)"><rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="8" fill="url(#velvet)"/></g>',
            f'<rect x="{fx}" y="{fy}" width="{fw}" height="{fh}" rx="8" fill="url(#psign)" opacity=".5"/>',
            f'<rect x="{fx+22}" y="{fy+22}" width="{fw-44}" height="{fh-44}" rx="4" fill="none" stroke="url(#foil)" stroke-width="3"/>',
            nest(marks.horizontal_svg("reverse"), fx + fw / 2 - 640, fy + 40, 1280, 320)]
    return canvas(W, H, "".join(body), extra_defs=pat)


# ------------------------------------------------------------------ social
def avatar(size=1080):
    body = (f'<rect width="{size}" height="{size}" fill="url(#velvet)"/>'
            f'{nest(marks.emblem_svg_reverse(), size*0.06, size*0.06, size*0.88, size*0.88)}')
    return canvas(size, size, body)


def fb_cover(W=1640, H=624, logo_h_ratio=0.62):
    pat = pattern_fill("#4D050C", "#7C1522", "#7C1522", "pcov", 120)
    lh = H * logo_h_ratio
    lw = min(lh * 2.74, W * 0.82)
    lh = lw / 2.74
    body = [f'<rect width="{W}" height="{H}" fill="url(#velvet)"/>',
            f'<rect width="{W}" height="{H}" fill="url(#pcov)" opacity=".6"/>',
            f'<rect x="24" y="24" width="{W-48}" height="{H-48}" fill="none" stroke="url(#foil)" stroke-width="2.4"/>',
            nest(marks.horizontal_svg("reverse"), W / 2 - lw / 2, H / 2 - lh / 2, lw, lh)]
    return canvas(W, H, "".join(body), extra_defs=pat)


def post_template(W=1080, H=1350):
    pat = pattern_fill("#4D050C", "#7C1522", "#7C1522", "ppost", 120)
    body = [f'<rect width="{W}" height="{H}" fill="url(#velvet)"/>',
            f'<rect width="{W}" height="{H}" fill="url(#ppost)" opacity=".55"/>',
            f'<rect x="36" y="36" width="{W-72}" height="{H-72}" fill="none" stroke="url(#foil)" stroke-width="3"/>',
            f'<rect x="54" y="54" width="{W-108}" height="{H-108}" fill="none" stroke="url(#foil)" stroke-width="1.2" opacity=".7"/>',
            nest(marks.monogram_svg("reverse"), W / 2 - 150, 120, 300, 300),
            bn("এ যেন এক বিয়ের মরশুম", W / 2, 560, 60, "#F3DC9A", tag=True, tracking=2),
            divider(dict(ring="#C8922A", mono=False), W / 2, 620, 170),
            bn("শুভ বিবাহের", W / 2, 800, 120, "url(#foil)"),
            bn("মরশুম শুরু", W / 2, 940, 120, "url(#foil)"),
            cinzel("A SEASON OF WEDDINGS", W / 2, 1060, 30, "#F3DC9A", anchor="middle", tracking=10),
            nest(marks.horizontal_svg("reverse"), W / 2 - 250, H - 250, 500, 157)]
    return canvas(W, H, "".join(body), extra_defs=pat)
