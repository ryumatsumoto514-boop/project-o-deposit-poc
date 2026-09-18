import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `${BASE_URL}/`, out: "m-landing" },
  { url: `${BASE_URL}/?ref=kol_alex`, out: "m-landing-kol", waitMs: 1800 },
  { url: `${BASE_URL}/login`, out: "m-login" },
  {
    url: `${BASE_URL}/deposit`,
    out: "m-deposit-amount",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET },
  },
  {
    url: `${BASE_URL}/deposit/confirm`,
    out: "m-deposit-confirm",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: null, mockIdentity: WALLET, draftAmount: "42.0" },
  },
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "m-deposit-approve",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: {
      kolRef: null,
      mockIdentity: WALLET,
      draftAmount: "42.0",
      addressConfirmed: true,
    },
  },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    console.log(`shooting ${job.out} (${job.url})`);
    await shot(page, { ...job, width: 375, height: 812, mobile: true });
  } catch (e) {
    console.error(`  [error] ${job.out}:`, e.message);
  } finally {
    await closeTab(page.id);
  }
}
