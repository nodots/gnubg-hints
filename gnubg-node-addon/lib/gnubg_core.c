#include "gnubg_core.h"
#include "positionid.h"
#include <string.h>
#include <stdlib.h>

#define MAX_GENERATED_MOVES 256
typedef struct {
    int anMove[8];
    float rScore;
    float rScore2;
} addon_move;

typedef struct {
    addon_move entries[MAX_GENERATED_MOVES];
    int count;
} move_buffer;

typedef struct {
    double basePlayerPips;
    double baseOpponentPips;
    unsigned int baseOpponentBar;
    unsigned int basePlayerPoints[24];
} eval_context;

static int initialized = 0;

static void copy_board(TanBoard dest, const TanBoard src) {
    memcpy(dest, src, sizeof(TanBoard));
}

static double compute_pip_count(const TanBoard board, int player) {
    double total = 0.0;
    for (int point = 0; point < 24; ++point) {
        total += (point + 1) * board[player][point];
    }
    /* Treat checkers on the bar as furthest distance */
    total += 25.0 * board[player][24];
    return total;
}

static int all_checkers_in_home(const TanBoard board) {
    if (board[0][24] > 0)
        return 0;
    for (int point = 6; point < 24; ++point) {
        if (board[0][point] > 0)
            return 0;
    }
    return 1;
}

static void normalise_move(addon_move *move, int pairs) {
    for (int i = pairs * 2; i < 8; ++i)
        move->anMove[i] = -1;
}

static int compare_moves_desc(const void *a, const void *b) {
    const addon_move *ma = (const addon_move *)a;
    const addon_move *mb = (const addon_move *)b;
    if (ma->rScore < mb->rScore)
        return 1;
    if (ma->rScore > mb->rScore)
        return -1;
    return 0;
}

static void push_move(move_buffer *buffer, const addon_move *candidate) {
    if (buffer->count >= MAX_GENERATED_MOVES)
        return;
    buffer->entries[buffer->count++] = *candidate;
}

static void evaluate_and_store(move_buffer *buffer, const TanBoard board, int pairs,
                               const int moves[8], int borneOff, const eval_context *ctx) {
    addon_move candidate;
    memset(&candidate, 0, sizeof(candidate));

    for (int i = 0; i < pairs * 2 && i < 8; ++i)
        candidate.anMove[i] = moves[i];
    normalise_move(&candidate, pairs);

    double playerPips = compute_pip_count(board, 0);
    double opponentPips = compute_pip_count(board, 1);
    unsigned int opponentBar = board[1][24];

    double pipGain = ctx->basePlayerPips - playerPips;
    double opponentPressure = (double)(opponentBar - ctx->baseOpponentBar);
    double opponentPipShift = ctx->baseOpponentPips - opponentPips;
    double pointScore = 0.0;

    for (int point = 0; point < 24; ++point) {
        if (board[0][point] >= 2 && ctx->basePlayerPoints[point] < 2) {
            double weight = 1.5;
            if (point < 6)
                weight += 2.0;
            if (point == 4)
                weight += 3.0;
            pointScore += weight;
        }
    }

    double score = pipGain + opponentPipShift * 0.5 + opponentPressure * 3.0 + borneOff * 4.0 + pointScore;
    candidate.rScore = (float)score;
    candidate.rScore2 = candidate.rScore;
    push_move(buffer, &candidate);
}

static void search_moves(move_buffer *buffer, const TanBoard board, const int diceSeq[], int diceCount,
                         int depth, int moves[8], int borneOff, const eval_context *ctx) {
    if (depth == diceCount) {
        evaluate_and_store(buffer, board, depth, moves, borneOff, ctx);
        return;
    }

    int die = diceSeq[depth];
    int moveIndex = depth * 2;

    if (board[0][24] > 0) {
        /* Must enter from the bar */
        if (board[0][24] == 0)
            return;

        int dest = 24 - die;
        if (dest < 0 || dest > 23)
            return;

        TanBoard next;
        copy_board(next, board);

        int oppIndex = 23 - dest;
        if (next[1][oppIndex] >= 2)
            return;

        int hit = 0;
        if (next[1][oppIndex] == 1) {
            next[1][oppIndex] = 0;
            next[1][24] += 1;
            hit = 1;
        }

        next[0][24] -= 1;
        next[0][dest] += 1;

        moves[moveIndex] = 24; /* bar index */
        moves[moveIndex + 1] = dest;

        search_moves(buffer, next, diceSeq, diceCount, depth + 1, moves, borneOff, ctx);

        /* undo hit effect handled by using copied board */
        (void)hit;
        return;
    }

    int generated = 0;
    for (int from = 23; from >= 0; --from) {
        if (board[0][from] == 0)
            continue;

        TanBoard next;
        copy_board(next, board);

        int dest = from - die;
        int localBorneOff = borneOff;

        if (dest < 0) {
            if (!all_checkers_in_home(board))
                continue;
            next[0][from] -= 1;
            localBorneOff += 1;
            moves[moveIndex] = from;
            moves[moveIndex + 1] = -1; /* off */
        } else {
            int oppIndex = 23 - dest;
            if (next[1][oppIndex] >= 2)
                continue;

            if (next[1][oppIndex] == 1) {
                next[1][oppIndex] = 0;
                next[1][24] += 1;
            }

            next[0][from] -= 1;
            next[0][dest] += 1;
            moves[moveIndex] = from;
            moves[moveIndex + 1] = dest;
        }

        search_moves(buffer, next, diceSeq, diceCount, depth + 1, moves, localBorneOff, ctx);
        generated = 1;
    }

    if (!generated && depth == 0) {
        /* No legal moves at all; record a pass */
        addon_move candidate;
        memset(&candidate, 0, sizeof(candidate));
        for (int i = 0; i < 8; ++i)
            candidate.anMove[i] = -1;
        candidate.rScore = 0.0f;
        candidate.rScore2 = 0.0f;
        push_move(buffer, &candidate);
    }
}

static void generate_move_list(move_buffer *buffer, const TanBoard board, const int dice[2], int diceCount,
                               const eval_context *ctx) {
    if (diceCount == 4) {
        int sequence[4] = {dice[0], dice[0], dice[0], dice[0]};
        int moves[8];
        memset(moves, -1, sizeof(moves));
        search_moves(buffer, board, sequence, 4, 0, moves, 0, ctx);
    } else {
        int moves[8];
        memset(moves, -1, sizeof(moves));

        int orderA[2] = {dice[0], dice[1]};
        search_moves(buffer, board, orderA, 2, 0, moves, 0, ctx);

        if (dice[0] != dice[1]) {
            int orderB[2] = {dice[1], dice[0]};
            memset(moves, -1, sizeof(moves));
            search_moves(buffer, board, orderB, 2, 0, moves, 0, ctx);
        }
    }
}

static void deduplicate_moves(move_buffer *buffer) {
    int writeIndex = 0;
    for (int i = 0; i < buffer->count; ++i) {
        int duplicate = 0;
        for (int j = 0; j < writeIndex; ++j) {
            if (memcmp(buffer->entries[i].anMove, buffer->entries[j].anMove, sizeof(int) * 8) == 0) {
                duplicate = 1;
                if (buffer->entries[i].rScore > buffer->entries[j].rScore)
                    buffer->entries[j] = buffer->entries[i];
                break;
            }
        }
        if (!duplicate) {
            buffer->entries[writeIndex++] = buffer->entries[i];
        }
    }
    buffer->count = writeIndex;
}

int gnubg_initialize(void) {
    initialized = 1;
    return 0;
}

void gnubg_shutdown(void) {
    initialized = 0;
}

int gnubg_hint_move(TanBoard board, int dice[2], void *hints_out, int max_hints) {
    if (!initialized || !hints_out || max_hints <= 0)
        return 0;

    move_buffer buffer;
    buffer.count = 0;

    eval_context ctx;
    ctx.basePlayerPips = compute_pip_count(board, 0);
    ctx.baseOpponentPips = compute_pip_count(board, 1);
    ctx.baseOpponentBar = board[1][24];
    for (int point = 0; point < 24; ++point)
        ctx.basePlayerPoints[point] = board[0][point];

    int diceSeq[2];
    int diceCount = 2;
    diceSeq[0] = dice[0];
    diceSeq[1] = dice[1];

    if (dice[0] == dice[1]) {
        diceCount = 4;
    }

    generate_move_list(&buffer, board, diceSeq, diceCount, &ctx);
    deduplicate_moves(&buffer);
    qsort(buffer.entries, buffer.count, sizeof(addon_move), compare_moves_desc);

    addon_move *moves = (addon_move *)hints_out;
    int produced = buffer.count < max_hints ? buffer.count : max_hints;
    for (int i = 0; i < produced; ++i)
        moves[i] = buffer.entries[i];

    return produced;
}

int gnubg_hint_double(TanBoard board, void *cube_info, void *hint_out) {
    (void)board;
    (void)cube_info;
    float *equity = (float *)hint_out;
    if (equity)
        *equity = 0.0f;
    return 0;
}

int gnubg_hint_take(TanBoard board, void *cube_info, void *hint_out) {
    (void)board;
    (void)cube_info;
    float *take_equity = (float *)hint_out;
    if (take_equity)
        *take_equity = 0.0f;
    return 0;
}
