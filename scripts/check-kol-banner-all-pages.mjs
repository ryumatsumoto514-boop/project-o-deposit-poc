// Confirms the KOL disclosure banner (SPEC.md requirement #5: "persistent
// disclosure banner" that "carries attribution through the whole deposit
// flow") actually renders on every step, not just the pages it's imported
// into. Seeds flow state + injects window.ethereum exactly like
// screenshot.mjs, then reads document.body.innerText via CDP instead of
// requiring visual screenshot inspection.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN = "0x66eee";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}
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
  const CHAIN_ID = ${JSON.stringify(CHAIN)};
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

const seedFlow = {
  kolRef: "kol_alex",
  mockIdentity: "google:demo.user",
  draftAmount: "25",
  approvalMode: "exact",
  addressConfirmed: true,
};

const pages = [
  `${BASE}/?ref=kol_alex`,
  `${BASE}/login`,
  `${BASE}/deposit`,
  `${BASE}/deposit/confirm`,
  `${BASE}/deposit/approve`,
];

for (const url of pages) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
    source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
  });
  await send(ws, "Page.navigate", { url });
  await new Promise(r => setTimeout(r, 2200));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText`,
    returnByValue: true,
  });
  const text = result.value || "";
  const hasBanner = /arrived via/i.test(text);
  console.log(url, "-> bannerPresent:", hasBanner);
  if (!hasBanner) {
    console.log("  [full text dump]", text.slice(0, 600));
  }
  ws.close();
  await closeTab(page.id);
}
