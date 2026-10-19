import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE_URL = "https://projecto-blond.vercel.app";
const OUT_DIR = "/tmp/qa-now";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
import fs from "node:fs";
fs.mkdirSync(OUT_DIR, { recursive: true });

const jobs = [
  { out: "01-home", url: `${BASE_URL}/`, wallet: null },
  { out: "02-login-kol", url: `${BASE_URL}/login?ref=kol_alex`, wallet: null },
  { out: "03-deposit-empty", url: `${BASE_URL}/deposit`, wallet: WALLET, seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "", approvalMode: "exact", addressConfirmed: false } },
  { out: "04-deposit-filled", url: `${BASE_URL}/deposit`, wallet: WALLET, seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false } },
  { out: "05-confirm", url: `${BASE_URL}/deposit/confirm`, wallet: WALLET, seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false } },
  { out: "06-approve-exact", url: `${BASE_URL}/deposit/approve`, wallet: WALLET, seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: true } },
  { out: "07-approve-unlimited", url: `${BASE_URL}/deposit/approve`, wallet: WALLET, seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "unlimited", addressConfirmed: true } },
  { out: "08-status-missing", url: `${BASE_URL}/deposit/status/qa-now-missing`, wallet: WALLET },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    await shot(page, { url: job.url, out: job.out, wallet: job.wallet, chainIdHex: "0x66eee", seedFlow: job.seedFlow, waitMs: 1600, width: 375, height: 812 });
  } catch (e) {
    console.error(`  [error] ${job.out}: ${e.message}`);
  } finally {
    await closeTab(page.id);
  }
}
console.log("done");
