import {
  BackgammonBoard,
  BackgammonColor
} from '@nodots-llc/backgammon-types';
import type {
  CheckerLike,
  DoubleHint,
  Evaluation,
  HintBoard,
  HintConfig,
  HintRequest,
  MoveHint,
  MoveStep,
  SimplifiedCheckerContainer,
  TakeHint
} from './types';

export type {
  CheckerLike,
  DoubleHint,
  Evaluation,
  HintBoard,
  HintConfig,
  HintRequest,
  MoveHint,
  MoveStep,
  TakeHint
} from './types';

// Native addon binding
const addon = require('../build/Release/gnubg_hints.node');

/**
 * Request structure for hint evaluation
 */
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
  static async getHintsFromPositionId(positionId: string, dice: [number, number], maxHints: number = 5): Promise<MoveHint[]> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      // Create minimal request object with just position ID and dice
      const request = {
        positionId: positionId,
        dice: dice,
        cubeValue: 1,
        cubeOwner: -1,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false
      } as const;

      addon.getMoveHints(request, maxHints, (error: Error | null, results: any[]) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(this.convertHintsFromGnuBg(results));
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

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'));
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

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'));
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

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'));
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
   * Indices 0-23 map to board points 1-24 for the active color; index 24 stores the bar.
   */
  private static convertBoardToGnuBg(board: HintBoard): number[][] {
    const gnubgBoard: number[][] = [
      new Array(25).fill(0),
      new Array(25).fill(0)
    ];

    const points: SimplifiedCheckerContainer[] = Array.isArray((board as any)?.points)
      ? (board as any).points
      : [];

    points.forEach(point => {
      const checkers = Array.isArray(point.checkers) ? point.checkers : [];
      if (checkers.length === 0) {
        return;
      }

      const firstChecker = checkers[0];
      const color = firstChecker?.color;
      const clockwisePos = point.position?.clockwise;
      const counterPos = point.position?.counterclockwise;

      if (color === 'white' && typeof clockwisePos === 'number') {
        const mappedIndex = clockwisePos - 1;
        if (mappedIndex >= 0 && mappedIndex < 24) {
          gnubgBoard[0][mappedIndex] = checkers.length;
        }
      }

      if (color === 'black' && typeof counterPos === 'number') {
        const mappedIndex = counterPos - 1;
        if (mappedIndex >= 0 && mappedIndex < 24) {
          gnubgBoard[1][mappedIndex] = checkers.length;
        }
      }
    });

    const barClockwise = (board as any)?.bar?.clockwise;
    const barCounter = (board as any)?.bar?.counterclockwise;
    const barClockwiseCheckers = Array.isArray(barClockwise?.checkers) ? barClockwise.checkers : [];
    const barCounterCheckers = Array.isArray(barCounter?.checkers) ? barCounter.checkers : [];

    gnubgBoard[0][24] = barClockwiseCheckers.length;
    gnubgBoard[1][24] = barCounterCheckers.length;

    return gnubgBoard;
  }

  /**
   * Convert GNU Backgammon hints to MoveHint format
   */
  private static convertHintsFromGnuBg(gnubgHints: any[], board?: HintBoard): MoveHint[] {
    const baseEquity = Array.isArray(gnubgHints) && gnubgHints.length > 0 ? gnubgHints[0].equity ?? 0 : 0;

    return (Array.isArray(gnubgHints) ? gnubgHints : []).map((hint, index) => ({
      moves: this.convertMovesFromGnuBg(hint?.moves, board),
      evaluation: this.normalizeEvaluation(hint?.evaluation),
      equity: hint?.equity ?? 0,
      rank: index + 1,
      difference: index === 0 ? 0 : (hint?.equity ?? 0) - baseEquity
    }));
  }

  /**
   * Convert GNU Backgammon move format to BackgammonMove
   */
  private static convertMovesFromGnuBg(gnubgMoves: any, board?: HintBoard): MoveStep[] {
    const normalizedMoves = this.normalizeGnuBgMoves(gnubgMoves);

    return normalizedMoves.map(([rawFrom, rawTo]) => {
      const displayFrom = this.normalizePointIndex(rawFrom);
      const displayTo = this.normalizePointIndex(rawTo);
      const playerColor = this.determineMoveColor(rawFrom, board);
      return {
        from: displayFrom,
        to: displayTo,
        moveKind: this.determineMoveKind(rawFrom, rawTo),
        isHit: this.isHitMove(displayTo, playerColor, board),
        player: playerColor,
        fromContainer: this.resolveContainerKind(rawFrom),
        toContainer: this.resolveContainerKind(rawTo)
      };
    });
  }

  private static normalizeGnuBgMoves(rawMoves: any): Array<[number, number]> {
    if (!Array.isArray(rawMoves)) {
      return [];
    }

    if (rawMoves.length > 0 && Array.isArray(rawMoves[0])) {
      return (rawMoves as Array<[number, number]>).filter(([from, to]) =>
        Number.isFinite(from) && Number.isFinite(to) && from >= 0
      );
    }

    const flatMoves = rawMoves as number[];
    const result: Array<[number, number]> = [];

    for (let i = 0; i < flatMoves.length; i += 2) {
      const from = flatMoves[i];
      const to = flatMoves[i + 1];
      if (from === undefined || to === undefined || from < 0) {
        break;
      }
      result.push([from, to]);
    }

    return result;
  }

  private static normalizePointIndex(index: number): number {
    if (index < 0) {
      return 0;
    }

    if (index >= 24) {
      return 0;
    }

    return index + 1;
  }

  private static determineMoveColor(rawFrom: number, board?: HintBoard): BackgammonColor {
    if (!board) {
      return 'white';
    }

    if (rawFrom === 24) {
      const barClockwise = (board as any)?.bar?.clockwise;
      const barCounter = (board as any)?.bar?.counterclockwise;

      if (Array.isArray(barClockwise?.checkers) && barClockwise.checkers.some((checker: CheckerLike) => checker?.color === 'white')) {
        return 'white';
      }

      if (Array.isArray(barCounter?.checkers) && barCounter.checkers.some((checker: CheckerLike) => checker?.color === 'black')) {
        return 'black';
      }
    }

    const pointIndex = rawFrom + 1;

    const whitePoint = this.findPointByIndex(pointIndex, 'white', board);
    if (whitePoint && this.hasCheckerWithColor(whitePoint, 'white')) {
      return 'white';
    }

    const blackPoint = this.findPointByIndex(pointIndex, 'black', board);
    if (blackPoint && this.hasCheckerWithColor(blackPoint, 'black')) {
      return 'black';
    }

    return 'white';
  }

  private static determineMoveKind(from: number, to: number): MoveStep['moveKind'] {
    if (from === 24) {
      return 'reenter';
    }

    if (to < 0) {
      return 'bear-off';
    }

    return 'point-to-point';
  }

  private static resolveContainerKind(index: number): MoveStep['fromContainer'] {
    if (index === 24) {
      return 'bar';
    }
    if (index < 0) {
      return 'off';
    }
    return 'point';
  }

  private static isHitMove(to: number, player: BackgammonColor, board?: HintBoard): boolean {
    if (!board || to <= 0 || to > 24) {
      return false;
    }

    const opponent: BackgammonColor = player === 'white' ? 'black' : 'white';
    const destination = this.findPointByIndex(to, player, board);

    if (!destination || !Array.isArray(destination.checkers)) {
      return false;
    }

    const opponentCheckers = destination.checkers.filter(checker => checker?.color === opponent);
    return opponentCheckers.length === 1;
  }

  private static findPointByIndex(index: number, player: BackgammonColor, board: HintBoard): SimplifiedCheckerContainer | null {
    if (!board || index <= 0 || index > 24) {
      return null;
    }

    const points: SimplifiedCheckerContainer[] = Array.isArray((board as any)?.points)
      ? (board as any).points
      : [];

    if (player === 'white') {
      return points.find(point => point.position?.clockwise === index) ?? null;
    }

    return points.find(point => point.position?.counterclockwise === index) ?? null;
  }

  private static hasCheckerWithColor(container: SimplifiedCheckerContainer | undefined | null, color: BackgammonColor): boolean {
    if (!container || !Array.isArray(container.checkers)) {
      return false;
    }

    return container.checkers.some(checker => checker?.color === color);
  }

  private static normalizeEvaluation(rawEvaluation: any): Evaluation {
    if (Array.isArray(rawEvaluation)) {
      return {
        win: rawEvaluation[0] ?? 0,
        winGammon: rawEvaluation[1] ?? 0,
        winBackgammon: rawEvaluation[2] ?? 0,
        loseGammon: rawEvaluation[3] ?? 0,
        loseBackgammon: rawEvaluation[4] ?? 0,
        equity: rawEvaluation[5] ?? 0,
        cubefulEquity: rawEvaluation[6]
      };
    }

    if (rawEvaluation && typeof rawEvaluation === 'object') {
      return {
        win: rawEvaluation.win ?? 0,
        winGammon: rawEvaluation.winGammon ?? 0,
        winBackgammon: rawEvaluation.winBackgammon ?? 0,
        loseGammon: rawEvaluation.loseGammon ?? 0,
        loseBackgammon: rawEvaluation.loseBackgammon ?? 0,
        equity: rawEvaluation.equity ?? 0,
        cubefulEquity: rawEvaluation.cubefulEquity
      };
    }

    return {
      win: 0,
      winGammon: 0,
      winBackgammon: 0,
      loseGammon: 0,
      loseBackgammon: 0,
      equity: 0,
      cubefulEquity: 0
    };
  }

  /**
   * Convert GNU Backgammon double hint
   */
  private static convertDoubleHintFromGnuBg(gnubgHint: any): DoubleHint {
    return {
      action: gnubgHint.action,
      takePoint: gnubgHint.takePoint,
      dropPoint: gnubgHint.dropPoint,
      evaluation: this.normalizeEvaluation(gnubgHint.evaluation),
      cubefulEquity: gnubgHint.cubefulEquity
    };
  }

  /**
   * Convert GNU Backgammon take hint
   */
  private static convertTakeHintFromGnuBg(gnubgHint: any): TakeHint {
    return {
      action: gnubgHint.action,
      evaluation: this.normalizeEvaluation(gnubgHint.evaluation),
      takeEquity: gnubgHint.takeEquity,
      dropEquity: gnubgHint.dropEquity
    };
  }
}

export type { GameHintContextOverrides } from './integration/backgammon-core';

export {
  createHintRequestFromGame,
  deriveCubeOwner,
  deriveCubeValue,
  deriveDiceFromGame,
  deriveMatchLength,
  deriveMatchScore
} from './integration/backgammon-core';

// Export default instance
export default GnuBgHints;