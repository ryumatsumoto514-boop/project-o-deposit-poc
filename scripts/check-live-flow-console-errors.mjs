// Click-walks the real live flow (home -> login -> amount -> confirm ->
// approve) over one continuous CDP session, capturing Runtime console
// errors/exceptions at every step. curl-only review cycles cannot observe
// this (they never execute client JS); this specifically targets runtime
// errors that only fire during real hydrated interaction.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";

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
async function clickText(ws, text) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const els = Array.from(document.querySelectorAll("button, a"));
        const target = els.find(el => el.textContent && el.textContent.trim().includes(${JSON.stringify(text)}) && !el.disabled);
        if (!target) return null;
        target.scrollIntoView();
        const r = target.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })()
    `,
    returnByValue: true,
  });
  if (!result.value) throw new Error(`click target not found: ${text}`);
  const { x, y } = result.value;
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push({ step: currentStep, kind: "console.error", args: msg.params.args.map((a) => a.value ?? a.description) });
  }
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push({ step: currentStep, kind: "exception", text: msg.params.exceptionDetails.text, desc: msg.params.exceptionDetails.exception?.description });
  }
});

await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (function() {
      const ADDR = ${JSON.stringify(WALLET)};
      const listeners = {};
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
          if (method === "eth_chainId") return "0x66eee";
          if (method === "net_version") return "421614";
          return null;
        },
        on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
        removeListener: () => {},
      };
    })();
  `,
});

let currentStep = "home";
console.log(`navigating to ${BASE_URL}/?ref=kol_alex ...`);
await send(ws, "Page.navigate", { url: `${BASE_URL}/?ref=kol_alex` });
await wait(1500);

currentStep = "login";
console.log("going to /login ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await wait(1200);

currentStep = "login-click-google";
try {
  await clickText(ws, "Continue with Google");
  await wait(1200);
} catch (e) {
  console.log("  Continue with Google click failed:", e.message);
}

currentStep = "deposit-amount";
console.log("at deposit amount step, filling amount ...");
await send(ws, "Runtime.evaluate", {
  expression: `
    (function(){
      const el = document.querySelector('input[inputmode="decimal"], input[type="text"], input[type="number"]');
      if (!el) return null;
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '42');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `,
  returnByValue: true,
});
await wait(500);
try {
  await clickText(ws, "Continue");
  await wait(1200);
} catch (e) {
  console.log("  Continue (amount) click failed:", e.message);
}

currentStep = "confirm";
{
  const { result: urlRes } = await send(ws, "Runtime.evaluate", { expression: "location.href", returnByValue: true });
  console.log("  URL before confirm step:", urlRes.value);
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.mkdirSync("/tmp/flowdbg", { recursive: true });
  fs.writeFileSync("/tmp/flowdbg/before-confirm.png", Buffer.from(data, "base64"));
}
console.log("at confirm step, checking checkbox ...");
const { result: cb } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){const el=document.querySelector('input[type=checkbox]'); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  returnByValue: true,
});
if (cb.value) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
  await wait(400);
}
try {
  await clickText(ws, "Continue");
  await wait(1200);
} catch (e) {
  console.log("  Continue (confirm) click failed:", e.message);
}

currentStep = "approve";
console.log("at approve step ...");
await wait(800);
{
  const { result: urlRes } = await send(ws, "Runtime.evaluate", { expression: "location.href", returnByValue: true });
  console.log("  URL at approve step:", urlRes.value);
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync("/tmp/flowdbg/approve.png", Buffer.from(data, "base64"));
}

console.log("\n--- RESULT ---");
console.log(`currentStep at end: ${currentStep}`);
console.log(`console/runtime errors captured: ${errors.length}`);
for (const e of errors) {
  console.log(JSON.stringify(e));
}
if (errors.length === 0) console.log("No console errors or unhandled exceptions observed during the full click-walk.");
process.exit(0);
