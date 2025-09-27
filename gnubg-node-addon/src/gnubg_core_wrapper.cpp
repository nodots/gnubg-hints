#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <cmath>

extern "C" {

// Include the real GNU Backgammon core API
#include "../include/gnubg_core.h"

// Basic types - must match GNU Backgammon exactly
typedef unsigned int TanBoard[2][25];

// Move structure
typedef struct {
    int anMove[8];
    float rScore;
    float rScore2;
    float arEvalMove[7];
} move;

// The actual GNU Backgammon functions are now implemented in lib/gnubg_core.c
// These extern declarations reference those implementations

}  // extern "C"