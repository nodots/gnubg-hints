#!/bin/bash
# Stop hook: warn if there are uncommitted changes in allowedPaths without HANDOFF.md/BLOCKER.md
# Exit 0 = allow, Exit 2 = block

# Prevent infinite loops — if this hook triggers a response, the next stop
# would re-trigger the hook
if [[ -n "$stop_hook_active" ]]; then
  exit 0
fi
export stop_hook_active=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GIT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Only enforce on feature branches
BRANCH=$(git -C "$GIT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ ! "$BRANCH" =~ ^feat/ ]]; then
  exit 0
fi

# If HANDOFF.md or BLOCKER.md exists, allow
if [[ -f "$GIT_ROOT/HANDOFF.md" ]] || [[ -f "$GIT_ROOT/BLOCKER.md" ]]; then
  exit 0
fi

# Check for uncommitted changes (staged or unstaged, excluding untracked)
CHANGES=$(git -C "$GIT_ROOT" diff --name-only HEAD 2>/dev/null)
STAGED=$(git -C "$GIT_ROOT" diff --cached --name-only 2>/dev/null)
ALL_CHANGES=$(echo -e "$CHANGES\n$STAGED" | sort -u | grep -v '^$')

# No changes = no enforcement needed (still exploring)
if [[ -z "$ALL_CHANGES" ]]; then
  exit 0
fi

echo "On feature branch $BRANCH with uncommitted changes but no HANDOFF.md or BLOCKER.md." >&2
echo "Write HANDOFF.md (if complete/pausing) or BLOCKER.md (if blocked) before stopping." >&2
exit 2
