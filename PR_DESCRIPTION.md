# PR: feat(resign): expose gnubg's own getResignation via getResignHint

**Branch:** `feat/resignation-hint` → `development`
**Compare URL:** https://github.com/bitcoiners/gnubg-hints/compare/development...feat/resignation-hint
**Commit:** afac64b

---

## Title

```
feat(resign): expose gnubg's own getResignation via getResignHint
```

---

## Body (paste everything below this line)

### Summary

The addon exposes `gnubg_hint_move`, `gnubg_hint_double` and `gnubg_hint_take`, but nothing for **resignation decisions**. gnubg already implements the canonical rule — `getResignation` + `getResignEquities` in `vendor/core/rollout.c` — but it was not wrapped, so consumers (e.g. nodots/backgammon-ai) must re-derive accept/reject verdicts from truncated equity fields:

- the JS-visible `evaluation.equity` is only `2w−1`, omitting gammon/backgammon terms
- ply-depth quirks (ply 1 understates gammons; ply 3 zeroes w/g/bg)
- money-vs-match utility differences (`Utility()` handles Jacoby/MET internally)

This PR wraps gnubg's own resignation functions so consumers can make engine-faithful accept/reject decisions without reimplementing thresholds or formulas.

### Changes

| File | Change |
|---|---|
| `gnubg-node-addon/lib/gnubg_core.c` | New `gnubg_hint_resign(board, cube_info, eval_setup, hint_out)` — calls `getResignation` + `getResignEquities`; returns `{resigned_points, equity_before, equity_after}` |
| `gnubg-node-addon/include/gnubg_core.h` | Declaration with docs |
| `gnubg-node-addon/src/hint_wrapper.h` | `ResignHint` struct, async `ResignHintWorker` declaration |
| `gnubg-node-addon/src/hint_wrapper.cpp` | `HintWrapper::getResignHint` implementation + worker |
| `gnubg-node-addon/src/gnubg_addon.cpp` | Exports `getResignHint` to JS |
| `gnubg-node-addon/src/index.ts` | `GnuBgHints.getResignHint(request)` static API, `ResignHint` type, `convertResignHintFromGnuBg` |
| `gnubg-node-addon/test/resign-hint.test.ts` | Conversion unit test, API-surface test, live-engine integration tests |

### Consumer usage

```ts
const hint = await GnuBgHints.getResignHint(request)
// hint.resignedPoints === 0     → play on (nothing to accept)
// offer.value <= resignedPoints → reject the offered resignation
// otherwise                     → accept
```

No thresholds or formulas in consumer code — gnubg decides.

### ResignHint shape

```ts
export interface ResignHint {
  /** 0 = no resignation warranted, 1/2/3 = single/gammon/backgammon */
  resignedPoints: 0 | 1 | 2 | 3
  /** Resigner's equity playing on. */
  equityBefore: number
  /** Resigner's equity after the concession. */
  equityAfter: number
}
```

### Live-engine validation

| Position | resignedPoints | Notes |
|---|---|---|
| Standard opening position | 0 | no forced resignation |
| Hopeless race, contact-free escape exists | 0 with equityBefore −1 | a race loss alone is not a forced resign |
| Certain backgammon: resigner has 14 borne off + 1 deep checker, opponent has checkers trapped inside the resigner's home board | 2–3 | matches theory; equityBefore ≈ ±1 |

### Test coverage

- Conversion contract: raw addon output → typed `ResignHint`
- API surface: `getResignHint` exposed on `GnuBgHints` and the native addon
- Live-engine integration tests:
  - standard opening → `resignedPoints = 0`
  - certain-backgammon fixture → `resignedPoints ∈ {2, 3}`, `|equityBefore| > 1`
  - hopeless-race control → `resignedPoints ≥ 0`

All existing addon tests pass unchanged.

### Notes for reviewers

- `eval_setup` parameter is optional; `NULL` mirrors what gnubg's own computer player uses in `play.c` (`EVAL_EVAL`, 0-ply) — resignation checks there are deliberately cheap.
- Jacoby handling comes for free via `Utility(ar, pci)` inside `getResignation`.
- The wrapper intentionally does not re-decide anything: the enum from `GeneralCubeDecisionE`/`getResignation` is passed through as-is.
