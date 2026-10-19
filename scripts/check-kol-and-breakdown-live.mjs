import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const OUT_DIR = "shots-kol-check";
import fs from "node:fs";
fs.mkdirSync(OUT_DIR, { recursive: true });

const wallet = "0xAbC1230000000000000000000000000000dEaD";

async function run() {
  // 1. KOL-referred landing on mobile
  let page = await newTab();
  await shot(page, { url: `${BASE}/login?ref=cyberwhale`, out: "01-login-kol-ref", width: 375, height: 812 });
  await closeTab(page.id);

  // 2. Deposit confirm screen (address confirmation + wallet-role labeling), seeded flow, mobile
  page = await newTab();
  await shot(page, {
    url: `${BASE}/deposit/confirm`,
    out: "02-confirm-address",
    width: 375,
    height: 812,
    seedFlow: {
      kolRef: "cyberwhale",
      wallet,
      amount: "250.50",
      approvalMode: "exact",
      sourceChainId: 421614,
    },
  });
  await closeTab(page.id);

  // 3. Deposit amount entry page with KOL banner, mobile
  page = await newTab();
  await shot(page, {
    url: `${BASE}/deposit`,
    out: "03-deposit-amount",
    width: 375,
    height: 812,
    seedFlow: { kolRef: "cyberwhale", wallet },
  });
  await closeTab(page.id);

  // 4. Status tracker screen (desktop width to see breakdown clearly)
  page = await newTab();
  await shot(page, {
    url: `${BASE}/deposit/approve`,
    out: "04-approve",
    width: 390,
    height: 844,
    seedFlow: {
      kolRef: "cyberwhale",
      wallet,
      amount: "250.50",
      approvalMode: "exact",
      sourceChainId: 421614,
      destination: "0x00000000000000000000000000000000001234",
    },
  });
  await closeTab(page.id);

  console.log("done");
}

run();
