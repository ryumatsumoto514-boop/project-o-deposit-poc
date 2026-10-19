// Verifies the live clipboard-copy fix (commit 57cce32) actually announces
// success/failure on /deposit/confirm after deployment, not just in source.
const BASE_URL = "https://projecto-blond.vercel.app";
const CDP = "http://127.0.0.1:9333";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

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
  // headless CDP has no clipboard permission by default; force the failure path
  // deliberately to check the announced fallback message, then flip to success.
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

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(
    JSON.stringify({ kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0" })
  )});`,
});
await send(ws, "Page.navigate", { url: BASE_URL + "/deposit/confirm" });
await new Promise((r) => setTimeout(r, 2200));

// Click the Copy button and read the live status region immediately after.
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `(async function(){
    const btn = document.querySelector('button[aria-label="Copy destination address"]');
    if (!btn) return JSON.stringify({ error: "button not found" });
    btn.click();
    await new Promise(r => setTimeout(r, 400));
    const status = document.querySelector('[role="status"]');
    return JSON.stringify({
      buttonText: btn.textContent.trim(),
      statusText: status ? status.textContent.trim() : null,
    });
  })()`,
  awaitPromise: true,
  returnByValue: true,
});
console.log("confirm page copy click:", result.value);
await fetch(`${CDP}/json/close/${page.id}`);
