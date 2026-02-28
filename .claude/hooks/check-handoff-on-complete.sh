#!/bin/bash
# TaskCompleted hook: ensure HANDOFF.md or BLOCKER.md exists before marking complete
# Exit 0 = allow, Exit 2 = block

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GIT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Only enforce on feature branches
BRANCH=$(git -C "$GIT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [[ ! "$BRANCH" =~ ^feat/ ]]; then
  exit 0
fi

# Check for HANDOFF.md or BLOCKER.md
if [[ -f "$GIT_ROOT/HANDOFF.md" ]] || [[ -f "$GIT_ROOT/BLOCKER.md" ]]; then
  exit 0
fi

echo "On feature branch $BRANCH: write HANDOFF.md or BLOCKER.md before completing." >&2
exit 2
