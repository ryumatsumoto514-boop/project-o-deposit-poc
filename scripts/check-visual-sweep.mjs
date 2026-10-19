import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "/tmp/visual-sweep";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";

import fs from "node:fs";
fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { url: `${BASE_URL}/?ref=cryptowhale_jp_official_trading_signals_2024`, out: "home-kol-mobile", width: 375, height: 812 },
  { url: `${BASE_URL}/?ref=cryptowhale_jp_official_trading_signals_2024`, out: "home-kol-tablet", width: 768, height: 1024 },
  { url: `${BASE_URL}/login`, out: "login-mobile", width: 375, height: 812 },
  { url: `${BASE_URL}/deposit`, out: "deposit-mobile", wallet: WALLET, chainIdHex: "0x66eee", width: 375, height: 812 },
  { url: `${BASE_URL}/deposit/confirm`, out: "confirm-mobile", wallet: WALLET, chainIdHex: "0x66eee", width: 375, height: 812 },
  { url: `${BASE_URL}/deposit/approve`, out: "approve-mobile", wallet: WALLET, chainIdHex: "0x66eee", width: 375, height: 812 },
];

for (const t of targets) {
  try {
    const page = await newTab();
    await shot(page, { ...t, waitMs: 1600 });
    await closeTab(page.targetId);
  } catch (e) {
    console.error(`  [FAIL] ${t.out}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
console.log("done");
