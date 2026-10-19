import { newTab, closeTab, shot } from "./screenshot.mjs";
const BASE_URL = "https://projecto-blond.vercel.app";
const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const runs = [
  { url: `${BASE_URL}/deposit/confirm`, out: "ab-confirm-1",
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user" } },
  { url: `${BASE_URL}/deposit/approve`, out: "ab-approve-1",
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user", addressConfirmed: true } },
  { url: `${BASE_URL}/deposit/confirm`, out: "ab-confirm-2",
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user" } },
  { url: `${BASE_URL}/deposit/approve`, out: "ab-approve-2",
    seedFlow: { draftAmount: "125.50", approvalMode: "exact", kolRef: "cryptoalpha", mockIdentity: "demo.user", addressConfirmed: true } },
];

for (const r of runs) {
  const page = await newTab();
  await shot(page, { ...r, wallet: WALLET, chainIdHex: CHAIN_ID_HEX, width: 375, height: 812, waitMs: 3000 });
  await closeTab(page.id);
}
