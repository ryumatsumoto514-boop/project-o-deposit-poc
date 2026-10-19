import { newTab, closeTab, shot } from "./screenshot.mjs";
const page = await newTab();
await shot(page, { url: "http://localhost:3000/login", out: "vcenter-verify-login", width: 1440, height: 900, mobile: false, waitMs: 1200 });
await closeTab(page.targetId);
console.log("done");
