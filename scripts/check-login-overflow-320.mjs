import { shot } from "./screenshot.mjs";

const CDP = "http://127.0.0.1:9333";

async function newTab() {
  const res = await fetch(`${CDP}/json/new`, { method: "PUT" });
  return res.json();
}
async function closeTab(id) {
  await fetch(`${CDP}/json/close/${id}`);
}

const page = await newTab();
try {
  await shot(page, {
    url: "https://projecto-blond.vercel.app/login",
    out: "login-320",
    width: 320,
    height: 700,
    waitMs: 1500,
  });
  console.log("saved /tmp/login-320.png");
} finally {
  await closeTab(page.id);
}
