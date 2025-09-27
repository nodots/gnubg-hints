const { GnuBgHints } = require('./dist/index.js');

async function testHints() {
  try {
    console.log('Initializing GNU Backgammon hints engine...');
    await GnuBgHints.initialize();

    console.log('Getting hints for position 4HPwATDgc/ABMA with dice [3,1]...');
    const hints = await GnuBgHints.getHintsFromPositionId('4HPwATDgc/ABMA', [3, 1], 5);

    console.log('\nHint Results:');
    console.log('=============');
    console.log(JSON.stringify(hints, null, 2));

    GnuBgHints.shutdown();
    console.log('\nEngine shut down successfully.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testHints();