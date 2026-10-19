import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "http://localhost:3100";

const page = await newTab();
await shot(page, { url: `${BASE_URL}/login`, out: "vcenter-login-1440", width: 1440, height: 900, mobile: false, waitMs: 1200 });
await shot(page, { url: `${BASE_URL}/deposit`, out: "vcenter-deposit-1440", width: 1440, height: 900, mobile: false, waitMs: 1200 });
await closeTab(page.targetId);
console.log("done");
