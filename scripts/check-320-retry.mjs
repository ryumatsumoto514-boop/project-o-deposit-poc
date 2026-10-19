import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

const pages = [
  { url: `${BASE}/login`, out: "02-login" },
  {
    url: `${BASE}/deposit`,
    out: "03-deposit",
    wallet: WALLET,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "", approvalMode: "exact", addressConfirmed: false },
  },
];

for (const p of pages) {
  const page = await newTab();
  try {
    await shot(page, { ...p, width: 320, height: 568, mobile: true, waitMs: 2000 });
  } catch (e) {
    console.error(`  [error] ${p.out}: ${e.message}`);
  } finally {
    await closeTab(page.id ?? page.targetId);
  }
}
console.log("done");
