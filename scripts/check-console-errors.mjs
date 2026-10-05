import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

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
    on: () => {},
    removeListener: () => {},
  };
})();
`;

const jobs = [
  { url: `${BASE_URL}/`, seedFlow: null },
  { url: `${BASE_URL}/login`, seedFlow: null },
  { url: `${BASE_URL}/deposit`, seedFlow: { kolRef: null, mockIdentity: WALLET } },
  { url: `${BASE_URL}/deposit/confirm`, seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0" } },
  { url: `${BASE_URL}/deposit/approve`, seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true } },
  { url: `${BASE_URL}/deposit/status/does-not-exist-console-check`, seedFlow: null },
];

for (const job of jobs) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  const messages = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.exceptionThrown") {
      messages.push({ type: "exception", detail: msg.params.exceptionDetails.text || msg.params.exceptionDetails.exception?.description });
    }
    if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
      messages.push({ type: msg.params.type, detail: (msg.params.args || []).map(a => a.value || a.description).join(" ") });
    }
    if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
      messages.push({ type: "http", detail: `${msg.params.response.status} ${msg.params.response.url}` });
    }
  });
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Network.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
  if (job.seedFlow) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(job.seedFlow))});`,
    });
  }
  await send(ws, "Page.navigate", { url: job.url });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(job.url, "->", messages.length ? JSON.stringify(messages) : "clean");
  await closeTab(page.id);
}
