// Live XSS probe for the KOL ?ref= query param. Prior Codex-review cycles
// only inspected CaptureKolRef.tsx/KolBanner.tsx source + curl'd raw HTML
// (the banner is client-rendered, so static HTML never proves hydrated
// behavior is safe). This drives a real browser via CDP, injects a script
// payload through ?ref=, and checks whether it actually executes.
import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";

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

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");

let fired = false;
let consoleErrors = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params.args || []).map((a) => a.value ?? a.description).join(" ");
    if (args.includes("XSS_FIRED_7a9c")) fired = true;
    if (msg.params.type === "error") consoleErrors.push(args);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push(JSON.stringify(msg.params.exceptionDetails.exception));
  }
});

const payload = `<img src=x onerror="console.log('XSS_FIRED_7a9c')">`;
const url = `${BASE}/login?ref=${encodeURIComponent(payload)}`;
console.log("Navigating to:", url);
await send(ws, "Page.navigate", { url });
await new Promise((r) => setTimeout(r, 3500));

const { result: domCheck } = await send(ws, "Runtime.evaluate", {
  expression: `(() => {
    const html = document.body.innerHTML;
    return {
      rawTagInHtml: html.includes("<img src=x onerror"),
      literalTextVisible: document.body.innerText.includes("<img src=x onerror"),
      bodyTextSnippet: document.body.innerText.slice(0, 300),
    };
  })()`,
  returnByValue: true,
});

await new Promise((r) => setTimeout(r, 1000));

console.log("script payload executed (onerror fired):", fired);
console.log("raw unescaped <img onerror> tag present in innerHTML:", domCheck.value.rawTagInHtml);
console.log("payload rendered as literal escaped text in innerText:", domCheck.value.literalTextVisible);
console.log("console errors seen:", consoleErrors.length ? consoleErrors : "none");
console.log("body text snippet:", JSON.stringify(domCheck.value.bodyTextSnippet));

await closeTab(page.id);
