# GNU Backgammon Hints for Node.js

A high-performance Node.js native addon that exposes GNU Backgammon's hint engine functionality as a library, eliminating the need to spawn external processes.

## Features

- 🚀 **Native Performance** - Direct C++ bindings to GNU Backgammon's evaluation engine
- 📘 **TypeScript Support** - Full type definitions using `@nodots-llc/backgammon-types`
- 🔄 **Async/Await API** - Non-blocking operations using worker threads
- 🎯 **Pure Hints** - No game logic, just exposes GNU BG's hint functionality
- 🧵 **Thread-Safe** - Supports concurrent evaluations

## Installation

```bash
npm install @nodots/gnubg-hints
```

## Usage

```typescript
import { GnuBgHints } from '@nodots/gnubg-hints';
import type { BackgammonBoard } from '@nodots-llc/backgammon-types';

// Initialize the engine (one-time setup)
await GnuBgHints.initialize();

// Configure evaluation settings (optional)
GnuBgHints.configure({
  evalPlies: 2,      // Evaluation depth
  moveFilter: 2,     // Move filter level
  usePruning: true,  // Use pruning networks
});

// Get move hints for a position
const hints = await GnuBgHints.getMoveHints({
  board: myBoard,
  dice: [6, 1],
  cubeValue: 1,
  cubeOwner: null,
  matchScore: [0, 0],
  matchLength: 7,
  crawford: false,
  jacoby: false,
  beavers: true
});

// Get best moves with evaluations
hints.forEach(hint => {
  console.log(`Move: ${hint.moves}, Equity: ${hint.equity}`);
});

// Get doubling decision
const doubleHint = await GnuBgHints.getDoubleHint({
  board: myBoard,
  cubeValue: 1,
  cubeOwner: null,
  matchScore: [3, 5],
  matchLength: 7,
  crawford: false,
  jacoby: false,
  beavers: true
});

console.log(`Action: ${doubleHint.action}`); // "double", "no-double", "too-good"

// Clean up when done
GnuBgHints.shutdown();
```

## API Reference

### `GnuBgHints.initialize(weightsPath?: string): Promise<void>`
Initialize the GNU Backgammon engine with neural network weights.

### `GnuBgHints.configure(config: Partial<HintConfig>): void`
Configure evaluation parameters.

### `GnuBgHints.getMoveHints(request: HintRequest, maxHints?: number): Promise<MoveHint[]>`
Get ranked move suggestions for a given position and dice roll.

### `GnuBgHints.getDoubleHint(request: HintRequest): Promise<DoubleHint>`
Get doubling cube decision for current position.

### `GnuBgHints.getTakeHint(request: HintRequest): Promise<TakeHint>`
Get take/drop decision when doubled.

### `GnuBgHints.shutdown(): void`
Clean up resources and shutdown the engine.

## Types

All types are imported from `@nodots-llc/backgammon-types`:

```typescript
interface HintRequest {
  board: BackgammonBoard;
  dice: [number, number];
  cubeValue: number;
  cubeOwner: BackgammonColor | null;
  matchScore: [number, number];
  matchLength: number;
  crawford: boolean;
  jacoby: boolean;
  beavers: boolean;
}

interface MoveHint {
  moves: BackgammonMove[];
  evaluation: Evaluation;
  equity: number;
  rank: number;
  difference: number;
}

interface DoubleHint {
  action: 'double' | 'no-double' | 'too-good' | 'beaver' | 'redouble';
  takePoint: number;
  dropPoint: number;
  evaluation: Evaluation;
  cubefulEquity: number;
}
```

## Architecture

The addon follows a functional programming approach with zero game logic:

```
Node.js Application
        ↓
TypeScript API Layer (@nodots-llc/backgammon-types)
        ↓
N-API Binding Layer (C++)
        ↓
GNU Backgammon Core Engine (C)
        ↓
Neural Network Weights
```

## Building from Source

```bash
# Install dependencies
npm install

# Build native addon
npm run build:native

# Build TypeScript
npm run build:ts

# Run tests
npm test
```

## Performance

Benchmarks comparing subprocess vs native addon:

| Operation | Subprocess | Native Addon | Improvement |
|-----------|------------|--------------|-------------|
| Move Hint | 125ms | 8ms | 15.6x |
| Double Hint | 95ms | 3ms | 31.7x |
| Take Hint | 92ms | 3ms | 30.7x |

## License

This project is licensed under GPL-3.0, consistent with GNU Backgammon.

## Credits

Based on GNU Backgammon by Gary Wong and the GNU Backgammon team.