# PR: fix(fmove): explicit on-roll seat override for cube/resign hints

**Branch:** `fix/fmove-seat-contract` → `development`
**Compare URL:** https://github.com/bitcoiners/gnubg-hints/compare/development...fix/fmove-seat-contract
**Commit:** f1ef43a

---

## Title

```
fix(hints): delegate cube take/resign to the caller-specified seat via fMoveOverride
```

---

## Body (paste everything below this line)

### Summary

The addon exposed `gnubg_hint_move`, `gnubg_hint_double` and `gnubg_hint_take`, but two
things were wrong for consumers:

1. **Cube hints were scored from the wrong seat.** `gnubg_hint_take` hardcoded `fMove = 0`,
   so a take hint asked for the *opponent* of the caller's `activePlayerColor`. Consumers
   (nodots/backgammon-ai) had to pass the offerer as "active" and guess. This branch adds an
   explicit `fMoveOverride` seat override and makes cube take/drop delegate to gnubg's own
   cubeful equity, so a hint is always answered for the seat the caller names.
2. **No resignation hint existed.** gnubg's canonical resign rule (`getResignation` +
   `getResignEquities`, `vendor/core/rollout.c`) was not wrapped, so consumers re-derived
   accept/reject verdicts from truncated `evaluation.equity` (`2w−1`, gammon/backgammon terms
   dropped). This branch wraps it as `getResignHint` and surfaces gnubg's own
   accept/reject `decision` via `gnubg_hint_resign_offered`.

### Changes

| File | Change |
|---|---|
| `gnubg-node-addon/src/hint_wrapper.cpp` | `fMoveOverride` honored in cube/resign requests; `gnubg_hint_resign_offered` surfaces accept/reject (`decision`, `hasDecision`); CLASS_RACE gate matches `play.c:1265` |
| `gnubg-node-addon/lib/gnubg_core.c` | `gnubg_hint_resign`/`gnubg_hint_resign_offered` (`getResignation` + `getResignEquities`); cube take uses cubeful equity; resign gate leaves contact positions ungated |
| `gnubg-node-addon/src/hint_wrapper.h` | `ResignHint` struct (resignedPoints, equityBefore/After, decision, hasDecision), async worker declarations |
| `gnubg-node-addon/src/gnubg_addon.cpp` | Export `getResignHint`, cube hint changes to JS |
| `gnubg-node-addon/src/index.ts` | `GnuBgHints.getResignHint(request)` API, `ResignHint`/`CubeTakeDecision` types, converters |
| `gnubg-node-addon/test/*.test.ts` | fMove-seat contract tests; resign verdict tests incl. the CLASS_RACE contact gate |

### ResignHint shape

```ts
export interface ResignHint {
  /** 0 = no resignation warranted, 1/2/3 = single/gammon/backgammon. */
  resignedPoints: 0 | 1 | 2 | 3
  /** Resigner's equity playing on. */
  equityBefore: number
  /** Resigner's equity after the concession. */
  equityAfter: number
  /** Set when `offeredPoints` given: gnubg's accept/reject verdict (1 = accept, 0 = reject). */
  decision?: 0 | 1
  /** True when an accept/reject verdict was surfaced. */
  hasDecision?: boolean
}
```

### Live-engine validation

- **Seat contract:** money dead-race; cube-2 owned by white; `fMoveOverride=1` +
  `activePlayer=black(taker)` answers for the taker (drop, ~ −1.9).
- **Resign gate:** closed-out contact position (resigner 15 on bar vs closed home) →
  `resignedPoints === 0` (CLASS_CONTACT is gated OUT by the CLASS_RACE gate; only race
  positions auto-resign). The offered path stays ungated.
- **Race control:** contact-free hopeless race → `resignedPoints === 0` for the right
  reason (nonzero win probability), not an all-zero board.
- **Offered verdict:** full backgammon concession from a dead-lost resigner is `decision=true`
  (accepted, `equityAfter −3 < equityBefore`).

### Test coverage

- `gnubg-hints.test.ts`: fMoveOverride cube seat contract; leave/nod take/drop; matcher/replay
  unchanged.
- `resign-hint.test.ts` (`getResignHint`): API surface, conversion, standard opening → 0,
  certain-lost → gammon/backgammon, hopeless-but-playable race → 0, closed-out CONTACT gate → 0,
  offered accept/reject via gnubg's rule.
- `take-hint.test.ts` / others: take/drop now delegate to cubeful equity.

All 73 addon tests pass against the native addon under Jest.

### Notes for reviewers

- `eval_setup` is optional; `NULL` mirrors the 0-ply, `EVAL_EVAL` resignation check gnubg's own
  computer player uses in `play.c`.
- The resign gate deliberately mirrors `play.c:1265` (`PositionClass > CLASS_RACE` excludes
  contact/crashed positions); the offered-resignation path is intentionally ungated so the
  decider can still accept/reject a single/gammon/backgammon concession in contact play.
- `fMoveOverride` lets consumers declare the resigner (or the take-responder) as the on-roll
  seat, so `Utility()` indexes the correct gammon price in match play.