import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const ID = process.argv[2];
if (!ID) {
  console.error("usage: node scripts/shot-exception-states.mjs <depositId>");
  process.exit(1);
}

const jobs = [
  { url: `${BASE_URL}/deposit/status/${ID}`, out: "status-stalled-mobile", width: 390, height: 844, mobile: true, waitMs: 2200 },
  { url: `${BASE_URL}/deposit/status/${ID}`, out: "status-stalled-desktop", width: 1280, height: 900, mobile: false, waitMs: 2200 },
];

for (const job of jobs) {
  const page = await newTab();
  await shot(page, job);
  await closeTab(page.id);
}
