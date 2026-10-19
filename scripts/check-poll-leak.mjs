// Checks whether navigating away from /deposit/status/[id] and back leaks a
// duplicate polling loop (two overlapping setTimeout chains both hitting
// POST /api/deposits/[id]/reconcile), which would double real request load
// and could visually show two competing "last checked" states. Never
// previously checked in OVERNIGHT_LOG.md (zero hits for setInterval/
// "duplicate poll"/"interval leak").
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const DEPOSIT_ID = process.argv[2];
if (!DEPOSIT_ID) {
  console.error("usage: node check-poll-leak.mjs <deposit-id>");
  process.exit(1);
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

const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Network.enable");

const reconcileHits = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Network.requestWillBeSent") {
    const r = msg.params.request;
    if (r.method === "POST" && r.url.includes("/reconcile")) {
      reconcileHits.push(Date.now());
    }
  }
});

console.log("Phase 1: load status page, observe polling for 10s...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/status/${DEPOSIT_ID}` });
await new Promise((r) => setTimeout(r, 10000));
console.log("Phase 1 hits:", reconcileHits.length, reconcileHits.map((t, i, a) => (i ? t - a[i - 1] : 0)));

console.log("Phase 2: navigate away to /, then back to status, observe 10s more...");
reconcileHits.length = 0;
await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
await new Promise((r) => setTimeout(r, 1000));
await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/status/${DEPOSIT_ID}` });
await new Promise((r) => setTimeout(r, 10000));

const deltas = reconcileHits.map((t, i, a) => (i ? t - a[i - 1] : 0));
console.log("Phase 2 hits:", reconcileHits.length, deltas);

// A healthy single polling loop at 3s delay over 10s produces ~3-4 hits with
// deltas clustered near 3000ms. A leaked duplicate loop would show hits
// arriving in close pairs (delta << 3000ms, e.g. <500ms) or roughly double
// the expected count.
const suspiciousPairs = deltas.filter((d) => d > 0 && d < 1000).length;
console.log("Suspicious sub-1s gaps (possible overlapping loops):", suspiciousPairs);
if (suspiciousPairs > 0 || reconcileHits.length > 6) {
  console.log("RESULT: POSSIBLE LEAK — more/closer requests than one clean 3s polling loop would produce.");
} else {
  console.log("RESULT: OK — polling cadence after navigate-away-and-back looks like a single clean loop.");
}

await fetch(`${CDP}/json/close/${page.id}`);
