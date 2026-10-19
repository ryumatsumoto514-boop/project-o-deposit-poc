// Isolated test: does an unusually long ?ref= value break the KOL banner's
// layout on a narrow mobile viewport (320px), as opposed to overflowing
// off-screen, causing horizontal scroll, or pushing other content around?
// Prior log entries tested KOL-ref edge cases for XSS/safety and formatting
// correctness, but not a long-ref layout overflow check at the narrowest
// supported width.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] ?? "https://projecto-blond.vercel.app";
const OUT_DIR = process.argv[3] ?? "/tmp";

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
async function shotTo(ws, file) {
  const { data } = await send(ws, "Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`  wrote ${file}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const longRef = "kol_" + "x".repeat(300);
const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });

console.log(`navigating to ${BASE_URL}/?ref=${longRef.slice(0, 20)}... (300+ chars)`);
await send(ws, "Page.navigate", { url: `${BASE_URL}/?ref=${longRef}` });
await wait(2500);
await shotTo(ws, `${OUT_DIR}/long-kol-ref-320.png`);

const metrics = await send(ws, "Runtime.evaluate", {
  expression: `(function(){
    const doc = document.documentElement;
    const banner = document.querySelector('.banner-amber');
    return JSON.stringify({
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
      bannerText: banner ? banner.textContent.slice(0, 120) : null,
      bannerScrollWidth: banner ? banner.scrollWidth : null,
      bannerClientWidth: banner ? banner.clientWidth : null,
    });
  })()`,
  returnByValue: true,
});
console.log("metrics:", metrics.result.value);

await send(ws, "Page.close");
process.exit(0);
