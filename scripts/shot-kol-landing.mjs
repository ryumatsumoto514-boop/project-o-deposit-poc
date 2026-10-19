// Visual check (not just curl+HTMLParser) of the KOL disclosure banner on
// the landing page and the wallet-role labeling on /deposit, since many
// recent review cycles only fetched raw HTML for these routes.
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

console.log("navigating to / with ?ref=kol_alex ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/?ref=kol_alex` });
await wait(1500);
await shotTo(ws, `${OUT_DIR}/kol-landing-full.png`, true);

await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });

console.log("navigating to /deposit (with wallet injected + flow seeded) to see WalletRoles ...");
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
        kolRef: "kol_alex",
        mockIdentity: "demo-reviewer@exchangeo.test",
        draftAmount: "",
        approvalMode: "exact",
        addressConfirmed: false,
      }));
    })();
  `,
});
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit` });
await wait(1500);
await shotTo(ws, `${OUT_DIR}/kol-deposit-roles.png`, true);

await fetch(`${CDP}/json/close/${page.id}`);
