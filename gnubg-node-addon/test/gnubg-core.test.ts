import { GnuBgHints } from '../src';

describe('GNU Backgammon Core Integration', () => {
  beforeAll(async () => {
    console.log('Initializing GNU Backgammon hint engine...');
  });

  afterAll(() => {
    console.log('Shutting down GNU Backgammon hint engine...');
    GnuBgHints.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize the hint engine successfully', async () => {
      expect(() => GnuBgHints.initialize()).not.toThrow();
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await GnuBgHints.initialize();
      await GnuBgHints.initialize(); // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should configure engine settings', () => {
      const config = {
        evalPlies: 2,
        moveFilter: 1,
        threadCount: 1,
        usePruning: true,
        noise: 0.0
      };

      expect(() => GnuBgHints.configure(config)).not.toThrow();
    });
  });

  describe('Basic Hint Generation', () => {
    beforeEach(async () => {
      await GnuBgHints.initialize();
    });

    it('should generate move hints for simple position', async () => {
      // Simple request structure for testing
      const basicRequest = {
        board: createSimpleBoard(),
        dice: [3, 4] as [number, number],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const hints = await GnuBgHints.getMoveHints(basicRequest, 5);

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThanOrEqual(0);

      // Verify hint structure if hints exist
      if (hints.length > 0) {
        const hint = hints[0];
        expect(hint).toHaveProperty('moves');
        expect(hint).toHaveProperty('evaluation');
        expect(hint).toHaveProperty('equity');
        expect(hint).toHaveProperty('rank');
      }
    });

    it('should generate double hints', async () => {
      const basicRequest = {
        board: createSimpleBoard(),
        dice: [1, 1] as [number, number],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const hint = await GnuBgHints.getDoubleHint(basicRequest);

      expect(hint).toHaveProperty('action');
      expect(hint).toHaveProperty('evaluation');
      expect(['double', 'no-double', 'too-good', 'beaver', 'redouble']).toContain(hint.action);
    });

    it('should generate take hints', async () => {
      const basicRequest = {
        board: createSimpleBoard(),
        dice: [2, 5] as [number, number],
        cubeValue: 2,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const hint = await GnuBgHints.getTakeHint(basicRequest);

      expect(hint).toHaveProperty('action');
      expect(hint).toHaveProperty('evaluation');
      expect(['take', 'drop', 'beaver']).toContain(hint.action);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid board positions gracefully', async () => {
      await GnuBgHints.initialize();

      const invalidRequest = {
        board: null as any,
        dice: [3, 4] as [number, number],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      await expect(GnuBgHints.getMoveHints(invalidRequest, 5))
        .rejects.toThrow();
    });

    it('should handle engine not initialized', async () => {
      GnuBgHints.shutdown();

      const request = {
        board: createSimpleBoard(),
        dice: [3, 4] as [number, number],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      await expect(GnuBgHints.getMoveHints(request, 5))
        .rejects.toThrow('GnuBgHints not initialized');
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      await GnuBgHints.initialize();
    });

    it('should complete hint generation within reasonable time', async () => {
      const request = {
        board: createComplexBoard(),
        dice: [6, 5] as [number, number],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0] as [number, number],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const startTime = Date.now();
      const hints = await GnuBgHints.getMoveHints(request, 10);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(Array.isArray(hints)).toBe(true);
    });
  });
});

// Helper functions to create test boards
function createSimpleBoard(): any {
  // Simplified board representation for testing
  return {
    points: Array.from({ length: 24 }, (_, i) => ({
      position: {
        clockwise: i + 1,
        counterclockwise: 24 - i
      },
      checkers: []
    })),
    bar: {
      clockwise: { checkers: [] },
      counterclockwise: { checkers: [] }
    },
    off: {
      clockwise: { checkers: [] },
      counterclockwise: { checkers: [] }
    }
  };
}

function createComplexBoard(): any {
  const board = createSimpleBoard();

  // Add some checkers to create a more realistic position
  // Starting position approximation
  board.points[23].checkers = Array(2).fill({ color: 'white' });
  board.points[12].checkers = Array(5).fill({ color: 'white' });
  board.points[7].checkers = Array(3).fill({ color: 'white' });
  board.points[5].checkers = Array(5).fill({ color: 'white' });

  board.points[0].checkers = Array(2).fill({ color: 'black' });
  board.points[11].checkers = Array(5).fill({ color: 'black' });
  board.points[16].checkers = Array(3).fill({ color: 'black' });
  board.points[18].checkers = Array(5).fill({ color: 'black' });

  return board;
}