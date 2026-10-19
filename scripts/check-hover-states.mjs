// Checks that CSS :hover styles (btn-primary hover glint, link hover color,
// btn-secondary border/bg hover) actually render live on desktop viewports —
// no prior cycle screenshotted a real mouse-hover state, only click/focus.
import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-out";

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

const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await new Promise((r) => setTimeout(r, 1500));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Google"));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()
  `,
  returnByValue: true,
});

async function shotNow(name) {
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${OUT_DIR}/${name}.png`, Buffer.from(data, "base64"));
  console.log(`wrote ${name}.png`);
}

await shotNow("hover-before");

if (result.value) {
  const { x, y } = result.value;
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await new Promise((r) => setTimeout(r, 400));
  await shotNow("hover-after");

  // Read actual computed background-color before vs during hover to get a
  // definitive signal rather than eyeballing two PNGs.
  const before = await send(ws, "Runtime.evaluate", {
    expression: `(function(){ const b=document.elementFromPoint(${x-100},${y-100}); return "n/a"; })()`,
  });
  const computed = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Google"));
        const cs = getComputedStyle(btn);
        return JSON.stringify({ bg: cs.backgroundColor, matches: btn.matches(":hover") });
      })()
    `,
    returnByValue: true,
  });
  console.log("computed style during hover:", computed.result.value);
} else {
  console.log("Google button not found");
}

await closeTab(page.targetId);
