// One-off: measure live rendered tap-target sizes (WCAG 2.5.5 AAA wants
// >=44x44 CSS px) for interactive elements on key mobile flow screens.
import { newTab, closeTab, shot } from "./screenshot.mjs";

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

const BASE = "https://projecto-blond.vercel.app";
const PAGES = ["/", "/login", "/deposit"];

for (const path of PAGES) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.navigate", { url: `${BASE}${path}` });
  await new Promise((r) => setTimeout(r, 1500));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const els = Array.from(document.querySelectorAll("button, a, input, [role=button]"));
        return els.map(el => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            tag: el.tagName,
            text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
            w: Math.round(r.width),
            h: Math.round(r.height),
            visible: r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none",
          };
        }).filter(e => e.visible);
      })()
    `,
    returnByValue: true,
  });
  console.log(`\n=== ${path} ===`);
  for (const el of result.value) {
    const flag = (el.w < 44 || el.h < 44) ? "  <<< UNDER 44px" : "";
    console.log(`${el.tag} [${el.w}x${el.h}] "${el.text}"${flag}`);
  }
  await closeTab(page.id);
}
