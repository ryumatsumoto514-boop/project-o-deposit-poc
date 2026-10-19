import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const page = await newTab();
await shot(page, { url: `${BASE}/?ref=kol_alex`, out: "kolcheck-tall", width: 390, height: 1400, mobile: true, waitMs: 1500 });
await closeTab(page.id ?? page.targetId);
