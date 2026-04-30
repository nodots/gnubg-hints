/**
 * Regression for issue nodots/gnubg-hints#30: equity-tied bearoff hints
 * misranked by float-precision noise from cubeful eval.
 *
 * Production end-game (game bf09273a-... in nodots/backgammon-ai#41): black
 * has 1 checker on point 2, 1 on point 1, 13 already off; white pip 18 (no
 * gammon possible). With dice [1,4] the lines `2->1, 1->off` (slow, leaves a
 * checker) and `1->off, 2->off` (immediate win) both have cubeless equity 1.0
 * but cubeful eval ranks them in essentially-random order (5e-7 apart).
 *
 * Acceptance: hints[0] is the immediate-win line. The library tiebreaker
 * applies the racing principle "off > pips" to equity-tied hints regardless
 * of the cubeful wrapper's float noise.
 */

import { GnuBgHints } from '../src'

describe('Equity-tied tiebreaker (issue #30)', () => {
  beforeAll(async () => {
    await GnuBgHints.initialize()
    await GnuBgHints.configure({
      evalPlies: 2,
      moveFilter: 2,
      usePruning: true,
      noise: 0,
    })
  })

  afterAll(() => {
    GnuBgHints.shutdown()
  })

  // Position rwcAABQAAAAAAA: black on roll (counterclockwise), 2 checkers in
  // home, white has 9 in home + 6 off. Captured directly from the production
  // game referenced in issue #41.
  const PRODUCTION_PID = 'rwcAABQAAAAAAA'

  it.each([
    [1, 4],
    [4, 1],
  ])(
    'ranks the immediate-win bear-off line first for [%d,%d]',
    async (d1, d2) => {
      const hints = await GnuBgHints.getHintsFromPositionId(
        PRODUCTION_PID,
        [d1, d2],
        5,
        'counterclockwise',
        'black'
      )

      expect(hints.length).toBeGreaterThanOrEqual(2)
      const top = hints[0]
      const second = hints[1]

      // The two lines are within float-precision noise of equal equity.
      expect(Math.abs((top.equity ?? 0) - (second.equity ?? 0))).toBeLessThan(
        1e-3
      )

      // Top line must bear off both checkers (to=0 means off in raw GNU).
      const bearOffMoves = (top.moves || []).filter(
        (m: { moveKind?: string }) => m.moveKind === 'bear-off'
      )
      expect(bearOffMoves).toHaveLength(2)
    }
  )

  it('preserves GNU ranking when equity differs beyond the tiebreak epsilon', async () => {
    // For a roll where one line is clearly better, the tiebreaker must NOT
    // override GNU. Use the standard opening 31 from the start position --
    // 8/5 6/5 is meaningfully ahead of any alternative, far above 1e-4.
    const STARTING_PID = '4HPwATDgc/ABMA' // standard opening
    const hints = await GnuBgHints.getHintsFromPositionId(
      STARTING_PID,
      [3, 1],
      5,
      'clockwise',
      'white'
    )
    expect(hints.length).toBeGreaterThanOrEqual(2)
    // hints[0] should still be GNU's choice; equity gap should be > epsilon.
    const gap = Math.abs((hints[0].equity ?? 0) - (hints[1].equity ?? 0))
    expect(gap).toBeGreaterThan(1e-4)
  })
})
