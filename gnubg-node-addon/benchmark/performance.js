const { GnuBgHints } = require('../dist');

// Sample board positions for benchmarking
const testPositions = [
  {
    name: 'Starting Position',
    dice: [6, 1],
    // Standard starting position
    board: createStartingBoard()
  },
  {
    name: 'Middle Game',
    dice: [4, 3],
    // Complex middle game position
    board: createMiddleGameBoard()
  },
  {
    name: 'Racing Position',
    dice: [5, 2],
    // End game racing position
    board: createRacingBoard()
  }
];

function createStartingBoard() {
  // Simplified board representation for benchmark
  return {
    points: Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 25 - i },
      checkers: []
    })),
    bar: { clockwise: { checkers: [] }, counterclockwise: { checkers: [] } },
    off: { clockwise: { checkers: [] }, counterclockwise: { checkers: [] } }
  };
}

function createMiddleGameBoard() {
  // TODO: Create realistic middle game position
  return createStartingBoard();
}

function createRacingBoard() {
  // TODO: Create realistic racing position
  return createStartingBoard();
}

async function benchmark() {
  console.log('🚀 GNU Backgammon Hints Performance Benchmark\n');

  try {
    // Initialize engine
    console.log('Initializing engine...');
    const initStart = process.hrtime.bigint();
    await GnuBgHints.initialize();
    const initTime = Number(process.hrtime.bigint() - initStart) / 1_000_000;
    console.log(`✅ Initialization: ${initTime.toFixed(2)}ms\n`);

    // Configure for maximum performance
    GnuBgHints.configure({
      evalPlies: 2,
      moveFilter: 2,
      threadCount: 1,
      usePruning: true,
      noise: 0.0
    });

    const results = {
      moveHints: [],
      doubleHints: [],
      takeHints: []
    };

    // Benchmark move hints
    console.log('📊 Benchmarking Move Hints');
    console.log(''.padEnd(50, '-'));

    for (const position of testPositions) {
      const request = {
        board: position.board,
        dice: position.dice,
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: true
      };

      // Warm up
      await GnuBgHints.getMoveHints(request, 5);

      // Benchmark multiple runs
      const runs = 10;
      const times = [];

      for (let i = 0; i < runs; i++) {
        const start = process.hrtime.bigint();
        await GnuBgHints.getMoveHints(request, 10);
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      results.moveHints.push({
        position: position.name,
        avgTime,
        minTime,
        maxTime
      });

      console.log(`${position.name}:`);
      console.log(`  Avg: ${avgTime.toFixed(2)}ms | Min: ${minTime.toFixed(2)}ms | Max: ${maxTime.toFixed(2)}ms`);
    }

    // Benchmark double hints
    console.log('\n🎲 Benchmarking Double Hints');
    console.log(''.padEnd(50, '-'));

    for (const position of testPositions) {
      const request = {
        board: position.board,
        dice: [0, 0], // No dice for cube decisions
        cubeValue: 1,
        cubeOwner: null,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: true
      };

      // Warm up
      await GnuBgHints.getDoubleHint(request);

      const runs = 10;
      const times = [];

      for (let i = 0; i < runs; i++) {
        const start = process.hrtime.bigint();
        await GnuBgHints.getDoubleHint(request);
        const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      results.doubleHints.push({
        position: position.name,
        avgTime,
        minTime,
        maxTime
      });

      console.log(`${position.name}:`);
      console.log(`  Avg: ${avgTime.toFixed(2)}ms | Min: ${minTime.toFixed(2)}ms | Max: ${maxTime.toFixed(2)}ms`);
    }

    // Concurrent processing benchmark
    console.log('\n🔄 Concurrent Processing Test');
    console.log(''.padEnd(50, '-'));

    const concurrentRequests = 20;
    const request = {
      board: testPositions[0].board,
      dice: [4, 2],
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: true
    };

    const concurrentStart = process.hrtime.bigint();
    const promises = Array.from({ length: concurrentRequests }, () =>
      GnuBgHints.getMoveHints(request, 5)
    );

    await Promise.all(promises);
    const concurrentTime = Number(process.hrtime.bigint() - concurrentStart) / 1_000_000;

    console.log(`${concurrentRequests} concurrent requests: ${concurrentTime.toFixed(2)}ms`);
    console.log(`Average per request: ${(concurrentTime / concurrentRequests).toFixed(2)}ms`);

    // Memory usage
    console.log('\n💾 Memory Usage');
    console.log(''.padEnd(50, '-'));
    const memUsage = process.memoryUsage();
    console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);

    // Summary
    console.log('\n📈 Performance Summary');
    console.log(''.padEnd(50, '='));

    const avgMoveTime = results.moveHints.reduce((sum, r) => sum + r.avgTime, 0) / results.moveHints.length;
    const avgDoubleTime = results.doubleHints.reduce((sum, r) => sum + r.avgTime, 0) / results.doubleHints.length;

    console.log(`Average Move Hint: ${avgMoveTime.toFixed(2)}ms`);
    console.log(`Average Double Hint: ${avgDoubleTime.toFixed(2)}ms`);

    // Compare with expected subprocess times
    const subprocessMoveTime = 125; // Expected subprocess time
    const subprocessDoubleTime = 95;

    const moveSpeedup = subprocessMoveTime / avgMoveTime;
    const doubleSpeedup = subprocessDoubleTime / avgDoubleTime;

    console.log(`\n🚀 Performance vs Subprocess:`);
    console.log(`Move Hints: ${moveSpeedup.toFixed(1)}x faster`);
    console.log(`Double Hints: ${doubleSpeedup.toFixed(1)}x faster`);

    // Output results as JSON for CI
    if (process.env.CI) {
      const benchmarkResults = {
        timestamp: new Date().toISOString(),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        results: {
          initialization_ms: initTime,
          avg_move_hint_ms: avgMoveTime,
          avg_double_hint_ms: avgDoubleTime,
          concurrent_requests: concurrentRequests,
          concurrent_total_ms: concurrentTime,
          memory_usage_mb: memUsage.rss / 1024 / 1024,
          speedup_vs_subprocess: {
            move_hints: moveSpeedup,
            double_hints: doubleSpeedup
          }
        }
      };

      console.log('\n📄 CI Results:');
      console.log(JSON.stringify(benchmarkResults, null, 2));
    }

  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    GnuBgHints.shutdown();
  }
}

// Run benchmark
if (require.main === module) {
  benchmark().catch(console.error);
}

module.exports = { benchmark };