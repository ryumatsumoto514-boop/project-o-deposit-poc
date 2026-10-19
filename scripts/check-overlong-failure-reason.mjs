import { newTab, closeTab, shot } from "./screenshot.mjs";

const ID = process.argv[2];
const BASE = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-out";

const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/${ID}`,
  out: "overlong-failure-reason-mobile",
  width: 375,
  height: 812,
  waitMs: 2000,
});
await closeTab(page.id);
console.log("done");
