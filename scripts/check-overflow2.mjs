import { newTab, closeTab } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";
const WIDTHS = [320, 360];

const ROUTES = [
  ["/deposit", { kolRef: null, mockIdentity: WALLET }],
  ["/deposit/approve", { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true }],
  ["/deposit/confirm", { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0" }],
];

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
const INJECT_WALLET = `
(function() {
  const ADDR = ${JSON.stringify(WALLET)};
  const CHAIN_ID = ${JSON.stringify(CHAIN_ID_HEX)};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: () => {}, removeListener: () => {},
  };
})();
`;

for (const width of WIDTHS) {
  for (const [route, seedFlow] of ROUTES) {
    const page = await newTab();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
    });
    await send(ws, "Page.navigate", { url: BASE_URL + route });
    await new Promise((r) => setTimeout(r, 2200));
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = null, worstW = 0;
        document.querySelectorAll("body *").forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > worstW) { worstW = r.width; worst = el.outerHTML.slice(0,150); }
        });
        return JSON.stringify({sw, cw, overflow: sw > cw + 1, worst});
      })()`,
      returnByValue: true,
    });
    console.log(width, route, result.value);
    await closeTab(page.id);
  }
}
