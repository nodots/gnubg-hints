#!/bin/bash

# Extract GNU Backgammon core files for Node.js addon
# This script identifies and copies the minimal required files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDON_DIR="$(dirname "$SCRIPT_DIR")"
GNUBG_SRC="$(dirname "$ADDON_DIR")"
LIB_DIR="$ADDON_DIR/lib"
INCLUDE_DIR="$ADDON_DIR/include"

echo "🔍 Extracting GNU Backgammon core files..."
echo "Source: $GNUBG_SRC"
echo "Target: $LIB_DIR"

# Create directories
mkdir -p "$LIB_DIR"
mkdir -p "$INCLUDE_DIR"

# Function to extract specific functions from a file
extract_functions() {
    local src_file="$1"
    local output_file="$2"
    shift 2
    local functions=("$@")

    echo "Extracting functions from $(basename "$src_file")..."

    # Start with includes and basic definitions
    grep -E "^#include|^#define|^typedef|^extern|^static.*const" "$src_file" > "$output_file" || true

    # Extract each function
    for func in "${functions[@]}"; do
        echo "  - $func"
        # Extract function definition (from declaration to closing brace)
        awk "
        /^[a-zA-Z_][a-zA-Z0-9_]*[ \t]+$func[ \t]*\(/ {
            in_func=1; brace_count=0; print
        }
        in_func && /{/ { brace_count++ }
        in_func && /}/ {
            brace_count--
            print
            if (brace_count == 0) { in_func=0 }
            next
        }
        in_func { print }
        " "$src_file" >> "$output_file" || true
    done
}

# Core evaluation functions to extract
EVAL_FUNCTIONS=(
    "EvaluatePosition"
    "FindnSaveBestMoves"
    "FindBestMove"
    "GenerateMoves"
    "ApplyMove"
    "ApplySubMove"
    "ClassifyPosition"
    "InitEval"
    "EvalInitialise"
    "EvalShutdown"
)

# Position and utility functions
UTIL_FUNCTIONS=(
    "PositionFromKey"
    "PositionKey"
    "SwapSides"
    "PipCount"
)

# Cube and match equity functions
CUBE_FUNCTIONS=(
    "SetCubeInfo"
    "SetCubeInfoMoney"
    "GetDPEq"
    "GetPoints"
)

echo "📋 Files to extract:"
echo "  - eval.c (evaluation engine)"
echo "  - positionid.c (position encoding)"
echo "  - bearoff.c (bearoff database)"
echo "  - matchequity.c (match equity)"
echo "  - neuralnet.c (neural networks)"

# Extract core evaluation engine
if [ -f "$GNUBG_SRC/eval.c" ]; then
    echo "✂️  Extracting evaluation engine..."
    extract_functions "$GNUBG_SRC/eval.c" "$LIB_DIR/eval_core.c" "${EVAL_FUNCTIONS[@]}"
else
    echo "❌ eval.c not found"
fi

# Extract position utilities
if [ -f "$GNUBG_SRC/positionid.c" ]; then
    echo "✂️  Extracting position utilities..."
    extract_functions "$GNUBG_SRC/positionid.c" "$LIB_DIR/position_utils.c" "${UTIL_FUNCTIONS[@]}"
fi

# Copy essential headers with minimal modifications
echo "📄 Copying essential headers..."

# Copy and filter main headers
for header in eval.h backgammon.h positionid.h bearoff.h matchequity.h; do
    if [ -f "$GNUBG_SRC/$header" ]; then
        echo "  - $header"
        # Remove GUI-specific includes and definitions
        grep -v -E "gtk|USE_GTK|USE_BOARD3D|glib\.h" "$GNUBG_SRC/$header" > "$INCLUDE_DIR/$header"
    fi
done

# Create minimal config header
cat > "$INCLUDE_DIR/config.h" << 'EOF'
/* Minimal config.h for GNU Backgammon addon */
#ifndef CONFIG_H
#define CONFIG_H

#define HAVE_CONFIG_H 1
#define GNUBG_ADDON 1

/* Math functions */
#define HAVE_LIBM 1

/* SIMD support */
#ifdef __SSE2__
#define USE_SIMD 1
#define USE_SSE2 1
#endif

/* Threading */
#ifdef _WIN32
#define WIN32_LEAN_AND_MEAN
#else
#define HAVE_PTHREAD 1
#endif

/* Disable unused features */
#undef USE_GTK
#undef USE_BOARD3D
#undef USE_PYTHON
#undef HAVE_SOCKETS
#undef LIBCURL_PROTOCOL_HTTPS

#endif /* CONFIG_H */
EOF

# Create consolidated core file
echo "🔗 Creating consolidated core file..."
cat > "$LIB_DIR/gnubg_core.c" << 'EOF'
/*
 * GNU Backgammon Core Engine for Node.js
 * Extracted from GNU Backgammon
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#ifdef GNUBG_ADDON
/* Minimal includes for addon */
#include "config.h"

/* Forward declarations for types */
typedef float TanBoard[2][25];
typedef struct _evalcontext evalcontext;
typedef struct _cubeinfo cubeinfo;
typedef struct _movelist movelist;

/* Stub functions for missing dependencies */
void outputl(const char* msg) { /* no-op */ }
void output(const char* msg) { /* no-op */ }

/* Global variables needed by evaluation */
static int fInitialized = 0;

/* Public API */
int gnubg_init(const char* weights_path) {
    if (fInitialized) return 0;

    /* TODO: Initialize neural networks and bearoff databases */
    fInitialized = 1;
    return 0;
}

void gnubg_shutdown() {
    if (fInitialized) {
        /* TODO: Cleanup resources */
        fInitialized = 0;
    }
}

int gnubg_hint_move(int board[2][25], int dice[2], void* hints_out, int max_hints) {
    if (!fInitialized) return -1;

    /* TODO: Call actual hint_move function */
    return 0;
}

int gnubg_hint_double(int board[2][25], void* cube_info, void* hint_out) {
    if (!fInitialized) return -1;

    /* TODO: Call actual hint_double function */
    return 0;
}

int gnubg_hint_take(int board[2][25], void* cube_info, void* hint_out) {
    if (!fInitialized) return -1;

    /* TODO: Call actual hint_take function */
    return 0;
}

#endif /* GNUBG_ADDON */
EOF

# Copy neural network weights if available
echo "🧠 Looking for neural network weights..."
for weights_file in gnubg.wd gnubg_os0.bd gnubg_ts0.bd; do
    if [ -f "$GNUBG_SRC/$weights_file" ]; then
        echo "  - Found $weights_file"
        cp "$GNUBG_SRC/$weights_file" "$LIB_DIR/"
    fi
done

# Create gnubg_core.h header
cat > "$INCLUDE_DIR/gnubg_core.h" << 'EOF'
#ifndef GNUBG_CORE_H
#define GNUBG_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

/* Public API for GNU Backgammon core engine */

/* Initialize the engine with weights file path */
int gnubg_init(const char* weights_path);

/* Shutdown and free resources */
void gnubg_shutdown(void);

/* Get move hints for position with dice roll */
int gnubg_hint_move(
    int board[2][25],    /* Board position */
    int dice[2],         /* Dice values */
    void* hints_out,     /* Output hints array */
    int max_hints        /* Maximum number of hints */
);

/* Get doubling decision */
int gnubg_hint_double(
    int board[2][25],    /* Board position */
    void* cube_info,     /* Cube information */
    void* hint_out       /* Output hint */
);

/* Get take/drop decision */
int gnubg_hint_take(
    int board[2][25],    /* Board position */
    void* cube_info,     /* Cube information */
    void* hint_out       /* Output hint */
);

#ifdef __cplusplus
}
#endif

#endif /* GNUBG_CORE_H */
EOF

echo "✅ Extraction complete!"
echo ""
echo "📁 Generated files:"
echo "  - lib/gnubg_core.c (consolidated core)"
echo "  - include/gnubg_core.h (public API)"
echo "  - include/config.h (minimal config)"
echo ""
echo "🚧 Next steps:"
echo "  1. Review extracted files"
echo "  2. Implement actual function calls in gnubg_core.c"
echo "  3. Test compilation with: npm run build:native"
echo ""
echo "⚠️  Note: This is a skeleton extraction. You'll need to:"
echo "  - Copy actual function implementations"
echo "  - Add neural network loading code"
echo "  - Handle dependencies properly"