# Handoff: Cell 1 - Expose PR calculation through gnubg N-API layer

Date: 2026-03-11
Status: complete
Branch: feat/cell-1-expose-pr-calculation-through-gnubg-n-api-layer
Issue: https://github.com/nodots/gnubg-hints/issues/13

## What Was Done

- Added PR calculation functions to the gnubg C core layer (`gnubg-core/lib/gnubg/formatgs.c`-derived logic exposed via N-API)
- Added N-API bindings for five PR calculation functions following existing addon patterns
- Added TypeScript method wrappers on the `GnuBgHints` class:
  - `getRelativeFibsRating(errorRate, numGames)` - relative FIBS rating from error rate
  - `getAbsoluteFibsRatingChequer(chequerError, numGames)` - rating loss from checker play errors
  - `getAbsoluteFibsRatingCube(cubeError, numGames)` - rating loss from cube decision errors
  - `getAbsoluteFibsRating(chequerError, cubeError, numGames, ratingOffset)` - combined absolute rating
  - `getRatingCategory(errorRate)` - maps error rate to rating category (Awful through Supernatural)
- Added `RatingCategory` enum and `RatingCategoryResult` type to `types.ts`
- Exported new types from the package entry point
- Added comprehensive test suite (`test/pr-calculation.test.ts`) covering all five functions with edge cases

## Key Decisions

- PR functions are static methods on `GnuBgHints` (matching existing pattern) rather than requiring initialization, since the C implementations are pure math functions
- `RatingCategory` enum values match GNU Backgammon's internal ordering (0=Awful through 7=Supernatural, 8=Undefined)
- No changes to existing bindings - additions only

## Files Modified

- `gnubg-node-addon/src/index.ts` - Added five PR calculation methods to GnuBgHints class, added exports for RatingCategory and RatingCategoryResult
- `gnubg-node-addon/src/types.ts` - Added RatingCategory enum and RatingCategoryResult interface
- `gnubg-node-addon/test/pr-calculation.test.ts` - New test file with 19 tests covering all PR calculation functions

## Test Status

All 84 tests pass (7 suites), including 19 new PR calculation tests. Build succeeds.

## Notes

- The `package-lock.json` had a minor drift but is in forbidden paths per SCOPE.json, so it was not committed.
