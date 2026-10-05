import { newTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `${BASE_URL}/deposit`, out: "01-deposit", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "", addressConfirmed: false } },
  { url: `${BASE_URL}/deposit/confirm`, out: "02-confirm", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.5", addressConfirmed: false } },
  { url: `${BASE_URL}/deposit/approve`, out: "03-approve", seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.5", addressConfirmed: true } },
];

for (const job of jobs) {
  const page = await newTab();
  await shot(page, { url: job.url, out: job.out, wallet: WALLET, chainIdHex: CHAIN_ID_HEX, seedFlow: job.seedFlow, width: 375, height: 812 });
}
