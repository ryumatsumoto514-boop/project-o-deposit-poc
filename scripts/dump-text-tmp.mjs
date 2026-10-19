import WebSocket from "ws";
const CDP = "http://127.0.0.1:9333";
const TARGET_ID = process.argv[2];
const res = await fetch(`${CDP}/json/list`);
const pages = await res.json();
const page = pages.find(p => p.id === TARGET_ID);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener("open", resolve); ws.addEventListener("error", reject); });
function send(method, params={}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random()*1e9);
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { ws.removeEventListener("message", handler); if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result); }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({id, method, params}));
  });
}
await send("Runtime.enable");
const r = await send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
console.log(r.result.value);
process.exit(0);
