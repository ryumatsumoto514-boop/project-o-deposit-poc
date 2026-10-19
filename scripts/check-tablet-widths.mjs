// Tablet-width (768px, 1024px) overflow/layout check — prior cycles only
// checked mobile (320-390px) and desktop (1280px); the md/lg Tailwind
// breakpoints in between were never exercised.
const BASE_URL = "https://projecto-blond.vercel.app";
const CDP = "http://127.0.0.1:9333";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const INJECT_WALLET = `
(function() {
  const ADDR = ${JSON.stringify(WALLET)};
  const CHAIN_ID = ${JSON.stringify(CHAIN_ID_HEX)};
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
    removeListener: (ev, cb) => {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter((l) => l !== cb);
    },
  };
})();
`;

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

const ROUTES = [
  { path: "/", seedFlow: null },
  { path: "/login?ref=kol_alex", seedFlow: null },
  { path: "/deposit", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET } },
  { path: "/deposit/approve", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true } },
  { path: "/deposit/confirm", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0" } },
];
const WIDTHS = [768, 1024];

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}

let anyFound = false;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await newTab();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width, height: 1024, deviceScaleFactor: 1, mobile: false,
    });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
    if (route.seedFlow) {
      await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
        source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(route.seedFlow))});`,
      });
    }
    await send(ws, "Page.navigate", { url: `${BASE_URL}${route.path}` });
    await new Promise((r) => setTimeout(r, 1800));

    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const docW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          const overflowers = Array.from(document.querySelectorAll("body *")).filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > clientW + 1 || r.width > clientW + 1;
          }).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right, w: el.getBoundingClientRect().width }));
          return { docW, clientW, overflow: docW > clientW + 1, overflowers: overflowers.slice(0, 5) };
        })()
      `,
      returnByValue: true,
    });

    const r = result.value;
    const tag = r.overflow ? "OVERFLOW" : "ok";
    if (r.overflow) anyFound = true;
    console.log(`${route.path} @ ${width}px -> ${tag} (scrollWidth=${r.docW} clientWidth=${r.clientW})`);
    if (r.overflow) console.log("  culprits:", JSON.stringify(r.overflowers));

    ws.close();
    await closeTab(page.id);
  }
}

console.log(anyFound ? "\nFOUND OVERFLOW ISSUES" : "\nNo overflow found at tablet widths.");
