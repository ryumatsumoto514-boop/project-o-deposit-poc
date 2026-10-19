// Checks the deposit-not-found exception state (app/deposit/status/[id]/page.tsx)
// at a 320px-wide viewport for horizontal overflow, since prior cycles swept
// overflow at 320px on other screens but never on this specific exception state.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const FAKE_ID = "ghost-deposit-does-not-exist-000";

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

const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", {
  width: 320,
  height: 700,
  deviceScaleFactor: 1,
  mobile: true,
});

await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/status/${FAKE_ID}` });
await new Promise((r) => setTimeout(r, 14000));

const result = await send(ws, "Runtime.evaluate", {
  expression: `(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const overflowing = [];
    document.querySelectorAll("*").forEach(el => {
      if (el.scrollWidth > winWidth + 2) {
        overflowing.push({ tag: el.tagName, cls: el.className?.toString().slice(0,60), scrollWidth: el.scrollWidth });
      }
    });
    return JSON.stringify({ docWidth, winWidth, overflowCount: overflowing.length, overflowing: overflowing.slice(0,10) }, null, 2);
  })()`,
  returnByValue: true,
});
console.log(result.result.value);

const shot = await send(ws, "Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("/tmp/notfound-320.png", Buffer.from(shot.data, "base64"));
console.log("Screenshot saved to /tmp/notfound-320.png");
await send(ws, "Page.close").catch(() => {});
