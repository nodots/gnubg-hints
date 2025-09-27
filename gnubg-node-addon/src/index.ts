import {
  BackgammonBoard,
  BackgammonGame,
  BackgammonMove,
  BackgammonPlayer,
  BackgammonColor,
  BackgammonCheckerContainer
} from '@nodots-llc/backgammon-types';

// Native addon binding
const addon = require('../build/Release/gnubg_hints.node');

/**
 * Request structure for hint evaluation
 */
export interface HintRequest {
  board: BackgammonBoard;
  dice: [number, number];
  cubeValue: number;
  cubeOwner: BackgammonColor | null;
  matchScore: [number, number];
  matchLength: number;
  crawford: boolean;
  jacoby: boolean;
  beavers: boolean;
}

/**
 * Evaluation output from GNU Backgammon neural network
 */
export interface Evaluation {
  win: number;           // Probability of winning
  winGammon: number;     // Probability of winning a gammon
  winBackgammon: number; // Probability of winning a backgammon
  loseGammon: number;    // Probability of losing a gammon
  loseBackgammon: number;// Probability of losing a backgammon
  equity: number;        // Position equity
  cubefulEquity?: number;// Cubeful equity (if applicable)
}

/**
 * Move hint with evaluation
 */
export interface MoveHint {
  moves: BackgammonMove[];
  evaluation: Evaluation;
  equity: number;
  rank: number;
  difference: number; // Equity difference from best move
}

/**
 * Doubling cube decision hint
 */
export interface DoubleHint {
  action: 'double' | 'no-double' | 'too-good' | 'beaver' | 'redouble';
  takePoint: number;
  dropPoint: number;
  evaluation: Evaluation;
  cubefulEquity: number;
}

/**
 * Take/Drop decision hint
 */
export interface TakeHint {
  action: 'take' | 'drop' | 'beaver';
  evaluation: Evaluation;
  takeEquity: number;
  dropEquity: number;
}

/**
 * Configuration for the hint engine
 */
export interface HintConfig {
  evalPlies?: number;      // Evaluation depth (0-3)
  moveFilter?: number;     // Move filter level (0-4)
  threadCount?: number;    // Number of threads for evaluation
  usePruning?: boolean;    // Use pruning neural networks
  noise?: number;          // Evaluation noise (0.0 = deterministic)
}

/**
 * GNU Backgammon hint engine
 */
export class GnuBgHints {
  private static initialized = false;
  private static config: HintConfig = {
    evalPlies: 2,
    moveFilter: 2,
    threadCount: 1,
    usePruning: true,
    noise: 0.0
  };

  /**
   * Initialize the hint engine with neural network weights
   */
  static async initialize(weightsPath?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      addon.initialize(weightsPath || '', (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          this.initialized = true;
          resolve();
        }
      });
    });
  }

  /**
   * Configure the hint engine
   */
  static configure(config: Partial<HintConfig>): void {
    this.config = { ...this.config, ...config };
    addon.configure(this.config);
  }

  /**
   * Get move hints directly from GNU Backgammon position ID and dice roll
   */
  static async getHintsFromPositionId(positionId: string, dice: [number, number], maxHints: number = 5): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // Create minimal request object with just position ID and dice
      const request = {
        positionId: positionId,
        dice: dice,
        // Minimal required fields for the C++ layer
        board: [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
        cubeValue: 1,
        cubeOwner: -1,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      };

      addon.getMoveHints(request, maxHints, (error: Error | null, results: any[]) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(results);
      });
    });
  }

  /**
   * Get move hints for a given position and dice roll
   */
  static async getMoveHints(request: HintRequest, maxHints: number = 10): Promise<MoveHint[]> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // Convert board to GNU Backgammon format
      const gnubgBoard = this.convertBoardToGnuBg(request.board);

      addon.getMoveHints(
        {
          board: gnubgBoard,
          dice: request.dice,
          cubeValue: request.cubeValue,
          cubeOwner: request.cubeOwner === null ? -1 : request.cubeOwner,
          matchScore: request.matchScore,
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers
        },
        maxHints,
        (err: Error | null, hints: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(this.convertHintsFromGnuBg(hints, request.board));
          }
        }
      );
    });
  }

  /**
   * Get doubling decision hint
   */
  static async getDoubleHint(request: HintRequest): Promise<DoubleHint> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const gnubgBoard = this.convertBoardToGnuBg(request.board);

      addon.getDoubleHint(
        {
          board: gnubgBoard,
          cubeValue: request.cubeValue,
          cubeOwner: request.cubeOwner === null ? -1 : request.cubeOwner,
          matchScore: request.matchScore,
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers
        },
        (err: Error | null, hint: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(this.convertDoubleHintFromGnuBg(hint));
          }
        }
      );
    });
  }

  /**
   * Get take/drop decision hint
   */
  static async getTakeHint(request: HintRequest): Promise<TakeHint> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const gnubgBoard = this.convertBoardToGnuBg(request.board);

      addon.getTakeHint(
        {
          board: gnubgBoard,
          cubeValue: request.cubeValue,
          cubeOwner: request.cubeOwner === null ? -1 : request.cubeOwner,
          matchScore: request.matchScore,
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers
        },
        (err: Error | null, hint: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(this.convertTakeHintFromGnuBg(hint));
          }
        }
      );
    });
  }

  /**
   * Shutdown the hint engine and free resources
   */
  static shutdown(): void {
    if (this.initialized) {
      addon.shutdown();
      this.initialized = false;
    }
  }

  /**
   * Convert BackgammonBoard to GNU Backgammon format (2D array)
   * GNU BG uses: [2][25] array where [0] is player 0 (clockwise), [1] is player 1 (counter)
   * Point 0 is the bar, points 1-24 are board points
   */
  private static convertBoardToGnuBg(board: BackgammonBoard): number[][] {
    const gnubgBoard: number[][] = [
      new Array(25).fill(0), // Player 0 (clockwise)
      new Array(25).fill(0)  // Player 1 (counterclockwise)
    ];

    // Convert points
    board.points.forEach(point => {
      const checkerCount = point.checkers.length;
      if (checkerCount > 0 && point.checkers[0]) {
        const player = point.checkers[0].color;
        // Map point positions to GNU BG format
        const clockwisePos = point.position.clockwise;
        const counterPos = point.position.counterclockwise;

        if (player === 'white') {
          gnubgBoard[0][clockwisePos] = checkerCount;
        } else {
          gnubgBoard[1][counterPos] = checkerCount;
        }
      }
    });

    // Add bar checkers
    gnubgBoard[0][0] = board.bar.clockwise.checkers.length;
    gnubgBoard[1][0] = board.bar.counterclockwise.checkers.length;

    return gnubgBoard;
  }

  /**
   * Convert GNU Backgammon hints to MoveHint format
   */
  private static convertHintsFromGnuBg(gnubgHints: any[], board: BackgammonBoard): MoveHint[] {
    return gnubgHints.map((hint, index) => ({
      moves: this.convertMovesFromGnuBg(hint.moves, board),
      evaluation: {
        win: hint.evaluation[0],
        winGammon: hint.evaluation[1],
        winBackgammon: hint.evaluation[2],
        loseGammon: hint.evaluation[3],
        loseBackgammon: hint.evaluation[4],
        equity: hint.evaluation[5],
        cubefulEquity: hint.evaluation[6]
      },
      equity: hint.equity,
      rank: index + 1,
      difference: index === 0 ? 0 : hint.equity - gnubgHints[0].equity
    }));
  }

  /**
   * Convert GNU Backgammon move format to BackgammonMove
   */
  private static convertMovesFromGnuBg(gnubgMoves: number[], board: BackgammonBoard): BackgammonMove[] {
    const moves: BackgammonMove[] = [];

    // GNU BG move format: [from1, to1, from2, to2, from3, to3, from4, to4]
    // -1 indicates no move
    for (let i = 0; i < gnubgMoves.length; i += 2) {
      if (gnubgMoves[i] === -1) break;

      const from = gnubgMoves[i];
      const to = gnubgMoves[i + 1];

      // TODO: Convert GNU BG move format to proper BackgammonMove
      // This is a placeholder - actual implementation needs proper conversion
      // from GNU BG [from, to] format to BackgammonMove with proper structure
      // For now, we'll return the move data for processing elsewhere
      moves.push({
        // Simplified placeholder - real implementation needs proper BackgammonMove creation
        gnubgFrom: from,
        gnubgTo: to,
        gnubgHit: false // Would need to check if opponent checker is hit
      } as any);
    }

    return moves;
  }

  /**
   * Convert GNU Backgammon double hint
   */
  private static convertDoubleHintFromGnuBg(gnubgHint: any): DoubleHint {
    return {
      action: gnubgHint.action,
      takePoint: gnubgHint.takePoint,
      dropPoint: gnubgHint.dropPoint,
      evaluation: {
        win: gnubgHint.evaluation[0],
        winGammon: gnubgHint.evaluation[1],
        winBackgammon: gnubgHint.evaluation[2],
        loseGammon: gnubgHint.evaluation[3],
        loseBackgammon: gnubgHint.evaluation[4],
        equity: gnubgHint.evaluation[5],
        cubefulEquity: gnubgHint.evaluation[6]
      },
      cubefulEquity: gnubgHint.cubefulEquity
    };
  }

  /**
   * Convert GNU Backgammon take hint
   */
  private static convertTakeHintFromGnuBg(gnubgHint: any): TakeHint {
    return {
      action: gnubgHint.action,
      evaluation: {
        win: gnubgHint.evaluation[0],
        winGammon: gnubgHint.evaluation[1],
        winBackgammon: gnubgHint.evaluation[2],
        loseGammon: gnubgHint.evaluation[3],
        loseBackgammon: gnubgHint.evaluation[4],
        equity: gnubgHint.evaluation[5],
        cubefulEquity: gnubgHint.evaluation[6]
      },
      takeEquity: gnubgHint.takeEquity,
      dropEquity: gnubgHint.dropEquity
    };
  }
}

// Export default instance
export default GnuBgHints;