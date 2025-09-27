# GNU Backgammon Core Extraction Guide

This guide documents which files need to be extracted from GNU Backgammon to create a minimal hint engine library.

## Core Files Required

### 1. Evaluation Engine
These files contain the neural network evaluation logic:

- `eval.c` / `eval.h` - Core evaluation functions
  - `EvaluatePosition()`
  - `FindnSaveBestMoves()`
  - `FindBestMove()`
  - Position classification

- `neuralnet.c` / `neuralnet.h` - Neural network implementation
  - Network structure
  - Forward propagation
  - SIMD optimizations

- `simd.h` - SIMD support for faster evaluation

### 2. Move Generation
Files for generating legal moves:

- Parts of `eval.c` containing:
  - `GenerateMoves()`
  - `ApplyMove()`
  - `ApplySubMove()`

- `positionid.c` / `positionid.h` - Position encoding/decoding
  - Position keys for caching
  - Board state hashing

### 3. Bearoff Databases
For endgame positions:

- `bearoff.c` / `bearoff.h` - Bearoff database access
- Bearoff database files (`.bd` files)

### 4. Match Equity
For match play decisions:

- `matchequity.c` / `matchequity.h` - Match equity tables
- MET (Match Equity Table) files

### 5. Data Structures
Core data structure definitions:

- Relevant parts of `backgammon.h`:
  - `TanBoard` typedef
  - `cubeinfo` struct
  - `movelist` struct
  - `evalcontext` struct

- `dice.h` - Dice rolling (if needed)

### 6. Utility Functions
Supporting utilities:

- Parts of `util.c` / `util.h`:
  - Position manipulation
  - Board conversion functions

## Files to Create

### `lib/gnubg_core.c`
A consolidated file that:
1. Includes only the necessary functions from above files
2. Removes GUI dependencies
3. Removes command-line interface code
4. Removes file I/O operations
5. Keeps only pure evaluation logic

### `lib/gnubg_core.h`
Header with minimal public interface:
```c
// Initialize engine with weights
int gnubg_init(const char* weights_path);

// Shutdown and free resources
void gnubg_shutdown();

// Get move hints
int gnubg_hint_move(
    int board[2][25],
    int dice[2],
    void* hints_out,
    int max_hints
);

// Get double decision
int gnubg_hint_double(
    int board[2][25],
    void* cube_info,
    void* hint_out
);

// Get take decision
int gnubg_hint_take(
    int board[2][25],
    void* cube_info,
    void* hint_out
);
```

## Extraction Process

1. **Identify Dependencies**
   ```bash
   # Find all includes in eval.c
   grep "^#include" ../eval.c

   # Find function dependencies
   grep -E "^(void|int|float|double)" ../eval.c
   ```

2. **Extract Core Functions**
   - Copy only the functions listed above
   - Remove GUI-specific code (`#ifdef USE_GTK`)
   - Remove Python bindings (`#ifdef USE_PYTHON`)
   - Remove external player support

3. **Minimize Global State**
   - Identify global variables used by hint functions
   - Encapsulate in a context structure
   - Make functions thread-safe where possible

4. **Create Stub Functions**
   For any missing dependencies, create minimal stubs:
   ```c
   // Stub for output functions we don't need
   void outputl(const char* msg) { /* no-op */ }
   ```

## Build Configuration

The extracted files should compile with:
```bash
gcc -c -O3 -fPIC \
    -DHAVE_CONFIG_H \
    -I../include \
    lib/gnubg_core.c
```

## Testing Extraction

Create a simple test program:
```c
#include "gnubg_core.h"
#include <stdio.h>

int main() {
    if (gnubg_init("gnubg.wd") != 0) {
        printf("Init failed\n");
        return 1;
    }

    int board[2][25] = {/* test position */};
    int dice[2] = {3, 1};

    // Test hint generation
    void* hints;
    gnubg_hint_move(board, dice, hints, 5);

    gnubg_shutdown();
    return 0;
}
```

## Notes

- The neural network weights file (`gnubg.wd`) must be available
- Consider embedding weights as binary resource for easier distribution
- Maintain GNU GPL v3 license compliance
- Preserve copyright notices from original files