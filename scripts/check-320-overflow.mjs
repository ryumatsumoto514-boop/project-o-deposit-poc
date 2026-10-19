// Real CDP check at 320px width (iPhone SE portrait, the narrowest common
// mobile viewport) for horizontal overflow across the full deposit flow on
// the live deployment. Prior cycles checked landscape overflow and desktop
// breakpoints but never logged a 320px-wide portrait sweep with an actual
// scrollWidth-vs-clientWidth measurement (only visual screenshots existed,
// untracked and never run, in check-320-sweep.mjs).
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
  { url: `${BASE}/?ref=kol_alex`, name: "home" },
  { url: `${BASE}/login`, name: "login" },
  {
    url: `${BASE}/deposit`,
    name: "deposit",
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/confirm`,
    name: "confirm",
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/approve`,
    name: "approve",
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: true },
  },
];

for (const p of pages) {
  const page = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
  const ws = await connect(page.webSocketDebuggerUrl);
  try {
    await send(ws, "Page.enable");
    await send(ws, "Runtime.enable");
    await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `window.ethereum = { isMetaMask: true, request: async ({method}) => { if (method==="eth_requestAccounts"||method==="eth_accounts") return ["${WALLET}"]; if (method==="eth_chainId") return "0x66eee"; if (method==="net_version") return "421614"; return null; }, on: () => {}, removeListener: () => {} };`,
    });
    if (p.seedFlow) {
      await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
        source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(p.seedFlow))});`,
      });
    }
    await send(ws, "Page.navigate", { url: p.url });
    await new Promise((r) => setTimeout(r, 1800));
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `(function(){
        const doc = document.documentElement;
        const overflowEls = Array.from(document.querySelectorAll("*")).filter(el => el.scrollWidth > 321).slice(0, 5)
          .map(el => ({ tag: el.tagName, cls: el.className, sw: el.scrollWidth }));
        return JSON.stringify({ docScrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, overflowEls });
      })()`,
      returnByValue: true,
    });
    console.log(p.name, result.value);
  } catch (e) {
    console.error(p.name, "ERROR", e.message);
  } finally {
    ws.close();
    await fetch(`${CDP}/json/close/${page.id ?? page.targetId}`);
  }
}
