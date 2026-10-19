// Tests whether rapidly double-clicking "Approve & deposit" on the live
// /deposit/approve page can fire two overlapping POST /api/deposits requests
// before React's disabled-button state update lands, which would attempt to
// create two deposit records for the same wallet+amount client-side (even if
// the server-side idempotency check ultimately blocks the second one).
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
// Relayer wallet — real funded Arbitrum Sepolia address, so the live gas
// balance check resolves to "has enough ETH" and doesn't block the button.
const WALLET = "0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6";
const CHAIN_ID_HEX = "0x66eee";
const AMOUNT = "7.25";

const INJECT_WALLET = `
(function() {
  const ADDR = ${JSON.stringify(WALLET)};
  const CHAIN_ID = ${JSON.stringify(CHAIN_ID_HEX)};
  let txCounter = 0;
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      if (method === "eth_sendTransaction") {
        txCounter++;
        await new Promise((r) => setTimeout(r, 50));
        return "0x" + String(txCounter).padStart(64, "0");
      }
      return null;
    },
    on: () => {},
    removeListener: () => {},
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

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Network.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(
    JSON.stringify({
      mockIdentity: WALLET,
      draftAmount: AMOUNT,
      addressConfirmed: true,
      kolRef: null,
      approvalMode: "exact",
    })
  )});`,
});

const postRequests = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Network.requestWillBeSent") {
    const r = msg.params.request;
    if (r.method === "POST" && r.url.includes("/api/deposits") && !r.url.includes("/check")) {
      postRequests.push({ url: r.url, postData: r.postData, t: Date.now() });
    }
  }
});

await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
await new Promise((r) => setTimeout(r, 3000)); // let gas balance fetch + layout settle

const debugState = await send(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({ url: location.href, bodyLen: document.body.textContent.length, h1: document.querySelector("h1")?.textContent, firstWords: document.body.textContent.slice(0,200) })`,
  returnByValue: true,
});
console.log("debug:", debugState.result.value);

const btnBox = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Approve & deposit"));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: btn.disabled, text: btn.textContent };
    })()
  `,
  returnByValue: true,
});
console.log("button state before click:", JSON.stringify(btnBox.result.value));

if (!btnBox.result.value || btnBox.result.value.disabled) {
  console.log("RESULT: button not found or disabled — cannot test, aborting.");
  await fetch(`${CDP}/json/close/${page.id}`);
  process.exit(0);
}

const { x, y } = btnBox.result.value;
// Fire two full click sequences back-to-back with no inter-click delay,
// simulating the worst case (a double-click or stuck key faster than a
// render frame), rather than a single realistic human click.
for (let i = 0; i < 2; i++) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}

await new Promise((r) => setTimeout(r, 2500)); // let any fired requests land

console.log(`POST /api/deposits requests observed: ${postRequests.length}`);
for (const r of postRequests) {
  console.log(" -", r.t, JSON.parse(r.postData || "{}").amount, JSON.parse(r.postData || "{}").userWallet);
}

const afterBox = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btn = Array.from(document.querySelectorAll("button")).find(b => /Approve|Checking|signature|Confirming|Starting|Done/.test(b.textContent));
      return btn ? { disabled: btn.disabled, text: btn.textContent } : null;
    })()
  `,
  returnByValue: true,
});
console.log("button state after clicks:", JSON.stringify(afterBox.result.value));

if (postRequests.length >= 2) {
  console.log("RESULT: BUG — two POST /api/deposits requests fired from a double-click before the UI disabled the button.");
} else if (postRequests.length === 1) {
  console.log("RESULT: OK — only one POST /api/deposits fired; the second click was absorbed (button disabled in time, or duplicate check blocked it).");
} else {
  console.log("RESULT: no POST /api/deposits observed at all — click may not have landed on the button, or an earlier step failed.");
}

await fetch(`${CDP}/json/close/${page.id}`);
