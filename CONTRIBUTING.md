# Contributing to Nodots Backgammon

Thank you for your interest in contributing to Nodots Backgammon. This document provides guidelines and information for contributors.

## Project Structure

This is a **multi-repo ecosystem**, not a monorepo. Each package has its own GitHub repository:

| Package | Repository | npm |
|---------|------------|-----|
| types | [backgammon-types](https://github.com/nodots/backgammon-types) | @nodots/backgammon-types |
| core | [backgammon-core](https://github.com/nodots/backgammon-core) | @nodots/backgammon-core |
| ai | [backgammon-ai](https://github.com/nodots/backgammon-ai) | @nodots/backgammon-ai |
| api-utils | [backgammon-api-utils](https://github.com/nodots/backgammon-api-utils) | @nodots/backgammon-api-utils |
| cli | [backgammon-cli](https://github.com/nodots/backgammon-cli) | @nodots/backgammon-cli |
| gnubg-hints | [gnubg-hints](https://github.com/nodots/gnubg-hints) | @nodots/gnubg-hints |
| api | [backgammon-api](https://github.com/nodots/backgammon-api) (private) | - |
| client | [backgammon-client](https://github.com/nodots/backgammon-client) (private) | - |

When contributing, work in the appropriate package repository.

---

## Branch Workflow

- Create feature branches from `development`
- Merge completed feature branches into `development` via PR
- When releasing, merge `development` into `main` via PR
- `development` should always equal `main` + merged feature work

### Branch Naming

```
feature/add-cube-actions
fix/position-id-encoding
docs/update-api-reference
```

### Protected Branches

- `main` and `development` are protected; direct pushes are disallowed
- Changes must land via PRs with at least one approval

---

## Development Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+
- macOS (for gnubg-hints native addon)

### Getting Started

```bash
# Clone the workspace
git clone https://github.com/nodots/nodots-backgammon.git
cd nodots-backgammon

# Start infrastructure
docker-compose up -d

# Install dependencies
npm install

# Run tests
npm test
```

See [Getting Started](docs/GETTING_STARTED.md) for detailed setup instructions.

---

## Code Style

### TypeScript Guidelines

1. **Use strict types** - Avoid `any`. Every value should have a specific type.

2. **Prefer discriminated unions** - Use `stateKind` for type narrowing:
   ```typescript
   // Good
   if (game.stateKind === 'moving') {
     // TypeScript narrows to BackgammonGameMoving
   }

   // Avoid
   if ((game as any).activePlay) { ... }
   ```

3. **Explain explicit casts** - If you must use `as`, add a comment:
   ```typescript
   // Safe cast: we verified stateKind === 'moving' above
   const movingGame = game as BackgammonGameMoving
   ```

4. **Follow the Golden Rule** - Always use player direction for positions:
   ```typescript
   // Correct
   const pos = point.position[player.direction]

   // Wrong
   const pos = point.position.clockwise
   ```

### Functional Style

Prefer functional patterns over imperative:

```typescript
// Good - array methods
const readyMoves = moves.filter(m => m.stateKind === 'ready')

// Avoid - imperative loops
const readyMoves = []
for (const m of moves) {
  if (m.stateKind === 'ready') readyMoves.push(m)
}
```

### Comments

- Keep comments factual, no adjectives/adverbs
- Document the "why", not the "what"
- Don't add comments to code you didn't change

---

## Testing

### Test Requirements

All changes must include tests. Tests must pass before merge.

```bash
# Run all tests
npm test

# Run specific package tests
cd packages/core && npm test
cd packages/api && npm test

# Run E2E tests
cd packages/client && npx playwright test
```

### Test Coverage Targets

- Statements: 80%+
- Branches: 75%+

### E2E Testing

Client features require E2E tests proving acceptance criteria:

```bash
cd packages/client
npx playwright test --ui  # Interactive mode
```

---

## Pull Requests

### Requirements

- Keep PRs focused and small
- Update docs and tests where applicable
- Use the PR template checklist

### Commit Messages

Use conventional commits:

```
feat: add double/take cube actions
fix: correct position ID encoding for counterclockwise player
docs: update API documentation with new endpoints
test: add E2E tests for game review page
refactor: simplify move validation logic
```

Include the generated-by footer:

```
feat: add feature description

Detailed explanation of changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### PR Template

```markdown
## Summary
Brief description of changes (1-3 bullet points)

## Test Plan
- [ ] Unit tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Related Issues
Closes #123
```

### Review Checklist

Before requesting review:

- [ ] Tests pass locally
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] No secrets or credentials committed

---

## Releases

- Open a PR from `development` to `main`
- Use a merge commit (no squash) to preserve history between branches
- Tag releases with semantic versioning

---

## API Changes

When modifying the API:

1. **Update both REST and WebSocket** - Changes must be reflected in both
2. **Update OpenAPI spec** - Modify `docs/api/openapi.yaml`
3. **Update SwaggerHub** - Sync to https://app.swaggerhub.com/apis/nodotsadvisorygroup/nodots-backgammon-api

### WebSocket First

Make WebSocket changes before REST:

```typescript
// 1. WebSocket handler
socket.on('game:double', async (data) => { ... })

// 2. REST endpoint
router.post('/games/:id/double', async (req, res) => { ... })
```

---

## Type Changes

When modifying `@nodots/backgammon-types`:

1. **Consider backwards compatibility** - Breaking changes require major version bump
2. **Update all consumers** - Core, AI, API, and Client may need updates
3. **Document in Type System Guide** - Update `docs/TYPE_SYSTEM_GUIDE.md`

---

## Game Logic Changes

When modifying `@nodots/backgammon-core`:

1. **ALL game logic lives in core** - Never implement rules in API or Client
2. **Write unit tests** - Cover edge cases, especially for moves
3. **Test with simulations** - Run `npm run simulate:gnu-vs-gnu`

---

## Documentation

### When to Update Docs

- New features require documentation
- API changes require OpenAPI updates
- Breaking changes require migration guide

### Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Package overview |
| `docs/GETTING_STARTED.md` | Setup guide |
| `docs/TYPE_SYSTEM_GUIDE.md` | Type documentation |
| `docs/GAME_STATE_DIAGRAM.md` | State machines |
| `docs/POSITION_ID_ENCODING.md` | Position ID format |
| `docs/api/openapi.yaml` | API specification |

---

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version)
- Relevant logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered

---

## Getting Help

- **GitHub Issues**: [nodots-backgammon/issues](https://github.com/nodots/nodots-backgammon/issues)
- **API Docs**: [SwaggerHub](https://app.swaggerhub.com/apis/nodotsadvisorygroup/nodots-backgammon-api/1.0.0)
- **Email**: kenr@nodots.com

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the package you're contributing to (MIT for most packages, GPL for gnubg-hints).
