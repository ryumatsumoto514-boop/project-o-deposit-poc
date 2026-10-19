import { newTab, closeTab, shot } from "./screenshot.mjs";

const page = await newTab();
await shot(page, {
  url: "http://localhost:3100/login",
  out: "vcenter-local-login",
  width: 1440,
  height: 900,
  mobile: false,
  waitMs: 800,
});
await closeTab(page.id);
console.log("done");
