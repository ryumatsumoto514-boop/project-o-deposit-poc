// Rendered-contrast check (real getComputedStyle, composited bg) on live
// pages that require a mocked wallet + seeded flow state to reach their
// interesting visual states (warning/error banners, stepper, etc.) —
// check-contrast-live.mjs alone can't reach these since it navigates with
// no wallet, so those pages just show their loading/empty shell.
const CDP = "http://127.0.0.1:9333";

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

const INJECT_WALLET = (wallet, chainIdHex) => `
(function() {
  const ADDR = ${JSON.stringify(wallet)};
  const CHAIN_ID = ${JSON.stringify(chainIdHex)};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: () => {},
    removeListener: () => {},
  };
})();
`;

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
        text: text.slice(0, 70),
        tag: el.tagName,
        className: el.className && el.className.slice ? el.className.slice(0, 90) : "",
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

const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_HEX = "0x66eee";
const BASE = "https://projecto-blond.vercel.app";

const pages = [
  { url: `${BASE}/deposit/approve`, seedFlow: { mockIdentity: "google:demo.user", draftAmount: "125.50", kolRef: "kol_alex", approvalMode: "exact", addressConfirmed: true } },
  { url: `${BASE}/deposit/confirm`, seedFlow: { mockIdentity: "google:demo.user", draftAmount: "125.50", kolRef: "kol_alex", approvalMode: "exact" } },
  { url: `${BASE}/deposit`, seedFlow: { mockIdentity: "google:demo.user", kolRef: "kol_alex" } },
];

for (const p of pages) {
  const { targetId, webSocketDebuggerUrl } = await newTab();
  const ws = await connect(webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET(WALLET, CHAIN_HEX) });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(p.seedFlow))});` });
  await send(ws, "Page.navigate", { url: p.url });
  await new Promise((r) => setTimeout(r, 3200));
  const { result } = await send(ws, "Runtime.evaluate", { expression: EXTRACT, returnByValue: true });
  console.log(JSON.stringify({ url: p.url, failures: result.value }, null, 2));
  ws.close();
  await closeTab(targetId);
}
