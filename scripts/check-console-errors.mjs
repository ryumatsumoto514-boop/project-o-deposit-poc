// Walks key live routes over raw CDP, capturing console.error/warn,
// uncaught exceptions, and any network response >= 400 — a category not
// explicitly checked by prior review cycles (those used curl on raw HTML,
// or screenshots, but not console/network capture).
const CDP = "http://127.0.0.1:9333";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
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

const pages = [
  "https://projecto-blond.vercel.app/",
  "https://projecto-blond.vercel.app/?ref=kol_alex",
  "https://projecto-blond.vercel.app/login",
  "https://projecto-blond.vercel.app/deposit",
  "https://projecto-blond.vercel.app/deposit/confirm",
  "https://projecto-blond.vercel.app/deposit/approve",
  "https://projecto-blond.vercel.app/deposit/status/nonexistent-id",
];

for (const url of pages) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  const consoleMsgs = [];
  const failedReqs = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled") {
      const p = msg.params;
      if (p.type === "error" || p.type === "warning") {
        consoleMsgs.push({ type: p.type, text: (p.args || []).map(a => a.value ?? a.description ?? "").join(" ") });
      }
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleMsgs.push({ type: "exception", text: msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text });
    }
    if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
      failedReqs.push({ url: msg.params.response.url, status: msg.params.response.status });
    }
  });
  await send(ws, "Network.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Page.enable");
  await send(ws, "Page.navigate", { url });
  await new Promise(r => setTimeout(r, 3000));
  console.log("=== " + url + " ===");
  console.log("console/exceptions:", JSON.stringify(consoleMsgs));
  console.log("failed requests:", JSON.stringify(failedReqs));
  ws.close();
  await closeTab(page.id);
}
