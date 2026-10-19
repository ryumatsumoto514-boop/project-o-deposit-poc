import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const wallet = "0xAbC1230000000000000000000000000000dEaD";

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

const routes = [
  { url: `${BASE}/`, seedFlow: null },
  { url: `${BASE}/login?ref=cyberwhale`, seedFlow: null },
  { url: `${BASE}/deposit`, seedFlow: { kolRef: "cyberwhale", mockIdentity: wallet } },
  {
    url: `${BASE}/deposit/confirm`,
    seedFlow: { kolRef: "cyberwhale", mockIdentity: wallet, draftAmount: "250.50", approvalMode: "exact" },
  },
  {
    url: `${BASE}/deposit/approve`,
    seedFlow: {
      kolRef: "cyberwhale",
      mockIdentity: wallet,
      draftAmount: "250.50",
      approvalMode: "exact",
      addressConfirmed: true,
    },
  },
];

const EXTRACT = `
(function() {
  function styleOf(el) {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className,
      text: (el.textContent || "").trim().slice(0, 30),
      borderRadius: cs.borderRadius,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      padding: cs.padding,
      color: cs.color,
      background: cs.backgroundColor,
      border: cs.borderWidth + " " + cs.borderColor,
    };
  }
  const sel = "button, a.btn-primary, a.btn-secondary, .btn-primary, .btn-secondary, h1, .banner-amber, .banner, [class*='banner']";
  return Array.from(document.querySelectorAll(sel)).map(styleOf);
})()
`;

async function run() {
  const results = {};
  for (const r of routes) {
    const page = await newTab();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    if (r.seedFlow) {
      await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
        source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(r.seedFlow))});`,
      });
    }
    await send(ws, "Page.navigate", { url: r.url });
    await new Promise((res) => setTimeout(res, 1600));
    const { result } = await send(ws, "Runtime.evaluate", { expression: EXTRACT, returnByValue: true });
    results[r.url] = result.value;
    ws.close();
    await closeTab(page.id);
  }
  console.log(JSON.stringify(results, null, 2));
}
run();
