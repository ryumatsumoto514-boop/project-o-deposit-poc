// One-off QA: screenshot the live KOL banner (landing, ?ref=kol_alex) and
// the wallet-role labeling on /deposit/confirm, plus collect console errors.
import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = process.argv[2] || "https://projecto-blond.vercel.app";
const OUT_DIR = process.argv[3] || "/tmp/qa-kol";
const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";

const page = await newTab();
await shot(page, {
  url: `${BASE_URL}/?ref=kol_alex`,
  out: "landing-kol",
  waitMs: 1500,
});
await shot(page, {
  url: `${BASE_URL}/deposit/confirm`,
  out: "confirm-walletroles",
  wallet: WALLET,
  chainIdHex: "0x66eee",
  seedFlow: {
    kolRef: "kol_alex",
    mockIdentity: "demo-reviewer@exchangeo.test",
    draftAmount: "42.0",
    approvalMode: "exact",
    addressConfirmed: false,
  },
  waitMs: 1500,
});
await closeTab(page.id);
console.log("done");
