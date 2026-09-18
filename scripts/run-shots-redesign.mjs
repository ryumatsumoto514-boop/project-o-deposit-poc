import { newTab, closeTab, shot, BASE_URL } from "./screenshot.mjs";

const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee"; // 421614, Arbitrum Sepolia

const MOBILE = { width: 375, height: 812, mobile: true };
const DESKTOP = { width: 1440, height: 900, mobile: false };

const jobs = [
  { url: `${BASE_URL}/`, out: "m-landing", ...MOBILE },
  { url: `${BASE_URL}/`, out: "d-landing", ...DESKTOP, waitMs: 1500 },
  { url: `${BASE_URL}/?ref=kol_alex`, out: "m-landing-kol", ...MOBILE },
  { url: `${BASE_URL}/login`, out: "m-login", ...MOBILE },
  { url: `${BASE_URL}/login`, out: "d-login", ...DESKTOP },
  {
    url: `${BASE_URL}/deposit`,
    out: "m-deposit-connected",
    ...MOBILE,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE_URL}/deposit/confirm`,
    out: "m-confirm",
    ...MOBILE,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "m-approve",
    ...MOBILE,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", approvalMode: "exact", addressConfirmed: true },
  },
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "d-approve",
    ...DESKTOP,
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0", approvalMode: "exact", addressConfirmed: true },
  },
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
