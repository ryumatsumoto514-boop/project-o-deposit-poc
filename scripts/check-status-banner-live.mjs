// Checks whether the KOL disclosure banner renders on the live status page
// for a real deposit record (created via the live API with kolRef set).
const CDP = "http://127.0.0.1:9333";
const URL = process.argv[2];

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

const page = await newTab();
const ws = await connect(page.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await send(ws, "Runtime.enable");
await send(ws, "Page.navigate", { url: URL });
await new Promise((r) => setTimeout(r, 3000));
const { result } = await send(ws, "Runtime.evaluate", {
  expression: "document.body.innerText",
  returnByValue: true,
});
const text = result.value || "";
const hasBanner = /arrived via/i.test(text);
console.log(URL, "-> bannerPresent:", hasBanner);
if (!hasBanner) {
  console.log("[full text dump]\n", text.slice(0, 1500));
}
ws.close();
await closeTab(page.id);
