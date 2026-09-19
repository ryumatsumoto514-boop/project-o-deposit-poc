// One-off QA pass: capture console errors + horizontal-overflow checks on the
// live site at a 375px mobile viewport, across the pages a KOL-referred user
// actually walks through. Reuses the CDP helpers already in screenshot.mjs.
import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE = process.argv[2] || "https://projecto-blond.vercel.app";

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

const PAGES = ["/", "/?ref=kol_alex", "/login", "/deposit/status/qa-console-check"];

for (const path of PAGES) {
  const page = await newTab();
  const ws = await connect(page.webSocketDebuggerUrl);
  const consoleMsgs = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
      consoleMsgs.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      consoleMsgs.push("EXCEPTION: " + JSON.stringify(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
  });
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send(ws, "Page.navigate", { url: BASE + path });
  await new Promise((r) => setTimeout(r, 1800));
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })`,
    returnByValue: true,
  });
  console.log(`\n== ${path} ==`);
  console.log("  overflow:", result.value.scrollWidth > result.value.clientWidth ? `YES (${result.value.scrollWidth} > ${result.value.clientWidth})` : "no");
  console.log("  console errors/warnings:", consoleMsgs.length ? consoleMsgs : "none");
  ws.close();
  await closeTab(page.id);
}
