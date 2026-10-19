// Overflow check for the amount-entry page (/deposit) at narrow mobile
// widths — prior check-overflow-wallet.mjs only covered /deposit/approve
// and /deposit/confirm, skipping this one.
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
  { path: "/deposit", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "", approvalMode: "exact", addressConfirmed: false } },
  { path: "/deposit", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "123456789.123456", approvalMode: "exact", addressConfirmed: false } },
];
const WIDTHS = [320, 360];

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
    const page = await res.json();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 1400, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(route.seedFlow))});`,
    });
    await send(ws, "Page.navigate", { url: BASE_URL + route.path });
    await new Promise((r) => setTimeout(r, 2200));
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = null, worstW = 0;
        document.querySelectorAll("body *").forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > worstW) { worstW = r.width; worst = el.outerHTML.slice(0,200); }
        });
        return JSON.stringify({sw, cw, overflow: sw > cw + 1, worst, bodyText: document.body.innerText.slice(0,100)});
      })()`,
      returnByValue: true,
    });
    console.log(width, route.path, JSON.stringify(route.seedFlow.draftAmount), result.value);
    await fetch(`${CDP}/json/close/${page.id}`);
  }
}
