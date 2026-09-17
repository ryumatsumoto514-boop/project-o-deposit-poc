# Overnight Log — Project O Deposit Reconciliation Engine PoC

## Cycle 1 (this session)

Prior state: repo had an initial scaffold (3 commits) with full reconciliation
engine logic (`lib/*.ts`), all API routes, and the full UI flow already
written by an earlier session, plus uncommitted working-tree edits (a fix
freezing `onchainConfirmedAt` and resetting `addressConfirmed` when the
amount changes, and a self-healing retry in `attemptPull`/`reconcile`).
Relayer wallet was funded with 0.045 ETH on Arbitrum Sepolia. No testnet
USDC existed anywhere, no real transaction had been run yet, no
OVERNIGHT_LOG.md existed.

### What I did, in order

1. **Read SPEC.md, OVERNIGHT_BRIEF.md, all of `/lib`, all of `/app`.**
   Confirmed the reconciliation engine already implements every required
   state (`SIGNED`, `CONFIRMED_ONCHAIN`, `BRIDGING`, `CREDITED`,
   `STALLED_NO_GAS`, `STALLED_TIMEOUT`, `AMBIGUOUS`), a proper transition
   table (`stateMachine.ts`), idempotency (`idempotency.ts`), and a
   reconciliation loop that independently checks both the real on-chain
   receipt and a mocked Hyperliquid signal (`reconcile.ts`). This backend
   was already solid — I verified it rather than rewriting it.

2. **Faucet investigation.** `faucet.circle.com`'s public drip UI now
   returns HTTP 404 for the unauthenticated endpoint — it requires a Circle
   Developer API key we don't have (confirmed via web search: the real
   endpoint is `api.circle.com/v1/faucet/drips` with a Bearer token
   requirement). Neither the relayer (0.045 ETH, 0 USDC) nor the
   brief's referenced test wallet (0 ETH, 0 USDC, and its private key
   wasn't recoverable in this environment — likely never persisted) had
   any testnet USDC. Per the brief's explicit fallback instruction, I
   built and deployed a mock ERC-20 instead.

3. **Deployed MockUSDC** (`scripts/MockUSDC.sol`, compiled with `solc` via
   npm — installed locally with `--no-save` so it's not a project
   dependency) to Arbitrum Sepolia using the relayer wallet as deployer.
   Real deploy tx: `0xa102d9af190a53964805c43a89f5f1d53b7bca2a80162f9962a3ae48b39c10fd`,
   contract at `0x950A2C07CD9d6489691625272a8f9f4df4D0342C`.
   Identical `approve`/`transferFrom`/`balanceOf`/`allowance` semantics to
   real USDC, 6 decimals, initial supply minted to the relayer.

4. **Generated a fresh test user wallet** (private key stored only in
   `.data/testnet-evidence.json`, which is gitignored — never committed),
   funded it with 0.003 ETH gas and 100 mUSDC from the relayer (both real
   confirmed txs).

5. **Ran the required real approve() + transferFrom() proof**: test user
   approved an EXACT amount (25.0 mUSDC, not unlimited) to the relayer,
   then the relayer called `transferFrom()` to pull it. Both txs
   confirmed, balances/allowance verified before/after (allowance fully
   consumed back to 0, proving the exact-amount scoping worked). Full
   details, all hashes, and reproduction commands in `testnet-evidence.md`.

6. **Wired `lib/chain.ts`** to point `USDC_ADDRESS` at MockUSDC instead of
   Circle's real (but inaccessible) testnet USDC, with a clear comment
   explaining why and how to switch back later.

7. **Ran `npm run build`** — passes cleanly (some non-fatal
   module-not-found warnings for optional wagmi/WalletConnect peer deps
   like `pino-pretty` and React Native async-storage — expected, harmless,
   pre-existing, not touched by me).

8. **Ran the app live** (`npm run dev`, port 3001 since 3000 was taken) and
   exercised the actual API routes end-to-end — not just scripted chain
   calls:
   - Verified all pages return HTTP 200: `/`, `/login`, `/deposit`,
     `/deposit/approve`, `/deposit/confirm`, `/?ref=kol_alex`.
   - Created a deposit via `POST /api/deposits`, then immediately retried
     with the same wallet+amount → got `HTTP 409 DUPLICATE_IN_FLIGHT` as
     designed. **Duplicate-deposit blocking confirmed working live.**
   - Ran a second real `approve()` (10.0 mUSDC,
     `0xb1c1caa7d1b37c5848434d24d509fd17585611d389a914587146a8ee259d956a`),
     created a deposit record for it, then called
     `POST /api/deposits/[id]/reconcile` repeatedly (the same endpoint the
     UI's status tracker polls). Watched it: independently verify the
     approve receipt → trigger the relayer's real `transferFrom()`
     (producing a brand-new real tx hash) → independently re-verify that
     receipt → transition to `CONFIRMED_ONCHAIN` → after the mock
     Hyperliquid delay, transition to `CREDITED`. **The full reconciliation
     state machine confirmed working live, against real on-chain data, not
     mocked.**
   - Confirmed `GET /api/deposits/check` correctly reports no conflict
     once a deposit reaches `CREDITED`.

9. **Rewrote `testnet-evidence.md`** from scratch with the full required
   format: every tx hash, block number, explorer link, before/after
   balance/allowance state, purpose, expected vs actual result, and exact
   reproduction commands for all 7 real transactions.

10. **Updated `README.md`**: honest "what's real vs mocked" table now
    correctly describes MockUSDC (not silently implying it's real Circle
    USDC), documents the duplicate-blocking and state-machine verification
    as done, added a "no human click-through of MetaMask overnight" caveat
    to known limitations, and pointed the "live deployment" section at this
    log for status.

11. **Checked deployment credentials.** Neither a `VERCEL_TOKEN` nor a
    logged-in `vercel` CLI session exists anywhere in this environment
    (`vercel whoami` → `action_required: login_required`). Neither a
    `GH_TOKEN`/`GITHUB_TOKEN` nor a logged-in `gh` CLI session exists
    either (`gh auth status` → not logged in; `git remote -v` → no
    `origin` configured at all). **Both Vercel deployment and GitHub push
    are genuinely blocked** — there is no credential anywhere in this
    sandboxed environment to complete either, and I was explicitly told
    not to guess/fabricate credentials. This is not a shortcut I chose;
    it's the actual state of what's available overnight.

12. **Committed everything locally** (commit `6917597`, on top of the
    existing 3 commits) with a detailed message. The working tree is
    clean; nothing is uncommitted. **This commit has NOT been pushed
    anywhere** — there's no remote configured and no credentials to add
    one, so it exists only in this local repo checkout.

### Definition-of-done status at end of this cycle

- [x] Real testnet tx executed, hash recorded, verifiable on Arbiscan
      Sepolia — **7 real transactions**, all documented in
      `testnet-evidence.md` with reproducible scripts.
- [x] Reconciliation engine + duplicate-deposit blocking verified working —
      tested live against the running app, not just read from source.
- [x] Full UI flow renders — every page returns 200, `npm run build`
      passes clean. **Not fully re-verified for visual polish/mobile
      responsiveness this cycle** — the UI was already built with
      Tailwind, consistent styling, a color-coded state stepper, and
      `max-w-md` mobile-first layout in a prior session; I did not
      redesign it, only confirmed it renders and functions. A human
      should eyeball it at a real mobile viewport before final submission.
- [ ] **Deployed to Vercel — BLOCKED.** No `VERCEL_TOKEN` or logged-in CLI
      session available anywhere in this environment. **This is the one
      item that needs your action in the morning**: run
      `vercel login` (or set `VERCEL_TOKEN`) then
      `vercel --yes --prod` from `/opt/data/projecto`.
- [x] README + testnet-evidence.md complete and honest — rewritten this
      cycle with the MockUSDC substitution clearly disclosed.
- [ ] **Code committed and pushed to GitHub — PARTIALLY BLOCKED.** Fully
      committed locally (commit `6917597`). **Pushing needs your action**:
      no GitHub credentials or remote exist in this environment. Run, from
      `/opt/data/projecto`:
      ```
      git remote add origin https://github.com/ryumatsumoto514-boop/project-o-deposit-poc.git
      git push -u origin main
      ```
      (adjust if you'd authenticated `gh` differently before — `gh auth
      login` first if you prefer the GitHub CLI route.)
- [x] OVERNIGHT_LOG.md has a clear summary — this file.

### What's genuinely left for you to review/decide

1. **Push to GitHub and deploy to Vercel** (see commands above) — the only
   two blocked steps, both credential-gated, both otherwise ready to go.
2. **Manually click through the deposit flow once in a real browser with
   MetaMask** connected to your Arbitrum Sepolia network, to confirm the
   wagmi wallet-connect UX itself works as expected end-to-end (not just
   the underlying API/chain logic, which I did verify). Fund your MetaMask
   test account with a little Sepolia ETH and some MockUSDC (mint from the
   relayer — see README "Running the real on-chain flow").
3. Decide whether you want to keep MockUSDC or spend the effort getting a
   real Circle Faucet API key before presenting this — I made the call to
   ship with MockUSDC (per the brief's own fallback guidance) rather than
   block the whole night on faucet access, and documented it transparently
   everywhere rather than hiding it.
4. Consider a final visual/mobile pass yourself if you have specific
   design preferences — I verified functional correctness and didn't
   redesign the already-reasonable Tailwind UI from the prior session.
