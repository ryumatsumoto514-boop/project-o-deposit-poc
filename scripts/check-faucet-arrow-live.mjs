// Verifies the "Open a testnet faucet" low-gas-banner link on the live
// production /deposit/approve page now renders the trailing "↗" marker
// that matches the Arbiscan link convention used on the status page
// (fixed in this cycle — the two faucet links were missing it).
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const UNFUNDED_ADDR = "0xfde11cac855dfa57c0f7b798ba7a881e71a0daa6";

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
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (function() {
      const ADDR = ${JSON.stringify(UNFUNDED_ADDR)};
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
        draftAmount: "25",
        approvalMode: "exact",
        addressConfirmed: true,
      }));
    })();
  `,
});

await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
await wait(1200);

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
  if (!result.value) return false;
  const { x, y } = result.value;
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  return true;
}
await clickText("Connect Injected");
await wait(2500);

const { result: state } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const links = Array.from(document.querySelectorAll('a'))
        .filter(a => a.textContent && a.textContent.includes("testnet faucet"))
        .map(a => a.textContent.trim());
      return { links, bodyHasGas: document.body.innerText.includes("gas") };
    })()
  `,
  returnByValue: true,
});
console.log(JSON.stringify(state.value, null, 2));

const { data: screenshot } = await send(ws, "Page.captureScreenshot", { format: "png" });
await import("fs").then((fs) => fs.writeFileSync(`/tmp/faucet-arrow-live.png`, Buffer.from(screenshot, "base64")));

ws.close();
await fetch(`${CDP}/json/close/${page.id}`);
