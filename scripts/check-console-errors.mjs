// One-off QA: capture browser console errors / uncaught exceptions across the
// live flow (curl-based reviews can't see these — they only see server HTML).
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

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
    removeListener: () => {},
  };
})();
`;

async function check(url, seedFlow) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  const messages = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
      messages.push({ type: msg.params.type, text: msg.params.args.map(a => a.value ?? a.description ?? "").join(" ") });
    }
    if (msg.method === "Runtime.exceptionThrown") {
      messages.push({ type: "exception", text: msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description ?? "") });
    }
  });
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
  if (seedFlow) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
    });
  }
  await send(ws, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(`\n=== ${url} ===`);
  if (messages.length === 0) console.log("  (no console errors/warnings/exceptions)");
  for (const m of messages) console.log(`  [${m.type}] ${m.text.slice(0, 300)}`);
  ws.close();
  await closeTab(page.id);
}

const jobs = [
  [`${BASE_URL}/`, null],
  [`${BASE_URL}/?ref=kol_alex`, null],
  [`${BASE_URL}/login`, null],
  [`${BASE_URL}/deposit`, { kolRef: null, mockIdentity: WALLET }],
  [`${BASE_URL}/deposit/confirm`, { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0" }],
  [`${BASE_URL}/deposit/approve`, { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true }],
  [`${BASE_URL}/deposit/status/does-not-exist-123`, null],
];

for (const [url, seedFlow] of jobs) {
  try {
    await check(url, seedFlow);
  } catch (e) {
    console.error(`  [error] ${url}:`, e.message);
  }
}
