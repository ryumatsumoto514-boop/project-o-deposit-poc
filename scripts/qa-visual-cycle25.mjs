import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "/tmp/qa25";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const fs = await import("node:fs");
fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { url: `${BASE_URL}/`, out: "home-375" },
  { url: `${BASE_URL}/login`, out: "login-375" },
  { url: `${BASE_URL}/deposit`, out: "deposit-375", wallet: WALLET },
  { url: `${BASE_URL}/deposit/confirm`, out: "confirm-375", wallet: WALLET,
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user" } },
  { url: `${BASE_URL}/deposit/approve`, out: "approve-375", wallet: WALLET,
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user", addressConfirmed: true } },
  { url: `${BASE_URL}/deposit/approve`, out: "approve-unlimited-375", wallet: WALLET,
    seedFlow: { draftAmount: "125.50", approvalMode: "unlimited", kolRef: "cryptoalpha", mockIdentity: "demo.user", addressConfirmed: true } },
];

for (const t of targets) {
  const page = await newTab();
  await shot(page, { ...t, chainIdHex: CHAIN_ID_HEX, width: 375, height: 812, waitMs: 2200 });
  await closeTab(page.id);
}
console.log("done");
