// Checks whether the approval-scope radio cards and address-confirm checkbox
// label show a visible focus indicator when tabbed to, matching the
// focus-visible:ring treatment used by .btn/.input elsewhere.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";
const INJECT_WALLET = `
(function() {
  const ADDR = ${JSON.stringify(WALLET)};
  const CHAIN_ID = ${JSON.stringify(CHAIN_ID_HEX)};
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
      if (method === "eth_chainId") return CHAIN_ID;
      if (method === "net_version") return String(parseInt(CHAIN_ID, 16));
      return null;
    },
    on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
    removeListener: (ev, cb) => {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter((l) => l !== cb);
    },
  };
})();
`;

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

async function run(path, seedFlow, tabCount, targetDesc) {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  const page = await res.json();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await send(ws, "Page.addScriptToEvaluateOnNewDocument", { source: INJECT_WALLET });
  if (seedFlow) {
    await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
      source: `sessionStorage.setItem("exo_flow_state", ${JSON.stringify(JSON.stringify(seedFlow))});`,
    });
  }
  await send(ws, "Page.navigate", { url: `${BASE_URL}${path}` });
  await new Promise((r) => setTimeout(r, 1800));
  await send(ws, "Page.bringToFront");
  await send(ws, "Runtime.evaluate", { expression: "document.body.focus(); window.focus();" });

  for (let i = 0; i < tabCount; i++) {
    await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 9, key: "Tab", code: "Tab" });
    await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 9, key: "Tab", code: "Tab" });
    await new Promise((r) => setTimeout(r, 100));
    const { result: cur } = await send(ws, "Runtime.evaluate", {
      expression: "document.activeElement.tagName + ':' + (document.activeElement.type||'') + ':' + (document.activeElement.textContent||'').slice(0,30)",
      returnByValue: true,
    });
    console.log(`  tab ${i + 1}: ${cur.value}`);
  }

  const { result } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const el = document.activeElement;
        const label = el ? el.closest("label") : null;
        const target = label || el;
        if (!target) return null;
        const cs = getComputedStyle(target);
        const elCs = getComputedStyle(el);
        return {
          tag: el.tagName,
          type: el.type,
          labelOutline: cs.outlineStyle + " " + cs.outlineWidth,
          labelBoxShadow: cs.boxShadow,
          elOutline: elCs.outlineStyle + " " + elCs.outlineWidth,
          elBoxShadow: elCs.boxShadow,
        };
      })()
    `,
    returnByValue: true,
  });
  console.log(`${path} [${targetDesc}] ->`, JSON.stringify(result.value));
  await fetch(`${CDP}/json/close/${page.id}`);
}

await run("/deposit/confirm", { kolRef: null, mockIdentity: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5", draftAmount: "42.0" }, 6, "checkbox area (approx)");
await run("/deposit/approve", { kolRef: null, mockIdentity: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5", draftAmount: "42.0", addressConfirmed: true }, 6, "radio area (approx)");
