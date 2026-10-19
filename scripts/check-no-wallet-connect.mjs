// One-off live check: what happens when a user with NO injected wallet
// (no MetaMask/browser extension at all) clicks "Connect Browser wallet" on
// /deposit. Not part of the permanent QA script set.
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
await send(ws, "Runtime.enable");
await send(ws, "Page.navigate", { url: "https://projecto-blond.vercel.app/login" });
await new Promise((r) => setTimeout(r, 2500));

await send(ws, "Runtime.evaluate", {
  expression: `(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Continue with Google'));
    if (b) b.click();
    return !!b;
  })()`,
});
await new Promise((r) => setTimeout(r, 2500));

const url1 = await send(ws, "Runtime.evaluate", { expression: "location.href", returnByValue: true });
console.log("URL after mock login:", url1.result.value);

const hasEthereum = await send(ws, "Runtime.evaluate", { expression: "typeof window.ethereum", returnByValue: true });
console.log("typeof window.ethereum:", hasEthereum.result.value);

const click = await send(ws, "Runtime.evaluate", {
  expression: `(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('Connect'));
    if (b) { b.click(); return b.textContent; }
    return null;
  })()`,
  returnByValue: true,
});
console.log("Clicked:", click.result.value);

await new Promise((r) => setTimeout(r, 2500));

const after = await send(ws, "Runtime.evaluate", {
  expression: `(() => {
    const alertEl = document.querySelector('[role="alert"]');
    return JSON.stringify({
      alertText: alertEl ? alertEl.textContent : null,
      bodySnippet: document.body.innerText.slice(0, 800),
    });
  })()`,
  returnByValue: true,
});
console.log("--- after click ---");
console.log(after.result.value);

await closeTab(tab.id);
