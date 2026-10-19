import { newTab, closeTab, shot, BASE_URL } from "./screenshot.mjs";

const WALLET = "0x9a11f5B6D8c2A7e4C1d3F0b8E6a9C4d7F2b1A3e5";
const CHAIN_ID_HEX = "0x66eee";

const jobs = [
  { url: `https://projecto-blond.vercel.app/?ref=kol_alex`, out: "01-landing-kol", width: 375, height: 1400 },
  { url: `https://projecto-blond.vercel.app/login?ref=kol_alex`, out: "02-login", width: 375, height: 900 },
  {
    url: `https://projecto-blond.vercel.app/deposit`,
    out: "03-deposit-amount",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "", approvalMode: "exact", addressConfirmed: false },
    width: 375,
    height: 1000,
  },
  {
    url: `https://projecto-blond.vercel.app/deposit/confirm`,
    out: "04-confirm",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.5", approvalMode: "exact", addressConfirmed: false },
    width: 375,
    height: 1000,
  },
  {
    url: `https://projecto-blond.vercel.app/deposit/approve`,
    out: "05-approve-exact",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.5", approvalMode: "exact", addressConfirmed: true },
    width: 375,
    height: 1000,
  },
  {
    url: `https://projecto-blond.vercel.app/deposit/approve`,
    out: "06-approve-unlimited",
    wallet: WALLET,
    chainIdHex: CHAIN_ID_HEX,
    seedFlow: { kolRef: "kol_alex", mockIdentity: WALLET, draftAmount: "42.5", approvalMode: "unlimited", addressConfirmed: true },
    width: 375,
    height: 1000,
  },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    console.log(`shooting ${job.out} (${job.url})`);
    await shot(page, { ...job, out: job.out, waitMs: 1800 });
  } catch (e) {
    console.error(`  [error] ${job.out}:`, e.message);
  } finally {
    await closeTab(page.id);
  }
}
