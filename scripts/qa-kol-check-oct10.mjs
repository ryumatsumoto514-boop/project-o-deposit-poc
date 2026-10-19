import { newTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "shots-out/qa-kol-oct10";

const targets = [
  { url: `${BASE}/?ref=cryptoqueen`, out: "home-kol-ref-mobile", width: 375, height: 812 },
  { url: `${BASE}/login?ref=cryptoqueen`, out: "login-kol-ref-mobile", width: 375, height: 812 },
];

for (const t of targets) {
  const page = await newTab();
  await shot(page, { ...t, waitMs: 1800 });
}
