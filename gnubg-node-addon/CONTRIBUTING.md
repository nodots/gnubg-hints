# Contributing to GNU Backgammon Hints

Thank you for your interest in contributing! This project provides Node.js bindings for GNU Backgammon's hint engine.

## Development Setup

### Prerequisites

- Node.js 16+
- Python 3.x (for node-gyp)
- C++ compiler toolchain
- GNU Backgammon source code (provided in parent directory)

### Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Extract GNU BG core files**
   ```bash
   ./scripts/extract-gnubg-core.sh
   ```

3. **Build the addon**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

```
gnubg-node-addon/
├── src/                    # TypeScript source
│   ├── index.ts           # Main API
│   ├── gnubg_addon.cpp    # N-API module
│   ├── hint_wrapper.cpp   # C++ wrapper
│   └── board_converter.cpp # Board format conversion
├── include/               # C/C++ headers (generated)
├── lib/                   # Extracted GNU BG files (generated)
├── test/                  # Jest tests
├── benchmark/             # Performance benchmarks
├── scripts/               # Build and extraction scripts
└── .github/workflows/     # CI/CD pipelines
```

## Architecture Principles

This project follows strict architectural principles:

### 1. Zero Game Logic
- **Rule**: No backgammon game logic in our code
- **Why**: All game logic should come from GNU Backgammon
- **Implementation**: We only expose GNU BG's hint functions

### 2. Functional Programming
- **Rule**: Prefer functional over imperative patterns
- **Examples**:
  - Use `switch` expressions over `if/else` chains
  - Use functional factories for object creation
  - Prefer immutable data structures

### 3. Type Safety
- **Rule**: Use `@nodots-llc/backgammon-types` exclusively
- **Why**: Consistency with the Nodots Backgammon ecosystem
- **Implementation**: Never define local types that duplicate package types

## Code Guidelines

### TypeScript

```typescript
// ✅ Good: Using official types
import { BackgammonBoard, BackgammonColor } from '@nodots-llc/backgammon-types';

// ✅ Good: Functional factory
static fromJsObject(obj: Napi::Object): HintRequest {
  return {
    dice: [obj.Get("dice0"), obj.Get("dice1")],
    // ...
  };
}

// ❌ Bad: Local type definition
interface MyBoard { /* ... */ }

// ❌ Bad: Imperative style
if (color === 'white') {
  // ...
} else if (color === 'black') {
  // ...
}
```

### C++

```cpp
// ✅ Good: Switch expression pattern
std::string mapAction(int decision) {
    switch (decision) {
        case 0: return "no-double";
        case 1: return "double";
        case 2: return "too-good";
        default: return "no-double";
    }
}

// ✅ Good: Functional approach
auto createBoard = [&](const Napi::Object& obj) -> BoardData {
    return BoardData::fromJsObject(obj);
};

// ❌ Bad: Manual if/else chains
```

### Error Handling

- Use functional error patterns
- Return error codes from C functions
- Convert to JavaScript exceptions in N-API layer
- Never crash the process

## Testing

### Test Structure

- **Unit Tests**: Individual function testing
- **Integration Tests**: Full workflow testing
- **Performance Tests**: Benchmark comparisons
- **Error Tests**: Edge case and error handling

### Running Tests

```bash
# All tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Specific test file
npm test -- gnubg-hints.test.ts
```

### Test Requirements

- Minimum 80% code coverage
- All tests must pass before merging
- Include performance benchmarks
- Test error conditions

## Building

### Development Build

```bash
npm run build:native  # Build C++ addon
npm run build:ts     # Build TypeScript
npm run build        # Build both
```

### Production Build

```bash
npm run rebuild      # Clean rebuild
```

### Platform Support

The addon must build on:
- macOS (Intel & Apple Silicon)
- Linux (Ubuntu 18.04+)
- Windows (Visual Studio 2019+)

## Performance Requirements

### Target Performance

Based on subprocess comparison:

| Operation | Target Time | Baseline (subprocess) |
|-----------|-------------|----------------------|
| Move Hint | < 10ms | 125ms |
| Double Hint | < 5ms | 95ms |
| Take Hint | < 5ms | 92ms |

### Optimization

- Use `-O3` compilation
- Enable SIMD when available
- Minimize memory allocations
- Cache neural network weights

## Release Process

### Version Bumping

```bash
npm version patch  # Bug fixes
npm version minor  # New features
npm version major  # Breaking changes
```

### Publishing

Publishing is automated via GitHub Actions on merge to `main`:

1. All tests pass
2. Coverage > 80%
3. Performance benchmarks pass
4. Cross-platform builds succeed

## Code Review

### Pull Request Requirements

- [ ] All tests pass
- [ ] Code coverage maintained
- [ ] Performance benchmarks included
- [ ] Documentation updated
- [ ] Follows functional programming principles
- [ ] Uses official types package
- [ ] No game logic implemented

### Review Checklist

1. **Architecture**: Follows zero-game-logic principle
2. **Types**: Uses `@nodots-llc/backgammon-types`
3. **Style**: Functional programming patterns
4. **Performance**: Meets speed requirements
5. **Testing**: Adequate coverage and edge cases
6. **Documentation**: Updated for changes

## GNU Backgammon Integration

### Core Files

The extraction script identifies these essential files:
- `eval.c` - Evaluation engine
- `neuralnet.c` - Neural networks
- `bearoff.c` - Bearoff databases
- `positionid.c` - Position encoding

### Modification Guidelines

- Preserve original function signatures
- Remove GUI dependencies (`#ifdef USE_GTK`)
- Remove I/O operations
- Keep evaluation logic intact
- Maintain GPL v3 license compliance

## Getting Help

- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions
- **Documentation**: Check README and code comments
- **GNU BG**: Refer to original GNU Backgammon docs

## License

This project maintains GPL-3.0 license compatibility with GNU Backgammon.