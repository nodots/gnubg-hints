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

/* Get resignation verdict (gnubg's own getResignation +
 * getResignEquities). hint_out points to 3 floats:
 *   [0] resigned_points: 0 = no resignation warranted,
 *                        1/2/3 = single/gammon/backgammon
 *   [1] equity_before:   resigner's equity playing on (0 when no resignation)
 *   [2] equity_after:    resigner's equity after the concession (0 when none)
 * Returns `nResigned` (0=none, 1/2/3=single/gammon/backgammon), or < 0 on error.
 * NOT a cubedecision enum int — do not switch it through the cubedecision
 * switch. The resigner must be the on-roll player (fMoveOverride:1), matching
 * gnubg's own pattern (play.c / rollout.c). */
int gnubg_hint_resign(
    TanBoard board,      /* Board position */
    void* cube_info,     /* Cube information */
    void* hint_out       /* Output: float[3] as documented above */
);

/* Evaluate the DECIDER's equities for a specific offered concession.
 * getResignEquities (vendor/core/rollout.c) answers for the on-roll seat;
 * callers must declare the resigner as the on-roll player (fMoveOverride:1).
 * hint_out points to 3 floats:
 *   [0] equity_before: decider's equity playing on
 *   [1] equity_after:  decider's equity after conceding nResigned
 *   [2] accept:        gnubg's accept/reject verdict (1 = accept, 0 = reject)
 * Returns 0 on success, < 0 on error. nResigned must be 1/2/3. */
int gnubg_hint_resign_offered(
    TanBoard board,
    void* cube_info,
    int nResigned,       /* Offered concession: 1/2/3 */
    void* hint_out       /* Output: float[3] as documented above */
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
