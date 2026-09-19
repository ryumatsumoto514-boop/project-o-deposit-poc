// Headless-Chromium screenshot driver over raw CDP (no npm deps — Node 26's
// native WebSocket/fetch are enough). Persisted this cycle so future cycles
// don't have to rewrite it from scratch (six+ prior cycles did).
//
// Usage: node scripts/screenshot.mjs <baseUrl> <outDir>
// Requires chrome-headless-shell already running with --remote-debugging-port=9333
// (see OVERNIGHT_LOG.md for the exact launch command).

const CDP = "http://127.0.0.1:9333";
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
const [, , BASE_URL, OUT_DIR] = process.argv;
if (isMain && (!BASE_URL || !OUT_DIR)) {
  console.error("usage: node scripts/screenshot.mjs <baseUrl> <outDir>");
  process.exit(1);
}

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

function send(ws, method, params = {}, sessionId) {
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
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

// Injected before any page script runs, on every navigation.
const INJECT_WALLET = (wallet, chainIdHex) => `
(function() {
  const ADDR = ${JSON.stringify(wallet)};
  const CHAIN_ID = ${JSON.stringify(chainIdHex)};
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
    removeListener: (ev, cb) => {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter((l) => l !== cb);
    },
  };
})();
`;

async function shot(page, { url, out, wallet, chainIdHex, seedFlow, click, waitMs, width, height, mobile }) {
  const { targetId, webSocketDebuggerUrl } = page;
  const ws = await connect(webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Network.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", {
    width: width ?? 375,
    height: height ?? 812,
    deviceScaleFactor: mobile === false ? 1 : 2,
    mobile: mobile ?? true,
  });

  if (wallet) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: INJECT_WALLET(wallet, chainIdHex),
    });
  }
  if (seedFlow) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
    });
  }

  await send(ws, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, waitMs ?? 1200));

  if (click) {
    // Find element by visible text via Runtime.evaluate + dispatch a real click.
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const els = Array.from(document.querySelectorAll("button, a"));
          const target = els.find(el => el.textContent && el.textContent.includes(${JSON.stringify(click)}));
          if (!target) return null;
          const r = target.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })()
      `,
      returnByValue: true,
    });
    if (result.value) {
      const { x, y } = result.value;
      await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      console.error(`  [warn] click target "${click}" not found on ${url}`);
    }
  }

  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(`${OUT_DIR}/${out}.png`, Buffer.from(data, "base64"));
  console.log(`  wrote ${out}.png`);
  ws.close();
}

if (OUT_DIR) {
  const fs = await import("node:fs");
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

export { newTab, closeTab, shot, BASE_URL };
