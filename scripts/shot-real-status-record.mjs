import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/99a1412f-c52c-432c-9a45-f096288aca97`,
  out: "real-status-record",
  width: 375,
  height: 1200,
  waitMs: 6000,
});
await closeTab(page.id);
console.log("done");
