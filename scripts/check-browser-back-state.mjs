// Walks login -> deposit -> confirm -> approve with a mocked injected wallet,
// then exercises the browser Back button (history.back()) twice to see
// whether client-side flow state survives real back-navigation or leaves a
// broken/blank screen. Captures console errors and exceptions throughout.
//
// Fixed 2026-10-13: the previous version clicked a nonexistent "Connect
// Injected" button and relied on stale localStorage from earlier CDP
// sessions to reach the amount step, so it never actually drove the real
// login -> deposit -> confirm -> approve path. This version clears storage,
// clicks "Sign in with Browser wallet" then "Continue with connected
// wallet" on /login (matching lib/format.ts's connectorLabel output), and
// uses the real #deposit-amount id selector.
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

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const consoleMsgs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
    consoleMsgs.push({ type: msg.params.type, text: (msg.params.args || []).map(a => a.value ?? a.description ?? "").join(" ") });
  }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleMsgs.push({ type: "exception", text: msg.params.exceptionDetails.text + " " + (msg.params.exceptionDetails.exception?.description || "") });
  }
});

await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (function() {
      const ADDR = ${JSON.stringify(WALLET)};
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
          if (method === "eth_chainId") return "0x66eee";
          if (method === "net_version") return "421614";
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    })();
  `,
});

async function shot(name) {
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(`/tmp/${name}.png`, Buffer.from(data, "base64"));
  console.log(`  wrote /tmp/${name}.png`);
}
async function url() {
  const { result } = await send(ws, "Runtime.evaluate", { expression: "location.href", returnByValue: true });
  return result.value;
}

console.log("clearing storage and loading /login fresh ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await wait(1000);
await send(ws, "Runtime.evaluate", { expression: "localStorage.clear(); sessionStorage.clear();" });
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await wait(1200);

console.log("signing in with browser wallet ...");
await clickText(ws, "Sign in with Browser wallet");
await wait(1000);
await clickText(ws, "Continue with connected wallet");
await wait(1000);
console.log("at:", await url());

console.log("filling amount ...");
await send(ws, "Runtime.evaluate", {
  expression: `(function(){const el=document.querySelector('#deposit-amount'); if(!el) return false; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(el,'25'); el.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`,
  returnByValue: true,
});
await wait(300);
await clickText(ws, "Continue");
await wait(1000);
console.log("at:", await url());
await shot("back-01-confirm");

console.log("checking confirm checkbox, continuing to approve ...");
await send(ws, "Runtime.evaluate", {
  expression: `(function(){const el=document.querySelector('input[type=checkbox]'); if(el) el.click();})()`,
});
await wait(300);
await clickText(ws, "Continue");
await wait(1000);
console.log("at:", await url());
await shot("back-02-approve");

console.log("pressing browser Back once (history.back) ...");
await send(ws, "Runtime.evaluate", { expression: "history.back()" });
await wait(1200);
console.log("after back #1 -> url:", await url());
await shot("back-03-after-back1");

console.log("pressing browser Back again ...");
await send(ws, "Runtime.evaluate", { expression: "history.back()" });
await wait(1200);
console.log("after back #2 -> url:", await url());
await shot("back-04-after-back2");

console.log("\nconsole errors/exceptions captured during whole run:", consoleMsgs.length);
for (const m of consoleMsgs) console.log(" -", m.type, ":", m.text.slice(0, 200));

await fetch(`${CDP}/json/close/${page.id}`);
