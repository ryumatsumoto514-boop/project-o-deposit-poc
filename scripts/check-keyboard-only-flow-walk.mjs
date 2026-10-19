// Real end-to-end keyboard-only walk: types an amount and presses Tab/Space/
// Enter only (no mouse clicks, no seeded sessionStorage flow state) from a
// fresh /deposit load through confirm -> approve, logging the focused
// element and any console errors at each step. Prior cycles checked
// per-page tab order and focus-ring visibility in isolation (confirm,
// login, radio cards) but never drove the *actual* multi-page flow using
// only keyboard events the way a real keyboard-only user would.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
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

async function activeEl(ws) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function(){
        const el = document.activeElement;
        return { tag: el.tagName, type: el.type||null, text: (el.textContent||"").trim().slice(0,30), url: location.pathname };
      })()
    `,
    returnByValue: true,
  });
  return result.value;
}

async function pressKey(ws, key, code, vkCode, extra = {}) {
  await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vkCode, ...extra });
  await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vkCode, ...extra });
}
async function tab(ws) { await pressKey(ws, "Tab", "Tab", 9); await wait(120); }
async function enter(ws) { await pressKey(ws, "Enter", "Enter", 13); await wait(120); }
async function space(ws) { await pressKey(ws, " ", "Space", 32); await wait(120); }
async function typeText(ws, text) {
  for (const ch of text) {
    await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
    await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", text: ch, key: ch });
  }
  await wait(80);
}

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
const consoleErrors = [];
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Log.enable");
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value || a.description).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails.text));
  }
});
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });

console.log("== step 1: fresh /deposit load, no seeded state ==");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(2200);
console.log("url:", (await activeEl(ws)).url);

// Click the Connect Wallet button once (keyboard-only flow still needs the
// wallet session established; many real keyboard users do this with Enter
// on a focused button, which is what we do here instead of a mouse click).
await send(ws, "Runtime.evaluate", {
  expression: `
    (function(){
      const btn = Array.from(document.querySelectorAll("button")).find(b => /connect/i.test(b.textContent||""));
      if (btn) { btn.focus(); return true; }
      return false;
    })()
  `,
  returnByValue: true,
});
let cur = await activeEl(ws);
console.log("focused before connect:", JSON.stringify(cur));
if (/connect/i.test(cur.text || "")) {
  await enter(ws);
  await wait(1500);
}
console.log("url after connect attempt:", (await activeEl(ws)).url);

console.log("== step 2: tab to amount input, type amount, Tab+Enter on Continue ==");
await send(ws, "Runtime.evaluate", { expression: "document.body.focus();" });
let found = false;
for (let i = 0; i < 8; i++) {
  await tab(ws);
  cur = await activeEl(ws);
  console.log(`  tab ${i + 1}:`, JSON.stringify(cur));
  if (cur.tag === "INPUT" && cur.type === "number") { found = true; break; }
}
console.log("reached amount input via Tab:", found);
if (found) {
  await typeText(ws, "15.5");
  await tab(ws);
  cur = await activeEl(ws);
  console.log("  after typing + tab:", JSON.stringify(cur));
  await enter(ws);
  await wait(1500);
}
console.log("url after amount submit:", (await activeEl(ws)).url);

console.log("== step 3: on confirm, tab to checkbox, Space, tab to Continue, Enter ==");
await send(ws, "Runtime.evaluate", { expression: "document.body.focus();" });
found = false;
for (let i = 0; i < 8; i++) {
  await tab(ws);
  cur = await activeEl(ws);
  console.log(`  tab ${i + 1}:`, JSON.stringify(cur));
  if (cur.tag === "INPUT" && cur.type === "checkbox") { found = true; break; }
}
console.log("reached checkbox via Tab:", found);
if (found) {
  await space(ws);
  const { result: checkedNow } = await send(ws, "Runtime.evaluate", {
    expression: "document.activeElement.checked", returnByValue: true,
  });
  console.log("  checkbox checked after Space:", checkedNow.value);
  await tab(ws);
  cur = await activeEl(ws);
  console.log("  after tab to continue:", JSON.stringify(cur));
  await enter(ws);
  await wait(1500);
}
console.log("url after confirm submit:", (await activeEl(ws)).url);

console.log("== step 4: on approve, tab through radios + submit button ==");
await send(ws, "Runtime.evaluate", { expression: "document.body.focus();" });
for (let i = 0; i < 10; i++) {
  await tab(ws);
  cur = await activeEl(ws);
  console.log(`  tab ${i + 1}:`, JSON.stringify(cur));
}

console.log("console errors seen:", JSON.stringify(consoleErrors, null, 2));
await fetch(`${CDP}/json/close/${page.id}`);
