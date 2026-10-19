import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE = "https://projecto-blond.vercel.app";
const ID = "5edde5ff-c2dd-436f-985a-dfff19203ba8";
const tab = await newTab();
await shot(tab, {
  url: `${BASE}/deposit/status/${ID}`,
  out: "notfound-mobile-longwait",
  width: 375,
  height: 900,
  waitMs: 10000,
});
await closeTab(tab.id);
