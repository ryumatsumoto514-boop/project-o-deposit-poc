const CDPURL = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";

async function newTab() {
  const res = await fetch(`${CDPURL}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDPURL}/json/close/${id}`);
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
    const timer = setTimeout(() => {
      ws.removeEventListener("message", handler);
      reject(new Error(`timeout waiting for ${method}`));
    }, 8000);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const INJECT_WALLET = `
(function() {
  const ADDR = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
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
`;

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.navigate", { url: BASE + "/deposit" });
await new Promise((r) => setTimeout(r, 1500));

async function clickByText(text) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const els = Array.from(document.querySelectorAll("button, a"));
        const target = els.find(el => el.textContent && el.textContent.includes(${JSON.stringify(text)}));
        if (!target) return null;
        target.click();
        return true;
      })()
    `,
    returnByValue: true,
  });
  return result.value;
}

await clickByText("connected wallet");
await new Promise((r) => setTimeout(r, 1200));
await send(ws, "Page.navigate", { url: BASE + "/deposit" });
await new Promise((r) => setTimeout(r, 1200));

const { result: debug1 } = await send(ws, "Runtime.evaluate", {
  expression: `JSON.stringify({ url: location.pathname, hasInput: !!document.getElementById("deposit-amount"), bodyText: document.body.innerText })`,
  returnByValue: true,
});
console.log("debug:", debug1.value);

// Set a known amount value, then focus the input for real.
await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "10");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    })()
  `,
});
await new Promise((r) => setTimeout(r, 200));

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

// Dispatch a real CDP mouse wheel event over the focused input, as a real scroll gesture would.
await send(ws, "Input.dispatchMouseEvent", {
  type: "mouseWheel",
  x,
  y,
  deltaX: 0,
  deltaY: -100,
});
await new Promise((r) => setTimeout(r, 300));

const { result: after } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const input = document.getElementById("deposit-amount");
      return JSON.stringify({ valueAfter: input.value });
    })()
  `,
  returnByValue: true,
});
console.log("After one wheel tick over focused input:", JSON.parse(after.value));

ws.close();
await closeTab(page.id);
