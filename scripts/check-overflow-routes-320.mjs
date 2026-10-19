const BASE_URL = "https://projecto-blond.vercel.app";
const CDP = "http://127.0.0.1:9333";
const WIDTH = 320;
const ROUTES = ["/", "/login", "/login?ref=kol_demo", "/deposit", "/deposit/confirm", "/deposit/approve"];

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
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: WIDTH, height: 800, deviceScaleFactor: 1, mobile: true });

  for (const route of ROUTES) {
    await send(ws, "Page.navigate", { url: `${BASE_URL}${route}` });
    await new Promise((r) => setTimeout(r, 2200));

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
                worst = { right: r.right, tag: el.tagName, cls: el.className?.toString().slice(0,100), text: el.textContent?.slice(0,60) };
              }
            }
          });
          return JSON.stringify({ docWidth, clientWidth, overflow: docWidth > clientWidth, worst });
        })()
      `,
      returnByValue: true,
    });
    console.log(`route=${route}:`, result.result.value);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
