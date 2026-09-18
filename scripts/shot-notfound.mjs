import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE_URL = "https://projecto-blond.vercel.app";
const jobs = [
  { url: `${BASE_URL}/deposit/status/does-not-exist-123`, out: "status-notfound", waitMs: 1800 },
];

for (const job of jobs) {
  const page = await newTab();
  try {
    await shot(page, job);
  } finally {
    await closeTab(page.id);
  }
}
