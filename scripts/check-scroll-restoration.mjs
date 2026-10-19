// Checks whether navigating between routes via client-side <Link> leaves
// stale scroll position on the new page (a real, user-visible bug class in
// Next.js App Router apps when a page is scrolled down and the next route
// renders already scrolled instead of at the top).
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";

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
async function evalExpr(ws, expression) {
  const { result } = await send(ws, "Runtime.evaluate", { expression, returnByValue: true });
  return result.value;
}
async function clickText(ws, text) {
  const result = await evalExpr(ws, `
    (function() {
      const els = Array.from(document.querySelectorAll("button, a"));
      const target = els.find(el => el.textContent && el.textContent.trim().includes(${JSON.stringify(text)}) && !el.disabled);
      if (!target) return null;
      target.scrollIntoView({block: "center"});
      const r = target.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()
  `);
  if (!result) throw new Error(`click target not found: ${text}`);
  const { x, y } = result;
  await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
const page = await res.json();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

console.log("loading / ...");
await send(ws, "Page.navigate", { url: `${BASE_URL}/` });
await wait(1200);

const bodyHeight = await evalExpr(ws, "document.body.scrollHeight");
console.log("home scrollHeight:", bodyHeight, "viewport: 844");

if (bodyHeight > 844 + 200) {
  await evalExpr(ws, "window.scrollTo(0, document.body.scrollHeight)");
  await wait(300);
  const scrolledY = await evalExpr(ws, "window.scrollY");
  console.log("scrolled home to y =", scrolledY);

  console.log("clicking a nav link (Get started) ...");
  await clickText(ws, "Get started");
  await wait(1200);
  const newUrl = await evalExpr(ws, "location.href");
  const newY = await evalExpr(ws, "window.scrollY");
  console.log("navigated to:", newUrl, "-> scrollY on new page:", newY);
  console.log(newY === 0 ? "PASS: new page starts at top" : "FAIL: new page retains stale scroll position");
} else {
  console.log("home page too short to test meaningfully, trying /login -> back flow instead");
}

// Second check: walk the real deposit flow with an injected wallet, scrolling
// down on each step before continuing, to see whether the NEXT step mounts
// already-scrolled (stale) instead of at the top.
console.log("\n--- second check: scroll-down-then-continue through deposit flow ---");
await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (function() {
      const ADDR = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
      window.ethereum = {
        isMetaMask: true,
        request: async ({ method }) => {
          if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
          if (method === "eth_chainId") return "0x66eee";
          if (method === "net_version") return "421614";
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    })();
  `,
});
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await wait(1000);
await evalExpr(ws, "localStorage.clear(); sessionStorage.clear();");
await send(ws, "Page.navigate", { url: `${BASE_URL}/login` });
await wait(1200);

await clickText(ws, "Sign in with Browser wallet");
await wait(1000);
await clickText(ws, "Continue with connected wallet");
await wait(1000);
console.log("at:", await evalExpr(ws, "location.href"));

async function scrollThenContinue(stepName) {
  const h = await evalExpr(ws, "document.body.scrollHeight");
  await evalExpr(ws, "window.scrollTo(0, document.body.scrollHeight)");
  await wait(250);
  const before = await evalExpr(ws, "window.scrollY");
  await clickText(ws, "Continue");
  await wait(900);
  const after = await evalExpr(ws, "window.scrollY");
  const newUrl = await evalExpr(ws, "location.href");
  console.log(`${stepName}: scrollHeight=${h}, scrolled to y=${before}, continued -> ${newUrl}, new scrollY=${after}`);
  return after;
}

await evalExpr(ws, "(function(){const el=document.querySelector('#deposit-amount'); if(!el) return false; const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setter.call(el,'25'); el.dispatchEvent(new Event('input',{bubbles:true})); return true;})()");
await wait(300);
const y1 = await scrollThenContinue("amount->confirm");

await evalExpr(ws, "(function(){const el=document.querySelector('input[type=checkbox]'); if(el) el.click();})()");
await wait(300);
const y2 = await scrollThenContinue("confirm->approve");

const results = [y1, y2];
const anyStale = results.some((y) => y !== 0);
console.log(anyStale ? "FAIL: at least one step transition kept a non-zero scroll position" : "PASS: every step transition reset scroll to top");

await fetch(`${CDP}/json/close/${page.id}`);
