// Live-browser test: does clicking "Approve & deposit" and having the
// wallet reject the signature (the single most common real-world outcome
// on this screen) actually surface the friendly "You cancelled the
// signature request" copy baked into app/deposit/approve/page.tsx's catch
// block (via the /user rejected|denied transaction/i regex), or does it
// fall through to the generic "we couldn't confirm the outcome" message?
// This had only been verified by reading the regex/source, never by an
// actual CDP click against a wallet that really throws the rejection.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
// Use the overnight brief's funded relayer address so the live gas-balance
// check on this page actually passes (a fresh/unfunded mock address would
// get stuck on the "Add ETH to continue" disabled state before the signing
// click under test ever becomes reachable).
const WALLET = "0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6";

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
          if (method === "eth_sendTransaction") {
            const err = new Error("User rejected the request.");
            err.code = 4001;
            throw err;
          }
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

console.log("navigating to /deposit/approve ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
await wait(1500);
try {
  await clickText(ws, "Connect Injected");
  await wait(800);
} catch {
  console.log("  already connected or no connect button — continuing");
}
await wait(800);
{
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText`,
    returnByValue: true,
  });
  console.log("--- pre-click snapshot ---\n" + result.value);
}
console.log("clicking Approve & deposit ...");
await clickText(ws, "Approve & deposit");
await wait(2500);

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `document.body.innerText`,
  returnByValue: true,
});
const text = result.value;
console.log("--- visible text snapshot ---");
const hasCancelCopy = text.includes("You cancelled the signature request");
const hasGenericFallback = text.includes("We couldn't confirm the outcome");
console.log("Contains 'You cancelled the signature request':", hasCancelCopy);
console.log("Contains generic fallback 'We couldn't confirm the outcome':", hasGenericFallback);
if (!hasCancelCopy) {
  console.log("FULL TEXT:\n" + text);
}

await fetch(`${CDP}/json/close/${page.id}`);
