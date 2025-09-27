## Overview
Create a Node.js native addon to expose GNU Backgammon's hint functionality as a library, eliminating the need to spawn the binary as a subprocess.

## Objectives
- Extract core evaluation engine from GNU Backgammon C codebase
- Create N-API bindings for Node.js integration
- Provide TypeScript API for type-safe usage
- Support async/await patterns for expensive evaluations
- Bundle neural network weights efficiently

## Technical Approach
### Architecture
- **Core Engine**: Extract minimal C code for evaluation and move generation
- **N-API Layer**: C++ wrapper using node-addon-api for stability
- **TypeScript API**: Type-safe JavaScript interface with full type definitions
- **Build System**: node-gyp for cross-platform compilation

### Key Components to Extract
1. **Evaluation Engine**
   - eval.c/h - Core evaluation logic
   - neuralnet.c/h - Neural network implementation
   - bearoff.c/h - Bearoff database
   - matchequity.c/h - Match equity tables

2. **Move Generation**
   - GenerateMoves() - Legal move generation
   - FindnSaveBestMoves() - Move evaluation and ranking
   - ApplyMove() - Board state updates

3. **Hint Functions**
   - hint_move() - Best moves for dice rolls
   - hint_double() - Doubling decisions
   - hint_take() - Take/drop decisions

### TypeScript API Design
```typescript
interface Board {
  points: number[][];  // 26 points (0=bar, 25=off)
  turn: 0 | 1;         // Current player
}

interface HintRequest {
  board: Board;
  dice: [number, number];
  cubeValue: number;
  cubeOwner: -1 | 0 | 1;
  matchScore: [number, number];
  matchLength: number;
  crawford: boolean;
  jacoby: boolean;
}

interface MoveHint {
  moves: Move[];
  evaluation: number[];
  equity: number;
  rank: number;
}

interface DoubleHint {
  action: 'double' | 'no-double' | 'too-good';
  takePoint: number;
  dropPoint: number;
}

class GnuBgHints {
  static async initialize(weightsPath: string): Promise<void>;
  static async getMoveHints(request: HintRequest): Promise<MoveHint[]>;
  static async getDoubleHint(request: HintRequest): Promise<DoubleHint>;
}
```

## Implementation Plan
1. **Phase 1**: Extract and isolate core C code
2. **Phase 2**: Create N-API bindings
3. **Phase 3**: Implement TypeScript wrapper
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Performance optimization

## Benefits
- **Performance**: Direct function calls vs process spawning
- **Type Safety**: Full TypeScript support
- **Memory Efficiency**: Shared neural network weights
- **Portability**: Works across Node.js versions via N-API
- **Integration**: Easier to integrate with existing TypeScript codebase

## Dependencies
- node-addon-api: N-API C++ wrapper
- node-gyp: Build toolchain
- TypeScript: Type definitions and compilation

## Success Criteria
- [ ] Successfully evaluate positions without spawning gnubg binary
- [ ] Performance improvement over subprocess approach
- [ ] Full TypeScript type coverage
- [ ] Cross-platform support (macOS, Linux, Windows)
- [ ] Comprehensive test suite with >90% coverage

## Related Files
- deps/gnubg-nodots-1.08.003/gnubg-node-addon/ - Addon implementation
- packages/ai/ - Integration point for the addon

## References
- [N-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-api](https://github.com/nodejs/node-addon-api)
- GNU Backgammon source: deps/gnubg-nodots-1.08.003/

@kenr This issue tracks the development of a native Node.js addon to replace subprocess-based hint generation with direct library calls.