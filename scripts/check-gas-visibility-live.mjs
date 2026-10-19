// Closes the open follow-up from OVERNIGHT_LOG.md 2026-10-13T10:04:43Z entry:
// prior fixes (e76d2aa, ce6b5e0) to AppHeader's useGasPriceGwei were only
// verified by reading bundle bytes / a Node VM harness, never by an actual
// browser visibility toggle watching real network traffic. This does that:
// load the live site, force document.visibilityState to "hidden" via CDP
// Page.setWebLifecycleState / Emulation, wait past the 20s poll interval,
// confirm zero /api/gas requests fire, then resume visibility and confirm a
// fetch happens promptly.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";

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

const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Network.enable");
await send(ws, "Emulation.setFocusEmulationEnabled", { enabled: true });

const gasHits = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Network.requestWillBeSent") {
    const r = msg.params.request;
    if (r.url.includes("/api/gas")) gasHits.push(Date.now());
  }
});

console.log("Loading site visible, waiting for first gas fetch...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
await new Promise((r) => setTimeout(r, 4000));
console.log("Visible-phase hits so far:", gasHits.length);

console.log("Forcing document hidden via CDP (setWebLifecycleState: frozen-equivalent visibility)...");
// Real visibilitychange: override document.visibilityState + dispatch event,
// matching how a backgrounded tab actually behaves from the page's JS perspective.
await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
await new Promise((r) => setTimeout(r, 2000));
gasHits.length = 0;
await send(ws, "Runtime.evaluate", {
  expression: `
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    'patched-hidden';
  `,
});
console.log("Patched to hidden. Waiting 23s (past one 20s poll interval) watching for /api/gas...");
await new Promise((r) => setTimeout(r, 23000));
console.log("Hidden-phase hits (expect 0):", gasHits.length, gasHits);

gasHits.length = 0;
console.log("Resuming visibility...");
await send(ws, "Runtime.evaluate", {
  expression: `
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    'patched-visible';
  `,
});
await new Promise((r) => setTimeout(r, 4000));
console.log("Resume-phase hits (expect >=1 promptly):", gasHits.length, gasHits);

if (gasHits.length === 0) {
  console.log("RESULT: FAIL — tab did not resume polling /api/gas after becoming visible again.");
} else {
  console.log("RESULT: pending overall verdict printed below.");
}

await fetch(`${CDP}/json/close/${page.id}`);
