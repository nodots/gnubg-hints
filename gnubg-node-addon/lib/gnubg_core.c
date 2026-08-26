#include "config.h"
#include "gnubg_core.h"
#include "eval.h"
#include "positionid.h"
#include "matchequity.h"
#include "util.h"
#include "glib-ext.h"
#include "multithread.h"
#include "output.h"
#include "bearoff.h"
#include "rollout.h"
#include <glib.h>
#include <string.h>
#include <stdlib.h>

/* Bearoff DB pointers live in eval.c globals. Reach in to report load status
 * so callers can detect the silent-failure mode where extended DBs are not
 * shipped (gnubg_os.bd, gnubg_ts.bd) and eval falls through to the NN. */
extern bearoffcontext *pbc1;
extern bearoffcontext *pbc2;
extern bearoffcontext *pbcOS;
extern bearoffcontext *pbcTS;

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

    /* Surface bearoff DB load status so a degraded mode (missing extended
     * DBs gnubg_os.bd / gnubg_ts.bd) is visible rather than silently falling
     * back to the race neural net. See nodots/gnubg-hints#30. Suppress the
     * line if NODOTS_LOG_LEVEL=silent or NODOTS_LOG_SILENT=1. */
    {
        const char *silent_env = g_getenv("NODOTS_LOG_SILENT");
        const char *level_env = g_getenv("NODOTS_LOG_LEVEL");
        int silent = (silent_env && silent_env[0] == '1') ||
                     (level_env && g_ascii_strcasecmp(level_env, "silent") == 0);
        if (!silent) {
            g_printerr("[gnubg-hints] bearoff databases: pbc1=%s pbc2=%s pbcOS=%s pbcTS=%s\n",
                       pbc1 ? "loaded" : "MISSING",
                       pbc2 ? "loaded" : "MISSING",
                       pbcOS ? "loaded" : "MISSING",
                       pbcTS ? "loaded" : "MISSING");
        }
    }

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

    /* GeneralCubeDecisionE is unreliable for post-double positions (it returns
     * degenerate arDouble for many race/cube states). Instead compute the
     * taker's cubeful equity in the TAKE vs DROP states directly via gnubg's
     * own GeneralEvaluation + Utility — the same machinery getResignation uses.
     *   - TAKE: cube doubled, owned by taker, taker on roll.
     *   - DROP: cube unchanged, owned by doubler, doubler on roll (the taker
     *     declines and the doubler keeps the current cube).
     * Take iff the taker's equity after taking beats after dropping.
     * fMove here is the taker (caller sends fMoveOverride = taker). The doubler
     * is the opposite player. */
    const int taker = ci.fMove;
    const int doubler = taker ? 0 : 1;

    cubeinfo ciTake = ci;
    ciTake.nCube = ci.nCube * 2;
    ciTake.fCubeOwner = taker;
    ciTake.fMove = taker;

    cubeinfo ciDrop = ci;
    ciDrop.nCube = ci.nCube;
    ciDrop.fCubeOwner = doubler;
    ciDrop.fMove = doubler;

    float arTake[NUM_ROLLOUT_OUTPUTS];
    float arDrop[NUM_ROLLOUT_OUTPUTS];
    float arStdDev[NUM_ROLLOUT_OUTPUTS];
    rolloutstat arsStatistics[2];

    static evalsetup esTake;
    esTake.et = EVAL_EVAL;
    evalcontext ecTake = g_eval_context;
    ecTake.fCubeful = TRUE;
    esTake.ec = ecTake;

    static evalsetup esDrop;
    esDrop.et = EVAL_EVAL;
    evalcontext ecDrop = g_eval_context;
    ecDrop.fCubeful = TRUE;
    esDrop.ec = ecDrop;

    if (GeneralEvaluation(arTake, arStdDev, arsStatistics, (ConstTanBoard)board, &ciTake, &esTake, NULL, NULL) < 0)
        return -1;
    if (GeneralEvaluation(arDrop, arStdDev, arsStatistics, (ConstTanBoard)board, &ciDrop, &esDrop, NULL, NULL) < 0)
        return -1;

    /* Utility returns the equity for the player to move (fMove). For ciTake the
     * player to move is the taker; for ciDrop it is the doubler, so the taker's
     * drop equity is the NEGATIVE of the doubler's equity (zero-sum). */
    float eq_take = Utility(arTake, &ciTake);
    float eq_drop = -Utility(arDrop, &ciDrop);

    equities[0] = eq_take;
    equities[1] = eq_drop;
    return eq_take > eq_drop ? 2 : 0; /* 2 = take, 0 = drop */
}

/* Resignation verdict using gnubg's own getResignation +
 * getResignEquities (vendor/core/rollout.c). eval_setup is optional:
 * NULL mirrors what gnubg's computer player uses in play.c (EVAL_EVAL,
 * 0-ply) — resignation checks there are deliberately cheap. */
int gnubg_hint_resign(TanBoard board, void *cube_info, void *eval_setup,
                      void *hint_out) {
    if (!g_initialized || !cube_info || !hint_out)
        return -1;

    ensure_thread_local_data();

    cubeinfo ci = *(cubeinfo *)cube_info;
    float *out = (float *)hint_out;

    static evalsetup esDefault;
    esDefault.et = EVAL_EVAL;
    evalcontext ec = g_eval_context;
    ec.fCubeful = FALSE;
    esDefault.ec = ec;
    const evalsetup *es =
        eval_setup ? (const evalsetup *)eval_setup : &esDefault;

    float arResign[NUM_ROLLOUT_OUTPUTS];
    int nResigned = getResignation(arResign, board, &ci, es);
    if (nResigned < 0)
        return -1;

    float rBefore = 0.0f, rAfter = 0.0f;
    getResignEquities(arResign, &ci, nResigned, &rBefore, &rAfter);

    out[0] = (float)nResigned; /* 0 = none, 1/2/3 = single/gammon/backgammon */
    out[1] = rBefore;
    out[2] = rAfter;
    return nResigned;
}

/* Evaluate the DECIDER's equities for a specific offered concession.
 * Uses the same evaluation setup as gnubg_hint_resign but at the offered
 * value instead of gnubg's own verdict, so consumers can apply
 * external.c's accept rule (rEqAfter < rEqBefore) themselves. */
int gnubg_hint_resign_offered(TanBoard board, void *cube_info,
                              int nResigned, void *hint_out) {
    if (!g_initialized || !cube_info || !hint_out)
        return -1;

    ensure_thread_local_data();

    cubeinfo ci = *(cubeinfo *)cube_info;
    float *out = (float *)hint_out;

    float arResign[NUM_ROLLOUT_OUTPUTS];
    {
        /* Same machinery as gnubg_hint_resign: getResignation evaluates the
         * position (honouring g_eval_context) and classifies the loss. */
        static evalsetup esDefault;
        esDefault.et = EVAL_EVAL;
        evalcontext ec = g_eval_context;
        ec.fCubeful = FALSE;
        esDefault.ec = ec;
        int rcR = getResignation(arResign, board, &ci, &esDefault);
        fprintf(stderr, "[resign_offered] rc=%d ar=[%.3f %.3f %.3f %.3f %.3f] fMove=%d cube=%d owner=%d matchTo=%d score=[%d %d] \n",
                rcR, arResign[0], arResign[1], arResign[2], arResign[3], arResign[4],
                ci.fMove, ci.nCube, ci.fCubeOwner, ci.nMatchTo, ci.anScore[0], ci.anScore[1]);
        if (rcR < 0)
            return -1;
    }

    float rBefore = 0.0f, rAfter = 0.0f;
    getResignEquities(arResign, &ci, nResigned, &rBefore, &rAfter);

    /* gnubg's own accept/reject rule (vendor/core/external.c): the responder
     * accepts iff the opponent gives up equity by resigning — i.e. the
     * post-concession equity is worse than playing on, within a tiny epsilon.
     * We DO NOT re-derive this in the adapter; this is gnubg's verdict. */
    const float epsilon = 1.0e-6f;
    int accept = (rAfter - epsilon) < rBefore ? 1 : 0;

    out[0] = rBefore;
    out[1] = rAfter;
    out[2] = (float)accept;
    return 0;
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
