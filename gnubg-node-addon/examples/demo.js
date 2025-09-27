#!/usr/bin/env node

/**
 * GNU Backgammon Hints - Demo Script
 *
 * This script demonstrates how to use the @nodots/gnubg-hints package
 * to get move hints for backgammon positions.
 */

const { GnuBgHints } = require('../dist/index.js');

// Helper function to display move notation
function formatMove(move) {
    // Handle the new move format from GNU Backgammon
    if (Array.isArray(move) && move.length === 2) {
        const from = move[0] === 0 ? 'bar' :
                     move[0] === 25 ? 'off' :
                     move[0].toString();
        const to = move[1] === 0 ? 'bar' :
               move[1] === 25 ? 'off' :
               move[1].toString();
        return `${from}/${to}`;
    }

    // Fallback for old format
    if (move.gnubgFrom !== undefined) {
        const from = move.gnubgFrom === 0 ? 'bar' :
                     move.gnubgFrom === 25 ? 'off' :
                     move.gnubgFrom.toString();
        const to = move.gnubgTo === 0 ? 'bar' :
                   move.gnubgTo === 25 ? 'off' :
                   move.gnubgTo.toString();
        return `${from}/${to}`;
    }

    return 'Unknown move';
}

// Main demo function
async function runDemo() {
    console.log('🎲 GNU Backgammon Hints Demo\n');
    console.log('================================\n');

    try {
        // Step 1: Initialize the hint engine
        console.log('1. Initializing hint engine...');
        await GnuBgHints.initialize();
        console.log('   ✅ Initialized successfully\n');

        // Step 2: Configure the engine
        console.log('2. Configuring hint engine...');
        GnuBgHints.configure({
            evalPlies: 2,      // 2-ply evaluation
            moveFilter: 2,     // Normal move filter
            threadCount: 1,    // Single thread
            usePruning: true,  // Use pruning neural networks
            noise: 0.0        // No noise (deterministic)
        });
        console.log('   ✅ Configured successfully\n');

        // Step 3: Get hints using position ID
        console.log('3. Getting hints from position ID...\n');

        // Example position IDs and dice rolls
        const testCases = [
            {
                position: '4HPwATDgc/ABMA',
                dice: [3, 1],
                description: 'Starting position with 3-1 roll (making the 5-point)'
            },
            {
                position: '4HPwATDgc/ABMA',
                dice: [5, 5],
                description: 'Starting position with double 5s'
            },
            {
                position: '4NvgATDgc/ABMA',
                dice: [2, 1],
                description: 'Modified position with 2-1 roll'
            }
        ];

        for (const testCase of testCases) {
            console.log(`   📍 Position: ${testCase.position}`);
            console.log(`   🎲 Dice: [${testCase.dice[0]}, ${testCase.dice[1]}]`);
            console.log(`   📝 ${testCase.description}\n`);

            try {
                const hints = await GnuBgHints.getHintsFromPositionId(
                    testCase.position,
                    testCase.dice,
                    5  // Get top 5 hints
                );

                if (hints && hints.length > 0) {
                    console.log(`   Found ${hints.length} move hint(s):\n`);

                    hints.forEach((hint, index) => {
                        console.log(`   Move ${index + 1}:`);

                        // Display moves
                        if (hint.moves && hint.moves.length > 0) {
                            const moveStr = hint.moves
                                .map(m => formatMove(m))
                                .join(', ');
                            console.log(`     Moves: ${moveStr}`);
                        }

                        // Display evaluation
                        if (hint.evaluation) {
                            console.log(`     Equity: ${hint.evaluation.equity?.toFixed(3) || 'N/A'}`);
                        } else if (hint.equity !== undefined) {
                            console.log(`     Equity: ${hint.equity.toFixed(3)}`);
                        }

                        console.log();
                    });
                } else {
                    console.log('   ⚠️ No hints generated (placeholder implementation)\n');
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}\n`);
            }
        }

        // Step 4: Demonstrate move hints with a board position
        console.log('4. Getting hints from board position...\n');

        // Create a sample board (simplified)
        const sampleRequest = {
            board: {
                points: [],
                bar: {
                    clockwise: { checkers: [] },
                    counterclockwise: { checkers: [] }
                },
                off: {
                    clockwise: { checkers: [] },
                    counterclockwise: { checkers: [] }
                }
            },
            dice: [6, 4],
            cubeValue: 1,
            cubeOwner: null,
            matchScore: [0, 0],
            matchLength: 7,
            crawford: false,
            jacoby: false,
            beavers: false
        };

        // Initialize points for a starting position
        for (let i = 1; i <= 24; i++) {
            sampleRequest.board.points.push({
                position: { clockwise: i, counterclockwise: 25 - i },
                checkers: []
            });
        }

        try {
            console.log('   🎲 Dice: [6, 4]');
            console.log('   📊 Getting move hints for board position...\n');

            const boardHints = await GnuBgHints.getMoveHints(sampleRequest, 3);

            if (boardHints && boardHints.length > 0) {
                console.log(`   Found ${boardHints.length} move hint(s)\n`);

                boardHints.forEach((hint, index) => {
                    console.log(`   Move ${index + 1}:`);
                    console.log(`     Rank: ${hint.rank}`);
                    console.log(`     Equity: ${hint.equity?.toFixed(3) || 'N/A'}`);
                    console.log(`     Difference: ${hint.difference?.toFixed(3) || 'N/A'}`);
                    console.log();
                });
            } else {
                console.log('   ⚠️ No board hints generated (placeholder implementation)\n');
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }

        // Step 5: Demonstrate double/take decisions
        console.log('5. Getting doubling decisions...\n');

        try {
            const doubleHint = await GnuBgHints.getDoubleHint(sampleRequest);
            console.log('   Double decision:');
            console.log(`     Action: ${doubleHint.action}`);
            console.log(`     Cubeful Equity: ${doubleHint.cubefulEquity?.toFixed(3) || 'N/A'}\n`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}\n`);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        console.error(error.stack);
    } finally {
        // Cleanup
        console.log('6. Shutting down...');
        GnuBgHints.shutdown();
        console.log('   ✅ Shutdown complete\n');
        console.log('================================\n');
        console.log('Demo completed successfully! 🎉');
    }
}

// Run the demo
console.log('Starting GNU Backgammon Hints Demo...\n');
runDemo().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});