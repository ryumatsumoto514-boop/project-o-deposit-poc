// Checks: after the keyboard is already open (visualViewport already
// shrunk) and the user submits an invalid amount, does the resulting error
// message push the Continue button out of view with no resize event to
// re-trigger the scrollIntoView fix from a270d1e?
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

await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount")?.focus()`,
});
await new Promise((r) => setTimeout(r, 200));

// Keyboard opens (visualViewport shrinks) -> existing fix scrolls Continue into view.
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 464, deviceScaleFactor: 2, mobile: true });
await new Promise((r) => setTimeout(r, 400));

const before = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btn = Array.from(document.querySelectorAll("button")).find(b => /continue/i.test(b.textContent || ""));
      const vh = window.innerHeight;
      const br = btn.getBoundingClientRect();
      return { vh, continueVisible: br.top >= 0 && br.bottom <= vh, continueTop: br.top };
    })()
  `,
  returnByValue: true,
});
console.log("BEFORE submit (keyboard open, no error yet):", JSON.stringify(before.result.value));

// Type an amount that exceeds the demo cap (triggers the longest error message)
// then submit — no resize event fires here, only the error text changing.
await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "999999999");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.form.requestSubmit();
    })()
  `,
});
await new Promise((r) => setTimeout(r, 300));

const after = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btn = Array.from(document.querySelectorAll("button")).find(b => /continue/i.test(b.textContent || ""));
      const err = document.getElementById("deposit-amount-error");
      const vh = window.innerHeight;
      const br = btn.getBoundingClientRect();
      return {
        vh,
        errorText: err ? err.textContent : null,
        continueVisible: br.top >= 0 && br.bottom <= vh,
        continueTop: br.top,
      };
    })()
  `,
  returnByValue: true,
});
console.log("AFTER submitting invalid amount (error now showing):", JSON.stringify(after.result.value));

ws.close();
await closeTab(page.id);
