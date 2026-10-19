// Checks whether the KOL attribution banner survives (a) a deep link straight
// into /login?ref=... (not the landing page SPEC.md's example uses), and
// (b) a full page reload mid-flow (sessionStorage persistence), against the
// real live deployment via CDP.
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
async function bodyIncludesBanner(ws) {
  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `document.body.innerText.includes("KOL Alex") && document.body.innerText.includes("Exchange O is independent")`,
    returnByValue: true,
  });
  return result.value;
}

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");

console.log("1) deep link straight into /login?ref=kol_alex (no landing page visit)");
await send(ws, "Page.navigate", { url: `${BASE}/login?ref=kol_alex` });
await new Promise((r) => setTimeout(r, 3500));
console.log("   banner present on /login:", await bodyIncludesBanner(ws));

console.log("2) reload bare /login (no ?ref=) via a full browser reload (new navigation, not client-side route change) — does sessionStorage survive a hard reload?");
await send(ws, "Page.navigate", { url: `${BASE}/login` });
await new Promise((r) => setTimeout(r, 3500));
console.log("   banner present on bare /login hard-reload:", await bodyIncludesBanner(ws));

console.log("3) now hard-navigate to /deposit directly (still no ?ref= in URL) - does sessionStorage carry it across a full page load?");
await send(ws, "Page.navigate", { url: `${BASE}/deposit` });
await new Promise((r) => setTimeout(r, 3500));
console.log("   banner present on /deposit hard-reload:", await bodyIncludesBanner(ws));

await closeTab(page.id);
