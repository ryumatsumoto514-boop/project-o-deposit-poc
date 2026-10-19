import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/a00f4233-ad97-47c9-8476-313faa1fb9e5`,
  out: "dup-blocked-record",
  width: 375,
  height: 800,
  waitMs: 3500,
});
await closeTab(page.id);
console.log("done");
