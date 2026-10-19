import { newTab, closeTab } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
  });
}
let id = 0;
function send(ws, method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve) => {
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === msgId) {
        ws.removeEventListener("message", handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

// Seed flow state with a kolRef BEFORE navigating, so the status page's
// flow-context fallback has something to read.
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(
    JSON.stringify({ kolRef: "kol_alex", mockIdentity: "demo@exchangeo.test", draftAmount: "", approvalMode: "exact", addressConfirmed: false })
  )});`,
});

await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/status/does-not-exist-kolcheck` });
await new Promise((r) => setTimeout(r, 6000));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `(function(){
    const h1 = document.querySelector("h1");
    const bannerText = document.body.innerText.includes("arrived via") ;
    return JSON.stringify({ h1: h1 ? h1.textContent : null, kolBannerPresent: bannerText, bodySnippet: document.body.innerText.slice(0, 400) });
  })()`,
  returnByValue: true,
});
console.log("notFound page result:", result.value);
await closeTab(page.id);
