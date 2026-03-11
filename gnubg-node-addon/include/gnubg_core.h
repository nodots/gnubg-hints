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

/* --- Performance Rating (PR) calculation --- */

/* Rating categories from worst to best */
typedef enum {
    GNUBG_RAT_AWFUL = 0,
    GNUBG_RAT_BEGINNER,
    GNUBG_RAT_CASUAL_PLAYER,
    GNUBG_RAT_INTERMEDIATE,
    GNUBG_RAT_ADVANCED,
    GNUBG_RAT_EXPERT,
    GNUBG_RAT_WORLD_CLASS,
    GNUBG_RAT_SUPERNATURAL,
    GNUBG_RAT_UNDEFINED
} gnubg_ratingtype;

/* Relative FIBS rating from error rate and sample size.
 * r = error rate (0..1), n = number of games. */
float gnubg_relative_fibs_rating(float r, int n);

/* Rating loss from checker play errors.
 * rChequer = error per move, n = number of games. */
float gnubg_absolute_fibs_rating_chequer(float rChequer, int n);

/* Rating loss from cube decision errors.
 * rCube = error per cube decision, n = number of games. */
float gnubg_absolute_fibs_rating_cube(float rCube, int n);

/* Combined absolute FIBS rating estimate.
 * rChequer = error per move, rCube = error per cube decision,
 * n = number of games, rOffset = base rating offset. */
float gnubg_absolute_fibs_rating(float rChequer, float rCube, int n, float rOffset);

/* Map error rate to rating category. */
gnubg_ratingtype gnubg_get_rating(float rError);

/* Get human-readable name for a rating category. */
const char* gnubg_rating_name(gnubg_ratingtype rating);

#ifdef __cplusplus
}
#endif

#endif /* GNUBG_CORE_H */
