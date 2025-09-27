#ifndef GNUBG_CORE_H
#define GNUBG_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

/* Public API for GNU Backgammon core engine */

/* Initialize the engine */
int gnubg_initialize(void);

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

#ifdef __cplusplus
}
#endif

#endif /* GNUBG_CORE_H */
