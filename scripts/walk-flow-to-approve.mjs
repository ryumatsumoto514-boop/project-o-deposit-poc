// Continues the real click-and-type walkthrough past confirm into the
// approve step, clicking "Approve & deposit" with an injected wallet that
// stubs eth_requestAccounts/eth_chainId but returns null for signing calls
// (e.g. eth_sendTransaction) — this exercises what the UI actually does
// when the wallet gives back a useless response instead of a tx hash or a
// clean rejection, which no prior raw-HTML/curl review could observe.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
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
async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

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

const consoleLog = [];

async function clickByText(ws, text, tag = "button, a") {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const els = Array.from(document.querySelectorAll(${JSON.stringify(tag)}));
        const target = els.find(el => el.textContent && el.textContent.trim().includes(${JSON.stringify(text)}));
        if (!target) return null;
        target.scrollIntoView({ block: "center" });
        const r = target.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()
    `,
    returnByValue: true,
  });
  if (!result.value) return false;
  const { x, y } = result.value;
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  return true;
}

async function typeInto(ws, selector, text) {
  await send(ws, "Runtime.evaluate", {
    expression: `(function(){ const el = document.querySelector(${JSON.stringify(selector)}); if(!el) return false; el.focus(); return true; })()`,
  });
  for (const ch of text) {
    await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
    await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", text: ch, key: ch });
  }
}

async function bodySnippet(ws, n = 600) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText.slice(0, ${n})`,
    returnByValue: true,
  });
  return result.value;
}
async function pathname(ws) {
  const { result } = await send(ws, "Runtime.evaluate", { expression: "location.pathname", returnByValue: true });
  return result.value;
}

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
    consoleLog.push({ type: msg.params.type, args: msg.params.args.map((a) => a.value ?? a.description).join(" ") });
  }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleLog.push({ type: "exception", args: msg.params.exceptionDetails.text });
  }
});

console.log("1) landing -> login");
await send(ws, "Page.navigate", { url: `${BASE}/?ref=kol_alex` });
await wait(2200);
await clickByText(ws, "Get started");
await wait(2200);
console.log("   path:", await pathname(ws));

console.log("2) click 'Continue with Google' to mock-login, wait for /deposit");
await clickByText(ws, "Continue with Google");
for (let i = 0; i < 6 && (await pathname(ws)) === "/login"; i++) await wait(800);
console.log("   path:", await pathname(ws));

console.log("2b) click 'Connect Browser wallet' to connect injected wallet");
await clickByText(ws, "Connect Browser wallet");
await wait(1500);
console.log("   body after connect click:", await bodySnippet(ws, 400));

console.log("3) enter amount 12.34, continue to confirm");
for (let i = 0; i < 10; i++) {
  const { result } = await send(ws, "Runtime.evaluate", { expression: `!!document.querySelector('#deposit-amount')`, returnByValue: true });
  if (result.value) break;
  await wait(500);
}
await typeInto(ws, "#deposit-amount", "12.34");
await wait(300);
const { result: valCheck } = await send(ws, "Runtime.evaluate", { expression: `document.querySelector('#deposit-amount')?.value`, returnByValue: true });
console.log("   amount field value before continue:", JSON.stringify(valCheck.value));
await clickByText(ws, "Continue");
await wait(1500);
console.log("   path:", await pathname(ws));

console.log("4) confirm page -> check address-confirmation checkbox, then click Continue to approve");
await send(ws, "Runtime.evaluate", {
  expression: `(function(){ const cb = document.querySelector('input[type=checkbox]'); if(!cb) return false; cb.click(); return cb.checked; })()`,
  returnByValue: true,
}).then((r) => console.log("   checkbox checked:", r.result.value));
await wait(300);
await clickByText(ws, "Continue");
await wait(1500);
console.log("   path:", await pathname(ws));
console.log("   body:", await bodySnippet(ws, 500));

console.log("5) approve page -> click 'Approve & deposit'");
await clickByText(ws, "Approve & deposit");
await wait(3500);
console.log("   path:", await pathname(ws));
console.log("   body after click:", await bodySnippet(ws, 800));

await send(ws, "Page.captureScreenshot", {}).then(async (r) => {
  const fs = await import("fs");
  fs.writeFileSync("/tmp/approve-click-result.png", Buffer.from(r.data, "base64"));
});

console.log("\n=== console/exception log ===");
console.log(JSON.stringify(consoleLog, null, 2));

await send(ws, "Page.close");
ws.close();
process.exit(0);
