// Independent QA check (read-only): screenshot + measure the hydrated
// /deposit/approve screen on the LIVE site at 320px with a mocked wallet
// connected and flow state pre-seeded (sessionStorage), so the gas-banner /
// approval-scope-card layout actually renders instead of the login/reconnect
// shell that plain curl-based checks are stuck seeing.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37"; // known ~0 ETH on Arbitrum Sepolia -> exercises the lowGas banner
const CHAIN_ID_HEX = "0x66eee"; // 421614 Arbitrum Sepolia

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

const INJECT = `
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
  try {
    sessionStorage.setItem("exo_flow_state", JSON.stringify({
      kolRef: "kol_alex",
      mockIdentity: ADDR,
      draftAmount: "25",
      approvalMode: "exact",
      addressConfirmed: true,
    }));
  } catch (e) {}
})();
`;

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
const consoleErrors = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails));
  }
});
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 760, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT });
await send(ws, "Page.navigate", { url: `${BASE}/deposit/approve` });
await new Promise((r) => setTimeout(r, 3000));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const html = document.documentElement;
      const main = document.querySelector("main");
      const overflow = html.scrollWidth - html.clientWidth;
      const banners = Array.from(document.querySelectorAll(".banner-amber, .banner-red")).map(b => b.textContent.trim().slice(0, 90));
      const cards = Array.from(document.querySelectorAll('label')).map(l => {
        const r = l.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
      });
      const btn = document.querySelector('button.btn-primary');
      const btnRect = btn ? btn.getBoundingClientRect() : null;
      return {
        title: document.title,
        bodyOverflowPx: overflow,
        visibleText: main ? main.textContent.replace(/\\s+/g, " ").trim().slice(0, 400) : "NO MAIN",
        banners,
        radioLabelBoxes: cards,
        primaryButtonBox: btnRect ? { w: Math.round(btnRect.width), h: Math.round(btnRect.height), right: Math.round(btnRect.right) } : null,
        viewportWidth: window.innerWidth,
      };
    })()
  `,
  returnByValue: true,
});
console.log(JSON.stringify(result.value, null, 2));
console.log("CONSOLE_ERRORS:", JSON.stringify(consoleErrors));

const shotDir = "shots-out";
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 2, mobile: true });
const { data } = await send(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 320, height: 1500, scale: 1 } });
await import("node:fs/promises").then((fs) => fs.mkdir(shotDir, { recursive: true }).then(() => fs.writeFile(`${shotDir}/approve-320-connected-full.png`, Buffer.from(data, "base64"))));

await closeTab(page.targetId);
console.log("done");
