const { GnuBgHints } = require('./dist/index.js');

// Copy the exact test setup
function createSimpleBoard() {
  return {
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
}

async function showActualOutput() {
  try {
    await GnuBgHints.initialize();

    const basicRequest = {
      board: createSimpleBoard(),
      dice: [3, 1],
      cubeValue: 1,
      cubeOwner: null,
      matchScore: [0, 0],
      matchLength: 7,
      crawford: false,
      jacoby: false,
      beavers: false
    };

    console.log('🎯 GNU BACKGAMMON HINT OUTPUT FOR:');
    console.log('Position ID: 4HPwATDgc/ABMA (starting position)');
    console.log('Dice roll: [3,1]');
    console.log('');

    const hints = await GnuBgHints.getMoveHints(basicRequest, 5);
    console.log('HINT RESULTS:');
    hints.forEach((hint, i) => {
      console.log(`\nRank ${hint.rank}: ${JSON.stringify(hint.moves)}`);
      console.log(`  Equity: ${hint.equity}`);
      console.log(`  Difference: ${hint.difference || 0}`);
    });
    console.log(`\nTotal hints generated: ${hints.length}`);

  } catch (error) {
    console.log('ERROR:', error.message);
  } finally {
    GnuBgHints.shutdown();
  }
}

showActualOutput();