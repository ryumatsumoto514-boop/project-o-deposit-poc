import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const ID = "5edde5ff-c2dd-436f-985a-dfff19203ba8";

const tab = await newTab();
await shot(tab, {
  url: `${BASE}/deposit/status/${ID}`,
  out: "stalled-no-gas-mobile",
  width: 375,
  height: 900,
  waitMs: 2000,
});
await closeTab(tab.id);
