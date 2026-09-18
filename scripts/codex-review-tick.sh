#!/bin/bash
# Second-opinion QA driver — runs OpenAI Codex CLI directly, costs $0 in
# Nous tokens (plain script executed by the cron scheduler with
# no_agent=true). Codex itself uses the user's ChatGPT Plus subscription
# login, not any API-billed tokens. Runs independently of the Claude Code
# overnight-tick.sh job as a second, differently-modeled reviewer — good
# for catching things one model's blind spots miss.
export HOME=/opt/data/home
cd /opt/data/projecto
source .overnight-env.sh 2>/dev/null || true
export PATH="/opt/data/npm-global/bin:$PATH"

LOG=/opt/data/projecto/OVERNIGHT_LOG.md
echo "" >> "$LOG"
echo "## Codex review tick: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"

if ! codex login status 2>&1 | grep -qi "logged in"; then
  echo "Codex session not logged in / expired. Skipping this tick." >> "$LOG"
  exit 0
fi

# Guard against colliding with a live Claude Code edit in progress.
if pgrep -f "claude -p" > /dev/null; then
  echo "Claude Code is actively editing right now — skipping this tick to avoid concurrent-edit conflicts." >> "$LOG"
  exit 0
fi

codex exec \
  --sandbox danger-full-access \
  --skip-git-repo-check \
  "You are doing an INDEPENDENT second-opinion review of a live product, separate from another AI (Claude Code) that has been iterating on this same repo for many cycles. Read /opt/data/projecto/OVERNIGHT_BRIEF.md and the tail of /opt/data/projecto/OVERNIGHT_LOG.md (it's long — just read enough to know what's already been tried and fixed, don't repeat known-fixed issues) first.

Your job: find ONE thing the other AI's cycles likely missed, using genuinely fresh eyes. Good places to look that a single-model loop tends to miss:
- Actually fetch https://projecto-blond.vercel.app and its subroutes with curl and read the raw HTML/response bodies — look for things like: missing meta tags, broken canonical/OG tags, accessibility issues (missing alt text, poor color contrast in the raw CSS values, missing aria labels on icon-only buttons), SEO basics, console-visible issues you can infer from the markup.
- Read app/globals.css and tailwind.config.ts critically for genuinely inconsistent values (e.g. three slightly different shades meant to be the same color, inconsistent border-radius values, spacing that doesn't follow a scale) — a fresh reader often spots drift a repeat editor stops seeing.
- Read the actual copy/microcopy across every screen for tone consistency, typos, or claims that could be read as misleading (e.g. does anything imply real money/real returns when it shouldn't, per SPEC.md's 'Out of Scope' section around guaranteed returns/misrepresentation).
- Check error handling paths in the API routes (app/api/**) for edge cases: what happens with negative amounts, extremely large amounts, malformed wallet addresses, duplicate/replayed requests with slightly different casing in the address.
- Cross-check the README.md and testnet-evidence.md against what's ACTUALLY true right now (e.g. does the live URL match, are transaction hashes/contract addresses still accurate, is the mock-vs-real boundary still accurately described after all the design changes).

CONSTRAINTS:
- HARD TIME LIMIT: this environment kills long-running processes after several minutes. Pick ONE small, real, fixable issue — do not attempt a sweeping change.
- Do not touch lib/*.ts reconciliation-engine core logic unless you find and are fixing a genuine, clearly-explained bug in it.
- If you make a code change: run npm run build to confirm it's clean, then git add -A && git commit with a clear message, git push origin main, and redeploy with 'vercel --token \"\$VERCEL_TOKEN\" --yes --prod'. Verify the live URL reflects your change afterward (curl it).
- Append a clear, specific entry to /opt/data/projecto/OVERNIGHT_LOG.md: what you found, how (be specific — which file, which curl, which read), what you changed, how you verified it live. Prefix your log entry with '### [Codex review]' so it's clearly distinguishable from Claude Code's entries.
- If you genuinely find nothing worth fixing after a real, specific look (not a token-saving shortcut), say so plainly in the log with what you actually checked — do not fabricate a finding to seem useful." \
  >> /opt/data/projecto/.overnight-codex-stdout.log 2>&1 &
CODEX_PID=$!
( sleep 280 && kill -TERM "$CODEX_PID" 2>/dev/null ) &
TIMEOUT_WATCHER=$!
wait "$CODEX_PID"
CODEX_EXIT=$?
kill "$TIMEOUT_WATCHER" 2>/dev/null

echo "Codex review tick finished, exit code $CODEX_EXIT" >> "$LOG"
exit 0
