// One-off live verification: tab-focus the new skip-to-content link on
// production, confirm it becomes visible and points at a real #main-content
// target. Not part of the permanent QA script set.
const CDP = "http://127.0.0.1:9333";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}
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

const tab = await newTab();
const ws = await connect(tab.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/" });
await new Promise((r) => setTimeout(r, 2500));

// Focus the body then simulate a single Tab keypress to reach the first
// focusable element (should be the skip link, as it's the first DOM child).
await send(ws, "Runtime.evaluate", { expression: "document.body.focus()" });
await send(ws, "Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab" });
await send(ws, "Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab" });
await new Promise((r) => setTimeout(r, 300));

const result = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const el = document.activeElement;
      const rect = el ? el.getBoundingClientRect() : null;
      const target = document.getElementById("main-content");
      return JSON.stringify({
        activeTag: el ? el.tagName : null,
        activeText: el ? el.textContent : null,
        activeHref: el ? el.getAttribute("href") : null,
        visibleWidth: rect ? rect.width : null,
        visibleHeight: rect ? rect.height : null,
        mainContentExists: !!target,
      });
    })()
  `,
  returnByValue: true,
});
console.log(result.result.value);

await closeTab(tab.id);
