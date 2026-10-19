// Isolated test: does clicking the "unlimited" approval-scope radio on
// /deposit/approve actually select it, independent of the flow-walk's
// earlier steps (ruling out stale-coordinate timing from the async gas
// check banner insertion)?
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
        addressConfirmed: true,
      }));
    })();
  `,
});

console.log("navigating directly to /deposit/approve ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
console.log("waiting 4s for wallet connect + real gas-balance RPC check to fully settle ...");
await wait(4000);
await shotTo(ws, `${OUT_DIR}/radio-0-settled.png`);

console.log("reading current radio checked-state + fieldset disabled state ...");
const { result: before } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){
    const els = document.querySelectorAll('input[type=radio]');
    const fs = document.querySelector('fieldset');
    return {
      count: els.length,
      checked: Array.from(els).map(e => e.checked),
      disabled: fs ? fs.disabled : null,
    };
  })()`,
  returnByValue: true,
});
console.log("before click:", JSON.stringify(before.value));

console.log("clicking second radio (unlimited) ...");
const { result: radio } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){const els=document.querySelectorAll('input[type=radio]'); const el=els[1]; if(!el) return null; el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  returnByValue: true,
});
if (!radio.value) throw new Error("radio[1] not found");
await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x: radio.value.x, y: radio.value.y, button: "left", clickCount: 1 });
await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x: radio.value.x, y: radio.value.y, button: "left", clickCount: 1 });
await wait(500);
await shotTo(ws, `${OUT_DIR}/radio-1-after-click.png`);

const { result: after } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){
    const els = document.querySelectorAll('input[type=radio]');
    return { checked: Array.from(els).map(e => e.checked) };
  })()`,
  returnByValue: true,
});
console.log("after click:", JSON.stringify(after.value));

await fetch(`${CDP}/json/close/${page.id}`);
