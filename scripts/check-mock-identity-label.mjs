import { newTab, closeTab, shot } from "./screenshot.mjs";

const BASE = "https://projecto-blond.vercel.app";
const page = await newTab();
try {
  await shot(page, {
    url: `${BASE}/login`,
    out: "identity-label-login",
    width: 390,
    height: 500,
    seedFlow: { mockIdentity: "google:demo.user", draftAmount: "", approvalMode: "exact", addressConfirmed: false, kolRef: null },
    waitMs: 1200,
  });
} finally {
  await closeTab(page.id);
}
console.log("done");
