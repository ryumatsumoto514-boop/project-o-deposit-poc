import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = process.argv[2] || "http://localhost:3201";
const page = await newTab();
await shot(page, { url: `${BASE}/login`, out: "vcenter-login.png", width: 1440, height: 900, mobile: false, waitMs: 1200 });
await closeTab(page.id);
console.log("done");
