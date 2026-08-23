# `decode_position_id` side order — the full trail (two wrong fixes deep)

**Status: FIXED (again) — GNU-standard side order restored** in
`src/hint_wrapper.cpp`: the id's first side is `board[0]` (the opponent), the
second is `board[1]` (the player on roll). Pinned by
`test/position-id-side-order.test.ts`. Issue: nodots/gnubg-hints#36.

## The 2026-07-26 "fix" below was itself a regression

The chapter that follows this note aligned the decoder to an ON-ROLL-FIRST
dialect on the premise that "the addon ecosystem's ids are on-roll-first."
That premise was false for every production caller:

- core's `exportToGnuPositionId`, the ids stored in game history and replayed
  by the practice endpoints, are **opponent-first** — the GNU standard
  (`oldPositionKey` emits `anBoard[0]` first, and `anBoard[1]` is the mover).
- this addon's own encoder (`getPositionId` → `gnubg_position_id` →
  `PositionID`) is the GNU standard for the same reason.
- `api-utils`' `decodePositionId` decodes opponent-first, so the client drew
  the board correctly while the native decoder answered for the other player.

The on-roll-first dialect is real but lives elsewhere: the protocol-adapter /
backgammon-neural reference set carries such ids, and its consumers decode
them **themselves** (neural's `decodePositionId` takes `{ onRollFirst: true }`;
the adapter's `decodeSides` declares `positionIdConvention: 'on-roll-first'`
at its boundary). None of them call `decode_position_id`. The 346/346
validation that justified the 2026-07-26 change ran against those ids — it
proved the decoder matched the reference set's dialect, and in doing so
inverted every core-encoded id. Production served wrong-side practice hints
from 2026-07-27 until this fix (nodots/backgammon#442).

The lesson stacks on the one below: the first wrong fix patched a symptom; the
second validated against a single corpus without asking which dialect that
corpus spoke. The regression test now encodes with the addon's own encoder and
checks a position where the two orders disagree (mover on the bar), so the
decoder is tied to the encoder it must mirror, not to any external id corpus.

---

# Second chapter (2026-07-26, WRONG for core ids — kept for the trail)

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
