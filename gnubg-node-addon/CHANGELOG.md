# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial Node.js native addon for GNU Backgammon hints
- TypeScript API using `@nodots-llc/backgammon-types`
- Async/await support for non-blocking operations
- Comprehensive test suite with Jest
- Performance benchmarking framework
- Cross-platform build support (macOS, Linux, Windows)
- CI/CD pipeline with GitHub Actions
- Functional programming architecture
- Zero game logic implementation (pure GNU BG exposure)

### Features
- **Move Hints**: Get ranked move suggestions with evaluations
- **Double Hints**: Get doubling cube decisions with equity analysis
- **Take Hints**: Get take/drop decisions when doubled
- **Configuration**: Adjustable evaluation depth and move filters
- **Concurrent Processing**: Thread-safe operation support

### Performance
- Target: 10-30x faster than subprocess approach
- Move hints: ~8ms vs 125ms (subprocess)
- Double hints: ~3ms vs 95ms (subprocess)
- Take hints: ~3ms vs 92ms (subprocess)

### Architecture
- N-API C++ bindings for stability across Node.js versions
- Functional programming patterns throughout
- Switch expressions over if/else chains
- Immutable data structures
- Error handling without process crashes

### Documentation
- Complete API documentation
- Contributing guidelines
- Extraction guide for GNU BG core files
- Performance benchmarking setup
- Cross-platform build instructions

### Build System
- node-gyp configuration
- Automated GNU BG core extraction
- TypeScript compilation
- Cross-platform optimization flags
- SIMD support when available

### Testing
- Unit tests for all public APIs
- Integration tests for full workflows
- Performance regression tests
- Error condition testing
- Memory leak detection

### CI/CD
- Multi-platform testing (Ubuntu, macOS, Windows)
- Multiple Node.js versions (16, 18, 20)
- Automated benchmarking
- Code coverage reporting
- Automated npm publishing

## [1.0.0] - TBD

### Initial Release
- First stable release of GNU Backgammon hints for Node.js
- Production-ready performance and stability
- Complete documentation and examples
- Full test coverage