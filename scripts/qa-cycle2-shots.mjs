import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "/tmp/shots-c1";

const pages = [
  { url: `${BASE}/?ref=kol_alex`, out: "01-landing-kol" },
  { url: `${BASE}/login?ref=kol_alex`, out: "02-login-kol" },
  { url: `${BASE}/deposit?ref=kol_alex`, out: "03-deposit" },
  { url: `${BASE}/deposit/confirm?ref=kol_alex`, out: "04-confirm" },
];

for (const p of pages) {
  const tab = await newTab();
  try {
    await shot({ ...tab }, { url: p.url, out: p.out, waitMs: 1800 });
  } catch (e) {
    console.error(`  [error] ${p.out}: ${e.message}`);
  }
}
process.exit(0);
