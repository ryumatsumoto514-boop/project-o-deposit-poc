import { newTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "/tmp/shots-c1";

const pages = [
  { url: `${BASE}/deposit?ref=kol_alex`, out: "03-deposit" },
  { url: `${BASE}/deposit/confirm?ref=kol_alex`, out: "04-confirm" },
];

for (const p of pages) {
  const tab = await newTab();
  try {
    await shot(tab, { url: p.url, out: p.out, waitMs: 2500 });
  } catch (e) {
    console.error(`  [error] ${p.out}: ${e.stack || e.message}`);
  }
}
process.exit(0);
