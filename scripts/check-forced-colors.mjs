// Checks how the live site renders under Windows High-Contrast / forced-colors
// mode (CDP Emulation.setEmulatedMedia forced-colors:active) — a media feature
// never emulated in any prior cycle (OVERNIGHT_LOG.md has zero mentions).
import fs from "node:fs";

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

const PAGES = [
  { name: "login", url: "https://projecto-blond.vercel.app/login" },
  { name: "approve", url: "https://projecto-blond.vercel.app/deposit/approve" },
];

for (const { name, url } of PAGES) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setEmulatedMedia", {
    features: [{ name: "forced-colors", value: "active" }],
  });
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send(ws, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 1800));

  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      JSON.stringify(Array.from(document.querySelectorAll('button, input, a, label, h1, h2, p')).slice(0, 60).map(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          type: el.getAttribute('type'),
          text: (el.textContent || '').trim().slice(0, 40),
          color: cs.color,
          bg: cs.backgroundColor,
          borderColor: cs.borderTopColor,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }))
    `,
    returnByValue: true,
  });
  fs.writeFileSync(`/tmp/forced-colors-${name}.json`, result.value);

  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`/tmp/forced-colors-${name}.png`, Buffer.from(data, "base64"));
  console.log(`[${name}] done`);
  ws.close();
  await closeTab(page.id);
}
