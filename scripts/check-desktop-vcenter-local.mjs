import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "http://localhost:3099";
const OUT_DIR = "shots-out";

const page = await newTab();
await shot(page, { url: `${BASE_URL}/login`, out: "desktop-login-local-fixed", width: 1440, height: 900, mobile: false, waitMs: 1200 });
await closeTab(page.targetId);
console.log("done");
