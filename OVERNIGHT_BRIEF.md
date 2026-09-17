# Project O PoC — Overnight Autonomous Work Brief

You are continuing work on a hiring-assignment PoC while the user (Ryu) sleeps.
He wants this DONE and polished by 8:00am. You will be woken periodically by
cron — each wake, assess state and keep pushing forward. NEVER wait idly for
the user; he is asleep and cannot answer questions. Make the best reasonable
product decision yourself and keep moving. Log major decisions in
/opt/data/projecto/OVERNIGHT_LOG.md (append, don't overwrite) so he can review
in the morning.

## Location & context
- Project: /opt/data/projecto (Next.js 14 + TypeScript + wagmi/viem app)
- Full spec: /opt/data/projecto/SPEC.md — READ THIS FIRST every wake, it has
  the complete assignment brief and feature spec.
- This is a Project O (KOL-driven DEX) hiring PM assignment, Challenge 1:
  Deposit Breakdown & Improvement. Feature: a Deposit Reconciliation Engine
  that gives users real visibility into deposit state (signed -> confirmed
  on-chain -> bridging -> credited/tradable) instead of a silent spinner,
  plus 5 UX layers (exact-amount approval, plain-language failure states,
  full address confirmation, wallet-role labeling, KOL attribution banner).
- GitHub repo: https://github.com/ryumatsumoto514-boop/project-o-deposit-poc
  (gh CLI is authenticated as GH_TOKEN env var if needed, or already logged
  in via `gh auth status` — check first)
- Vercel: `vercel` CLI is installed at /opt/data/npm-global/bin/vercel,
  authenticate with VERCEL_TOKEN if needed (ask nothing — if you don't have
  the token cached, check /opt/data/projecto/.env.local or prior shell
  history; if truly unavailable, still finish everything else and leave
  deployment as the last documented open step)
- Claude Code CLI is installed and logged in (OAuth via Claude Pro, already
  authenticated) — use it via `claude -p "task" --max-turns N` (print mode,
  non-interactive, preferred) for actual code-writing to conserve resources.
  Check `claude auth status` first; if session expired you'll need to do the
  coding yourself directly instead.
- Real testnet wallets already generated (throwaway, no real funds):
  - Relayer: 0xCEfAe626B7CFfC6Ab72f7df4F9609018Ee5a09a6 (private key in
    .env.local as ARBITRUM_RELAYER_PRIVATE_KEY) — should have ~0.045 ETH on
    Arbitrum Sepolia via a bridge from Ethereum Sepolia (check
    scripts/poll-bridge.js output / just check balance directly via RPC)
  - Test user wallet: 0x1e9d508D55eCE8D36Ec3Aa94299EC943c4f4Eb37 (private
    key was generated but check .env.local or regenerate if lost — this
    wallet needs Arbitrum Sepolia ETH + testnet USDC to execute the actual
    deposit flow test)
- Bridge script: scripts/bridge-relayer-eth.js and scripts/poll-bridge.js
  bridge ETH from Ethereum Sepolia -> Arbitrum Sepolia via @arbitrum/sdk
  (no browser needed). Reuse this pattern for the test wallet if it still
  needs funding — check its L1 Sepolia balance first (it likely has none;
  in that case, see "if you get stuck" below for alternatives).

## PRIMARY GOAL (in priority order — do NOT skip ahead, each depends on prior)
1. **Verify/complete the reconciliation engine backend** — read lib/*.ts,
   confirm all states from SPEC.md exist and work (SIGNED, CONFIRMED_ONCHAIN,
   BRIDGING, CREDITED, STALLED_NO_GAS, STALLED_TIMEOUT, AMBIGUOUS), confirm
   idempotency/duplicate-deposit blocking actually works (test it: call the
   API twice with the same params, second call should be blocked/warned).
2. **Get ONE real testnet transaction executed and recorded** — this is a
   HARD REQUIREMENT for the assignment. Use the relayer's own funded wallet
   if needed (it can act as BOTH the "user" and relayer for a technical
   proof, since we don't have a real MetaMask session available overnight —
   document this honestly as a scripted test rather than a manual UI
   click-through, since the user isn't available to click through it
   himself). Write a Node script that: connects to Arbitrum Sepolia,
   approves an exact USDC amount from the relayer wallet to itself (or to a
   second address you control), then calls transferFrom — capturing BOTH
   tx hashes. If the test wallet (0x1e9d508D...) has funds, use IT as the
   "user" and the relayer as the "spender/depositor" for a more faithful
   simulation. If USDC isn't available on either wallet, get testnet USDC
   from https://faucet.circle.com via curl if the API allows unauthenticated
   POST requests, or via a headless request if possible — if genuinely
   blocked, fall back to using a minimal mock ERC20 you deploy yourself
   (write and deploy a tiny ERC20 test token contract via Foundry/Hardhat
   or web3 script if not already available — this is a legitimate PoC-scope
   substitution, just document it clearly as "official Circle testnet USDC
   was unavailable at build time; a self-deployed mock ERC20 with identical
   approve/transferFrom semantics was used instead").
   RECORD: tx hash, block number, explorer link (sepolia.arbiscan.io),
   before/after balance and allowance state, in testnet-evidence.md.
3. **Wire the full UI flow end-to-end** and confirm each of these actually
   renders and functions when you run `npm run dev` and curl/test the pages:
   landing (KOL link + disclosure banner) -> mock login -> connect wallet ->
   amount entry -> full address confirmation -> approval scope toggle
   (exact vs unlimited) -> signing -> live status tracker (poll and show
   real state transitions) -> credited/success screen -> exception screens
   (STALLED_NO_GAS, AMBIGUOUS, duplicate-blocked). If wagmi wallet connection
   can't be tested without a real browser+extension, at minimum verify the
   API routes and state machine logic work via curl/script, and that the UI
   renders without crashing (check with curl against localhost:3000 and any
   Next.js build errors).
4. **UI/UX polish — this matters, don't leave it looking like a bare
   AI-generated scaffold.** Spend real effort here:
   - Consistent visual design system (spacing, typography scale, color
     palette — pick something clean and modern, e.g. a dark fintech look
     or clean light mode, but be CONSISTENT throughout)
   - Real icons/visual state indicators for the status tracker (not just
     text labels — use simple SVG icons, progress indicators, color coding)
   - Mobile-first responsive layout (the brief explicitly targets mobile
     KOL-referred users) — test at narrow viewport widths
   - Smooth transitions between flow steps, loading states that feel real
   - The KOL attribution banner should look like a genuine trust/disclosure
     UI element, not an afterthought
   - Empty states, error states, and the exception screens should look
     intentional and reassuring, not like raw error dumps
   You may use Claude Code (via -p mode) for this, or write it directly.
   Consider using Tailwind (check if already set up) for velocity.
5. **Deploy to Vercel.** Use `vercel --token <token> --yes --prod` from the
   project directory if a token is available (check .env.local, shell
   history, or ask nothing — proceed with whatever's available; if truly no
   token, deploy is blocked, document this clearly as the one item needing
   the user's action in the morning).
6. **Finalize README.md** — must be totally honest and clear about: what's
   live vs mocked, exact testnet tx hash + explorer link, setup/run
   instructions, deployment URL (if deployed), known limitations, primary
   metric (pre-trade deposit completion rate) + guardrails.
7. **Write/update testnet-evidence.md** with the full required format from
   SPEC.md / the original assignment brief: tx hash, explorer link, network,
   contract address, inputs, purpose, expected vs actual result, state
   before/after, reproducible command, what it validates and doesn't.
8. **Self-review pass**: read through everything as if you were the hiring
   reviewer. Does the deposit breakdown make sense? Is the improvement
   clearly ONE feature, not a grab-bag? Are mocks clearly labeled? Fix
   anything that reads as sloppy, AI-generated boilerplate, or inconsistent.

## Constraints & style
- Budget-conscious: the user has limited API budget. Prefer Claude Code
  print-mode (`claude -p "..." --max-turns N --model sonnet`) for code
  writing over doing everything yourself token-by-token. Use targeted,
  batched instructions to Claude Code rather than many small ones.
- Do NOT ask the user questions — he is asleep. Make the call yourself,
  document the reasoning in OVERNIGHT_LOG.md, move on.
- Do NOT use real funds, real personal data, or claim mocked things are
  live. Never fabricate a transaction hash — if you cannot get a real one,
  say so plainly in the log and README rather than inventing one.
- Keep working across multiple wake cycles — you have until ~8:00am. Check
  OVERNIGHT_LOG.md at the start of every wake to see what prior cycles did
  and continue from there rather than restarting.

## If you get stuck on faucets/funding
The user could not get Arbitrum Sepolia ETH from any browser-gated faucet
(Alchemy/QuickNode/Chainlink all required a pre-existing mainnet ETH
balance he doesn't have). The WORKING path so far: Google Cloud faucet
(https://cloud.google.com/application/web3/faucet/ethereum/sepolia) gives
Ethereum Sepolia ETH with just a Google account, no mainnet balance —
then bridge it to Arbitrum Sepolia via the @arbitrum/sdk script pattern
in scripts/bridge-relayer-eth.js (no browser/MetaMask needed, fully
scriptable with a private key you hold). Use this same pattern to fund
the test wallet if needed. For testnet USDC, try
https://faucet.circle.com's API directly via curl/fetch with the address
as a POST body — inspect the page's network requests logic if unclear, or
fall back to a self-deployed mock ERC20 (see step 2) if truly blocked.

## Definition of done for 8am
- [ ] Real testnet tx executed, hash recorded, verifiable on Arbiscan Sepolia
- [ ] Reconciliation engine + duplicate-deposit blocking verified working
- [ ] Full UI flow renders and is visually polished, mobile-responsive
- [ ] Deployed to Vercel (or clearly documented as the one blocked step)
- [ ] README + testnet-evidence.md complete and honest
- [ ] Code committed and pushed to GitHub
- [ ] OVERNIGHT_LOG.md has a clear summary of every decision made and
      everything still open for the user to review

Work now. Read OVERNIGHT_LOG.md first (create it if it doesn't exist yet),
then SPEC.md, then check current repo/process state, then continue from
wherever the last cycle left off.
