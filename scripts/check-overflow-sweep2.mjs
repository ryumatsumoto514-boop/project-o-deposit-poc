import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}
function send(ws, method, params = {}, sessionId) {
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
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const ADDR = "0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6";
const INJECT_WALLET = `
(function() {
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [${JSON.stringify(ADDR)}];
      if (method === "eth_chainId") return "0x66eee";
      if (method === "net_version") return "421614";
      return null;
    },
    on: () => {},
    removeListener: () => {},
  };
})();
`;

const routes = [
  "/",
  "/login",
  "/login?ref=cryptoKOL_sim",
  "/deposit",
  "/deposit/confirm",
  "/deposit/approve",
  "/deposit/status/demo",
  "/not-a-real-route",
];

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms)),
  ]);
}

for (const path of routes) {
  try {
    const page = await withTimeout(newTab(), 5000, "newTab");
    const ws = await withTimeout(connect(page.webSocketDebuggerUrl), 5000, "connect");
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
    await withTimeout(send(ws, "Page.navigate", { url: BASE + path }), 8000, "navigate");
    await new Promise((r) => setTimeout(r, 1800));
    const { result } = await withTimeout(send(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const sw = document.documentElement.scrollWidth;
          const iw = window.innerWidth;
          let worst = null;
          if (sw > iw) {
            const all = document.querySelectorAll('*');
            let maxRight = 0, el = null;
            for (const e of all) {
              const r = e.getBoundingClientRect();
              if (r.right > maxRight) { maxRight = r.right; el = e; }
            }
            worst = el ? (el.tagName + '.' + (el.className||'').toString().slice(0,60)) : null;
          }
          return JSON.stringify({ sw, iw, overflow: sw > iw, worst });
        })()
      `,
      returnByValue: true,
    }), 5000, "evaluate");
    console.log(path, result.value);
    await closeTab(page.id);
    ws.close();
  } catch (e) {
    console.log(path, "ERROR", e.message);
  }
}
