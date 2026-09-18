import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  {
    url: `${BASE_URL}/deposit/approve`,
    out: "qa-deposit-approve-full",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.0", addressConfirmed: true },
    waitMs: 1400,
    height: 1900,
  },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    await shot(page, job);
  } finally {
    await closeTab(page.id);
  }
}
