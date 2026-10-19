import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-out";

const page = await newTab();
await shot(page, { url: `${BASE_URL}/login`, out: "desktop-login-live", width: 1440, height: 900, mobile: false, waitMs: 1500 });
await closeTab(page.targetId);
console.log("done");
