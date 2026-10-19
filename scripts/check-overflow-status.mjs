import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const ID = process.argv[2];
if (!ID) {
  console.error("usage: node scripts/check-overflow-status.mjs <depositId>");
  process.exit(1);
}

const WIDTHS = [320, 375];

for (const width of WIDTHS) {
  const page = await newTab();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 1e9);
      const h = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === id) {
          ws.removeEventListener("message", h);
          resolve(msg.result);
        }
      };
      ws.addEventListener("message", h);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: true });
  await send("Page.navigate", { url: `${BASE}/deposit/status/${ID}` });
  await new Promise((r) => setTimeout(r, 2500));
  const { result } = await send("Runtime.evaluate", {
    expression: `
      (function() {
        const docW = document.documentElement.scrollWidth;
        const bodW = document.body.scrollWidth;
        const vw = window.innerWidth;
        const overflowers = Array.from(document.querySelectorAll("*")).filter(el => el.scrollWidth > vw + 2).map(el => ({
          tag: el.tagName, cls: el.className, w: el.scrollWidth
        })).slice(0, 10);
        return JSON.stringify({ docW, bodW, vw, overflowers });
      })()
    `,
    returnByValue: true,
  });
  console.log(`width=${width}:`, result.value);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.mkdirSync("shots-out", { recursive: true });
  fs.writeFileSync(`shots-out/status-${width}.png`, Buffer.from(data, "base64"));
  ws.close();
  await closeTab(page.id);
}
