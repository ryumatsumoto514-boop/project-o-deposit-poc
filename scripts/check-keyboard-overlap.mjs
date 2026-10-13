// Simulates a mobile on-screen keyboard opening while the amount input is
// focused on /deposit — a category never grepped/tested before (checked:
// no "virtual keyboard"/"visualViewport" hits anywhere in OVERNIGHT_LOG.md).
// Approximates the keyboard by shrinking the emulated viewport height after
// focusing the input (how Android Chrome resizes the layout viewport; iOS
// Safari instead shrinks the *visual* viewport, which this doesn't model,
// but a layout-viewport shrink is the worse case for a `fixed`-element trap).
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
async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify({ kolRef: "kol_alex", mockIdentity: WALLET }))});`,
});
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await new Promise((r) => setTimeout(r, 1800));

// Must actually click "Connect Injected" to trigger wagmi's connect handshake —
// injecting window.ethereum alone does not establish a connected account.
const { result: connectBtn } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const els = Array.from(document.querySelectorAll("button, a"));
      const target = els.find(el => el.textContent && /^Connect /.test(el.textContent.trim()) && !el.disabled);
      if (!target) return null;
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()
  `,
  returnByValue: true,
});
if (connectBtn.value) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: connectBtn.value.x, y: connectBtn.value.y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: connectBtn.value.x, y: connectBtn.value.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 900));
}

await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount")?.focus()`,
});
await new Promise((r) => setTimeout(r, 200));

// Simulate the keyboard covering ~45% of the screen (typical iOS/Android split).
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 464, deviceScaleFactor: 2, mobile: true });
await new Promise((r) => setTimeout(r, 400));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const btn = Array.from(document.querySelectorAll("button")).find(b => /continue/i.test(b.textContent || ""));
      const vh = window.innerHeight;
      const ir = input ? input.getBoundingClientRect() : null;
      const br = btn ? btn.getBoundingClientRect() : null;
      return {
        vh,
        inputVisible: ir ? (ir.top >= 0 && ir.bottom <= vh) : null,
        inputRect: ir ? { top: ir.top, bottom: ir.bottom } : null,
        continueFound: !!btn,
        continueVisible: br ? (br.top >= 0 && br.bottom <= vh) : null,
        continueRect: br ? { top: br.top, bottom: br.bottom } : null,
        activeElementIsInput: document.activeElement && document.activeElement.id === "deposit-amount",
      };
    })()
  `,
  returnByValue: true,
});

console.log(JSON.stringify(result.value, null, 2));

ws.close();
await closeTab(page.id);
