import { newTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";

const page = await newTab();
await shot(page, { url: `${BASE}/login?ref=cryptoqueen`, out: "login-kol-ref-mobile", width: 375, height: 812, waitMs: 1800 });
