// Live-browser test: Chrome natively increments/decrements a focused
// type="number" input's value on mouse-wheel scroll, REGARDLESS of whether
// the spin-button arrows are hidden via CSS (app/deposit/page.tsx hides
// them with [-moz-appearance:textfield] / [&::-webkit-inner-spin-button]).
// Hiding the arrows is purely cosmetic — the underlying native wheel
// behavior is untouched unless the page calls preventDefault() on the
// wheel event. If untouched, a user who taps the amount field then scrolls
// the page (very plausible on mobile/trackpad) would silently change the
// exact deposit amount — directly undermining the "exact-amount approval"
// UX guarantee. Testing this for real on the live deployment rather than
// trusting the CSS alone.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

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
      sessionStorage.setItem("exo_flow_state", JSON.stringify({
        kolRef: null,
        mockIdentity: "demo-reviewer@exchangeo.test",
        draftAmount: "",
        approvalMode: "exact",
        addressConfirmed: false,
      }));
    })();
  `,
});

console.log("navigating to /deposit ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(1800);

const { result: debug1 } = await send(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({ url: location.pathname, hasInput: !!document.getElementById("deposit-amount") })`,
  returnByValue: true,
});
console.log("debug:", debug1.value);

await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "500");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    })()
  `,
});
await wait(200);

const { result: rect } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const r = input.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2, activeId: document.activeElement && document.activeElement.id, valueBefore: input.value });
    })()
  `,
  returnByValue: true,
});
const { x, y, activeId, valueBefore } = JSON.parse(rect.value);
console.log("Before wheel — active element:", activeId, "value:", valueBefore);

await send(ws, "Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -100 });
await wait(300);

const { result: after1 } = await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount").value`,
  returnByValue: true,
});
console.log("After ONE wheel-up tick:", after1.value);

await send(ws, "Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -100 });
await send(ws, "Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -100 });
await wait(300);

const { result: after3 } = await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount").value`,
  returnByValue: true,
});
console.log("After THREE total wheel-up ticks:", after3.value);

ws.close();
await fetch(`${CDP}/json/close/${page.id}`);
