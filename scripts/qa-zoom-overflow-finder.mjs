const CDP = "http://127.0.0.1:9333";
async function newTab() { return (await fetch(`${CDP}/json/new`, { method: "PUT" })).json(); }
async function closeTab(id) { await fetch(`${CDP}/json/close/${id}`); }
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
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/" });
await new Promise((r) => setTimeout(r, 1500));
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      document.documentElement.style.fontSize = "200%";
      const all = document.querySelectorAll("body *");
      const offenders = [];
      all.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.right > 391 && r.width > 5) {
          offenders.push({ tag: el.tagName, cls: el.className?.toString().slice(0,60), text: (el.textContent||"").trim().slice(0,40), right: Math.round(r.right), width: Math.round(r.width) });
        }
      });
      offenders.sort((a,b)=>b.right-a.right);
      return offenders.slice(0, 15);
    })()
  `,
  returnByValue: true,
});
console.log(JSON.stringify(result.value, null, 2));
await closeTab(page.id);
