# Project O — Challenge 1 PoC: Deposit Reconciliation Engine

## Context
You are building a PoC for a hiring assignment. It simulates part of "Exchange O," a
KOL-driven DEX (like a crypto trading app promoted via influencers) where users:
1. Come from a KOL's link (with an attribution/referral param)
2. Sign up via Privy-style auth (email/Google/wallet) — MOCK this, no real Privy needed
3. Deposit USDC on Arbitrum
4. That USDC needs to end up as tradable collateral on Hyperliquid (a perps exchange)

## The problem being solved
Today (in the real product), once a user signs a deposit transaction, the app only
shows "pending" until a transaction receipt appears — but a receipt is NOT the same
as funds actually being usable/tradable on Hyperliquy. There is a real, undisclosed
gap between "tx confirmed on-chain" and "collateral credited and tradable."
This causes real problems: users panic, think the deposit failed, and re-deposit
(losing money to duplicate deposits), or abandon out of confusion. This is a
documented real-world issue (search "hyperliquid deposit stuck reddit" confirms it).

## The ONE feature to build: a Deposit Reconciliation Engine
NOT just a prettier loading spinner. Build a real backend state machine that:

1. **Creates a deposit record with a unique ID the moment the user signs**, before
   any confirmation — with fields: id, user wallet (funding source), destination
   account (trading/Hyperliquid address), amount, asset, source chain, status,
   created_at, tx_hash (nullable at first).

2. **Tracks explicit states** (not just "pending"/"done"):
   - `SIGNED` — user signed, broadcasting
   - `CONFIRMED_ONCHAIN` — tx confirmed on source chain (Arbitrum Sepolia testnet)
   - `BRIDGING` — moving toward Hyperliquid (simulate this delay, e.g. 15-30s mock)
   - `CREDITED` — collateral now reflected & tradable (the ONLY true "done" state)
   - `STALLED_NO_GAS` — detected the wallet has no gas token for a step
   - `STALLED_TIMEOUT` — expected time exceeded, needs investigation
   - `AMBIGUOUS` — on-chain says confirmed but Hyperliquid-side balance check
     disagrees after expected window — flag for reconciliation, don't silently retry

3. **Reconciliation logic**: the engine independently checks BOTH sides —
   (a) the actual source-chain tx status via RPC, and
   (b) a MOCK "Hyperliquid balance" check (since we don't have real Hyperliquid
   testnet access) — and only marks CREDITED when both agree. If they disagree
   past a time threshold, state becomes AMBIGUOUS, not silently "pending forever."

4. **Idempotency / duplicate-deposit protection**: if a user tries to deposit again
   while a deposit with the same wallet+amount is still in-flight (not CREDITED),
   the UI blocks it and shows: "You already have a deposit in progress for this
   amount, opened at [time]. Do not send again — here's its current status."
   This directly targets the real "duplicate deposit" failure mode.

## Real testnet transaction requirement (MUST be real, not simulated)
- Use **Arbitrum Sepolia testnet** (public, free faucet ETH + testnet USDC exists)
- The happy-path flow must include ONE real state-changing transaction:
  an ERC-20 `approve()` call for an EXACT amount (not unlimited/infinite —
  this is one of our "minor improvements", see below) on a testnet USDC contract,
  OR a real transfer of testnet USDC to a "deposit" address.
  Prefer: approve(exact amount) + transferFrom simulating the deposit contract call.
- We do NOT have real Hyperliquid testnet access — the "CREDITED" / Hyperliquid-side
  check is explicitly a MOCK. This must be clearly labeled in the UI and README.
- Store the resulting tx hash + explorer link (Arbiscan Sepolia) in the deposit record.

## The 5 minor UX improvements to layer on top (still part of ONE feature — "make
every step of depositing transparent and honest" — not separate features):

1. **Exact-amount token approval, not infinite** — when requesting ERC-20 approval,
   request only the deposit amount. Show a toggle "approve this amount only"
   (default, recommended) vs "approve for future deposits too" (labeled clearly as
   higher risk: "this lets the app spend more in the future without asking again").
   TAILORED TO: "users who must independently review... approval scope."

2. **Plain-language failure classification** — instead of a spinner, if something
   is wrong, say specifically: "You don't have enough ETH on Arbitrum to pay the
   network fee" vs "This is taking longer than usual, here's why" vs "Something
   went wrong, here's what to do." TAILORED TO: "users unfamiliar with bridges,
   gas tokens, and token contracts" — assume ZERO crypto background in copy.

3. **Full-address confirmation step before signing** — show the complete
   destination address (not truncated "0x1234...5678"), with a short plain-language
   note: "Double check this matches what you expect — scammers sometimes use
   addresses that look almost identical." TAILORED TO: mobile users who are used
   to fast checkout flows and might not scrutinize a wallet address; defends
   against real "address poisoning" scams.

4. **Explicit wallet-role labels** — since login wallet, funding wallet, and
   trading account can differ, EVERY screen must label which is which:
   "Signing in as: [x]" / "Funds coming from: [x]" / "Will be tradable in: [x]"
   — never a bare "your wallet." TAILORED TO: brief's explicit wallet-mismatch
   scenario; also protects Korean CEX withdrawers who are used to one clear
   "my account," not three separate addresses.

5. **Mobile-first, KOL-attribution-aware entry** — the flow starts from a mock
   "KOL link" (e.g. /?ref=kol_alex) that carries attribution through the whole
   deposit flow, and shows a small persistent disclosure banner: "You arrived via
   [KOL Alex]'s content. Exchange O is independent — deposit and trading
   decisions are yours alone." TAILORED TO: "mobile users who arrive via a KOL's
   content" + brief's requirement to disclose KOL source/conflict of interest.
   This banner is NOT a marketing widget — it's a compliance/trust disclosure.

## Tech stack (fast to ship, all free-tier deployable)
- Next.js 14 (App Router) + TypeScript, single deployable app (frontend + API routes)
- wagmi + viem for wallet connect & on-chain calls (use injected/MetaMask connector,
  no need for real Privy SDK — mock the "login" step, but the actual deposit tx
  signing must be REAL via a real testnet wallet)
- In-memory or simple JSON-file/SQLite store for deposit records (PoC scope — no
  need for a real database; document this limitation in README)
- Network: Arbitrum Sepolia (chainId 421614). Use a public testnet USDC contract
  (or deploy a minimal mock ERC20 if no testnet USDC is reliably available —
  research this and pick whichever is more reliable to demo)
- Deploy target: Vercel

## Deliverables in this repo
- `/app` — Next.js app with the flow: landing (KOL link) → mock login → deposit
  amount+asset screen → address confirmation → approval (exact amount toggle) →
  signing → live status tracker (state machine UI) → credited/tradable screen
  → exception screens (stalled/no-gas/ambiguous/duplicate-blocked)
- `/lib` — reconciliation engine logic, state machine, mock Hyperliquid balance
  checker, idempotency check
- `README.md` — MUST include: live deployment URL, setup/run instructions, exactly
  which parts are live testnet vs mocked (be very explicit), testnet tx hash +
  explorer link once we have one, known limitations, primary metric + guardrails
- Keep it lean — this is a PoC, not production. Focus on the reconciliation engine
  and state transparency being REAL and functional, not visual polish.

## What to prioritize if time-constrained
1. Real testnet approve+transfer transaction working end to end (MUST work)
2. Real reconciliation state machine with the states listed above (MUST work)
3. Duplicate-deposit blocking (MUST work — this is the core hypothesis validation)
4. The 5 UX layers (nice to have, keep simple, don't over-engineer visuals)
5. Deployment to Vercel (MUST work, must be reachable without local install)

Work in small commits. Test the actual testnet transaction path yourself before
declaring done — do not claim a transaction succeeded without a real tx hash you
can show on Arbiscan Sepolia (https://sepolia.arbiscan.io).
