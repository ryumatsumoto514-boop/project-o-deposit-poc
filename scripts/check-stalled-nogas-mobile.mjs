import { newTab, closeTab, shot } from "./screenshot.mjs";

const ID = "1b076e85-5e0b-4c59-a9bd-35099b95afa4";
const page = await newTab();
await shot(page, {
  url: `https://projecto-blond.vercel.app/deposit/status/${ID}`,
  out: "stalled-no-gas-375",
  width: 375,
  height: 1400,
  waitMs: 5000,
});
await closeTab(page.id);
