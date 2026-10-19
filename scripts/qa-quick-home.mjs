import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const tab = await newTab();
await shot(tab, { url: `${BASE}/`, out: "qa-home-375", width: 375, height: 1000, waitMs: 1500 });
await closeTab(tab.id);
