"""Generate the Parineeta brand guidelines book (HTML -> PDF)."""
import os
import subprocess
import tempfile
import time
import shutil

import build_all as B
from art import C

ROOT = B.ROOT
OUT = os.path.join(ROOT, "00_Brand_Guidelines")
os.makedirs(OUT, exist_ok=True)

FONT_URL = "../_build/fonts/"

CSS = """
@font-face{font-family:'NSB';src:url('@@F@@NotoSerifBengali[wdth,wght].ttf');font-weight:100 900;}
@font-face{font-family:'Cinzel';src:url('@@F@@Cinzel[wght].ttf');font-weight:400 900;}
@font-face{font-family:'Corm';src:url('@@F@@CormorantGaramond[wght].ttf');font-weight:300 700;}
@font-face{font-family:'Corm';font-style:italic;src:url('@@F@@CormorantGaramond-Italic[wght].ttf');font-weight:300 700;}
@font-face{font-family:'Hind';src:url('@@F@@HindSiliguri-Regular.ttf');font-weight:400;}
@font-face{font-family:'Hind';src:url('@@F@@HindSiliguri-SemiBold.ttf');font-weight:600;}
@page{size:1123px 794px;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:'Hind','NSB',sans-serif;color:#2B0307;font-size:14px;line-height:1.55}
.page{width:1123px;height:794px;position:relative;overflow:hidden;background:#FAF5E8;page-break-after:always;break-after:page}
.page.dark{background:#4D050C;color:#F3DC9A}
.pad{position:absolute;inset:56px 64px 64px 64px}
.eyebrow{font-family:'Cinzel',serif;font-weight:600;letter-spacing:.32em;font-size:11px;color:#8A5A0B;text-transform:uppercase}
.dark .eyebrow{color:#C8922A}
h1{font-family:'NSB',serif;font-weight:600;font-size:44px;line-height:1.15;margin:10px 0 14px;color:#4D050C}
.dark h1{color:#F3DC9A}
h2{font-family:'Cinzel',serif;font-weight:600;font-size:22px;letter-spacing:.06em;margin:0 0 8px;color:#4D050C}
h3{font-family:'Cinzel',serif;font-weight:600;font-size:12px;letter-spacing:.2em;margin:0 0 6px;color:#8A5A0B;text-transform:uppercase}
p{margin:0 0 10px}
.lead{font-family:'Corm','NSB',serif;font-size:21px;line-height:1.45;color:#4D050C;font-weight:500}
.dark .lead{color:#F3DC9A}
.muted{color:#6b5a3e;font-size:12.5px}
.foot{position:absolute;left:64px;right:64px;bottom:26px;display:flex;justify-content:space-between;font-family:'Cinzel',serif;font-size:9.5px;letter-spacing:.24em;color:#8A5A0B}
.dark .foot{color:#C8922A}
.rule{height:2px;width:64px;background:linear-gradient(90deg,#8A5A0B,#F6E2A0,#C8922A);margin:0 0 14px}
.grid{display:grid;gap:18px}
.card{background:#fff;border:1px solid #E6D9B8;border-radius:6px;padding:14px}
.tile{flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.tile .lab{position:absolute;left:10px;bottom:8px;font-size:11px;font-family:'Cinzel',serif;letter-spacing:.14em}
.ivory{background:#FAF5E8}.crim{background:#4D050C}.gold{background:#C8922A}.mari{background:#F2B632}.white{background:#fff}.black{background:#111}
table.tight td{padding:4px 8px}
table{border-collapse:collapse;width:100%}
td,th{padding:7px 10px;border-bottom:1px solid #E6D9B8;text-align:left;font-size:12.5px;vertical-align:top}
th{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;color:#8A5A0B;text-transform:uppercase}
.num{position:absolute;width:26px;height:26px;border-radius:50%;background:#4D050C;color:#F3DC9A;font-family:'Cinzel',serif;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid #F3DC9A;transform:translate(-50%,-50%)}
.ok{color:#1c6b3a;font-weight:600}.no{color:#a3111f;font-weight:600}
.x{position:absolute;font-family:'Cinzel',serif;font-size:11px;color:#C01E2E;font-weight:700}
img{display:block}
"""


def img(path, style=""):
    return f'<img src="../{path}" style="{style}">'


def page(inner, n, title, dark=False):
    return (f'<section class="page{" dark" if dark else ""}">{inner}'
            f'<div class="foot"><span>PARINEETA · BRAND IDENTITY GUIDELINES</span><span>{title} &nbsp;·&nbsp; {n:02d}</span></div></section>')


pages = []
N = [0]


def add(inner, title, dark=False):
    N[0] += 1
    pages.append(page(inner, N[0], title, dark))


# ---------------------------------------------------------------- 1 cover
pages.append(f'''<section class="page dark" style="background:radial-gradient(ellipse at 50% 42%,#7A0F1B 0%,#4D050C 55%,#2B0307 100%)">
<div style="position:absolute;inset:0;background:url(../07_Pattern/png/alpana_tone_on_tone_crimson.png);background-size:360px;opacity:.5"></div>
<div style="position:absolute;inset:28px;border:2px solid #C8922A"></div><div style="position:absolute;inset:40px;border:1px solid #C8922A;opacity:.6"></div>
<div style="position:absolute;left:0;right:0;top:64px;display:flex;flex-direction:column;align-items:center">
{img("01_Primary_Emblem/png/parineeta_emblem_reverse_1000px.png","width:470px")}
<div class="eyebrow" style="margin-top:22px;font-size:13px">Brand Identity Guidelines</div>
<div style="font-family:'Corm',serif;font-style:italic;font-size:24px;color:#F3DC9A;margin-top:8px">A season of weddings</div>
<div style="font-family:'Cinzel',serif;letter-spacing:.3em;font-size:10.5px;color:#C8922A;margin-top:26px">VERSION 1.0 &nbsp;·&nbsp; SEPTEMBER 2026</div></div></section>''')
N[0] += 1

# ---------------------------------------------------------------- 2 contents
rows = [("01", "Brand essence", "03"), ("02", "The mark: anatomy & meaning", "04"), ("03", "Logo suite", "05"),
        ("04", "Clear space & minimum size", "06"), ("05", "Colour", "07"), ("06", "Backgrounds", "08"),
        ("07", "Typography", "09"), ("08", "Graphic language", "10"), ("09", "Logo misuse", "11"),
        ("10", "Stationery", "12"), ("11", "Packaging & signage", "13"), ("12", "Digital & social", "14"),
        ("13", "Wedding invitation", "15"), ("14", "File guide", "16")]
lis = "".join(f'<tr><td style="width:60px;color:#C8922A;font-family:Cinzel;font-weight:700">{a}</td><td style="font-size:16px">{b}</td><td style="text-align:right;color:#8A5A0B">{c}</td></tr>' for a, b, c in rows)
add(f'''<div class="pad"><div class="eyebrow">Contents</div><h1>What&rsquo;s inside</h1><div class="rule"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:10px"><table>{lis}</table>
<div style="display:flex;align-items:center;justify-content:center">{img("01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png","width:340px")}</div></div></div>''', "CONTENTS")

# ---------------------------------------------------------------- 3 essence
add(f'''<div class="pad"><div class="eyebrow">01 &nbsp;Brand essence</div>
<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:44px;margin-top:6px">
<div><h1>পরিণীতা</h1><div class="rule"></div>
<p class="lead">Parineeta is the bride: the moment a Bengali wedding begins to glow. The identity holds the warmth of haldi, the weight of zari, and the quiet ritual of a knot being tied.</p>
<p style="margin-top:16px">Its tagline, <b style="font-family:NSB">এ যেন এক বিয়ের মরশুম</b> (&ldquo;it&rsquo;s a season of weddings&rdquo;), gives the brand its promise: celebration is not one day, it is a season. Every design decision below serves that feeling: auspicious, rooted, regal, warm.</p>
<div class="grid" style="grid-template-columns:1fr 1fr;margin-top:18px">
<div class="card"><h3>Personality</h3>Auspicious &middot; Warm &middot; Regal &middot; Rooted &middot; Celebratory</div>
<div class="card"><h3>Voice</h3>Speaks like a family elder who is delighted for you: warm, precise, never salesy.</div></div></div>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:6px">
<div class="tile crim" style="height:230px">{img("03_Monogram_and_Seal/png/parineeta_monogram_reverse_600px.png","width:190px")}</div>
<div class="tile ivory" style="height:230px;border:1px solid #E6D9B8">{img("03_Monogram_and_Seal/png/parineeta_seal_fullcolor_600px.png","width:200px")}</div>
<div class="tile" style="height:230px;grid-column:span 2;background:url(../07_Pattern/png/alpana_gold_on_crimson.png);background-size:330px;justify-content:center">
<div style="background:#4D050C;padding:18px 34px;border:2px solid #C8922A;font-family:NSB;font-size:30px;color:#F3DC9A;font-weight:600">এ যেন এক বিয়ের মরশুম</div></div></div></div></div>''', "BRAND ESSENCE")

# ---------------------------------------------------------------- 4 anatomy
def pos(x, y, w=520):
    return f"left:{x*w/1000:.0f}px;top:{y*w/1000:.0f}px"

add(f'''<div class="pad"><div class="eyebrow">02 &nbsp;The mark</div><h1>Anatomy &amp; meaning</h1><div class="rule"></div>
<div style="display:grid;grid-template-columns:520px 1fr;gap:44px">
<div style="position:relative;width:520px;height:520px">{img("01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png","width:520px")}
<div class="num" style="{pos(500,58)}">1</div><div class="num" style="{pos(150,420)}">2</div><div class="num" style="{pos(500,330)}">3</div>
<div class="num" style="{pos(770,560)}">4</div><div class="num" style="{pos(500,760)}">5</div></div>
<div><table>
<tr><td style="width:30px"><b>1</b></td><td><h3>Alpana lotus ring</h3>Rice-paste alpana drawn at every Bengali threshold: sixteen lotus arches welcome prosperity into the home.</td></tr>
<tr><td><b>2</b></td><td><h3>Haldi sun-disc</h3>The marigold-gold of the gaye holud ceremony. Warmth and auspicious beginnings; it is the brand&rsquo;s glow.</td></tr>
<tr><td><b>3</b></td><td><h3>Mukut crown</h3>The bride&rsquo;s shola crown, drawn as five rising lotus petals. Royalty and celebration.</td></tr>
<tr><td><b>4</b></td><td><h3>পরিণীতা wordmark</h3>Set in Noto Serif Bengali with correct conjunct shaping. Carries the name in the client&rsquo;s own script.</td></tr>
<tr><td><b>5</b></td><td><h3>Gatchhara knot</h3>The knotted cloth of bride (sindoor red) and groom (ivory): the union itself, and the brand&rsquo;s most ownable symbol, carried over from the original logo.</td></tr></table>
<div style="display:flex;gap:18px;align-items:center;margin-top:14px"><div class="tile ivory" style="width:120px;height:120px;border:1px solid #E6D9B8">{img("03_Monogram_and_Seal/png/parineeta_monogram_fullcolor_600px.png","width:100px")}</div>
<div class="muted"><b>Monogram:</b> the letter প with a heart-shaped <b>paan leaf</b>, the leaf held over the eyes at <i>shubho drishti</i>, the first auspicious glance of bride and groom.</div></div></div></div></div>''', "THE MARK")

# ---------------------------------------------------------------- 5 logo suite
def suite_tile(path, w, label, cls="ivory", h=200):
    fg = "#F3DC9A" if cls == "crim" else "#8A5A0B"
    return (f'<div class="tile {cls}" style="height:{h}px;{"border:1px solid #E6D9B8;" if cls=="ivory" else ""}">'
            f'{img(path, f"width:{w}px;max-height:{h-52}px;object-fit:contain")}<span class="lab" style="color:{fg}">{label}</span></div>')


add(f'''<div class="pad"><div class="eyebrow">03 &nbsp;Logo suite</div><h1>One family, seven jobs</h1><div class="rule"></div>
<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:14px">
{suite_tile("01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png",125,"PRIMARY EMBLEM",h=185)}
{suite_tile("02_Lockups/png/parineeta_stacked_fullcolor_800px.png",120,"STACKED",h=185)}
{suite_tile("02_Lockups/png/parineeta_horizontal_reverse_1000px.png",230,"HORIZONTAL",cls="crim",h=185)}
{suite_tile("02_Lockups/png/parineeta_wordmark_tagline_fullcolor_800px.png",230,"WORDMARK + TAGLINE",h=185)}
{suite_tile("03_Monogram_and_Seal/png/parineeta_seal_fullcolor_600px.png",125,"SEAL",h=185)}
{suite_tile("03_Monogram_and_Seal/png/parineeta_monogram_fullcolor_600px.png",115,"MONOGRAM",h=185)}
{suite_tile("05_App_Icons_and_Favicons/png/parineeta_app_icon_rounded_512px.png",110,"APP ICON",cls="ivory",h=185)}
{suite_tile("05_App_Icons_and_Favicons/png/favicon-128x128.png",72,"FAVICON",h=185)}
</div>
<table style="margin-top:12px"><tr><th>Use</th><th>For</th></tr>
<tr><td><b>Emblem</b> &middot; <b>Seal</b></td><td>Packaging, signage, seals, invitations, anything with room to show the ring.</td></tr>
<tr><td><b>Stacked</b> &middot; <b>Horizontal</b> &middot; <b>Wordmark</b></td><td>Letterheads, website header, bills, banners, ads: where the ring would be too detailed or space is wide or short.</td></tr>
<tr><td><b>Monogram</b> &middot; <b>App icon</b> &middot; <b>Favicon</b></td><td>Profile pictures, stickers, app tiles, browser tabs. The favicon drops the crown and leaf because they vanish under 48px.</td></tr></table></div>''', "LOGO SUITE")

# ---------------------------------------------------------------- 6 clear space / min size
em = 236
xpad = round(em * 0.125)
hz_w = 430
hz_h = round(hz_w * 700 / 1920)
add(f'''<div class="pad"><div class="eyebrow">04 &nbsp;Protection</div><h1>Clear space &amp; minimum size</h1><div class="rule"></div>
<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:34px">
<div><h3>Clear space</h3><p class="muted">Keep the area around the logo free of type, imagery and edges. <b>Emblem &amp; seal:</b> one-eighth of the logo&rsquo;s width, <b>x</b>. <b>Lockups:</b> half the height of the letter প in the wordmark.</p>
<div style="display:flex;gap:22px;align-items:center;margin-top:12px">
<div style="position:relative;padding:{xpad}px;border:1.5px dashed #C01E2E;background:#fff">{img("01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png",f"width:{em}px")}<span class="x" style="left:{xpad//2-4}px;top:{xpad+em//2-8}px">x</span><span class="x" style="top:{xpad//2-8}px;left:{xpad+em//2}px">x</span></div></div>
<div style="position:relative;display:inline-block;padding:{round(hz_h*0.16)}px;border:1.5px dashed #C01E2E;background:#fff;margin-top:14px">{img("02_Lockups/png/parineeta_horizontal_fullcolor_1000px.png",f"width:{hz_w-90}px")}</div></div>
<div><h3>Minimum size</h3><p class="muted">Below these sizes the fine ornament and the tagline stop reading. Use the next logo down the family instead.</p>
<table class="tight"><tr><th>Logo</th><th>Print</th><th>Screen</th></tr>
<tr><td>Emblem</td><td>30 mm</td><td>160 px</td></tr><tr><td>Seal</td><td>22 mm</td><td>110 px</td></tr>
<tr><td>Stacked</td><td>28 mm</td><td>130 px</td></tr><tr><td>Horizontal</td><td>45 mm</td><td>220 px</td></tr>
<tr><td>Wordmark + tagline</td><td>32 mm</td><td>150 px</td></tr><tr><td>Monogram</td><td>10 mm</td><td>44 px</td></tr>
<tr><td>Favicon</td><td>&ndash;</td><td>16 px</td></tr></table>
<h3 style="margin-top:10px">Shown at minimum screen size</h3>
<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;background:#fff;border:1px solid #E6D9B8;padding:10px;border-radius:6px">
{img("01_Primary_Emblem/png/parineeta_emblem_fullcolor_400px.png","width:160px")}{img("03_Monogram_and_Seal/png/parineeta_seal_fullcolor_600px.png","width:110px")}
{img("02_Lockups/png/parineeta_stacked_fullcolor_800px.png","width:130px")}{img("03_Monogram_and_Seal/png/parineeta_monogram_fullcolor_600px.png","width:44px")}
{img("05_App_Icons_and_Favicons/png/favicon-32x32.png","width:32px")}{img("05_App_Icons_and_Favicons/png/favicon-16x16.png","width:16px")}</div></div></div></div>''', "CLEAR SPACE & SIZE")

# ---------------------------------------------------------------- 7 colour
from build_all import PALETTE, hex_to_rgb, cmyk, contrast


def swatch(name, hx, use, big=False):
    r, g, b = hex_to_rgb(hx)
    c, m, y, k = cmyk(hx)
    light = B.lum(hx) > 0.35
    fg = "#2B0307" if light else "#FAF5E8"
    return (f'<div style="background:{hx};color:{fg};border-radius:6px;padding:12px 14px;height:{92 if big else 100}px;border:1px solid #0001">'
            f'<div style="font-family:Cinzel;font-weight:700;font-size:10.5px;letter-spacing:.14em">{name.upper()}</div>'
            f'<div style="margin-top:6px;font-weight:600;font-size:14px">{hx}</div>'
            f'<div style="font-size:11px;opacity:.9">RGB {r} {g} {b}<br>CMYK {c} {m} {y} {k}</div></div>')


pairs = [("Crimson on Ivory", C["crimson"], C["ivory"]), ("Deep Zari on Ivory", C["gold_deep"], C["ivory"]),
         ("Zari Gold on Ivory", C["gold"], C["ivory"]), ("Champagne on Crimson", C["gold_lite"], C["crimson"]),
         ("Zari Gold on Crimson", C["gold"], C["crimson"]), ("Crimson on Marigold", C["crimson"], C["marigold"])]
prow = ""
for nm, fg_, bg_ in pairs:
    r = B.contrast(fg_, bg_)
    verdict = '<span class="ok">Text &middot; AA</span>' if r >= 4.5 else ('<span style="color:#8A5A0B;font-weight:600">Large text / graphics only</span>' if r >= 3 else '<span class="no">Do not use for text</span>')
    prow += f'<tr><td><span style="display:inline-block;width:46px;height:20px;border-radius:3px;background:{bg_};color:{fg_};font-family:NSB;font-weight:700;text-align:center;line-height:20px;border:1px solid #0002">Aa পা</span> &nbsp;{nm}</td><td>{r:.1f} : 1</td><td>{verdict}</td></tr>'

add(f'''<div class="pad"><div class="eyebrow">05 &nbsp;Colour</div><h1>Crimson, zari &amp; ivory</h1><div class="rule"></div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
{swatch("Rajwadi Crimson", C["crimson"], "", True)}{swatch("Sindoor Red", C["sindoor"], "", True)}{swatch("Antique Zari Gold", C["gold"], "", True)}{swatch("Marigold (Haldi)", C["marigold"], "", True)}
{swatch("Champagne Gold", C["gold_lite"], "")}{swatch("Sholapith Ivory", C["ivory"], "")}{swatch("Deep Zari", C["gold_deep"], "")}
<div style="background:linear-gradient(135deg,#8A5A0B 0%,#D9A93A 22%,#F6E2A0 45%,#C8922A 68%,#7C4E08 100%);border-radius:6px;padding:12px 14px;height:100px;color:#2B0307"><div style="font-family:Cinzel;font-weight:700;font-size:10.5px;letter-spacing:.14em">ZARI FOIL GRADIENT</div><div style="margin-top:6px;font-size:11px">Digital and foil only. Never for body text.</div></div></div>
<div style="display:grid;grid-template-columns:1.05fr 1fr;gap:30px;margin-top:16px">
<div><h3>Proportion</h3><div style="display:flex;height:38px;border-radius:5px;overflow:hidden;border:1px solid #0002">
<div style="flex:40;background:{C["crimson"]}"></div><div style="flex:28;background:{C["ivory"]}"></div><div style="flex:20;background:{C["gold"]}"></div><div style="flex:7;background:{C["marigold"]}"></div><div style="flex:5;background:{C["sindoor"]}"></div></div>
<p class="muted" style="margin-top:8px">Crimson leads, ivory gives it air, gold is the jewellery. Sindoor red is a spark, never a ground. CMYK figures are starting values for a press proof, not spot-colour matches: confirm on a printed swatch before a large run.</p></div>
<div><h3>Contrast (WCAG)</h3><table class="tight">{prow}</table></div></div></div>''', "COLOUR")

# ---------------------------------------------------------------- 8 backgrounds
def bg_tile(cls, path, label, w=150, style=""):
    fg = "#F3DC9A" if cls in ("crim", "black") else "#4D050C"
    return (f'<div class="tile {cls}" style="height:215px;{style}">{img(path, f"width:{w}px;margin-bottom:22px")}'
            f'<span class="lab" style="color:{fg}">{label}</span></div>')


add(f'''<div class="pad"><div class="eyebrow">06 &nbsp;Backgrounds</div><h1>The right logo for the ground</h1><div class="rule"></div>
<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:14px">
{bg_tile("ivory","01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png","IVORY / WHITE · FULL COLOUR",style="border:1px solid #E6D9B8")}
{bg_tile("crim","01_Primary_Emblem/png/parineeta_emblem_reverse_1000px.png","CRIMSON · REVERSE")}
{bg_tile("gold","04_One_Colour/crimson/png/parineeta_emblem_crimson_600px.png","ZARI GOLD · CRIMSON ONE-COLOUR")}
{bg_tile("mari","04_One_Colour/crimson/png/parineeta_emblem_crimson_600px.png","MARIGOLD · CRIMSON ONE-COLOUR")}
{bg_tile("white","04_One_Colour/black/png/parineeta_emblem_black_600px.png","NEWSPRINT / FAX · BLACK",style="border:1px solid #E6D9B8")}
{bg_tile("black","04_One_Colour/white/png/parineeta_emblem_white_600px.png","PHOTO / VIDEO · WHITE")}
{bg_tile("crim","04_One_Colour/gold/png/parineeta_emblem_gold_600px.png","FOIL STAMP · GOLD ONE-COLOUR")}
{bg_tile("ivory","04_One_Colour/crimson/png/parineeta_emblem_crimson_600px.png","EMBOSS / SEAL · CRIMSON",style="border:1px solid #E6D9B8")}
</div>
<p class="muted" style="margin-top:14px">The full-colour and reverse logos are the only ones that use the sun-disc gradient. Every one-colour version is a true single-colour separation (the knot becomes outline against solid), so they work for foil stamping, embossing, engraving, newspaper ads and laser cutting. Over photographs, use the white one-colour logo on a darkened area, never the full-colour logo directly.</p></div>''', "BACKGROUNDS")

# ---------------------------------------------------------------- 9 typography
add(f'''<div class="pad"><div class="eyebrow">07 &nbsp;Typography</div><h1>Four voices, all open-source</h1><div class="rule"></div>
<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px">
<div class="card"><h3>Bengali display · Noto Serif Bengali SemiBold</h3><div style="font-family:NSB;font-weight:600;font-size:46px;color:#4D050C;line-height:1.2">পরিণীতা</div><div style="font-family:NSB;font-weight:500;font-size:22px;color:#8A5A0B">এ যেন এক বিয়ের মরশুম</div><p class="muted" style="margin:6px 0 0">Headlines and the wordmark. Handles Bengali conjuncts correctly.</p></div>
<div class="card"><h3>Latin display · Cinzel SemiBold</h3><div style="font-family:Cinzel;font-weight:600;font-size:34px;letter-spacing:.3em;color:#4D050C">PARINEETA</div><div style="font-family:Cinzel;font-weight:500;font-size:15px;letter-spacing:.22em;color:#8A5A0B;margin-top:10px">A SEASON OF WEDDINGS</div><p class="muted" style="margin:10px 0 0">Transliteration and English headlines. Always capitals, always widely tracked.</p></div>
<div class="card"><h3>Editorial · Cormorant Garamond</h3><div style="font-family:Corm;font-weight:500;font-size:30px;color:#4D050C;line-height:1.15">Every wedding is a <i>season</i> of its own.</div><p class="muted" style="margin:8px 0 0">Pull-quotes, invitation English lines, captions. Regular and italic.</p></div>
<div class="card"><h3>Text &amp; interface · Hind Siliguri</h3><div style="font-family:Hind;font-size:15px;line-height:1.6"><b style="font-weight:600">আপনার বিশেষ দিনটিকে আমরা সাজিয়ে তুলি ঐতিহ্য আর ভালোবাসায়।</b><br>We dress your day in tradition and love. Clean, readable Bengali and Latin for body copy, menus, websites and forms.</div></div></div>
<table style="margin-top:14px"><tr><th>Level</th><th>Bengali</th><th>Latin</th><th>Colour</th></tr>
<tr><td>Headline</td><td>Noto Serif Bengali 600</td><td>Cinzel 600, tracking +0.2em</td><td>Crimson / Champagne</td></tr>
<tr><td>Sub-head</td><td>Noto Serif Bengali 500</td><td>Cormorant Garamond 500</td><td>Deep Zari</td></tr>
<tr><td>Body</td><td>Hind Siliguri 400, 1.6 leading</td><td>Hind Siliguri 400</td><td>Dark crimson #2B0307</td></tr></table>
<p class="muted" style="margin-top:8px">All four families are SIL Open Font License, free for commercial use, on Google Fonts. Never retype the wordmark: use the supplied artwork.</p></div>''', "TYPOGRAPHY")

# ---------------------------------------------------------------- 10 graphic language
add(f'''<div class="pad"><div class="eyebrow">08 &nbsp;Graphic language</div><h1>Alpana, lotus &amp; the knot</h1><div class="rule"></div>
<div class="grid" style="grid-template-columns:1.1fr 1fr;grid-template-rows:170px 170px;gap:14px">
<div class="tile" style="grid-row:span 2;background:url(../07_Pattern/png/alpana_gold_on_crimson.png);background-size:280px"></div>
<div class="tile" style="background:url(../07_Pattern/png/alpana_crimson_on_ivory.png);background-size:170px;border:1px solid #E6D9B8"></div>
<div class="tile" style="background:url(../07_Pattern/png/alpana_tone_on_tone_crimson.png);background-size:170px;background-color:#4D050C">{img("02_Lockups/png/parineeta_stacked_reverse_800px.png","height:150px")}</div></div>
<table style="margin-top:16px"><tr><th>Element</th><th>Rule</th></tr>
<tr><td><b>Alpana pattern</b></td><td>Gold on crimson for packaging and covers; crimson on ivory for print. Tone-on-tone crimson is a quiet texture behind logos: never place the logo over the high-contrast versions. Repeats seamlessly (tile supplied).</td></tr>
<tr><td><b>Gatchhara knot</b></td><td>A sign-off, not decoration: once per layout, centred, at the foot. Never enlarge it beyond the wordmark&rsquo;s width.</td></tr>
<tr><td><b>Lotus divider</b></td><td>A hairline with a small lotus; separates tagline from body. Gold on dark, deep zari on ivory.</td></tr></table></div>''', "GRAPHIC LANGUAGE")

# ---------------------------------------------------------------- 11 misuse
def bad(inner, label, cls="ivory"):
    return (f'<div class="tile {cls}" style="height:170px;{"border:1px solid #E6D9B8;" if cls=="ivory" else ""}">{inner}'
            f'<span class="lab" style="color:#a3111f;font-weight:700">✕ {label}</span>'
            f'<span style="position:absolute;right:10px;top:8px;color:#a3111f;font-size:20px;font-weight:700">✕</span></div>')


HZ = "02_Lockups/png/parineeta_horizontal_fullcolor_1000px.png"
EM = "01_Primary_Emblem/png/parineeta_emblem_fullcolor_1000px.png"
add(f'''<div class="pad"><div class="eyebrow">09 &nbsp;Logo misuse</div><h1>Please don&rsquo;t</h1><div class="rule"></div>
<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">
{bad(img(EM,"width:110px;transform:scale(1.5,.8)"),"STRETCH OR SQUASH")}
{bad(img(EM,"width:120px;transform:rotate(-18deg)"),"ROTATE")}
{bad(img(EM,"width:120px;filter:hue-rotate(200deg) saturate(1.4)"),"RECOLOUR")}
{bad(img(EM,"width:120px;filter:drop-shadow(6px 8px 5px rgba(0,0,0,.7))"),"ADD SHADOWS OR GLOWS")}
{bad(img("04_One_Colour/crimson/png/parineeta_emblem_crimson_600px.png","width:120px"),"LOW CONTRAST","crim")}
<div class="tile" style="height:170px;background:url(../07_Pattern/png/alpana_gold_on_crimson.png);background-size:130px">{img("02_Lockups/png/parineeta_horizontal_fullcolor_1000px.png","width:170px")}<span class="lab" style="color:#F3DC9A;font-weight:700">✕ BUSY BACKGROUND</span></div>
{bad('<div style="font-family:Nirmala UI,Vrinda,sans-serif;font-weight:700;font-size:40px;color:#4D050C">পরিণীতা</div>',"RETYPE THE WORDMARK")}
{bad('<div style="width:100px;position:relative">'+img(EM,"width:100px")+'<div style="position:absolute;left:-40px;right:-40px;top:20px;font-size:9px;line-height:1.2;color:#333;opacity:.8">Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt<br>ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation</div></div>',"IGNORE CLEAR SPACE")}
</div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">
<div class="card"><h3>Also avoid</h3>Cropping the ring &middot; changing the petal count &middot; moving the knot or crown &middot; using the emblem on a busy photo &middot; outlining the artwork &middot; adding words beside the logo.</div>
<div class="card"><h3>Always</h3>Use the supplied files &middot; keep the proportions &middot; respect clear space &middot; pick the version from the backgrounds page.</div>
<div class="card"><h3>Not sure?</h3>If it isn&rsquo;t in the file guide, ask before you make it.</div></div></div>''', "LOGO MISUSE")

# ---------------------------------------------------------------- 12-15 applications
def mock(path, title, blurb, dark=False, w="100%"):
    return path, title, blurb


add(f'''<div class="pad" style="inset:56px 0 0 0"><div style="padding:0 64px"><div class="eyebrow">10 &nbsp;Stationery</div><h1>Business card, letterhead, envelope</h1></div>
<div style="display:grid;grid-template-columns:1.25fr .8fr;gap:0;margin-top:0;height:500px">
<div style="background:#E9DFC8;display:flex;align-items:center;justify-content:center">{img("08_Stationery_and_Mockups/png/business_cards.png","width:600px")}</div>
<div style="background:#E9DFC8;display:flex;align-items:center;justify-content:center;border-left:1px solid #d8ccb0">{img("08_Stationery_and_Mockups/png/letterhead_A4.png","height:480px")}</div></div>
<div style="padding:12px 64px 0;display:grid;grid-template-columns:1.25fr .8fr;gap:22px"><p class="muted">Card: crimson velvet face with tone-on-tone alpana and the reverse stacked logo; ivory back with the horizontal logo and the seal. Standard 3.5 × 2 in.</p><p class="muted">Letterhead: horizontal logo top-left, faint one-colour seal watermark, gold rules, crimson footer band. A4.</p></div></div>''', "STATIONERY")

add(f'''<div class="pad" style="inset:56px 0 0 0"><div style="padding:0 64px"><div class="eyebrow">11 &nbsp;Packaging &amp; signage</div><h1>Velvet, zari &amp; ribbon</h1></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;height:390px;background:#E9DFC8">
<div style="display:flex;align-items:center;justify-content:center">{img("08_Stationery_and_Mockups/png/shopping_bag.png","width:330px")}</div>
<div style="display:flex;align-items:center;justify-content:center;border-left:1px solid #d8ccb0">{img("08_Stationery_and_Mockups/png/gift_box.png","width:340px")}</div>
<div style="display:flex;align-items:center;justify-content:center;border-left:1px solid #d8ccb0">{img("08_Stationery_and_Mockups/png/envelope.png","width:350px")}</div></div>
{img("08_Stationery_and_Mockups/png/storefront_signage.png","width:100%;height:170px;object-fit:cover")}</div>''', "PACKAGING & SIGNAGE")

add(f'''<div class="pad"><div class="eyebrow">12 &nbsp;Digital &amp; social</div><h1>Every screen, one look</h1><div class="rule"></div>
<div style="display:grid;grid-template-columns:230px 1fr 250px;gap:20px;align-items:start">
<div style="display:grid;gap:14px"><div><h3>Profile</h3>{img("06_Social_Media/png/profile_avatar_1080_640px.png","width:170px;border-radius:50%;border:2px solid #C8922A")}</div>
<div><h3>App icon &amp; favicon</h3><div style="display:flex;gap:10px;align-items:flex-end">{img("05_App_Icons_and_Favicons/png/parineeta_app_icon_rounded_512px.png","width:96px")}{img("05_App_Icons_and_Favicons/png/favicon-64x64.png","width:48px")}{img("05_App_Icons_and_Favicons/png/favicon-32x32.png","width:32px")}{img("05_App_Icons_and_Favicons/png/favicon-16x16.png","width:16px")}</div></div></div>
<div style="display:grid;gap:14px"><div><h3>Facebook cover · 1640 × 624</h3>{img("06_Social_Media/png/facebook_cover_1640x624.png","width:100%;border-radius:4px")}</div>
<div><h3>X header · 1500 × 500</h3>{img("06_Social_Media/png/x_twitter_header_1500x500.png","width:100%;border-radius:4px")}</div>
<div><h3>LinkedIn · 1584 × 396</h3>{img("06_Social_Media/png/linkedin_banner_1584x396.png","width:100%;border-radius:4px")}</div></div>
<div><h3>Post template · 1080 × 1350</h3>{img("06_Social_Media/png/instagram_post_template_1080x1350.png","width:100%;border-radius:4px")}</div></div></div>''', "DIGITAL & SOCIAL")

add(f'''<div class="pad" style="inset:56px 0 0 0"><div style="padding:0 64px;display:grid;grid-template-columns:1fr 340px;gap:40px;align-items:start;height:100%">
<div><div class="eyebrow">13 &nbsp;Wedding invitation</div><h1>The brand as a guest list keepsake</h1><div class="rule"></div>
<p class="lead">Invitations are where Parineeta is most often seen and most often kept.</p>
<p>Ivory stock, double gold hairline border, the mukut above <b style="font-family:NSB">শুভ বিবাহ</b> in Noto Serif Bengali, names in the sub-head weight, and the gaṭchhara knot at the foot. The couple&rsquo;s names, date and venue are placeholders in the template.</p>
<table style="margin-top:12px"><tr><th>Do</th><th>Why</th></tr><tr><td>Foil the mukut, border and knot in gold</td><td>The three carry the brand; everything else stays crimson on ivory.</td></tr>
<tr><td>Keep Bengali first, English second</td><td>Bengali line in Noto Serif Bengali; English in Cormorant Garamond italic beneath.</td></tr>
<tr><td>Envelope: crimson with the seal on the flap</td><td>Consistent unboxing from envelope to card to gift box.</td></tr></table></div>
<div style="background:#E9DFC8;height:100%;display:flex;align-items:center;justify-content:center;margin-right:-64px;padding:0 20px">{img("08_Stationery_and_Mockups/png/wedding_invitation_1600px.png" if False else "08_Stationery_and_Mockups/png/wedding_invitation.png","width:300px")}</div></div></div>''', "WEDDING INVITATION")

# ---------------------------------------------------------------- 16 file guide
add(f'''<div class="pad"><div class="eyebrow">14 &nbsp;File guide</div><h1>Which file, when</h1><div class="rule"></div>
<table><tr><th style="width:250px">Folder</th><th>Contents</th><th style="width:270px">Use for</th></tr>
<tr><td><b>01_Primary_Emblem</b></td><td>Full colour and reverse: SVG, PDF, PNG</td><td>Packaging, signage, seals</td></tr>
<tr><td><b>02_Lockups</b></td><td>Horizontal, stacked, wordmark ± tagline: full colour and reverse</td><td>Letterhead, web, bills, banners</td></tr>
<tr><td><b>03_Monogram_and_Seal</b></td><td>প monogram and circular seal</td><td>Stickers, stamps, avatars</td></tr>
<tr><td><b>04_One_Colour</b></td><td>Black, white, crimson, gold: every logo</td><td>Foil, emboss, newsprint, laser</td></tr>
<tr><td><b>05_App_Icons_and_Favicons</b></td><td>Icon, favicon set, .ico, manifest, HTML snippet</td><td>Website, app, PWA</td></tr>
<tr><td><b>06_Social_Media</b></td><td>Avatar, covers, banners, post template</td><td>Facebook, Instagram, X, LinkedIn, YouTube</td></tr>
<tr><td><b>07_Pattern</b></td><td>Alpana patterns and seamless tile</td><td>Backgrounds, wrapping, packaging</td></tr>
<tr><td><b>08_Stationery_and_Mockups</b></td><td>Cards, letterhead, envelope, bag, box, signage, invitation</td><td>Approvals, presentations</td></tr>
<tr><td><b>09_Colour_and_Type</b></td><td>Palette JSON, CSS tokens, swatch sheet</td><td>Developers &amp; designers</td></tr></table>
<p class="muted" style="margin-top:12px"><b>Format guide:</b> SVG for web and anything that scales &middot; PDF (vector) for printers and signage vendors &middot; PNG (transparent) for documents and social. All text in every logo is converted to outlines, so no font installation is needed to use them.</p></div>''', "FILE GUIDE")

html = (f'<!doctype html><html><head><meta charset="utf-8"><title>Parineeta Brand Identity Guidelines</title>'
        f'<style>{CSS.replace("@@F@@", FONT_URL)}</style></head><body>{"".join(pages)}</body></html>')
hp = os.path.join(OUT, "Parineeta_Brand_Guidelines.html")
open(hp, "w", encoding="utf-8").write(html)
print("html written;", len(pages), "pages")

# ---------------------------------------------------------------- PDF
pdf_path = os.path.join(OUT, "Parineeta_Brand_Guidelines.pdf")
profile = tempfile.mkdtemp(prefix="edge_book_")
if os.path.exists(pdf_path):
    os.remove(pdf_path)
proc = subprocess.Popen([B.EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--user-data-dir={profile}",
                         "--virtual-time-budget=20000", f"--print-to-pdf={pdf_path}", "file:///" + hp.replace("\\", "/")],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
deadline = time.time() + 180
last = -1
while time.time() < deadline:
    if os.path.exists(pdf_path):
        sz = os.path.getsize(pdf_path)
        if sz > 0 and sz == last:
            with open(pdf_path, "rb") as fh:
                fh.seek(max(0, sz - 32))
                if b"%%EOF" in fh.read():
                    break
        last = sz
    time.sleep(1.0)
proc.terminate()
shutil.rmtree(profile, ignore_errors=True)
print("pdf", os.path.getsize(pdf_path) // 1024, "KB")
