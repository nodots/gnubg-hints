#ifndef GNUBG_CORE_H
#define GNUBG_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

/* Public API for GNU Backgammon core engine */

/* Initialize the engine with optional weights path (can be NULL/empty) */
int gnubg_initialize(const char* weights_path);

/* Configure evaluation settings */
void gnubg_configure(int eval_plies, int move_filter, int use_pruning, double noise, int thread_count);

/* Shutdown and free resources */
void gnubg_shutdown(void);

/* Board type definition - match GNU Backgammon */
typedef unsigned int TanBoard[2][25];

/* Get move hints for position with dice roll */
int gnubg_hint_move(
    TanBoard board,      /* Board position */
    int dice[2],         /* Dice values */
    void* hints_out,     /* Output hints array */
    int max_hints        /* Maximum number of hints */
);

/* Get move hints with explicit cube info (NULL uses default cubeless) */
int gnubg_hint_move_with_cube(
    TanBoard board,      /* Board position */
    int dice[2],         /* Dice values */
    void* hints_out,     /* Output hints array */
    int max_hints,       /* Maximum number of hints */
    void* cube_info      /* Cube information (cubeinfo*) */
);

/* Get doubling decision */
int gnubg_hint_double(
    TanBoard board,      /* Board position */
    void* cube_info,     /* Cube information */
    void* hint_out       /* Output hint */
);

/* Get take/drop decision */
int gnubg_hint_take(
    TanBoard board,      /* Board position */
    void* cube_info,     /* Cube information */
    void* hint_out       /* Output hint */
);

/* Get GNU Backgammon position ID (14-char string) */
const char* gnubg_position_id(const TanBoard board);

/* Decode GNU Backgammon position ID to board
 * Returns 1 on success, 0 on failure */
int gnubg_position_from_id(TanBoard board, const char *positionId);

#ifdef __cplusplus
}
#endif

#endif /* GNUBG_CORE_H */
