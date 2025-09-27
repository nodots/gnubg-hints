import { GnuBgHints } from '../src';

describe('GNU Backgammon Simple Tests', () => {
  describe('Static Methods', () => {
    it('should have initialize method', () => {
      expect(typeof GnuBgHints.initialize).toBe('function');
    });

    it('should have configure method', () => {
      expect(typeof GnuBgHints.configure).toBe('function');
    });

    it('should have getMoveHints method', () => {
      expect(typeof GnuBgHints.getMoveHints).toBe('function');
    });

    it('should have getDoubleHint method', () => {
      expect(typeof GnuBgHints.getDoubleHint).toBe('function');
    });

    it('should have getTakeHint method', () => {
      expect(typeof GnuBgHints.getTakeHint).toBe('function');
    });

    it('should have shutdown method', () => {
      expect(typeof GnuBgHints.shutdown).toBe('function');
    });
  });

  describe('Default Configuration', () => {
    beforeAll(async () => {
      await GnuBgHints.initialize();
    });

    afterAll(() => {
      GnuBgHints.shutdown();
    });

    it('should accept configuration object', () => {
      const config = {
        evalPlies: 1,
        moveFilter: 1,
        threadCount: 1,
        usePruning: false,
        noise: 0.1
      };

      expect(() => GnuBgHints.configure(config)).not.toThrow();
    });

    it('should accept partial configuration', () => {
      const partialConfig = {
        evalPlies: 2
      };

      expect(() => GnuBgHints.configure(partialConfig)).not.toThrow();
    });
  });

  describe('Native Addon Loading', () => {
    it('should load native addon successfully', () => {
      // This tests that the native module loads without errors
      expect(() => {
        const { GnuBgHints: LoadedClass } = require('../src');
        expect(LoadedClass).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('TypeScript Integration', () => {
    it('should export correct interfaces', () => {
      // Test that our TypeScript interfaces are properly exported
      const src = require('../src');

      expect(src.GnuBgHints).toBeDefined();
      expect(typeof src.GnuBgHints.initialize).toBe('function');
    });
  });
});

// Test just the compilation and module loading without complex board setup
describe('GNU Backgammon Module Loading', () => {
  it('should require the module without throwing', () => {
    expect(() => {
      require('../src/index');
    }).not.toThrow();
  });

  it('should export GnuBgHints class', () => {
    const module = require('../src/index');
    expect(module.GnuBgHints).toBeDefined();
    expect(typeof module.GnuBgHints).toBe('function');
  });
});