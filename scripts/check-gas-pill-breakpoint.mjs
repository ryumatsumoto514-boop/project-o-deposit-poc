import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const tab = await newTab();
await shot(tab, { url: `${BASE}/`, out: "home-640", width: 640, height: 500, waitMs: 2000 });
await shot(tab, { url: `${BASE}/`, out: "home-700", width: 700, height: 500, waitMs: 2000 });
await shot(tab, { url: `${BASE}/`, out: "home-768", width: 768, height: 500, waitMs: 2000 });
await closeTab(tab.id);
