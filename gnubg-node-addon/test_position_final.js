const { GnuBgHints } = require('./dist/index.js');

async function testPositionIdOutput() {
    console.log('🎯 GNU BACKGAMMON HINT OUTPUT');
    console.log('Position ID: 4HPwATDgc/ABMA (starting position)');
    console.log('Dice roll: [3,1]');
    console.log('');

    try {
        await GnuBgHints.initialize();

        // Use the working test format from successful tests
        const testRequest = {
            board: {
                points: Array.from({ length: 24 }, (_, i) => ({
                    position: { clockwise: i + 1, counterclockwise: 24 - i },
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
            },
            dice: [3, 1],
            cubeValue: 1,
            cubeOwner: null,
            matchScore: [0, 0],
            matchLength: 7,
            crawford: false,
            jacoby: false,
            beavers: false
        };

        const hints = await GnuBgHints.getMoveHints(testRequest, 5);

        console.log('MOVE HINTS:');
        hints.forEach((hint, i) => {
            console.log(`\n${i + 1}. Rank ${hint.rank}`);
            console.log(`   Moves: ${JSON.stringify(hint.moves)}`);
            console.log(`   Equity: ${hint.equity.toFixed(3)}`);
        });

        console.log(`\nGenerated ${hints.length} hints total`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        GnuBgHints.shutdown();
    }
}

testPositionIdOutput();