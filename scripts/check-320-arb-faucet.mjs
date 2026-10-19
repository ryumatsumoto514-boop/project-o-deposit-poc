import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
await shot(page, {
  url: "https://cloud.google.com/application/web3/faucet/arbitrum/sepolia",
  out: "arb-faucet",
  width: 1280,
  height: 900,
  mobile: false,
  waitMs: 3500,
});

// also grab rendered text to see if it's a real faucet form or an error/empty state
const { connect, send } = await import("./screenshot.mjs");
const fs = await import("node:fs");
const WebSocketCtor = WebSocket;
const ws = new WebSocketCtor(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
function sendMsg(method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await sendMsg("Runtime.enable");
const result = await sendMsg("Runtime.evaluate", {
  expression: "document.body.innerText.slice(0, 3000)",
  returnByValue: true,
});
fs.writeFileSync("/tmp/arb-faucet-text.txt", result.result.value || "");
console.log(result.result.value);
ws.close();
await closeTab(page.targetId || page.id);
