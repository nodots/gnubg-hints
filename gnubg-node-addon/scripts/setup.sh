#!/bin/bash

# Setup script for GNU Backgammon Node.js addon development
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADDON_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Setting up GNU Backgammon Node.js Addon"
echo "Working directory: $ADDON_DIR"

# Check prerequisites
echo ""
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+ first."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 16+."
    exit 1
fi

echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

echo "✅ npm $(npm --version)"

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python 3.x for node-gyp."
    exit 1
fi

PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "✅ Python $($PYTHON_CMD --version 2>&1 | cut -d' ' -f2)"

# Check build tools
echo ""
echo "🔧 Checking build tools..."

case "$(uname -s)" in
    Darwin*)
        if ! xcode-select -p &> /dev/null; then
            echo "⚠️  Xcode command line tools not found"
            echo "   Run: xcode-select --install"
            read -p "   Install now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                xcode-select --install
            else
                echo "❌ Build tools required for compilation"
                exit 1
            fi
        fi
        echo "✅ Xcode command line tools"
        ;;
    Linux*)
        if ! command -v gcc &> /dev/null; then
            echo "⚠️  GCC not found"
            echo "   Install with: sudo apt-get install build-essential"
            exit 1
        fi
        echo "✅ GCC $(gcc --version | head -n1)"
        ;;
    MINGW*|CYGWIN*)
        echo "⚠️  Windows detected. Make sure Visual Studio Build Tools are installed."
        ;;
esac

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
cd "$ADDON_DIR"

if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

echo "✅ Dependencies installed"

# Extract GNU BG core
echo ""
echo "⚙️  Extracting GNU Backgammon core files..."

if [ -x "./scripts/extract-gnubg-core.sh" ]; then
    ./scripts/extract-gnubg-core.sh
else
    echo "❌ Extraction script not found or not executable"
    exit 1
fi

# Generate database files
echo ""
echo "📊 Generating GNU Backgammon database files..."

if [ -x "./scripts/generate-databases.sh" ]; then
    ./scripts/generate-databases.sh
else
    echo "⚠️  Database generation script not found, skipping"
fi

# Build the addon
echo ""
echo "🔨 Building native addon..."

npm run build:native

if [ $? -ne 0 ]; then
    echo "❌ Native build failed"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   - Check that all build tools are installed"
    echo "   - Verify GNU Backgammon source files are available"
    echo "   - Check the build logs above for specific errors"
    exit 1
fi

echo "✅ Native addon built successfully"

# Build TypeScript
echo ""
echo "📝 Building TypeScript..."

npm run build:ts

if [ $? -ne 0 ]; then
    echo "❌ TypeScript build failed"
    exit 1
fi

echo "✅ TypeScript built successfully"

# Run a quick test
echo ""
echo "🧪 Running quick test..."

if [ -f "dist/index.js" ]; then
    node -e "
    const { GnuBgHints } = require('./dist');
    console.log('✅ Module loads successfully');
    console.log('Available methods:', Object.getOwnPropertyNames(GnuBgHints));
    "
else
    echo "❌ Built module not found"
    exit 1
fi

# Success message
echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run tests: npm test"
echo "   2. Run benchmarks: node benchmark/performance.js"
echo "   3. Start developing!"
echo ""
echo "📖 Documentation:"
echo "   - README.md - Usage guide"
echo "   - CONTRIBUTING.md - Development guide"
echo "   - EXTRACTION_GUIDE.md - GNU BG integration"
echo ""
echo "🐛 If you encounter issues:"
echo "   - Check the troubleshooting section in README.md"
echo "   - Review build logs for specific errors"
echo "   - Create an issue on GitHub"