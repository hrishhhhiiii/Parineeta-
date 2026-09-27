"""Build the complete Parineeta brand package.

Run:  python build_all.py
Needs: uharfbuzz, fonttools, pillow, node + @resvg/resvg-js (RESVG_PATH env), Microsoft Edge (PDF export).
"""
import os
import json
import shutil
import subprocess
import sys

import art
import marks
import mockups as M
from art import C

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.dirname(os.path.abspath(__file__))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

jobs = []          # PNG render jobs
pdf_jobs = []      # (svg_path, pdf_path, w, h)


def out(*parts):
    p = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def save_svg(path, svg):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg)


def asset(folder, name, svg, widths=(2000, 600), bg=None, pdf=False):
    """Write SVG and queue transparent PNGs (or flat-background PNGs when bg is given)."""
    p = out(folder, name + ".svg")
    save_svg(p, svg)
    for w in widths:
        suffix = "" if len(widths) == 1 else f"_{w}px"
        jobs.append(dict(svg=p, png=out(folder, "png", name + suffix + ".png"), width=w, bg=bg))
    if pdf:
        import re
        vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
        pdf_jobs.append((p, out(folder, "pdf", name + ".pdf"), vb[2], vb[3]))
    return p


def rm_generated():
    for d in os.listdir(ROOT):
        if d[:2].isdigit() and os.path.isdir(os.path.join(ROOT, d)):
            shutil.rmtree(os.path.join(ROOT, d))


# ------------------------------------------------------------------ 01 primary emblem
def primary():
    F = "01_Primary_Emblem"
    asset(F, "parineeta_emblem_fullcolor", art.emblem_svg("full"), (3000, 1000, 400), pdf=True)
    asset(F, "parineeta_emblem_reverse", art.emblem_svg("reverse"), (3000, 1000, 400), pdf=True)
    asset(F + "/on_background", "parineeta_emblem_fullcolor_on_ivory", art.emblem_svg("full", bg=C["ivory"], pad=30), (2000,))
    asset(F + "/on_background", "parineeta_emblem_reverse_on_crimson", art.emblem_svg("reverse", bg=C["crimson"], pad=30), (2000,))


# ------------------------------------------------------------------ 02 lockups
def lockups():
    F = "02_Lockups"
    for mode, tag in (("full", "fullcolor"), ("reverse", "reverse")):
        asset(F, f"parineeta_horizontal_{tag}", marks.horizontal_svg(mode), (3000, 1000), pdf=True)
        asset(F, f"parineeta_stacked_{tag}", marks.stacked_svg(mode), (2400, 800), pdf=True)
        asset(F, f"parineeta_wordmark_tagline_{tag}", marks.wordmark_svg(mode), (2400, 800), pdf=True)
        asset(F, f"parineeta_wordmark_only_{tag}", marks.wordmark_svg(mode, with_tag=False), (2400, 800), pdf=True)


# ------------------------------------------------------------------ 03 monogram + seal
def monogram_seal():
    F = "03_Monogram_and_Seal"
    for mode, tag in (("full", "fullcolor"), ("reverse", "reverse")):
        asset(F, f"parineeta_monogram_{tag}", marks.monogram_svg(mode), (2000, 600), pdf=True)
        asset(F, f"parineeta_seal_{tag}", marks.seal_svg(mode), (2000, 600), pdf=True)


# ------------------------------------------------------------------ 04 one colour
ONE_COLOUR = {"black": "#000000", "white": "#FFFFFF", "crimson": C["crimson"], "gold": C["gold"]}


def one_colour():
    for cname, hexv in ONE_COLOUR.items():
        F = f"04_One_Colour/{cname}"
        asset(F, f"parineeta_emblem_{cname}", art.emblem_svg("mono", mono=hexv), (2400, 600), pdf=True)
        asset(F, f"parineeta_horizontal_{cname}", marks.horizontal_svg("mono", mono=hexv), (2400, 600), pdf=True)
        asset(F, f"parineeta_stacked_{cname}", marks.stacked_svg("mono", mono=hexv), (2000, 600), pdf=True)
        asset(F, f"parineeta_wordmark_{cname}", marks.wordmark_svg("mono", mono=hexv), (2000, 600), pdf=True)
        asset(F, f"parineeta_monogram_{cname}", marks.monogram_svg("mono", mono=hexv), (1600, 500), pdf=True)
        asset(F, f"parineeta_seal_{cname}", marks.seal_svg("mono", mono=hexv), (1600, 500), pdf=True)


# ------------------------------------------------------------------ 05 app icons + favicons
def icons():
    F = "05_App_Icons_and_Favicons"
    asset(F, "parineeta_app_icon_rounded", marks.app_icon_svg(True), (1024, 512, 180), pdf=False)
    asset(F, "parineeta_app_icon_square", marks.app_icon_svg(False), (1024, 512), pdf=False)
    fav = marks.favicon_svg(True)
    p = out(F, "favicon.svg")
    save_svg(p, fav)
    for s in (16, 32, 48, 64, 128, 180, 192, 256, 512):
        name = {180: "apple-touch-icon", 192: "android-chrome-192x192", 512: "android-chrome-512x512"}.get(s, f"favicon-{s}x{s}")
        jobs.append(dict(svg=p, png=out(F, "png", name + ".png"), width=s))
    # square (non-rounded) favicon source for platforms that apply their own mask
    save_svg(out(F, "favicon_square.svg"), marks.favicon_svg(False))
    with open(out(F, "site.webmanifest"), "w", encoding="utf-8") as fh:
        json.dump({"name": "পরিণীতা · Parineeta", "short_name": "Parineeta", "theme_color": C["crimson"],
                   "background_color": C["crimson"], "display": "standalone",
                   "icons": [{"src": "png/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png"},
                             {"src": "png/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png"}]},
                  fh, ensure_ascii=False, indent=2)
    with open(out(F, "HTML_HEAD_SNIPPET.html"), "w", encoding="utf-8") as fh:
        fh.write('''<!-- Paste inside <head>. Adjust the folder path to where you host these files. -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#4D050C">
''')


# ------------------------------------------------------------------ 06 social
def social():
    F = "06_Social_Media"
    asset(F, "profile_avatar_1080", M.avatar(1080), (1080, 640))
    asset(F, "facebook_cover_1640x624", M.fb_cover(1640, 624), (1640,))
    asset(F, "x_twitter_header_1500x500", M.fb_cover(1500, 500), (1500,))
    asset(F, "linkedin_banner_1584x396", M.fb_cover(1584, 396, 0.7), (1584,))
    asset(F, "youtube_banner_2560x1440", M.fb_cover(2560, 1440, 0.34), (2560,))
    asset(F, "instagram_post_template_1080x1350", M.post_template(1080, 1350), (1080,))


# ------------------------------------------------------------------ 07 pattern
def patterns():
    F = "07_Pattern"
    asset(F, "alpana_gold_on_crimson", M.pattern_svg(C["crimson"], C["gold"], C["gold"], 1600, 1600), (1600,))
    asset(F, "alpana_crimson_on_ivory", M.pattern_svg(C["ivory"], C["crimson"], C["crimson"], 1600, 1600), (1600,))
    asset(F, "alpana_tone_on_tone_crimson", M.pattern_svg(C["crimson"], "#7C1522", "#7C1522", 1600, 1600, 240), (1600,))
    tile = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">' \
           f'<rect width="240" height="240" fill="{C["crimson"]}"/>{M.alpana_tile(C["gold"], C["gold"], 240)}</svg>'
    save_svg(out(F, "alpana_tile_seamless_240.svg"), tile)
    jobs.append(dict(svg=out(F, "alpana_tile_seamless_240.svg"), png=out(F, "png", "alpana_tile_seamless_960.png"), width=960))


# ------------------------------------------------------------------ 08 stationery / mockups
def stationery():
    F = "08_Stationery_and_Mockups"
    asset(F, "business_cards", M.business_cards(), (2000,))
    asset(F, "letterhead_A4", M.letterhead(), (1800,))
    asset(F, "envelope", M.envelope(), (2000,))
    asset(F, "shopping_bag", M.shopping_bag(), (1600,))
    asset(F, "gift_box", M.gift_box(), (1600,))
    asset(F, "wedding_invitation", M.invitation(), (1600,))
    asset(F, "storefront_signage", M.signage(), (2400,))


# ------------------------------------------------------------------ 09 colour + type
def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def cmyk(h):
    r, g, b = [v / 255 for v in hex_to_rgb(h)]
    k = 1 - max(r, g, b)
    if k >= 1:
        return (0, 0, 0, 100)
    c = (1 - r - k) / (1 - k); m = (1 - g - k) / (1 - k); y = (1 - b - k) / (1 - k)
    return tuple(round(v * 100) for v in (c, m, y, k))


def lum(h):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = hex_to_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


PALETTE = [
    ("Rajwadi Crimson", "rajwadi-crimson", C["crimson"], "Primary. Backgrounds, packaging velvet, wordmark on light grounds."),
    ("Sindoor Red", "sindoor-red", C["sindoor"], "Accent. The bride's cloth, small highlights, sale and alert moments."),
    ("Antique Zari Gold", "zari-gold", C["gold"], "Primary metallic. Foil, embroidery, fine rules, gold flat one-colour logo."),
    ("Marigold (Haldi)", "marigold", C["marigold"], "The sun-disc. Warm highlight ground behind the wordmark."),
    ("Champagne Gold", "champagne-gold", C["gold_lite"], "Light gold. Text on crimson, fine line details, foil highlights."),
    ("Sholapith Ivory", "sholapith-ivory", C["ivory"], "Neutral. Paper, light backgrounds, the groom's cloth."),
    ("Deep Zari", "deep-zari", C["gold_deep"], "Text-safe gold. Taglines and small copy on ivory."),
]


def colours():
    F = "09_Colour_and_Type"
    data = []
    for name, slug, hx, use in PALETTE:
        r, g, b = hex_to_rgb(hx)
        data.append(dict(name=name, slug=slug, hex=hx, rgb=[r, g, b], cmyk_starting_value=list(cmyk(hx)), usage=use))
    with open(out(F, "parineeta_palette.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    css = ["/* Parineeta brand tokens */", ":root {"]
    for name, slug, hx, use in PALETTE:
        css.append(f"  --parineeta-{slug}: {hx};")
    css += ["  --parineeta-foil: linear-gradient(135deg, #8A5A0B 0%, #D9A93A 22%, #F6E2A0 45%, #C8922A 68%, #7C4E08 100%);",
            "  --parineeta-font-bengali: 'Noto Serif Bengali', serif;",
            "  --parineeta-font-display: 'Cinzel', serif;",
            "  --parineeta-font-editorial: 'Cormorant Garamond', serif;",
            "  --parineeta-font-ui: 'Hind Siliguri', sans-serif;", "}"]
    with open(out(F, "parineeta_tokens.css"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(css) + "\n")
    # swatch sheet
    w, h = 2100, 900
    body = [f'<rect width="{w}" height="{h}" fill="{C["ivory"]}"/>']
    sw = 270
    for i, (name, slug, hx, use) in enumerate(PALETTE):
        x = 60 + i * (sw + 8) * 1
        x = 40 + i * 290
        txt = C["ivory"] if lum(hx) < 0.3 else C["crimson"]
        body.append(f'<rect x="{x}" y="60" width="{sw}" height="560" rx="14" fill="{hx}" stroke="#00000018"/>')
        body.append(M.cinzel(name.upper(), x + 20, 110, 21, txt, tracking=2))
        r, g, b = hex_to_rgb(hx)
        c_, m_, y_, k_ = cmyk(hx)
        body.append(M.sans(hx, x + 20, 540, 34, txt, weight="SemiBold"))
        body.append(M.sans(f"RGB {r} {g} {b}", x + 20, 576, 22, txt))
        body.append(M.sans(f"CMYK {c_} {m_} {y_} {k_}", x + 20, 604, 22, txt))
    body.append(M.cinzel("PARINEETA · COLOUR PALETTE", 40, 760, 28, C["crimson"], tracking=6))
    body.append(M.sans("CMYK values are starting points for a press proof, not a spot-colour match.", 40, 806, 24, "#8A5A0B"))
    svg = M.canvas(w, h, "".join(body))
    asset(F, "parineeta_colour_swatches", svg, (2100,))
    shutil.copy(os.path.join(BUILD, "fonts", "README_fonts.txt"), out(F, "FONTS_README.txt")) if os.path.exists(os.path.join(BUILD, "fonts", "README_fonts.txt")) else None
    return data


# ------------------------------------------------------------------ export
def run_png_jobs():
    for j in jobs:
        os.makedirs(os.path.dirname(j["png"]), exist_ok=True)
    mp = os.path.join(BUILD, "manifest.json")
    json.dump(jobs, open(mp, "w"))
    env = dict(os.environ)
    subprocess.run(["node", os.path.join(BUILD, "render_batch.js"), mp], check=True, env=env)
    # ICO from PNGs
    from PIL import Image
    F = "05_App_Icons_and_Favicons"
    big = Image.open(out(F, "png", "favicon-256x256.png")).convert("RGBA")
    big.save(out(F, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    # Windows / desktop icon
    big.save(out(F, "parineeta_icon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


def run_pdf_jobs():
    """One HTML file per job and a throw-away browser profile, so Edge never reuses a cached page."""
    import tempfile
    tmp = os.path.join(BUILD, "_pdf_tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="edge_pdf_")
    for i, (svg_path, pdf_path, w, h) in enumerate(pdf_jobs):
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
        svg = open(svg_path, encoding="utf-8").read()
        inline = svg.replace(f'width="{int(w)}" height="{int(h)}"', 'width="100%" height="100%"', 1)
        html = (f'<!doctype html><html><head><meta charset="utf-8"><style>@page{{size:{w}px {h}px;margin:0}}'
                f'html,body{{margin:0;padding:0;width:{w}px;height:{h}px;overflow:hidden}}svg{{display:block}}</style></head>'
                f'<body>{inline}</body></html>')
        hp = os.path.join(tmp, f"job_{i:03d}.html")
        open(hp, "w", encoding="utf-8").write(html)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
        proc = subprocess.Popen([EDGE, "--headless", "--disable-gpu", "--no-pdf-header-footer", f"--user-data-dir={profile}",
                                 f"--print-to-pdf={pdf_path}", "file:///" + hp.replace("\\", "/")],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # Edge can return before the PDF is flushed: wait for a complete, stable file.
        import time
        deadline = time.time() + 60
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
            time.sleep(0.4)
        else:
            proc.kill()
            raise RuntimeError("PDF not written: " + pdf_path)
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    shutil.rmtree(tmp, ignore_errors=True)
    shutil.rmtree(profile, ignore_errors=True)


def verify_pdfs():
    """Each PDF must be one page of the expected size and actually contain visible ink."""
    import pymupdf
    problems = []
    for svg_path, pdf_path, w, h in pdf_jobs:
        d = pymupdf.open(pdf_path)
        r = d[0].rect
        exp = (w * 0.75, h * 0.75)
        pm = d[0].get_pixmap(dpi=30, alpha=True)
        alpha = pm.samples[3::4]
        ink = sum(1 for v in alpha if v > 0) / max(1, len(alpha))
        if len(d) != 1 or abs(r.width - exp[0]) > 2 or abs(r.height - exp[1]) > 2 or ink < 0.02:
            problems.append((os.path.basename(pdf_path), len(d), (round(r.width), round(r.height)), (round(exp[0]), round(exp[1])), round(ink, 3)))
    return problems


if __name__ == "__main__":
    rm_generated()
    primary(); lockups(); monogram_seal(); one_colour(); icons(); social(); patterns(); stationery()
    colours()
    run_png_jobs()
    print("PNG done; exporting", len(pdf_jobs), "PDFs")
    if "--no-pdf" not in sys.argv:
        run_pdf_jobs()
        bad = verify_pdfs()
        print("PDF verification problems:", bad if bad else "none")
    print("build complete")
