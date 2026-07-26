# FIXED: `decode_position_id` handed gnubg every position with the sides swapped

**Status: FIXED 2026-07-26** in `src/hint_wrapper.cpp` (`decode_position_id`
now writes the id's first side into `board[1]`, gnubg's mover slot).

**The original title of this report was wrong in an instructive way.** The bug
was never bar-specific: the decode placed the stream's FIRST side into
`board[0]` while the addon ecosystem's ids are on-roll-first and gnubg's
`FindnSaveBestMoves` reads the mover from `board[1]` — so EVERY position went
in swapped. It merely *looked* bar-specific through survivorship: a swapped
answer is often still legal on near-symmetric boards (openings, races) and
reliably illegal on asymmetric ones (primes, bar positions).

Measured: before the fix only **225/346** reference positions received a legal
answer through the id path; after, **346/346** (compared by resulting position),
and the synthetic bar A/B passes in both directions. The "unidentified
compensating mechanism" this report warned about did not exist — it was
survivorship, and the warning against symptom-patching was still right, because
patching the bar alone would have left the other 115 illegal answers in place.

---

# Original report (kept for the trail)


Filed 2026-07-26 from the protocol-adapter investigation. The adapter and the
conformance suite now route around this; the addon itself is still wrong, and
every other caller of `getHintsFromPositionId` inherits it.

## Reproduction (synthetic, decisive)

Encode two boards with the documented layout (each side: 24 points then own
bar; on-roll side first) and ask for hints:

- **A. on-roll player has 1 on the bar** → gnubg answers a NORMAL move
  (it thinks the opponent is on the bar).
- **B. opponent has 1 on the bar** → gnubg ENTERS from the bar
  (it thinks the on-roll player is on the bar).

Exactly inverted. Runnable form: `backgammon-neural` @ `9837ba7`, the synthetic
A/B in the session notes; or walk `debugProtocolGame.mjs` — with the old
adapter path a game corrupts at the first hit.

## The trail

1. `src/index.ts:261` `getHintsFromPositionId` — passes the raw id to native
   `addon.getMoveHints`. The comment at ~line 278 ("The position ID already has
   the on-roll player in TanBoard[0]. No swap needed") is where a previous
   attempt wrestled with this; note it claims on-roll belongs in **[0]**.
2. `src/hint_wrapper.cpp:68` `decode_position_id` — writes the id's FIRST side
   into `board[0]`, second into `board[1]`.
3. `src/hint_wrapper.cpp:343` → `gnubg_hint_move_with_cube(board, …)` →
   `lib/gnubg_core.c:152` → `FindnSaveBestMoves((ConstTanBoard)board, …)`.
   GNU Backgammon's TanBoard convention is **`anBoard[1]` = player on roll**.

So for an on-roll-first id, the on-roll player lands in `board[0]` — the
opponent's slot. The puzzle is that **points behave correctly in practice while
only the bar misbehaves** (thousands of board-path battery games are fine, and
the id path answers plain positions legally). Something downstream compensates
for the side order on points but not on the bar — that mechanism was NOT
identified, and the fix must not be attempted by symptom-patching.

## Constraints on a correct fix

Pick ONE convention and align all four places:
- `decode_position_id` (`src/hint_wrapper.cpp:68`)
- `buildCanonicalBoard` / `getPositionId` (dist/index.js ~320–348; TS source in `src/index.ts`)
- `gnubg_position_from_id` / `gnubg_position_id` (`src/gnubg_addon.cpp:148–176`)
- the hint call's TanBoard expectation (`anBoard[1]` = on roll)

## Acceptance tests (all three, no exceptions)

1. Synthetic bar A/B above: A must ENTER, B must play a normal move.
2. `debugProtocolGame.mjs` 60-ply walk driven through `getHintsFromPositionId`:
   zero illegal answers through hits, dances, bear-off.
3. Plain-position regression: refset rank-1 match rate on the 346 trustworthy
   ids must not drop (the convention test in `backgammon-neural
   test/positionId-convention.test.ts` must stay green).

## Related but separate

- The refset's own `positionId`s are corrupt for all 45 bar positions
  (generator-side encode bug, different from this one). Do not use them as
  ground truth for this fix; use the synthetic tests and walked games.
