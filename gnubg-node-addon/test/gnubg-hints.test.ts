import { GnuBgHints, HintRequest, MoveHint, DoubleHint, TakeHint } from '../src';

describe('GNU Backgammon Hints Tests', () => {
  // Initialize before all tests
  beforeAll(async () => {
    await GnuBgHints.initialize();
  });

  // Cleanup after all tests
  afterAll(() => {
    GnuBgHints.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // Already initialized in beforeAll, just test that methods are available
      expect(typeof GnuBgHints.getMoveHints).toBe('function');
      expect(typeof GnuBgHints.getDoubleHint).toBe('function');
      expect(typeof GnuBgHints.getTakeHint).toBe('function');
    });

    it('should handle multiple initialization calls gracefully', async () => {
      // Should not throw on multiple init calls
      await expect(GnuBgHints.initialize()).resolves.toBeUndefined();
      await expect(GnuBgHints.initialize()).resolves.toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should accept valid configuration', () => {
      expect(() => {
        GnuBgHints.configure({
          evalPlies: 2,
          moveFilter: 2,
          threadCount: 1,
          usePruning: true,
          noise: 0.0
        });
      }).not.toThrow();
    });

    it('should accept partial configuration', () => {
      expect(() => {
        GnuBgHints.configure({
          evalPlies: 3
        });
      }).not.toThrow();
    });
  });

  describe('Position ID Hints', () => {
    it('should get hints from position ID with dice', async () => {
      const positionId = '4HPwATDgc/ABMA';
      const dice: [number, number] = [3, 1];

      const hints = await GnuBgHints.getHintsFromPositionId(positionId, dice);

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);
    });

    it('should handle different dice rolls', async () => {
      const positionId = '4HPwATDgc/ABMA';
      const testCases: Array<[number, number]> = [
        [6, 4],
        [5, 5],
        [2, 1],
        [3, 3]
      ];

      for (const dice of testCases) {
        const hints = await GnuBgHints.getHintsFromPositionId(positionId, dice);
        expect(Array.isArray(hints)).toBe(true);
      }
    });

    it('should limit number of hints when specified', async () => {
      const positionId = '4NvgATDgc/ABMA';
      const dice: [number, number] = [2, 1];
      const maxHints = 3;

      const hints = await GnuBgHints.getHintsFromPositionId(positionId, dice, maxHints);

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeLessThanOrEqual(maxHints);
    });
  });

  describe('Move Hints', () => {
    it('should get move hints for a board position', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [3, 1],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const hints = await GnuBgHints.getMoveHints(request);

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBeGreaterThan(0);

      // Check structure of first hint
      if (hints.length > 0) {
        const firstHint = hints[0];
        expect(firstHint).toHaveProperty('moves');
        expect(firstHint).toHaveProperty('evaluation');
        expect(firstHint).toHaveProperty('equity');
        expect(firstHint).toHaveProperty('rank');
      }
    });

    it('should rank moves by equity', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [6, 4],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const hints = await GnuBgHints.getMoveHints(request, 5);

      // Check that moves are ranked
      for (let i = 0; i < hints.length; i++) {
        expect(hints[i].rank).toBe(i + 1);
      }
    });
  });

  describe('Double Hints', () => {
    it('should get double hint for a position', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [0, 0], // Before rolling
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: true,
        beavers: false
      };

      const hint = await GnuBgHints.getDoubleHint(request);

      expect(hint).toHaveProperty('action');
      expect(['double', 'no-double', 'too-good', 'beaver', 'redouble']).toContain(hint.action);
      expect(hint).toHaveProperty('evaluation');
      expect(hint).toHaveProperty('cubefulEquity');
    });

    it('should handle Crawford game', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [0, 0],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [6, 5], // Crawford game
        matchLength: 7,
        crawford: true,
        jacoby: false,
        beavers: false
      };

      const hint = await GnuBgHints.getDoubleHint(request);

      // In Crawford game, doubling is not allowed
      expect(hint.action).toBe('no-double');
    });
  });

  describe('Take Hints', () => {
    it('should get take hint for a doubled position', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [0, 0],
        cubeValue: 2,
        cubeOwner: 'white',
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: true,
        beavers: true
      };

      const hint = await GnuBgHints.getTakeHint(request);

      expect(hint).toHaveProperty('action');
      expect(['take', 'drop', 'beaver']).toContain(hint.action);
      expect(hint).toHaveProperty('evaluation');
      expect(hint).toHaveProperty('takeEquity');
      expect(hint).toHaveProperty('dropEquity');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      // Create a new instance to test uninitialized state
      const TestClass = require('../src').GnuBgHints;

      // Force uninitialized state by calling shutdown
      TestClass.shutdown();

      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [3, 1],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      await expect(TestClass.getMoveHints(request)).rejects.toThrow('not initialized');

      // Re-initialize for other tests
      await TestClass.initialize();
    });

    it('should handle invalid position IDs gracefully', async () => {
      const invalidPositionId = 'INVALID_ID';
      const dice: [number, number] = [3, 1];

      // Should not crash but return empty or error
      const hints = await GnuBgHints.getHintsFromPositionId(invalidPositionId, dice);
      expect(Array.isArray(hints)).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should generate hints within reasonable time', async () => {
      const request: HintRequest = {
        board: createStartingBoard(),
        dice: [6, 4],
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      const startTime = Date.now();
      await GnuBgHints.getMoveHints(request, 10);
      const endTime = Date.now();

      // Should complete within 1 second
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

// Helper function to create a starting board
function createStartingBoard() {
  return {
    id: 'test-board',
    points: Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 24 - i },
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