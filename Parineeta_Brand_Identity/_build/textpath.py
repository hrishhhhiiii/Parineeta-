"""Shape text with HarfBuzz and return outlined SVG path data (no live text in the logo files)."""
import os
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
_cache = {}

def _font(name, variations=None):
    key = (name, tuple(sorted((variations or {}).items())))
    if key not in _cache:
        blob = hb.Blob.from_file_path(os.path.join(FONT_DIR, name))
        face = hb.Face(blob)
        font = hb.Font(face)
        if variations:
            font.set_variations(variations)
        _cache[key] = (font, face.upem)
    return _cache[key]

def text_path(text, fontfile, size, x=0, y=0, variations=None, tracking=0, anchor="start", features=None):
    """Return (path_d, advance_width, ascent_bbox). y is the baseline. tracking in px added between clusters."""
    font, upem = _font(fontfile, variations)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, features or {"kern": True, "liga": True})
    scale = size / upem
    total = sum(p.x_advance for p in buf.glyph_positions) * scale + tracking * (len(buf.glyph_infos) - 1)
    if anchor == "middle":
        x -= total / 2
    elif anchor == "end":
        x -= total
    pen = SVGPathPen(None, ntos=lambda v: ("%.2f" % v).rstrip("0").rstrip("."))
    cx = x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        tp = TransformPen(pen, (scale, 0, 0, -scale, cx + pos.x_offset * scale, y - pos.y_offset * scale))
        font.draw_glyph_with_pen(info.codepoint, tp)
        cx += pos.x_advance * scale + tracking
    return pen.getCommands(), total


def text_bbox(text, fontfile, size, variations=None, tracking=0):
    """Ink bounding box (xmin, ymin, xmax, ymax) relative to origin at baseline (y up is negative)."""
    font, upem = _font(fontfile, variations)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})
    scale = size / upem
    bp = BoundsPen(None)
    cx = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        tp = TransformPen(bp, (scale, 0, 0, -scale, cx + pos.x_offset * scale, -pos.y_offset * scale))
        font.draw_glyph_with_pen(info.codepoint, tp)
        cx += pos.x_advance * scale + tracking
    return bp.bounds
