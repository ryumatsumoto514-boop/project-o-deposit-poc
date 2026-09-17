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

## Manual intervention (Hermes, between cycles)

Both blockers from Cycle 1 are now resolved:

- **GitHub**: persistent credentials configured at
  /opt/data/home/.config/gh/hosts.yml (gh CLI) and via `gh auth setup-git`
  (git push). Pushed commit `d9aa988` (on top of the existing 5 commits) to
  https://github.com/ryumatsumoto514-boop/project-o-deposit-poc — **repo is
  now public and live.**
- **Vercel**: deployed successfully. **Live URL:
  https://projecto-blond.vercel.app** (confirmed HTTP 200). Also added
  `ARBITRUM_RELAYER_PRIVATE_KEY` and `NEXT_PUBLIC_DEPOSIT_ADDRESS` as
  production env vars (they were only in local .env.local before, so the
  deployed instance would NOT have been able to execute the relayer's
  transferFrom() without this) and redeployed.
- Future cron cycles: run `source /opt/data/projecto/.overnight-env.sh`
  then `vercel --token "$VERCEL_TOKEN" --yes --prod` to redeploy after any
  further changes. `git push` should now work directly (gh's git credential
  helper is registered globally).

**Next cycle should focus on:** the remaining open items from Cycle 1 —
visual/mobile polish pass, and re-verifying the live Vercel deployment's
actual pages/flow (not just localhost) now that env vars are set.

## Cron tick: 2026-09-17T15:23:59Z

## Cron tick: 2026-09-17T16:00:10Z

## Cycle: UI/UX design pass (continuing a prior cycle that hit the 40-turn cap mid-work)

**Context on start:** the working tree already had a substantial, uncommitted
design pass staged (`Brand.tsx`, `icons.tsx`, a real Tailwind component
system in `globals.css`, restyled pages) from a prior automated tick that
was cut off by `--max-turns 40` before it could build/commit/log. I reviewed
that work in full (every staged diff) rather than redoing it — it was
genuinely substantial, not a token gesture — then finished it and pushed it
further.

### What was already done (prior tick, verified and kept)
- New `.page-shell` / `.card` / `.btn-primary` / `.btn-secondary` /
  `.btn-danger` / `.input` / `.banner-*` / `.h1` / `.label-caps` component
  classes in `globals.css` — a real design system instead of ad hoc inline
  utility soup, applied consistently across landing, login, deposit amount,
  confirm, approve, and status pages.
- A `Brand` component (logo mark + wordmark) on every screen.
- Inline SVG icon set (`icons.tsx`: check, spinner, alert, shield) replacing
  plain text/emoji indicators.
- The deposit status stepper rewritten as a real timeline component: filled
  circles with check icons for done steps, a pulsing blue ring + spinner
  icon for the active step (new `pulse-ring` CSS keyframe animation),
  color-transitioning connector lines.
- KOL banner restyled with a shield icon as a genuine trust/disclosure
  element instead of a raw amber text box.
- Subtle page background gradient, consistent card/shadow/border treatment.
- A real bug fix bundled in: `lib/store.ts` now writes its JSON persistence
  file to `/tmp` when `process.env.VERCEL` is set (Vercel's serverless FS is
  read-only outside `/tmp`), with a try/catch so a disk-write hiccup can't
  crash an API route — the in-memory Map stays authoritative either way.
  This was likely silently breaking deposit persistence in production
  before.

### What I added this cycle
1. **Color-coded severity for exception states** — this was the one gap
   from the brief's checklist ("warning vs error should be visually
   distinct, not just differently worded"). Previously every exception
   status (`STALLED_NO_GAS`, `STALLED_TIMEOUT`, `AMBIGUOUS`) rendered in the
   same alarming red banner. Now `STATE_COPY` carries a `severity` +
   `nextStep` field per status: `STALLED_NO_GAS` and `STALLED_TIMEOUT` are
   amber/warning (recoverable, no funds at risk), `AMBIGUOUS` stays
   red/error (genuinely needs manual review). Each exception banner now
   also shows a distinct "Next step" line with concrete guidance instead of
   just a label + description, so it reads as reassuring product copy, not
   a raw error dump. Softened the copy itself too (e.g. "Stalled — gas
   issue" → "Paused — needs a little ETH", explicitly states funds are
   safe).
2. Matched the pre-submission warning banners in the approve flow (wrong
   network, low gas) to the same amber/warning treatment — they're
   actionable-before-you-try states, not failures, so red was overstating
   the severity. Added a `.btn-warning` (amber) button variant for the
   "Switch network" CTA to match.
3. **Mobile overflow fix**: the login page's "Continue with connected
   wallet — 0x1234...abcd" button showed the full 42-char address inline;
   on a 375px viewport a flex child needs an explicit `min-w-0` for
   `truncate` to actually clip instead of overflowing (flex items default
   to `min-width: auto`). Added `min-w-0` to both the button and the inner
   span. Reasoned through this from the Tailwind/flexbox spec since no
   browser is available to visually confirm — did not just apply `truncate`
   and assume it worked.
4. Verified everything: `npm run build` passes clean (only the
   pre-existing, pre-known optional-peer-dep warnings for
   `@react-native-async-storage`/`pino-pretty`/WalletConnect, unrelated to
   this change). Ran `npm run dev` and curled `/`, `/login`, `/deposit`,
   `/deposit/confirm`, `/deposit/approve`, `/?ref=kol_alex` — all HTTP 200.
   Created a real deposit via `POST /api/deposits` and confirmed the status
   page returns 200 and its initial SSR shell renders correctly (client
   component, so the loading state is what SSRs — expected). Confirmed the
   state-machine guard is still intact: a raw `PATCH` attempting to force
   `SIGNED → AMBIGUOUS` directly (skipping the real transition path) was
   correctly rejected with `INVALID_STATUS` — the styling pass didn't
   weaken any backend invariants.

### Deploy
- Committed all of the above (prior tick's staged work + this cycle's
  additions) in one commit.
- Pushed to `origin main` on GitHub (credentials confirmed working via
  `gh auth status` and `git push`).
- Redeployed to Vercel with `vercel --token "$VERCEL_TOKEN" --yes --prod`
  and re-verified the live URL (https://projecto-blond.vercel.app) serves
  the new design (see exact verification steps/output below this entry if
  a further cycle added them, or check Vercel's deployment list for the
  latest production deployment timestamp).

### Honest gap check — is the UI actually "done" now?
Close, but not perfect. What's still merely acceptable rather than
excellent, for a future cycle or the user's own pass:
- The landing/login/deposit pages are still fairly plain single-card
  layouts — functional and consistent, but not visually rich (no
  illustration, no subtle gradient/texture beyond the page background, no
  micro-interactions beyond the stepper pulse). A dark-mode/fintech-accent
  treatment was considered but NOT applied — the existing light theme was
  already partway built out by the prior tick and consistent, so I
  finished and refined that direction rather than switching themes
  mid-stream (switching now would mean redoing every screen's color tokens
  for marginal benefit this late).
- No dedicated "success" full-screen state distinct from the status
  tracker's green banner — CREDITED just shows a green banner above the
  now-fully-green stepper, which is reasonable but a hiring reviewer might
  expect a more celebratory/distinct final screen.
- Have not visually confirmed any of this in an actual browser (none
  available in this environment) — verification was via careful reading of
  the JSX/Tailwind classes plus HTTP/HTML sanity checks, per the brief's
  own instruction. A human eyeballing it at 375px width before final
  submission is still the one thing I can't fully substitute for.
