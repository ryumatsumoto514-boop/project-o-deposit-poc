const CDP = "http://127.0.0.1:9333";
const ID = "1b076e85-5e0b-4c59-a9bd-35099b95afa4";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
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

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.navigate", { url: `https://projecto-blond.vercel.app/deposit/status/${ID}` });
await new Promise((r) => setTimeout(r, 6000));

const fs = await import("node:fs");
fs.mkdirSync("shots-out", { recursive: true });

for (const [label, scrollY] of [["top", 0], ["mid", 650], ["bottom", 1300]]) {
  await send(ws, "Runtime.evaluate", { expression: `window.scrollTo(0, ${scrollY})` });
  await new Promise((r) => setTimeout(r, 400));
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`shots-out/stalled-${label}.png`, Buffer.from(data, "base64"));
  console.log(`wrote stalled-${label}.png`);
}
ws.close();
