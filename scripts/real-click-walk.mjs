// Real click-and-type walkthrough over one persistent CDP tab (not seeded
// sessionStorage, not curl) — exercises actual React event handlers across
// the landing -> login -> connect -> amount -> confirm -> approve flow with
// a fake injected window.ethereum, and captures console errors/exceptions
// at every step.
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
    expression: `
      (function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.focus();
        return true;
      })()
    `,
  });
  for (const ch of text) {
    await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
    await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", text: ch, key: ch });
  }
}

async function textContent(ws, selector) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`,
    returnByValue: true,
  });
  return result.value;
}

async function bodySnippet(ws) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText.slice(0, 400)`,
    returnByValue: true,
  });
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

console.log("1) landing with ?ref=kol_alex");
await send(ws, "Page.navigate", { url: `${BASE}/?ref=kol_alex` });
await wait(1800);
console.log("   clicking Get started");
let ok = await clickByText(ws, "Get started");
console.log("   clicked:", ok);
await wait(1500);
console.log("   url after click:", (await send(ws, "Runtime.evaluate", { expression: "location.pathname", returnByValue: true })).result.value);

console.log("2) login: click email sign-in");
ok = await clickByText(ws, "Continue with Email");
console.log("   clicked:", ok);
await wait(1500);
console.log("   url after click:", (await send(ws, "Runtime.evaluate", { expression: "location.pathname", returnByValue: true })).result.value);

console.log("3) on /deposit: connect wallet");
console.log("   body snippet:", await bodySnippet(ws));
ok = await clickByText(ws, "Connect");
console.log("   clicked connect:", ok);
await wait(1800);
console.log("   body snippet after connect:", await bodySnippet(ws));

console.log("4) type amount '12.3456789' (7 decimals - should trip inline validation)");
ok = await typeInto(ws, "#deposit-amount", "12.3456789");
await wait(300);
ok = await clickByText(ws, "Continue");
console.log("   clicked continue:", ok);
await wait(800);
console.log("   error text:", await textContent(ws, "#deposit-amount-error"));
console.log("   url (should still be /deposit if blocked):", (await send(ws, "Runtime.evaluate", { expression: "location.pathname", returnByValue: true })).result.value);

console.log("5) fix amount to valid '12.34' and continue");
await send(ws, "Runtime.evaluate", { expression: `document.querySelector('#deposit-amount').value = ''` });
ok = await typeInto(ws, "#deposit-amount", "12.34");
await wait(300);
ok = await clickByText(ws, "Continue");
console.log("   clicked continue:", ok);
await wait(1500);
console.log("   url after valid continue:", (await send(ws, "Runtime.evaluate", { expression: "location.pathname", returnByValue: true })).result.value);
console.log("   body snippet on confirm:", await bodySnippet(ws));

console.log("\n=== console/exception log across whole real-click session ===");
console.log(JSON.stringify(consoleLog, null, 2));

await send(ws, "Page.close");
ws.close();
process.exit(0);
