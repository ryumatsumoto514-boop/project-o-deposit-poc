const BASE_URL = "https://projecto-blond.vercel.app";
const WIDTHS = [375, 414];
const ROUTES = ["/", "/?ref=kol_alex", "/login", "/deposit", "/deposit/confirm", "/deposit/approve", "/deposit/status/demo"];
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
    const consoleErrors = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
        consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(" "));
      }
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        consoleErrors.push(msg.params.entry.text);
      }
    });
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Log.enable");
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
    console.log("===", width, route);
    console.log(result.value);
    if (consoleErrors.length) console.log("CONSOLE:", JSON.stringify(consoleErrors));
    await fetch(`${CDP}/json/close/${page.id}`);
  }
}
