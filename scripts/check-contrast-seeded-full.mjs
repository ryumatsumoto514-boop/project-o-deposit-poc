// Seeds wallet + flow state, then runs the real-rendered WCAG contrast
// extractor (same math as check-contrast-live.mjs) against deposit/confirm/
// approve pages, which check-contrast-live.mjs alone can't reach because
// they redirect without a connected wallet + seeded flow state.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

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

const pages = [
  {
    url: `${BASE}/deposit`,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo-reviewer@exchangeo.test", draftAmount: "", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/confirm`,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo-reviewer@exchangeo.test", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/approve`,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo-reviewer@exchangeo.test", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: true },
  },
];

for (const p of pages) {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  const page = await res.json();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (function() {
        const ADDR = ${JSON.stringify(WALLET)};
        window.ethereum = {
          isMetaMask: true,
          request: async ({ method }) => {
            if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
            if (method === "eth_chainId") return "0x66eee";
            if (method === "net_version") return "421614";
            return null;
          },
          on: () => {},
          removeListener: () => {},
        };
        sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(p.seedFlow))});
      })();
    `,
  });
  await send(ws, "Page.navigate", { url: p.url });
  await new Promise((r) => setTimeout(r, 2200));
  const { result } = await send(ws, "Runtime.evaluate", { expression: EXTRACT, returnByValue: true });
  console.log(JSON.stringify({ url: p.url, failures: result.value }, null, 2));
  ws.close();
  await fetch(`${CDP}/json/close/${page.id}`);
}
