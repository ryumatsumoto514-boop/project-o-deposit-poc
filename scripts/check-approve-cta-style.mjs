import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
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

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify({ kolRef: "cryptoqueen", mockIdentity: "email", draftAmount: "42.5", addressConfirmed: true }))});`,
});
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
await new Promise((r) => setTimeout(r, 2000));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btns = Array.from(document.querySelectorAll("button"));
      const target = btns.find(b => b.textContent.includes("Add ETH") || b.textContent.includes("Continue") || b.textContent.includes("Approve"));
      if (!target) return { error: "not found", all: btns.map(b => b.textContent.trim().slice(0,40)) };
      const cs = getComputedStyle(target);
      return {
        text: target.textContent.trim(),
        disabled: target.disabled,
        ariaDisabled: target.getAttribute("aria-disabled"),
        bg: cs.backgroundColor,
        color: cs.color,
        opacity: cs.opacity,
        cursor: cs.cursor,
        className: target.className,
      };
    })()
  `,
  returnByValue: true,
});
console.log(JSON.stringify(result.value, null, 2));

await closeTab(page.id);
