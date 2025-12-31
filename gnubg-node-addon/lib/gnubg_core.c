#include "config.h"
#include "gnubg_core.h"
#include "eval.h"
#include "positionid.h"
#include "matchequity.h"
#include "util.h"
#include "glib-ext.h"
#include "multithread.h"
#include "output.h"
#include <glib.h>
#include <string.h>
#include <stdlib.h>

typedef int (*cfunc)(const void *, const void *);

static int g_initialized = 0;
static evalcontext g_eval_context;
static movefilter g_move_filter[MAX_FILTER_PLIES][MAX_FILTER_PLIES];
int fAnalysisRunning = FALSE;

static void ensure_thread_local_data(void) {
#if defined(USE_MULTITHREAD)
    if (!g_private_get(td.tlsItem)) {
        TLSSetValue(td.tlsItem, (size_t) MT_CreateThreadLocalData(-1));
    }
#else
    if (!td.tld) {
        td.tld = MT_CreateThreadLocalData(-1);
    }
#endif
}

static int clamp_int(int value, int min_value, int max_value) {
    if (value < min_value)
        return min_value;
    if (value > max_value)
        return max_value;
    return value;
}

static void set_data_dirs_from_weights(const char *weights_path) {
    if (!weights_path || !weights_path[0])
        return;

    char *dir = g_path_get_dirname(weights_path);
    if (datadir)
        g_free(datadir);
    datadir = g_strdup(dir);
    if (pkg_datadir)
        g_free(pkg_datadir);
    pkg_datadir = g_strdup(dir);
    g_free(dir);
}

int gnubg_initialize(const char *weights_path) {
    if (g_initialized)
        return 0;

    output_initialize();
    glib_ext_init();

    set_data_dirs_from_weights(weights_path);

    char *met = BuildFilename2("met", "Kazaross-XG2.xml");
    InitMatchEquity(met);
    g_free(met);

    char *weights = NULL;
    if (weights_path && weights_path[0]) {
        weights = g_strdup(weights_path);
    } else {
        weights = BuildFilename("gnubg.weights");
    }
    char *weights_binary = BuildFilename("gnubg.wd");

    EvalInitialise(weights, weights_binary, FALSE, NULL);

    /* EvalInitialise sets neural net sizes needed by thread-local buffers. */
    MT_InitThreads();

    g_free(weights);
    g_free(weights_binary);

    g_eval_context = ecBasic;
    g_eval_context.fCubeful = TRUE;
    g_eval_context.nPlies = 2;
    g_eval_context.fUsePrune = TRUE;
    g_eval_context.rNoise = 0.0f;
    g_eval_context.fDeterministic = TRUE;
    memcpy(g_move_filter, aaamfMoveFilterSettings[SETTINGS_INTERMEDIATE], sizeof(g_move_filter));

    g_initialized = 1;
    return 0;
}

void gnubg_configure(int eval_plies, int move_filter, int use_pruning, double noise, int thread_count) {
    int plies = clamp_int(eval_plies, 0, MAX_FILTER_PLIES);
    int filter_index = clamp_int(move_filter, 0, NUM_MOVEFILTER_SETTINGS - 1);
    int threads = clamp_int(thread_count, 0, MAX_NUMTHREADS);

    g_eval_context.fCubeful = TRUE;
    g_eval_context.nPlies = plies;
    g_eval_context.fUsePrune = use_pruning ? TRUE : FALSE;
    g_eval_context.rNoise = (float)noise;
    g_eval_context.fDeterministic = (noise <= 0.0);

    memcpy(g_move_filter, aaamfMoveFilterSettings[filter_index], sizeof(g_move_filter));

    if (threads > 0) {
        MT_SetNumThreads((unsigned int)threads);
    }
}

void gnubg_shutdown(void) {
    if (!g_initialized)
        return;

    /* MT_Close/EvalShutdown crash in embedded use; skip to keep teardown safe. */
    /* MT_Close(); */
    /* EvalShutdown(); */

    g_initialized = 0;
}

int gnubg_hint_move_with_cube(TanBoard board, int dice[2], void *hints_out, int max_hints, void *cube_info) {
    if (!g_initialized || !hints_out || max_hints <= 0)
        return -1;

    ensure_thread_local_data();

    movelist ml;
    memset(&ml, 0, sizeof(ml));

    cubeinfo ci = ciCubeless;
    if (cube_info) {
        ci = *(cubeinfo *)cube_info;
    } else {
        ci.fMove = 1;
        ci.bgv = bgvDefault;
    }

    evalcontext ec = g_eval_context;
    movefilter filters[MAX_FILTER_PLIES][MAX_FILTER_PLIES];
    memcpy(filters, g_move_filter, sizeof(filters));

    if (FindnSaveBestMoves(&ml, dice[0], dice[1], (ConstTanBoard)board, NULL, 0.0f, &ci, &ec, filters) < 0) {
        if (ml.amMoves)
            g_free(ml.amMoves);
        return -1;
    }

    if (!ml.cMoves || !ml.amMoves)
        return 0;

    qsort(ml.amMoves, ml.cMoves, sizeof(move), (cfunc) CompareMoves);

    int copy_count = (ml.cMoves < (unsigned int)max_hints) ? (int)ml.cMoves : max_hints;
    memcpy(hints_out, ml.amMoves, sizeof(move) * copy_count);

    g_free(ml.amMoves);
    return copy_count;
}

int gnubg_hint_move(TanBoard board, int dice[2], void *hints_out, int max_hints) {
    return gnubg_hint_move_with_cube(board, dice, hints_out, max_hints, NULL);
}

static int evaluate_cube(const TanBoard board, cubeinfo *pci, float *out_no_double,
                         float *out_take, float *out_drop) {
    float aarOutput[2][NUM_ROLLOUT_OUTPUTS];
    float arDouble[4];
    evalcontext ec = g_eval_context;
    ec.fCubeful = TRUE;

    if (GeneralCubeDecisionE(aarOutput, board, pci, &ec, NULL) < 0)
        return -1;

    cubedecision decision = FindCubeDecision(arDouble, aarOutput, pci);

    if (out_no_double)
        *out_no_double = arDouble[OUTPUT_NODOUBLE];
    if (out_take)
        *out_take = arDouble[OUTPUT_TAKE];
    if (out_drop)
        *out_drop = arDouble[OUTPUT_DROP];

    return (int)decision;
}

int gnubg_hint_double(TanBoard board, void *cube_info, void *hint_out) {
    if (!g_initialized || !cube_info)
        return -1;

    ensure_thread_local_data();

    cubeinfo ci = *(cubeinfo *)cube_info;
    float *equity_out = (float *)hint_out;

    return evaluate_cube(board, &ci, equity_out, NULL, NULL);
}

int gnubg_hint_take(TanBoard board, void *cube_info, void *hint_out) {
    if (!g_initialized || !cube_info || !hint_out)
        return -1;

    ensure_thread_local_data();

    cubeinfo ci = *(cubeinfo *)cube_info;
    float *equities = (float *)hint_out;

    return evaluate_cube(board, &ci, NULL, &equities[0], &equities[1]);
}

const char *gnubg_position_id(const TanBoard board) {
    return PositionID(board);
}

int gnubg_position_from_id(TanBoard board, const char *positionId) {
    if (!positionId)
        return 0;
    PositionFromID(board, positionId);
    return 1;
}
