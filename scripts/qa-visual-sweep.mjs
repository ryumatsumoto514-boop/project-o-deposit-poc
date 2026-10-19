import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `${BASE_URL}/`, out: "sweep-home", seedFlow: null },
  { url: `${BASE_URL}/login`, out: "sweep-login", seedFlow: null },
  { url: `${BASE_URL}/deposit`, out: "sweep-deposit", seedFlow: { kolRef: "cryptoqueen", mockIdentity: "email" } },
  { url: `${BASE_URL}/deposit/confirm`, out: "sweep-confirm", seedFlow: { kolRef: "cryptoqueen", mockIdentity: "email", draftAmount: "42.5" } },
  { url: `${BASE_URL}/deposit/approve`, out: "sweep-approve", seedFlow: { kolRef: "cryptoqueen", mockIdentity: "email", draftAmount: "42.5", addressConfirmed: true } },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    await shot(page, { ...job, wallet: WALLET, chainIdHex: CHAIN_ID_HEX, width: 390, height: 844, waitMs: 1800 });
  } finally {
    await closeTab(page.id);
  }
}
