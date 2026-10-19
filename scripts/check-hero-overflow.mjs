const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const CDP = "http://127.0.0.1:9333";
const WIDTHS = [1024, 1100, 1180, 1280];

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

  for (const width of WIDTHS) {
    await send(ws, "Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
    await new Promise((r) => setTimeout(r, 1800));

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
                worst = { right: Math.round(r.right), tag: el.tagName, cls: el.className?.toString().slice(0,80), text: el.textContent?.slice(0,60) };
              }
            }
          });
          return JSON.stringify({ docWidth, clientWidth, overflow: docWidth > clientWidth, worst });
        })()
      `,
      returnByValue: true,
    });
    console.log(width, result.result.value);
  }
  ws.close();
}
main();
