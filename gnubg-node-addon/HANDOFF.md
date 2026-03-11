# Handoff: Cell 1: Expose PR calculation through gnubg N-API layer

Date: 2026-03-11
Status: complete
Branch: feat/cell-1-expose-pr-calculation-through-gnubg-n-api-layer
Issue: https://github.com/nodots/gnubg-hints/issues/13

## What Was Done

- Added PR calculation functions to gnubg C core layer (`gnubg_core.h` / `gnubg_core.c`):
  - `gnubg_relative_fibs_rating` - relative FIBS rating from error rate and sample size
  - `gnubg_absolute_fibs_rating_chequer` - rating loss from checker play errors
  - `gnubg_absolute_fibs_rating_cube` - rating loss from cube decision errors
  - `gnubg_absolute_fibs_rating` - combined absolute FIBS rating estimate
  - `gnubg_get_rating` - map error rate to rating category enum
  - `gnubg_rating_name` - human-readable name for rating category
- Added N-API bindings in `gnubg_addon.cpp` following existing pattern (synchronous, lightweight math)
- Added TypeScript bindings in `GnuBgHints` class (`index.ts`) with JSDoc documentation
- Exported `RatingCategory` enum and `RatingCategoryResult` interface from `types.ts`
- Added 26 tests in `pr-calculation.test.ts` covering all functions and edge cases

## Key Decisions

- PR calculation functions are exposed as synchronous N-API calls (not async workers) since they are pure math with no engine state dependency
- Rating thresholds match gnubg `analysis.c` `arThrsRating` array exactly
- Edge cases (n <= 0, r <= 0, r >= 1) return sentinel values (-2100 or 0) matching gnubg behavior

## Files Modified

- `gnubg-node-addon/include/gnubg_core.h` - Added PR calculation function declarations and `gnubg_ratingtype` enum
- `gnubg-node-addon/lib/gnubg_core.c` - Added PR calculation function implementations
- `gnubg-node-addon/src/gnubg_addon.cpp` - Added N-API bindings for all 5 PR functions
- `gnubg-node-addon/src/index.ts` - Added TypeScript methods on `GnuBgHints` class, exported new types
- `gnubg-node-addon/src/types.ts` - Added `RatingCategory` enum and `RatingCategoryResult` interface
- `gnubg-node-addon/test/pr-calculation.test.ts` - 26 tests for all PR calculation functions

## Test Status

All 84 tests pass (7 suites), including 26 new PR calculation tests. No regressions.

## Notes

- No existing bindings were modified; all changes are additions only
- The `gnubg_ratingtype` enum values match the order in gnubg source (Awful=0 through Supernatural=7, Undefined=8)
