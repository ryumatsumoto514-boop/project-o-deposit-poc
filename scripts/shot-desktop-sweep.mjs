import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-desktop-sweep";
const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_HEX = "0x66eee"; // Arbitrum Sepolia

const seedFlow = {
  mockIdentity: "google:demo.user",
  draftAmount: "125.50",
  kolRef: "kol_alex",
  approvalMode: "exact",
};
const seedFlowConfirmed = { ...seedFlow, addressConfirmed: true };

const pages = [
  { url: `${BASE}/?ref=kol_alex`, out: "01-home-kol-desktop" },
  { url: `${BASE}/login`, out: "02-login-desktop" },
  { url: `${BASE}/deposit`, out: "03-deposit-desktop", wallet: WALLET, chainIdHex: CHAIN_HEX, seedFlow },
  { url: `${BASE}/deposit/confirm`, out: "04-confirm-desktop", wallet: WALLET, chainIdHex: CHAIN_HEX, seedFlow },
  { url: `${BASE}/deposit/approve`, out: "05-approve-desktop", wallet: WALLET, chainIdHex: CHAIN_HEX, seedFlow: seedFlowConfirmed },
];

for (const p of pages) {
  const page = await newTab();
  try {
    await shot(page, {
      url: p.url,
      out: p.out,
      wallet: p.wallet,
      chainIdHex: p.chainIdHex,
      seedFlow: p.seedFlow,
      width: 1440,
      height: 900,
      mobile: false,
      waitMs: 1600,
    });
  } catch (e) {
    console.error(`  [error] ${p.out}: ${e.message}`);
  }
  await closeTab(page.id);
}
console.log("done");
