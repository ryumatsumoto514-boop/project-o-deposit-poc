// Measures actual header horizontal overflow (scrollWidth vs clientWidth)
// with a wallet connected, across the range where the gas/network/wallet
// pill row is most cramped (360-768px), rather than eyeballing screenshots.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_ID_HEX = "0x66eee";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
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
  const ADDR = ${JSON.stringify(WALLET)};
  const CHAIN_ID = ${JSON.stringify(CHAIN_ID_HEX)};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: () => {},
    removeListener: () => {},
  };
})();
`;

const widths = [600, 630, 639, 640, 660, 700, 768];
for (const width of widths) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 600, deviceScaleFactor: 1, mobile: width < 640 });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
  await send(ws, "Page.navigate", { url: `${BASE}/deposit` });
  await new Promise((r) => setTimeout(r, 1600));
  // Click "Continue with connected wallet" if present (login gate), then revisit /deposit
  const clickRes = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const els = Array.from(document.querySelectorAll("button, a"));
        const target = els.find(el => el.textContent && el.textContent.includes("connected wallet"));
        if (!target) return false;
        target.click();
        return true;
      })()
    `,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 1500));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const header = document.querySelector("header");
        if (!header) return { error: "no header" };
        const sw = header.scrollWidth, cw = header.clientWidth;
        const pills = Array.from(header.querySelectorAll("*")).filter(el => el.children.length === 0 && el.textContent.trim());
        return {
          scrollWidth: sw,
          clientWidth: cw,
          overflow: sw - cw,
          bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          html: header.outerHTML.slice(0, 50),
        };
      })()
    `,
    returnByValue: true,
  });
  console.log(width, clickRes.result?.value, JSON.stringify(result.value));
  await closeTab(page.targetId);
}
