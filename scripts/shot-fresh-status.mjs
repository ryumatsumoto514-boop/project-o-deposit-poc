import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/4159d6ac-56e3-4f2f-a554-86f8b922cefd`,
  out: "fresh-status-signed",
  width: 390,
  height: 1400,
  waitMs: 4000,
});
await closeTab(page.id);
console.log("done");
