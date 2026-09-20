// One-off QA: load several live routes, capture console errors/network failures.
const CDP = "http://127.0.0.1:9333";
const BASE = process.argv[2] || "https://projecto-blond.vercel.app";
const ROUTES = ["/", "/login", "/deposit", "/deposit/approve", "/deposit/confirm", "/deposit/status/c0a86659-0efe-46ca-9b45-8a45a19262ac"];

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

for (const route of ROUTES) {
  const res = await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" });
  const page = await res.json();
  const ws = await connect(page.webSocketDebuggerUrl);
  const errors = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
      errors.push(`HTTP ${msg.params.response.status} ${msg.params.response.url}`);
    }
  });
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Network.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.navigate", { url: BASE + route });
  await new Promise((r) => setTimeout(r, 2500));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: "document.documentElement.scrollWidth + 'x' + document.documentElement.clientWidth",
    returnByValue: true,
  });
  console.log(`\n=== ${route} === scrollWidth/clientWidth: ${result.value}`);
  errors.forEach((e) => console.log("  ", e));
  ws.close();
  await fetch(`${CDP}/json/close/${page.id}`);
}
