import { GnuBgHints, HintRequest, MoveStep } from '../src'

/**
 * Tests for board encoding fix (Issue #232)
 *
 * The bug: convertBoardToGnuBg() applied opposite mirroring to X and O arrays.
 * The fix: Both arrays must use the same coordinate system (X's perspective).
 *
 * GNU checks blocking with: if (next[1][dest] >= 2) - same index space for both.
 */
describe('Board Encoding - Blocking Detection', () => {
  beforeAll(async () => {
    await GnuBgHints.initialize()
  })

  afterAll(() => {
    GnuBgHints.shutdown()
  })

  /**
   * Creates a board with:
   * - Active player (white) at position 8 (2 checkers)
   * - Opponent (black) blocking positions 4 and 5 (2+ checkers each)
   * - Die roll 4 would try to move from 8 to 4, which should be blocked
   */
  function createBlockedBoard() {
    const points = Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 24 - i },
      checkers: [] as Array<{ color: 'white' | 'black' }>
    }))

    // White checkers at clockwise position 8 (index 7)
    points[7].checkers = [{ color: 'white' }, { color: 'white' }]
    // Add more white checkers elsewhere to total 15
    points[5].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }] // pos 6
    points[0].checkers = [{ color: 'white' }, { color: 'white' }] // pos 1
    points[11].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }] // pos 12
    points[12].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }] // pos 13

    // Black checkers blocking clockwise positions 4 and 5 (indices 3 and 4)
    points[3].checkers = [{ color: 'black' }, { color: 'black' }] // pos 4 - blocked
    points[4].checkers = [{ color: 'black' }, { color: 'black' }] // pos 5 - blocked

    // Add more black checkers to total 15
    points[18].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }] // pos 19
    points[19].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }] // pos 20
    points[20].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }] // pos 21

    return {
      id: 'test-blocked-board',
      points,
      bar: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      },
      off: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      }
    }
  }

  it('should not suggest moves to blocked points for clockwise player', async () => {
    const board = createBlockedBoard()

    const request: HintRequest = {
      board,
      dice: [4, 3] as [number, number],
      activePlayerColor: 'white',
      activePlayerDirection: 'clockwise',
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0] as [number, number],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: false
    }

    const hints = await GnuBgHints.getMoveHints(request)

    // Positions 4 and 5 are blocked by black (2+ checkers)
    const blockedPositions = [4, 5]

    for (const hint of hints) {
      for (const move of hint.moves) {
        // No move should land on a blocked position
        expect(blockedPositions).not.toContain(move.to)
      }
    }
  })

  it('should not suggest moves to blocked points for counterclockwise player', async () => {
    // Create a board where black is on roll (counterclockwise)
    const points = Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 24 - i },
      checkers: [] as Array<{ color: 'white' | 'black' }>
    }))

    // Black checkers at counterclockwise position 8 (clockwise position 17, index 16)
    points[16].checkers = [{ color: 'black' }, { color: 'black' }]
    // More black checkers
    points[18].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }]
    points[19].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }]
    points[20].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }]
    points[23].checkers = [{ color: 'black' }, { color: 'black' }]

    // White blocking counterclockwise positions 4 and 5 (clockwise 21 and 20, indices 20 and 19)
    points[20].checkers = [{ color: 'white' }, { color: 'white' }] // ccw pos 4 - blocked
    points[19].checkers = [{ color: 'white' }, { color: 'white' }] // ccw pos 5 - blocked

    // More white checkers
    points[0].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }]
    points[5].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }]
    points[11].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }]

    const board = {
      id: 'test-blocked-board-ccw',
      points,
      bar: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      },
      off: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      }
    }

    const request: HintRequest = {
      board,
      dice: [4, 3] as [number, number],
      activePlayerColor: 'black',
      activePlayerDirection: 'counterclockwise',
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0] as [number, number],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: false
    }

    const hints = await GnuBgHints.getMoveHints(request)

    // Counterclockwise positions 4 and 5 are blocked by white (2+ checkers)
    const blockedPositions = [4, 5]

    for (const hint of hints) {
      for (const move of hint.moves) {
        // No move should land on a blocked position (in player's coordinate system)
        expect(blockedPositions).not.toContain(move.to)
      }
    }
  })

  it('should generate valid hints for both directions from same physical board', async () => {
    // Create starting position
    const points = Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 24 - i },
      checkers: [] as Array<{ color: 'white' | 'black' }>
    }))

    // Standard starting position for white (clockwise)
    // pos 24: 2 checkers, pos 13: 5 checkers, pos 8: 3 checkers, pos 6: 5 checkers
    points[23].checkers = [{ color: 'white' }, { color: 'white' }] // pos 24
    points[12].checkers = Array(5).fill({ color: 'white' }) // pos 13
    points[7].checkers = [{ color: 'white' }, { color: 'white' }, { color: 'white' }] // pos 8
    points[5].checkers = Array(5).fill({ color: 'white' }) // pos 6

    // Standard starting position for black (counterclockwise)
    // In counterclockwise, pos 24 = clockwise pos 1, etc.
    points[0].checkers.push({ color: 'black' }, { color: 'black' }) // ccw pos 24 = cw pos 1
    points[11].checkers.push(...Array(5).fill({ color: 'black' })) // ccw pos 13 = cw pos 12
    points[16].checkers = [{ color: 'black' }, { color: 'black' }, { color: 'black' }] // ccw pos 8 = cw pos 17
    points[18].checkers = Array(5).fill({ color: 'black' }) // ccw pos 6 = cw pos 19

    const board = {
      id: 'test-starting-board',
      points,
      bar: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      },
      off: {
        clockwise: { checkers: [] },
        counterclockwise: { checkers: [] }
      }
    }

    // Test clockwise player
    const cwRequest: HintRequest = {
      board,
      dice: [3, 1] as [number, number],
      activePlayerColor: 'white',
      activePlayerDirection: 'clockwise',
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0] as [number, number],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: false
    }

    const cwHints = await GnuBgHints.getMoveHints(cwRequest)
    expect(cwHints.length).toBeGreaterThan(0)

    // Test counterclockwise player
    const ccwRequest: HintRequest = {
      board,
      dice: [3, 1] as [number, number],
      activePlayerColor: 'black',
      activePlayerDirection: 'counterclockwise',
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0] as [number, number],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: false
    }

    const ccwHints = await GnuBgHints.getMoveHints(ccwRequest)
    expect(ccwHints.length).toBeGreaterThan(0)

    // Both should return valid hints (move positions in player's coordinate system)
    for (const hint of cwHints) {
      for (const move of hint.moves) {
        if (move.to > 0) {
          expect(move.to).toBeGreaterThanOrEqual(1)
          expect(move.to).toBeLessThanOrEqual(24)
        }
      }
    }

    for (const hint of ccwHints) {
      for (const move of hint.moves) {
        if (move.to > 0) {
          expect(move.to).toBeGreaterThanOrEqual(1)
          expect(move.to).toBeLessThanOrEqual(24)
        }
      }
    }
  })
})
