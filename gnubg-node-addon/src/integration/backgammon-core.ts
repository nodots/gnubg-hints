import type {
  BackgammonBoard,
  BackgammonColor,
  BackgammonCube,
  BackgammonCubeValue,
  BackgammonDice,
  BackgammonDiceRolled,
  BackgammonGame,
  BackgammonPlayer,
  MatchInfo
} from '@nodots-llc/backgammon-types';
import type { HintRequest } from '../types';

export interface GameHintContextOverrides
  extends Partial<Omit<HintRequest, 'board' | 'dice'>> {
  /**
   * Override the board that should be evaluated. Defaults to `game.board`.
   */
  board?: BackgammonBoard;
  /**
   * Override dice used for move generation. When omitted the helper will
   * attempt to derive the current roll from the active player or play state.
   */
  dice?: [number, number];
  /**
   * Dice to fall back to when no active roll can be discovered.
   * Defaults to `[0, 0]` which is appropriate for cube decisions
   * or situations where dice have not been rolled yet.
   */
  defaultDice?: [number, number];
  /**
   * Optional match metadata when it is not embedded in the game object.
   */
  matchInfo?: MatchInfo;
}

const DEFAULT_DICE: [number, number] = [0, 0];

/**
 * Create a {@link HintRequest} from a {@link BackgammonGame} instance exported by
 * `@nodots-llc/backgammon-core`.
 */
export function createHintRequestFromGame(
  game: BackgammonGame,
  overrides: GameHintContextOverrides = {}
): HintRequest {
  const board: BackgammonBoard | undefined = overrides.board ?? game.board;
  if (!board) {
    throw new Error('Backgammon game is missing a board state.');
  }

  const dice = overrides.dice ?? deriveDiceFromGame(game) ?? overrides.defaultDice ?? DEFAULT_DICE;

  const matchInfo = overrides.matchInfo ?? extractMatchInfo(game);

  return {
    board,
    dice,
    cubeValue: overrides.cubeValue ?? deriveCubeValue(game.cube),
    cubeOwner: overrides.cubeOwner ?? deriveCubeOwner(game.cube),
    matchScore: overrides.matchScore ?? deriveMatchScore(matchInfo),
    matchLength: overrides.matchLength ?? deriveMatchLength(matchInfo),
    crawford: overrides.crawford ?? deriveCrawford(matchInfo),
    jacoby: overrides.jacoby ?? Boolean(game.rules?.useJacobyRule),
    beavers: overrides.beavers ?? Boolean(game.rules?.useBeaverRule)
  };
}

/**
 * Attempt to determine the currently rolled dice from a game state.
 * Returns `undefined` when the active player has not rolled yet.
 */
export function deriveDiceFromGame(game: BackgammonGame): [number, number] | undefined {
  const fromActivePlayer = getDiceFromPlayer(game.activePlayer);
  if (fromActivePlayer) {
    return fromActivePlayer;
  }

  const fromActivePlay = getDiceFromActivePlay(game);
  if (fromActivePlay) {
    return fromActivePlay;
  }

  const fromInactivePlayer = getDiceFromPlayer(game.inactivePlayer);
  return fromInactivePlayer;
}

function getDiceFromActivePlay(game: BackgammonGame): [number, number] | undefined {
  const play: BackgammonGame['activePlay'] = game.activePlay;
  if (!play) {
    return undefined;
  }

  if ((play as { stateKind: string }).stateKind === 'doubled') {
    const doubledPlay = play as unknown as { dice: BackgammonDiceRolled | undefined };
    if (doubledPlay.dice && isDiceRolled(doubledPlay.dice)) {
      return cloneRoll(doubledPlay.dice.currentRoll);
    }
  }

  return undefined;
}

function getDiceFromPlayer(player: BackgammonPlayer | undefined): [number, number] | undefined {
  if (!player) {
    return undefined;
  }

  const dice: BackgammonDice | undefined = (player as { dice?: BackgammonDice }).dice;
  if (dice && isDiceRolled(dice)) {
    return cloneRoll(dice.currentRoll);
  }

  return undefined;
}

function isDiceRolled(dice: BackgammonDice): dice is BackgammonDiceRolled {
  return dice.stateKind === 'rolled' && Array.isArray(dice.currentRoll);
}

function cloneRoll(roll: BackgammonDiceRolled['currentRoll']): [number, number] {
  const [first, second] = roll;
  return [first, second];
}

function deriveCubeValue(cube: BackgammonCube | undefined): number {
  const value: BackgammonCubeValue | undefined = cube?.value;
  return typeof value === 'number' ? value : 1;
}

function deriveCubeOwner(cube: BackgammonCube | undefined): BackgammonColor | null {
  return cube?.owner?.color ?? null;
}

function deriveMatchScore(matchInfo: MatchInfo | undefined): [number, number] {
  if (!matchInfo?.matchScore) {
    return [0, 0];
  }

  const whiteScore = matchInfo.matchScore.white ?? 0;
  const blackScore = matchInfo.matchScore.black ?? 0;
  return [whiteScore, blackScore];
}

function deriveMatchLength(matchInfo: MatchInfo | undefined): number {
  return matchInfo?.matchLength ?? 0;
}

function deriveCrawford(matchInfo: MatchInfo | undefined): boolean {
  if (typeof matchInfo?.isCrawford === 'boolean') {
    return matchInfo.isCrawford;
  }

  return false;
}

function extractMatchInfo(game: BackgammonGame): MatchInfo | undefined {
  const metadata = game.metadata as { matchInfo?: MatchInfo } | undefined;
  return metadata?.matchInfo;
}

export {
  deriveCubeOwner,
  deriveCubeValue,
  deriveMatchLength,
  deriveMatchScore
};
