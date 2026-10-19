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

// Click "Connect" button
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

await clickByText("Connect");
await new Promise((r) => setTimeout(r, 1000));

async function testAmount(val) {
  await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const input = document.getElementById("deposit-amount");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, ${JSON.stringify(val)});
        input.dispatchEvent(new Event("input", { bubbles: true }));
      })()
    `,
  });
  await clickByText("Continue");
  await new Promise((r) => setTimeout(r, 300));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const err = document.getElementById("deposit-amount-error");
        const input = document.getElementById("deposit-amount");
        return JSON.stringify({ url: location.pathname, inputValue: input ? input.value : null, error: err ? err.textContent : null });
      })()
    `,
    returnByValue: true,
  });
  console.log(`input "${val}" ->`, result.value);
}

for (const v of ["1e5", "-5", "1,000.50", "0", "99999999999999999999", "5.1234567", "   10  ", "10.5.5", "٥"]) {
  await testAmount(v);
}

ws.close();
await closeTab(page.id);
