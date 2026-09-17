(() => {
  const NS = "http://www.w3.org/2000/svg";
  const P = { paper: "#f5eddb", ink: "#17291f", deep: "#1f5a3a", leaf: "#2f7d4f", bright: "#7dbb6a", lime: "#c6d98a", hibiscus: "#e3452c", hibiscusDark: "#b0301b", flamingo: "#f4a2b6", citrus: "#f2a41f", citrusDark: "#c9761a", lemon: "#f6d65c" };

  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };

  const mulberry = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const jitter = (rng, amount) => (rng() - 0.5) * 2 * amount;

  function defs(svg, rng, uid) {
    const d = el("defs", {}, svg);
    for (let i = 0; i < 4; i++) {
      const f = el("filter", { id: `${uid}-wash${i}`, x: "-30%", y: "-30%", width: "160%", height: "160%" }, d);
      el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.011 + i * 0.004, numOctaves: 3, seed: Math.floor(rng() * 999), result: "n" }, f);
      el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 16 + i * 5, xChannelSelector: "R", yChannelSelector: "G" }, f);
    }
    const rough = el("filter", { id: `${uid}-rough`, x: "-10%", y: "-10%", width: "120%", height: "120%" }, d);
    el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.06, numOctaves: 2, seed: 4, result: "n" }, rough);
    el("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.6, xChannelSelector: "R", yChannelSelector: "G" }, rough);

    const hatch = (id, color, angle, gap, width) => {
      const p = el("pattern", { id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: `rotate(${angle})` }, d);
      el("line", { x1: 0, y1: 0, x2: 0, y2: gap, stroke: color, "stroke-width": width }, p);
    };
    hatch(`${uid}-hatch`, P.ink, 38, 6.5, 1.1);
    hatch(`${uid}-cross`, P.ink, -42, 9, 0.9);
    hatch(`${uid}-hatchPaper`, P.paper, 38, 7, 1.2);
    const dots = el("pattern", { id: `${uid}-dots`, width: 6.5, height: 6.5, patternUnits: "userSpaceOnUse" }, d);
    el("circle", { cx: 3.25, cy: 3.25, r: 1.5, fill: P.ink }, dots);

    const shade = (id, x1, y1, x2, y2) => {
      const g = el("linearGradient", { id: `${uid}-g${id}`, x1, y1, x2, y2 }, d);
      el("stop", { offset: "0", "stop-color": "#fff" }, g);
      el("stop", { offset: "0.62", "stop-color": "#000" }, g);
      const m = el("mask", { id: `${uid}-m${id}`, maskContentUnits: "objectBoundingBox" }, d);
      el("rect", { width: 1, height: 1, fill: `url(#${uid}-g${id})` }, m);
    };
    shade("L", 0, 0, 1, 0);
    shade("R", 1, 0, 0, 0);
    shade("B", 0, 1, 0, 0);
    shade("T", 0, 0, 0, 1);
    const rg = el("radialGradient", { id: `${uid}-gRad`, cx: 0.36, cy: 0.34, r: 0.72 }, d);
    el("stop", { offset: "0.25", "stop-color": "#000" }, rg);
    el("stop", { offset: "1", "stop-color": "#fff" }, rg);
    const mr = el("mask", { id: `${uid}-mRad`, maskContentUnits: "objectBoundingBox" }, d);
    el("rect", { width: 1, height: 1, fill: `url(#${uid}-gRad)` }, mr);
  }

  function makePainter(uid, rng) {
    const url = (id) => `url(#${uid}-${id})`;
    return function paint(parent, d, o) {
      const g = el("g", {}, parent);
      const washA = o.wash ?? Math.floor(rng() * 4);
      const shade = o.shade || "L";
      if (o.mono) {
        el("path", { d, fill: url("hatchPaper"), "fill-rule": "evenodd", opacity: o.hatch ?? 0.5, mask: url(`m${shade}`) }, g);
        el("path", { d, fill: "none", stroke: P.paper, "stroke-width": 1.6, opacity: 0.9, filter: url("rough") }, g);
        if (o.veins) el("path", { d: o.veins, fill: "none", stroke: P.paper, "stroke-width": 1.2, opacity: 0.8, filter: url("rough"), "stroke-linecap": "round" }, g);
        return g;
      }
      el("path", { d, fill: o.color, "fill-rule": "evenodd", opacity: 0.88, filter: url(`wash${washA}`) }, g);
      if (!o.simple) el("path", { d, fill: o.dark, "fill-rule": "evenodd", opacity: 0.5, filter: url(`wash${(washA + 1) % 4}`), mask: url(`m${shade}`), transform: "translate(3 5)" }, g);
      el("path", { d, fill: url("hatch"), "fill-rule": "evenodd", opacity: o.hatch ?? 0.5, mask: url(`m${shade}`) }, g);
      if (o.cross) el("path", { d, fill: url("cross"), "fill-rule": "evenodd", opacity: 0.35, mask: url(`m${shade}`) }, g);
      if (o.veins) el("path", { d: o.veins, fill: "none", stroke: P.ink, "stroke-width": 1, opacity: 0.55, filter: url("rough"), "stroke-linecap": "round" }, g);
      el("path", { d, fill: "none", stroke: P.ink, "stroke-width": 1.15, opacity: 0.85, filter: url("rough") }, g);
      return g;
    };
  }

  const MONSTERA = "M0 -112 C42 -142 102 -112 100 -40 C98 34 42 86 0 98 C-42 86 -98 34 -100 -40 C-102 -112 -42 -142 0 -112 Z M92 -62 L30 -46 L92 -30 Z M90 -12 L34 -6 L82 18 Z M66 52 L30 34 L50 70 Z M-92 -62 L-30 -46 L-92 -30 Z M-90 -12 L-34 -6 L-82 18 Z M-66 52 L-30 34 L-50 70 Z M-22 -20 a6 11 -20 1 0 0.1 0 Z M22 12 a5 10 25 1 0 0.1 0 Z";
  const MONSTERA_VEINS = "M0 -104 L0 92 M0 -54 L66 -76 M0 -54 L-66 -76 M0 -14 L70 -22 M0 -14 L-70 -22 M0 28 L50 40 M0 28 L-50 40 M0 62 L30 76 M0 62 L-30 76";
  const BANANA = "M-160 0 C-110 -64 100 -72 158 0 C100 72 -110 64 -160 0 Z M-52 -52 L-46 -2 L-40 -54 Z M62 50 L56 2 L48 52 Z M104 -44 L98 -2 L112 -40 Z";
  const bananaVeins = () => {
    let d = "M-152 0 L152 0";
    for (let x = -136; x <= 136; x += 15) {
      const edge = 66 * Math.sqrt(Math.max(0, 1 - (x / 160) ** 2));
      d += ` M${x} 0 L${x + 16} ${-edge} M${x} 0 L${x + 16} ${edge}`;
    }
    return d;
  };
  const ORANGE_LEAF = "M2 -54 C22 -84 64 -84 70 -60 C52 -46 20 -42 2 -54 Z";
  const PETAL = "M0 0 C-34 -18 -46 -60 -20 -82 C-8 -94 8 -94 20 -82 C46 -60 34 -18 0 0 Z";

  const SPECIES = {
    monstera(paint, g, rng, c) {
      paint(g, MONSTERA, { color: c[0], dark: c[1], shade: rng() < 0.5 ? "L" : "R", veins: MONSTERA_VEINS, cross: true });
    },
    banana(paint, g, rng, c) {
      paint(g, BANANA, { color: c[0], dark: c[1], shade: rng() < 0.5 ? "T" : "B", veins: bananaVeins() });
    },
    fan(paint, g, rng, c) {
      const n = 15;
      for (let i = 0; i < n; i++) {
        const a = -78 + (156 / (n - 1)) * i + jitter(rng, 2.5);
        const len = 150 + rng() * 30 - Math.abs(a) * 0.35;
        const lg = el("g", { transform: `rotate(${a})` }, g);
        paint(lg, `M0 0 L-8 ${-len * 0.72} L0 ${-len} L8 ${-len * 0.72} Z`, { color: c[0], dark: c[1], simple: true, hatch: 0.42, shade: "L", veins: `M0 -8 L0 ${-len * 0.92}` });
      }
      paint(g, "M-7 0 L0 62 L7 0 Z", { color: c[1], dark: c[1], simple: true, hatch: 0.3 });
    },
    frond(paint, g, rng, c) {
      const spine = el("path", { d: "M0 0 C40 -70 110 -150 250 -200", fill: "none", stroke: P.ink, "stroke-width": 2, opacity: 0.8 }, g);
      const total = spine.getTotalLength();
      const n = 18;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const pt = spine.getPointAtLength(t * total);
        const pt2 = spine.getPointAtLength(Math.min(total, t * total + 1));
        const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI;
        const L = 56 + 44 * Math.sin(Math.PI * t) + rng() * 8;
        for (const side of [-1, 1]) {
          const lg = el("g", { transform: `translate(${pt.x} ${pt.y}) rotate(${ang + side * 58 + jitter(rng, 6)})` }, g);
          paint(lg, `M0 0 C${L * 0.4} ${side * 7}, ${L * 0.8} ${side * 11}, ${L} ${side * 3} C${L * 0.72} ${side * 17}, ${L * 0.3} ${side * 15}, 0 0 Z`, { color: c[0], dark: c[1], simple: true, hatch: 0.36, shade: side < 0 ? "B" : "T" });
        }
      }
    },
    hibiscus(paint, g, rng) {
      for (let k = 0; k < 5; k++) {
        const pg = el("g", { transform: `rotate(${k * 72 + jitter(rng, 5)})` }, g);
        paint(pg, PETAL, { color: P.hibiscus, dark: P.hibiscusDark, shade: "B", hatch: 0.32 });
      }
      el("circle", { r: 9, fill: "#5c1710", opacity: 0.9 }, g);
      el("path", { d: "M0 0 L40 -36", stroke: P.lemon, "stroke-width": 3.5, "stroke-linecap": "round" }, g);
      for (const [x, y] of [[38, -38], [46, -32], [42, -27], [48, -40]]) el("circle", { cx: x, cy: y, r: 3.2, fill: P.citrus }, g);
    },
    orange(paint, g, rng, c, url) {
      el("circle", { r: 44, fill: P.citrus, opacity: 0.92, filter: url("wash0") }, g);
      el("circle", { r: 44, fill: P.citrusDark, opacity: 0.5, filter: url("wash1"), mask: url("mRad") }, g);
      el("circle", { r: 44, fill: url("dots"), opacity: 0.45, mask: url("mRad") }, g);
      el("circle", { r: 44, fill: "none", stroke: P.ink, "stroke-width": 1.2, opacity: 0.85, filter: url("rough") }, g);
      el("ellipse", { cx: -15, cy: -17, rx: 9, ry: 5, fill: P.paper, opacity: 0.35, transform: "rotate(-30 -15 -17)" }, g);
      el("path", { d: "M0 -44 L2 -56", stroke: P.ink, "stroke-width": 2, "stroke-linecap": "round" }, g);
      paint(g, ORANGE_LEAF, { color: P.leaf, dark: P.deep, shade: "L", hatch: 0.45, veins: "M4 -55 L62 -63" });
    },
  };

  const COLORS = {
    monstera: [[P.leaf, P.deep], [P.deep, P.ink], [P.bright, P.leaf]],
    banana: [[P.bright, P.leaf], [P.lime, P.bright], [P.leaf, P.deep]],
    fan: [[P.leaf, P.deep], [P.bright, P.leaf]],
    frond: [[P.bright, P.leaf], [P.leaf, P.deep]],
    hibiscus: [[P.hibiscus, P.hibiscusDark]],
    orange: [[P.citrus, P.citrusDark]],
  };

  const SLOTS = [
    { x: 150, y: 150, rot: -28, s: 1.35, kinds: ["fan"] },
    { x: 1470, y: 120, rot: 196, s: 1.15, kinds: ["banana"] },
    { x: 1420, y: 770, rot: 16, s: 1.95, kinds: ["monstera"] },
    { x: 150, y: 820, rot: -54, s: 1.4, kinds: ["frond", "monstera"] },
    { x: 1580, y: 520, rot: -48, s: 1.1, kinds: ["frond", "fan"] },
    { x: 40, y: 540, rot: 62, s: 1.05, kinds: ["banana", "frond"] },
    { x: 1310, y: 330, rot: 10, s: 0.95, kinds: ["hibiscus"] },
    { x: 260, y: 430, rot: 0, s: 0.9, kinds: ["orange", "hibiscus"] },
    { x: 640, y: 870, rot: -8, s: 0.7, kinds: ["hibiscus", "orange"] },
    { x: 980, y: 30, rot: 30, s: 0.62, kinds: ["orange"] },
  ];

  function build(container) {
    const kind = container.dataset.garden || "scene";
    const seed = Number(container.dataset.seed) || Math.floor(Date.now() / 86400000);
    const rng = mulberry(seed * 7919 + kind.length);
    const uid = `g${Math.floor(rng() * 1e6)}`;
    const url = (id) => `url(#${uid}-${id})`;
    const svg = el("svg", { viewBox: "0 0 1600 900", preserveAspectRatio: "xMidYMid slice", "aria-hidden": "true" });
    defs(svg, rng, uid);
    const paint = makePainter(uid, rng);
    container.replaceChildren(svg);

    if (kind === "solo") {
      const species = container.dataset.species || "monstera";
      const g = el("g", { class: "plant", transform: `translate(800 450) scale(${container.dataset.scale || 3.2}) rotate(${container.dataset.rot || -14})` }, svg);
      const monoPaint = (parent, d, o) => paint(parent, d, { ...o, mono: true });
      SPECIES[species](monoPaint, g, rng, COLORS[species][0], url);
      return;
    }

    for (let i = 0; i < 4; i++) {
      el("ellipse", { cx: 200 + rng() * 1200, cy: 100 + rng() * 700, rx: 120 + rng() * 160, ry: 80 + rng() * 120, fill: rng() < 0.5 ? P.lime : P.flamingo, opacity: 0.18, filter: url(`wash${i}`) }, svg);
    }
    const clear = { cx: 800, cy: 450, rx: 570, ry: 300 };
    const placed = SLOTS.map((slot) => {
      let x = slot.x + jitter(rng, 24);
      let y = slot.y + jitter(rng, 24);
      const nx = (x - clear.cx) / clear.rx;
      const ny = (y - clear.cy) / clear.ry;
      const inside = Math.hypot(nx, ny);
      if (inside < 1) {
        const k = inside === 0 ? 1 : 1.04 / inside;
        x = clear.cx + (x - clear.cx) * k;
        y = clear.cy + (y - clear.cy) * k;
      }
      return {
        species: slot.kinds[Math.floor(rng() * slot.kinds.length)],
        rot: slot.rot + jitter(rng, 9),
        s: slot.s * (1 + jitter(rng, 0.08)),
        x,
        y,
      };
    }).sort((a, b) => b.s - a.s);
    for (const p of placed) {
      const palette = COLORS[p.species];
      const c = palette[Math.floor(rng() * palette.length)];
      const g = el("g", { class: "plant", transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${p.s.toFixed(3)})` }, svg);
      SPECIES[p.species](paint, g, rng, c, url);
    }
  }

  const run = () => document.querySelectorAll("[data-garden]").forEach(build);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
