const { GnuBgHints } = require('./dist/index.js');

async function testSimplePositionAPI() {
    console.log('🎯 Testing Simple Position ID API');

    try {
        await GnuBgHints.initialize();
        console.log('✅ Initialized successfully');

        // Test the original position with [3,1]
        console.log('\n📍 Testing 4HPwATDgc/ABMA with [3,1]:');
        const hints1 = await GnuBgHints.getHintsFromPositionId('4HPwATDgc/ABMA', [3, 1]);
        console.log('Results:', JSON.stringify(hints1, null, 2));

        // Test the new position with [2,1]
        console.log('\n📍 Testing 4NvgATDgc/ABMA with [2,1]:');
        const hints2 = await GnuBgHints.getHintsFromPositionId('4NvgATDgc/ABMA', [2, 1]);
        console.log('Results:', JSON.stringify(hints2, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        GnuBgHints.shutdown();
    }
}

testSimplePositionAPI();