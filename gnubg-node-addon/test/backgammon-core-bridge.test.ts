import {
  createHintRequestFromGame,
  deriveDiceFromGame
} from '../src';
import type {
  BackgammonBoard,
  BackgammonCube,
  BackgammonDiceRolled,
  BackgammonGame,
  BackgammonPlayer,
  BackgammonPlayerInactive,
  BackgammonPlayerMoving,
  MatchInfo
} from '@nodots-llc/backgammon-types';

describe('Backgammon core bridge helpers', () => {
  it('creates a hint request using data from the game state', () => {
    const game = createStubGame();

    const request = createHintRequestFromGame(game);

    expect(request.board).toBe(game.board);
    expect(request.dice).toEqual<[number, number]>([3, 1]);
    expect(request.cubeValue).toBe(4);
    expect(request.cubeOwner).toBe('white');
    expect(request.matchScore).toEqual<[number, number]>([2, 4]);
    expect(request.matchLength).toBe(7);
    expect(request.crawford).toBe(true);
    expect(request.jacoby).toBe(true);
    expect(request.beavers).toBe(false);
  });

  it('allows overriding derived properties', () => {
    const game = createStubGame();

    const request = createHintRequestFromGame(game, {
      dice: [6, 6],
      cubeValue: 8,
      cubeOwner: 'black',
      matchScore: [5, 5],
      matchLength: 13,
      crawford: false,
      jacoby: false,
      beavers: true
    });

    expect(request.dice).toEqual<[number, number]>([6, 6]);
    expect(request.cubeValue).toBe(8);
    expect(request.cubeOwner).toBe('black');
    expect(request.matchScore).toEqual<[number, number]>([5, 5]);
    expect(request.matchLength).toBe(13);
    expect(request.crawford).toBe(false);
    expect(request.jacoby).toBe(false);
    expect(request.beavers).toBe(true);
  });

  it('falls back to the provided default dice when no roll is available', () => {
    const game = createStubGame();
    // Remove dice information from players
    (game.activePlayer as any).dice = {
      id: 'dice-white',
      color: 'white',
      stateKind: 'rolling'
    };
    (game.inactivePlayer as any).dice = {
      id: 'dice-black',
      color: 'black',
      stateKind: 'inactive'
    };
    (game as any).activePlay = undefined;

    const request = createHintRequestFromGame(game, { defaultDice: [5, 2] });

    expect(request.dice).toEqual<[number, number]>([5, 2]);
  });

  it('can derive dice from the active play when player dice are unavailable', () => {
    const game = createStubGame();
    const doubledDice: BackgammonDiceRolled = {
      id: 'double-dice',
      color: 'white',
      stateKind: 'rolled',
      currentRoll: [4, 4],
      total: 8
    };

    (game.activePlayer as any).dice = {
      id: 'dice-white',
      color: 'white',
      stateKind: 'rolling'
    };

    (game as any).activePlay = {
      id: 'play-double',
      stateKind: 'doubled',
      player: game.activePlayer,
      board: game.board,
      moves: [],
      dice: doubledDice
    };

    expect(deriveDiceFromGame(game)).toEqual<[number, number]>([4, 4]);
  });
});

function createStubGame(): BackgammonGame {
  const board = createMinimalBoard();
  const activePlayer = createMovingPlayer('white');
  const inactivePlayer = createInactivePlayer('black');

  const cube: BackgammonCube = {
    id: 'cube-1',
    stateKind: 'doubled',
    owner: activePlayer,
    value: 4,
    offeredBy: undefined
  } as BackgammonCube;

  const matchInfo: MatchInfo = {
    matchId: 'match-1',
    gameNumber: 3,
    matchLength: 7,
    matchScore: { white: 2, black: 4 },
    isCrawford: true
  };

  const game: BackgammonGame = {
    id: 'game-1',
    stateKind: 'moving',
    players: [activePlayer, inactivePlayer],
    board,
    cube,
    createdAt: new Date(),
    activeColor: 'white',
    activePlay: {
      id: 'play-1',
      stateKind: 'moving',
      player: activePlayer,
      board,
      moves: []
    } as any,
    activePlayer,
    inactivePlayer,
    metadata: { matchInfo },
    settings: {
      allowUndo: false,
      allowResign: true,
      autoPlay: false,
      showHints: false,
      showProbabilities: false
    },
    rules: {
      useCrawfordRule: true,
      useJacobyRule: true,
      useBeaverRule: false,
      useRaccoonRule: false,
      useMurphyRule: false,
      useHollandRule: false
    },
    version: 'v1'
  } as unknown as BackgammonGame;

  return game;
}

function createMovingPlayer(color: 'white' | 'black'): BackgammonPlayer {
  return {
    id: `${color}-player`,
    userId: `${color}-user`,
    color,
    direction: color === 'white' ? 'clockwise' : 'counterclockwise',
    pipCount: 0,
    isRobot: false,
    rollForStartValue: 1,
    stateKind: 'moving',
    dice: {
      id: `${color}-dice`,
      color,
      stateKind: 'rolled',
      currentRoll: [3, 1],
      total: 4
    }
  } as unknown as BackgammonPlayerMoving;
}

function createInactivePlayer(color: 'white' | 'black'): BackgammonPlayer {
  return {
    id: `${color}-player-inactive`,
    userId: `${color}-user-inactive`,
    color,
    direction: color === 'white' ? 'clockwise' : 'counterclockwise',
    pipCount: 0,
    isRobot: false,
    rollForStartValue: 1,
    stateKind: 'inactive',
    dice: {
      id: `${color}-dice-inactive`,
      color,
      stateKind: 'inactive'
    }
  } as unknown as BackgammonPlayerInactive;
}

function createMinimalBoard(): BackgammonBoard {
  return {
    id: 'board-1',
    points: Array.from({ length: 24 }, (_, index) => ({
      id: `point-${index + 1}`,
      kind: 'point',
      position: {
        clockwise: (index + 1) as any,
        counterclockwise: (24 - index) as any
      },
      checkers: index === 0 ? [{ id: 'checker-1', color: 'white' }] : []
    })),
    bar: {
      clockwise: { id: 'bar-white', kind: 'bar', direction: 'clockwise', position: { clockwise: 25, counterclockwise: 0 }, checkers: [] },
      counterclockwise: { id: 'bar-black', kind: 'bar', direction: 'counterclockwise', position: { clockwise: 0, counterclockwise: 25 }, checkers: [] }
    },
    off: {
      clockwise: { id: 'off-white', kind: 'off', direction: 'clockwise', position: { clockwise: 0, counterclockwise: 0 }, checkers: [] },
      counterclockwise: { id: 'off-black', kind: 'off', direction: 'counterclockwise', position: { clockwise: 0, counterclockwise: 0 }, checkers: [] }
    }
  } as unknown as BackgammonBoard;
}
