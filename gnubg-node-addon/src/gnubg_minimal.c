// Minimal GNU Backgammon wrapper for Node.js addon
// This file provides a minimal C interface to GNU Backgammon
// without requiring glib or other complex dependencies

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

// Basic types
typedef unsigned int TanBoard[2][25];

// Evaluation context
typedef struct {
    int nPlies;
    int fCubeful;
    int fUsePrune;
    float rNoise;
} evalcontext;

// Cube information
typedef struct {
    int nCube;
    int fCubeOwner;
    int fMove;
    int nMatchTo;
    int anScore[2];
    int fCrawford;
    int fJacoby;
    int fBeavers;
    int bgv;
} cubeinfo;

// Move structure
typedef struct {
    int anMove[8];
    float rScore;
    float rScore2;
    float arEvalMove[7];
} move;

// Move list
typedef struct {
    unsigned int cMoves;
    unsigned int cMaxMoves;
    int iMoveBest;
    move *amMoves;
} movelist;

// Placeholder implementations until we link the real GNU Backgammon functions
static void InitBoard(TanBoard anBoard, int bgv) {
    // Initialize board to starting position
    memset(anBoard, 0, sizeof(TanBoard));
    // Starting position checkers
    anBoard[0][6] = 5;  // White on 6-point
    anBoard[0][8] = 3;  // White on 8-point
    anBoard[0][13] = 5; // White on 13-point
    anBoard[0][24] = 2; // White on 24-point
    anBoard[1][6] = 5;  // Black on 6-point
    anBoard[1][8] = 3;  // Black on 8-point
    anBoard[1][13] = 5; // Black on 13-point
    anBoard[1][24] = 2; // Black on 24-point
}

static void PositionFromID(TanBoard anBoard, const char* pchEnc) {
    // For now, just initialize to starting position
    InitBoard(anBoard, 0);
}

static int GenerateMoves(movelist *pml, const TanBoard anBoard, int n0, int n1, int fPartial) {
    // Placeholder that generates dummy moves
    if (pml && pml->cMaxMoves > 0) {
        pml->cMoves = 2;
        pml->iMoveBest = 0;
        return 0;
    }
    return -1;
}

// Static initialization state
static int g_initialized = 0;
static evalcontext g_eval_context;

// Initialize GNU Backgammon
int gnubg_initialize() {
    if (g_initialized) {
        return 0;
    }

    // Set default evaluation context
    g_eval_context.nPlies = 2;
    g_eval_context.fCubeful = 1;
    g_eval_context.fUsePrune = 1;
    g_eval_context.rNoise = 0.0;

    g_initialized = 1;
    return 0;
}

// Shutdown GNU Backgammon
void gnubg_shutdown() {
    if (g_initialized) {
        g_initialized = 0;
    }
}

// Get move hints for a position
int gnubg_get_move_hints(const TanBoard board, const int dice[2], movelist* ml) {
    if (!g_initialized || !ml) {
        return -1;
    }

    // Generate moves using GNU Backgammon
    int result = GenerateMoves(ml, board, dice[0], dice[1], 0);

    // If generation failed, create some dummy moves for testing
    if (result < 0 && ml->cMaxMoves > 0) {
        ml->cMoves = 2;
        ml->iMoveBest = 0;

        // Dummy move 1
        ml->amMoves[0].anMove[0] = 24;
        ml->amMoves[0].anMove[1] = 24 - dice[0];
        ml->amMoves[0].anMove[2] = 13;
        ml->amMoves[0].anMove[3] = 13 - dice[1];
        for (int i = 4; i < 8; i++) ml->amMoves[0].anMove[i] = -1;
        ml->amMoves[0].rScore = 0.05f;

        // Dummy move 2
        if (ml->cMaxMoves > 1) {
            ml->amMoves[1].anMove[0] = 13;
            ml->amMoves[1].anMove[1] = 13 - dice[0];
            ml->amMoves[1].anMove[2] = 8;
            ml->amMoves[1].anMove[3] = 8 - dice[1];
            for (int i = 4; i < 8; i++) ml->amMoves[1].anMove[i] = -1;
            ml->amMoves[1].rScore = 0.03f;
        }

        return 0;
    }

    return result;
}

// Get hints from position ID
int gnubg_get_hints_from_position_id(const char* positionId, const int dice[2], movelist* ml) {
    if (!g_initialized || !ml || !positionId) {
        return -1;
    }

    // Convert position ID to board
    TanBoard board;
    PositionFromID(board, positionId);

    // Get move hints
    return gnubg_get_move_hints(board, dice, ml);
}

// Get double hint (placeholder)
int gnubg_get_double_hint(const TanBoard board, cubeinfo* ci, float* equity) {
    if (!g_initialized || !ci || !equity) {
        return -1;
    }

    // Placeholder implementation
    *equity = 0.0f;
    return 0;
}

// Get take hint (placeholder)
int gnubg_get_take_hint(const TanBoard board, cubeinfo* ci, float* takeEquity, float* dropEquity) {
    if (!g_initialized || !ci || !takeEquity || !dropEquity) {
        return -1;
    }

    // Placeholder implementation
    *takeEquity = 0.0f;
    *dropEquity = -1.0f;
    return 0;
}