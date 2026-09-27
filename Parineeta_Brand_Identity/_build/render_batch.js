// usage: node render_batch.js manifest.json   -> [{svg, png, width, bg?}]
const { Resvg } = require(process.env.RESVG_PATH || "@resvg/resvg-js");
const fs = require("fs");
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
let n = 0;
for (const j of jobs) {
  const svg = fs.readFileSync(j.svg, "utf8");
  const opts = { font: { loadSystemFonts: false } };
  if (j.width) opts.fitTo = { mode: "width", value: j.width };
  if (j.bg) opts.background = j.bg;
  fs.writeFileSync(j.png, new Resvg(svg, opts).render().asPng());
  n++;
}
console.log("rendered", n, "PNGs");
