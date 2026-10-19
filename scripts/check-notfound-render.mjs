// Verifies /deposit/status/[id] for a deposit id that never existed actually
// resolves to a user-facing "Not found" state (not an infinite "Loading
// deposit status..." spinner) after the 3-strike 404 streak in
// app/deposit/status/[id]/page.tsx. Takes a screenshot + dumps visible text.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const FAKE_ID = "ghost-deposit-does-not-exist-000";

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
await send(ws, "Runtime.enable");

await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/status/${FAKE_ID}` });
// 3 strikes at ~3s poll delay + initial call ~= need >9s; wait 14s to be safe.
await new Promise((r) => setTimeout(r, 14000));

const result = await send(ws, "Runtime.evaluate", {
  expression: "document.body.innerText",
  returnByValue: true,
});
console.log("=== VISIBLE TEXT ===");
console.log(result.result.value);

const shot = await send(ws, "Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("/tmp/notfound-check.png", Buffer.from(shot.data, "base64"));
console.log("Screenshot saved to /tmp/notfound-check.png");

await send(ws, "Page.close").catch(() => {});
