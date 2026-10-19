// Mobile-landscape (short viewport height, e.g. phone rotated) check —
// prior cycles only tested portrait mobile (320-390 wide x tall) and
// tablet/desktop widths. A short+wide viewport can reveal sticky-footer
// or fixed-header elements covering content that never showed up before.
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
  { path: "/deposit/confirm", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0" } },
  { path: "/deposit/approve", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true } },
];
// iPhone SE landscape (667x375) and iPhone 12/13 landscape (812x375)
const SIZES = [{ w: 667, h: 375 }, { w: 812, h: 375 }];

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}

let anyFound = false;

for (const route of ROUTES) {
  for (const { w, h } of SIZES) {
    const page = await newTab();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width: w, height: h, deviceScaleFactor: 2, mobile: true,
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
          const docH = document.documentElement.scrollHeight;
          const clientH = window.innerHeight;
          // Check for fixed-position elements that might cover content
          // in a short viewport, and any primary CTA button hidden below
          // the fold without scroll affordance.
          const fixedEls = Array.from(document.querySelectorAll("body *")).filter(el => {
            const cs = getComputedStyle(el);
            return cs.position === "fixed" && el.getBoundingClientRect().height > 0;
          }).map(el => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, cls: el.className, top: r.top, bottom: r.bottom, h: r.height };
          });
          const overflowers = Array.from(document.querySelectorAll("body *")).filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > clientW + 1 || r.width > clientW + 1;
          }).map(el => ({ tag: el.tagName, cls: el.className, right: el.getBoundingClientRect().right, w: el.getBoundingClientRect().width }));
          return { docW, clientW, docH, clientH, overflow: docW > clientW + 1, overflowers: overflowers.slice(0, 5), fixedEls };
        })()
      `,
      returnByValue: true,
    });

    const r = result.value;
    const tag = r.overflow ? "H-OVERFLOW" : "ok";
    if (r.overflow) anyFound = true;
    console.log(`${route.path} @ ${w}x${h} -> ${tag} (scrollW=${r.docW} clientW=${r.clientW} scrollH=${r.docH} viewH=${r.clientH})`);
    if (r.overflow) console.log("  culprits:", JSON.stringify(r.overflowers));
    if (r.fixedEls.length) console.log("  fixed elements:", JSON.stringify(r.fixedEls));

    ws.close();
    await closeTab(page.id);
  }
}

console.log(anyFound ? "\nFOUND OVERFLOW ISSUES" : "\nNo horizontal overflow found at mobile-landscape widths.");
