// usage: node render.js in.svg out.png [width]
const { Resvg } = require(process.env.RESVG_PATH || "@resvg/resvg-js");
const fs = require("fs");
const [,, inp, out, w] = process.argv;
const svg = fs.readFileSync(inp, "utf8");
const opts = { font: { loadSystemFonts: false } };
if (w) opts.fitTo = { mode: "width", value: parseInt(w) };
fs.writeFileSync(out, new Resvg(svg, opts).render().asPng());
