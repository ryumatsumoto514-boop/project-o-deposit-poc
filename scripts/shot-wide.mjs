import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT = "shots-wide";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

const targets = [
  { url: `${BASE}/`, out: "home-1024", width: 1024, height: 900, mobile: false },
  { url: `${BASE}/`, out: "home-768", width: 768, height: 900, mobile: false },
  { url: `${BASE}/login`, out: "login-1024", width: 1024, height: 900, mobile: false },
  { url: `${BASE}/deposit`, out: "deposit-1024", width: 1024, height: 1000, mobile: false, wallet: WALLET, chainIdHex: "0x66eee" },
  { url: `${BASE}/deposit/approve`, out: "approve-1024", width: 1024, height: 1000, mobile: false, wallet: WALLET, chainIdHex: "0x66eee", seedFlow: { amount: "25", scope: "exact" } },
  { url: `${BASE}/deposit/confirm`, out: "confirm-1024", width: 1024, height: 1000, mobile: false, wallet: WALLET, chainIdHex: "0x66eee", seedFlow: { amount: "25", scope: "exact" } },
];

for (const t of targets) {
  const page = await newTab();
  try {
    await shot(page, t);
  } catch (e) {
    console.error(`  [error] ${t.out}: ${e.message}`);
  } finally {
    await closeTab(page.id);
  }
}
