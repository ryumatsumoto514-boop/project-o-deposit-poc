import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `${BASE_URL}/`, out: "qa-landing", waitMs: 1200 },
  { url: `${BASE_URL}/?ref=kol_alex`, out: "qa-landing-kol", waitMs: 1200 },
  { url: `${BASE_URL}/login`, out: "qa-login", waitMs: 1200 },
  {
    url: `${BASE_URL}/deposit`,
    out: "qa-deposit-amount",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET },
    waitMs: 1400,
  },
  {
    url: `${BASE_URL}/deposit/confirm`,
    out: "qa-deposit-confirm",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0" },
    waitMs: 1400,
  },
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "qa-deposit-approve",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true },
    waitMs: 1400,
  },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    console.log(`shooting ${job.out}`);
    await shot(page, job);
  } catch (e) {
    console.error(`  [error] ${job.out}:`, e.message);
  } finally {
    await closeTab(page.id);
  }
}
