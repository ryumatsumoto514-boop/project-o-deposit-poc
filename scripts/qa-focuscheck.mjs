const CDP = "http://127.0.0.1:9333";
const BASE = process.argv[2] || "https://projecto-blond.vercel.app";

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

const res = await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.navigate", { url: BASE + "/deposit" });
await new Promise((r) => setTimeout(r, 2000));

for (let i = 0; i < 6; i++) {
  await send(ws, "Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await new Promise((r) => setTimeout(r, 150));
}
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function(){
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return JSON.stringify({tag: el.tagName, cls: el.className, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, boxShadow: cs.boxShadow, ring: cs.getPropertyValue('--tw-ring-color')});
    })()
  `,
  returnByValue: true,
});
console.log(result.value);
const shot = await send(ws, "Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("/tmp/focus-check.png", Buffer.from(shot.data, "base64"));
ws.close();
await fetch(`${CDP}/json/close/${page.id}`);
