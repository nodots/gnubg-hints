import { GnuBgHints } from '@nodots/gnubg-hints';
import type {
  BackgammonBoard,
  BackgammonGame,
  BackgammonMove,
  BackgammonColor,
  BackgammonPlayer
} from '@nodots-llc/backgammon-types';

/**
 * AI Player class that uses GNU Backgammon hints for decision making
 */
export class GnuBgAIPlayer {
  private initialized = false;
  private readonly skillLevel: 'beginner' | 'intermediate' | 'expert' | 'worldclass';

  constructor(skillLevel: 'beginner' | 'intermediate' | 'expert' | 'worldclass' = 'expert') {
    this.skillLevel = skillLevel;
  }

  /**
   * Initialize the AI player
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await GnuBgHints.initialize();
      this.configureSkillLevel();
      this.initialized = true;
    }
  }

  /**
   * Configure GNU BG engine based on skill level
   */
  private configureSkillLevel(): void {
    const configs = {
      beginner: {
        evalPlies: 0,
        moveFilter: 0,
        usePruning: true,
        noise: 0.15 // Add some randomness for beginner mistakes
      },
      intermediate: {
        evalPlies: 1,
        moveFilter: 1,
        usePruning: true,
        noise: 0.08
      },
      expert: {
        evalPlies: 2,
        moveFilter: 2,
        usePruning: true,
        noise: 0.02
      },
      worldclass: {
        evalPlies: 3,
        moveFilter: 3,
        usePruning: false, // Full evaluation for world-class play
        noise: 0.0
      }
    };

    GnuBgHints.configure(configs[this.skillLevel]);
  }

  /**
   * Make a move decision for the AI player
   */
  async makeMove(game: BackgammonGame): Promise<BackgammonMove[]> {
    if (!this.initialized) {
      throw new Error('AI not initialized. Call initialize() first.');
    }

    if (game.state !== 'rolled' || !game.activePlay) {
      throw new Error('Game not in a state for move decisions');
    }

    const hintRequest = this.createHintRequest(game);
    const hints = await GnuBgHints.getMoveHints(hintRequest, 1);

    if (hints.length === 0) {
      throw new Error('No legal moves available');
    }

    // For beginner/intermediate, sometimes pick a suboptimal move
    const moveIndex = this.selectMoveWithSkillVariation(hints.length);
    return hints[moveIndex].moves;
  }

  /**
   * Make a doubling decision
   */
  async shouldDouble(game: BackgammonGame): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('AI not initialized');
    }

    const hintRequest = this.createHintRequest(game);
    const doubleHint = await GnuBgHints.getDoubleHint(hintRequest);

    return doubleHint.action === 'double' || doubleHint.action === 'redouble';
  }

  /**
   * Make a take/drop decision when doubled
   */
  async shouldTake(game: BackgammonGame): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('AI not initialized');
    }

    const hintRequest = this.createHintRequest(game);
    const takeHint = await GnuBgHints.getTakeHint(hintRequest);

    // For lower skill levels, add some decision variation
    if (this.skillLevel === 'beginner' && Math.random() < 0.1) {
      // 10% chance of wrong decision for beginners
      return takeHint.action !== 'take';
    }

    return takeHint.action === 'take' || takeHint.action === 'beaver';
  }

  /**
   * Get analysis of current position
   */
  async analyzePosition(game: BackgammonGame): Promise<PositionAnalysis> {
    if (!this.initialized) {
      throw new Error('AI not initialized');
    }

    const hintRequest = this.createHintRequest(game);

    // Get comprehensive analysis
    const [moveHints, doubleHint] = await Promise.all([
      game.activePlay ? GnuBgHints.getMoveHints(hintRequest, 5) : [],
      GnuBgHints.getDoubleHint(hintRequest)
    ]);

    return {
      equity: doubleHint.evaluation.equity,
      winProbability: doubleHint.evaluation.win,
      gammonFor: doubleHint.evaluation.winGammon,
      gammonAgainst: doubleHint.evaluation.loseGammon,
      bestMoves: moveHints.slice(0, 3),
      cubeAction: doubleHint.action,
      takePoint: doubleHint.takePoint,
      dropPoint: doubleHint.dropPoint
    };
  }

  /**
   * Create hint request from game state
   */
  private createHintRequest(game: BackgammonGame) {
    const currentPlayer = game.players.find(p => p.color === game.turn);
    const opponent = game.players.find(p => p.color !== game.turn);

    if (!currentPlayer || !opponent) {
      throw new Error('Invalid game state');
    }

    return {
      board: game.board,
      dice: game.activePlay?.dice || [0, 0] as [number, number],
      cubeValue: game.cube.value,
      cubeOwner: game.cube.owner,
      matchScore: [currentPlayer.score, opponent.score] as [number, number],
      matchLength: game.matchLength,
      crawford: game.isCrawford,
      jacoby: true,
      beavers: true
    };
  }

  /**
   * Select move based on skill level (add variation for lower skills)
   */
  private selectMoveWithSkillVariation(hintsCount: number): number {
    const errorRates = {
      beginner: 0.25,    // 25% chance of suboptimal move
      intermediate: 0.10, // 10% chance
      expert: 0.02,      // 2% chance
      worldclass: 0.0    // Always best move
    };

    const errorRate = errorRates[this.skillLevel];

    if (Math.random() < errorRate && hintsCount > 1) {
      // Pick a random suboptimal move
      return Math.floor(Math.random() * Math.min(3, hintsCount - 1)) + 1;
    }

    return 0; // Best move
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.initialized) {
      GnuBgHints.shutdown();
      this.initialized = false;
    }
  }
}

/**
 * Position analysis result
 */
interface PositionAnalysis {
  equity: number;
  winProbability: number;
  gammonFor: number;
  gammonAgainst: number;
  bestMoves: Array<{
    moves: BackgammonMove[];
    equity: number;
    rank: number;
  }>;
  cubeAction: string;
  takePoint: number;
  dropPoint: number;
}

/**
 * Game analyzer that provides detailed position insights
 */
export class GameAnalyzer {
  private ai: GnuBgAIPlayer;

  constructor() {
    this.ai = new GnuBgAIPlayer('worldclass'); // Use highest skill for analysis
  }

  async initialize(): Promise<void> {
    await this.ai.initialize();
  }

  /**
   * Analyze a completed game and find mistakes
   */
  async analyzeGame(gameHistory: BackgammonGame[]): Promise<GameAnalysis> {
    const mistakes: MistakeAnalysis[] = [];
    let totalEquityLoss = 0;

    for (let i = 0; i < gameHistory.length; i++) {
      const game = gameHistory[i];

      if (game.state === 'rolled' && game.activePlay) {
        const analysis = await this.ai.analyzePosition(game);

        // If we have the next position, compare the equity difference
        if (i + 1 < gameHistory.length) {
          const nextGame = gameHistory[i + 1];
          const nextAnalysis = await this.ai.analyzePosition(nextGame);

          const equityLoss = analysis.equity - nextAnalysis.equity;

          // Flag as mistake if equity loss > threshold
          if (equityLoss > 0.02) { // 2% equity loss threshold
            mistakes.push({
              moveNumber: i + 1,
              player: game.turn,
              equityLoss,
              bestMove: analysis.bestMoves[0]?.moves || [],
              actualMove: game.activePlay.moves.map(m => m.move).flat() || [],
              position: game.board
            });

            totalEquityLoss += equityLoss;
          }
        }
      }
    }

    return {
      totalMistakes: mistakes.length,
      totalEquityLoss,
      averageEquityLoss: mistakes.length > 0 ? totalEquityLoss / mistakes.length : 0,
      mistakes: mistakes.sort((a, b) => b.equityLoss - a.equityLoss) // Sort by severity
    };
  }

  /**
   * Get position classification and strategy advice
   */
  async getPositionAdvice(game: BackgammonGame): Promise<PositionAdvice> {
    const analysis = await this.ai.analyzePosition(game);

    // Classify position type
    const positionType = this.classifyPosition(game.board, analysis);

    // Generate strategic advice
    const advice = this.generateAdvice(positionType, analysis);

    return {
      positionType,
      advice,
      equity: analysis.equity,
      winProbability: analysis.winProbability,
      keyMoves: analysis.bestMoves.slice(0, 3)
    };
  }

  private classifyPosition(board: BackgammonBoard, analysis: PositionAnalysis): string {
    // Simple position classification logic
    const { winProbability, gammonFor, gammonAgainst } = analysis;

    if (winProbability > 0.8) return 'winning';
    if (winProbability < 0.2) return 'losing';
    if (gammonFor > 0.15) return 'gammon-threat';
    if (gammonAgainst > 0.15) return 'gammon-save';
    if (winProbability > 0.4 && winProbability < 0.6) return 'racing';

    return 'contact';
  }

  private generateAdvice(positionType: string, analysis: PositionAnalysis): string {
    const adviceMap = {
      'winning': 'Play safe and avoid risks. Consider doubling if opponent might take.',
      'losing': 'Take calculated risks. Look for tactical shots.',
      'gammon-threat': 'Play aggressively to maximize gammon chances.',
      'gammon-save': 'Play safely to avoid gammon. Escape back checkers.',
      'racing': 'Focus on pip count and efficient checker movement.',
      'contact': 'Balance safety and flexibility. Look for key tactical points.'
    };

    return adviceMap[positionType] || 'Focus on making the best moves according to position evaluation.';
  }

  shutdown(): void {
    this.ai.shutdown();
  }
}

// Type definitions
interface MistakeAnalysis {
  moveNumber: number;
  player: BackgammonColor;
  equityLoss: number;
  bestMove: BackgammonMove[];
  actualMove: BackgammonMove[];
  position: BackgammonBoard;
}

interface GameAnalysis {
  totalMistakes: number;
  totalEquityLoss: number;
  averageEquityLoss: number;
  mistakes: MistakeAnalysis[];
}

interface PositionAdvice {
  positionType: string;
  advice: string;
  equity: number;
  winProbability: number;
  keyMoves: Array<{
    moves: BackgammonMove[];
    equity: number;
    rank: number;
  }>;
}

/**
 * Example usage of AI integration
 */
export async function demonstrateAIIntegration() {
  console.log('🤖 GNU BG AI Integration Demo\n');

  // Create AI player
  const aiPlayer = new GnuBgAIPlayer('expert');
  await aiPlayer.initialize();

  // Create game analyzer
  const analyzer = new GameAnalyzer();
  await analyzer.initialize();

  try {
    // Simulate AI decision making (you would use real game state)
    const mockGame = createMockGame();

    // AI makes a move
    if (mockGame.state === 'rolled') {
      console.log('🎯 AI making move decision...');
      const aiMove = await aiPlayer.makeMove(mockGame);
      console.log(`AI chooses: ${formatMoves(aiMove)}\n`);
    }

    // AI makes doubling decision
    console.log('🎲 AI doubling decision...');
    const shouldDouble = await aiPlayer.shouldDouble(mockGame);
    console.log(`AI decision: ${shouldDouble ? 'DOUBLE' : 'NO DOUBLE'}\n`);

    // Get position analysis
    console.log('📊 Position analysis...');
    const analysis = await analyzer.getPositionAdvice(mockGame);
    console.log(`Position type: ${analysis.positionType}`);
    console.log(`Win probability: ${(analysis.winProbability * 100).toFixed(1)}%`);
    console.log(`Advice: ${analysis.advice}\n`);

  } finally {
    aiPlayer.shutdown();
    analyzer.shutdown();
  }
}

// Helper functions
function createMockGame(): BackgammonGame {
  // Create a mock game for demonstration
  // In real usage, this would be your actual game state
  return {
    id: 'demo-game',
    players: [
      { id: 'human', name: 'Human', color: 'white', score: 0 },
      { id: 'ai', name: 'GNU BG AI', color: 'black', score: 0 }
    ],
    board: createStartingBoard(),
    turn: 'white',
    state: 'rolled',
    activePlay: {
      dice: [6, 1],
      moves: []
    },
    cube: { value: 1, owner: null },
    matchLength: 7,
    isCrawford: false
  } as BackgammonGame;
}

function createStartingBoard(): BackgammonBoard {
  // Return standard starting position
  return {
    points: Array.from({ length: 24 }, (_, i) => ({
      position: { clockwise: i + 1, counterclockwise: 25 - (i + 1) },
      checkers: []
    })),
    bar: { clockwise: { checkers: [] }, counterclockwise: { checkers: [] } },
    off: { clockwise: { checkers: [] }, counterclockwise: { checkers: [] } }
  };
}

function formatMoves(moves: BackgammonMove[]): string {
  return moves.map(move => {
    const from = move.from === 0 ? 'bar' : move.from.toString();
    const to = move.to === 25 ? 'off' : move.to.toString();
    return `${from}/${to}`;
  }).join(', ');
}

// Run demo if called directly
if (require.main === module) {
  demonstrateAIIntegration().catch(console.error);
}