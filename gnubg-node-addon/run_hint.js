const { GnuBgHints } = require('./dist/index.js');

async function runHint() {
  try {
    await GnuBgHints.initialize();
    const result = await GnuBgHints.getHintsFromPositionId('4HPwATDgc/ABMA', [3, 1]);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    GnuBgHints.shutdown();
  }
}

runHint();