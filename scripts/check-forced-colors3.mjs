import { newTab, closeTab } from "./screenshot.mjs";
import fs from "node:fs";

const CDP = "http://127.0.0.1:9333";
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
const seedFlow = {
  mockIdentity: "qa-cycle",
  draftAmount: "250.5",
  address: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5",
  wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
};

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
});
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/deposit/approve" });
await new Promise((r) => setTimeout(r, 2200));

let shot = await send(ws, "Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`/tmp/forced-colors-approve-wallet.png`, Buffer.from(shot.data, "base64"));

// click the "unlimited" radio label text to flip selection state
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const el = Array.from(document.querySelectorAll("label")).find(l => l.textContent.includes("future deposits"));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + 20, y: r.y + 20 };
    })()
  `,
  returnByValue: true,
});
if (result.value) {
  const { x, y } = result.value;
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 500));
}
shot = await send(ws, "Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`/tmp/forced-colors-approve-wallet-unlimited.png`, Buffer.from(shot.data, "base64"));
console.log("clicked:", !!result.value);
ws.close();
await closeTab(page.id);
