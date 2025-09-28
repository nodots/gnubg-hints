import { GnuBgHints } from '@nodots-llc/gnubg-hints';
import type {
  BackgammonBoard,
  BackgammonGame,
  BackgammonMove,
  BackgammonColor,
  BackgammonPlayer
} from '@nodots-llc/backgammon-types';

/**
 * Example: Basic integration of GNU Backgammon hints
 * Shows how to get move suggestions, double decisions, and take/drop hints
 */
async function demonstrateHints() {
  console.log('🎲 GNU Backgammon Hints Demo\n');

  try {
    // 1. Initialize the hint engine (one-time setup)
    console.log('Initializing GNU Backgammon engine...');
    await GnuBgHints.initialize();
    console.log('✅ Engine initialized\n');

    // 2. Configure evaluation settings (optional)
    GnuBgHints.configure({
      evalPlies: 2,      // Evaluation depth (0-3, higher = slower but better)
      moveFilter: 2,     // Move filter level (0-4, higher = more moves)
      usePruning: true,  // Use pruning networks for speed
      noise: 0.0        // Deterministic evaluation (0.0) vs random (0.1)
    });

    // 3. Create a sample game position
    const gamePosition = createSamplePosition();

    // 4. Get move hints for a dice roll
    await demonstrateMoveHints(gamePosition);

    // 5. Get doubling cube decision
    await demonstrateDoubleHints(gamePosition);

    // 6. Get take/drop decision (when doubled)
    await demonstrateTakeHints(gamePosition);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    // 7. Always cleanup when done
    GnuBgHints.shutdown();
    console.log('\n🏁 Engine shutdown complete');
  }
}

/**
 * Demonstrate move hints for a dice roll
 */
async function demonstrateMoveHints(board: BackgammonBoard) {
  console.log('🎯 MOVE HINTS EXAMPLE');
  console.log(''.padEnd(40, '-'));

  const diceRoll: [number, number] = [6, 1];

  const hintRequest = {
    board,
    dice: diceRoll,
    cubeValue: 1,
    cubeOwner: null as BackgammonColor | null,
    matchScore: [0, 0] as [number, number],
    matchLength: 7,
    crawford: false,
    jacoby: false,
    beavers: true
  };

  console.log(`Rolling ${diceRoll[0]}-${diceRoll[1]}...`);

  const hints = await GnuBgHints.getMoveHints(hintRequest, 5);

  console.log(`\nFound ${hints.length} possible moves:\n`);

  hints.forEach((hint, index) => {
    console.log(`${index + 1}. Rank ${hint.rank} (Equity: ${hint.equity.toFixed(4)})`);
    console.log(`   Moves: ${formatMoves(hint.moves)}`);
    console.log(`   Win: ${(hint.evaluation.win * 100).toFixed(1)}%`);
    console.log(`   Difference: ${hint.difference.toFixed(4)}`);
    console.log('');
  });
}

/**
 * Demonstrate doubling cube decisions
 */
async function demonstrateDoubleHints(board: BackgammonBoard) {
  console.log('🔥 DOUBLE DECISION EXAMPLE');
  console.log(''.padEnd(40, '-'));

  const doubleRequest = {
    board,
    dice: [0, 0] as [number, number], // No dice for cube decisions
    cubeValue: 1,
    cubeOwner: null as BackgammonColor | null,
    matchScore: [2, 3] as [number, number],
    matchLength: 7,
    crawford: false,
    jacoby: false,
    beavers: true
  };

  const doubleHint = await GnuBgHints.getDoubleHint(doubleRequest);

  console.log(`Cube Decision: ${doubleHint.action.toUpperCase()}`);
  console.log(`Take Point: ${doubleHint.takePoint.toFixed(3)}`);
  console.log(`Drop Point: ${doubleHint.dropPoint.toFixed(3)}`);
  console.log(`Cubeful Equity: ${doubleHint.cubefulEquity.toFixed(4)}`);
  console.log(`Position Equity: ${doubleHint.evaluation.equity.toFixed(4)}\n`);
}

/**
 * Demonstrate take/drop decisions when doubled
 */
async function demonstrateTakeHints(board: BackgammonBoard) {
  console.log('📥 TAKE/DROP DECISION EXAMPLE');
  console.log(''.padEnd(40, '-'));

  const takeRequest = {
    board,
    dice: [0, 0] as [number, number],
    cubeValue: 2, // Opponent has doubled
    cubeOwner: 'black' as BackgammonColor,
    matchScore: [1, 4] as [number, number],
    matchLength: 7,
    crawford: false,
    jacoby: false,
    beavers: true
  };

  const takeHint = await GnuBgHints.getTakeHint(takeRequest);

  console.log(`Decision: ${takeHint.action.toUpperCase()}`);
  console.log(`Take Equity: ${takeHint.takeEquity.toFixed(4)}`);
  console.log(`Drop Equity: ${takeHint.dropEquity.toFixed(4)}`);
  console.log(`Difference: ${(takeHint.takeEquity - takeHint.dropEquity).toFixed(4)}`);
  console.log(`Win Probability: ${(takeHint.evaluation.win * 100).toFixed(1)}%\n`);
}

/**
 * Create a sample backgammon position for demonstration
 */
function createSamplePosition(): BackgammonBoard {
  // Create a realistic middle-game position
  const board: BackgammonBoard = {
    points: Array.from({ length: 24 }, (_, i) => ({
      position: {
        clockwise: i + 1,
        counterclockwise: 25 - (i + 1)
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

  // Add some checkers to create an interesting position
  addCheckersToPoint(board, 24, 'white', 2);  // White on 24-point
  addCheckersToPoint(board, 13, 'white', 3);  // White on 13-point
  addCheckersToPoint(board, 8, 'white', 3);   // White on 8-point
  addCheckersToPoint(board, 6, 'white', 3);   // White on 6-point

  addCheckersToPoint(board, 1, 'black', 2);   // Black on 1-point (their 24)
  addCheckersToPoint(board, 12, 'black', 3);  // Black on 12-point (their 13)
  addCheckersToPoint(board, 17, 'black', 3);  // Black on 17-point (their 8)
  addCheckersToPoint(board, 19, 'black', 3);  // Black on 19-point (their 6)

  // Add a checker on the bar for complexity
  board.bar.clockwise.checkers.push({
    id: 'white-bar-1',
    color: 'white'
  });

  return board;
}

/**
 * Helper function to add checkers to a specific point
 */
function addCheckersToPoint(
  board: BackgammonBoard,
  pointNumber: number,
  color: BackgammonColor,
  count: number
) {
  const point = board.points.find(p =>
    p.position.clockwise === pointNumber ||
    p.position.counterclockwise === pointNumber
  );

  if (point) {
    point.checkers = Array.from({ length: count }, (_, i) => ({
      id: `${color}-${pointNumber}-${i}`,
      color
    }));
  }
}

/**
 * Format moves for display
 */
function formatMoves(moves: BackgammonMove[]): string {
  return moves.map(move => {
    const from = move.from === 0 ? 'bar' : move.from.toString();
    const to = move.to === 25 ? 'off' : move.to.toString();
    const hit = move.hit ? '*' : '';
    return `${from}/${to}${hit}`;
  }).join(', ');
}

// Integration with existing Nodots Backgammon game
/**
 * Example: Integration with existing game state
 */
async function integrateWithExistingGame(game: BackgammonGame) {
  console.log('🔗 INTEGRATION WITH EXISTING GAME');
  console.log(''.padEnd(40, '-'));

  // Extract current game state
  const currentPlayer = game.players.find(p => p.color === game.turn);
  const opponent = game.players.find(p => p.color !== game.turn);

  if (!currentPlayer || !opponent || !game.activePlay) {
    console.log('❌ Game not in a state for hints');
    return;
  }

  // Convert game state to hint request
  const hintRequest = {
    board: game.board,
    dice: game.activePlay.dice,
    cubeValue: game.cube.value,
    cubeOwner: game.cube.owner,
    matchScore: [
      currentPlayer.score,
      opponent.score
    ] as [number, number],
    matchLength: game.matchLength,
    crawford: game.isCrawford,
    jacoby: true, // Assuming Jacoby rule
    beavers: true // Assuming beavers allowed
  };

  // Get hints based on game state
  switch (game.state) {
    case 'rolled':
      // Player has dice, needs to move
      const moveHints = await GnuBgHints.getMoveHints(hintRequest, 3);
      console.log(`💡 GNU BG suggests: ${formatMoves(moveHints[0].moves)}`);
      console.log(`   Expected equity: ${moveHints[0].equity.toFixed(4)}`);
      break;

    case 'doubled':
      // Player was doubled, needs take/drop decision
      const takeHint = await GnuBgHints.getTakeHint(hintRequest);
      console.log(`💡 GNU BG suggests: ${takeHint.action}`);
      console.log(`   Take equity: ${takeHint.takeEquity.toFixed(4)}`);
      break;

    case 'rolling':
      // Before rolling, check if we should double
      const doubleHint = await GnuBgHints.getDoubleHint(hintRequest);
      console.log(`💡 GNU BG suggests: ${doubleHint.action}`);
      if (doubleHint.action === 'double') {
        console.log(`   Take point: ${doubleHint.takePoint.toFixed(3)}`);
      }
      break;

    default:
      console.log('❓ No hints available for current game state');
  }

  console.log('');
}

/**
 * Example: Analyze multiple candidate moves
 */
async function analyzeCandidateMoves(
  board: BackgammonBoard,
  dice: [number, number],
  candidateMoves: BackgammonMove[][]
) {
  console.log('📊 ANALYZING CANDIDATE MOVES');
  console.log(''.padEnd(40, '-'));

  const baseRequest = {
    board,
    dice,
    cubeValue: 1,
    cubeOwner: null as BackgammonColor | null,
    matchScore: [0, 0] as [number, number],
    matchLength: 7,
    crawford: false,
    jacoby: false,
    beavers: true
  };

  // Get all GNU BG suggestions
  const allHints = await GnuBgHints.getMoveHints(baseRequest, 10);

  // Compare with our candidate moves
  candidateMoves.forEach((candidate, index) => {
    const candidateStr = formatMoves(candidate);
    const gnubgHint = allHints.find(hint =>
      formatMoves(hint.moves) === candidateStr
    );

    if (gnubgHint) {
      console.log(`Candidate ${index + 1}: ${candidateStr}`);
      console.log(`  GNU BG Rank: ${gnubgHint.rank}`);
      console.log(`  Equity: ${gnubgHint.equity.toFixed(4)}`);
      console.log(`  Difference from best: ${gnubgHint.difference.toFixed(4)}`);
    } else {
      console.log(`Candidate ${index + 1}: ${candidateStr}`);
      console.log(`  ❌ Not in GNU BG top 10`);
    }
    console.log('');
  });
}

// Run the demonstration
if (require.main === module) {
  demonstrateHints().catch(console.error);
}

// Export for use in other modules
export {
  demonstrateHints,
  integrateWithExistingGame,
  analyzeCandidateMoves,
  createSamplePosition
};