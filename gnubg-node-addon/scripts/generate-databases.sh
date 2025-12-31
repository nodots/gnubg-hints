#!/bin/bash

# Generate or copy GNU Backgammon database files
# Required files:
#   - gnubg.wd: Binary neural network weights
#   - gnubg_ts0.bd: Two-sided bearoff database (6x6)
#   - gnubg_os0.bd: One-sided bearoff database (optional but recommended)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDON_DIR="$(dirname "$SCRIPT_DIR")"
# Database files must be in same directory as gnubg.weights (parent of gnubg-node-addon)
TARGET_DIR="$(dirname "$ADDON_DIR")"

# System gnubg data directory (Homebrew default on macOS)
SYSTEM_GNUBG_DIR="/usr/local/share/gnubg"

echo "Generating/copying GNU Backgammon database files..."
echo "Target directory: $TARGET_DIR"

# Function to copy from system if available, otherwise generate
copy_or_generate_wd() {
    local target="$TARGET_DIR/gnubg.wd"

    if [ -f "$target" ]; then
        echo "gnubg.wd already exists, skipping"
        return 0
    fi

    # Try copying from system installation
    if [ -f "$SYSTEM_GNUBG_DIR/gnubg.wd" ]; then
        echo "Copying gnubg.wd from system installation..."
        cp "$SYSTEM_GNUBG_DIR/gnubg.wd" "$target"
        echo "Copied gnubg.wd"
        return 0
    fi

    # Try generating with makeweights
    if command -v makeweights &> /dev/null; then
        local weights_file="$TARGET_DIR/gnubg.weights"
        if [ ! -f "$weights_file" ]; then
            weights_file="$ADDON_DIR/../gnubg.weights"
        fi

        if [ -f "$weights_file" ]; then
            echo "Generating gnubg.wd from gnubg.weights..."
            makeweights "$target" "$weights_file"
            echo "Generated gnubg.wd"
            return 0
        else
            echo "Warning: gnubg.weights not found, cannot generate gnubg.wd"
            return 1
        fi
    fi

    echo "Warning: Cannot find or generate gnubg.wd"
    echo "  - System file not found at $SYSTEM_GNUBG_DIR/gnubg.wd"
    echo "  - makeweights command not available"
    return 1
}

copy_or_generate_ts0() {
    local target="$TARGET_DIR/gnubg_ts0.bd"

    if [ -f "$target" ]; then
        echo "gnubg_ts0.bd already exists, skipping"
        return 0
    fi

    # Try copying from system installation
    if [ -f "$SYSTEM_GNUBG_DIR/gnubg_ts0.bd" ]; then
        echo "Copying gnubg_ts0.bd from system installation..."
        cp "$SYSTEM_GNUBG_DIR/gnubg_ts0.bd" "$target"
        echo "Copied gnubg_ts0.bd"
        return 0
    fi

    # Try generating with makebearoff
    if command -v makebearoff &> /dev/null; then
        echo "Generating gnubg_ts0.bd (two-sided 6x6 bearoff database)..."
        echo "This may take a few minutes..."
        makebearoff -t 6x6 -f "$target"
        echo "Generated gnubg_ts0.bd"
        return 0
    fi

    echo "Warning: Cannot find or generate gnubg_ts0.bd"
    echo "  - System file not found at $SYSTEM_GNUBG_DIR/gnubg_ts0.bd"
    echo "  - makebearoff command not available"
    return 1
}

copy_or_generate_os0() {
    local target="$TARGET_DIR/gnubg_os0.bd"

    if [ -f "$target" ]; then
        echo "gnubg_os0.bd already exists, skipping"
        return 0
    fi

    # Try copying from system installation
    if [ -f "$SYSTEM_GNUBG_DIR/gnubg_os0.bd" ]; then
        echo "Copying gnubg_os0.bd from system installation..."
        cp "$SYSTEM_GNUBG_DIR/gnubg_os0.bd" "$target"
        echo "Copied gnubg_os0.bd"
        return 0
    fi

    # Try generating with makebearoff
    if command -v makebearoff &> /dev/null; then
        echo "Generating gnubg_os0.bd (one-sided bearoff database)..."
        makebearoff -o 6 -f "$target"
        echo "Generated gnubg_os0.bd"
        return 0
    fi

    echo "Warning: Cannot find or generate gnubg_os0.bd (optional)"
    return 0  # Not a failure, this is optional
}

# Main execution
SUCCESS=0
WARNINGS=0

if copy_or_generate_wd; then
    ((SUCCESS++))
else
    ((WARNINGS++))
fi

if copy_or_generate_ts0; then
    ((SUCCESS++))
else
    ((WARNINGS++))
fi

if copy_or_generate_os0; then
    ((SUCCESS++))
fi

echo ""
echo "Database generation complete."
echo "  Files generated/copied: $SUCCESS"
if [ $WARNINGS -gt 0 ]; then
    echo "  Warnings: $WARNINGS"
    echo ""
    echo "Some database files could not be generated."
    echo "Install GNU Backgammon to get the required tools:"
    echo "  macOS: brew install gnubg"
    echo "  Linux: apt-get install gnubg"
fi

# List generated files
echo ""
echo "Database files in $TARGET_DIR:"
ls -la "$TARGET_DIR"/*.wd "$TARGET_DIR"/*.bd 2>/dev/null || echo "  (no database files found)"
