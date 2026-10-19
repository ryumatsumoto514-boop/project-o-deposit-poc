import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
// screenshot.mjs's own OUT_DIR (module-scoped, defaults to "shots-out" when
// imported without CLI args) is what shot() actually writes to — not a local const.
const WALLET = "0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37";

const pages = [
  { url: `${BASE}/?ref=kol_alex`, out: "01-home" },
  { url: `${BASE}/login`, out: "02-login" },
  {
    url: `${BASE}/deposit`,
    out: "03-deposit",
    wallet: WALLET,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/confirm`,
    out: "04-confirm",
    wallet: WALLET,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: false },
  },
  {
    url: `${BASE}/deposit/approve`,
    out: "05-approve",
    wallet: WALLET,
    seedFlow: { kolRef: "kol_alex", mockIdentity: "demo.user", draftAmount: "125.50", approvalMode: "exact", addressConfirmed: true },
  },
];

for (const p of pages) {
  const page = await newTab();
  try {
    await shot(page, { ...p, out: p.out, width: 320, height: 568, mobile: true, waitMs: 1800 });
  } catch (e) {
    console.error(`  [error] ${p.out}: ${e.message}`);
  } finally {
    await closeTab(page.id ?? page.targetId);
  }
}
console.log("done");
