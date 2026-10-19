// Verifies the new lg:justify-center desktop centering (f8372d6) doesn't clip
// or misalign the long CREDITED status screen, which has far more content than
// the short login/amount/confirm screens the fix was designed around.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const ID = "qa-desktop-tall";

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
function on(ws, method, cb) {
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === method) cb(msg.params);
  });
}

const now = new Date().toISOString();
const FAKE_DEPOSIT = {
  id: ID,
  mockIdentity: "qa-reviewer@example.com",
  userWallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
  destinationAccount: "0x00000000000000000000000000000000000Ab1",
  amount: "42.5",
  amountRaw: "42500000",
  asset: "USDC",
  sourceChainId: 421614,
  status: "CREDITED",
  createdAt: now,
  updatedAt: now,
  txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
  explorerUrl: "https://sepolia.arbiscan.io/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
  approveTxHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd".slice(0, 66),
  kolRef: "kol_alex",
  approvalMode: "exact",
  failureReason: null,
  reconciliation: {
    onchainConfirmed: true,
    onchainConfirmedAt: now,
    hyperliquidCredited: true,
    lastCheckedAt: now,
    ambiguousSince: null,
  },
};

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);

await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Network.enable");
await send(ws, "Fetch.enable", {
  patterns: [{ urlPattern: `*${ID}/reconcile*`, requestStage: "Request" }],
});
on(ws, "Fetch.requestPaused", async (params) => {
  const body = JSON.stringify({ deposit: FAKE_DEPOSIT });
  await send(ws, "Fetch.fulfillRequest", {
    requestId: params.requestId,
    responseCode: 200,
    responseHeaders: [{ name: "Content-Type", value: "application/json" }],
    body: Buffer.from(body).toString("base64"),
  });
});

await send(ws, "Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

await send(ws, "Page.navigate", { url: `${BASE}/deposit/status/${ID}` });
await new Promise((r) => setTimeout(r, 2500));

// Viewport-clipped shot (what's actually visible without scrolling) — this is
// what would show clipping/overlap if justify-center + overflow misbehaves.
const viewportShot = await send(ws, "Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.mkdirSync("shots-out", { recursive: true });
fs.writeFileSync("shots-out/desktop-tall-status-viewport.png", Buffer.from(viewportShot.data, "base64"));

// Check geometry: is the top of the card at/above y=0 (i.e. clipped above the fold)?
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const main = document.getElementById("main-content");
      const r = main.getBoundingClientRect();
      return JSON.stringify({ top: r.top, bottom: r.bottom, height: r.height, scrollY: window.scrollY, innerHeight: window.innerHeight, bodyScrollHeight: document.body.scrollHeight });
    })()
  `,
  returnByValue: true,
});
console.log("geometry:", result.value);

await fetch(`${CDP}/json/close/${page.id}`);
