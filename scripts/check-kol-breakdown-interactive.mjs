// Read-only live verification: does the deposit confirm/breakdown screen
// still show KOL attribution + wallet-role labels together, with a real
// KOL ref carried through sessionStorage (not kolRef: null like
// shot-flow-walk.mjs uses)? Own CDP tab, closed when done.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const OUT_DIR = process.argv[3] || "shots-out";
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
async function shotTo(ws, file) {
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  wrote ${file}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

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

const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log("navigating with real KOL ref param ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/?ref=kol_alex` });
await wait(1200);
await shotTo(ws, `${OUT_DIR}/kolcheck-landing.png`);

console.log("navigating to /deposit (kolRef should persist via session storage) ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(1200);
await shotTo(ws, `${OUT_DIR}/kolcheck-deposit-pre-connect.png`);

try {
  await clickText(ws, "Connect Browser wallet");
  await wait(900);
} catch {
  console.log("  already connected — skipping connect click");
}
await shotTo(ws, `${OUT_DIR}/kolcheck-deposit-connected.png`);

// Mock-login as Google if we landed on the sign-in step first.
try {
  await clickText(ws, "Continue with Google");
  await wait(900);
} catch {
  console.log("  no sign-in step present — already past it");
}
await shotTo(ws, `${OUT_DIR}/kolcheck-amount-step.png`);

// Fill the real amount input (#deposit-amount, type=number).
const { result: filled } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const el = document.getElementById('deposit-amount');
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '42.0');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `,
  returnByValue: true,
});
console.log("amount filled:", filled.value);
await wait(400);
await shotTo(ws, `${OUT_DIR}/kolcheck-amount-filled.png`);

console.log("clicking Continue to reach confirm/breakdown screen ...");
await clickText(ws, "Continue");
await wait(1000);
await shotTo(ws, `${OUT_DIR}/kolcheck-confirm-breakdown.png`);

// Dump visible text so we can check KOL banner + wallet-role labels + breakdown line items landed.
const { result: text } = await send(ws, "Runtime.evaluate", {
  expression: `document.body.innerText`,
  returnByValue: true,
});
console.log("----- confirm page visible text -----");
console.log(text.value);
console.log("----- end -----");

console.log("checking confirm checkbox, continuing to approve step ...");
const { result: cb } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){const el=document.querySelector('input[type=checkbox]'); if(!el) return null; el.scrollIntoView(); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  returnByValue: true,
});
if (cb.value) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
  await wait(300);
  await clickText(ws, "Continue");
  await wait(1000);
  await shotTo(ws, `${OUT_DIR}/kolcheck-approve-step.png`);

  console.log("submitting approval (exact amount, default radio) to reach live status tracker ...");
  try {
    await clickText(ws, "Approve");
    await wait(2500);
    await shotTo(ws, `${OUT_DIR}/kolcheck-status-tracker.png`);
    const { result: statusText } = await send(ws, "Runtime.evaluate", {
      expression: `document.body.innerText`,
      returnByValue: true,
    });
    console.log("----- status page visible text -----");
    console.log(statusText.value);
    console.log("----- end -----");
  } catch (e) {
    console.log("  could not find an Approve-style submit control:", e.message);
  }
} else {
  console.log("  confirm checkbox not found on this screen");
}

await send(ws, "Page.close");
console.log("done.");
