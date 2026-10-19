const BASE_URL = "https://projecto-blond.vercel.app";
const WIDTHS = [320, 375];
const ROUTES = ["/", "/login", "/deposit", "/deposit/confirm", "/deposit/approve"];
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

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
    const page = await res.json();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.navigate", { url: BASE_URL + route });
    await new Promise((r) => setTimeout(r, 2500));
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = null, worstW = 0;
        document.querySelectorAll("body *").forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > worstW) { worstW = r.width; worst = el.outerHTML.slice(0,200); }
        });
        return JSON.stringify({sw, cw, overflow: sw > cw + 1, worst});
      })()`,
      returnByValue: true,
    });
    console.log(width, route, result.value);
    await fetch(`${CDP}/json/close/${page.id}`);
  }
}
