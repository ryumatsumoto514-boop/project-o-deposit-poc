import { newTab, closeTab, shot, BASE_URL } from "./screenshot.mjs";

const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `${BASE_URL}/`, out: "landing" },
  { url: `${BASE_URL}/?ref=kol_alex`, out: "landing-kol" },
  { url: `${BASE_URL}/login`, out: "login" },
  { url: `${BASE_URL}/deposit`, out: "deposit-amount", wallet: WALLET, chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: null, approvalMode: "exact", addressConfirmed: false } },
  { url: `${BASE_URL}/deposit/confirm`, out: "deposit-confirm", wallet: WALLET, chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", approvalMode: "exact", addressConfirmed: false } },
  { url: `${BASE_URL}/deposit/approve`, out: "deposit-approve", wallet: WALLET, chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", approvalMode: "exact", addressConfirmed: true } },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    console.log(`shooting ${job.out} (${job.url})`);
    await shot(page, job);
  } catch (e) {
    console.error(`  [error] ${job.out}:`, e.message);
  } finally {
    await closeTab(page.id);
  }
}
