// One-off: confirm the displayed home-page gas pill value actually matches
// the live /api/gas response, not just that both independently return 200.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";

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

const apiRes = await fetch(`${BASE}/api/gas`);
const apiJson = await apiRes.json();
console.log("API /api/gas:", apiJson);

const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send(ws, "Page.navigate", { url: `${BASE}/` });
await new Promise((r) => setTimeout(r, 2500));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const all = Array.from(document.querySelectorAll("*"));
      const el = all.find(e => e.children.length === 0 && /gwei/i.test(e.textContent || ""));
      return el ? el.textContent.trim() : null;
    })()
  `,
  returnByValue: true,
});
console.log("Displayed gas pill text:", result.value);
await send(ws, "Page.close");
ws.close();
process.exit(0);
