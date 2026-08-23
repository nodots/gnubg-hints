/**
 * Pins the position-id side order of the hint path (issue #36).
 *
 * Convention under test — the GNU standard, everywhere in this addon:
 *   id stream first side  = TanBoard[0] = opponent
 *   id stream second side = TanBoard[1] = player on roll
 *
 * The decoder is tied to the addon's OWN encoder, not to any external id
 * corpus: the A/B pair below is encoded with `getPositionId` and pushed
 * through `getHintsFromPositionId`, on a position where the two side orders
 * disagree (a checker on the bar). A wrong-order decoder hands A's board to
 * gnubg as B and vice versa, so both directions fail loudly.
 *
 * The production fixtures are core-encoded ids from the 2026-08 incident
 * (nodots/backgammon#442): the mover is on the bar and the only correct plays
 * begin with an entry. The 2026-07-26 on-roll-first decoder answered these
 * for the opponent.
 */

import { GnuBgHints, MoveHint } from '../src'

// Raw native binding: the addon's own GNU-standard encoder/decoder.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const native = require('../build/Release/gnubg_hints.node')

type NativeBoard = number[][]

function emptySide(): number[] {
  return new Array(25).fill(0)
}

/** Order-insensitive fingerprint of a hint's steps. */
function stepKeys(hint: MoveHint): string[] {
  return hint.moves
    .map((m) => `${m.moveKind}:${m.from}>${m.to}`)
    .sort()
}

describe('position-id side order (GNU standard, issue #36)', () => {
  beforeAll(async () => {
    await GnuBgHints.initialize()
  })

  afterAll(() => {
    GnuBgHints.shutdown()
  })

  describe('production regression fixtures (core-encoded, mover on the bar)', () => {
    it('yPPgATDg8+ABUA with 1,5 enters from the bar: bar/20 6/5', async () => {
      const hints = await GnuBgHints.getHintsFromPositionId(
        'yPPgATDg8+ABUA',
        [1, 5]
      )
      expect(hints.length).toBeGreaterThan(0)
      expect(stepKeys(hints[0])).toEqual(
        ['reenter:0>20', 'point-to-point:6>5'].sort()
      )
    })

    it('4HPiQSDgc/CAUA with 1,1 enters from the bar: bar/24 8/7 6/5 6/5', async () => {
      const hints = await GnuBgHints.getHintsFromPositionId(
        '4HPiQSDgc/CAUA',
        [1, 1]
      )
      expect(hints.length).toBeGreaterThan(0)
      expect(stepKeys(hints[0])).toEqual(
        [
          'reenter:0>24',
          'point-to-point:8>7',
          'point-to-point:6>5',
          'point-to-point:6>5',
        ].sort()
      )
    })
  })

  describe('synthetic A/B through the addon’s own encoder', () => {
    // Two boards that are side-swaps of each other. Only the bar checker
    // distinguishes the side orders: under a swapped decode, A is seen as B
    // (no entry offered) and B as A (an entry the mover cannot make).
    function moverOnBarSide(): number[] {
      const side = emptySide()
      side[5] = 5 // 6-point
      side[7] = 3 // 8-point
      side[12] = 5 // 13-point
      side[23] = 1 // 24-point
      side[24] = 1 // bar
      return side
    }

    function noBarSide(): number[] {
      const side = emptySide()
      side[5] = 5
      side[7] = 3
      side[12] = 5
      side[23] = 2
      return side
    }

    it('A: mover on the bar — rank-1 hint must enter', async () => {
      const board: NativeBoard = [noBarSide(), moverOnBarSide()]
      const id = native.getPositionId(board)
      const hints = await GnuBgHints.getHintsFromPositionId(id, [3, 5])
      expect(hints.length).toBeGreaterThan(0)
      expect(hints[0].moves.some((m) => m.moveKind === 'reenter')).toBe(true)
    })

    it('B: opponent on the bar — no hint may contain an entry', async () => {
      const board: NativeBoard = [moverOnBarSide(), noBarSide()]
      const id = native.getPositionId(board)
      const hints = await GnuBgHints.getHintsFromPositionId(id, [3, 5])
      expect(hints.length).toBeGreaterThan(0)
      for (const hint of hints) {
        expect(hint.moves.some((m) => m.moveKind === 'reenter')).toBe(false)
      }
    })

    it('native encode/decode round-trips the board unchanged', () => {
      const board: NativeBoard = [noBarSide(), moverOnBarSide()]
      const decoded = native.decodePositionId(native.getPositionId(board))
      expect(decoded).toEqual(board)
    })
  })
})
