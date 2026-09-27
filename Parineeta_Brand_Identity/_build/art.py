"""Parineeta brand art library.

Every graphic is generated as pure vector geometry. All text is outlined from real fonts
through HarfBuzz, so no exported file depends on an installed font.
"""
import math
from textpath import text_path
from emblem_image import EMBLEM_DATA_URI

# ---------------------------------------------------------------- palette
C = dict(
    crimson="#4D050C",      # Rajwadi Crimson
    crimson_hi="#6E0B16",
    sindoor="#C01E2E",      # Alta / Sindoor Red
    gold="#C8922A",         # Antique Zari Gold
    gold_deep="#8A5A0B",
    gold_lite="#F3DC9A",    # Champagne Gold
    marigold="#F2B632",     # Haldi / Marigold (sun-disc)
    ivory="#FAF5E8",        # Sholapith Ivory
)

BN_FONT = ("NotoSerifBengali[wdth,wght].ttf", {"wght": 620})
BN_TAG = ("NotoSerifBengali[wdth,wght].ttf", {"wght": 560})
LAT_FONT = ("Cinzel[wght].ttf", {"wght": 600})

WORD = "পরিণীতা"
TAGLINE = "এ যেন এক বিয়ের মরশুম"


def f(v):
    return ("%.2f" % v).rstrip("0").rstrip(".")


# ---------------------------------------------------------------- defs
def defs(uid=""):
    """Gradients used by full-colour artwork. uid keeps ids unique when SVGs are inlined together."""
    u = uid
    return f"""<defs>
<linearGradient id="foil{u}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#8A5A0B"/><stop offset=".22" stop-color="#D9A93A"/>
<stop offset=".45" stop-color="#F6E2A0"/><stop offset=".68" stop-color="#C8922A"/>
<stop offset="1" stop-color="#7C4E08"/></linearGradient>
<radialGradient id="sun{u}" cx=".44" cy=".38" r=".75">
<stop offset="0" stop-color="#FCE38A"/><stop offset=".45" stop-color="#F2B632"/>
<stop offset=".8" stop-color="#D9962A"/><stop offset="1" stop-color="#B87A14"/></radialGradient>
<radialGradient id="velvet{u}" cx=".5" cy=".45" r=".75">
<stop offset="0" stop-color="#7A0F1B"/><stop offset=".6" stop-color="#4D050C"/>
<stop offset="1" stop-color="#2B0307"/></radialGradient>
<linearGradient id="silk{u}" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#A3111F"/><stop offset=".5" stop-color="#D42636"/>
<stop offset="1" stop-color="#8B0C18"/></linearGradient>
</defs>"""


# ---------------------------------------------------------------- style sets
def style(mode, uid="", mono="#4D050C"):
    """Colour roles for each rendering mode.

    full     : full colour, for light backgrounds
    reverse  : full colour, for crimson / dark backgrounds
    mono     : one flat colour (black / white / gold / crimson), for stamps, foil, fax, watermarks
    """
    u = uid
    if mode == "full":
        return dict(petal_fill=C["crimson"], petal_line=f"url(#foil{u})", inner_fill=f"url(#foil{u})",
                    bead=f"url(#foil{u})", ring=f"url(#foil{u})", disc=f"url(#sun{u})",
                    disc_line=f"url(#foil{u})", ink=C["crimson"], crown=C["crimson"], crown_line=C["gold_lite"],
                    silk_a=f"url(#silk{u})", silk_b=C["ivory"], silk_line=C["sindoor"], knot=f"url(#foil{u})",
                    leaf=C["crimson"], leaf_vein=C["gold_lite"], mono=False)
    if mode == "reverse":
        return dict(petal_fill="none", petal_line=f"url(#foil{u})", inner_fill=f"url(#foil{u})",
                    bead=f"url(#foil{u})", ring=f"url(#foil{u})", disc=f"url(#sun{u})",
                    disc_line=f"url(#foil{u})", ink=C["crimson"], crown=C["crimson"], crown_line=C["gold_lite"],
                    silk_a=f"url(#silk{u})", silk_b=C["ivory"], silk_line=C["sindoor"], knot=f"url(#foil{u})",
                    leaf=C["crimson"], leaf_vein=C["gold_lite"], mono=False)
    m = mono
    return dict(petal_fill="none", petal_line=m, inner_fill=m, bead=m, ring=m, disc="none", disc_line=m,
                ink=m, crown=m, crown_line="none", silk_a=m, silk_b="none", silk_line=m, knot=m,
                leaf=m, leaf_vein="none", mono=True)


# ---------------------------------------------------------------- primitives
def petal(length, width, kink=0.0):
    """Pointed ogee lotus petal, base at origin, tip at (0,-length)."""
    w, L = width / 2, length
    return (f"M0 0 C{f(w*.95)} {f(-L*.18)} {f(w*1.0)} {f(-L*.62)} {f(kink)} {f(-L)} "
            f"C{f(-w*1.0)} {f(-L*.62)} {f(-w*.95)} {f(-L*.18)} 0 0Z")


def circle(cx, cy, r, fill="none", stroke="none", sw=0):
    s = f' stroke="{stroke}" stroke-width="{f(sw)}"' if stroke != "none" else ""
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{fill}"{s}/>'


def polar(r, deg):
    a = math.radians(deg - 90)
    return r * math.cos(a), r * math.sin(a)


# ---------------------------------------------------------------- mandala ring (alpana / lotus rosette)
def arch(length, width):
    """Ogee temple-arch petal with a flat base at y=0 (base is tucked under the ring), tip at (0,-length)."""
    w, L = width / 2, length
    return (f"M{f(-w)} 4 C{f(-w)} {f(-L*.38)} {f(-w*.32)} {f(-L*.62)} 0 {f(-L)} "
            f"C{f(w*.32)} {f(-L*.62)} {f(w)} {f(-L*.38)} {f(w)} 4Z")


def teardrop(length, width):
    w, L = width / 2, length
    return (f"M0 0 C{f(w*1.5)} {f(-L*.25)} {f(w*.9)} {f(-L*.8)} 0 {f(-L)} "
            f"C{f(-w*.9)} {f(-L*.8)} {f(-w*1.5)} {f(-L*.25)} 0 0Z")


def mandala(S, cx=500, cy=500):
    out = [f'<g transform="translate({cx} {cy})">']
    R_in, R_out = 350, 396
    # 16 arch petals radiating from the band: 8 large alternating with 8 small
    for k in range(16):
        big = k % 2 == 0
        L, W = (100, 82) if big else (62, 54)
        o = [f'<g transform="rotate({f(k*22.5)}) translate(0 {-R_out+2})">']
        o.append(f'<path d="{arch(L, W)}" fill="{S["petal_fill"]}" stroke="{S["petal_line"]}" stroke-width="3.4" stroke-linejoin="round"/>')
        if big:
            o.append(f'<path d="{arch(L*.66, W*.56)}" fill="{S["inner_fill"]}" transform="translate(0 -6)"/>')
            o.append(circle(0, -L*.36, 4.4, S["petal_fill"] if not S["mono"] else "none", S["petal_line"] if S["mono"] else "none", 2 if S["mono"] else 0))
        else:
            o.append(f'<path d="{arch(L*.6, W*.5)}" fill="none" stroke="{S["petal_line"]}" stroke-width="2.4" transform="translate(0 -6)"/>')
            o.append(circle(0, -L*.3, 3, S["bead"]))
        o.append('</g>')
        out.append("".join(o))
    # ornamented band
    band = (f'M{R_out} 0 A{R_out} {R_out} 0 1 0 {-R_out} 0 A{R_out} {R_out} 0 1 0 {R_out} 0Z '
            f'M{R_in} 0 A{R_in} {R_in} 0 1 1 {-R_in} 0 A{R_in} {R_in} 0 1 1 {R_in} 0Z')
    out.append(f'<path d="{band}" fill="{S["petal_fill"]}" fill-rule="evenodd"/>')
    out.append(circle(0, 0, R_out, "none", S["ring"], 3.4))
    out.append(circle(0, 0, R_in, "none", S["ring"], 3.4))
    out.append(circle(0, 0, R_out - 9, "none", S["ring"], 1.3))
    out.append(circle(0, 0, R_in + 9, "none", S["ring"], 1.3))
    mid = (R_in + R_out) / 2
    for k in range(32):
        ang = k * 360 / 32
        if k % 2 == 0:
            out.append(f'<path d="{teardrop(24, 11)}" fill="{S["bead"]}" transform="rotate({f(ang)}) translate(0 {-(mid-12)})"/>')
        else:
            x, y = polar(mid, ang)
            out.append(circle(x, y, 3.2, S["bead"]))
    out.append('</g>')
    return "".join(out)


# ---------------------------------------------------------------- shola mukut (lotus crown)
def mukut(S, cx=0, cy=0, scale=1.0):
    """Bridal crown built from lotus-petal peaks. Base line at y=0, apex ~ y=-118."""
    peaks = [(0, 112, 50), (-52, 88, 42), (52, 88, 42), (-100, 62, 36), (100, 62, 36)]
    g = [f'<g transform="translate({f(cx)} {f(cy)}) scale({f(scale)})">']
    for x, L, W in peaks:
        g.append(f'<g transform="translate({x} -18)"><path d="{petal(L, W)}" fill="{S["crown"]}"/>')
        if not S["mono"]:
            g.append(f'<path d="{petal(L*.62, W*.5)}" fill="none" stroke="{S["crown_line"]}" stroke-width="2.2" transform="translate(0 -6)"/>')
        g.append(circle(0, -L - 7, 5.2, S["crown"]))
        g.append('</g>')
    # band
    g.append(f'<rect x="-128" y="-20" width="256" height="20" rx="10" fill="{S["crown"]}"/>')
    if not S["mono"]:
        for x in range(-108, 109, 27):
            g.append(circle(x, -10, 3.6, S["crown_line"]))
    else:
        for x in range(-108, 109, 27):
            g.append(circle(x, -10, 3.4, "#FFFFFF" if False else "none"))
    g.append('</g>')
    return "".join(g)


# ---------------------------------------------------------------- paan leaf (betel leaf, shubho drishti)
def paan_leaf(S, cx=0, cy=0, scale=1.0, rot=0):
    """Heart-shaped betel leaf with a notched top and a drawn-out tip."""
    body = ("M0 -50 C-12 -84 -70 -80 -66 -24 C-62 20 -26 48 0 96 "
            "C26 48 62 20 66 -24 C70 -80 12 -84 0 -50Z")
    g = [f'<g transform="translate({f(cx)} {f(cy)}) rotate({f(rot)}) scale({f(scale)})">',
         f'<path d="{body}" fill="{S["leaf"]}"/>']
    if not S["mono"]:
        vein = S["leaf_vein"]
        g.append(f'<path d="M0 -40 L0 84" stroke="{vein}" stroke-width="3.2" stroke-linecap="round" fill="none"/>')
        for i, y in enumerate((-34, -8, 18, 44)):
            dx = 44 - i * 9
            g.append(f'<path d="M0 {y+10} Q{dx*.55} {y+2} {dx} {y-16} M0 {y+10} Q{-dx*.55} {y+2} {-dx} {y-16}" '
                     f'stroke="{vein}" stroke-width="2.2" stroke-linecap="round" fill="none"/>')
    g.append('</g>')
    return "".join(g)


# ---------------------------------------------------------------- gaṭchhara: the tied wedding cloth
def gatchhara(S, cx=0, cy=0, scale=1.0):
    """Ornate knotted wedding cloth: bride's sindoor-red and groom's ivory bound with gold.
    Local origin = knot centre. Enhanced with elaborate draping, beads, and ornamentation."""
    g = [f'<g transform="translate({f(cx)} {f(cy)}) scale({f(scale)})">']
    a, b, ln = S["silk_a"], S["silk_b"], S["silk_line"]
    sw = 3.8
    # Elaborate gathered cloth that flows from above the knot down into tails
    # Left cloth (bride's sindoor)
    left_upper = "M-200 -50 C-160 -60 -100 -48 -35 -22 L-30 -8"
    left_lower = "M-35 8 C-100 -8 -158 8 -200 40 C-210 20 -210 -10 -200 -50Z"
    left_tail = "M-30 40 C-52 68 -74 110 -98 158 L-48 172 C-28 126 -12 82 4 40Z"

    # Right cloth (groom's ivory)
    right_upper = "M200 -50 C160 -60 100 -48 35 -22 L30 -8"
    right_lower = "M35 8 C100 -8 158 8 200 40 C210 20 210 -10 200 -50Z"
    right_tail = "M30 40 C52 68 74 110 98 158 L48 172 C28 126 12 82 -4 40Z"

    uid = "gk%d_%d" % (round(cx), round(cy))
    lbody = "M-200 -50 C-160 -60 -100 -48 -35 -22 L-35 8 C-100 -8 -158 8 -200 40 C-210 20 -210 -10 -200 -50Z"
    rbody = "M200 -50 C160 -60 100 -48 35 -22 L35 8 C100 -8 158 8 200 40 C210 20 210 -10 200 -50Z"
    edge = 'none' if S["mono"] else "#F3DC9A"
    ew = 0 if S["mono"] else 1.8
    if S["mono"]:
        for body in (lbody, rbody):
            g.append(f'<path d="{body}" fill="none" stroke="{ln}" stroke-width="{sw}" stroke-linejoin="round"/>')
        g.append(f'<path d="{left_tail}" fill="{a}"/>')
        g.append(f'<path d="{right_tail}" fill="none" stroke="{ln}" stroke-width="{sw}" stroke-linejoin="round"/>')
    else:
        g.append(f'<clipPath id="{uid}l"><path d="{lbody}"/></clipPath><clipPath id="{uid}r"><path d="{rbody}"/></clipPath>')
        g.append(f'<path d="{lbody}" fill="{a}" stroke="{edge}" stroke-width="{ew}" stroke-linejoin="round"/>')
        g.append(f'<path d="{rbody}" fill="{b}" stroke="{edge}" stroke-width="{ew}" stroke-linejoin="round"/>')
        g.append(f'<path d="{left_tail}" fill="{a}" stroke="{edge}" stroke-width="{ew}" stroke-linejoin="round"/>')
        g.append(f'<path d="{right_tail}" fill="{b}" stroke="{edge}" stroke-width="{ew}" stroke-linejoin="round"/>')
        chk = "#F3DC9A"
        rc = "#C01E2E"
        g.append(f'<g clip-path="url(#{uid}l)">')
        for i in range(5):
            x = -180 + i * 34
            g.append(f'<path d="M{x} -60 Q{x+12} 0 {x+8} 50" stroke="{chk}" stroke-width="1.5" fill="none" opacity=".7"/>')
        g.append('</g>')
        g.append(f'<g clip-path="url(#{uid}r)">')
        for i in range(5):
            x = 180 - i * 34
            g.append(f'<path d="M{x} -60 Q{x-12} 0 {x-8} 50" stroke="{rc}" stroke-width="1.5" fill="none" opacity=".6"/>')
        g.append('</g>')

    # Central knot with elaborate center ornament
    kn = S["knot"]
    knot_outer = "M-32 -28 C-12 -40 12 -40 32 -28 C46 -8 46 26 32 44 C12 56 -12 56 -32 44 C-46 26 -46 -8 -32 -28Z"
    knot_inner = "M-22 -18 C-8 -26 8 -26 22 -18 C32 -4 32 18 22 32 C8 40 -8 40 -22 32 C-32 18 -32 -4 -22 -18Z"

    if S["mono"]:
        g.append(f'<path d="{knot_outer}" fill="none" stroke="{kn}" stroke-width="{sw}" stroke-linejoin="round"/>')
        g.append(f'<path d="M-14 -32 C-8 -8 -8 28 -14 48 M14 -32 C8 -8 8 28 14 48" stroke="{kn}" stroke-width="2.8" fill="none" stroke-linecap="round"/>')
    else:
        g.append(f'<path d="{knot_outer}" fill="{kn}"/>')
        g.append(f'<path d="{knot_inner}" fill="none" stroke="#7C4E08" stroke-width="2.2"/>')
        g.append(f'<path d="M-14 -32 C-8 -8 -8 28 -14 48 M14 -32 C8 -8 8 28 14 48" stroke="#7C4E08" stroke-width="2.8" fill="none" stroke-linecap="round"/>')
        # Gold ornamental accent
        g.append(f'<circle cx="0" cy="0" r="8" fill="none" stroke="#F6E2A0" stroke-width="1.8"/>')
        g.append(f'<circle cx="0" cy="0" r="5" fill="url(#foil)" opacity=".9"/>')

    # Bead clusters along tails (left)
    bead_positions_l = [(-90, 140), (-72, 152), (-54, 160), (-36, 164)]
    for x, y in bead_positions_l:
        g.append(circle(x, y, 6, a if S["mono"] else "#D4AF37"))
        if not S["mono"]:
            g.append(circle(x, y, 4, a))

    # Bead clusters along tails (right)
    bead_positions_r = [(90, 140), (72, 152), (54, 160), (36, 164)]
    for x, y in bead_positions_r:
        g.append(circle(x, y, 6, ln if S["mono"] else "#D4AF37"))
        if not S["mono"]:
            g.append(circle(x, y, 4, b))

    # Bottom jewel/ornament at tail gather
    if not S["mono"]:
        g.append(circle(0, 175, 8, "#F6E2A0"))
        g.append(circle(0, 175, 5, "url(#foil)"))

    g.append('</g>')
    return "".join(g)


# ---------------------------------------------------------------- text helpers
def bn_word(S, cx, baseline, size, fill=None):
    d, w = text_path(WORD, BN_FONT[0], size, cx, baseline, BN_FONT[1], anchor="middle")
    return f'<path d="{d}" fill="{fill or S["ink"]}"/>', w


def bn_tag(S, cx, baseline, size, fill=None, tracking=1.5):
    d, w = text_path(TAGLINE, BN_TAG[0], size, cx, baseline, BN_TAG[1], anchor="middle", tracking=tracking)
    return f'<path d="{d}" fill="{fill or S["ink"]}"/>', w


def latin(text, cx, baseline, size, fill, tracking, anchor="middle", weight=600):
    d, w = text_path(text, LAT_FONT[0], size, cx, baseline, {"wght": weight}, anchor=anchor, tracking=tracking)
    return f'<path d="{d}" fill="{fill}"/>', w


def divider(S, cx, cy, half=110):
    """Small lotus-and-line ornament used under wordmarks."""
    c = S["ring"] if S["mono"] else "#8A5A0B"
    return (f'<g transform="translate({f(cx)} {f(cy)})">'
            f'<path d="M{-half} 0 H-16 M16 0 H{half}" stroke="{c}" stroke-width="1.8"/>'
            f'<path d="{petal(15,9)}" fill="{c}" transform="translate(0 7)"/>'
            f'<path d="{petal(11,7)}" fill="{c}" transform="translate(-11 7) rotate(-52)"/>'
            f'<path d="{petal(11,7)}" fill="{c}" transform="translate(11 7) rotate(52)"/>'
            f'{circle(-half-6,0,2.4,c)}{circle(half+6,0,2.4,c)}</g>')


# ---------------------------------------------------------------- primary emblem
def emblem_body(S, uid="", with_text=True):
    parts = [mandala(S)]
    # sun disc
    if S["mono"]:
        parts.append(circle(500, 500, 336, "none", S["disc_line"], 5))
        parts.append(circle(500, 500, 322, "none", S["disc_line"], 1.8))
    else:
        parts.append(circle(500, 500, 340, S["disc"], S["disc_line"], 5))
        parts.append(circle(500, 500, 322, "none", "#B87A14", 1.6))
    parts.append(mukut(S, 500, 330, 0.92))
    w, wd = bn_word(S, 500, 566, 168)
    parts.append(w)
    t, td = bn_tag(S, 500, 638, 38)
    parts.append(t)
    parts.append(divider(S, 500, 652, 84) if False else "")
    parts.append(gatchhara(S, 500, 712, 0.68))
    return "".join(parts)


def emblem_svg(mode, mono="#4D050C", bg=None, size=1000, pad=0):
    """full/reverse: client master artwork with the gatchhara set into its lower disc.
    mono: original all-vector emblem, so one-colour and foil files stay true vector."""
    S = style(mode, "", mono)
    vb = f"{-pad} {-pad} {1000+2*pad} {1000+2*pad}"
    bgrect = f'<rect x="{-pad}" y="{-pad}" width="{1000+2*pad}" height="{1000+2*pad}" fill="{bg}"/>' if bg else ""
    if S["mono"]:
        body = emblem_body(S)
    else:
        body = (f'<image x="0" y="0" width="1000" height="1000" href="{EMBLEM_DATA_URI}"/>'
                f'{gatchhara(S, 500, 735, 0.55)}')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{size}" height="{size}">'
            f'{defs()}{bgrect}{body}</svg>')


if __name__ == "__main__":
    import sys
    open("emblem_full.svg", "w", encoding="utf-8").write(emblem_svg("full", bg=C["ivory"]))
    open("emblem_reverse.svg", "w", encoding="utf-8").write(emblem_svg("reverse", bg=C["crimson"]))
    open("emblem_mono.svg", "w", encoding="utf-8").write(emblem_svg("mono", mono="#4D050C", bg=C["ivory"]))
