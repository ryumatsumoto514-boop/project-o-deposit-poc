import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const routes = [
  { url: `${BASE}/`, out: "home" },
  { url: `${BASE}/login`, out: "login" },
  { url: `${BASE}/?ref=cryptoqueen`, out: "home-kol" },
];
for (const r of routes) {
  const page = await newTab();
  await shot(page, { url: r.url, out: r.out, width: 375, height: 812, waitMs: 1800 });
  await closeTab(page.id);
}
console.log("done");
