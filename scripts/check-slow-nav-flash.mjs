// Checks for a blank white flash during client-side navigation under a
// throttled connection (no app/loading.tsx exists anywhere in the route
// tree — this checks whether that absence is visible in practice).
// Usage: node scripts/check-slow-nav-flash.mjs <baseUrl>
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

async function sampleBodyState(ws) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `(function(){
      const b = document.body;
      const text = (b.innerText || "").trim();
      const bg = getComputedStyle(b).backgroundColor;
      return JSON.stringify({ textLen: text.length, bg, href: location.href });
    })()`,
    returnByValue: true,
  });
  return JSON.parse(result.value);
}

async function main() {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Network.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  // Slow 3G-ish: 400kbps down, 400kbps up, 400ms RTT
  await send(ws, "Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });

  const seedFlow = {
    wallet: "0x9A119f8912FD4e9d0fFe6D5b0fE6A9f9c7e3A3E5",
    kolRef: "kol_alex",
    amount: "25",
    addressConfirmed: true,
  };
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
    source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
  });

  console.log(`Loading ${BASE_URL}/ under throttled 400kbps/400ms RTT...`);
  await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
  await new Promise((r) => setTimeout(r, 3000));

  // Click the primary CTA link to /login and sample body text every 150ms
  // for 3s, looking for a window where the body goes blank (textLen ~ 0)
  // between the old page's content disappearing and the new page's content
  // appearing.
  const { result: linkResult } = await send(ws, "Runtime.evaluate", {
    expression: `(function(){
      const a = document.querySelector('a[href*="/login"]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()`,
    returnByValue: true,
  });
  if (!linkResult.value) {
    console.error("Could not find a /login link on the homepage.");
    await closeTab(page.id);
    process.exit(1);
  }
  const { x, y } = linkResult.value;
  const before = await sampleBodyState(ws);
  console.log("Before click:", before);

  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });

  const samples = [];
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const s = await sampleBodyState(ws);
      samples.push({ t: (i + 1) * 150, ...s });
    } catch (e) {
      samples.push({ t: (i + 1) * 150, error: String(e) });
    }
  }
  console.log("Samples after click (every 150ms):");
  for (const s of samples) console.log(" ", JSON.stringify(s));

  const blankWindow = samples.filter((s) => !s.error && s.textLen === 0);
  console.log(`\nBlank-body samples: ${blankWindow.length} / ${samples.length}`);
  if (blankWindow.length > 0) {
    console.log("FOUND a blank-body window during throttled navigation.");
  } else {
    console.log("No blank-body window observed during throttled navigation.");
  }

  await closeTab(page.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
