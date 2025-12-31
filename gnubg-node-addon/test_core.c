#include "include/gnubg_core.h"
#include "include/eval.h"
#include <stdio.h>

int main() {
    printf("Testing GNU Backgammon core extraction...\n");

    // Test initialization
    if (gnubg_initialize("../gnubg.weights") != 0) {
        printf("Failed to initialize GNU Backgammon core\n");
        return 1;
    }

    // Test board (simple starting position)
    int board[2][25] = {0};
    board[0][24] = 2;  // 2 white checkers on point 24
    board[0][13] = 5;  // 5 white checkers on point 13
    board[0][8] = 3;   // 3 white checkers on point 8
    board[0][6] = 5;   // 5 white checkers on point 6

    board[1][1] = 2;   // 2 black checkers on point 1
    board[1][12] = 5;  // 5 black checkers on point 12
    board[1][17] = 3;  // 3 black checkers on point 17
    board[1][19] = 5;  // 5 black checkers on point 19

    // Test dice
    int dice[2] = {3, 4};

    // Test hint functions
    printf("\n--- Testing Hint Functions ---\n");

    move moves[5];
    cubeinfo ci;
    int scores[2] = {0, 0};
    SetCubeInfo(&ci, 1, -1, 0, 0, scores, 0, 0, 0, bgvDefault);
    float take_drop[2] = {0.0f, 0.0f};
    float equity = 0.0f;

    gnubg_hint_move(board, dice, moves, 5);
    gnubg_hint_double(board, &ci, &equity);
    gnubg_hint_take(board, &ci, take_drop);

    // Test shutdown
    gnubg_shutdown();

    printf("\nAll tests completed successfully!\n");
    return 0;
}
