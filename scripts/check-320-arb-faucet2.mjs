import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
function send(method, params = {}) {
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
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "https://cloud.google.com/application/web3/faucet/arbitrum/sepolia" });
await new Promise((r) => setTimeout(r, 3500));

// click the "Select network" dropdown
const clickResult = await send("Runtime.evaluate", {
  expression: `
    (function() {
      const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent && e.textContent.trim() === 'Select network*' && e.children.length === 0);
      if (!el) return 'not found';
      const combo = el.closest('[role="combobox"], mat-select, .mat-mdc-select') || el.parentElement;
      const r = combo.getBoundingClientRect();
      return JSON.stringify({x: r.x + r.width/2, y: r.y + r.height/2});
    })()
  `,
  returnByValue: true,
});
console.log("click target:", clickResult.result.value);
if (clickResult.result.value && clickResult.result.value !== "not found") {
  const { x, y } = JSON.parse(clickResult.result.value);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1200));
}

const { data } = await send("Page.captureScreenshot", { format: "png" });
const fs = await import("node:fs");
fs.writeFileSync("shots-out/arb-faucet-dropdown.png", Buffer.from(data, "base64"));

const text = await send("Runtime.evaluate", {
  expression: "document.body.innerText",
  returnByValue: true,
});
fs.writeFileSync("/tmp/arb-dropdown-text.txt", text.result.value || "");
console.log("--- contains 'Arbitrum'? ---", (text.result.value || "").includes("Arbitrum"));
console.log("--- contains 'Sepolia'? ---", (text.result.value || "").match(/.{0,20}Sepolia.{0,20}/g));

ws.close();
await closeTab(page.targetId || page.id);
