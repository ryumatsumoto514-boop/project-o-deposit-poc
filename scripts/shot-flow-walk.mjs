// Click-walks the real flow in one continuous CDP session (same pattern as
// shot-blocked.mjs) so wagmi's in-memory connection state survives
// client-side navigation, screenshotting /deposit/confirm and
// /deposit/approve along the way to pixel-verify the accent-color token
// swap (blue -> turquoise) on the radio cards / checkbox / stepper.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2];
const OUT_DIR = process.argv[3];
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
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

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
      sessionStorage.setItem("exo_flow_state", JSON.stringify({
        kolRef: null,
        mockIdentity: "demo-reviewer@exchangeo.test",
        draftAmount: "42.0",
        approvalMode: "exact",
        addressConfirmed: false,
      }));
    })();
  `,
});

console.log("navigating to /deposit ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(1200);
try {
  await clickText(ws, "Connect Injected");
  await wait(800);
} catch {
  console.log("  already connected — skipping");
}
console.log("clicking Continue (amount) ...");
await clickText(ws, "Continue");
await wait(900);
await shotTo(ws, `${OUT_DIR}/m-confirm-real.png`);

console.log("checking confirm checkbox, continuing to approve ...");
const { result: cb } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){const el=document.querySelector('input[type=checkbox]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  returnByValue: true,
});
if (!cb.value) throw new Error("confirm checkbox not found");
await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: cb.value.x, y: cb.value.y, button: "left", clickCount: 1 });
await wait(300);
await shotTo(ws, `${OUT_DIR}/m-confirm-checked.png`);
await clickText(ws, "Continue");
await wait(900);
await shotTo(ws, `${OUT_DIR}/m-approve-real.png`);

console.log("selecting 'unlimited' radio to verify amber selected-state still distinct ...");
const { result: radio } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){const els=document.querySelectorAll('input[type=radio]'); const el=els[1]; if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  returnByValue: true,
});
if (radio.value) {
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: radio.value.x, y: radio.value.y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: radio.value.x, y: radio.value.y, button: "left", clickCount: 1 });
  await wait(300);
  await shotTo(ws, `${OUT_DIR}/m-approve-unlimited.png`);
}

await fetch(`${CDP}/json/close/${page.id}`);
