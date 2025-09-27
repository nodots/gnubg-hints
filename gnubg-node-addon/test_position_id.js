const { GnuBgHints } = require('./dist/index.js');

async function testPositionId() {
    console.log('🎯 Testing GNU Backgammon hint generation for Position ID: 4HPwATDgc/ABMA');
    console.log('🎲 Dice roll: [3,1]');

    try {
        // Initialize the GNU Backgammon engine
        console.log('\nInitializing GNU Backgammon engine...');
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

        // Call the GNU Backgammon engine directly with position ID and dice
        console.log('\n🔍 Calling GNU Backgammon hint engine...');

        // We need to bypass the TypeScript layer and call the C++ addon directly
        // since the TypeScript layer is doing unnecessary board conversion
        const addon = require('./build/Release/gnubg_hints.node');

        // Call the native addon with position ID and dice
        const result = addon.getHintsFromPositionId('4HPwATDgc/ABMA', [3, 1], 5);

        console.log('📊 GNU Backgammon hint results:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);

        // If direct position ID call doesn't work, let's see what the C wrapper actually outputs
        console.log('\n🔧 Testing basic C wrapper output...');
        const addon = require('./build/Release/gnubg_hints.node');

        // Test the basic functions we know work
        try {
            addon.initialize('', () => {
                console.log('✅ C++ initialization callback received');

                // Test the core functions
                const moveResult = addon.getMoveHints({
                    board: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                           [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
                    dice: [3, 1]
                }, 5, (err, hints) => {
                    if (err) {
                        console.log('❌ Move hints error:', err.message);
                    } else {
                        console.log('📊 Raw C++ move hints output:');
                        console.log(JSON.stringify(hints, null, 2));
                    }
                });
            });
        } catch (cppError) {
            console.error('❌ C++ wrapper error:', cppError.message);
        }
    } finally {
        console.log('\n🛑 Shutting down...');
        try {
            GnuBgHints.shutdown();
        } catch (e) {
            console.log('Shutdown already completed');
        }
    }
}

// Run the test
testPositionId().catch(console.error);