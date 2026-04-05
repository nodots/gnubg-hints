import type {
  BackgammonBoard,
  BackgammonColor,
  BackgammonMoveDirection,
} from '@nodots-llc/backgammon-types';

export type CheckerLike = {
  color?: BackgammonColor;
  id?: string;
};

export interface SimplifiedCheckerContainer {
  id?: string;
  position?: {
    clockwise?: number;
    counterclockwise?: number;
  };
  checkers?: CheckerLike[];
}

export interface SimplifiedBoard {
  id?: string;
  points: SimplifiedCheckerContainer[];
  bar: {
    clockwise?: { checkers?: CheckerLike[] };
    counterclockwise?: { checkers?: CheckerLike[] };
  };
  off: {
    clockwise?: { checkers?: CheckerLike[] };
    counterclockwise?: { checkers?: CheckerLike[] };
  };
}

export type HintBoard = BackgammonBoard | SimplifiedBoard;

export enum MoveFilterSetting {
  Tiny = 0,
  Narrow = 1,
  Normal = 2,
  Large = 3,
  Huge = 4,
}

/**
 * Request structure for hint evaluation
 */
export interface HintRequest {
  board: HintBoard;
  dice: [number, number];
  /**
   * The color of the player who is on roll. Required to correctly encode
   * board positions - GNU BG expects player 0 to be the player on roll.
   * When omitted, defaults to 'white' for backward compatibility.
   */
  activePlayerColor?: BackgammonColor;
  /**
   * The movement direction of the player who is on roll.
   * Required for canonical GNU normalization.
   */
  activePlayerDirection: BackgammonMoveDirection;
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
  win: number; // Probability of winning
  winGammon: number; // Probability of winning a gammon
  winBackgammon: number; // Probability of winning a backgammon
  loseGammon: number; // Probability of losing a gammon
  loseBackgammon: number; // Probability of losing a backgammon
  equity: number; // Position equity
  cubefulEquity?: number; // Cubeful equity (if applicable)
}

/**
 * Move hint with evaluation
 */
export interface MoveHint {
  moves: MoveStep[];
  evaluation: Evaluation;
  equity: number;
  rank: number;
  difference: number; // Equity difference from best move
}

export interface MoveStep {
  from: number;
  to: number;
  moveKind: 'point-to-point' | 'reenter' | 'bear-off';
  isHit: boolean;
  player: BackgammonColor;
  fromContainer: 'bar' | 'point' | 'off';
  toContainer: 'bar' | 'point' | 'off';
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
  evalPlies?: number; // Evaluation depth (0-3)
  moveFilter?: MoveFilterSetting; // Move filter level (Tiny..Huge)
  threadCount?: number; // Number of threads for evaluation
  usePruning?: boolean; // Use pruning neural networks
  noise?: number; // Evaluation noise (0.0 = deterministic)
}
