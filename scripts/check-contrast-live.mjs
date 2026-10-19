// Computes real WCAG contrast ratios for visible text on the LIVE site via CDP,
// using actual getComputedStyle() results in a rendered browser (not raw HTML/CSS
// source reading, which prior cycles repeatedly flagged as insufficient for this).
// Usage: node scripts/check-contrast-live.mjs <url> [width]
const CDP = "http://127.0.0.1:9333";
const [, , url, widthArg] = process.argv;
if (!url) { console.error("usage: node scripts/check-contrast-live.mjs <url> [width]"); process.exit(1); }
const width = widthArg ? Number(widthArg) : 390;

async function newTab() { return (await fetch(`${CDP}/json/new`, { method: "PUT" })).json(); }
async function closeTab(id) { await fetch(`${CDP}/json/close/${id}`); }
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const EXTRACT = `
(function() {
  function parseColor(str) {
    const m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(",").map(s => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  function relLum({ r, g, b }) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function effectiveBg(el) {
    // Collect every ancestor's background color (closest first), then
    // alpha-composite from the outermost opaque-ish layer down to the
    // closest, since a translucent bg (e.g. bg-white/[0.03]) must be mixed
    // with what's behind it, not treated as if it were fully opaque.
    const layers = [];
    let node = el;
    while (node) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.001) layers.push(bg);
      if (bg && bg.a >= 0.999) break;
      node = node.parentElement;
    }
    layers.reverse();
    let result = { r: 255, g: 255, b: 255 };
    for (const layer of layers) {
      result = {
        r: layer.r * layer.a + result.r * (1 - layer.a),
        g: layer.g * layer.a + result.g * (1 - layer.a),
        b: layer.b * layer.a + result.b * (1 - layer.a),
      };
    }
    return result;
  }
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const l1 = relLum(fg), l2 = relLum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const fontSize = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
    const threshold = isLarge ? 3.0 : 4.5;
    if (ratio < threshold) {
      results.push({
        text: text.slice(0, 60),
        tag: el.tagName,
        className: el.className && el.className.slice ? el.className.slice(0, 80) : "",
        ratio: Math.round(ratio * 100) / 100,
        threshold,
        fontSize,
        fg: cs.color,
        bg: \`rgb(\${Math.round(bg.r)},\${Math.round(bg.g)},\${Math.round(bg.b)})\`,
      });
    }
  }
  return results;
})()
`;

const { targetId, webSocketDebuggerUrl } = await newTab();
const ws = await connect(webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.navigate", { url });
await new Promise((r) => setTimeout(r, 2200));
const { result } = await send(ws, "Runtime.evaluate", { expression: EXTRACT, returnByValue: true });
console.log(JSON.stringify({ url, failures: result.value }, null, 2));
ws.close();
await closeTab(targetId);
