// Verifies the "Arbiscan Sepolia" inline link color inside the amber
// "Deposit record unavailable" banner on a missing-record status page.
// globals.css documents that severity banner colors (amber/rose/emerald)
// must never collide with the brand accent (turquoise) link color, and
// every other inline link in a severity banner explicitly overrides the
// global `a { color: accent-400 }` rule to match its banner's severity.
// This checks whether that override is actually present here.
const CDP = "http://127.0.0.1:9333";
const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";

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

const res = await fetch(`${CDP}/json/new?${encodeURIComponent(BASE_URL + "/deposit/status/qa-missing-record-check")}`, { method: "PUT" });
const target = await res.json();
const ws = await connect(target.webSocketDebuggerUrl);
await send(ws, "Page.enable");
await new Promise((r) => setTimeout(r, 12000));

const { result } = await send(ws, "Runtime.evaluate", {
  expression: `
    (function() {
      const links = Array.from(document.querySelectorAll("a"))
        .filter(a => a.textContent.trim() === "Arbiscan Sepolia");
      if (links.length === 0) return JSON.stringify({ found: false, bodyText: document.body.innerText.slice(0, 300) });
      const a = links[0];
      const style = getComputedStyle(a);
      const banner = a.closest(".banner-amber");
      return JSON.stringify({
        found: true,
        className: a.className,
        color: style.color,
        textDecoration: style.textDecorationLine,
        insideAmberBanner: !!banner,
        bannerColor: banner ? getComputedStyle(banner).color : null,
      });
    })()
  `,
  returnByValue: true,
});
console.log(JSON.parse(result.value));
await send(ws, "Page.close");
process.exit(0);
