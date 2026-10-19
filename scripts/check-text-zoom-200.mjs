// Simulates a user's OS/browser "text-only zoom" (e.g. Firefox zoom text only,
// or an Android accessibility font-size boost) — NOT the viewport-narrowing
// reflow tests already covered by check-320-sweep.mjs / check-tablet-widths.mjs.
// This keeps the CSS viewport width fixed and only scales root font-size via
// `html { font-size: 200% }`, the way a real "zoom text only" feature works,
// then checks for (a) new horizontal overflow and (b) text clipped inside
// fixed-height containers (buttons, pills, banners) whose scrollHeight now
// exceeds clientHeight — a class of bug viewport-width reflow tests cannot
// catch, since those keep font-size constant and only shrink the viewport.
//
// Usage: node scripts/check-text-zoom-200.mjs <baseUrl>
// Requires chrome-headless-shell already running with --remote-debugging-port=9333.

const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";

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

const ROUTES = [
  { path: "/", seed: null },
  { path: "/login?ref=kol_alex", seed: null },
  {
    path: "/deposit",
    seed: { wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37", chainIdHex: "0x66eee", kolRef: "kol_alex" },
  },
  {
    path: "/deposit/confirm",
    seed: {
      wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
      chainIdHex: "0x66eee",
      kolRef: "kol_alex",
      draftAmount: "125.50",
    },
  },
  {
    path: "/deposit/approve",
    seed: {
      wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
      chainIdHex: "0x66eee",
      kolRef: "kol_alex",
      draftAmount: "125.50",
      confirmedAddress: true,
    },
  },
];

async function checkRoute(width, route) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width,
    height: 800,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  if (route.seed) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(route.seed))});`,
    });
  }
  await send(ws, "Page.navigate", { url: `${BASE_URL}${route.path}` });
  await new Promise((r) => setTimeout(r, 1300));

  // Baseline (no zoom) overflow state, then apply 200% text-only zoom.
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const before = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        document.documentElement.style.fontSize = "200%";
        const after = { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        const clipped = [];
        document.querySelectorAll("button, a, span, p, h1, h2, label, div").forEach((el) => {
          const cs = getComputedStyle(el);
          if (cs.overflow === "hidden" || cs.textOverflow === "ellipsis") {
            if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
              clipped.push({
                tag: el.tagName,
                text: (el.textContent || "").trim().slice(0, 40),
                scrollH: el.scrollHeight, clientH: el.clientHeight,
                scrollW: el.scrollWidth, clientW: el.clientWidth,
              });
            }
          }
        });
        return { before, after, clipped };
      })()
    `,
    returnByValue: true,
  });

  await closeTab(page.id);
  return result.value;
}

const WIDTHS = [390, 1280];
let anyIssue = false;
for (const width of WIDTHS) {
  console.log(`\n=== width ${width} ===`);
  for (const route of ROUTES) {
    const r = await checkRoute(width, route);
    const newOverflow = r.after.sw > r.after.cw && !(r.before.sw > r.before.cw);
    const hasClipped = r.clipped.length > 0;
    if (newOverflow || hasClipped) anyIssue = true;
    console.log(
      `${route.path.padEnd(22)} before(sw=${r.before.sw},cw=${r.before.cw}) after(sw=${r.after.sw},cw=${r.after.cw})` +
        ` newHorizOverflow=${newOverflow} clippedEls=${r.clipped.length}`
    );
    if (hasClipped) console.log("  clipped:", JSON.stringify(r.clipped));
  }
}
console.log(anyIssue ? "\nISSUES FOUND" : "\nNo new-at-200%-text-zoom overflow or clipping detected.");
