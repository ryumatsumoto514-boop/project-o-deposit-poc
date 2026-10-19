import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const seedFlow = {
  mockIdentity: "qa-cycle",
  draftAmount: "250.5",
  address: "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5",
};

let page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/approve`,
  out: "approve-desktop",
  width: 1440,
  height: 900,
  mobile: false,
  seedFlow,
  waitMs: 1800,
});
await closeTab(page.id);

page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/approve`,
  out: "approve-desktop-unlimited",
  width: 1440,
  height: 900,
  mobile: false,
  seedFlow,
  click: "Unlimited",
  waitMs: 1800,
});
await closeTab(page.id);
console.log("done");
