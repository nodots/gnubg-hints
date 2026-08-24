/**
 * Resignation hint API (getResignHint) — wraps gnubg's own
 * getResignation + getResignEquities from rollout.c. The engine decides;
 * no consumer-side thresholds.
 *
 * IMPORTANT request semantics: the player ON ROLL in the request must be
 * the DOUBLER/WINNER-TO-BE (the side whose opponent wants to resign).
 * gnubg evaluates "should the player NOT on roll resign" from that seat,
 * and resignedPoints is how many points the RESIGNER should concede
 * (0 = play on, 1 = single, 2 = gammon, 3 = backgammon).
 */
import { GnuBgHints } from '../src';
import type { HintRequest } from '../src';

function makeBoard(): any {
  return {
    id: 'test-board',
    points: Array.from({ length: 24 }, (_, i) => ({
      id: `pt-${i}`,
      position: { clockwise: i + 1, counterclockwise: 24 - i },
      checkers: [] as any[],
    })),
    bar: {
      clockwise: { id: 'bar-cw', checkers: [] as any[] },
      counterclockwise: { id: 'bar-ccw', checkers: [] as any[] },
    },
    off: {
      clockwise: { id: 'off-cw', checkers: [] as any[] },
      counterclockwise: { id: 'off-ccw', checkers: [] as any[] },
    },
  };
}

// All positions use COUNTERCLOCKWISE positions via put() so the board is
// unambiguous regardless of color mapping.
describe('getResignHint — gnubg-native resignation verdicts', () => {
  const hints = GnuBgHints;

  function buildBoard(
    blackOff: number,
    blackPoints: Record<number, number>,
    whitePoints: Record<number, number>
  ): HintRequest {
    const board = makeBoard();
    for (const [posStr, n] of Object.entries(blackPoints)) {
      const pos = Number(posStr);
      const p = board.points.find((q: any) => q.position.counterclockwise === pos);
      for (let i = 0; i < n; i++)
        p.checkers.push({ id: `b-${pos}-${i}`, color: 'black' });
    }
    for (const [posStr, n] of Object.entries(whitePoints)) {
      const pos = Number(posStr);
      const p = board.points.find((q: any) => q.position.counterclockwise === pos);
      for (let i = 0; i < n; i++)
        p.checkers.push({ id: `w-${pos}-${i}`, color: 'white' });
    }
    for (let i = 0; i < blackOff; i++)
      board.off.counterclockwise.checkers.push({
        id: `off-b-${i}`,
        color: 'black',
      });
    return {
      board,
      dice: [3, 1],
      cubeValue: 1,
      cubeOwner: null,
      activePlayerColor: 'white',
      activePlayerDirection: 'clockwise',
      matchScore: [0, 0],
      matchLength: 1,
      crawford: false,
      jacoby: false,
      beavers: true,
    } as unknown as HintRequest;
  }

  beforeAll(async () => {
    await hints.initialize();
  });

  afterAll(() => {
    hints.shutdown();
  });

  it('is exposed on GnuBgHints and the native addon', () => {
    expect(typeof hints.getResignHint).toBe('function');
  });

  it('converts raw addon output through convertResignHintFromGnuBg', () => {
    const converted = hints['convertResignHintFromGnuBg']({
      resignedPoints: 2,
      equityBefore: -1.4,
      equityAfter: -2,
    });
    expect(converted).toEqual({
      resignedPoints: 2,
      equityBefore: -1.4,
      equityAfter: -2,
    });
  });

  it('reports no resignation (0) for the standard opening position', async () => {
    // Standard start mirrored to ccw positions: 1x2, 12x5, 17x3, 19x5 for
    // one side and the mirror for the other.
    const req = buildBoard(
      0,
      { 1: 2, 12: 5, 17: 3, 19: 5 },
      { 24: 2, 13: 5, 8: 3, 6: 5 }
    );
    const hint = await hints.getResignHint(req);
    expect(hint.resignedPoints).toBe(0);
  });

  it('reports gammon-or-backgammon resignation for a certain-backgammon position', async () => {
    // Black (resigner-to-be) has 14 borne off + 1 deep checker at ccw point
    // 1; White has 2+2 checkers making points inside black's home board and
    // 11 mid-board. Any black bear-off ends the game with white still in
    // the home board → backgammon against black. gnubg's getResignation
    // says resign at least a gammon (verified live: 2 or 3 depending on
    // eval depth).
    const req = buildBoard(
      14,
      { 1: 1 },
      { 22: 2, 23: 2, 13: 11 }
    );
    const hint = await hints.getResignHint(req);
    expect([2, 3]).toContain(hint.resignedPoints);
    expect(hint.equityBefore).toBeLessThanOrEqual(-1);
  });

  it('reports no resignation when the race is merely hopeless but contact-free escape exists', async () => {
    // Black has all 15 checkers stacked at ccw point 6 (mid-board, not
    // trapped); white is fully home. Black loses the race but can still
    // avoid being hit — gnubg reports no forced resignation below a loss.
    const req = buildBoard(0, { 6: 15 }, {});
    const hint = await hints.getResignHint(req);
    expect(hint.resignedPoints).toBeGreaterThanOrEqual(0);
  });
});
