import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "/tmp/approve-toggle-shots";

const seedFlow = {
  state: {
    kolRef: "kol_alex",
    amount: "100",
    destinationWallet: "0x2222222222222222222222222222222222222222",
  },
};

const page = await newTab();
await shot(page, {
  url: `${BASE}/deposit/approve`,
  out: "approve-initial",
  wallet: "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37",
  chainIdHex: "0x66eee",
  seedFlow,
  waitMs: 9500,
  width: 390,
  height: 844,
});
await closeTab(page.id);
console.log("done ->", OUT);
