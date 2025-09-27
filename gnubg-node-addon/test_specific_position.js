const { GnuBgHints } = require('./dist/index.js');

async function testSpecificPosition() {
    console.log('🎯 Testing GNU Backgammon hint generation for specific position...');

    try {
        // Initialize the GNU Backgammon engine
        console.log('Initializing GNU Backgammon engine...');
        await GnuBgHints.initialize();
        console.log('✅ Engine initialized successfully');

        // Configure for reasonable performance
        GnuBgHints.configure({
            evalPlies: 2,
            moveFilter: 1,
            threadCount: 1,
            usePruning: true,
            noise: 0.0
        });
        console.log('✅ Engine configured');

        // Convert gnuPositionId 4HPwATDgc/ABMA to board representation
        // This is a standard backgammon starting position
        // For now, I'll create a simple test position
        const testBoard = createTestBoard();

        const hintRequest = {
            board: testBoard,
            dice: [3, 1],
            cubeValue: 1,
            cubeOwner: null,
            matchScore: [0, 0],
            matchLength: 7,
            crawford: false,
            jacoby: false,
            beavers: false
        };

        console.log('\n🎲 Getting move hints for dice roll [3,1]...');
        const moveHints = await GnuBgHints.getMoveHints(hintRequest, 5);

        console.log(`\n📊 GNU Backgammon generated ${moveHints.length} move hints:`);
        moveHints.forEach((hint, index) => {
            console.log(`\nHint #${index + 1} (Rank ${hint.rank}):`);
            console.log(`  Moves: ${JSON.stringify(hint.moves)}`);
            console.log(`  Equity: ${hint.equity}`);
            console.log(`  Evaluation: ${JSON.stringify(hint.evaluation)}`);
        });

        console.log('\n🎲 Getting double hint...');
        const doubleHint = await GnuBgHints.getDoubleHint(hintRequest);
        console.log('Double recommendation:', doubleHint.action);
        console.log('Double equity:', doubleHint.evaluation.equity);

        console.log('\n🎲 Getting take hint (simulating cube at 2)...');
        const takeRequest = {
            ...hintRequest,
            cubeValue: 2,
            cubeOwner: null
        };
        const takeHint = await GnuBgHints.getTakeHint(takeRequest);
        console.log('Take recommendation:', takeHint.action);
        console.log('Take equity:', takeHint.takeEquity);
        console.log('Drop equity:', takeHint.dropEquity);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        console.log('\n🛑 Shutting down GNU Backgammon engine...');
        GnuBgHints.shutdown();
        console.log('✅ Engine shutdown complete');
    }
}

function createTestBoard() {
    // Create proper BackgammonBoard format matching @nodots-llc/backgammon-types
    const board = {
        points: Array.from({ length: 24 }, (_, i) => ({
            position: {
                clockwise: i + 1,
                counterclockwise: 24 - i
            },
            checkers: []
        })),
        bar: {
            clockwise: { checkers: [] },
            counterclockwise: { checkers: [] }
        },
        off: {
            clockwise: { checkers: [] },
            counterclockwise: { checkers: [] }
        }
    };

    // Set up a test position with checkers
    // Add white checkers (clockwise direction)
    board.points[23].checkers = Array(2).fill({ color: 'white' });  // 24-point: 2 white
    board.points[12].checkers = Array(5).fill({ color: 'white' });  // 13-point: 5 white
    board.points[7].checkers = Array(3).fill({ color: 'white' });   // 8-point: 3 white
    board.points[5].checkers = Array(5).fill({ color: 'white' });   // 6-point: 5 white

    // Add black checkers (counterclockwise direction)
    board.points[0].checkers = Array(2).fill({ color: 'black' });   // 1-point: 2 black
    board.points[11].checkers = Array(5).fill({ color: 'black' });  // 12-point: 5 black
    board.points[16].checkers = Array(3).fill({ color: 'black' });  // 17-point: 3 black
    board.points[18].checkers = Array(5).fill({ color: 'black' });  // 19-point: 5 black

    return board;
}

// Run the test
testSpecificPosition().catch(console.error);