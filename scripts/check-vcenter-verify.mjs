import { newTab, closeTab, shot } from "./screenshot.mjs";
const page = await newTab();
await shot(page, { url: "http://localhost:3200/login", out: "vcenter-fresh-1440", width: 1440, height: 900, mobile: false, waitMs: 1000 });
await shot(page, { url: "http://localhost:3200/login", out: "vcenter-fresh-375", width: 375, height: 812, mobile: true, waitMs: 1000 });
await closeTab(page.id);
console.log("done");
