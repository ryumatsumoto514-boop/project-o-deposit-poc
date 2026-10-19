import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "/tmp/qa-shots";

const targets = [
  { url: `${BASE}/?ref=cryptokol_dave`, out: "landing-kol-mobile", width: 375, height: 812 },
  { url: `${BASE}/login?ref=cryptokol_dave`, out: "login-kol-mobile", width: 375, height: 812 },
  { url: `${BASE}/?ref=cryptokol_dave`, out: "landing-kol-desktop", width: 1440, height: 900, mobile: false },
];

for (const t of targets) {
  const page = await newTab();
  await shot(page, { ...t, waitMs: 1500 });
  await closeTab(page.id);
}
