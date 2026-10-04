// Quick functional check: horizontal overflow at narrow mobile widths on
// public (no-wallet-required) routes of the live production site.
import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const ROUTES = ["/", "/login", "/deposit/status/nonexistent-id", "/no-such-route"];
const WIDTHS = [320, 375];

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
    const page = await newTab();
    const ws = await connect(page.webSocketDebuggerUrl);
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width, height: 800, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.navigate", { url: BASE_URL + route });
    await new Promise((r) => setTimeout(r, 1800));
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        let worst = null, worstW = 0;
        document.querySelectorAll("body *").forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > cw + 1 && r.width > worstW) { worstW = r.width; worst = el.outerHTML.slice(0,120); }
        });
        return JSON.stringify({sw, cw, overflow: sw > cw + 1, worst});
      })()`,
      returnByValue: true,
    });
    console.log(width, route, result.value);
    await closeTab(page.id);
  }
}
