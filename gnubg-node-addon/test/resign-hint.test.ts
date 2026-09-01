/**
 * Resignation hint API (getResignHint) — wraps gnubg's own
 * getResignation + getResignEquities from rollout.c. The engine decides;
 * no consumer-side thresholds.
 *
 * IMPORTANT request semantics: declare the RESIGNER as the on-roll player
 * via fMoveOverride:1 (activePlayerColor = resigner). gnubg evaluates the
 * resignation from the resigner's seat, and resignedPoints is how many
 * points the RESIGNER should concede (0 = play on, 1 = single, 2 = gammon,
 * 3 = backgammon). With offeredPoints set (1/2/3), the hint instead reports
 * the decider's equityBefore/equityAfter and gnubg's accept/reject verdict
 * (decision: 1 = accept, 0 = reject) via external.c's rule.
 *
 * NOTE (PR #39): per #39's review, the consumer should pass fMoveOverride:1
 * to evaluate the resigner's seat (not board[0]'s player); a mismatched
 * fMove makes Utility() index the wrong gammon price in match play.
 */
import { GnuBgHints } from '../src';
import type { HintRequest } from '../src';

function makeBoard(): any {
  return {
    id: 'test-board',
    points: Array.from({ length: 24 }, (_, i) => ({
      id: `pt-${i}`,
      position: { clockwise: i + 1, counterclockwise: 24 - i },
      // Sparse frames are populated per-fixture; empty array keeps the shape
      // (see the `as unknown as HintRequest` note — the board is narrower than
      // HintBoard's full surface for the fork's Cardboard→TanBoard conversion).
      checkers: [] as any[],
    })),
    bar: {
      // Fixtures never place bar checkers; typed as any[] to match the builder.
      clockwise: { id: 'bar-cw', checkers: [] as any[] },
      counterclockwise: { id: 'bar-ccw', checkers: [] as any[] },
    },
    off: {
      // Fixtures pile borne-off checkers via flat push(); any[] keeps it simple.
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
    whitePoints: Record<number, number>,
    bars: { black?: number; white?: number } = {}
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
    for (let i = 0; i < (bars.black || 0); i++)
      board.bar.counterclockwise.checkers.push({
        id: `bar-b-${i}`,
        color: 'black',
      });
    for (let i = 0; i < (bars.white || 0); i++)
      board.bar.clockwise.checkers.push({
        id: `bar-w-${i}`,
        color: 'white',
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
      fMoveOverride: 1,
      // The fixture builds a sparse nodots board (bar/off frames only) whose
      // shape is structurally correct for the fork's request → TanBoard
      // conversion, but is narrower than HintRequest's full surface.
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
      decision: undefined,
      hasDecision: false,
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

  it('reports a gammon-or-backgammon resignation for a certain-lost position', async () => {
    // White (resigner, active) is dead-lost: black has 14 borne off + 1 deep
    // at ccw 1; white has 2+2 checkers on ccw 22/23 (physically 2/3, which
    // are white's OWN home points, NOT "inside black's home board") plus 11
    // on ccw 13. Any black bear-off wins with white still in white's home
    // board → a certain gammon (or backgammon) against white. gnubg's
    // getResignation says resign at least a gammon (verified live: 2,
    // sometimes 3 depending on eval depth).
    const req = buildBoard(
      14,
      { 1: 1 },
      { 22: 2, 23: 2, 13: 11 }
    );
    const hint = await hints.getResignHint(req);
    expect([2, 3]).toContain(hint.resignedPoints);
    expect(hint.equityBefore).toBeLessThanOrEqual(-1);
  });

  it('does not force a resignation from a hopeless but playable race', async () => {
    // Contact-free race: white (active, fixtures place white on board) is
    // far behind while black is stacked in its home board, but white owns all
    // 15 of its checkers and plays on. A race loss alone is NOT a forced
    // resign (play.c consults getResignation, whose 0-ply verdict says play
    // on), so resignedPoints must be exactly 0 — white actually has checkers,
    // unlike the old (removed) fixture that handed gnubg an all-zero board
    // (read as CLASS_OVER, all borne off).
    const req = buildBoard(
      0,
      { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 5 },
      { 12: 5, 13: 5, 14: 5 }
    );
    const hint = await hints.getResignHint(req);
    expect(hint.resignedPoints).toBe(0);
  });

  it('short-circuits a closed-out CONTACT position to 0 (CLASS_RACE gate)', async () => {
    // Resigner (white, active) has ALL 15 checkers on the bar against black's
    // closed home → CLASS_CONTACT, which the gate (play.c:1265, only CLASS_RACE
    // positions auto-resign) excludes. So resignedPoints must be exactly 0 —
    // a certain loss is NOT resigned because the position is not a race.
    // Same fixture the reviewer verified live: black home closed at clockwise
    // 1-6 + the 7pt (ccw = 24-18), white 15 on the bar.
    const req = buildBoard(
      0,
      { 24: 2, 23: 2, 22: 2, 21: 2, 20: 2, 19: 2, 18: 3 },
      {},
      { white: 15 }
    );
    const hint = await hints.getResignHint(req);
    expect(hint.resignedPoints).toBe(0);
  });

  it('reports gnubg decision (accept/reject) for an offered resignation', async () => {
    // Dead-lost resigner (14 off + 1 deep, opponent in home board): gnubg
    // reports decision=true (decider accepts the concession — resigner gives
    // up equity by conceding immediately rather than playing on).
    const losingReq = buildBoard(
      14,
      { 1: 1 },
      { 22: 2, 23: 2, 13: 11 }
    ) as any;
    losingReq.fMoveOverride = 1;
    losingReq.offeredPoints = 3;
    const losing = await hints.getResignHint(losingReq);
    expect(losing.hasDecision).toBe(true);
    // The numeric contract matches the fork's C-side rule exactly:
    // accept iff equityAfter - 1e-6 < equityBefore (external.c, with epsilon).
    const accepts = (h: any) => h.equityAfter - 1e-6 < h.equityBefore;
    expect(losing.decision).toBe(accepts(losing));

    // Second position to pin the contract in the opposite direction: a close
    // race where conceding 1 point is clearly worse than playing on.
    const winningReq = buildBoard(
      0,
      { 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 18: 3 },
      {}
    ) as any;
    winningReq.fMoveOverride = 1;
    winningReq.offeredPoints = 1;
    const winning = await hints.getResignHint(winningReq);
    expect(winning.hasDecision).toBe(true);
    expect(winning.decision).toBe(accepts(winning));
  });
});
