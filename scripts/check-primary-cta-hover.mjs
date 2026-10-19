// No prior cycle hover-checked the primary CTA buttons on /deposit/confirm
// or /deposit/approve (only /login's secondary button was checked in
// check-hover-states.mjs). Seeds flow state the same way check-320-overflow.mjs
// does, hovers the primary button, and reads getComputedStyle before/during.
const CDP = "http://127.0.0.1:9333";
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

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

const pages = [
  {
    url: `${BASE}/deposit/confirm`,
    name: "confirm",
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false },
    clickCheckbox: true,
  },
];

for (const p of pages) {
  const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
  const ws = await connect(page.webSocketDebuggerUrl);
  try {
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `window.ethereum = { isMetaMask: true, request: async ({method}) => { if (method==="eth_requestAccounts"||method==="eth_accounts") return ["${WALLET}"]; if (method==="eth_chainId") return "0x66eee"; if (method==="net_version") return "421614"; return null; }, on: () => {}, removeListener: () => {} };`,
    });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(p.seedFlow))});`,
    });
    await send(ws, "Page.navigate", { url: p.url });
    await new Promise((r) => setTimeout(r, 2200));

    if (p.clickCheckbox) {
      const cb = await send(ws, "Runtime.evaluate", {
        expression: `(function(){ const c = document.querySelector('input[type="checkbox"]'); if(!c) return null; const r = c.getBoundingClientRect(); return JSON.stringify({x: r.x+r.width/2, y: r.y+r.height/2}); })()`,
        returnByValue: true,
      });
      if (cb.result.value) {
        const { x, y } = JSON.parse(cb.result.value);
        await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const find = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const btn = Array.from(document.querySelectorAll("button, a")).find(b => b.className.includes("btn-primary"));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2, text: btn.textContent.trim() });
      })()`,
      returnByValue: true,
    });
    if (!find.result.value) {
      console.log(p.name, "no btn-primary found");
      continue;
    }
    const { x, y, text } = JSON.parse(find.result.value);
    const before = await send(ws, "Runtime.evaluate", {
      expression: `getComputedStyle(Array.from(document.querySelectorAll("button, a")).find(b => b.className.includes("btn-primary"))).backgroundColor`,
      returnByValue: true,
    });
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await new Promise((r) => setTimeout(r, 400));
    const during = await send(ws, "Runtime.evaluate", {
      expression: `(function(){ const btn = Array.from(document.querySelectorAll("button, a")).find(b => b.className.includes("btn-primary")); const atPoint = document.elementFromPoint(${x}, ${y}); return JSON.stringify({ bg: getComputedStyle(btn).backgroundColor, matches: btn.matches(":hover"), disabled: btn.disabled, atPointTag: atPoint ? atPoint.tagName : null, atPointCls: atPoint ? atPoint.className : null, isSame: atPoint === btn }); })()`,
      returnByValue: true,
    });
    console.log(p.name, JSON.stringify({ text, before: before.result.value, during: during.result.value }));
  } catch (e) {
    console.error(p.name, "ERROR", e.message);
  } finally {
    ws.close();
    await fetch(`${CDP}/json/close/${page.id ?? page.targetId}`);
  }
}
