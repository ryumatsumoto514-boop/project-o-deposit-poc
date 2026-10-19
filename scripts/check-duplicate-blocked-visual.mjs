// Visually verifies the "Deposit already in progress" blocked screen on
// /deposit/approve — this exact exception state (brief's idempotency UX
// requirement) had been curl/API-verified many times but never screenshotted
// through a real hydrated browser. Requires a deposit record already created
// server-side for WALLET+AMOUNT (done separately via POST /api/deposits) so
// clicking "Approve & deposit" hits the pre-signature check and blocks before
// any real wallet signature is needed.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2];
const OUT_DIR = process.argv[3];
const WALLET = process.argv[4];
const AMOUNT = process.argv[5];

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
  if (!result.value) throw new Error(`click target not found/enabled: ${text}`);
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
        mockIdentity: "overnight-qa-visual-dup",
        draftAmount: ${JSON.stringify(AMOUNT)},
        approvalMode: "exact",
        addressConfirmed: true,
      }));
    })();
  `,
});

console.log("navigating to /deposit/approve ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
await wait(1200);
try {
  await clickText(ws, "Connect Injected");
  await wait(800);
} catch {
  console.log("  already connected or no connect button — continuing");
}
await wait(1500); // let the useBalance gas check resolve against the real chain
await shotTo(ws, `${OUT_DIR}/dup-before-click.png`);

console.log("clicking Approve & deposit ...");
await clickText(ws, "Approve & deposit");
await wait(1500);
await shotTo(ws, `${OUT_DIR}/dup-blocked-screen.png`);

const { result: bodyText } = await send(ws, "Runtime.evaluate", {
  expression: `document.body.innerText`,
  returnByValue: true,
});
console.log("--- page text snapshot ---");
console.log(bodyText.value.slice(0, 1200));

await fetch(`${CDP}/json/close/${page.id}`);
