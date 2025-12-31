import path from 'path'
import {
  BackgammonBoard,
  BackgammonColor,
  BackgammonMoveDirection,
} from '@nodots-llc/backgammon-types'

type CheckerLike = {
  color?: BackgammonColor
  id?: string
}

interface SimplifiedCheckerContainer {
  id?: string
  position?: {
    clockwise?: number
    counterclockwise?: number
  }
  checkers?: CheckerLike[]
}

interface SimplifiedBoard {
  id?: string
  points: SimplifiedCheckerContainer[]
  bar: {
    clockwise?: { checkers?: CheckerLike[] }
    counterclockwise?: { checkers?: CheckerLike[] }
  }
  off: {
    clockwise?: { checkers?: CheckerLike[] }
    counterclockwise?: { checkers?: CheckerLike[] }
  }
}

export type HintBoard = BackgammonBoard | SimplifiedBoard

// Native addon binding
const addon = require('../build/Release/gnubg_hints.node')
const DEFAULT_WEIGHTS_PATH =
  process.env.GNUBG_WEIGHTS_PATH ||
  path.resolve(__dirname, '..', '..', 'gnubg.weights')

// Canonical GNU orientation: player X moves in this direction in Nodots terms.
const GNUBG_X_DIRECTION: BackgammonMoveDirection = 'clockwise'

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
  board: HintBoard
  dice: [number, number]
  /**
   * The color of the player who is on roll. Required to correctly encode
   * board positions - GNU BG expects player 0 to be the player on roll.
   * When omitted, defaults to 'white' for backward compatibility.
   */
  activePlayerColor?: BackgammonColor
  /**
   * The movement direction of the player who is on roll.
   * Required for canonical GNU normalization.
   */
  activePlayerDirection: BackgammonMoveDirection
  cubeValue: number
  cubeOwner: BackgammonColor | null
  matchScore: [number, number]
  matchLength: number
  crawford: boolean
  jacoby: boolean
  beavers: boolean
}

/**
 * Evaluation output from GNU Backgammon neural network
 */
export interface Evaluation {
  win: number // Probability of winning
  winGammon: number // Probability of winning a gammon
  winBackgammon: number // Probability of winning a backgammon
  loseGammon: number // Probability of losing a gammon
  loseBackgammon: number // Probability of losing a backgammon
  equity: number // Position equity
  cubefulEquity?: number // Cubeful equity (if applicable)
}

/**
 * Move hint with evaluation
 */
export interface MoveHint {
  moves: MoveStep[]
  evaluation: Evaluation
  equity: number
  rank: number
  difference: number // Equity difference from best move
}

export interface MoveStep {
  from: number
  to: number
  moveKind: 'point-to-point' | 'reenter' | 'bear-off'
  isHit: boolean
  player: BackgammonColor
  fromContainer: 'bar' | 'point' | 'off'
  toContainer: 'bar' | 'point' | 'off'
}

/**
 * Doubling cube decision hint
 */
export interface DoubleHint {
  action: 'double' | 'no-double' | 'too-good' | 'beaver' | 'redouble'
  takePoint: number
  dropPoint: number
  evaluation: Evaluation
  cubefulEquity: number
}

/**
 * Take/Drop decision hint
 */
export interface TakeHint {
  action: 'take' | 'drop' | 'beaver'
  evaluation: Evaluation
  takeEquity: number
  dropEquity: number
}

/**
 * Decoded board position from a position ID
 * Index 0 = player X (clockwise in GNU BG convention)
 * Index 1 = player O (counterclockwise in GNU BG convention)
 * Each player has 25 values: positions 0-23 for points, 24 for bar
 */
export interface DecodedBoard {
  x: number[] // X player's checkers (25 values)
  o: number[] // O player's checkers (25 values)
}

/**
 * Configuration for the hint engine
 */
export interface HintConfig {
  evalPlies?: number // Evaluation depth (0-3)
  moveFilter?: MoveFilterSetting // Move filter level (Tiny..Huge)
  threadCount?: number // Number of threads for evaluation
  usePruning?: boolean // Use pruning neural networks
  noise?: number // Evaluation noise (0.0 = deterministic)
}

type PointCounts = { white: number; black: number }
type PhysicalCounts = {
  points: PointCounts[]
  bar: PointCounts
  off: PointCounts
}

type GnubgNormalization = {
  activePlayerColor: BackgammonColor
  activePlayerDirection: BackgammonMoveDirection
  boardReversed: boolean
}

/**
 * GNU Backgammon hint engine
 */
export class GnuBgHints {
  private static initialized = false
  private static config: HintConfig = {
    evalPlies: 2,
    moveFilter: MoveFilterSetting.Normal,
    threadCount: 1,
    usePruning: true,
    noise: 0.0,
  }

  /**
   * Initialize the hint engine with neural network weights
   */
  static async initialize(weightsPath?: string): Promise<void> {
    if (this.initialized) {
      return
    }

    return new Promise((resolve, reject) => {
      addon.initialize(weightsPath || DEFAULT_WEIGHTS_PATH, (err: Error | null) => {
        if (err) {
          reject(err)
        } else {
          this.initialized = true
          resolve()
        }
      })
    })
  }

  /**
   * Configure the hint engine
   */
  static configure(config: Partial<HintConfig>): void {
    this.config = { ...this.config, ...config }
    addon.configure(this.config)
  }

  /**
   * Get move hints directly from GNU Backgammon position ID and dice roll.
   *
   * IMPORTANT: Position IDs use canonical encoding (clockwise=X, counterclockwise=O).
   * If the counterclockwise player is on roll, pass activePlayerDirection='counterclockwise'
   * so the position can be re-encoded with the correct player on roll.
   *
   * @param positionId The GNU BG position ID (canonical format)
   * @param dice The dice roll [die1, die2]
   * @param maxHints Maximum number of hints to return (default 5)
   * @param activePlayerDirection Direction of the player on roll (default 'clockwise')
   * @param activePlayerColor Color of the player on roll (optional, used for hint normalization)
   */
  static async getHintsFromPositionId(
    positionId: string,
    dice: [number, number],
    maxHints: number = 5,
    activePlayerDirection: BackgammonMoveDirection = 'clockwise',
    activePlayerColor?: BackgammonColor
  ): Promise<MoveHint[]> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.')
    }
    if (typeof positionId !== 'string' || positionId.length !== 14) {
      throw new Error('Invalid position ID')
    }

    // Decode the position to get checker arrays
    const decoded = this.decodePositionId(positionId)

    // If clockwise player is on roll, we need to swap the perspective
    // Our canonical encoding: X = clockwise, O = counterclockwise
    // GNU BG hint core expects player-on-roll in index 1 (O)
    // So if clockwise is on roll, swap the arrays to move them to index 1
    let effectivePositionId = positionId
    if (activePlayerDirection === 'clockwise') {
      // Swap X and O: clockwise player moves to O (index 1, on roll)
      // getPositionId expects TanBoard format: [[...x], [...o]]
      const swappedBoard = [decoded.o, decoded.x]
      effectivePositionId = addon.getPositionId(swappedBoard)
      console.log('[gnubg-hints] getHintsFromPositionId: Swapped for clockwise player on roll')
      console.log('[gnubg-hints]   Original posId:', positionId)
      console.log('[gnubg-hints]   Swapped posId:', effectivePositionId)
    }

    return new Promise((resolve, reject) => {
      // Create minimal request object with just position ID and dice
      const request = {
        positionId: effectivePositionId,
        dice: dice,
        cubeValue: 1,
        cubeOwner: -1,
        matchScore: [0, 0],
        matchLength: 7,
        crawford: false,
        jacoby: false,
        beavers: false,
      } as const

      addon.getMoveHints(
        request,
        maxHints,
        (error: Error | null, results: any[]) => {
          if (error) {
            reject(error)
            return
          }
          // Normalization should match the effective player on roll
          const normalization: GnubgNormalization = {
            activePlayerColor: activePlayerColor ?? 'white',
            activePlayerDirection,
            boardReversed: false,
          }
          resolve(this.convertHintsFromGnuBg(results, undefined, normalization))
        }
      )
    })
  }

  /**
   * Get move hints for a given position and dice roll
   */
  static async getMoveHints(
    request: HintRequest,
    maxHints: number = 10
  ): Promise<MoveHint[]> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.')
    }

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'))
    }

    const activePlayerColor = request.activePlayerColor ?? 'white'
    const activePlayerDirection = request.activePlayerDirection
    if (!activePlayerDirection) {
      return Promise.reject(
        new Error('activePlayerDirection is required for GNU normalization')
      )
    }

    return new Promise((resolve, reject) => {
      // Convert board to GNU Backgammon format using active player's perspective
      const { gnubgBoard, normalization } = this.convertBoardToGnuBg(
        request.board,
        activePlayerColor,
        activePlayerDirection
      )

      addon.getMoveHints(
        {
          board: gnubgBoard,
          dice: request.dice,
          cubeValue: request.cubeValue,
          cubeOwner: this.normalizeCubeOwner(
            request.cubeOwner,
            activePlayerColor
          ),
          matchScore: this.normalizeMatchScore(
            request.matchScore,
            activePlayerColor
          ),
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers,
        },
        maxHints,
        (err: Error | null, hints: any[]) => {
          if (err) {
            reject(err)
          } else {
            resolve(
              this.convertHintsFromGnuBg(hints, request.board, normalization)
            )
          }
        }
      )
    })
  }

  /**
   * Get doubling decision hint
   */
  static async getDoubleHint(request: HintRequest): Promise<DoubleHint> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.')
    }

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'))
    }

    const activePlayerColor = request.activePlayerColor ?? 'white'
    const activePlayerDirection = request.activePlayerDirection
    if (!activePlayerDirection) {
      return Promise.reject(
        new Error('activePlayerDirection is required for GNU normalization')
      )
    }

    return new Promise((resolve, reject) => {
      const { gnubgBoard } = this.convertBoardToGnuBg(
        request.board,
        activePlayerColor,
        activePlayerDirection
      )

      addon.getDoubleHint(
        {
          board: gnubgBoard,
          cubeValue: request.cubeValue,
          cubeOwner: this.normalizeCubeOwner(
            request.cubeOwner,
            activePlayerColor
          ),
          matchScore: this.normalizeMatchScore(
            request.matchScore,
            activePlayerColor
          ),
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers,
        },
        (err: Error | null, hint: any) => {
          if (err) {
            reject(err)
          } else {
            resolve(this.convertDoubleHintFromGnuBg(hint))
          }
        }
      )
    })
  }

  /**
   * Get take/drop decision hint
   */
  static async getTakeHint(request: HintRequest): Promise<TakeHint> {
    if (!this.initialized) {
      throw new Error('GnuBgHints not initialized. Call initialize() first.')
    }

    if (!request?.board || typeof request.board !== 'object') {
      return Promise.reject(new Error('Invalid board data'))
    }

    const activePlayerColor = request.activePlayerColor ?? 'white'
    const activePlayerDirection = request.activePlayerDirection
    if (!activePlayerDirection) {
      return Promise.reject(
        new Error('activePlayerDirection is required for GNU normalization')
      )
    }

    return new Promise((resolve, reject) => {
      const { gnubgBoard } = this.convertBoardToGnuBg(
        request.board,
        activePlayerColor,
        activePlayerDirection
      )

      addon.getTakeHint(
        {
          board: gnubgBoard,
          cubeValue: request.cubeValue,
          cubeOwner: this.normalizeCubeOwner(
            request.cubeOwner,
            activePlayerColor
          ),
          matchScore: this.normalizeMatchScore(
            request.matchScore,
            activePlayerColor
          ),
          matchLength: request.matchLength,
          crawford: request.crawford,
          jacoby: request.jacoby,
          beavers: request.beavers,
        },
        (err: Error | null, hint: any) => {
          if (err) {
            reject(err)
          } else {
            resolve(this.convertTakeHintFromGnuBg(hint))
          }
        }
      )
    })
  }

  /**
   * Shutdown the hint engine and free resources
   */
  static shutdown(): void {
    if (this.initialized) {
      addon.shutdown()
      this.initialized = false
    }
  }

/**
   * Decode a GNU Backgammon position ID to a board array.
   * Returns the raw decoded position where:
   * - Index 0 (X) represents the clockwise player's perspective
   * - Index 1 (O) represents the counterclockwise player's perspective
   * - Positions 0-23 are board points, 24 is the bar
   *
   * @param positionId 14-character GNU position ID
   * @returns Decoded board with X and O checker counts
   * @throws Error if position ID is invalid
   */
  static decodePositionId(positionId: string): DecodedBoard {
    const board: number[][] = addon.decodePositionId(positionId)
    return {
      x: board[0],
      o: board[1],
    }
  }

  /**
   * Get GNU Backgammon position ID for a board position.
   * This uses the original GNU Backgammon encoding algorithm via native addon.
   * @param board The board to encode
   * @param activePlayerColor The color of the player on roll
   * @param activePlayerDirection The direction the active player moves
   * @returns 14-character position ID string valid in GNU Backgammon
   */
  static getPositionId(
    board: HintBoard,
    activePlayerColor: BackgammonColor,
    activePlayerDirection: BackgammonMoveDirection
  ): string {
    // Position ID uses CANONICAL encoding (always clockwise=X perspective)
    // We need to know which color is clockwise to encode correctly
    const gnubgBoard = this.buildCanonicalBoard(
      board,
      activePlayerColor,
      activePlayerDirection
    )
    const positionId = addon.getPositionId(gnubgBoard)

    // DIAGNOSTIC: Always log position ID generation for debugging (unconditional)
    const xNonZero = gnubgBoard[0].map((c, i) => ({ idx: i, count: c })).filter(x => x.count > 0)
    const oNonZero = gnubgBoard[1].map((c, i) => ({ idx: i, count: c })).filter(x => x.count > 0)
    console.log('[gnubg-hints] getPositionId: posId=' + positionId + ', activeColor=' + activePlayerColor + ', dir=' + activePlayerDirection)
    console.log('[gnubg-hints] getPositionId X (cw): ' + JSON.stringify(xNonZero))
    console.log('[gnubg-hints] getPositionId O (ccw): ' + JSON.stringify(oNonZero))

    return positionId
  }

  /**
   * Build a canonical GNU BG board representation for position ID.
   * Always uses fixed perspective: X = clockwise player, O = counterclockwise player.
   * This produces the same position ID regardless of who's on roll.
   *
   * TanBoard format: each player's array is from their OWN perspective.
   * - TanBoard[0][i] = X's (clockwise) checkers at X's (i+1) point
   * - TanBoard[1][i] = O's (counterclockwise) checkers at O's (i+1) point
   */
  private static buildCanonicalBoard(
    board: HintBoard,
    activePlayerColor: BackgammonColor,
    activePlayerDirection: BackgammonMoveDirection
  ): number[][] {
    const gnubgBoard: number[][] = [
      new Array(25).fill(0),
      new Array(25).fill(0),
    ]

    const counts = this.buildPhysicalCounts(board)

    // Determine which color is clockwise vs counterclockwise
    const clockwiseColor =
      activePlayerDirection === 'clockwise' ? activePlayerColor : this.oppositeColor(activePlayerColor)
    const counterclockwiseColor = this.oppositeColor(clockwiseColor)

    // Get checker counts by direction (not by fixed white/black)
    const cwCheckers = counts.points.map((p) =>
      clockwiseColor === 'white' ? p.white : p.black
    )
    const ccwCheckers = counts.points.map((p) =>
      counterclockwiseColor === 'white' ? p.white : p.black
    )

    // X = clockwise player: physical cw index maps directly (no transform)
    cwCheckers.forEach((count, i) => {
      gnubgBoard[0][i] = count
    })

    // O = counterclockwise player: mirror physical positions to O's perspective
    // Physical cw(i+1) = O's ccw(24-i), so reverse the array
    const ccwMirrored = ccwCheckers.slice().reverse()
    ccwMirrored.forEach((count, i) => {
      gnubgBoard[1][i] = count
    })

    // Bar - get by direction
    const cwBar =
      clockwiseColor === 'white' ? counts.bar.white : counts.bar.black
    const ccwBar =
      counterclockwiseColor === 'white' ? counts.bar.white : counts.bar.black
    gnubgBoard[0][24] = cwBar
    gnubgBoard[1][24] = ccwBar

    // DIAGNOSTIC: Log canonical board encoding
    if (process.env.NDBG_AI_TRACE === '1') {
      const xTotal = gnubgBoard[0].reduce((a, b) => a + b, 0)
      const oTotal = gnubgBoard[1].reduce((a, b) => a + b, 0)
      console.log('[gnubg-hints][TRACE] buildCanonicalBoard: xTotal=' + xTotal + ', oTotal=' + oTotal + ', cwColor=' + clockwiseColor + ', ccwColor=' + counterclockwiseColor)
    }

    return gnubgBoard
  }

  private static oppositeColor(color: BackgammonColor): BackgammonColor {
    return color === 'white' ? 'black' : 'white'
  }

  private static countColors(checkers: CheckerLike[]): PointCounts {
    const counts: PointCounts = { white: 0, black: 0 }
    for (const checker of checkers) {
      if (checker?.color === 'white') counts.white += 1
      if (checker?.color === 'black') counts.black += 1
    }
    return counts
  }

  private static getPhysicalPointIndex(
    point: SimplifiedCheckerContainer
  ): number | null {
    const position = point.position
    const clockwise = position?.clockwise
    if (typeof clockwise === 'number') {
      return clockwise
    }
    const counter = position?.counterclockwise
    if (typeof counter === 'number') {
      return 25 - counter
    }
    return null
  }

  private static buildPhysicalCounts(board: HintBoard): PhysicalCounts {
    const points: PointCounts[] = Array.from({ length: 24 }, () => ({
      white: 0,
      black: 0,
    }))

    const rawPoints: SimplifiedCheckerContainer[] = Array.isArray(
      (board as any)?.points
    )
      ? (board as any).points
      : []

    for (const point of rawPoints) {
      const index = this.getPhysicalPointIndex(point)
      if (!index || index < 1 || index > 24) {
        continue
      }
      const checkers = Array.isArray(point.checkers) ? point.checkers : []
      const counts = this.countColors(checkers)
      points[index - 1].white += counts.white
      points[index - 1].black += counts.black
    }

    const barClockwise = Array.isArray((board as any)?.bar?.clockwise?.checkers)
      ? (board as any).bar.clockwise.checkers
      : []
    const barCounter = Array.isArray((board as any)?.bar?.counterclockwise?.checkers)
      ? (board as any).bar.counterclockwise.checkers
      : []
    const bar = this.countColors([...barClockwise, ...barCounter])

    const offClockwise = Array.isArray((board as any)?.off?.clockwise?.checkers)
      ? (board as any).off.clockwise.checkers
      : []
    const offCounter = Array.isArray((board as any)?.off?.counterclockwise?.checkers)
      ? (board as any).off.counterclockwise.checkers
      : []
    const off = this.countColors([...offClockwise, ...offCounter])

    return { points, bar, off }
  }

  /**
   * Convert BackgammonBoard to GNU Backgammon format (2D array)
   * GNU BG uses: [2][25] array where [1] is player on roll, [0] is opponent
   * Indices 0-23 map to physical board points 1-24; index 24 stores the bar.
   */
  private static convertBoardToGnuBg(
    board: HintBoard,
    activePlayerColor: BackgammonColor,
    activePlayerDirection: BackgammonMoveDirection
  ): { gnubgBoard: number[][]; normalization: GnubgNormalization } {
    const gnubgBoard: number[][] = [
      new Array(25).fill(0),
      new Array(25).fill(0),
    ]

    const counts = this.buildPhysicalCounts(board)
    const rollIsWhite = activePlayerColor === 'white'
    const opponentColor = rollIsWhite ? 'black' : 'white'
    const opponentDirection =
      activePlayerDirection === 'clockwise' ? 'counterclockwise' : 'clockwise'

    // DIAGNOSTIC: Log physical counts for debugging
    if (process.env.NDBG_AI_TRACE === '1') {
      const nonZeroPoints = counts.points
        .map((p, i) => ({ pos: i + 1, white: p.white, black: p.black }))
        .filter((p) => p.white > 0 || p.black > 0)
      console.log('[gnubg-hints][TRACE] buildPhysicalCounts result:', {
        rollIsWhite,
        activePlayerColor,
        activePlayerDirection,
        nonZeroPoints,
        bar: counts.bar,
      })
    }

    // Build checker arrays in physical clockwise order (index 0-23)
    const activePhysical = counts.points.map((p) =>
      rollIsWhite ? p.white : p.black
    )
    const opponentPhysical = counts.points.map((p) =>
      opponentColor === 'white' ? p.white : p.black
    )

    // GNU BG expects each player array in their own perspective.
    // Player on roll (index 1) uses their movement direction as-is.
    const activeNormalized =
      activePlayerDirection === 'clockwise'
        ? activePhysical
        : activePhysical.slice().reverse()
    const opponentNormalized =
      opponentDirection === 'clockwise'
        ? opponentPhysical
        : opponentPhysical.slice().reverse()

    opponentNormalized.forEach((count, i) => {
      gnubgBoard[0][i] = count
    })
    activeNormalized.forEach((count, i) => {
      gnubgBoard[1][i] = count
    })

    // Bar: active player's bar checkers, opponent's bar checkers
    const barActive = rollIsWhite ? counts.bar.white : counts.bar.black
    const barOpponent = rollIsWhite ? counts.bar.black : counts.bar.white
    gnubgBoard[1][24] = barActive
    gnubgBoard[0][24] = barOpponent

    // DIAGNOSTIC: Log final gnubgBoard for debugging
    if (process.env.NDBG_AI_TRACE === '1') {
      const xNonZero = gnubgBoard[0]
        .map((count, i) => ({ idx: i, count }))
        .filter((p) => p.count > 0)
      const oNonZero = gnubgBoard[1]
        .map((count, i) => ({ idx: i, count }))
        .filter((p) => p.count > 0)
      const xTotal = gnubgBoard[0].reduce((a, b) => a + b, 0)
      const oTotal = gnubgBoard[1].reduce((a, b) => a + b, 0)
      console.log(`[gnubg-hints][TRACE] gnubgBoard: xTotal=${xTotal}, oTotal=${oTotal}, rollIsWhite=${rollIsWhite}`)
      console.log(`[gnubg-hints][TRACE] X: ${JSON.stringify(xNonZero)}`)
      console.log(`[gnubg-hints][TRACE] O: ${JSON.stringify(oNonZero)}`)
    }

    return {
      gnubgBoard,
      normalization: {
        activePlayerColor,
        activePlayerDirection,
        boardReversed: false,
      },
    }
  }

  private static normalizeMatchScore(
    matchScore: [number, number],
    activePlayerColor: BackgammonColor
  ): [number, number] {
    const whiteScore = matchScore[0] ?? 0
    const blackScore = matchScore[1] ?? 0
    if (activePlayerColor === 'black') {
      return [whiteScore, blackScore]
    }
    return [blackScore, whiteScore]
  }

  private static normalizeCubeOwner(
    cubeOwner: BackgammonColor | null,
    activePlayerColor: BackgammonColor
  ): number {
    if (!cubeOwner) {
      return -1
    }
    return cubeOwner === activePlayerColor ? 1 : 0
  }

  /**
   * Convert GNU Backgammon hints to MoveHint format
   */
  private static convertHintsFromGnuBg(
    gnubgHints: any[],
    board?: HintBoard,
    normalization?: GnubgNormalization
  ): MoveHint[] {
    if (!normalization) {
      return []
    }
    const baseEquity =
      Array.isArray(gnubgHints) && gnubgHints.length > 0
        ? (gnubgHints[0].equity ?? 0)
        : 0

    return (Array.isArray(gnubgHints) ? gnubgHints : []).map((hint, index) => ({
      moves: this.convertMovesFromGnuBg(hint?.moves, board, normalization),
      evaluation: this.normalizeEvaluation(hint?.evaluation),
      equity: hint?.equity ?? 0,
      rank: index + 1,
      difference: index === 0 ? 0 : (hint?.equity ?? 0) - baseEquity,
    }))
  }

  /**
   * Convert GNU Backgammon move format to BackgammonMove
   * GNU BG returns positions from the active player's perspective (0-23 for points, 24 for bar, -1 for off)
   * We convert these to 1-24 positions in the active player's directional coordinate system.
   */
  private static convertMovesFromGnuBg(
    gnubgMoves: any,
    board?: HintBoard,
    normalization?: GnubgNormalization
  ): MoveStep[] {
    if (!normalization) {
      return []
    }
    const normalizedMoves = this.normalizeGnuBgMoves(gnubgMoves)

    // DIAGNOSTIC: Log raw moves before conversion
    if (process.env.NDBG_AI_TRACE === '1') {
      console.log('[gnubg-hints][TRACE] RAW moves from GNU:', JSON.stringify(normalizedMoves), 'boardReversed=' + normalization.boardReversed)
    }

    return normalizedMoves.map(([rawFrom, rawTo]) => {
      const displayFrom = this.mapGnuIndexToPlayerPosition(rawFrom, normalization)
      const displayTo = this.mapGnuIndexToPlayerPosition(rawTo, normalization)
      // The moves are for the active player who was on roll
      return {
        from: displayFrom,
        to: displayTo,
        moveKind: this.determineMoveKind(rawFrom, rawTo),
        isHit: this.isHitMove(
          displayTo,
          normalization.activePlayerColor,
          normalization.activePlayerDirection,
          board
        ),
        player: normalization.activePlayerColor,
        fromContainer: this.resolveContainerKind(rawFrom),
        toContainer: this.resolveContainerKind(rawTo),
      }
    })
  }

  private static normalizeGnuBgMoves(rawMoves: any): Array<[number, number]> {
    if (!Array.isArray(rawMoves)) {
      return []
    }

    if (rawMoves.length > 0 && Array.isArray(rawMoves[0])) {
      return (rawMoves as Array<[number, number]>).filter(
        ([from, to]) =>
          Number.isFinite(from) && Number.isFinite(to) && from >= 0
      )
    }

    const flatMoves = rawMoves as number[]
    const result: Array<[number, number]> = []

    for (let i = 0; i < flatMoves.length; i += 2) {
      const from = flatMoves[i]
      const to = flatMoves[i + 1]
      if (from === undefined || to === undefined || from < 0) {
        break
      }
      result.push([from, to])
    }

    return result
  }

  private static mapGnuIndexToPlayerPosition(
    index: number,
    normalization: GnubgNormalization
  ): number {
    if (index < 0 || index >= 24) {
      return 0
    }

    // GNU hints return coordinates from the player-on-roll perspective.
    // We encode the active player's checkers at their directional positions:
    //   gnubgBoard[1][i] = active player's checkers at their (i+1) point
    // So GNU index i corresponds directly to the active player's (i+1) point
    // No conversion needed - just add 1 to convert from 0-based to 1-based
    return index + 1
  }

  private static determineMoveKind(
    from: number,
    to: number
  ): MoveStep['moveKind'] {
    if (from === 24) {
      return 'reenter'
    }

    if (to < 0) {
      return 'bear-off'
    }

    return 'point-to-point'
  }

  private static resolveContainerKind(
    index: number
  ): MoveStep['fromContainer'] {
    if (index === 24) {
      return 'bar'
    }
    if (index < 0) {
      return 'off'
    }
    return 'point'
  }

  private static isHitMove(
    to: number,
    player: BackgammonColor,
    direction: BackgammonMoveDirection,
    board?: HintBoard
  ): boolean {
    if (!board || to <= 0 || to > 24) {
      return false
    }

    const opponent: BackgammonColor = player === 'white' ? 'black' : 'white'
    const destination = this.findPointByDirection(to, direction, board)

    if (!destination || !Array.isArray(destination.checkers)) {
      return false
    }

    const opponentCheckers = destination.checkers.filter(
      (checker) => checker?.color === opponent
    )
    return opponentCheckers.length === 1
  }

  private static findPointByDirection(
    index: number,
    direction: BackgammonMoveDirection,
    board: HintBoard
  ): SimplifiedCheckerContainer | null {
    if (!board || index <= 0 || index > 24) {
      return null
    }

    const points: SimplifiedCheckerContainer[] = Array.isArray(
      (board as any)?.points
    )
      ? (board as any).points
      : []

    if (direction === 'clockwise') {
      return points.find((point) => point.position?.clockwise === index) ?? null
    }

    return points.find((point) => point.position?.counterclockwise === index) ?? null
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
        cubefulEquity: rawEvaluation[6],
      }
    }

    if (rawEvaluation && typeof rawEvaluation === 'object') {
      return {
        win: rawEvaluation.win ?? 0,
        winGammon: rawEvaluation.winGammon ?? 0,
        winBackgammon: rawEvaluation.winBackgammon ?? 0,
        loseGammon: rawEvaluation.loseGammon ?? 0,
        loseBackgammon: rawEvaluation.loseBackgammon ?? 0,
        equity: rawEvaluation.equity ?? 0,
        cubefulEquity: rawEvaluation.cubefulEquity,
      }
    }

    return {
      win: 0,
      winGammon: 0,
      winBackgammon: 0,
      loseGammon: 0,
      loseBackgammon: 0,
      equity: 0,
      cubefulEquity: 0,
    }
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
      cubefulEquity: gnubgHint.cubefulEquity,
    }
  }

  /**
   * Convert GNU Backgammon take hint
   */
  private static convertTakeHintFromGnuBg(gnubgHint: any): TakeHint {
    return {
      action: gnubgHint.action,
      evaluation: this.normalizeEvaluation(gnubgHint.evaluation),
      takeEquity: gnubgHint.takeEquity,
      dropEquity: gnubgHint.dropEquity,
    }
  }
}

export type { GameHintContextOverrides } from './integration/backgammon-core'

export {
  createHintRequestFromGame,
  deriveCubeOwner,
  deriveCubeValue,
  deriveDiceFromGame,
  deriveMatchLength,
  deriveMatchScore,
} from './integration/backgammon-core'

// Export default instance
export default GnuBgHints
