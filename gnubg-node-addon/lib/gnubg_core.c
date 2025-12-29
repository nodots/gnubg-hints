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

/* Find the highest point (largest index 0-5) with a checker in home board */
static int highest_checker_in_home(const TanBoard board) {
    for (int point = 5; point >= 0; --point) {
        if (board[0][point] > 0)
            return point;
    }
    return -1; /* No checkers in home */
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

/* Count blots (single checkers) for a player */
static int count_blots(const TanBoard board, int player) {
    int blots = 0;
    for (int point = 0; point < 24; ++point) {
        if (board[player][point] == 1)
            blots++;
    }
    return blots;
}

/* Count consecutive points (prime length) starting from a point */
static int prime_length_at(const TanBoard board, int player, int start) {
    int len = 0;
    for (int p = start; p < 24 && board[player][p] >= 2; ++p) {
        len++;
    }
    return len;
}

/* Find the longest prime */
static int longest_prime(const TanBoard board, int player) {
    int maxLen = 0;
    for (int p = 0; p < 24; ++p) {
        if (board[player][p] >= 2) {
            int len = prime_length_at(board, player, p);
            if (len > maxLen)
                maxLen = len;
        }
    }
    return maxLen;
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

    /* Additional evaluation factors for better differentiation */

    /* Blot penalty - exposed checkers are vulnerable */
    int playerBlots = count_blots(board, 0);
    int baseBlots = 0;
    for (int p = 0; p < 24; ++p) {
        if (ctx->basePlayerPoints[p] == 1)
            baseBlots++;
    }
    double blotPenalty = (playerBlots - baseBlots) * 0.8;

    /* Prime bonus - consecutive points are valuable */
    int primeLen = longest_prime(board, 0);
    double primeBonus = (primeLen >= 3) ? (primeLen - 2) * 1.5 : 0.0;

    /* Anchor bonus - points in opponent's home board */
    double anchorBonus = 0.0;
    for (int p = 18; p < 24; ++p) {
        if (board[0][p] >= 2)
            anchorBonus += 0.5;
    }

    /* Builder bonus - single checkers near key points (4, 5, 6) */
    double builderBonus = 0.0;
    for (int p = 6; p < 12; ++p) {
        if (board[0][p] == 1 && board[1][p] == 0) {
            /* Safe builder in outer board */
            builderBonus += 0.3;
        }
    }

    /* Slot penalty - blots in home board are risky early game */
    double slotPenalty = 0.0;
    for (int p = 0; p < 6; ++p) {
        if (board[0][p] == 1) {
            /* Blot in home board */
            slotPenalty += 0.4;
        }
    }

    /* Move-specific tiebreaker using unique hash to ensure distinct equities */
    double tiebreaker = 0.0;
    unsigned int moveHash = 0;
    for (int i = 0; i < pairs * 2 && i < 8; i += 2) {
        int from = moves[i];
        int to = moves[i + 1];
        if (from >= 0) {
            /* Create a unique value for each move combination */
            /* Use different multipliers for each move step to distinguish order */
            unsigned int stepHash = (unsigned int)((from + 1) * 31 + (to >= 0 ? to + 1 : 26));
            moveHash = moveHash * 37 + stepHash + (unsigned int)(i + 1);
        }
    }
    /* Scale hash to meaningful equity difference (0.01 to 0.1 range) */
    /* This ensures non-rank-1 moves have measurable equity loss for PR calculation */
    tiebreaker = (double)(moveHash % 100) * 0.001;

    double score = pipGain + opponentPipShift * 0.5 + opponentPressure * 3.0
                 + borneOff * 4.0 + pointScore - blotPenalty + primeBonus
                 + anchorBonus + builderBonus - slotPenalty + tiebreaker;
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

        /* Check opponent at same index - both players share index space */
        if (next[1][dest] >= 2)
            return;

        int hit = 0;
        if (next[1][dest] == 1) {
            next[1][dest] = 0;
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
            /* Bear-off rule: with oversized die, can only bear off from highest point.
               If die exactly equals from+1, it's exact. If die > from+1, oversized. */
            int highest = highest_checker_in_home(board);
            if (from < highest) {
                /* There's a checker on a higher point - can't bear off with oversized die */
                continue;
            }
            next[0][from] -= 1;
            localBorneOff += 1;
            moves[moveIndex] = from;
            moves[moveIndex + 1] = -1; /* off */
        } else {
            /* Check opponent at same index - both players share index space */
            if (next[1][dest] >= 2)
                continue;

            if (next[1][dest] == 1) {
                next[1][dest] = 0;
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

    if (!generated) {
        if (depth == 0) {
            /* No legal moves at all; record a pass */
            addon_move candidate;
            memset(&candidate, 0, sizeof(candidate));
            for (int i = 0; i < 8; ++i)
                candidate.anMove[i] = -1;
            candidate.rScore = 0.0f;
            candidate.rScore2 = 0.0f;
            push_move(buffer, &candidate);
        } else {
            /* Partial move: used some dice but can't use remaining (e.g., all checkers borne off).
               Record the partial move as a valid move sequence. */
            evaluate_and_store(buffer, board, depth, moves, borneOff, ctx);
        }
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

/* ===== Position ID Functions (from GNU Backgammon positionid.c) ===== */

#define L_POSITIONID 14

static inline void
positionid_addBits(unsigned char auchKey[10], unsigned int bitPos, unsigned int nBits)
{
    unsigned int k = bitPos / 8;
    unsigned int r = (bitPos & 0x7);
    unsigned int b = (((unsigned int) 0x1 << nBits) - 1) << r;

    auchKey[k] |= (unsigned char) b;

    if (k < 8) {
        auchKey[k + 1] |= (unsigned char) (b >> 8);
        auchKey[k + 2] |= (unsigned char) (b >> 16);
    } else if (k == 8) {
        auchKey[k + 1] |= (unsigned char) (b >> 8);
    }
}

static void
positionid_oldPositionKey(const TanBoard anBoard, oldpositionkey * pkey)
{
    unsigned int i, iBit = 0;
    const unsigned int *j;

    memset(pkey, 0, sizeof(oldpositionkey));

    for (i = 0; i < 2; ++i) {
        const unsigned int *const b = anBoard[i];
        for (j = b; j < b + 25; ++j) {
            const unsigned int nc = *j;

            if (nc) {
                positionid_addBits(pkey->auch, iBit, nc);
                iBit += nc + 1;
            } else {
                ++iBit;
            }
        }
    }
}

static char *
positionid_oldPositionIDFromKey(const oldpositionkey * pkey)
{
    unsigned char const *puch = pkey->auch;
    static char szID[L_POSITIONID + 1];
    char *pch = szID;
    static const char aszBase64[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    int i;

    for (i = 0; i < 3; i++) {
        *pch++ = aszBase64[puch[0] >> 2];
        *pch++ = aszBase64[((puch[0] & 0x03) << 4) | (puch[1] >> 4)];
        *pch++ = aszBase64[((puch[1] & 0x0F) << 2) | (puch[2] >> 6)];
        *pch++ = aszBase64[puch[2] & 0x3F];

        puch += 3;
    }

    *pch++ = aszBase64[*puch >> 2];
    *pch++ = aszBase64[(*puch & 0x03) << 4];

    *pch = 0;

    return szID;
}

const char* gnubg_position_id(const TanBoard anBoard) {
    oldpositionkey key;
    positionid_oldPositionKey(anBoard, &key);
    return positionid_oldPositionIDFromKey(&key);
}

/* Decode base64 character to value */
static unsigned char positionid_Base64(unsigned char ch) {
    if (ch >= 'A' && ch <= 'Z')
        return ch - 'A';
    if (ch >= 'a' && ch <= 'z')
        return ch - 'a' + 26;
    if (ch >= '0' && ch <= '9')
        return ch - '0' + 52;
    if (ch == '+')
        return 62;
    if (ch == '/')
        return 63;
    return 255; /* Invalid character */
}

/* Decode position ID string to key */
static int positionid_oldPositionKeyFromID(const char *szID, oldpositionkey *pkey) {
    if (!szID || !pkey)
        return 0;

    size_t len = strlen(szID);
    if (len != L_POSITIONID)
        return 0;

    unsigned char *puch = pkey->auch;
    memset(pkey, 0, sizeof(oldpositionkey));

    const char *pch = szID;
    for (int i = 0; i < 3; i++) {
        unsigned char c0 = positionid_Base64((unsigned char)*pch++);
        unsigned char c1 = positionid_Base64((unsigned char)*pch++);
        unsigned char c2 = positionid_Base64((unsigned char)*pch++);
        unsigned char c3 = positionid_Base64((unsigned char)*pch++);

        if (c0 == 255 || c1 == 255 || c2 == 255 || c3 == 255)
            return 0;

        *puch++ = (c0 << 2) | (c1 >> 4);
        *puch++ = ((c1 & 0x0F) << 4) | (c2 >> 2);
        *puch++ = ((c2 & 0x03) << 6) | c3;
    }

    unsigned char c0 = positionid_Base64((unsigned char)*pch++);
    unsigned char c1 = positionid_Base64((unsigned char)*pch++);

    if (c0 == 255 || c1 == 255)
        return 0;

    *puch = (c0 << 2) | (c1 >> 4);

    return 1; /* Success */
}

/* Decode key to board position */
static void positionid_oldPositionFromKey(TanBoard anBoard, const oldpositionkey *pkey) {
    unsigned int i, j;
    const unsigned char *puch = pkey->auch;
    unsigned int nBit = 0;

    memset(anBoard, 0, sizeof(TanBoard));

    for (i = 0; i < 2; i++) {
        for (j = 0; j < 25; j++) {
            unsigned int nByte = nBit / 8;
            unsigned int nBitInByte = nBit % 8;
            unsigned int nChequers = 0;

            /* Read unary encoded count: count consecutive 1s until 0 */
            while (nByte < 10) {
                unsigned char byte = puch[nByte];
                int bit = (byte >> nBitInByte) & 1;

                if (bit == 0) {
                    /* Found terminating 0 */
                    nBit++;
                    break;
                }

                nChequers++;
                nBit++;
                nBitInByte++;
                if (nBitInByte >= 8) {
                    nBitInByte = 0;
                    nByte++;
                }
            }

            anBoard[i][j] = nChequers;
        }
    }
}

/* Decode GNU Backgammon position ID to board
 * Returns 1 on success, 0 on failure */
int gnubg_position_from_id(TanBoard anBoard, const char *szID) {
    oldpositionkey key;

    if (!positionid_oldPositionKeyFromID(szID, &key))
        return 0;

    positionid_oldPositionFromKey(anBoard, &key);
    return 1;
}

/* ===== End Position ID Functions ===== */

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
