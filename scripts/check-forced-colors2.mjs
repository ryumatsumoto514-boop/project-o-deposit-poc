import fs from "node:fs";

const CDP = "http://127.0.0.1:9333";
async function newTab() {
  return (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
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

const seedFlow = {
  mockIdentity: "qa-cycle",
  draftAmount: "250.5",
  address: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5",
};

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setEmulatedMedia", {
  features: [{ name: "forced-colors", value: "active" }],
});
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
});
await send(ws, "Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/deposit/approve" });
await new Promise((r) => setTimeout(r, 1800));

const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
fs.writeFileSync(`/tmp/forced-colors-approve-seeded.png`, Buffer.from(data, "base64"));
console.log("done");
ws.close();
await closeTab(page.id);
