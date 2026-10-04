// Measures real rendered bounding-box size of every interactive element
// (button, a, input, select, textarea, [role=button]) at mobile viewport
// width, to check against the 44x44 CSS px minimum tap-target guideline
// (WCAG 2.5.5 / Apple HIG). Uses chrome-headless-shell over CDP on 9333.
const CDP = "http://127.0.0.1:9333";
const BASE = process.argv[2] || "https://projecto-blond.vercel.app";
const ROUTES = ["/", "/login", "/deposit", "/deposit/confirm", "/deposit/approve"];

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

const SEED_FLOW = {
  step: "confirm",
  userWallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
  amount: "25",
  destinationAccount: "0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6",
  approvalMode: "exact",
};

for (const route of ROUTES) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: 375, height: 812, deviceScaleFactor: 2, mobile: true,
  });
  if (route.startsWith("/deposit/confirm") || route.startsWith("/deposit/approve")) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(SEED_FLOW))});`,
    });
  }
  await send(ws, "Page.navigate", { url: BASE + route });
  await new Promise((r) => setTimeout(r, 1400));

  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      JSON.stringify(Array.from(document.querySelectorAll('button, a, input, select, textarea, [role=button]'))
        .filter(el => {
          const cs = getComputedStyle(el);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
        })
        .map(el => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40),
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        }))
    `,
    returnByValue: true,
  });
  const els = JSON.parse(result.value || "[]");
  console.log(`\n=== ${route} (${els.length} interactive elements) ===`);
  for (const el of els) {
    const small = el.w < 44 || el.h < 44;
    console.log(`${small ? "SMALL" : "ok   "} ${el.w}x${el.h}  <${el.tag}> "${el.text}"`);
  }
  await closeTab(page.id);
}
