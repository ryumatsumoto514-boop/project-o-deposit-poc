import WebSocket from "ws";

const BASE = "https://projecto-blond.vercel.app";
const CDP = "http://127.0.0.1:9333";
const ROUTES = ["/deposit/confirm", "/deposit/approve"];
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

async function main() {
  const targets = await fetch(`${CDP}/json`).then((r) => r.json());
  const target = targets.find((t) => t.type === "page") ?? targets[0];
  const ws = await connect(target.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      await send(ws, "Emulation.setDeviceMetricsOverride", {
        width,
        height: 850,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await send(ws, "Page.navigate", { url: `${BASE}${route}` });
      await new Promise((r) => setTimeout(r, 2500));

      const result = await send(ws, "Runtime.evaluate", {
        expression: `
          (function() {
            const docWidth = document.documentElement.scrollWidth;
            const clientWidth = document.documentElement.clientWidth;
            let worst = null;
            document.querySelectorAll("body *").forEach((el) => {
              const r = el.getBoundingClientRect();
              if (r.right > clientWidth + 1) {
                if (!worst || r.right > worst.right) {
                  worst = { right: r.right, tag: el.tagName, cls: el.className?.toString().slice(0,100), text: el.textContent?.slice(0,80) };
                }
              }
            });
            return JSON.stringify({ docWidth, clientWidth, overflow: docWidth > clientWidth, worst });
          })()
        `,
        returnByValue: true,
      });
      console.log(route, "width=" + width, result.result.value);

      const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
      const fs = await import("node:fs");
      fs.mkdirSync("shots-out", { recursive: true });
      fs.writeFileSync(`shots-out/${route.replace(/\//g, "_")}-${width}.png`, Buffer.from(data, "base64"));
    }
  }
  ws.close();
}
main();
