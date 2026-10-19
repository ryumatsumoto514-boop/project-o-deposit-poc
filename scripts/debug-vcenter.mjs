import { newTab, closeTab } from "./screenshot.mjs";

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}
let id = 0;
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const myId = ++id;
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === myId) {
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
}

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send(ws, "Page.navigate", { url: "http://localhost:3099/login" });
await new Promise((r) => setTimeout(r, 1200));
const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const main = document.querySelector(".page-shell");
      const footer = document.querySelector("footer");
      const cs = main ? getComputedStyle(main) : null;
      const children = main ? Array.from(main.children).map(c => ({
        tag: c.tagName, cls: c.className.slice(0,40),
        rect: c.getBoundingClientRect().toJSON(),
        mt: getComputedStyle(c).marginTop,
      })) : [];
      return JSON.stringify({
        innerHeight: window.innerHeight,
        bodyScrollHeight: document.body.scrollHeight,
        mainRect: main ? main.getBoundingClientRect().toJSON() : null,
        mainMinHeight: cs ? cs.minHeight : null,
        mainJustify: cs ? cs.justifyContent : null,
        footerRect: footer ? footer.getBoundingClientRect().toJSON() : null,
        children,
      });
    })()
  `,
  returnByValue: true,
});
console.log(result.value);
await closeTab(page.id);
