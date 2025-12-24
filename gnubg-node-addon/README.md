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
npm install @nodots-llc/gnubg-hints
```

## Usage

```typescript
import { GnuBgHints } from '@nodots-llc/gnubg-hints'
import type { BackgammonBoard } from '@nodots-llc/backgammon-types'

// Initialize the engine (one-time setup)
await GnuBgHints.initialize()

// Configure evaluation settings (optional)
GnuBgHints.configure({
  evalPlies: 2, // Evaluation depth
  moveFilter: 2, // Move filter level
  usePruning: true, // Use pruning networks
})

// Get move hints for a position
const hints = await GnuBgHints.getMoveHints({
  board: myBoard,
  dice: [6, 1],
  activePlayerColor: 'white', // Required: who is on roll
  activePlayerDirection: 'clockwise', // Required: direction of the player on roll
  cubeValue: 1,
  cubeOwner: null,
  matchScore: [0, 0],
  matchLength: 7,
  crawford: false,
  jacoby: false,
  beavers: true,
})

// Get best moves with evaluations
hints.forEach((hint) => {
  console.log(`Move: ${hint.moves}, Equity: ${hint.equity}`)
})

// Get doubling decision
const doubleHint = await GnuBgHints.getDoubleHint({
  board: myBoard,
  activePlayerColor: 'white',
  activePlayerDirection: 'clockwise',
  cubeValue: 1,
  cubeOwner: null,
  matchScore: [3, 5],
  matchLength: 7,
  crawford: false,
  jacoby: false,
  beavers: true,
})

console.log(`Action: ${doubleHint.action}`) // "double", "no-double", "too-good"

// Clean up when done
GnuBgHints.shutdown()
```

### Using with BackgammonGame objects

For convenience, use the `createHintRequestFromGame` helper to automatically derive all hint request fields from a game state:

```typescript
import { GnuBgHints, createHintRequestFromGame } from '@nodots-llc/gnubg-hints'
import type { BackgammonGame } from '@nodots-llc/backgammon-types'

// Initialize once
await GnuBgHints.initialize()

// Create hint request from game state
const game: BackgammonGame = /* your game object */
const request = createHintRequestFromGame(game, {
  dice: [3, 1], // Override dice if needed
})

// Get hints - active player color/direction are derived from game.activePlayer
const hints = await GnuBgHints.getMoveHints(request, 5)
```

### Important: The activePlayerColor and activePlayerDirection Fields

These fields tell GNU Backgammon which player is on roll and how they move. This is critical for correct board encoding because:

- GNU BG encodes positions from the perspective of the player on roll
- Each point on a backgammon board has TWO position numbers (clockwise and counterclockwise)
- The board must be normalized to GNU's canonical X direction
- Match score and cube ownership are interpreted relative to the player on roll

Both `activePlayerColor` and `activePlayerDirection` are required for correct results.

### Command line interface

After building the project you can use the bundled CLI to retrieve the top five moves for a GNU position ID and dice roll:

```bash
npm run build
node dist/cli.js 4HPwATDgc/ABMA 3 1

# or, once published and installed globally
gnubg-hints-cli 4HPwATDgc/ABMA [3,1]
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

### `createHintRequestFromGame(game: BackgammonGame, overrides?: GameHintContextOverrides): HintRequest`

Helper function to create a `HintRequest` from a `BackgammonGame` object. Automatically derives:
- `activePlayerColor` from `game.activePlayer.color`
- `dice` from the active player's current roll
- `cubeValue` and `cubeOwner` from `game.cube`
- Match score and length from game metadata

## Types

All types are imported from `@nodots-llc/backgammon-types`:

```typescript
interface HintRequest {
  board: BackgammonBoard
  dice: [number, number]
  activePlayerColor?: BackgammonColor // Who is on roll (critical for correct encoding)
  activePlayerDirection: BackgammonMoveDirection // Direction of the player on roll
  cubeValue: number
  cubeOwner: BackgammonColor | null
  matchScore: [number, number]
  matchLength: number
  crawford: boolean
  jacoby: boolean
  beavers: boolean
}

interface MoveHint {
  moves: MoveStep[]
  evaluation: Evaluation
  equity: number
  rank: number
  difference: number
}

interface MoveStep {
  from: number           // Origin position (1-24, or 0 for bar/off)
  to: number             // Destination position (1-24, or 0 for bar/off)
  moveKind: 'point-to-point' | 'reenter' | 'bear-off'
  isHit: boolean         // Whether this move hits an opponent's blot
  player: BackgammonColor // The player making the move
  fromContainer: 'bar' | 'point' | 'off'
  toContainer: 'bar' | 'point' | 'off'
}

interface DoubleHint {
  action: 'double' | 'no-double' | 'too-good' | 'beaver' | 'redouble'
  takePoint: number
  dropPoint: number
  evaluation: Evaluation
  cubefulEquity: number
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

> **Working inside a larger workspace?**
>
> If this addon lives inside a monorepo (for example at `packages/gnubg-hints/gnubg-node-addon`), make sure you run the commands **from this directory** or pass `--prefix` so that npm targets only this package:
>
> ```bash
> npm --prefix packages/gnubg-hints/gnubg-node-addon install
> npm --prefix packages/gnubg-hints/gnubg-node-addon run build
> ```
>
> Running `npm run build` from the workspace root will execute every package's build script.

## Performance

Benchmarks comparing subprocess vs native addon:

| Operation   | Subprocess | Native Addon | Improvement |
| ----------- | ---------- | ------------ | ----------- |
| Move Hint   | 125ms      | 8ms          | 15.6x       |
| Double Hint | 95ms       | 3ms          | 31.7x       |
| Take Hint   | 92ms       | 3ms          | 30.7x       |

## License

This project is licensed under GPL-3.0, consistent with GNU Backgammon.

## Credits

Based on GNU Backgammon by Gary Wong and the GNU Backgammon team.
