#!/bin/bash
# Overnight driver script — runs Claude Code CLI directly, costs $0 in Nous
# tokens (this is a plain shell script executed by the cron scheduler with
# no_agent=true, not an LLM agent). Claude Code itself uses the user's
# Claude Pro subscription login, not any API-billed tokens.
# NOTE: no `set -e` — a Claude Code turn-limit or non-fatal error must not
# prevent this script from at least logging what happened. Each command
# below checks its own exit status explicitly instead.
export HOME=/opt/data/home
cd /opt/data/projecto
source .overnight-env.sh 2>/dev/null || true

LOG=/opt/data/projecto/OVERNIGHT_LOG.md
echo "" >> "$LOG"
echo "## Cron tick: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG"

# Check Claude Code auth is still valid before spending a turn on it
if ! claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
  echo "Claude Code session not logged in / expired. Skipping this tick." >> "$LOG"
  exit 0
fi

claude -p "Read /opt/data/projecto/OVERNIGHT_BRIEF.md and /opt/data/projecto/OVERNIGHT_LOG.md (append-only — it's long, but has critical context: which design directions were already tried, which bugs were already found/fixed, and what's already been verified live) in full first.

CURRENT MODE: autonomous self-directed QA and iteration on the LIVE deployment at https://projecto-blond.vercel.app. The user has confirmed the core Cyber Amber/trading-terminal brand direction and the 5 core UX improvements (state machine, exact-amount approval, plain-language failures, address confirmation, wallet-role labeling) are genuinely implemented and want you to keep finding real flaws and making it better — NOT to keep re-litigating the same visual direction from scratch. Read the log first so you don't repeat work or re-pivot colors for the Nth time with no new signal — that has already been flagged as low-value in prior cycles.

Your job this cycle: pick ONE concrete, verifiable improvement using this priority order (skip a category once you've confirmed via the log it's already solid, move to the next):
1. **Functional bugs** — actually click/curl through the live site's flows and API routes looking for real breakage: broken links, console errors, API routes returning wrong status codes, state machine edge cases, mobile layout overflow, broken images/icons, slow/hanging requests.
2. **Consistency gaps** — screens that don't match the established design system (check every route, not just the ones recently touched) — inconsistent spacing, colors, border-radius, font usage vs. the tokens already defined in globals.css/tailwind.config.ts.
3. **Missing polish details** — loading states, empty states, hover/focus states, transitions, accessibility (contrast, tap target size, alt text) — small things a sharp reviewer notices.
4. **KOL/B2B2C and assignment-fit details** — re-read SPEC.md's requirements around KOL disclosure, wallet-role labeling, and deposit breakdown; confirm the live site still clearly demonstrates these differentiators from a generic DEX clone (this is the actual point of the assignment, don't let visual polish crowd it out).

Use the real screenshot pipeline (chrome-headless-shell + scripts/screenshot.mjs / shot-flow-walk.mjs via CDP on port 9333) to verify visually, not just by reading code, wherever practical. Actually curl API routes and check status codes/bodies, not just assume.

CONSTRAINTS:
- HARD TIME LIMIT: this environment kills long-running processes around 5-7 minutes. Pick something SMALL enough to fully finish (find, fix, verify, commit, deploy) within that budget. A tiny real fix that ships beats an ambitious one that gets killed mid-edit.
- Do not touch lib/*.ts reconciliation-engine business logic unless you find and are fixing a genuine bug in it (state transitions, idempotency) — this is the assignment's actual subject matter, treat it carefully.
- After any change: npm run build must pass clean, then commit, push to GitHub, redeploy to Vercel (source .overnight-env.sh, then vercel --token \"\$VERCEL_TOKEN\" --yes --prod), and re-verify the change is actually live at https://projecto-blond.vercel.app (not just committed).
- Append a specific, concrete summary to OVERNIGHT_LOG.md: what flaw you found, how you found it (screenshot/curl/read), what you changed, and how you verified the fix live. If you genuinely find nothing worth fixing after a real look (not a lazy one), say so plainly and note what you checked." \
  --max-turns 25 \
  --model sonnet \
  --dangerously-skip-permissions \
  >> /opt/data/projecto/.overnight-claude-stdout.log 2>&1 &
CLAUDE_PID=$!
# Hard safety timeout well under whatever kills the outer job (~350-420s
# observed) so we can at least log a clean state before being reaped.
( sleep 280 && kill -TERM "$CLAUDE_PID" 2>/dev/null ) &
TIMEOUT_WATCHER=$!
wait "$CLAUDE_PID"
CLAUDE_EXIT=$?
kill "$TIMEOUT_WATCHER" 2>/dev/null

echo "Claude Code tick finished, exit code $CLAUDE_EXIT" >> "$LOG"
exit 0
