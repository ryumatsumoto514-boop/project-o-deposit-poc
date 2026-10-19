import { newTab, closeTab, shot } from "./screenshot.mjs";

const ID = process.argv[2];
if (!ID) {
  console.error("usage: node scripts/shot-status-pipeline.mjs <depositId>");
  process.exit(1);
}
const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/status/${ID}`,
  out: "status-320",
  wallet: WALLET,
  chainIdHex: "0x66eee",
  width: 320,
  height: 900,
  waitMs: 2500,
});
await closeTab(page.id);
console.log("done");
