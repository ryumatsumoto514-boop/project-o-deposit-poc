#!/bin/bash
# Overnight driver script — runs Claude Code CLI directly, costs $0 in Nous
# tokens (this is a plain shell script executed by the cron scheduler with
# no_agent=true, not an LLM agent). Claude Code itself uses the user's
# Claude Pro subscription login, not any API-billed tokens.
# NOTE: no `set -e` — a Claude Code turn-limit or non-fatal error must not
# prevent this script from at least logging what happened. Each command
# below checks its own exit status explicitly instead.
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

# Give Claude Code one bounded, self-contained task per tick.
# --max-turns caps runaway loops. Print mode = no interactive tokens wasted.
claude -p "Read /opt/data/projecto/OVERNIGHT_BRIEF.md and /opt/data/projecto/OVERNIGHT_LOG.md (append-only, read the whole thing to see prior progress) in full first.

USER FEEDBACK JUST IN (highest priority, overrides prior task ordering): the user looked at the live deployment at https://projecto-blond.vercel.app and said the UI/UX is NOT good enough — it looks like a bare-minimum AI-generated scaffold, not a polished product. He explicitly wants the UI/UX to be WAY better by morning. Treat visual/UX quality as the TOP priority for this tick and every subsequent tick until it is genuinely good, not just functional.

Do a real design pass, not a token gesture:
- Pick and commit to a specific, considered visual direction (e.g. a clean modern fintech dark theme with a real accent color, proper type scale, generous whitespace, subtle shadows/borders/gradients where tasteful) and apply it CONSISTENTLY across every screen, not just the landing page.
- Replace any plain/default-looking buttons, inputs, and cards with intentionally styled components — rounded corners, proper hover/active/disabled states, real spacing rhythm (a consistent spacing scale, not ad hoc margins).
- The deposit status tracker should look like a real product feature: a proper stepper/timeline component with icons (inline SVGs are fine, no need for an icon library), color-coded states (in-progress/success/warning/error should be visually distinct, not just differently worded), and smooth CSS transitions between states.
- Typography: use a proper font stack (system-ui/Inter-like), clear hierarchy (headings vs body vs captions), readable line-height and contrast.
- Mobile-first: actually test at a 375px-wide viewport (iPhone SE-ish) — this app's real users are mobile. Check nothing overflows, tap targets are large enough, text doesn't wrap awkwardly.
- The KOL attribution/disclosure banner should look like a genuine trust element (subtle icon, clear but non-alarming styling) not a raw text warning box.
- Exception/error screens (STALLED_NO_GAS, AMBIGUOUS, duplicate-blocked) should look reassuring and intentional, with clear next-step guidance, not like raw error dumps.
- If Tailwind is already set up, lean into it fully rather than fighting it — refine the existing utility classes into a more considered design system (e.g. define reusable component patterns, not just inline utility soup).
- Use \`npm run build\` locally to sanity check before deploying, and if you can spin up the dev server, curl a few pages to sanity-check they still render (you don't have a real browser available, so don't rely on visually inspecting screenshots — reason carefully about the actual JSX/CSS you write and double check class names are valid Tailwind utilities).

After the design pass: re-verify the LIVE Vercel deployment at https://projecto-blond.vercel.app actually reflects your changes end to end (redeploy if needed), and note any other functional gaps you find on a fresh honest review.

Make autonomous decisions, do not ask questions (no one is available to answer). Commit any code changes (git add -A && git commit) and if credentials work (source /opt/data/projecto/.overnight-env.sh first), push to GitHub and redeploy to Vercel with 'vercel --token \"\$VERCEL_TOKEN\" --yes --prod'. Append a concise summary of exactly what you did this tick, and specifically what visual changes you made, to /opt/data/projecto/OVERNIGHT_LOG.md before finishing (use '>>' style additions, do not rewrite prior entries). Do NOT declare the UI 'done' unless you actually made substantial, specific visual improvements this tick or a genuinely thorough one was already done in a PRIOR tick (check the log) — if so say what's left, if anything, to make it excellent rather than merely acceptable." \
  --max-turns 100 \
  --model sonnet \
  --dangerously-skip-permissions \
  >> /opt/data/projecto/.overnight-claude-stdout.log 2>&1
CLAUDE_EXIT=$?

echo "Claude Code tick finished, exit code $CLAUDE_EXIT" >> "$LOG"
# Always exit 0: a non-zero Claude exit (e.g. hit max-turns mid-task) is
# expected/normal for long design work, not a scheduler-level failure —
# the log entry above captures what actually happened for review.
exit 0
