// Live hydrated check: the lowGas / wrongNetwork banners on
// /deposit/approve only render once a real connected wallet + real
// useBalance/chainId data resolves — no prior cycle appears to have driven
// this with an actual mocked wallet at a narrow 320px viewport (prior
// curl-only reviews explicitly couldn't test hydrated wallet state).
// This mocks window.ethereum with a real, unfunded testnet address so
// wagmi's useBalance makes a genuine RPC call and returns a real 0 balance,
// triggering the lowGas banner with real content, and checks for
// horizontal overflow at 320px.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
// Freshly generated random throwaway address (not a project wallet),
// confirmed zero-balance via direct RPC eth_getBalance before use — used
// only to get a genuine zero-balance response, no funds/keys involved.
// (The well-known 0x...dEaD burn address was tried first and turned out to
// hold ~1.5 testnet ETH from other people's burns, so it was useless here.)
const UNFUNDED_ADDR = "0xfde11cac855dfa57c0f7b798ba7a881e71a0daa6";

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(label, chainIdHex) {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  const page = await res.json();
  const ws = await connect(page.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Emulation.setDeviceMetricsOverride", { width: 320, height: 760, deviceScaleFactor: 2, mobile: true });

  await send(ws, "Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (function() {
        const ADDR = ${JSON.stringify(UNFUNDED_ADDR)};
        window.ethereum = {
          isMetaMask: true,
          request: async ({ method }) => {
            if (method === "eth_requestAccounts" || method === "eth_accounts") return [ADDR];
            if (method === "eth_chainId") return ${JSON.stringify(chainIdHex)};
            if (method === "net_version") return "${parseInt(chainIdHex, 16)}";
            return null;
          },
          on: () => {},
          removeListener: () => {},
        };
        sessionStorage.setItem("exo_flow_state", JSON.stringify({
          kolRef: null,
          mockIdentity: "demo-reviewer@exchangeo.test",
          draftAmount: "25",
          approvalMode: "exact",
          addressConfirmed: true,
        }));
      })();
    `,
  });

  await send(ws, "Page.navigate", { url: `${BASE_URL}/deposit/approve` });
  await wait(1200);

  async function clickText(text) {
    const { result } = await send(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const els = Array.from(document.querySelectorAll("button, a"));
          const target = els.find(el => el.textContent && el.textContent.trim().includes(${JSON.stringify(text)}) && !el.disabled);
          if (!target) return null;
          target.scrollIntoView();
          const r = target.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        })()
      `,
      returnByValue: true,
    });
    if (!result.value) return false;
    const { x, y } = result.value;
    await send(ws, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send(ws, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    return true;
  }
  await clickText("Connect Injected");
  await wait(2500); // let useBalance/chainId resolve against real RPC

  const { result: state } = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const sw = document.documentElement.scrollWidth;
        const cw = document.documentElement.clientWidth;
        const bodyText = document.body.innerText;
        return {
          scrollWidth: sw,
          clientWidth: cw,
          overflow: sw > cw,
          hasLowGasBanner: bodyText.includes("Not enough") || bodyText.includes("gas"),
          hasWrongNetworkBanner: bodyText.includes("different network"),
          snippet: bodyText.slice(0, 400),
        };
      })()
    `,
    returnByValue: true,
  });
  console.log(`\n=== ${label} (320px) ===`);
  console.log(JSON.stringify(state.value, null, 2));

  const { data: screenshot } = await send(ws, "Page.captureScreenshot", { format: "png" });
  await import("fs").then((fs) => fs.writeFileSync(`/tmp/gas-banner-${label}.png`, Buffer.from(screenshot, "base64")));

  ws.close();
  await fetch(`${CDP}/json/close/${page.id}`);
}

await run("lowgas-correct-chain", "0x66eee"); // Arbitrum Sepolia, real RPC -> real 0 balance
await run("wrong-network", "0x1"); // Ethereum mainnet chainId -> wrongNetwork banner
