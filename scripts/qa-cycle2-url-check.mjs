const CDP = "http://127.0.0.1:9333";

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

const tab = await (await fetch(`${CDP}/json/new`, { method: "PUT" })).json();
const ws = await connect(tab.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/deposit?ref=kol_alex" });
await new Promise((r) => setTimeout(r, 6000));
const { result } = await send(ws, "Runtime.evaluate", {
  expression: "JSON.stringify({href: location.href, body: document.body.innerText.slice(0,200)})",
  returnByValue: true,
});
console.log(result.value);
ws.close();
process.exit(0);
