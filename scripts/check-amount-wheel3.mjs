// Live-browser test: does scrolling the mouse wheel over the focused
// amount input change its value despite the onWheel={blur} handler?
// Uses the proven INJECT_WALLET pattern from check-overflow-amount.mjs.
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });

console.log("navigating to /deposit ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(2500);

const { result: debug1 } = await send(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({ url: location.pathname, hasInput: !!document.getElementById("deposit-amount") })`,
  returnByValue: true,
});
console.log("debug:", debug1.value);

if (!JSON.parse(debug1.value).hasInput) {
  console.log("input not found — dumping body text");
  const { result: body } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText.slice(0,500)`,
    returnByValue: true,
  });
  console.log(body.value);
  ws.close();
  await fetch(`${CDP}/json/close/${page.id}`);
  process.exit(1);
}

await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "500");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    })()
  `,
});
await wait(200);

const { result: rect } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const r = input.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, activeId: document.activeElement && document.activeElement.id, valueBefore: input.value });
    })()
  `,
  returnByValue: true,
});
const { x, y, activeId, valueBefore } = JSON.parse(rect.value);
console.log("Before wheel — active element:", activeId, "value:", valueBefore);

await send(ws, "Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -100 });
await wait(300);

const { result: after1 } = await send(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({ value: document.getElementById("deposit-amount").value, activeId: document.activeElement && document.activeElement.id })`,
  returnByValue: true,
});
console.log("After ONE wheel-up tick:", after1.value);

ws.close();
await fetch(`${CDP}/json/close/${page.id}`);
