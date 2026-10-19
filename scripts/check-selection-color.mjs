// Checks whether the live site defines a custom ::selection style, or falls
// back to the browser default blue highlight, which would clash with the
// Cyber Amber/cyan dark theme. Navigates, selects a run of visible text via
// a real Range/Selection call, then reads getComputedStyle(..., "::selection").
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

const urls = [
  "https://projecto-blond.vercel.app/",
  "https://projecto-blond.vercel.app/login",
];

for (const url of urls) {
  const tab = await newTab();
  const ws = await connect(tab.webSocketDebuggerUrl);
  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 2500));

  const result = await send(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        // Select the first paragraph-ish block of visible text.
        const candidates = Array.from(document.querySelectorAll("p, h1, h2, span, strong"))
          .filter(el => el.textContent && el.textContent.trim().length > 10 && el.offsetParent !== null);
        if (!candidates.length) return { error: "no text node found" };
        const el = candidates[0];
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // Can't getComputedStyle(::selection) directly in most engines via JS;
        // instead check for an authored ::selection rule in any stylesheet.
        let hasCustomSelectionRule = false;
        let matchedRuleText = null;
        for (const sheet of document.styleSheets) {
          let rules;
          try { rules = sheet.cssRules; } catch (e) { continue; }
          for (const rule of rules) {
            if (rule.selectorText && rule.selectorText.includes("::selection")) {
              hasCustomSelectionRule = true;
              matchedRuleText = rule.cssText;
            }
          }
        }
        return {
          selectedText: el.textContent.trim().slice(0, 40),
          hasCustomSelectionRule,
          matchedRuleText,
        };
      })()
    `,
    returnByValue: true,
  });

  console.log(url, JSON.stringify(result.result.value, null, 2));
  await closeTab(tab.id);
}
