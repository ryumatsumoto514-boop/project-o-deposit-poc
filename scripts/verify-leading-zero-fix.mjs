// Verifies the live cb82291 fix: typing a leading-zero amount ("010.5")
// into the deposit amount field should normalize to "10.5" by the time it's
// echoed back on the confirm screen.
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

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
await wait(1500);

async function clickText(text) {
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

try {
  await clickText("Connect Injected");
  await wait(800);
} catch {
  console.log("  already connected or no connect button — continuing");
}

console.log("focusing amount field and typing 010.5 via real Input.insertText ...");
await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount").focus()`,
});
await send(ws, "Input.insertText", { text: "010.5" });
await wait(300);

const { result: fieldVal } = await send(ws, "Runtime.evaluate", {
  expression: `document.getElementById("deposit-amount").value`,
  returnByValue: true,
});
console.log("field value after typing:", JSON.stringify(fieldVal.value));

await clickText("Continue");
await wait(1200);

const { result: url } = await send(ws, "Runtime.evaluate", {
  expression: `location.pathname`,
  returnByValue: true,
});
console.log("landed on:", url.value);

const { result: bodyText } = await send(ws, "Runtime.evaluate", {
  expression: `document.body.innerText`,
  returnByValue: true,
});
const text = bodyText.value;
const match = text.match(/[\d.]+\s*USDC/g);
console.log("amount-looking strings on confirm page:", match);

await fetch(`${CDP}/json/close/${page.id}`);
