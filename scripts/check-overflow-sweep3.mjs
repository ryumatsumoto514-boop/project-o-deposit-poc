// Quick mobile-width horizontal-overflow sweep across all main routes.
import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const ROUTES = ["/", "/login", "/deposit", "/deposit/approve", "/deposit/confirm", "/deposit/status/overflow-sweep3-missing", "/overflow-sweep3-404"];

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
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
  await send(ws, "Page.navigate", { url: BASE + route });
  await new Promise((r) => setTimeout(r, 1800));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `(() => {
      const docW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      let worst = null, worstW = 0;
      document.querySelectorAll("*").forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > clientW + 1 && r.width > worstW) { worstW = r.width; worst = el.tagName + "." + el.className; }
      });
      return JSON.stringify({ docW, clientW, overflow: docW > clientW + 1, worst, worstRight: worst ? worstW : null });
    })()`,
    returnByValue: true,
  });
  console.log(route, result.value);
  ws.close();
  await closeTab(page.id);
}
